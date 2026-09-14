from secrets import choice
from string import ascii_uppercase, digits
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.room import Room
from app.models.room_member import RoomMember, RoomMemberRole
from app.models.user import User


class RoomRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user(self, user_id: UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_id(self, room_id: UUID, *, with_members: bool = False) -> Room | None:
        stmt = select(Room).where(Room.id == room_id)
        if with_members:
            stmt = stmt.options(
                selectinload(Room.members).selectinload(RoomMember.user),
            )
        return await self.session.scalar(stmt)

    async def get_by_code(self, code: str, *, with_members: bool = False) -> Room | None:
        stmt = select(Room).where(Room.code == code)
        if with_members:
            stmt = stmt.options(
                selectinload(Room.members).selectinload(RoomMember.user),
            )
        return await self.session.scalar(stmt)

    async def code_exists(self, code: str) -> bool:
        result = await self.session.scalar(select(Room.id).where(Room.code == code))
        return result is not None

    async def get_membership(self, room_id: UUID, user_id: UUID) -> RoomMember | None:
        stmt = select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == user_id,
        )
        return await self.session.scalar(stmt)

    async def list_members(self, room_id: UUID) -> list[RoomMember]:
        stmt = (
            select(RoomMember)
            .where(RoomMember.room_id == room_id)
            .options(selectinload(RoomMember.user))
            .order_by(RoomMember.joined_at.asc())
        )
        result = await self.session.scalars(stmt)
        return list(result)

    async def create_room(self, *, name: str, owner: User) -> Room:
        for _ in range(10):
            code = "".join(choice(ascii_uppercase + digits) for _ in range(6))
            if not await self.code_exists(code):
                break
        else:
            raise RuntimeError("Could not generate a unique room code")

        room = Room(name=name, code=code, owner_id=owner.id)
        room.members.append(
            RoomMember(user_id=owner.id, role=RoomMemberRole.OWNER, is_ready=False)
        )
        self.session.add(room)
        await self.session.flush()
        return room

    async def add_member(self, *, room: Room, user: User) -> RoomMember:
        member = RoomMember(room_id=room.id, user_id=user.id, role=RoomMemberRole.MEMBER)
        self.session.add(member)
        await self.session.flush()
        return member

    async def remove_member(self, membership: RoomMember) -> None:
        await self.session.delete(membership)
        await self.session.flush()
