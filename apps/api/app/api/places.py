from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.place import PlaceCategory
from app.models.user import User
from app.modules.places.schemas import PlaceResponse
from app.modules.places.service import PlaceNotFoundError, PlaceService
from app.modules.sessions.service import (
    MovieSessionService,
    SessionNotActiveError,
    SessionNotFoundError,
    SessionNotMemberError,
)
from app.providers.overpass import OverpassProvider
from app.repositories.movie_repository import MovieRepository
from app.repositories.place_repository import PlaceRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.session_repository import SessionRepository

router = APIRouter(tags=["places"])


def place_response(place) -> PlaceResponse:
    return PlaceResponse(
        id=place.id,
        name=place.name,
        category=place.category,
        address=place.address,
        city=place.city,
        latitude=place.latitude,
        longitude=place.longitude,
        image_url=place.image_url,
        rating=place.rating,
        price_level=place.price_level,
        cuisine=place.cuisine,
        tags=place.tags.split("|") if place.tags else [],
        website=place.website,
        phone=place.phone,
        opening_hours=place.opening_hours,
    )


@router.get("/places/{place_id}", response_model=PlaceResponse)
async def get_place(
    place_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PlaceResponse:
    provider = OverpassProvider()
    try:
        place = await PlaceService(PlaceRepository(session), provider).get(place_id)
    except PlaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Place not found") from exc
    finally:
        await provider.close()
    return place_response(place)


@router.get("/sessions/{session_id}/places", response_model=list[PlaceResponse])
async def session_places(
    session_id: UUID,
    category: PlaceCategory = Query(...),
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    limit: int = Query(default=8, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[PlaceResponse]:
    svc = MovieSessionService(
        SessionRepository(db),
        RoomRepository(db),
        MovieRepository(db),
        PlaceRepository(db),
    )
    try:
        await svc.get_for_member(session_id=session_id, user_id=current_user.id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except SessionNotMemberError as exc:
        raise HTTPException(status_code=403, detail="User is not a member of this room") from exc
    except SessionNotActiveError as exc:
        raise HTTPException(status_code=409, detail="Session is not active") from exc

    provider = OverpassProvider()
    try:
        places = await PlaceService(PlaceRepository(db), provider).recommend(
            session_id=session_id,
            user_id=current_user.id,
            category=category,
            latitude=lat,
            longitude=lon,
            limit=limit,
        )
        await db.commit()
    finally:
        await provider.close()
    return [place_response(place) for place in places]