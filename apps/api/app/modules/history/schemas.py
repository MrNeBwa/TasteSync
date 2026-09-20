from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.room import RoomStatus
from app.modules.movies.schemas import MovieResponse


class HistoryRoomItem(BaseModel):
    room_id: UUID
    room_name: str
    room_code: str
    room_status: RoomStatus
    created_at: datetime
    member_count: int
    matched_movies: list[MovieResponse] = []


class HistoryResponse(BaseModel):
    items: list[HistoryRoomItem]
