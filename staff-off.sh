#!/bin/bash
# Switch a staff login off and give another staff the same role (same options). Run as root or as the site user:
#   bash /home/bikepharma/htdocs/bikepharma.com/staff-off.sh BP-RNR-MGR-001 BP-RNR-MGR-002
D="$(cd "$(dirname "$0")" && pwd)"; cd "$D" || exit 1
OWNER="$(stat -c %U "$D/data" 2>/dev/null || echo bikepharma)"
if [ "$(id -u)" = "0" ] && [ "$OWNER" != "root" ]; then exec sudo -u "$OWNER" -H bash "$D/staff-off.sh" "$@"; fi
if ! command -v node >/dev/null 2>&1; then
  for n in /usr/bin/node /usr/local/bin/node /usr/local/node*/bin/node /opt/node*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$n" ] && { export PATH="$(dirname "$n"):$PATH"; break; }
  done
fi
[ -n "$1" ] || { echo "usage: bash staff-off.sh <staff ID to switch off> [staff ID that gets the same role]"; exit 2; }
NODE_ARGS=""; node -e "require('node:sqlite')" >/dev/null 2>&1 || NODE_ARGS="--experimental-sqlite"
B="data/before-staff-off-$(date +%Y%m%d-%H%M%S).sqlite"
DBF="${DATA_DIR:-data}/bikepharma.sqlite"; [ -n "$DATA_DIR" ] && B="$DATA_DIR/$(basename "$B")"
if [ -f "$DBF" ]; then node --no-warnings $NODE_ARGS -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync(process.argv[1]).exec(\"VACUUM INTO '\"+process.argv[2]+\"'\")" "$DBF" "$B" && echo "backup: $B" || { echo "backup failed, nothing changed"; exit 1; }; fi
if [ -n "$2" ]; then node --no-warnings $NODE_ARGS admin.mjs staff-off "$1" --to "$2"; else node --no-warnings $NODE_ARGS admin.mjs staff-off "$1"; fi
