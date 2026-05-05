#!/bin/bash
set -euo pipefail

SCRIPT_PATH="$(readlink -f "$0")"
PROJECT_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/lib/env.sh"

resolve_service() {
  local service="$1"
  local port="$2"

  case "$service" in
    backend)
      WORKDIR="$PROJECT_ROOT/backend"
      COMMAND=(python -m uvicorn app.main:app --host 0.0.0.0 --port "$port")
      ;;
    frontend)
      WORKDIR="$PROJECT_ROOT/frontend"
      COMMAND=(npm run dev -- --host 0.0.0.0 --port "$port")
      ;;
    *)
      echo "Unknown service: $service" >&2
      exit 2
      ;;
  esac
}

run_service() {
  local service="$1"
  local port="$2"

  resolve_service "$service" "$port"

  echo "[$(date -Is)] Starting $service on port $port"
  echo "Project root: $PROJECT_ROOT"
  echo "Workdir: $WORKDIR"
  echo "Command: ${COMMAND[*]}"

  if [ "$service" = "backend" ]; then
    activate_python_env
    local python_bin
    python_bin="$(find_python)"
    COMMAND=("$python_bin" -m uvicorn app.main:app --host 0.0.0.0 --port "$port")
  fi

  cd "$WORKDIR"
  exec "${COMMAND[@]}"
}

if [ "${1:-}" = "--run" ] || [ "${1:-}" = "--run-logged" ]; then
  MODE="${1:-}"
  SERVICE="${2:-}"
  PORT="${3:-}"
  LOG_PATH="${4:-/tmp/modern-audio-enhancer/${SERVICE}.log}"

  if [ -z "$SERVICE" ] || [ -z "$PORT" ]; then
    echo "Usage: $0 $MODE <backend|frontend> <port> [log_path]" >&2
    exit 2
  fi

  if [ "$MODE" = "--run-logged" ]; then
    mkdir -p "$(dirname "$LOG_PATH")"
    : > "$LOG_PATH"
    exec >> "$LOG_PATH" 2>&1 < /dev/null
  fi

  run_service "$SERVICE" "$PORT"
fi

SERVICE="${1:-}"
PORT="${2:-}"
LOG_PATH="${3:-/tmp/modern-audio-enhancer/${SERVICE}.log}"

if [ -z "$SERVICE" ] || [ -z "$PORT" ]; then
  echo "Usage: $0 <backend|frontend> <port> [log_path]" >&2
  exit 2
fi

mkdir -p "$(dirname "$LOG_PATH")"
: > "$LOG_PATH"

resolve_service "$SERVICE" "$PORT"

{
  echo "[$(date -Is)] Launching detached $SERVICE service"
  echo "Log path: $LOG_PATH"
} >> "$LOG_PATH"

nohup "$SCRIPT_PATH" --run "$SERVICE" "$PORT" >> "$LOG_PATH" 2>&1 < /dev/null &
PID=$!
disown "$PID" 2>/dev/null || true

echo "$PID"
