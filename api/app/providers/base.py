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


class MovieProvider(Protocol):
    async def get_popular_movies(self, *, page: int = 1) -> list[ProviderMovie]: ...
    async def get_movie(self, provider_id: str) -> ProviderMovie: ...
