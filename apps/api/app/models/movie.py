from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.genre import Genre


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    overview: Mapped[str | None] = mapped_column(Text)
    release_date: Mapped[date | None] = mapped_column(Date)
    poster_url: Mapped[str | None] = mapped_column(String(1000))
    backdrop_url: Mapped[str | None] = mapped_column(String(1000))
    popularity: Mapped[float | None] = mapped_column(Float)
    vote_average: Mapped[float | None] = mapped_column(Float)
    vote_count: Mapped[int | None] = mapped_column(Integer)
    primary_trailer_url: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    genres: Mapped[list[MovieGenre]] = relationship(back_populates="movie", cascade="all, delete-orphan")


class MovieGenre(Base):
    __tablename__ = "movie_genres"

    movie_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True)
    genre_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True)

    movie: Mapped[Movie] = relationship(back_populates="genres")
    genre: Mapped[Genre] = relationship(back_populates="movies")
