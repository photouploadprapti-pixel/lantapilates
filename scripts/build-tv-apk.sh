#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TV_DIR="$ROOT_DIR/android-tv"

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

# Ensure local.properties points at the Android SDK.
if [[ ! -f "$TV_DIR/local.properties" ]]; then
  if [[ -f "$ROOT_DIR/android/local.properties" ]]; then
    cp "$ROOT_DIR/android/local.properties" "$TV_DIR/local.properties"
  else
    # Escape Windows path backslashes for the properties file.
    sdk_dir="${ANDROID_HOME//\\/\\\\}"
    printf 'sdk.dir=%s\n' "$sdk_dir" > "$TV_DIR/local.properties"
  fi
fi

cd "$TV_DIR"

if [[ -f "./gradlew" ]]; then
  chmod +x ./gradlew
  ./gradlew assembleDebug --no-daemon
else
  gradle assembleDebug --no-daemon
fi

cp app/build/outputs/apk/debug/app-debug.apk "$ROOT_DIR/lantatv.apk"
echo "APK ready: $ROOT_DIR/lantatv.apk"
echo "Install on a TV / Fire Stick: adb install -r lantatv.apk"
echo "Note: this app loads https://lantapilates.netlify.app — deploy web TV changes before testing."
