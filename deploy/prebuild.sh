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

echo "=> Create production bundle..."
cd ${SCRIPT_DIR}/../web
# Only install if node_modules is missing/incomplete. Re-running
# `yarn install --frozen-lockfile` on Windows can wipe node_modules/.bin (a known
# yarn 1.x issue) and leave nx unavailable. When a full reinstall is needed,
# plain `yarn install` (without --frozen-lockfile) is more reliable on Windows.
if [ ! -x node_modules/.bin/nx ] && [ ! -f node_modules/.bin/nx.cmd ]; then
    yarn install
fi
# Set NODE_ENV explicitly and call `ls:build` directly instead of `yarn build`,
# because the `build` script in web/package.json uses `NODE_ENV=production yarn ls:build`
# which relies on Unix-style inline env vars that do not work under Windows cmd.exe.
export NODE_ENV=production
yarn ls:build
# Optional: regenerate per-library version.json files (requires .git access)
# yarn version:libs
cd ${SCRIPT_DIR}

MANAGE=${SCRIPT_DIR}/../label_studio/manage.py

echo "=> Collect static..."
$PYTHON $MANAGE collectstatic --no-input

echo "=> Create version file..."
$PYTHON ${SCRIPT_DIR}/../label_studio/core/version.py
