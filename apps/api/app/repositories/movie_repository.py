from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.genre import Genre
from app.models.movie import Movie, MovieGenre
from app.models.vote import Vote, VoteValue


class MovieRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_provider_id(self, provider: str, provider_id: str) -> Movie | None:
        stmt = (
            select(Movie)
            .where(Movie.provider == provider, Movie.provider_id == provider_id)
            .options(selectinload(Movie.genres).selectinload(MovieGenre.genre))
        )
        return await self.session.scalar(stmt)

    async def get_genre(self, provider: str, provider_id: str, name: str) -> Genre:
        stmt = select(Genre).where(Genre.provider == provider, Genre.provider_id == provider_id)
        genre = await self.session.scalar(stmt)
        if genre is None:
            genre = Genre(provider=provider, provider_id=provider_id, name=name)
            self.session.add(genre)
            await self.session.flush()
        elif genre.name != name:
            genre.name = name
        return genre

    async def upsert_movie(
        self,
        *,
        provider: str,
        provider_id: str,
        title: str,
        overview: str | None,
        release_date: date | None,
        poster_url: str | None,
        backdrop_url: str | None,
        popularity: float | None,
        vote_average: float | None,
        vote_count: int | None,
        is_adult: bool,
        primary_trailer_url: str | None,
        genres: list[tuple[str, str]],
    ) -> Movie:
        movie = await self.get_by_provider_id(provider, provider_id)
        if movie is None:
            movie = Movie(provider=provider, provider_id=provider_id, title=title)
            self.session.add(movie)
            await self.session.flush()
        movie.title = title
        movie.overview = overview
        movie.release_date = release_date
        movie.poster_url = poster_url
        movie.backdrop_url = backdrop_url
        movie.popularity = popularity
        movie.vote_average = vote_average
        movie.vote_count = vote_count
        movie.is_adult = is_adult
        movie.primary_trailer_url = primary_trailer_url
        await self.session.execute(delete(MovieGenre).where(MovieGenre.movie_id == movie.id))
        for genre_provider_id, genre_name in genres:
            genre = await self.get_genre(provider, genre_provider_id, genre_name)
            self.session.add(MovieGenre(movie_id=movie.id, genre_id=genre.id))
        await self.session.flush()
        return movie

    async def get_by_id(self, movie_id: UUID) -> Movie | None:
        stmt = (
            select(Movie)
            .where(Movie.id == movie_id)
            .options(selectinload(Movie.genres).selectinload(MovieGenre.genre))
        )
        return await self.session.scalar(stmt)

    async def list_popular(self, *, limit: int = 30, include_adult: bool = True) -> list[Movie]:
        stmt = select(Movie).options(selectinload(Movie.genres).selectinload(MovieGenre.genre))
        if not include_adult:
            stmt = stmt.where(Movie.is_adult.is_(False))
        stmt = stmt.order_by(Movie.popularity.desc().nullslast()).limit(limit)
        return list(await self.session.scalars(stmt))

    async def get_by_ids(self, movie_ids: set[UUID]) -> list[Movie]:
        if not movie_ids:
            return []
        stmt = (
            select(Movie)
            .options(selectinload(Movie.genres).selectinload(MovieGenre.genre))
            .where(Movie.id.in_(movie_ids))
        )
        return list(await self.session.scalars(stmt))

    async def list_candidates(
        self,
        *,
        exclude: set[UUID],
        preferred_genre_ids: list[UUID],
        limit: int,
        include_adult: bool = True,
    ) -> list[Movie]:
        conditions = [Movie.id.not_in(exclude)]
        if not include_adult:
            conditions.append(Movie.is_adult.is_(False))
        stmt = (
            select(Movie)
            .options(selectinload(Movie.genres).selectinload(MovieGenre.genre))
            .where(*conditions)
        )
        movies = list(
            await self.session.scalars(
                stmt.order_by(Movie.popularity.desc().nullslast()).limit(max(limit * 5, 50))
            )
        )
        preferred = set(preferred_genre_ids)
        movies.sort(
            key=lambda m: (
                sum(1 for g in m.genres if g.genre_id in preferred),
                m.popularity or 0.0,
            ),
            reverse=True,
        )
        return movies[:limit]

    async def genre_preference_scores(
        self, *, session_id: UUID, user_ids: list[UUID]
    ) -> dict[UUID, int]:
        stmt = (
            select(MovieGenre.genre_id)
            .join(Vote, Vote.movie_id == MovieGenre.movie_id)
            .where(
                Vote.session_id == session_id,
                Vote.user_id.in_(user_ids),
                Vote.value == VoteValue.LIKE,
            )
        )
        rows = await self.session.scalars(stmt)
        scores: dict[UUID, int] = {}
        for gid in rows:
            scores[gid] = scores.get(gid, 0) + 1
        return scores
