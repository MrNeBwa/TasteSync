from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.movie import Movie
from app.modules.movies.schemas import GenreResponse, MovieResponse
from app.modules.movies.service import MovieService
from app.providers.tmdb import TMDBProvider
from app.repositories.movie_repository import MovieRepository

router = APIRouter(prefix="/movies", tags=["movies"])


def _to_response(movie: Movie) -> MovieResponse:
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
        trailer_url=movie.primary_trailer_url,
        genres=[GenreResponse(id=mg.genre.id, name=mg.genre.name) for mg in movie.genres],
    )


@router.get("", response_model=list[MovieResponse])
async def list_movies(
    limit: int = Query(default=30, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> list[MovieResponse]:
    movies = await MovieRepository(session).list_popular(limit=limit)
    return [_to_response(movie) for movie in movies]


@router.post("/sync-popular")
async def sync_popular(
    pages: int = Query(default=3, ge=1, le=20),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    provider = TMDBProvider()
    try:
        count = await MovieService(MovieRepository(session), provider).sync_popular(pages=pages)
        await session.commit()
        return {"synced": count}
    finally:
        await provider.close()
