from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.vote import VoteValue

if TYPE_CHECKING:
    from app.models.place import Place
    from app.models.user import User


class PlaceVote(Base):
    __tablename__ = "place_votes"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", "place_id", name="uq_place_vote_once"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("movie_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    place_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("places.id", ondelete="CASCADE"), nullable=False, index=True)
    value: Mapped[VoteValue] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    place: Mapped[Place] = relationship(back_populates="votes")
    user: Mapped[User] = relationship()