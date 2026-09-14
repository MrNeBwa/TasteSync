#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Infrastructure
docker compose -f "$ROOT/infra/docker-compose.yml" up -d

# Backend
cd "$ROOT/apps/api"
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
API_PID=$!

# Web
cd "$ROOT"
npx pnpm@10.15.0 install --filter "@movie-match/web..."
npx pnpm@10.15.0 --filter @movie-match/web run dev &
WEB_PID=$!

trap "kill $API_PID $WEB_PID 2>/dev/null; wait" EXIT
echo "API running on http://localhost:8000/docs"
echo "Web running on http://localhost:5173"
wait
