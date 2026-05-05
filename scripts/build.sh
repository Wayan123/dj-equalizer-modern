#!/bin/bash
set -e

MODE="${1:-web}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIGNING_KEY="$HOME/.tauri/modern-audio-enhancer.key"

ensure_updater_key() {
  mkdir -p "$(dirname "$SIGNING_KEY")"
  if [ ! -f "$SIGNING_KEY" ]; then
    echo "Generating local Tauri updater signing key..."
    cd "$PROJECT_ROOT/frontend"
    npx tauri signer generate --ci -w "$SIGNING_KEY"
  fi
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$SIGNING_KEY")"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
}

if [ "$MODE" = "exe" ] || [ "$MODE" = "windows-exe" ] || [ "$MODE" = "nsis" ]; then
  if ! command -v powershell.exe >/dev/null 2>&1; then
    echo "Windows EXE build requires WSL with powershell.exe available."
    exit 1
  fi

  echo "Building Modern Audio Enhancer (Windows NSIS EXE)..."
  PS_SCRIPT="$(wslpath -w "$PROJECT_ROOT/scripts/build-windows-exe.ps1")"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PS_SCRIPT"
  exit $?
fi

if [ "$MODE" = "tauri" ] || [ "$MODE" = "desktop" ]; then
  echo "Building Modern Audio Enhancer (Tauri Desktop)..."
  ensure_updater_key
  cd "$PROJECT_ROOT/frontend"
  npm run tauri:build -- --bundles deb --config src-tauri/tauri.local-updater.conf.json
  echo "Build complete: $PROJECT_ROOT/frontend/src-tauri/target/release/bundle/"
else
  echo "Building Modern Audio Enhancer (Web)..."

  cd "$PROJECT_ROOT/frontend"
  npm run build

  echo "Build complete: $PROJECT_ROOT/frontend/dist/"
fi
