#!/bin/bash
set -e

MODE="${1:-web}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/lib/env.sh"

if [ "$MODE" = "windows" ] || [ "$MODE" = "win" ] || [ "$MODE" = "app" ]; then
  if ! command -v powershell.exe >/dev/null 2>&1; then
    echo "Windows app mode requires WSL with powershell.exe available."
    exit 1
  fi

  echo "Starting Modern Audio Enhancer in Windows app mode..."
  PS_SCRIPT="$(wslpath -w "$PROJECT_ROOT/scripts/windows-start.ps1")"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PS_SCRIPT"
  exit $?
fi

if [ "$MODE" = "tauri" ] || [ "$MODE" = "desktop" ]; then
  echo "Starting Modern Audio Enhancer (Tauri Desktop)..."
  echo "  Note: yt-dlp must be installed for YouTube features"
  export WEBKIT_DISABLE_DMABUF_RENDERER=1
  cd "$PROJECT_ROOT/frontend"
  npm run tauri:dev
else
  activate_python_env
  PYTHON_BIN="$(find_python)"

  echo "Starting Modern Audio Enhancer (Web)..."
  echo "  Backend:  http://localhost:8800"
  echo "  Frontend: http://localhost:5173"
  echo ""

  # Start backend
  cd "$PROJECT_ROOT/backend"
  "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 8800 --reload &
  BACKEND_PID=$!

  # Start frontend
  cd "$PROJECT_ROOT/frontend"
  npm run dev -- --host 0.0.0.0 --port 5173 &
  FRONTEND_PID=$!

  echo ""
  echo "PIDs: Backend=$BACKEND_PID Frontend=$FRONTEND_PID"
  echo "Press Ctrl+C to stop both"

  trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

  wait
fi
