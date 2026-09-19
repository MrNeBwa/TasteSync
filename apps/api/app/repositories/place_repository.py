from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.place import Place, PlaceCategory
from app.models.place_match import PlaceMatch
from app.models.place_vote import PlaceVote
from app.models.vote import VoteValue


class PlaceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_provider_id(self, provider: str, provider_id: str) -> Place | None:
        stmt = select(Place).where(
            Place.provider == provider,
            Place.provider_id == provider_id,
        )
        return await self.session.scalar(stmt)

    async def upsert_place(
        self,
        *,
        provider: str,
        provider_id: str,
        name: str,
        category: PlaceCategory,
        address: str | None,
        city: str | None,
        latitude: float,
        longitude: float,
        image_url: str | None,
        rating: float | None,
        price_level: str | None,
        cuisine: str | None,
        tags: list[str],
        website: str | None,
        phone: str | None,
        opening_hours: str | None,
    ) -> Place:
        place = await self.get_by_provider_id(provider, provider_id)
        if place is None:
            place = Place(
                provider=provider,
                provider_id=provider_id,
                name=name,
                category=category,
                latitude=latitude,
                longitude=longitude,
            )
            self.session.add(place)
            await self.session.flush()
        place.name = name
        place.category = category
        place.address = address
        place.city = city
        place.latitude = latitude
        place.longitude = longitude
        if not place.image_url:
            place.image_url = image_url
        place.rating = rating
        place.price_level = price_level
        place.cuisine = cuisine
        place.tags = "|".join(tags) if tags else None
        place.website = website
        place.phone = phone
        place.opening_hours = opening_hours
        await self.session.flush()
        return place

    async def get_by_id(self, place_id: UUID) -> Place | None:
        stmt = select(Place).where(Place.id == place_id)
        return await self.session.scalar(stmt)

    async def list_by_ids(self, place_ids: list[UUID]) -> list[Place]:
        if not place_ids:
            return []
        stmt = select(Place).where(Place.id.in_(place_ids))
        return list(await self.session.scalars(stmt))

    async def voted_place_ids(self, *, session_id: UUID, user_id: UUID) -> set[UUID]:
        stmt = (
            select(PlaceVote.place_id)
            .where(
                PlaceVote.session_id == session_id,
                PlaceVote.user_id == user_id,
            )
            .distinct()
        )
        return set(await self.session.scalars(stmt))

    async def get_vote(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        place_id: UUID,
    ) -> PlaceVote | None:
        stmt = select(PlaceVote).where(
            PlaceVote.session_id == session_id,
            PlaceVote.user_id == user_id,
            PlaceVote.place_id == place_id,
        )
        return await self.session.scalar(stmt)

    async def create_vote(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        place_id: UUID,
        value: VoteValue,
    ) -> PlaceVote:
        vote = PlaceVote(
            session_id=session_id,
            user_id=user_id,
            place_id=place_id,
            value=value,
        )
        self.session.add(vote)
        return vote

    async def count_likes(
        self,
        *,
        session_id: UUID,
        place_id: UUID,
        user_ids: list[UUID],
    ) -> int:
        stmt = select(func.count()).select_from(PlaceVote).where(
            PlaceVote.session_id == session_id,
            PlaceVote.place_id == place_id,
            PlaceVote.user_id.in_(user_ids),
            PlaceVote.value == VoteValue.LIKE,
        )
        return int(await self.session.scalar(stmt) or 0)

    async def get_match(
        self,
        *,
        session_id: UUID,
        place_id: UUID,
    ) -> PlaceMatch | None:
        stmt = select(PlaceMatch).where(
            PlaceMatch.session_id == session_id,
            PlaceMatch.place_id == place_id,
        )
        return await self.session.scalar(stmt)

    async def create_match(
        self,
        *,
        session_id: UUID,
        place_id: UUID,
    ) -> PlaceMatch:
        match = PlaceMatch(session_id=session_id, place_id=place_id)
        self.session.add(match)
        await self.session.flush()
        return match

    async def list_matches(self, *, session_id: UUID) -> list[PlaceMatch]:
        stmt = (
            select(PlaceMatch)
            .where(PlaceMatch.session_id == session_id)
            .options(selectinload(PlaceMatch.place))
            .order_by(PlaceMatch.created_at.asc())
        )
        return list(await self.session.scalars(stmt))