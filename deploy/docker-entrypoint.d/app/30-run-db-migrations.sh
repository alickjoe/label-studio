#!/bin/sh
set -e ${DEBUG:+-x}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/../common/30-run-db-migrations.sh"
