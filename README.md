# TasteSync v1.7

## Features

- Shared room voting with realtime lobby (WebSocket) and LIKE / DISLIKE / SKIP movie sessions.
- Join rooms by 6-char code, by shareable invite link, or by scanning a QR code (web lobby renders it, mobile scans it).
- Room & match history on the web dashboard and mobile profile.
- Age/content gate with 18+ filtering; account settings incl. password change.
- Dark mode / light mode toggle on both web and mobile (persisted).
- Web session keyboard shortcuts: `1` DISLIKE, `2` SKIP, `3` LIKE.
- Content policy: matched movies respect both age of the participants and 18+ flag.

## Development networking

The web app uses a same-origin Vite proxy. Open the UI from any reachable interface/IP:

- `http://localhost:5173` -> API `/api` proxied to FastAPI `127.0.0.1:8000`
- `http://127.0.0.1:5173` -> same
- `http://192.168.x.x:5173` -> same
- `http://10.x.x.x:5173` -> same
- `http://172.16.x.x:5173` through `172.31.x.x:5173` -> same
- virtual/private interface addresses work without changing frontend config

The browser never calls `:8000` directly in web development, so browser CORS is avoided entirely. WebSocket uses the same-origin `/ws` Vite proxy.

For mobile, set `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` to a reachable host of the laptop.

## Run

```bash
# terminal 0 - infrastructure (Postgres :5432, Redis :6379)
docker compose -f infra/docker-compose.yml up -d

# terminal 1
cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# terminal 2
pnpm install
pnpm dev:web
```

The API seeds the movie catalog on startup when the `movies` table is empty. `/health` (also available at `/api/health`) reports DB/Redis connectivity plus `catalog` (`ok`/`empty`) and `catalog_source` (`tmdb`/`bundled`).

### Movie catalog: TMDB, with an offline fallback

TMDB is the primary source. Set a read access token to use it:

```bash
cd apps/api
cp .env.example .env
# put a TMDB API read access token into TMDB_API_TOKEN
```

If the token is missing **or the network blocks `api.themoviedb.org`**, the API seeds a
bundled 40-film catalog instead and logs which source it used. Movie sessions work
either way and trailers play; the fallback set just has no poster images, so those films
show a gradient placeholder.

```bash
curl -s localhost:8000/health
# {"catalog":"ok","catalog_source":"bundled","movies":40,...}
```

Once TMDB is reachable, `POST /api/movies/sync-popular?pages=3` replaces the fallback rows
with real data (posters, trailers) — or just restart the API. If both sources fail, the
catalog stays empty, `/health` reports `degraded`, and
`GET /api/sessions/{id}/movies` answers `503` with an actionable message rather than an
empty list, so the web UI never claims the selection simply ran out.
