import asyncio
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.api.rooms import room_detail_for
from app.db.session import AsyncSessionLocal, close_db
from app.models.room import RoomTask
from app.models.session import MovieSession, SessionStatus
from app.models.user import User
from app.repositories.room_repository import RoomRepository


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


def _make_user(session, *, tag: str) -> User:
    user = User(
        username=f"{tag}_{uuid4().hex[:8]}",
        email=f"{tag}@{uuid4().hex[:8]}.test",
        password_hash="x",
        birth_date=date(2000, 1, 1),
    )
    session.add(user)
    return user


def test_room_detail_exposes_live_session_id() -> None:
    """Lobby polling uses this id when SESSION_STARTED was missed."""

    async def run() -> None:
        async with AsyncSessionLocal() as session:
            repo = RoomRepository(session)
            owner = _make_user(session, tag="owner")
            await session.flush()
            room = await repo.create_room(name="Active Room", owner=owner, task=RoomTask.MOVIES)
            await session.flush()
            movie_session = MovieSession(
                id=uuid4(),
                room_id=room.id,
                status=SessionStatus.ACTIVE,
            )
            session.add(movie_session)
            await session.flush()
            try:
                loaded = await repo.get_by_id(room.id, with_members=True)
                assert loaded is not None
                detail = await room_detail_for(loaded, session)
                assert detail.active_session_id == movie_session.id

                movie_session.status = SessionStatus.FINISHED
                await session.flush()
                detail = await room_detail_for(loaded, session)
                assert detail.active_session_id is None
            finally:
                await session.rollback()
            await close_db()

    asyncio.run(run())
