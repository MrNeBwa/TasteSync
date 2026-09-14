from __future__ import annotations

from datetime import date

from app.providers.base import MovieProvider, ProviderMovie
from app.repositories.movie_repository import MovieRepository


class MovieService:
    def __init__(self, repository: MovieRepository, provider: MovieProvider) -> None:
        self.repository = repository
        self.provider = provider

    async def sync_popular(self, *, pages: int = 3) -> int:
        count = 0
        for page in range(1, pages + 1):
            movies = await self.provider.get_popular_movies(page=page)
            for movie in movies:
                await self._upsert(movie)
                count += 1
        return count

    async def _upsert(self, movie: ProviderMovie):
        release_date = date.fromisoformat(movie.release_date) if movie.release_date else None
        trailer = next((v for v in movie.trailers if v.site == "YouTube"), None)
        trailer_url = f"https://www.youtube.com/watch?v={trailer.key}" if trailer else None
        return await self.repository.upsert_movie(
            provider="tmdb",
            provider_id=movie.provider_id,
            title=movie.title,
            overview=movie.overview,
            release_date=release_date,
            poster_url=movie.poster_url,
            backdrop_url=movie.backdrop_url,
            popularity=movie.popularity,
            vote_average=movie.vote_average,
            vote_count=movie.vote_count,
            primary_trailer_url=trailer_url,
            genres=[(g.provider_id, g.name) for g in movie.genres],
        )
