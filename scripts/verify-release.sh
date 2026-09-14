#!/usr/bin/env bash
set -euo pipefail

echo "== backend =="
python -m compileall -q apps/api/app apps/api/migrations

echo "== frontend source =="
if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @movie-match/web typecheck
else
  echo "pnpm not installed; skipped frontend typecheck"
fi

echo "Release source checks passed."
