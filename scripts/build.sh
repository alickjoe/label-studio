#!/usr/bin/env bash
# 一键生产环境编译打包脚本
# 完整流程：前端构建 → collectstatic → version.py → poetry build → twine check
#
# 用法:
#   ./scripts/build.sh                  # 完整构建（含前端）
#   ./scripts/build.sh --skip-frontend  # 跳过前端构建（仅刷新静态资源 + 版本 + 打包）
#   VERSION_OVERRIDE=1.24.0 ./scripts/build.sh   # 指定版本号
#   BRANCH_OVERRIDE=main ./scripts/build.sh       # 指定分支名
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$ROOT"

# --- 选项解析 ---
SKIP_FRONTEND=0
for arg in "$@"; do
    case "$arg" in
        --skip-frontend|-s) SKIP_FRONTEND=1 ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

# --- 环境检查 ---
if ! command -v poetry >/dev/null 2>&1; then
    echo "Error: poetry not found in PATH." >&2
    echo "  Install: https://python-poetry.org/docs/#installation" >&2
    echo "  Or add Poetry's bin dir to PATH (e.g. ~/.bashrc on Windows Git Bash):" >&2
    echo "    export PATH=\"\$PATH:/c/Users/\$USER/AppData/Roaming/Python/Python<ver>/Scripts\"" >&2
    exit 1
fi

echo "==> Production build for label-studio"
echo "    root: $ROOT"
[ -n "$VERSION_OVERRIDE" ] && echo "    version override: $VERSION_OVERRIDE"
[ -n "$BRANCH_OVERRIDE" ] && echo "    branch override: $BRANCH_OVERRIDE"
echo ""

# --- Step 1: Prebuild (frontend + collectstatic + version) ---
if [ "$SKIP_FRONTEND" = "1" ]; then
    echo "==> [1/4] Prebuild (skip frontend)"
    bash "$ROOT/deploy/prebuild_wo_frontend.sh"
else
    echo "==> [1/4] Prebuild (frontend + collectstatic + version)"
    bash "$ROOT/deploy/prebuild.sh"
fi
echo ""

# --- Step 2: Build sdist + wheel ---
echo "==> [2/4] Build sdist + wheel"
rm -rf "$ROOT/dist"
poetry build
echo ""

# --- Step 3: Check metadata ---
echo "==> [3/4] Twine check (metadata validation)"
poetry run twine check "$ROOT"/dist/*
echo ""

# --- Step 4: Summary ---
echo "==> [4/4] Build artifacts"
echo ""
ls -lh "$ROOT"/dist/
echo ""
TOTAL=$(du -ch "$ROOT"/dist/* 2>/dev/null | tail -1 | cut -f1)
echo "==> Build complete."
echo "    total size: $TOTAL"
echo "    artifacts:  $(ls "$ROOT"/dist/ | wc -l) file(s)"
echo ""
echo "Install:"
echo "  pip install ./dist/label_studio-*.whl"
echo "  pip install ./dist/label_studio-*.whl[uwsgi]   # with uWSGI"
