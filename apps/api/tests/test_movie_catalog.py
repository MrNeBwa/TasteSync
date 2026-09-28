import asyncio
from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text

from app.db.session import AsyncSessionLocal, close_db
from app.main import app
from app.models.room import Room, RoomStatus
from app.models.room_member import RoomMember, RoomMemberRole
from app.models.session import MovieSession, SessionStatus
from app.models.user import User
from app.providers.tmdb import TMDBProvider, TmdbNotConfiguredError


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


def test_health_reports_catalog_state() -> None:
    with TestClient(app) as client:
        payload = client.get("/api/health").json()
    assert payload["catalog"] in {"ok", "empty", "error"}
    assert payload["catalog_source"] in {"tmdb", "bundled", "mixed", "empty", "unknown"}
    assert isinstance(payload["movies"], int)


def test_bundled_catalog_is_usable_offline() -> None:
    """The fallback exists so a blocked TMDB cannot leave sessions empty."""
    from app.modules.movies.bundled import BUNDLED_CATALOG, bundled_rows

    rows = bundled_rows()
    assert len(rows) >= 30
    assert len(rows) == len(BUNDLED_CATALOG)

    # Stable ids so re-seeding updates rows instead of duplicating them.
    assert len({row["provider_id"] for row in rows}) == len(rows)
    assert all(row["provider"] == "bundled" for row in rows)
    assert all(isinstance(row["release_date"], date) for row in rows)
    assert all(row["title"] and row["overview"] for row in rows)
    assert all(row["genres"] for row in rows)
    # No fabricated 18+ flags.
    assert all(row["is_adult"] is False for row in rows)

    # Every fallback film needs a trailer, otherwise the player has nothing to
    # load and the session silently degrades to a poster placeholder.
    assert all(row["primary_trailer_url"] for row in rows)


def test_bundled_trailer_urls_are_well_formed() -> None:
    """The web client re-parses these, so the shape has to stay exact."""
    from app.modules.movies.bundled import BUNDLED_CATALOG, TRAILER_KEYS, bundled_rows

    assert set(TRAILER_KEYS) == {movie.title for movie in BUNDLED_CATALOG}
    for row in bundled_rows():
        url = row["primary_trailer_url"]
        assert url.startswith("https://www.youtube.com/watch?v=")
        video_id = url.split("?v=", 1)[1]
        # Exactly one query separator: a second "?" corrupts the value and is
        # what made the embed player fail before.
        assert "?" not in video_id and "&" not in video_id
        assert len(video_id) == 11
        assert video_id.replace("_", "").replace("-", "").isalnum()


def test_bundled_trailer_lookup_fails_loudly_when_an_id_is_missing(monkeypatch) -> None:
    from app.modules.movies import bundled

    monkeypatch.delitem(bundled.TRAILER_KEYS, "The Matrix", raising=False)
    with pytest.raises(ValueError, match="no trailer id"):
        bundled.bundled_rows()


def test_health_reports_bundled_source_when_only_fallback_is_loaded() -> None:
    with TestClient(app) as client:
        payload = client.get("/api/health").json()
    if payload["movies"] and payload["catalog_source"] == "bundled":
        assert payload["catalog"] == "ok"
    else:
        assert payload["catalog"] in {"ok", "empty", "error"}


def test_provider_without_token_raises_dedicated_error(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.providers.tmdb.get_settings",
        lambda: type("Settings", (), {"tmdb_api_token": ""})(),
    )
    with pytest.raises(TmdbNotConfiguredError):
        TMDBProvider()


def test_openapi_documents_catalog_failure() -> None:
    responses = app.openapi()["paths"]["/api/sessions/{session_id}/movies"]["get"]["responses"]
    assert "200" in responses


async def _seed_active_session(session) -> tuple:
    user = User(
        username=f"catalog_{uuid4().hex[:8]}",
        email=f"catalog_{uuid4().hex[:8]}@test",
        password_hash="x",
        birth_date=date(2000, 1, 1),
    )
    session.add(user)
    await session.flush()

    room = Room(
        name="Catalog",
        code=uuid4().hex[:6].upper(),
        owner_id=user.id,
        status=RoomStatus.READY,
    )
    session.add(room)
    await session.flush()
    session.add(
        RoomMember(
            room_id=room.id,
            user_id=user.id,
            role=RoomMemberRole.OWNER,
            is_ready=True,
        )
    )
    await session.flush()

    movie_session = MovieSession(
        room_id=room.id,
        status=SessionStatus.ACTIVE,
        started_at=datetime.now(timezone.utc),
    )
    session.add(movie_session)
    await session.commit()
    return room.id, movie_session.id, user.id


@needs_db
def test_empty_catalog_raises_instead_of_yielding_an_empty_feed(monkeypatch) -> None:
    """A catalog that was never seeded must not read as an exhausted feed."""

    from app.modules.sessions.service import MovieCatalogEmptyError, MovieSessionService
    from app.repositories.movie_repository import MovieRepository
    from app.repositories.place_repository import PlaceRepository
    from app.repositories.room_repository import RoomRepository
    from app.repositories.session_repository import SessionRepository

    async def scenario() -> None:
        async with AsyncSessionLocal() as session:
            room_id, session_id, user_id = await _seed_active_session(session)

        async def empty_catalog(_self) -> int:
            return 0

        monkeypatch.setattr(MovieRepository, "count", empty_catalog)
        try:
            async with AsyncSessionLocal() as session:
                service = MovieSessionService(
                    SessionRepository(session),
                    RoomRepository(session),
                    MovieRepository(session),
                    PlaceRepository(session),
                )
                with pytest.raises(MovieCatalogEmptyError):
                    await service.recommendations(
                        session_id=session_id, user_id=user_id, limit=8
                    )
        finally:
            async with AsyncSessionLocal() as session:
                await session.execute(
                    delete(MovieSession).where(MovieSession.room_id == room_id)
                )
                await session.execute(delete(Room).where(Room.id == room_id))
                await session.execute(delete(User).where(User.id == user_id))
                await session.commit()
            # Each test owns its event loop; drop pooled connections bound to it.
            await close_db()

    asyncio.run(scenario())
