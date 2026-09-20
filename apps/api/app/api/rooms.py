from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.modules.rooms.schemas import (
    CreateRoomRequest,
    JoinRoomRequest,
    ReadyResponse,
    RoomDetailResponse,
    RoomMemberResponse,
    RoomResponse,
    UpdateRoomTaskRequest,
)
from app.modules.rooms.service import (
    AlreadyMemberError,
    CannotLeaveRoomError,
    InvalidRoomStateError,
    NotMemberError,
    NotOwnerError,
    RoomNotFoundError,
    RoomService,
    UserNotFoundError,
)
from app.repositories.room_repository import RoomRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.movie_repository import MovieRepository
from app.modules.sessions.service import CannotStartSessionError, MovieSessionService, SessionNotFoundError
from app.websocket.manager import manager

router = APIRouter(prefix="/rooms", tags=["rooms"])


def room_detail(room) -> RoomDetailResponse:
    return RoomDetailResponse(
        id=room.id,
        name=room.name,
        code=room.code,
        owner_id=room.owner_id,
        status=room.status,
        task=room.task,
        created_at=room.created_at,
        members=[
            RoomMemberResponse(
                user_id=member.user_id,
                username=member.user.username,
                role=member.role,
                is_ready=member.is_ready,
                joined_at=member.joined_at,
            )
            for member in room.members
        ],
    )


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    payload: CreateRoomRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RoomResponse:
    service = RoomService(RoomRepository(session))
    try:
        room = await service.create_room(name=payload.name, owner_id=current_user.id, task=payload.task)
        await session.commit()
    except UserNotFoundError as exc:
        await session.rollback()
        raise HTTPException(status_code=404, detail="User not found") from exc
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        await session.rollback()
        raise
    return RoomResponse.model_validate(room)


@router.post("/join", response_model=RoomDetailResponse)
async def join_room(
    payload: JoinRoomRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RoomDetailResponse:
    service = RoomService(RoomRepository(session))
    try:
        room = await service.join_room(code=payload.code, user_id=current_user.id)
        await session.commit()
        room = await service.get_room_for_member(room_id=room.id, user_id=current_user.id)
    except RoomNotFoundError as exc:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Room not found") from exc
    except AlreadyMemberError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="User already joined this room") from exc
    except UserNotFoundError as exc:
        await session.rollback()
        raise HTTPException(status_code=404, detail="User not found") from exc
    except InvalidRoomStateError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return room_detail(room)


@router.get("/{room_id}", response_model=RoomDetailResponse)
async def get_room(
    room_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RoomDetailResponse:
    service = RoomService(RoomRepository(session))
    try:
        room = await service.get_room_for_member(room_id=room_id, user_id=current_user.id)
    except RoomNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Room not found") from exc
    except NotMemberError as exc:
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc
    return room_detail(room)


@router.patch("/{room_id}/ready", response_model=ReadyResponse)
async def set_ready(
    room_id: UUID,
    ready: bool,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReadyResponse:
    service = RoomService(RoomRepository(session))
    try:
        room = await service.set_ready(room_id=room_id, user_id=current_user.id, is_ready=ready)
        await session.commit()
    except RoomNotFoundError as exc:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Room not found") from exc
    except NotMemberError as exc:
        await session.rollback()
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc
    except InvalidRoomStateError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    detail = room_detail(room)
    await manager.broadcast(
        room_id,
        {"type": "ROOM_READY_CHANGED", "room_id": str(room_id), "payload": detail.model_dump(mode="json")},
    )
    return ReadyResponse(room=detail, is_ready=ready)


@router.patch("/{room_id}/task", response_model=RoomDetailResponse)
async def update_room_task(
    room_id: UUID,
    payload: UpdateRoomTaskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RoomDetailResponse:
    service = RoomService(RoomRepository(session))
    try:
        room = await service.update_task(room_id=room_id, user_id=current_user.id, task=payload.task)
        await session.commit()
    except RoomNotFoundError as exc:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Room not found") from exc
    except NotOwnerError as exc:
        await session.rollback()
        raise HTTPException(status_code=403, detail="Only the room owner can change the category") from exc
    except InvalidRoomStateError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    detail = room_detail(room)
    await manager.broadcast(
        room_id,
        {"type": "ROOM_TASK_CHANGED", "room_id": str(room_id), "payload": detail.model_dump(mode="json")},
    )
    return detail


@router.post("/{room_id}/start")
async def start_room(
    room_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MovieSessionService(
        SessionRepository(session),
        RoomRepository(session),
        MovieRepository(session),
    )
    try:
        movie_session = await svc.create_for_room(room_id=room_id, user_id=current_user.id)
        await session.commit()
    except SessionNotFoundError as exc:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Room not found") from exc
    except CannotStartSessionError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    await manager.broadcast(
        room_id,
        {
            "type": "SESSION_STARTED",
            "room_id": str(room_id),
            "payload": {"session_id": str(movie_session.id)},
        },
    )
    return {
        "session_id": movie_session.id,
        "room_id": movie_session.room_id,
        "status": movie_session.status,
        "created_at": movie_session.created_at,
    }


@router.delete("/{room_id}/members/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_room(
    room_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    service = RoomService(RoomRepository(session))
    try:
        await service.leave_room(room_id=room_id, user_id=current_user.id)
        await session.commit()
    except RoomNotFoundError as exc:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Room not found") from exc
    except CannotLeaveRoomError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Room owner cannot leave the room") from exc
    except NotMemberError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="User is not a member of this room") from exc

    await manager.broadcast(
        room_id,
        {"type": "ROOM_MEMBER_LEFT", "room_id": str(room_id), "payload": {"user_id": str(current_user.id)}},
    )
