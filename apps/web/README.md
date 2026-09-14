# TasteSync Web

## Runtime networking

In development the web app derives API and WebSocket endpoints from the current browser hostname:

- http://localhost:5173 -> http://localhost:8000/api
- http://127.0.0.1:5173 -> http://127.0.0.1:8000/api
- http://192.168.x.x:5173 -> http://192.168.x.x:8000/api

Set `VITE_API_PORT` when the API uses another local port.

In production, `VITE_API_URL` and `VITE_WS_URL` may explicitly override the defaults.
