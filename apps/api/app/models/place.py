from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.place_vote import PlaceVote


class PlaceCategory(StrEnum):
    RESTAURANT = "RESTAURANT"
    ENTERTAINMENT = "ENTERTAINMENT"


class Place(Base):
    __tablename__ = "places"
    __table_args__ = (UniqueConstraint("provider", "provider_id", name="uq_place_provider_id"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_id: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[PlaceCategory] = mapped_column(String(20), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(160))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(1000))
    rating: Mapped[float | None] = mapped_column(Float)
    price_level: Mapped[str | None] = mapped_column(String(20))
    cuisine: Mapped[str | None] = mapped_column(String(300))
    tags: Mapped[str | None] = mapped_column(String(500))
    website: Mapped[str | None] = mapped_column(String(1000))
    phone: Mapped[str | None] = mapped_column(String(60))
    opening_hours: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    votes: Mapped[list[PlaceVote]] = relationship(back_populates="place")

    def __repr__(self) -> str:
        return f"<Place {self.name} ({self.category})>"