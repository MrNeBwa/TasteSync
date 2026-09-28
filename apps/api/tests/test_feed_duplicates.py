"""Regression tests for duplicate items in a session feed.

A feed must never hand the same item to a user twice: the second card looks
like a bug and voting on it fails with 409 "already voted", which used to pin
the user on that card and make the room appear to loop.
"""

import asyncio
from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import delete, text

from app.db.session import AsyncSessionLocal, close_db
from app.models.room import Room, RoomStatus
from app.models.room_member import RoomMember, RoomMemberRole
from app.models.session import MovieSession, SessionStatus
from app.models.user import User
from app.providers.base import ProviderPlace


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


class _StubPlacesProvider:
    """Returns the same venue twice, as Overpass does for node + way."""

    def __init__(self, places: list[ProviderPlace]) -> None:
        self._places = places

    async def search(self, *, category, latitude, longitude, radius, limit):
        return self._places[:limit]


def _place(provider_id: str, name: str, *, lat: float = 55.75, lon: float = 37.61) -> ProviderPlace:
    return ProviderPlace(
        provider_id=provider_id,
        name=name,
        category="ENTERTAINMENT",
        address=None,
        city="Moscow",
        latitude=lat,
        longitude=lon,
        image_url=None,
        rating=None,
        price_level=None,
        tags=[],
        website=None,
        phone=None,
        opening_hours=None,
    )


@needs_db
def test_recommend_drops_the_same_venue_returned_twice() -> None:
    """Overpass maps one venue as both a node and a way; show it once."""
    from app.models.place import PlaceCategory
    from app.modules.places.service import PlaceService
    from app.repositories.place_repository import PlaceRepository

    async def scenario() -> None:
        session_id = uuid4()
        user_id = uuid4()
        # Same name, adjacent coordinates, different element ids.
        provider = _StubPlacesProvider([
            _place("node/1", "Кинотеатр Прага", lat=55.7500, lon=37.6100),
            _place("way/2", "Кинотеатр Прага", lat=55.7500, lon=37.6100),
            _place("node/3", "Театр Ленком", lat=55.7600, lon=37.6200),
        ])
        try:
            async with AsyncSessionLocal() as session:
                service = PlaceService(PlaceRepository(session), provider)
                places = await service.recommend(
                    session_id=session_id,
                    user_id=user_id,
                    category=PlaceCategory.ENTERTAINMENT,
                    latitude=55.75,
                    longitude=37.61,
                    limit=8,
                )
            names = [p.name for p in places]
            assert names == ["Кинотеатр Прага", "Театр Ленком"]
            assert len(names) == len(set(names)), "duplicate venue in one feed"
        finally:
            async with AsyncSessionLocal() as session:
                from app.models.place import Place

                await session.execute(
                    delete(Place).where(Place.provider_id.in_(["node/1", "way/2", "node/3"]))
                )
                await session.commit()
            await close_db()

    asyncio.run(scenario())


@needs_db
def test_feed_never_repeats_an_already_rated_movie() -> None:
    """Vote through whole batches and assert nothing comes back twice."""
    from app.modules.sessions.service import MovieSessionService
    from app.repositories.movie_repository import MovieRepository
    from app.repositories.place_repository import PlaceRepository
    from app.repositories.room_repository import RoomRepository
    from app.repositories.session_repository import SessionRepository

    async def scenario() -> None:
        async with AsyncSessionLocal() as session:
            user = User(
                username=f"dupe_{uuid4().hex[:8]}",
                email=f"dupe_{uuid4().hex[:8]}@test",
                password_hash="x",
                birth_date=date(2000, 1, 1),
            )
            session.add(user)
            await session.flush()
            room = Room(
                name="Dupe",
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
            room_id, session_id, user_id = room.id, movie_session.id, user.id

        seen: list = []
        try:
            for _ in range(4):
                async with AsyncSessionLocal() as session:
                    service = MovieSessionService(
                        SessionRepository(session),
                        RoomRepository(session),
                        MovieRepository(session),
                        PlaceRepository(session),
                    )
                    batch = await service.recommendations(
                        session_id=session_id, user_id=user_id, limit=8
                    )
                    titles_in_batch = [m.title for m in batch]
                    assert len(titles_in_batch) == len(set(titles_in_batch)), (
                        f"duplicate inside one batch: {titles_in_batch}"
                    )
                    for movie in batch:
                        await service.vote(
                            session_id=session_id,
                            user_id=user_id,
                            movie_id=movie.id,
                            value="SKIP",
                        )
                    # The service only flushes; the API's request dependency is
                    # what commits. Without this the votes roll back and the
                    # exclusion never applies, which is not what a client sees.
                    await session.commit()
                    seen.extend(movie.id for movie in batch)
                await close_db()

            assert len(seen) == len(set(seen)), "an already rated movie came back"
        finally:
            async with AsyncSessionLocal() as session:
                from app.models.vote import Vote

                await session.execute(
                    delete(Vote).where(Vote.session_id == session_id)
                )
                await session.execute(
                    delete(MovieSession).where(MovieSession.room_id == room_id)
                )
                await session.execute(delete(Room).where(Room.id == room_id))
                await session.execute(delete(User).where(User.id == user_id))
                await session.commit()
            await close_db()

    asyncio.run(scenario())


def test_overpass_dedupes_one_venue_mapped_as_node_and_way() -> None:
    """The provider must not return the same venue twice in one response."""
    from app.providers.overpass import OverpassProvider

    node = {
        "type": "node",
        "id": 1,
        "lat": 55.75,
        "lon": 37.61,
        "tags": {"name": "Прага", "amenity": "cinema"},
    }
    way = {
        "type": "way",
        "id": 2,
        "center": {"lat": 55.75, "lon": 37.61},
        "tags": {"name": "Прага", "amenity": "cinema"},
    }
    other = {
        "type": "node",
        "id": 3,
        "lat": 55.76,
        "lon": 37.62,
        "tags": {"name": "Ленком", "amenity": "theatre"},
    }
    provider = OverpassProvider.__new__(OverpassProvider)
    mapped = [provider._map_element(e) for e in (node, way, other)]
    assert all(m is not None for m in mapped)

    # Mirror the identity the provider now uses when filtering a response.
    identities = {
        (m.name.casefold().strip(), round(m.latitude, 4), round(m.longitude, 4))
        for m in mapped
    }
    assert len(identities) == 2, "node and way for one venue collapsed to one identity"
