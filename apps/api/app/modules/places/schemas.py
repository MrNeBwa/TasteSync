from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.place import PlaceCategory


class PlaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    category: PlaceCategory
    address: str | None
    city: str | None
    latitude: float
    longitude: float
    image_url: str | None
    rating: float | None
    price_level: str | None
    cuisine: str | None
    tags: list[str] = []
    website: str | None
    phone: str | None
    opening_hours: str | None
    # Always set. `image_url` is a real OpenStreetMap photo when one exists and
    # is usually None, so the client must not treat it as the only picture
    # source or most places render with nothing to show.
    cover_url: str


class PlaceMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    place_id: UUID
    created_at: datetime