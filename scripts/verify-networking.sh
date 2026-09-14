#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Runtime networking must go through the shared client/config modules.
if grep -RInE '(fetch\(|new WebSocket\()([^;]*)(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' "$ROOT/apps/web/src"; then
  echo 'ERROR: hardcoded host found directly in runtime network call.'
  exit 1
fi

echo 'Web runtime networking: OK'
