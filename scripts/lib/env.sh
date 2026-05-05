#!/usr/bin/env bash

find_python() {
  if command -v python >/dev/null 2>&1; then
    command -v python
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi

  echo "ERROR: python or python3 is required." >&2
  return 1
}

initialize_conda() {
  if [ -n "${CONDA_SHLVL:-}" ]; then
    return 0
  fi

  if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
    # shellcheck disable=SC1090
    source "$HOME/miniconda3/etc/profile.d/conda.sh"
    return 0
  fi

  if [ -f "$HOME/miniconda3/bin/activate" ]; then
    # shellcheck disable=SC1091
    source "$HOME/miniconda3/bin/activate"
    return 0
  fi

  return 1
}

activate_python_env() {
  local env_name="${DJ_EQ_CONDA_ENV:-info-ai}"
  local root="${PROJECT_ROOT:-$(pwd)}"

  if initialize_conda >/dev/null 2>&1; then
    if conda env list | awk 'NF && $1 !~ /^#/ {print $1}' | grep -qx "$env_name"; then
      conda activate "$env_name"
      echo "Using conda environment: $env_name"
      return 0
    fi
  fi

  if [ -f "$root/.venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source "$root/.venv/bin/activate"
    echo "Using Python virtual environment: $root/.venv"
    return 0
  fi

  echo "Using current Python environment. Set DJ_EQ_CONDA_ENV=$env_name or create .venv to auto-activate one."
}
