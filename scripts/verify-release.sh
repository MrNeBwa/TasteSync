#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== API: byte-compile =="
cd "$ROOT/apps/api"
uv run python -m compileall -q app migrations tests

echo "== API: ruff =="
uv run ruff check app tests

echo "== API: pytest =="
uv run pytest -q

echo "== Web: typecheck =="
cd "$ROOT"
npx pnpm@10.15.0 --filter @movie-match/web run typecheck

echo "== Mobile: typecheck =="
npx pnpm@10.15.0 --filter @movie-match/mobile run typecheck

echo "Movie Match release verification passed."