import asyncio
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, text

from app.db.session import AsyncSessionLocal, close_db
from app.main import app
from app.models.place import Place, PlaceCategory
from app.models.vote import VoteValue
from app.modules.sessions.schemas import VoteRequest
from app.providers.overpass import OverpassProvider
from app.repositories.place_repository import PlaceRepository


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


pytestmark = pytest.mark.skipif(not _db_available(), reason="PostgreSQL is not available")


def test_places_endpoints_exist_in_openapi() -> None:
    schema = app.openapi()
    assert "/api/sessions/{session_id}/places" in schema["paths"]
    assert "/api/places/{place_id}" in schema["paths"]


def test_vote_request_allows_place_target() -> None:
    schema = app.openapi()
    vote = schema["components"]["schemas"]["VoteRequest"]["properties"]
    assert "place_id" in vote
    assert "category" in vote


def test_vote_request_category_match_web_payload() -> None:
    from typing import cast

    payload = VoteRequest(
        place_id=UUID("00000000-0000-0000-0000-000000000001"),
        category=PlaceCategory.RESTAURANT,
        value=VoteValue.LIKE,
    )
    assert payload.category is PlaceCategory.RESTAURANT

    from pydantic import ValidationError

    try:
        VoteRequest(category=cast(PlaceCategory, "restaurants"), value=VoteValue.LIKE)
        raise AssertionError("lowercase category should be rejected")
    except ValidationError:
        pass

    try:
        VoteRequest(movie_id=None, place_id=None, value=VoteValue.LIKE)
        raise AssertionError("missing target should be rejected")
    except ValidationError:
        pass


def test_place_response_contract() -> None:
    schema = app.openapi()
    place = schema["components"]["schemas"]["PlaceResponse"]["properties"]
    assert place["category"]["$ref"].endswith("PlaceCategory")
    assert place["latitude"]["type"] == "number"
    assert place["tags"]["type"] == "array"


def test_overpass_maps_restaurant_node() -> None:
    element = {
        "type": "node",
        "id": 123,
        "lat": 55.7558,
        "lon": 37.6173,
        "tags": {
            "amenity": "restaurant",
            "name": "Тест Кафе",
            "cuisine": "italian",
            "addr:street": "Tverskaya",
            "addr:city": "Moscow",
            "website": "https://example.com",
            "phone": "+7 999 000-00-00",
        },
    }
    mapped = OverpassProvider._map_element(element)
    assert mapped is not None
    assert mapped.provider_id == "node/123"
    assert mapped.name == "Тест Кафе"
    assert mapped.category == "RESTAURANT"
    assert mapped.tags == ["italian"]
    assert mapped.address == "Tverskaya, Moscow"
    assert mapped.city == "Moscow"
    assert mapped.latitude == 55.7558


def test_overpass_maps_entertainment_way_via_center() -> None:
    element = {
        "type": "way",
        "id": 999,
        "center": {"lat": 55.1, "lon": 37.2},
        "tags": {"leisure": "cinema", "name": "Kino Park"},
        "nodes": [1, 2],
    }
    mapped = OverpassProvider._map_element(element)
    assert mapped is not None
    assert mapped.category == "ENTERTAINMENT"
    assert mapped.tags == ["Cinema"]
    assert mapped.latitude == 55.1
    assert mapped.longitude == 37.2


def test_overpass_skips_unnamed_elements() -> None:
    assert OverpassProvider._map_element({"type": "node", "id": 7, "lat": 1.0, "lon": 2.0, "tags": {"amenity": "restaurant"}}) is None


def test_overpass_build_query_targets_category() -> None:
    query = OverpassProvider._build_query(
        category="RESTAURANT",
        latitude=55.7558,
        longitude=37.6173,
        radius=6000,
        limit=8,
    )
    assert 'nwr["amenity"' in query
    assert "around:6000,55.7558,37.6173" in query
    assert "restaurant" in query
    assert "cinema" not in query


def test_restaurant_query_excludes_entertainment_key() -> None:
    query = OverpassProvider._build_query(
        category="ENTERTAINMENT",
        latitude=55.7558,
        longitude=37.6173,
        radius=15000,
        limit=8,
    )
    assert 'nwr["leisure"' in query
    assert "cinema" in query


def test_upsert_place_persists_not_null_fields() -> None:
    async def run() -> None:
        provider_id = f"test/{uuid4()}"
        async with AsyncSessionLocal() as session:
            repo = PlaceRepository(session)
            try:
                place = await repo.upsert_place(
                    provider="osm",
                    provider_id=provider_id,
                    name="Test Place",
                    category=PlaceCategory.RESTAURANT,
                    address=None,
                    city=None,
                    latitude=40.0,
                    longitude=40.0,
                    image_url=None,
                    rating=4.0,
                    price_level=None,
                    cuisine=None,
                    tags=[],
                    website=None,
                    phone=None,
                    opening_hours=None,
                )
                await session.flush()
                row = await session.get(Place, place.id)
                assert row is not None
                assert row.category == PlaceCategory.RESTAURANT
                assert row.latitude == 40.0
            finally:
                await session.rollback()
                await session.execute(delete(Place).where(Place.provider_id == provider_id))
                await session.commit()
            await close_db()

    asyncio.run(run())
