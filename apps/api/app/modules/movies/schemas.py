from datetime import date
from uuid import UUID

from pydantic import BaseModel


class GenreResponse(BaseModel):
    id: UUID
    name: str


class MovieResponse(BaseModel):
    id: UUID
    title: str
    overview: str | None
    release_date: date | None
    poster_url: str | None
    backdrop_url: str | None
    popularity: float | None
    vote_average: float | None
    vote_count: int | None
    trailer_url: str | None
    genres: list[GenreResponse]
