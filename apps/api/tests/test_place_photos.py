from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.place import Place, PlaceCategory
from app.modules.places.photos import (
    PhotoClient,
    _matches_name,
    _normalize,
    _pick_commons_url,
)
from app.modules.places.schemas import to_place_response


def _place(name: str = "Бургер Кинг") -> Place:
    place = Place(
        provider="osm",
        provider_id="node/1",
        name=name,
        category=PlaceCategory.RESTAURANT,
        latitude=55.75,
        longitude=37.61,
    )
    # SQLAlchemy fills `id` only on flush; set it explicitly so the serializer
    # tests work on an unsaved row.
    place.id = uuid4()
    return place


def test_normalize_drops_punctuation_and_case() -> None:
    assert _normalize("Бургер Кинг — Москва!") == "бургер кинг москва"
    assert _normalize("Burger&King") == "burger king"


def test_matches_name_verbatim_full_name() -> None:
    assert _matches_name("Бургер Кинг — Москва, Тверская, фото", "Бургер Кинг")
    assert _matches_name("File:Burger King (7391045860).jpg", "Burger King")


def test_matches_name_multi_word_requires_all_words() -> None:
    assert _matches_name("Кинотеатр Прага, зал 3", "Кинотеатр Прага")
    assert not _matches_name("Кинотеатр Иллюзион", "Кинотеатр Прага")
    assert not _matches_name("Бургер Дом на Пятницкой", "Бургер Кинг")


def test_matches_name_single_word_needs_distinction() -> None:
    assert _matches_name("Шоколадница на Тверской", "Шоколадница")
    # Too short / too common to trust; the generated cover wins instead.
    assert not _matches_name("Сова на Никитской", "Сова")
    assert not _matches_name("Кафе Уют — интерьер", "Уют")


def test_pick_commons_url_skips_mismatched_pages() -> None:
    pages = {
        "1": {
            "title": "Бургер Дом в Ростове.jpg",
            "imageinfo": [{"thumburl": "https://x/a.jpg", "width": 900, "height": 600}],
        },
        "2": {
            "title": "Бургер Кинг, Казань.jpg",
            "imageinfo": [{"thumburl": "https://x/b.jpg", "width": 1200, "height": 800}],
        },
    }
    assert _pick_commons_url(pages, "Бургер Кинг") == "https://x/b.jpg"


def test_pick_commons_url_skips_tiny_images_and_missing_pages() -> None:
    pages = {
        "1": {"missing": ""},
        "2": {
            "title": "Бургер Кинг логотип.jpg",
            "imageinfo": [{"thumburl": "https://x/logo.jpg", "width": 220, "height": 220}],
        },
    }
    assert _pick_commons_url(pages, "Бургер Кинг") is None


async def test_enrich_places_sets_wikimedia_photo(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_wikimedia(self: PhotoClient, place: Place) -> str | None:
        return "https://commons/photo.jpg"

    monkeypatch.setattr(PhotoClient, "_wikimedia_photo", fake_wikimedia)
    client = PhotoClient(google_api_key="")
    try:
        plain = _place()
        with_osm_photo = _place("Другой")
        with_osm_photo.image_url = "https://osm/p.jpg"
        covered_by_google = _place("Третий")
        covered_by_google.google_photo_ref = "places/ab/photos/cd"

        await client.enrich_places([plain, with_osm_photo, covered_by_google])

        assert plain.image_url == "https://commons/photo.jpg"
        assert with_osm_photo.image_url == "https://osm/p.jpg"  # untouched
        assert covered_by_google.google_photo_ref is not None  # untouched
        assert covered_by_google.image_url is None
    finally:
        await client.close()


async def test_enrich_places_prefers_google_when_key_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_google(self: PhotoClient, place: Place) -> tuple[str, str] | None:
        return ("ChIJabc", "places/ChIJabc/photos/AU1")

    async def fake_wikimedia(self: PhotoClient, place: Place) -> str | None:
        return "https://commons/photo.jpg"

    monkeypatch.setattr(PhotoClient, "_google_photo", fake_google)
    monkeypatch.setattr(PhotoClient, "_wikimedia_photo", fake_wikimedia)

    client = PhotoClient(google_api_key="test-key")
    try:
        place = _place()
        await client.enrich_places([place])
        assert place.image_url is None
        assert place.google_place_id == "ChIJabc"
        assert place.google_photo_ref == "places/ChIJabc/photos/AU1"
    finally:
        await client.close()


async def test_enrich_places_swallows_network_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(self: PhotoClient, place: Place) -> str | None:
        raise RuntimeError("network down")

    monkeypatch.setattr(PhotoClient, "_wikimedia_photo", boom)
    client = PhotoClient(google_api_key="")
    try:
        place = _place()
        await client.enrich_places([place])  # must not raise
        assert place.image_url is None
    finally:
        await client.close()


def test_to_place_response_uses_google_proxy_path() -> None:
    place = _place()
    place.google_place_id = "ChIJx"
    place.google_photo_ref = "places/ChIJx/photos/AU1"
    response = to_place_response(place)
    assert response.image_url == f"/api/places/{place.id}/photo"
    assert response.cover_url.endswith(".svg")


def test_to_place_response_keeps_external_photo() -> None:
    place = _place()
    place.image_url = "https://commons/photo.jpg"
    place.google_photo_ref = "places/ChIJx/photos/AU1"
    response = to_place_response(place)
    assert response.image_url == "https://commons/photo.jpg"


def test_to_place_response_without_photo_has_cover_only() -> None:
    place = _place()
    response = to_place_response(place)
    assert response.image_url is None
    assert response.cover_url == f"/api/places/{place.id}/cover.svg"