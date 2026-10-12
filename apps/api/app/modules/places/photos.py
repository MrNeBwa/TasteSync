"""Real photographs for places, keyed by OpenStreetMap rows.

OpenStreetMap carries an ``image`` tag on almost nothing (0 of the 48 venues
seeded for this project had one), so the app falls back to generated artwork.
This module fetches a real photo when one can be found, so food and venue
search has something to look at:

1. Wikimedia Commons — free, no key. A search by place name + city, and a
   result is accepted only when its file title actually contains the place's
   name. The name check is what protects against the "same-named venue in a
   different city" trap that plain search is notorious for.
2. Google Places API (New) — optional ``GOOGLE_PLACES_API_KEY``. The most
   reliable source: photos belong to that exact Google listing, matched by
   name + a location bias. The photo itself is streamed through the API's own
   proxy endpoint (``/api/places/{id}/photo``) so the key never reaches the
   browser.

Both are best-effort. Any failure leaves a place untouched and the client
falls back to the generated cover, exactly as before.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.place import Place, PlaceCategory

_PHOTO_USER_AGENT = "movie-match/1.0"

WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php"
GOOGLE_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText"
GOOGLE_PHOTOS_BASE = "https://places.googleapis.com/v1/"

# searchText returns whichever fields the mask admits.
_GOOGLE_FIELD_MASK = "places.id,places.displayName,places.photos,places.types"


def _normalize(value: str) -> str:
    """Lowercase and keep only letters/digits, for comparison."""
    return re.sub(r"[^a-zа-яё0-9]+", " ", value.casefold()).strip()


def _matches_name(file_title: str, place_name: str) -> bool:
    """Best-effort guard against a Commons hit for a same-named venue in
    another city or a lookalike product.

    A file is accepted only when its title unambiguously points at the place:
    the full name verbatim, or, for multi-word names, every significant word
    present. A single-word venue is accepted only when the word is long enough
    to be distinctive (6+ letters); "Сова" is too common, "Шоколадница" is not.
    """
    title = _normalize(file_title)
    name = _normalize(place_name)
    if not title or not name:
        return False
    words = [word for word in name.split() if len(word) >= 4]
    if not words:
        return False
    # A multi-word name appearing verbatim is the strongest signal
    # (e.g. "бургер кинг" present in "бургер кинг москва тверская").
    if len(name.split()) >= 2 and name in title:
        return True
    if len(words) == 1:
        return len(words[0]) >= 6 and words[0] in title
    return all(word in title for word in words[:3])


def _pick_commons_url(pages: dict[str, Any], place_name: str) -> str | None:
    """Pick the first Commons file whose title matches the place."""
    for page in pages.values():
        if not isinstance(page, dict) or page.get("missing") or not page.get("title"):
            continue
        if not _matches_name(page["title"], place_name):
            continue
        info = page.get("imageinfo") or []
        if not info:
            continue
        # Skip icons and logos (tiny images) — they pass the name check but
        # are not what a venue card should show.
        if (info[0].get("width") or 0) < 400:
            continue
        url = info[0].get("thumburl") or info[0].get("url")
        if url:
            # imageinfo's thumburl carries UTM campaign params; drop them so the
            # stored URL is stable and the CDN/cache key stays clean.
            return url.split("?", 1)[0]
    return None


class PhotoClient:
    """Fetches real photos for places, Wikimedia then optional Google.

    The client is created per request (like ``OverpassProvider``) and closed in
    a ``finally``. It never raises from enrichment: photos are decoration and
    a network hiccup must not cost the user a feed.
    """

    def __init__(self, *, google_api_key: str | None = None, timeout: float = 8.0) -> None:
        settings = get_settings()
        self._google_api_key = (
            google_api_key if google_api_key is not None else settings.google_places_api_key
        )
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=4.0),
            headers={"User-Agent": _PHOTO_USER_AGENT},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def enrich_places(self, places: list[Place]) -> None:
        """Fill in real photos for places that do not have one yet."""
        targets = [place for place in places if not place.image_url and not place.google_photo_ref]
        if not targets:
            return
        await asyncio.gather(
            *(self._enrich_one(place) for place in targets),
            return_exceptions=True,
        )

    async def _enrich_one(self, place: Place) -> None:
        try:
            if self._google_api_key:
                reference = await self._google_photo(place)
                if reference is not None:
                    place.google_place_id, place.google_photo_ref = reference
                    return
            photo = await self._wikimedia_photo(place)
            if photo:
                place.image_url = photo
        except Exception:
            # Photos are strictly best-effort: the generated cover still works.
            pass

    async def _wikimedia_photo(self, place: Place) -> str | None:
        query = " ".join(part for part in (place.name, place.city) if part)
        response = await self._client.get(
            WIKIMEDIA_API,
            params={
                "action": "query",
                "format": "json",
                "generator": "search",
                "gsrnamespace": "6",  # File: namespace
                "gsrlimit": "15",
                "gsrsearch": f"filetype:bitmap {query}",
                "prop": "imageinfo",
                "iiprop": "url|size",
                "iiurlwidth": "900",
            },
        )
        if response.status_code >= 400:
            return None
        data = response.json()
        pages = (data.get("query") or {}).get("pages") or {}
        return _pick_commons_url(pages, place.name)

    async def _google_photo(self, place: Place) -> tuple[str, str] | None:
        """Return ``(google_place_id, photo_name)`` for a place listing."""
        payload: dict[str, Any] = {
            "textQuery": " ".join(part for part in (place.name, place.city) if part),
            "pageSize": 5,
            "languageCode": "ru",
            "locationBias": {
                "circle": {
                    "center": {
                        "latitude": place.latitude,
                        "longitude": place.longitude,
                    },
                    "radius": 4000.0,
                }
            },
        }
        if place.category == PlaceCategory.RESTAURANT:
            payload["includedType"] = "restaurant"
        response = await self._client.post(
            GOOGLE_TEXT_SEARCH,
            json=payload,
            headers={
                "X-Goog-Api-Key": self._google_api_key or "",
                "X-Goog-FieldMask": _GOOGLE_FIELD_MASK,
                "Content-Type": "application/json",
            },
        )
        if response.status_code >= 400:
            return None
        results = response.json().get("places") or []
        if not results:
            return None

        expected = _normalize(place.name)
        chosen = None
        for result in results:
            display = (result.get("displayName") or {}).get("text", "")
            if _normalize(display) == expected:
                chosen = result
                break
        if chosen is None:
            chosen = results[0]

        photos = chosen.get("photos") or []
        photo_name = photos[0].get("name") if photos else None
        place_id = chosen.get("id")
        if not photo_name or not place_id:
            return None
        return str(place_id), str(photo_name)