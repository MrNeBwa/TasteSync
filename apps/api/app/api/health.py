from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db_session
from app.repositories.movie_repository import MovieRepository

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(session: AsyncSession = Depends(get_db_session)) -> dict[str, str | int]:
    try:
        await session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    try:
        await redis.ping()
        redis_status = "ok"
    except Exception:
        redis_status = "error"
    finally:
        await redis.aclose()

    # An empty catalog is not fatal to boot, but movie sessions return no
    # recommendations, so it degrades the reported readiness.
    try:
        repository = MovieRepository(session)
        movies = await repository.count()
        bundled = await repository.count_by_provider("bundled")
        catalog_status = "ok" if movies else "empty"
        catalog_source = (
            "empty"
            if not movies
            else "bundled"
            if bundled == movies
            else "tmdb"
            if bundled == 0
            else "mixed"
        )
    except Exception:
        movies = 0
        catalog_status = "error"
        catalog_source = "unknown"

    healthy = db_status == "ok" and redis_status == "ok" and catalog_status == "ok"
    return {
        "status": "ok" if healthy else "degraded",
        "database": db_status,
        "redis": redis_status,
        "catalog": catalog_status,
        "catalog_source": catalog_source,
        "movies": movies,
    }
