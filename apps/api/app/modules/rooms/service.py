from uuid import UUID

from app.models.room import Room, RoomStatus, RoomTask
from app.repositories.room_repository import RoomRepository


class UserNotFoundError(Exception):
    pass


class RoomNotFoundError(Exception):
    pass


class AlreadyMemberError(Exception):
    pass


class CannotLeaveRoomError(Exception):
    pass


class NotMemberError(Exception):
    pass


class NotOwnerError(Exception):
    pass


class InvalidRoomStateError(Exception):
    pass


class RoomService:
    def __init__(self, repository: RoomRepository) -> None:
        self.repository = repository

    async def create_room(self, *, name: str, owner_id: UUID, task: RoomTask = RoomTask.MOVIES) -> Room:
        owner = await self.repository.get_user(owner_id)
        if owner is None:
            raise UserNotFoundError(owner_id)
        normalized_name = name.strip()
        if not normalized_name:
            raise ValueError("Room name cannot be empty")
        return await self.repository.create_room(name=normalized_name, owner=owner, task=task)

    async def join_room(self, *, code: str, user_id: UUID) -> Room:
        room = await self.repository.get_by_code(code.strip().upper(), for_update=True)
        if room is None:
            raise RoomNotFoundError
        if room.status not in {RoomStatus.WAITING, RoomStatus.READY}:
            raise InvalidRoomStateError("Room is no longer accepting members")
        membership = await self.repository.get_membership(room.id, user_id)
        if membership is not None:
            raise AlreadyMemberError
        user = await self.repository.get_user(user_id)
        if user is None:
            raise UserNotFoundError(user_id)
        await self.repository.add_member(room=room, user=user)
        room.status = RoomStatus.WAITING
        return room

    async def get_room_for_member(self, *, room_id: UUID, user_id: UUID) -> Room:
        room = await self.repository.get_by_id(room_id, with_members=True, for_update=True)
        if room is None:
            raise RoomNotFoundError
        if await self.repository.get_membership(room_id, user_id) is None:
            raise NotMemberError
        return room

    async def leave_room(self, *, room_id: UUID, user_id: UUID) -> None:
        room = await self.repository.get_by_id(room_id)
        if room is None:
            raise RoomNotFoundError
        membership = await self.repository.get_membership(room.id, user_id)
        if membership is None:
            raise NotMemberError
        if room.owner_id == user_id:
            raise CannotLeaveRoomError
        await self.repository.remove_member(membership)
        room.status = RoomStatus.WAITING

    async def set_ready(self, *, room_id: UUID, user_id: UUID, is_ready: bool) -> Room:
        room = await self.repository.get_by_id(room_id, with_members=True)
        if room is None:
            raise RoomNotFoundError
        membership = await self.repository.get_membership(room.id, user_id)
        if membership is None:
            raise NotMemberError
        if room.status not in {RoomStatus.WAITING, RoomStatus.READY}:
            raise InvalidRoomStateError("Room is not in lobby")

        membership.is_ready = is_ready
        await self.repository.session.flush()
        members = await self.repository.list_members(room.id)
        room.status = RoomStatus.READY if members and all(m.is_ready for m in members) else RoomStatus.WAITING
        await self.repository.session.flush()
        room = await self.repository.get_by_id(room.id, with_members=True)
        assert room is not None
        return room

    async def start_session(self, *, room_id: UUID, user_id: UUID) -> Room:
        room = await self.repository.get_by_id(room_id, with_members=True)
        if room is None:
            raise RoomNotFoundError
        if room.owner_id != user_id:
            raise NotOwnerError
        if room.status != RoomStatus.READY:
            raise InvalidRoomStateError("All members must be ready before starting")
        room.status = RoomStatus.ACTIVE
        await self.repository.session.flush()
        return room
