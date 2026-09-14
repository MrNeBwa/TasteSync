# Runtime networking

## Web development

The browser derives the API and WebSocket host from `window.location.hostname`.

Examples:

- `http://localhost:5173` -> `http://localhost:8000/api`
- `http://192.168.100.7:5173` -> `http://192.168.100.7:8000/api`
- `http://10.214.151.154:5173` -> `http://10.214.151.154:8000/api`

`VITE_API_URL` does not override this behavior in Vite development mode, preventing stale LAN/VPN values from breaking the client.

Production can use `VITE_API_URL` and `VITE_WS_URL` for explicit public endpoints.

The backend's local CORS policy allows all origins because the web client uses bearer authorization rather than cookie credentials. Production must use an explicit origin allowlist.
