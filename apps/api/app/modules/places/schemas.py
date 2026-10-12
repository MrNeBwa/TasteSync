from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.place import Place, PlaceCategory


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
    # Always set. `image_url` is a real photo when one exists (OpenStreetMap
    # tag, Wikimedia Commons, or the Google photo proxy path) and is usually
    # None, so the client must not treat it as the only picture source or most
    # places render with nothing to show.
    cover_url: str


class PlaceMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    place_id: UUID
    created_at: datetime


def to_place_response(place: Place) -> PlaceResponse:
    """Serialize a place the way every client expects it.

    `tags` is stored as a `|`-joined string but is part of the response as a
    list, and `cover_url` always points at the generated artwork so a client
    never has to guess whether `image_url` is the only picture. `image_url`
    carries a real photo when the enrichment found one and never exposes an
    API key.
    """
    return PlaceResponse(
        id=place.id,
        name=place.name,
        category=place.category,
        address=place.address,
        city=place.city,
        latitude=place.latitude,
        longitude=place.longitude,
        # A real external photo (OSM tag / Wikimedia) when one exists; a place
        # resolved through Google Places has no public URL, so the client gets
        # the same-origin proxy path that streams it without the API key.
        image_url=place.image_url
        or (f"/api/places/{place.id}/photo" if place.google_photo_ref else None),
        rating=place.rating,
        price_level=place.price_level,
        cuisine=place.cuisine,
        tags=place.tags.split("|") if place.tags else [],
        website=place.website,
        phone=place.phone,
        opening_hours=place.opening_hours,
        cover_url=f"/api/places/{place.id}/cover.svg",
    )