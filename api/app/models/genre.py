from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.movie import MovieGenre

from app.db.base import Base


class Genre(Base):
    __tablename__ = "genres"
    __table_args__ = (UniqueConstraint("provider", "provider_id", name="uq_genre_provider_id"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    movies: Mapped[list[MovieGenre]] = relationship(back_populates="genre")

