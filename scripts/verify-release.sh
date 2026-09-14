#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/api"

uv run python -m compileall -q app migrations
uv run pytest -q

echo "Movie Match release verification passed."
