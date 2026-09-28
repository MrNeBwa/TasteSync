from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


TMDB_MISSING_TOKEN_MESSAGE = (
    "TMDB_API_TOKEN is not configured. Set it in apps/api/.env (see .env.example)."
)
CATALOG_EMPTY_MESSAGE = (
    "The movie catalog is empty. Set TMDB_API_TOKEN in apps/api/.env, then "
    "POST /api/movies/sync-popular (or restart the API, which seeds on startup)."
)


class Settings(BaseSettings):
    app_name: str = "Movie Match API"
    environment: str = "local"
    database_url: str = "postgresql+asyncpg://movie:movie@localhost:5432/movie_match"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    tmdb_api_token: str = ""

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_origin_regex: str = r"^https?://(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+):(?:5173|4173|3000|8080)$"
    cors_allow_all_local: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def is_tmdb_configured() -> bool:
    return bool(get_settings().tmdb_api_token)
