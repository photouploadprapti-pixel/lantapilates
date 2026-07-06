#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/public/videos/reformer"
PLAYLIST_ID="PLaZqhqUgtBGU"
PLAYLIST_URL="https://www.youtube.com/playlist?list=${PLAYLIST_ID}"

run_yt_dlp() {
  if command -v yt-dlp >/dev/null 2>&1; then
    yt-dlp "$@"
    return
  fi

  if command -v python >/dev/null 2>&1; then
    python -m yt_dlp "$@"
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -m yt_dlp "$@"
    return
  fi

  echo "yt-dlp is required. Install it first:"
  echo "  pip install yt-dlp"
  exit 1
}

mkdir -p "$OUT_DIR"

echo "Downloading reformer playlist to $OUT_DIR ..."
run_yt_dlp \
  --ignore-errors \
  --no-overwrites \
  -f "best[ext=mp4]/best" \
  -o "$OUT_DIR/%(playlist_index)03d.%(ext)s" \
  --write-info-json \
  "$PLAYLIST_URL"

node "$ROOT_DIR/scripts/generate-playlist-manifest.mjs" "$OUT_DIR" "$PLAYLIST_ID"

echo "Done. Refresh /play to use the native player."
