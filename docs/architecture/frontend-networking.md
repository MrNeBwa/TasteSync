# TasteSync frontend networking

## Development

The web client derives the API and WebSocket host from the hostname used to open the web app.

Examples:

- `http://localhost:5173` -> `http://localhost:8000/api`
- `http://127.0.0.1:5173` -> `http://127.0.0.1:8000/api`
- `http://192.168.100.7:5173` -> `http://192.168.100.7:8000/api`
- `http://10.0.0.12:5173` -> `http://10.0.0.12:8000/api`

Do not put a LAN `VITE_API_URL` into `.env` for development. The code deliberately ignores build-time API URLs while running Vite in dev mode.

## Production

Use reverse proxy / same-origin deployment where possible. Otherwise set `VITE_API_URL` and `VITE_WS_URL` explicitly.

## Why runtime resolution?

A laptop can get a different DHCP address. Resolving the hostname from the browser means the project works on a new LAN address without rebuilding or editing environment variables.

## Authentication

The API client has a single-flight refresh flow. Concurrent `401` responses reuse one refresh request, then retry once with the new access token.
