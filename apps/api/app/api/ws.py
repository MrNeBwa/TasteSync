import jwt
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.security import decode_token
from app.db.session import AsyncSessionLocal
from app.models.room_member import RoomMember
from app.repositories.room_repository import RoomRepository
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/rooms/{room_id}")
async def room_websocket(websocket: WebSocket, room_id: str, token: str = Query(...)) -> None:
    try:
        from uuid import UUID

        room_uuid = UUID(room_id)
        user_id = decode_token(token, expected_type="access")
    except (ValueError, jwt.InvalidTokenError):
        await websocket.close(code=1008, reason="Invalid authentication")
        return

    async with AsyncSessionLocal() as session:
        membership = await session.scalar(
            select(RoomMember).where(
                RoomMember.room_id == room_uuid,
                RoomMember.user_id == user_id,
            )
        )
        if membership is None:
            await websocket.close(code=1008, reason="Not a room member")
            return

    await manager.connect(room_uuid, websocket)
    await manager.broadcast(
        room_uuid,
        {"type": "ROOM_MEMBER_CONNECTED", "room_id": room_id, "payload": {"user_id": str(user_id)}},
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(room_uuid, websocket)
        await manager.broadcast(
            room_uuid,
            {"type": "ROOM_MEMBER_DISCONNECTED", "room_id": room_id, "payload": {"user_id": str(user_id)}},
        )
