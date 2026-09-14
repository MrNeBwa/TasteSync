from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.rooms import router as rooms_router
from app.api.users import router as users_router
from app.api.movies import router as movies_router
from app.api.ws import router as ws_router
from app.api.sessions import router as sessions_router
from app.db.session import close_db
from app.core.cors import get_cors_config


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await close_db()


app = FastAPI(title="TasteSync API", version="1.6.0", lifespan=lifespan)
_cors_origins, _cors_regex, _cors_allow_all = get_cors_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _cors_allow_all else _cors_origins,
    allow_origin_regex=None if _cors_allow_all else _cors_regex,
    allow_credentials=False if _cors_allow_all else True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(rooms_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(movies_router, prefix="/api")
app.include_router(ws_router)
app.include_router(sessions_router, prefix="/api")
