from __future__ import annotations

import hashlib
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.place import Place, PlaceCategory
from app.models.user import User
from app.modules.places.cover import place_cover_svg
from app.modules.places.photos import GOOGLE_PHOTOS_BASE, PhotoClient
from app.modules.places.schemas import PlaceResponse, to_place_response
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


@router.get("/places/{place_id}/cover.svg", include_in_schema=False)
async def place_cover(
    place_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Generated cover art for a place.

    Deliberately unauthenticated: it is loaded as a plain ``<img>`` source by the
    web client, which cannot attach a bearer token, and the artwork is derived
    only from the place id and name.

    The artwork is pure, so it is hashed into an ETag and revalidated by hand --
    Starlette does not do conditional handling for a plain Response, so without
    this every cached visit would re-download the file.
    """
    name = await session.scalar(select(Place.name).where(Place.id == place_id))
    if name is None:
        raise HTTPException(status_code=404, detail="Place not found")
    body = place_cover_svg(str(place_id), name)
    etag = f'"{hashlib.sha256(body.encode()).hexdigest()[:32]}"'
    headers = {"Cache-Control": "public, max-age=86400, immutable", "ETag": etag}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="image/svg+xml", headers=headers)


@router.get("/places/{place_id}/photo", include_in_schema=False)
async def place_photo(
    place_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Stream a place photo stored on Google Places.

    Deliberately unauthenticated and keyless on the client side: it is loaded
    as a plain ``<img>`` source (web client cannot attach a bearer token), and
    the Google key lives only in the env/header here, never in the URL the
    browser sees. The photo bytes are proxied, so a client cache header keeps
    repeat views off the billed Google call.
    """
    place = await session.scalar(select(Place).where(Place.id == place_id))
    api_key = get_settings().google_places_api_key
    if place is None or not place.google_photo_ref or not api_key:
        raise HTTPException(status_code=404, detail="Photo not found")
    url = f"{GOOGLE_PHOTOS_BASE}{place.google_photo_ref}/media"
    timeout = httpx.Timeout(15.0, connect=5.0)
    async with httpx.AsyncClient(
        timeout=timeout,
        headers={"User-Agent": "movie-match/1.0"},
    ) as client:
        upstream = await client.get(url, params={"maxWidthPx": 1600, "key": api_key})
    if upstream.status_code >= 400:
        raise HTTPException(status_code=404, detail="Photo not found")
    content_type = upstream.headers.get("content-type") or "image/jpeg"
    headers = {
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
    }
    return Response(content=upstream.content, media_type=content_type, headers=headers)


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
    return to_place_response(place)


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
    photo_client = PhotoClient()
    try:
        places = await PlaceService(PlaceRepository(db), provider, photo_client=photo_client).recommend(
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
        await photo_client.close()
    return [to_place_response(place) for place in places]