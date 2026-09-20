from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.movie import Movie
from app.models.user import User
from app.modules.movies.schemas import MovieResponse, to_movie_response
from app.modules.movies.service import MovieService
from app.providers.tmdb import TMDBProvider
from app.repositories.movie_repository import MovieRepository

router = APIRouter(prefix="/movies", tags=["movies"])


def _to_response(movie: Movie) -> MovieResponse:
    return to_movie_response(movie)


@router.get("", response_model=list[MovieResponse])
async def list_movies(
    limit: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[MovieResponse]:
    adult_allowed = current_user.birth_date is not None
    if current_user.birth_date is not None:
        today = date.today()
        age = (
            today.year
            - current_user.birth_date.year
            - (
                (today.month, today.day)
                < (current_user.birth_date.month, current_user.birth_date.day)
            )
        )
        adult_allowed = age >= 18
    movies = await MovieRepository(session).list_popular(limit=limit, include_adult=adult_allowed)
    return [_to_response(movie) for movie in movies]


@router.get("/{movie_id}", response_model=MovieResponse)
async def get_movie(
    movie_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MovieResponse:
    movie = await MovieRepository(session).get_by_id(movie_id)
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    return _to_response(movie)


@router.post("/sync-popular")
async def sync_popular(
    pages: int = Query(default=3, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    provider = TMDBProvider()
    try:
        count = await MovieService(MovieRepository(session), provider).sync_popular(pages=pages)
        await session.commit()
        return {"synced": count}
    finally:
        await provider.close()
