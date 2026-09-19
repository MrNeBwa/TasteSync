from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.room_member import RoomMember
    from app.models.user import User


class RoomStatus(StrEnum):
    WAITING = "WAITING"
    READY = "READY"
    ACTIVE = "ACTIVE"
    MATCH_FOUND = "MATCH_FOUND"
    FINISHED = "FINISHED"


class RoomTask(StrEnum):
    MOVIES = "movies"
    RESTAURANTS = "restaurants"
    ENTERTAINMENT = "entertainment"


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    owner_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[RoomStatus] = mapped_column(String(20), default=RoomStatus.WAITING, nullable=False)
    task: Mapped[RoomTask] = mapped_column(String(20), default=RoomTask.MOVIES, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="owned_rooms", foreign_keys=[owner_id])
    members: Mapped[list[RoomMember]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
