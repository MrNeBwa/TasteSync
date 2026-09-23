# Movie Match API

FastAPI + SQLAlchemy 2 async + PostgreSQL + Alembic.

## Local run

```bash
cd apps/api
uv sync
cp .env.example .env

# from repository root
docker compose -f infra/docker-compose.yml up -d postgres redis

# from apps/api
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs
Health: http://127.0.0.1:8000/health (also available at `/api/health`)

## Current API

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me` (Bearer access token)

### Rooms
- `POST /api/rooms` (Bearer access token)
- `GET /api/rooms/{room_id}` (Bearer access token)
- `POST /api/rooms/join` (Bearer access token)
- `DELETE /api/rooms/{room_id}/members/me` (Bearer access token)

Room ownership is derived from the authenticated user; clients cannot submit an arbitrary `owner_id`.

## Movie catalog and recommendations

Movie metadata is provider-driven; genres are not manually maintained. The
current development provider is TMDB. It supplies popular movies, genre IDs /
names, overviews and YouTube trailer metadata. Movies and genres are synced
into PostgreSQL on demand with `POST /api/movies/sync-popular`.

Rotten Tomatoes is represented by a provider boundary, but direct automated
scraping is intentionally not implemented. Fandango's current terms prohibit
automated data extraction/data mining without express written authorization.
Use its licensed API/data-feed process if RT data is required in production.

Recommendation logic is intentionally simple for MVP:
- derive genre preference scores from LIKE votes in the active session;
- rank candidates sharing the most-liked genres;
- reserve an exploration slice for shuffled popular movies from other genres.
