# Frontend networking

The web app uses the browser hostname as the source of truth during development.

`http://192.168.100.7:5173` therefore talks to `http://192.168.100.7:8000/api` and the matching WebSocket host.

Production can override this with `VITE_API_URL` and `VITE_WS_URL`.
