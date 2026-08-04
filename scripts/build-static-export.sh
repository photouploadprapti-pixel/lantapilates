#!/usr/bin/env bash
# Builds a static Next.js export (`out/`) for Capacitor / Netlify.
# App Router API routes are temporarily hidden because `output: 'export'` forbids them.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/src/app/api"
# Keep outside src/app — Next.js 16 still scans dot-folders under the App Router tree.
API_SKIP_DIR="$ROOT_DIR/.api-capacitor-skip"

restore_api_routes() {
  if [[ -d "$API_SKIP_DIR" ]]; then
    rm -rf "$API_DIR"
    # Prefer rename; fall back to copy on Windows file locks.
    if ! mv "$API_SKIP_DIR" "$API_DIR" 2>/dev/null; then
      cp -a "$API_SKIP_DIR" "$API_DIR"
      rm -rf "$API_SKIP_DIR"
    fi
  fi
}

trap restore_api_routes EXIT

cd "$ROOT_DIR"

# Clean leftover skip dirs from older builds (inside or outside app/).
rm -rf "$ROOT_DIR/src/app/.api-capacitor-skip"

if [[ -d "$API_DIR" ]]; then
  rm -rf "$API_SKIP_DIR"
  if ! mv "$API_DIR" "$API_SKIP_DIR" 2>/dev/null; then
    cp -a "$API_DIR" "$API_SKIP_DIR"
    rm -rf "$API_DIR" || find "$API_DIR" -mindepth 1 -delete
    rmdir "$API_DIR" 2>/dev/null || true
  fi
fi

export CAPACITOR_BUILD=1
npm run build

restore_api_routes
trap - EXIT
