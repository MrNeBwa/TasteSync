from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.rooms import router as rooms_router
from app.api.users import router as users_router
from app.api.movies import router as movies_router
from app.api.places import router as places_router
from app.api.ws import router as ws_router
from app.api.sessions import router as sessions_router
from app.api.history import router as history_router
from app.core.config import get_settings
from app.core.cors import get_cors_config
from app.db.session import AsyncSessionLocal, close_db
from app.modules.movies.service import MovieService
from app.providers.tmdb import TMDBProvider
from app.repositories.movie_repository import MovieRepository

logger = logging.getLogger("app.catalog")
if not logger.handlers and not logging.getLogger().handlers:
    # uvicorn only configures its own loggers, so application loggers have no
    # handler and INFO records vanish. The catalog seed is the one startup
    # message that must always reach the terminal, so attach a handler here
    # without touching the root logger.
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    logger.addHandler(handler)
    logger.propagate = False
logger.setLevel(logging.INFO)


async def seed_catalog_if_empty() -> None:
    """Load the movie catalog on startup when the table is still empty.

    TMDB is the primary source. When it cannot be used at all (no token, or the
    network blocks the host) the API falls back to the bundled offline catalog
    so movie sessions still have something to show, and says so in the log.
    """
    try:
        async with AsyncSessionLocal() as session:
            service = MovieService(MovieRepository(session))
            if await service.repository.count():
                return

            provider: TMDBProvider | None = None
            try:
                provider = TMDBProvider()
                synced = await MovieService(
                    MovieRepository(session), provider
                ).sync_popular(pages=2)
            except Exception as exc:  # noqa: BLE001 - any provider problem falls back
                logger.warning(
                    "TMDB is unavailable (%s: %s); seeding the bundled offline "
                    "catalog instead. Set TMDB_API_TOKEN and reach "
                    "api.themoviedb.org to replace it.",
                    type(exc).__name__,
                    exc,
                )
            else:
                await session.commit()
                logger.info("Seeded %s movies from TMDB", synced)
                return
            finally:
                if provider is not None:
                    await provider.close()

            seeded = await service.seed_bundled()
            await session.commit()
            logger.info(
                "Seeded %s movies from the bundled offline catalog. Restart or "
                "POST /api/movies/sync-popular once TMDB is reachable to replace them.",
                seeded,
            )
    except Exception as exc:  # noqa: BLE001 - startup must survive a missing catalog
        logger.error(
            "Movie catalog is empty and could not be seeded (%s: %s). "
            "Movie sessions will return no recommendations until the catalog is loaded.",
            type(exc).__name__,
            exc,
        )


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await seed_catalog_if_empty()
    yield
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title=settings.app_name, version="1.3.0", lifespan=lifespan)
    _cors_origins, _cors_regex, _cors_allow_all = get_cors_config()
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if _cors_allow_all else _cors_origins,
        allow_origin_regex=None if _cors_allow_all else _cors_regex,
        allow_credentials=False if _cors_allow_all else True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Health endpoint served at both /health (root, for healthchecks/probes)
    # and /api/health (the rest of the API surface lives under /api).
    application.include_router(health_router, prefix="/api")
    application.include_router(health_router)
    application.include_router(auth_router, prefix="/api")
    application.include_router(rooms_router, prefix="/api")
    application.include_router(users_router, prefix="/api")
    application.include_router(movies_router, prefix="/api")
    application.include_router(places_router, prefix="/api")
    application.include_router(ws_router)
    application.include_router(sessions_router, prefix="/api")
    application.include_router(history_router, prefix="/api")
    return application


app = create_app()
