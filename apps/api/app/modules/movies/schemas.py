from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.models.movie import Movie


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
    is_adult: bool
    trailer_url: str | None
    genres: list[GenreResponse]


def to_movie_response(movie: Movie) -> MovieResponse:
    return MovieResponse(
        id=movie.id,
        title=movie.title,
        overview=movie.overview,
        release_date=movie.release_date,
        poster_url=movie.poster_url,
        backdrop_url=movie.backdrop_url,
        popularity=movie.popularity,
        vote_average=movie.vote_average,
        vote_count=movie.vote_count,
        is_adult=bool(movie.is_adult),
        trailer_url=movie.primary_trailer_url,
        genres=[GenreResponse(id=mg.genre_id, name=mg.genre.name) for mg in movie.genres],
    )
