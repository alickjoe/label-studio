#!/usr/bin/env bash
set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
echo "SCRIPT_DIR: ${SCRIPT_DIR}"

# Determine how to invoke Python. Prefer `poetry run python` so that Django and
# other dependencies from pyproject.toml are available. Fall back to `python3` /
# `python` when poetry is not on PATH (e.g. inside a container that already
# activated the venv).
if command -v poetry >/dev/null 2>&1; then
    PYTHON="poetry run python"
elif python3 --version >/dev/null 2>&1; then
    PYTHON=python3
elif python --version >/dev/null 2>&1; then
    PYTHON=python
else
    echo "Error: No python interpreter found (tried poetry, python3, python)" >&2
    exit 1
fi

MANAGE=${SCRIPT_DIR}/../label_studio/manage.py

echo "=> Collect static..."
$PYTHON $MANAGE collectstatic --no-input

echo "=> Create version file..."
$PYTHON ${SCRIPT_DIR}/../label_studio/core/version.py
