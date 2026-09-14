# TasteSync v1.7

## Networking architecture

### Web development
The browser uses same-origin relative paths:

- REST: `/api/...`
- WebSocket: `/ws/...`

Vite proxies both paths to the local FastAPI instance at `127.0.0.1:8000`.

This is deliberate: the browser never performs a cross-origin request in web development, so LAN and virtual-interface hostnames do not require a matching CORS rule.

Examples:

```text
http://localhost:5173      -> /api -> http://127.0.0.1:8000/api
http://192.168.100.7:5173  -> /api -> http://127.0.0.1:8000/api
http://10.214.151.154:5173 -> /api -> http://127.0.0.1:8000/api
```

The URL visible to the phone does not need to equal the API hostname because Vite is acting as the same-origin reverse proxy.

### Mobile / external clients
Mobile apps and direct API clients do not use the browser proxy. Configure their API/WS base URL to a reachable laptop address, e.g. `192.168.x.x` or `10.x.x.x`.

### CORS
Local FastAPI mode allows CORS for direct development clients. Production must use a strict allowlist.

## Upgrade

Do not overwrite the backend when doing a web-only update. The repository is intentionally split so `apps/web` can be replaced independently.
