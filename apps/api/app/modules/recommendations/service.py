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
    ) -> list[Movie]:
        scores = await self.repository.genre_preference_scores(session_id=session_id, user_ids=user_ids)
        preferred = [genre_id for genre_id, _score in sorted(scores.items(), key=lambda x: x[1], reverse=True)]
        exploit_count = max(1, round(limit * (1.0 - exploration_ratio)))
        explore_count = max(0, limit - exploit_count)
        preferred_movies = await self.repository.list_candidates(
            exclude=exclude_movie_ids,
            preferred_genre_ids=preferred,
            limit=exploit_count,
        )
        all_candidates = await self.repository.list_popular(limit=max(limit * 4, 40))
        pool = [m for m in all_candidates if m.id not in exclude_movie_ids and m.id not in {x.id for x in preferred_movies}]
        random.shuffle(pool)
        return (preferred_movies + pool[:explore_count])[:limit]
