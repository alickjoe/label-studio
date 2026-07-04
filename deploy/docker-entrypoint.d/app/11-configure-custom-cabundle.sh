#!/bin/sh
set -e ${DEBUG:+-x}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/../common/11-configure-custom-cabundle.sh"
