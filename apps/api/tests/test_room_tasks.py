import asyncio
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import delete, text

from app.db.session import AsyncSessionLocal
from app.main import app
from app.models.room import Room, RoomStatus, RoomTask
from app.models.user import User
from app.modules.rooms.service import NotOwnerError, RoomNotFoundError, RoomService
from app.repositories.room_repository import RoomRepository


def _db_available() -> bool:
    async def probe() -> bool:
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

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


def test_room_task_update_endpoint_contract() -> None:
    schema = app.openapi()
    assert "patch" in schema["paths"]["/api/rooms/{room_id}/task"]


def test_update_task_persists_and_resets_ready() -> None:
    async def run() -> None:
        async with AsyncSessionLocal() as session:
            repo = RoomRepository(session)
            service = RoomService(repo)
            owner = _make_user(session, tag="owner")
            await session.flush()
            room = await repo.create_room(name="Task Room", owner=owner, task=RoomTask.MOVIES)
            await session.flush()
            room_id = room.id
            owner_id = owner.id
            try:
                membership = await repo.get_membership(room_id, owner_id)
                assert membership is not None
                membership.is_ready = True
                await session.flush()

                updated = await service.update_task(
                    room_id=room_id,
                    user_id=owner_id,
                    task=RoomTask.RESTAURANTS,
                )
                assert updated.task == RoomTask.RESTAURANTS
                assert updated.status == RoomStatus.WAITING
                assert all(member.is_ready is False for member in updated.members)
            finally:
                await session.rollback()
                await session.execute(delete(Room).where(Room.id == room_id))
                await session.execute(delete(User).where(User.id == owner_id))
                await session.commit()

    asyncio.run(run())


def test_update_task_rejects_non_owner() -> None:
    async def run() -> None:
        async with AsyncSessionLocal() as session:
            repo = RoomRepository(session)
            service = RoomService(repo)
            owner = _make_user(session, tag="ownr")
            guest = _make_user(session, tag="guest")
            await session.flush()
            room = await repo.create_room(name="Owner Room", owner=owner, task=RoomTask.MOVIES)
            await session.flush()
            room_id = room.id
            owner_id = owner.id
            guest_id = guest.id
            try:
                await repo.add_member(room=room, user=guest)
                await session.flush()
                with pytest.raises(NotOwnerError):
                    await service.update_task(
                        room_id=room_id,
                        user_id=guest_id,
                        task=RoomTask.ENTERTAINMENT,
                    )
            finally:
                await session.rollback()
                await session.execute(delete(Room).where(Room.id == room_id))
                await session.execute(delete(User).where(User.id == owner_id))
                await session.execute(delete(User).where(User.id == guest_id))
                await session.commit()

    asyncio.run(run())


def test_update_task_unknown_room() -> None:
    async def run() -> None:
        async with AsyncSessionLocal() as session:
            service = RoomService(RoomRepository(session))
            with pytest.raises(RoomNotFoundError):
                await service.update_task(
                    room_id=uuid4(),
                    user_id=uuid4(),
                    task=RoomTask.MOVIES,
                )

    asyncio.run(run())