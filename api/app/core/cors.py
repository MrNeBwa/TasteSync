from app.core.config import get_settings


def get_cors_config() -> tuple[list[str], str | None, bool]:
    settings = get_settings()

    origins = [
        value.strip().rstrip("/")
        for value in settings.cors_origins.split(",")
        if value.strip()
    ]

    allow_all = (
        settings.environment == "local"
        and settings.cors_allow_all_local
    )

    return origins, settings.cors_origin_regex, allow_all