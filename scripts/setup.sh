#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/lib/env.sh"

echo "=== Modern Audio Enhancer - Setup ==="

echo "[1/4] Preparing Python environment"
activate_python_env
PYTHON_BIN="$(find_python)"

echo "[2/4] Installing backend dependencies..."
cd "$PROJECT_ROOT/backend"
"$PYTHON_BIN" -m pip install -r requirements.txt

echo "[3/4] Installing frontend dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install

echo "[4/4] Creating upload directory..."
mkdir -p /tmp/dj-eq-uploads

echo ""
echo "=== Setup Complete ==="
echo "Run: ./scripts/dev.sh"
