#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JAVA_HOME="${JAVA_HOME:-$HOME/.jdks/jdk-21}"
ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"

export JAVA_HOME
export ANDROID_HOME

cd "$ROOT_DIR"
npm run build
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon
cp app/build/outputs/apk/debug/app-debug.apk "$ROOT_DIR/lanta-pilates-debug.apk"
echo "APK ready: $ROOT_DIR/lanta-pilates-debug.apk"
