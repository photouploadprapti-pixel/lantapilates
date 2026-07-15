#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Prefer a modern JDK 17+ when available (Gradle/Android require it).
if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  if [[ -x "$HOME/.jdks/jdk-21/bin/java" ]]; then
    JAVA_HOME="$HOME/.jdks/jdk-21"
  elif [[ -x "$HOME/.jdks/jdk-17/bin/java" ]]; then
    JAVA_HOME="$HOME/.jdks/jdk-17"
  elif [[ -x "/c/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot/bin/java" ]]; then
    JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot"
  fi
fi

ANDROID_HOME="${ANDROID_HOME:-${LOCALAPPDATA:-}/Android/Sdk}"

export JAVA_HOME
export ANDROID_HOME
export PATH="$JAVA_HOME/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"
java -version

cd "$ROOT_DIR"
npm run build

# Chromecast / TV APKs should stay small — workout MP4s play from the on-device folder,
# so strip any accidentally copied public/videos media from the web export.
if [[ -d "out/videos" ]]; then
  find out/videos -type f \( -iname '*.mp4' -o -iname '*.webm' -o -iname '*.mkv' -o -iname '*.mov' -o -iname '*.ts' -o -iname '*.m2ts' \) -delete
  echo "Stripped bundled video media from out/videos for a lean APK."
fi

npx cap sync android
cd android

if [[ -f "./gradlew" ]]; then
  chmod +x ./gradlew
  ./gradlew assembleDebug --no-daemon
else
  gradle assembleDebug --no-daemon
fi

cp app/build/outputs/apk/debug/app-debug.apk "$ROOT_DIR/lanta-pilates-debug.apk"
echo "APK ready: $ROOT_DIR/lanta-pilates-debug.apk"
