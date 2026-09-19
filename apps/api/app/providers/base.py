from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True)
class ProviderGenre:
    provider_id: str
    name: str


@dataclass(slots=True)
class ProviderVideo:
    key: str
    name: str
    site: str
    kind: str
    official: bool


@dataclass(slots=True)
class ProviderMovie:
    provider_id: str
    title: str
    overview: str | None
    release_date: str | None
    poster_url: str | None
    backdrop_url: str | None
    popularity: float | None
    vote_average: float | None
    vote_count: int | None
    is_adult: bool
    genres: list[ProviderGenre]
    trailers: list[ProviderVideo]


@dataclass(slots=True)
class ProviderPlace:
    provider_id: str
    name: str
    category: str
    address: str | None
    city: str | None
    latitude: float
    longitude: float
    image_url: str | None
    rating: float | None
    price_level: str | None
    tags: list[str]
    website: str | None
    phone: str | None
    opening_hours: str | None


class MovieProvider(Protocol):
    async def get_popular_movies(self, *, page: int = 1) -> list[ProviderMovie]: ...
    async def get_movie(self, provider_id: str) -> ProviderMovie: ...


class PlacesProvider(Protocol):
    async def search(
        self,
        *,
        category: str,
        latitude: float,
        longitude: float,
        radius: int,
        limit: int,
    ) -> list[ProviderPlace]: ...
