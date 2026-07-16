#!/usr/bin/env bash
# Clean build artifacts, caches, and optionally dependencies.
#
# Usage:
#   ./scripts/clean.sh           # default: light (caches + logs only)
#   ./scripts/clean.sh light     # caches + logs
#   ./scripts/clean.sh mid       # + build artifacts (need rebuild to release)
#   ./scripts/clean.sh deep      # + dependencies (need reinstall to build)
#   ./scripts/clean.sh all       # alias for deep
set -e

LEVEL=${1:-light}
case "$LEVEL" in
    light|mid|deep|all) ;;
    *)
        echo "Usage: $0 [light|mid|deep|all]"
        echo "  light (default) - remove caches and logs only"
        echo "  mid             - also remove build artifacts (rebuild needed)"
        echo "  deep|all        - also remove dependencies (reinstall needed)"
        exit 1
        ;;
esac
[ "$LEVEL" = "all" ] && LEVEL=deep

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$ROOT"

count=0
rm_step () {
    local target="$1"
    local label="${2:-$target}"
    if [ -e "$target" ]; then
        # Use `|| true` pattern so "Device or resource busy" (e.g. Nx SQLite
        # lock files held by a running dev server) does not abort the script.
        if rm -rf "$target" 2>/dev/null; then
            printf "  removed  %s\n" "$label"
            count=$((count + 1))
        else
            printf "  skipped  %s (in use — close dev servers/editors and retry)\n" "$label"
        fi
    fi
}

echo "=> Cleaning (level: $LEVEL)"

# --- Level 1: caches + logs (always) ---
echo "  [caches & logs]"
# Python bytecode caches (skip .git and web/node_modules)
find . -type d -name "__pycache__" \
    -not -path "./.git/*" \
    -not -path "./web/node_modules/*" \
    -exec rm -rf {} + 2>/dev/null || true
# Tool caches
rm_step ".pytest_cache" ".pytest_cache"
rm_step ".ruff_cache"   ".ruff_cache"
rm_step ".mypy_cache"   ".mypy_cache"
rm_step ".nx"           ".nx"
# Build logs
rm_step "*.log"         "*.log"
# Nx / webpack caches inside node_modules
rm_step "web/.nx"                 "web/.nx"
rm_step "web/node_modules/.cache" "web/node_modules/.cache"
# Python packaging output (regenerable via `poetry build`)
rm_step "dist"                    "dist/ (wheel + sdist)"

# --- Level 2: build artifacts ---
if [ "$LEVEL" = "mid" ] || [ "$LEVEL" = "deep" ]; then
    echo "  [build artifacts]"
    rm_step "build"                             "build/"
    rm_step "*.egg-info"                        "*.egg-info"
    rm_step "label_studio.egg-info"             "label_studio.egg-info"
    rm_step "label_studio/label_studio.egg-info" "label_studio/label_studio.egg-info"
    rm_step "web/dist"                          "web/dist/"
    rm_step "label_studio/core/static_build"    "label_studio/core/static_build/"
    rm_step "label_studio/core/version_.py"     "label_studio/core/version_.py"
    rm_step "label_studio/core/ls-version_.py"  "label_studio/core/ls-version_.py"
    rm_step "web/dist/apps/labelstudio"          "(checked via web/dist above)"
fi

# --- Level 3: dependencies ---
if [ "$LEVEL" = "deep" ]; then
    echo "  [dependencies]"
    rm_step "web/node_modules" "web/node_modules/ (~1-2GB)"
    # Remove poetry virtualenv (project-local if any)
    if command -v poetry >/dev/null 2>&1; then
        echo "  removing poetry virtualenv(s)..."
        poetry env remove --all 2>/dev/null || echo "    (no venv to remove or poetry env list empty)"
    fi
fi

echo "=> Done. $count item(s) removed."
if [ "$LEVEL" = "mid" ] || [ "$LEVEL" = "deep" ]; then
    echo ""
    echo "Rebuild:"
    echo "  ./deploy/prebuild.sh && poetry build"
fi
if [ "$LEVEL" = "deep" ]; then
    echo "Reinstall dependencies first:"
    echo "  poetry install"
    echo "  cd web && yarn install && cd .."
fi
