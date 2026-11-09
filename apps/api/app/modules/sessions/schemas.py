from __future__ import annotations

from datetime import datetime
from typing import Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.place import PlaceCategory
from app.models.session import SessionStatus
from app.models.vote import VoteValue
from app.modules.movies.schemas import MovieResponse
from app.modules.places.schemas import PlaceMatchResponse, PlaceResponse


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


class SessionMatchResponse(BaseModel):
    """The newest match of a session, resolved into the card a client renders.

    A match can come from the movie flow or the places flow. A client that
    learns about it out-of-band (by polling the session status rather than
    receiving the realtime ``MATCH_FOUND`` event) needs the full item, not just
    an id, so the whole movie/place is embedded here.
    """

    kind: Literal["movie", "place"]
    match_id: UUID
    created_at: datetime
    category: str
    movie: MovieResponse | None = None
    place: PlaceResponse | None = None