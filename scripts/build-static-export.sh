#!/usr/bin/env bash
# Builds a static Next.js export (`out/`) for Capacitor / Netlify.
# App Router API routes are temporarily hidden because `output: 'export'` forbids them.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/src/app/api"
API_SKIP_DIR="$ROOT_DIR/src/app/.api-capacitor-skip"

restore_api_routes() {
  if [[ -d "$API_SKIP_DIR" ]]; then
    mv "$API_SKIP_DIR" "$API_DIR"
  fi
}

trap restore_api_routes EXIT

cd "$ROOT_DIR"

if [[ -d "$API_DIR" ]]; then
  rm -rf "$API_SKIP_DIR"
  mv "$API_DIR" "$API_SKIP_DIR"
fi

export CAPACITOR_BUILD=1
npm run build

restore_api_routes
trap - EXIT
