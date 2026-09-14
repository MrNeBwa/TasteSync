from __future__ import annotations

import random
from uuid import UUID

from app.models.movie import Movie
from app.repositories.movie_repository import MovieRepository


class RecommendationService:
    def __init__(self, repository: MovieRepository) -> None:
        self.repository = repository

    async def next_movies(
        self,
        *,
        session_id: UUID,
        user_ids: list[UUID],
        exclude_movie_ids: set[UUID],
        limit: int = 10,
        exploration_ratio: float = 0.25,
        include_adult: bool = True,
    ) -> list[Movie]:
        scores = await self.repository.genre_preference_scores(
            session_id=session_id,
            user_ids=user_ids,
        )
        preferred = [
            genre_id
            for genre_id, _score in sorted(
                scores.items(), key=lambda x: x[1], reverse=True
            )
        ]
        exploit_count = min(limit, max(0, round(limit * (1.0 - exploration_ratio))))
        explore_count = limit - exploit_count

        preferred_movies = await self.repository.list_candidates(
            exclude=exclude_movie_ids,
            preferred_genre_ids=preferred,
            limit=exploit_count,
            include_adult=include_adult,
        )

        all_candidates = await self.repository.list_popular(
            limit=max(limit * 6, 60),
            include_adult=include_adult,
        )
        selected_ids = {movie.id for movie in preferred_movies}
        pool = [
            movie
            for movie in all_candidates
            if movie.id not in exclude_movie_ids and movie.id not in selected_ids
        ]
        random.shuffle(pool)

        result = preferred_movies + pool[:explore_count]
        if len(result) < limit:
            # Fallback to any remaining popular movies when the catalog is small.
            used = {movie.id for movie in result}
            result.extend(
                movie
                for movie in all_candidates
                if movie.id not in exclude_movie_ids and movie.id not in used
            )
        return result[:limit]
