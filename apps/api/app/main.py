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


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await close_db()


app = FastAPI(title="Movie Match API", version="1.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
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
