from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.session import SessionStatus
from app.models.vote import VoteValue


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    room_id: UUID
    status: SessionStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class VoteRequest(BaseModel):
    movie_id: UUID
    value: VoteValue


class MatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    movie_id: UUID
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class VoteResponse(BaseModel):
    session_id: UUID
    movie_id: UUID
    value: VoteValue
    matched: bool
    match: MatchResponse | None = None
