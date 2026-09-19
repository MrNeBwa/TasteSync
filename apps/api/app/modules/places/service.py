from __future__ import annotations

from uuid import UUID

from app.models.place import Place, PlaceCategory
from app.providers.base import PlacesProvider, ProviderPlace
from app.repositories.place_repository import PlaceRepository

_RADIUS_BY_CATEGORY: dict[str, int] = {
    PlaceCategory.RESTAURANT.value: 6000,
    PlaceCategory.ENTERTAINMENT.value: 15000,
}


class PlaceNotFoundError(Exception):
    pass


class PlaceService:
    def __init__(
        self,
        repository: PlaceRepository,
        provider: PlacesProvider,
    ) -> None:
        self.repository = repository
        self.provider = provider

    async def recommend(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        category: PlaceCategory,
        latitude: float,
        longitude: float,
        limit: int = 8,
    ) -> list[Place]:
        voted = await self.repository.voted_place_ids(
            session_id=session_id,
            user_id=user_id,
        )
        matches = {m.place_id for m in await self.repository.list_matches(session_id=session_id)}

        radius = _RADIUS_BY_CATEGORY.get(category.value, 10000)
        candidates = await self.provider.search(
            category=category.value,
            latitude=latitude,
            longitude=longitude,
            radius=radius,
            limit=max(limit * 4, 16),
        )

        selected: list[Place] = []
        for candidate in candidates:
            place = await self._upsert(candidate)
            if place.id in voted or place.id in matches:
                continue
            selected.append(place)
            if len(selected) >= limit:
                break
        return selected

    async def _upsert(self, candidate: ProviderPlace) -> Place:
        return await self.repository.upsert_place(
            provider="osm",
            provider_id=candidate.provider_id,
            name=candidate.name,
            category=PlaceCategory(candidate.category),
            address=candidate.address,
            city=candidate.city,
            latitude=candidate.latitude,
            longitude=candidate.longitude,
            image_url=candidate.image_url,
            rating=candidate.rating,
            price_level=candidate.price_level,
            cuisine="; ".join(candidate.tags) if candidate.category == PlaceCategory.RESTAURANT.value else None,
            tags=candidate.tags,
            website=candidate.website,
            phone=candidate.phone,
            opening_hours=candidate.opening_hours,
        )

    async def get(self, place_id: UUID) -> Place:
        place = await self.repository.get_by_id(place_id)
        if place is None:
            raise PlaceNotFoundError
        return place