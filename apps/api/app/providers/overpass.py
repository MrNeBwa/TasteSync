from __future__ import annotations

import asyncio
import re
from typing import Any

import httpx

from app.models.place import PlaceCategory
from app.providers.base import ProviderPlace, PlacesProvider

# Curated OpenStreetMap tag sets per search category.
_RESTAURANT_TAGS: dict[str, set[str]] = {
    "amenity": {
        "restaurant",
        "fast_food",
        "cafe",
        "bar",
        "pub",
        "food_court",
        "ice_cream",
    },
}
_ENTERTAINMENT_TAGS: dict[str, set[str]] = {
    "amenity": {"nightclub", "casino", "arts_centre", "cinema", "theatre", "planetarium"},
    "leisure": {
        "cinema",
        "theatre",
        "nightclub",
        "bowling_alley",
        "escape_game",
        "amusement_arcade",
        "sports_centre",
        "swimming_pool",
        "dance",
    },
    "tourism": {"museum", "attraction", "theme_park", "aquarium", "zoo", "gallery"},
}

_CATEGORY_TAGS: dict[str, dict[str, set[str]]] = {
    PlaceCategory.RESTAURANT.value: _RESTAURANT_TAGS,
    PlaceCategory.ENTERTAINMENT.value: _ENTERTAINMENT_TAGS,
}

_WHITELISTED_EXTRAS = re.compile(r"^[A-Za-z0-9_./\-,: ]*$")


class OverpassProvider(PlacesProvider):
    """Keyless places search on top of the public OpenStreetMap Overpass API."""

    ENDPOINT = "https://overpass-api.de/api/interpreter"

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0),
            headers={"User-Agent": "movie-match/1.0"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    @staticmethod
    def _regex(tags: set[str]) -> str:
        return "^(" + "|".join(sorted(tags)) + ")$"

    @staticmethod
    def _build_query(*, category: str, latitude: float, longitude: float, radius: int, limit: int) -> str:
        tag_groups = _CATEGORY_TAGS[category]
        clauses: list[str] = []
        for key, values in tag_groups.items():
            clauses.append(f'nwr["{key}"~"{OverpassProvider._regex(values)}"](around:{radius},{latitude},{longitude});')
        body = "".join(clauses)
        return (
            "[out:json][timeout:25];("
            + body
            + ");out center tags "
            + str(max(50, min(limit, 250)))
            + ";"
        )

    async def _request(self, query: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = await self._client.post(
                    self.ENDPOINT,
                    data={"data": query},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if response.status_code not in {429, 500, 502, 503, 504}:
                    response.raise_for_status()
                    return response.json()
                response.raise_for_status()
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(0.6 * (2**attempt))
        assert last_error is not None
        raise last_error

    @staticmethod
    def _clean(value: str | None, *, max_len: int = 500) -> str | None:
        if not value:
            return None
        value = value.strip().replace("\n", " ").replace("\r", " ")
        value = re.sub(r"\s{2,}", " ", value)
        if not value or len(value) > max_len:
            return None
        return value

    @staticmethod
    def _first_tag(tags: dict[str, str], *keys: str) -> str | None:
        for key in keys:
            if tags.get(key):
                return tags[key].strip()
        return None

    @staticmethod
    def _build_address(tags: dict[str, str]) -> str | None:
        parts = [
            tags.get("addr:house_number"),
            tags.get("addr:street"),
        ]
        city = tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village")
        joined = ", ".join(part for part in parts if part)
        if city and city.lower() not in joined.lower():
            joined = f"{joined}, {city}" if joined else city
        return OverpassProvider._clean(joined) or None

    @staticmethod
    def _map_element(element: dict[str, Any]) -> ProviderPlace | None:
        tags = element.get("tags")
        if not isinstance(tags, dict):
            return None
        name = OverpassProvider._clean(tags.get("name"), max_len=300)
        if not name:
            return None

        if element.get("lat") is not None:
            lat = float(element["lat"])
            lon = float(element["lon"])
        else:
            center = element.get("center")
            if not isinstance(center, dict) or center.get("lat") is None:
                return None
            lat = float(center["lat"])
            lon = float(center["lon"])

        category = (
            PlaceCategory.RESTAURANT.value
            if tags.get("amenity") in _RESTAURANT_TAGS["amenity"]
            else PlaceCategory.ENTERTAINMENT.value
        )

        extra_tags: list[str] = []
        if category == PlaceCategory.RESTAURANT.value:
            if tags.get("cuisine"):
                extra_tags = [t.strip() for t in tags["cuisine"].split(";") if t.strip()]
        else:
            kind = OverpassProvider._first_tag(tags, "leisure", "tourism", "amenity") or tags.get("sport")
            if kind:
                extra_tags = [kind.replace("_", " ").title()]
        extra_tags = [t for t in extra_tags if _WHITELISTED_EXTRAS.match(t) and len(t) <= 40][:4]

        rating: float | None = None
        raw_rating = OverpassProvider._first_tag(tags, "rating", "stars", "stars:michelin")
        if raw_rating:
            try:
                parsed = float(raw_rating.replace(",", "."))
                if 0 <= parsed <= 10:
                    rating = round(parsed, 1)
            except ValueError:
                rating = None

        website = OverpassProvider._clean(
            OverpassProvider._first_tag(tags, "website", "contact:website", "contact:web", "url"),
            max_len=1000,
        )
        phone = OverpassProvider._clean(
            OverpassProvider._first_tag(tags, "phone", "contact:phone", "contact:mobile"),
            max_len=60,
        )
        opening_hours = OverpassProvider._clean(
            OverpassProvider._first_tag(tags, "opening_hours", "opening_hours:covid19"),
            max_len=1000,
        )
        price_level = OverpassProvider._clean(tags.get("price_range"), max_len=20)
        image_url = OverpassProvider._clean(
            OverpassProvider._first_tag(tags, "image", "image:0", "photo", "contact:pinterest"),
            max_len=1000,
        )

        return ProviderPlace(
            provider_id=f"{element.get('type', 'node')}/{element['id']}",
            name=name,
            category=category,
            address=OverpassProvider._build_address(tags),
            city=OverpassProvider._clean(tags.get("addr:city") or tags.get("addr:town"), max_len=160),
            latitude=lat,
            longitude=lon,
            image_url=image_url,
            rating=rating,
            price_level=price_level,
            tags=extra_tags,
            website=website,
            phone=phone,
            opening_hours=opening_hours,
        )

    async def search(
        self,
        *,
        category: str,
        latitude: float,
        longitude: float,
        radius: int,
        limit: int,
    ) -> list[ProviderPlace]:
        query = self._build_query(
            category=category,
            latitude=latitude,
            longitude=longitude,
            radius=radius,
            limit=limit,
        )
        payload = await self._request(query)
        places: list[ProviderPlace] = []
        seen: set[str] = set()
        for element in payload.get("elements", []):
            mapped = self._map_element(element)
            if mapped is None or mapped.provider_id in seen:
                continue
            seen.add(mapped.provider_id)
            places.append(mapped)
            if len(places) >= limit:
                break
        return places