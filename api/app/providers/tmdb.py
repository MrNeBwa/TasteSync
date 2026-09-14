from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.base import MovieProvider, ProviderGenre, ProviderMovie, ProviderVideo


class TMDBProvider(MovieProvider):
    BASE_URL = "https://api.themoviedb.org/3"
    IMAGE_BASE = "https://image.tmdb.org/t/p/w780"
    BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.tmdb_api_token:
            raise RuntimeError("TMDB_API_TOKEN is not configured")
        self._genre_cache: dict[int, str] | None = None
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=httpx.Timeout(15.0, connect=5.0),
            headers={"Authorization": f"Bearer {settings.tmdb_api_token}"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def _request(self, path: str, *, params: dict[str, object]) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = await self._client.get(path, params=params)
                if response.status_code not in {429, 500, 502, 503, 504}:
                    response.raise_for_status()
                    return response
                response.raise_for_status()
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
                last_error = exc
                if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
                    if exc.response.status_code not in {429, 500, 502, 503, 504}:
                        raise
                if attempt < 2:
                    await asyncio.sleep(0.5 * (2 ** attempt))
        assert last_error is not None
        raise last_error

    async def _genres(self) -> dict[int, str]:
        if self._genre_cache is not None:
            return self._genre_cache
        response = await self._request("/genre/movie/list", params={"language": "en-US"})
        self._genre_cache = {item["id"]: item["name"] for item in response.json().get("genres", [])}
        return self._genre_cache

    async def get_popular_movies(self, *, page: int = 1) -> list[ProviderMovie]:
        genre_map = await self._genres()
        response = await self._request(
            "/movie/popular",
            params={"language": "en-US", "page": page, "region": "US"},
        )
        return [
            await self._map_movie(item, genre_map, fetch_videos=True)
            for item in response.json().get("results", [])
        ]

    async def get_movie(self, provider_id: str) -> ProviderMovie:
        genre_map = await self._genres()
        response = await self._request(
            f"/movie/{provider_id}",
            params={"language": "en-US"},
        )
        return await self._map_movie(response.json(), genre_map, fetch_videos=True)

    async def _map_movie(
        self,
        item: dict[str, Any],
        genre_map: dict[int, str],
        *,
        fetch_videos: bool,
    ) -> ProviderMovie:
        videos: list[ProviderVideo] = []
        if fetch_videos:
            response = await self._request(
                f"/movie/{item['id']}/videos",
                params={"language": "en-US"},
            )
            for video in response.json().get("results", []):
                if video.get("site") == "YouTube" and video.get("type") == "Trailer":
                    videos.append(
                        ProviderVideo(
                            key=video["key"],
                            name=video.get("name", "Trailer"),
                            site=video["site"],
                            kind=video["type"],
                            official=bool(video.get("official", False)),
                        )
                    )

        genre_ids = item.get("genre_ids", [])
        if item.get("genres"):
            genre_ids = [g["id"] for g in item["genres"]]
            for g in item["genres"]:
                genre_map[g["id"]] = g["name"]

        return ProviderMovie(
            provider_id=str(item["id"]),
            title=item["title"],
            overview=item.get("overview"),
            release_date=item.get("release_date"),
            poster_url=f"{self.IMAGE_BASE}{item['poster_path']}" if item.get("poster_path") else None,
            backdrop_url=f"{self.BACKDROP_BASE}{item['backdrop_path']}" if item.get("backdrop_path") else None,
            popularity=item.get("popularity"),
            vote_average=item.get("vote_average"),
            vote_count=item.get("vote_count"),
            is_adult=bool(item.get("adult", False)),
            genres=[ProviderGenre(str(gid), genre_map[gid]) for gid in genre_ids if gid in genre_map],
            trailers=videos,
        )
