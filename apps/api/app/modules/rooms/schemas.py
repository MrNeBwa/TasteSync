from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.room import RoomStatus, RoomTask
from app.models.room_member import RoomMemberRole


class CreateRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    task: RoomTask = RoomTask.MOVIES


class JoinRoomRequest(BaseModel):
    code: str = Field(min_length=4, max_length=8)


class UpdateRoomTaskRequest(BaseModel):
    task: RoomTask


class RoomMemberResponse(BaseModel):
    user_id: UUID
    username: str
    role: RoomMemberRole
    is_ready: bool
    joined_at: datetime


class RoomResponse(BaseModel):
    id: UUID
    name: str
    code: str
    owner_id: UUID
    status: RoomStatus
    task: RoomTask = RoomTask.MOVIES
    created_at: datetime

    model_config = {"from_attributes": True}


class RoomDetailResponse(RoomResponse):
    members: list[RoomMemberResponse]


class ReadyResponse(BaseModel):
    room: RoomDetailResponse
    is_ready: bool


class RoomEvent(BaseModel):
    type: str
    room_id: UUID
    payload: dict
