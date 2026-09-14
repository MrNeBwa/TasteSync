from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.movie import Movie
    from app.models.session import MovieSession
    from app.models.user import User


class VoteValue(StrEnum):
    LIKE = "LIKE"
    DISLIKE = "DISLIKE"
    SKIP = "SKIP"


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("session_id", "user_id", "movie_id", name="uq_vote_once"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("movie_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    movie_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    value: Mapped[VoteValue] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped[MovieSession] = relationship(back_populates="votes")
    movie: Mapped[Movie] = relationship()
    user: Mapped[User] = relationship()
