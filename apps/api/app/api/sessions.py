from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.modules.movies.schemas import GenreResponse, MovieResponse
from app.modules.sessions.schemas import MatchResponse, SessionResponse, VoteRequest, VoteResponse
from app.modules.sessions.service import (
    CannotFinishSessionError,
    DuplicateVoteError,
    MovieNotFoundError,
    MovieSessionService,
    SessionNotActiveError,
    SessionNotFoundError,
    SessionNotMemberError,
)
from app.repositories.movie_repository import MovieRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.session_repository import SessionRepository
from app.websocket.manager import manager

router = APIRouter(prefix="/sessions", tags=["sessions"])


def movie_response(movie) -> MovieResponse:
    return MovieResponse(
        id=movie.id,
        title=movie.title,
        overview=movie.overview,
        release_date=movie.release_date,
        poster_url=movie.poster_url,
        backdrop_url=movie.backdrop_url,
        popularity=movie.popularity,
        vote_average=movie.vote_average,
        vote_count=movie.vote_count,
        is_adult=bool(movie.is_adult),
        trailer_url=movie.primary_trailer_url,
        genres=[GenreResponse(id=mg.genre.id, name=mg.genre.name) for mg in movie.genres],
    )


def service(session: AsyncSession) -> MovieSessionService:
    return MovieSessionService(
        SessionRepository(session),
        RoomRepository(session),
        MovieRepository(session),
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SessionResponse:
    svc = service(db)
    try:
        movie_session = await svc.get_for_member(session_id=session_id, user_id=current_user.id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except SessionNotMemberError as exc:
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc

    return SessionResponse.model_validate(movie_session)


@router.get("/{session_id}/matches", response_model=list[MatchResponse])
async def get_matches(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[MatchResponse]:
    svc = service(db)
    try:
        await svc.get_for_member(session_id=session_id, user_id=current_user.id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except SessionNotMemberError as exc:
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc
    matches = await svc.sessions.list_matches(session_id=session_id)
    return [MatchResponse.model_validate(match) for match in matches]


@router.get("/{session_id}/movies", response_model=list[MovieResponse])
async def get_recommendations(
    session_id: UUID,
    limit: int = Query(default=10, ge=1, le=30),
    exploration_ratio: float = Query(default=0.25, ge=0, le=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[MovieResponse]:
    svc = service(db)
    try:
        movies = await svc.recommendations(
            session_id=session_id,
            user_id=current_user.id,
            limit=limit,
            exploration_ratio=exploration_ratio,
        )
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except SessionNotMemberError as exc:
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc
    except SessionNotActiveError as exc:
        raise HTTPException(status_code=409, detail="Session is not active") from exc
    return [movie_response(movie) for movie in movies]


@router.post("/{session_id}/votes", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
async def vote(
    session_id: UUID,
    payload: VoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> VoteResponse:
    svc = service(db)
    try:
        _vote, match = await svc.vote(
            session_id=session_id,
            user_id=current_user.id,
            movie_id=payload.movie_id,
            value=payload.value,
        )
        await db.commit()
    except SessionNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except SessionNotMemberError as exc:
        await db.rollback()
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc
    except SessionNotActiveError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Session is not active") from exc
    except MovieNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Movie not found") from exc
    except DuplicateVoteError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="User already voted for this movie") from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Vote already exists") from exc

    if match is not None:
        matched_session = await svc.get_for_member(
            session_id=session_id,
            user_id=current_user.id,
        )
        await manager.broadcast(
            matched_session.room_id,
            {
                "type": "MATCH_FOUND",
                "room_id": str(matched_session.room_id),
                "payload": {
                    "session_id": str(session_id),
                    "movie_id": str(payload.movie_id),
                    "match_id": str(match.id),
                },
            },
        )

    return VoteResponse(
        session_id=session_id,
        movie_id=payload.movie_id,
        value=payload.value,
        matched=match is not None,
        match=MatchResponse.model_validate(match) if match is not None else None,
    )


@router.post("/{session_id}/finish", response_model=SessionResponse)
async def finish_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SessionResponse:
    svc = service(db)
    try:
        movie_session = await svc.finish(
            session_id=session_id,
            user_id=current_user.id,
        )
        await db.commit()
    except SessionNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except SessionNotMemberError as exc:
        await db.rollback()
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc
    except CannotFinishSessionError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    await manager.broadcast(
        movie_session.room_id,
        {
            "type": "SESSION_FINISHED",
            "room_id": str(movie_session.room_id),
            "payload": {"session_id": str(session_id)},
        },
    )
    return SessionResponse.model_validate(movie_session)
