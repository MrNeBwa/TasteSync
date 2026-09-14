# TasteSync v1.7

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
# terminal 1
cd api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# terminal 2
pnpm install
pnpm dev:web
```
