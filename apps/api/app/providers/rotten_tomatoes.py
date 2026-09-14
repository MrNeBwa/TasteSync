"""Licensed Rotten Tomatoes integration boundary.

Do not implement direct site scraping here. Rotten Tomatoes/Fandango's current
Terms prohibit automated data extraction and data mining without express
written authorization. Once a licensed API/data feed is available, implement
it behind the same MovieProvider protocol used by TMDBProvider.
"""

from __future__ import annotations

from app.providers.base import MovieProvider, ProviderMovie


class RottenTomatoesLicensedProvider(MovieProvider):
    """Adapter placeholder for an authorized Rotten Tomatoes API/data feed."""

    async def get_popular_movies(self, *, page: int = 1) -> list[ProviderMovie]:
        raise RuntimeError(
            "Rotten Tomatoes integration requires an authorized API/data feed. "
            "Configure that feed before enabling this provider."
        )

    async def get_movie(self, provider_id: str) -> ProviderMovie:
        raise RuntimeError(
            "Rotten Tomatoes integration requires an authorized API/data feed."
        )
