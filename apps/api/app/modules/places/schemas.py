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


class PlaceMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    place_id: UUID
    created_at: datetime