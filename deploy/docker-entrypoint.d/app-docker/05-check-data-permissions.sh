#!/bin/sh
set -e ${DEBUG:+-x}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/../common/05-check-data-permissions.sh"
