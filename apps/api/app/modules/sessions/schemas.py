from __future__ import annotations

from datetime import datetime
from typing import Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.place import PlaceCategory
from app.models.session import SessionStatus
from app.models.vote import VoteValue
from app.modules.places.schemas import PlaceMatchResponse


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    room_id: UUID
    status: SessionStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class VoteRequest(BaseModel):
    movie_id: UUID | None = None
    place_id: UUID | None = None
    category: PlaceCategory | None = None
    value: VoteValue

    @model_validator(mode="after")
    def _check_target(self) -> VoteRequest:
        if self.movie_id is None and self.place_id is None:
            raise ValueError("One of movie_id or place_id is required")
        return self


class MatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    movie_id: UUID
    created_at: datetime


class VoteResponse(BaseModel):
    session_id: UUID
    movie_id: UUID | None = None
    place_id: UUID | None = None
    category: PlaceCategory | None = None
    value: VoteValue
    matched: bool
    match: Union[MatchResponse, PlaceMatchResponse, None] = None