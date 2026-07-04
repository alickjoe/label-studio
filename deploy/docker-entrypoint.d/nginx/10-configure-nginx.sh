#!/bin/sh
set -e ${DEBUG:+-x}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/../common/10-configure-nginx.sh"
