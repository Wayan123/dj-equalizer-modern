#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Cleaning generated artifacts..."

paths=(
  "$PROJECT_ROOT/frontend/src-tauri/target"
  "$PROJECT_ROOT/frontend/dist"
  "$PROJECT_ROOT/frontend/.vite"
  "$PROJECT_ROOT/.pytest_cache"
)

for path in "${paths[@]}"; do
  if [ -e "$path" ]; then
    rm -rf "$path"
  fi
done

if [ -d "$PROJECT_ROOT/backend" ]; then
  find "$PROJECT_ROOT/backend" -type d -name '__pycache__' -exec rm -rf {} +
fi

if [ -d "$PROJECT_ROOT/tests" ]; then
  find "$PROJECT_ROOT/tests" -type d -name '__pycache__' -exec rm -rf {} +
fi

find "$PROJECT_ROOT" -type f \( \
  -name '*.pyc' -o \
  -name '*.pyo' -o \
  -name '*.pyd' -o \
  -name 'Zone.Identifier' -o \
  -name '*:Zone.Identifier' \
\) -delete

echo "Clean complete."
