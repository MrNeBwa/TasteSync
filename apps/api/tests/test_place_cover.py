"""Tests for generated place cover art and its delivery.

Regression guard for the "most places render with nothing to show" problem:
OpenStreetMap supplies an ``image`` tag on almost nothing, so the client was
falling back to a bare icon for every venue in the feed.
"""

import asyncio
import xml.etree.ElementTree as ET
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import AsyncSessionLocal, close_db
from app.main import app
from app.modules.places.cover import (
    _PALETTES,
    _PATTERNS,
    _Seed,
    place_cover_svg,
)


def test_cover_is_well_formed_svg() -> None:
    svg = place_cover_svg("11111111-1111-1111-1111-111111111111", "Кинотеатр Прага")
    root = ET.fromstring(svg)  # raises on malformed markup
    assert root.tag.endswith("svg")
    assert root.get("viewBox") == "0 0 800 450"


def test_cover_survives_names_with_markup_characters() -> None:
    # The name is interpolated into the aria-label straight from OpenStreetMap,
    # where "Fish & Chips" is an ordinary value. Unescaped it produces XML that
    # no parser accepts, so the cover silently fails to render at all.
    for name in [
        'Fish & Chips',
        'Cafe "Пушкин"',
        "O'Neill's <Bar & Grill>",
        "Bob's & Sue's",
    ]:
        svg = place_cover_svg("22222222-2222-2222-2222-222222222222", name)
        root = ET.fromstring(svg)  # raises on malformed markup
        assert root.get("aria-label") == f"Cover for {name}"


def test_cover_is_stable_across_processes() -> None:
    # Python's hash() is salted per interpreter run, which would reshuffle every
    # place's artwork on each API restart. A digest must be used instead.
    first = place_cover_svg("abc", "Кафе Пушкин")
    assert first == place_cover_svg("abc", "Кафе Пушкин")
    assert first != place_cover_svg("abd", "Кафе Пушкин")
    assert first != place_cover_svg("abc", "Кафе Пушкинъ")


def test_covers_differ_across_a_feed() -> None:
    # A batch of eight that looks identical reads as broken, not as a design.
    names = [f"Место {i}" for i in range(8)]
    arts = {place_cover_svg(f"id-{i}", n) for i, n in enumerate(names)}
    assert len(arts) == len(names)


def test_every_pattern_and_palette_is_reachable() -> None:
    patterns: set[str] = set()
    palettes: set[tuple[str, str]] = set()
    for i in range(500):
        seed = _Seed.for_place(f"id-{i}", f"place {i}")
        patterns.add(_PATTERNS[(seed.value >> 8) % len(_PATTERNS)].__name__)
        palettes.add(_PALETTES[seed.value % len(_PALETTES)])
    assert len(patterns) == len(_PATTERNS)
    assert len(palettes) == len(_PALETTES)


def test_cover_draws_no_text() -> None:
    # The name is rendered in the DOM above the image. SVG text loaded as a
    # background image falls back to an arbitrary system font and would clash.
    assert "<text" not in place_cover_svg("abc", "Кафе Пушкин")


def test_cover_stays_small() -> None:
    # These load as CSS background images, so an unbounded generator would show up
    # as a slow first card.
    sizes = [len(place_cover_svg(f"id-{i}", f"place {i}")) for i in range(200)]
    assert max(sizes) < 40_000
    assert sum(sizes) / len(sizes) < 10_000


def _db_available() -> bool:
    async def probe() -> bool:
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception:
            return False
        finally:
            await close_db()

    return asyncio.run(probe())


needs_db = pytest.mark.skipif(not _db_available(), reason="PostgreSQL is not available")


def _any_place_id() -> UUID | None:
    async def fetch() -> UUID | None:
        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(text("SELECT id FROM places LIMIT 1"))
                return result.scalar_one_or_none()
        except Exception:
            return None
        finally:
            await close_db()

    return asyncio.run(fetch())


@needs_db
def test_cover_endpoint_is_public_and_revalidates() -> None:
    place_id = _any_place_id()
    assert place_id is not None, "expected at least one seeded place"
    # The context manager runs the app lifespan, which is how the rest of the
    # suite gives the engine its connections and disposes them again. A bare
    # TestClient() skips that and leaves a connection bound to a closed loop.
    with TestClient(app) as client:
        # No Authorization header anywhere here: the endpoint is public because
        # an <img> tag cannot send a bearer token.
        first = client.get(f"/api/places/{place_id}/cover.svg")
        assert first.status_code == 200
        assert first.headers["content-type"].startswith("image/svg+xml")
        assert "ETag" in first.headers
        ET.fromstring(first.text)  # the served body is still valid markup

        # Starlette does not do conditional handling for a plain Response, so the
        # handler has to answer 304 itself or every cached visit re-downloads.
        etag = first.headers["ETag"]
        second = client.get(
            f"/api/places/{place_id}/cover.svg", headers={"If-None-Match": etag}
        )
        assert second.status_code == 304
        assert second.content == b""

        assert client.get(f"/api/places/{uuid4()}/cover.svg").status_code == 404


@needs_db
def test_place_response_always_exposes_a_cover_url() -> None:
    place_id = _any_place_id()
    assert place_id is not None

    async def fetch() -> dict:
        from app.api.places import place_response
        from app.repositories.place_repository import PlaceRepository

        try:
            async with AsyncSessionLocal() as session:
                place = await PlaceRepository(session).get_by_id(place_id)
                assert place is not None
                return place_response(place).model_dump()
        finally:
            await close_db()

    payload = asyncio.run(fetch())
    # Seeded venues carry no OSM image tag, so image_url is None and only
    # cover_url guarantees the client has something to render.
    assert payload["cover_url"] == f"/api/places/{place_id}/cover.svg"
    assert payload["cover_url"].startswith("/api/")
