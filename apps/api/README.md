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

### The catalog: TMDB plus a bundled offline fallback

Nothing pre-loads TMDB data, so `TMDB_API_TOKEN` (see `.env.example`) plus a network path
to `api.themoviedb.org` are needed for the real catalog: popular movies, genre IDs/names,
overviews, posters and YouTube trailer metadata.

When the provider cannot be used at all, startup falls back to
`app/modules/movies/bundled.py` — 40 well-known films with titles, years, overviews, TMDB
genre ids and YouTube trailer ids, seeded as `provider="bundled"`. That keeps movie
sessions usable on an air-gapped or DNS-blocked machine. The fallback ships **no poster
or backdrop URLs** (those come from TMDB's CDN), so those films render the web UI's
gradient/text placeholder, but they do play trailers.

Trailer ids live in `TRAILER_KEYS` and were each resolved through YouTube's oEmbed
endpoint, so a typo or a removed video fails the test suite instead of reaching the player
as "An error occurred". `bundled_rows()` raises `ValueError` if a catalog entry has no id.
Adding a film to `BUNDLED_CATALOG` therefore means adding its trailer id too.

Seeding is best-effort and never blocks the boot, but it is not silent:

- the source is logged — `Seeded N movies from TMDB` or
  `Seeded N movies from the bundled offline catalog`, with the provider error when the
  fallback was used;
- `/health` and `/api/health` report `"catalog": "ok" | "empty"`,
  `"catalog_source": "tmdb" | "bundled" | "mixed" | "empty"` and a `movies` count;
  the overall `status` is `degraded` only when the catalog is empty;
- `GET /api/sessions/{session_id}/movies` returns `503` with an actionable message when
  the catalog is empty, so clients can tell "catalog missing" apart from "everyone
  already voted on everything available";
- `POST /api/movies/sync-popular` returns `503` when the token is missing and `502` when
  TMDB itself is unreachable. A successful call deletes the bundled rows first and
  reports both counts: `{"synced": N, "dropped_bundled": M}`.

Note: bundled and TMDB rows carry separate genre identities, so LIKE-based genre
preferences learned while offline do not carry over once real data replaces the fallback.

Rotten Tomatoes is represented by a provider boundary, but direct automated
scraping is intentionally not implemented. Fandango's current terms prohibit
automated data extraction/data mining without express written authorization.
Use its licensed API/data-feed process if RT data is required in production.

Recommendation logic is intentionally simple for MVP:
- derive genre preference scores from LIKE votes in the active session;
- rank candidates sharing the most-liked genres;
- reserve an exploration slice for shuffled popular movies from other genres.
