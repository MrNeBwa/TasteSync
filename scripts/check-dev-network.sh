#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-5173}"
API_PORT="${API_PORT:-8000}"

printf 'Checking web: http://%s:%s ... ' "$HOST" "$WEB_PORT"
curl -fsS --max-time 5 "http://${HOST}:${WEB_PORT}/" >/dev/null
printf 'OK\n'

printf 'Checking API through Vite proxy: http://%s:%s/api/health ... ' "$HOST" "$WEB_PORT"
curl -fsS --max-time 5 "http://${HOST}:${WEB_PORT}/api/health" >/dev/null
printf 'OK\n'

printf 'Checking direct API: http://%s:%s/api/health ... ' "$HOST" "$API_PORT"
curl -fsS --max-time 5 "http://${HOST}:${API_PORT}/api/health" >/dev/null
printf 'OK\n'

printf 'DEV network path is healthy.\n'
