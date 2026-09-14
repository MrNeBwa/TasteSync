from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[UUID, set[WebSocket]] = defaultdict(set)

    async def connect(self, room_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[room_id].add(websocket)

    def disconnect(self, room_id: UUID, websocket: WebSocket) -> None:
        connections = self._rooms.get(room_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._rooms.pop(room_id, None)

    async def broadcast(self, room_id: UUID, message: dict[str, Any]) -> None:
        for websocket in list(self._rooms.get(room_id, ())):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(room_id, websocket)


manager = ConnectionManager()
