#!/bin/bash
set -u

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILURES=0

run_step() {
  local name="$1"
  shift
  echo ""
  echo "== $name =="
  if "$@"; then
    echo "OK: $name"
  else
    echo "FAILED: $name"
    FAILURES=$((FAILURES + 1))
  fi
}

run_step "Frontend build" bash -lc "cd '$PROJECT_ROOT/frontend' && npm run build"
run_step "Tauri cargo check" bash -lc "cd '$PROJECT_ROOT/frontend/src-tauri' && cargo check"
run_step "Frontend tests" bash -lc "cd '$PROJECT_ROOT/frontend' && npm test -- --run"
run_step "Backend tests" bash -lc "cd '$PROJECT_ROOT' && source scripts/lib/env.sh && activate_python_env && PYTHONPATH=backend pytest -q tests/backend -m 'not integration'"

if [ "${RUN_WINDOWS_PREFLIGHT:-0}" = "1" ] && command -v powershell.exe >/dev/null 2>&1; then
  PS_SCRIPT="$(wslpath -w "$PROJECT_ROOT/scripts/build-windows-exe.ps1")"
  run_step "Windows EXE preflight" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PS_SCRIPT" -PreflightOnly
else
  echo ""
  echo "SKIP: Windows EXE preflight (set RUN_WINDOWS_PREFLIGHT=1 to enable)"
fi

echo ""
echo "== Release artifacts =="
find "$PROJECT_ROOT/release" -maxdepth 3 -type f 2>/dev/null | sort || true

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "Diagnosis complete: all checks passed."
else
  echo "Diagnosis complete: $FAILURES check(s) failed."
fi

exit "$FAILURES"
