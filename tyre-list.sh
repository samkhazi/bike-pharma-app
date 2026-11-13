#!/bin/bash
# Lists the front and rear tyre size of every bike from the catalogues (read only, changes nothing). Run as root or the site user:
#   bash /home/bikepharma/htdocs/bikepharma.com/tyre-list.sh
D="$(cd "$(dirname "$0")" && pwd)"; cd "$D" || exit 1
OWNER="$(stat -c %U "$D/data" 2>/dev/null || echo bikepharma)"
if [ "$(id -u)" = "0" ] && [ "$OWNER" != "root" ]; then exec sudo -u "$OWNER" -H bash "$D/tyre-list.sh" "$@"; fi
if ! command -v node >/dev/null 2>&1; then
  for n in /usr/bin/node /usr/local/bin/node /usr/local/node*/bin/node /opt/node*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$n" ] && { export PATH="$(dirname "$n"):$PATH"; break; }
  done
fi
C="${DATA_DIR:-data}/cat"
node --no-warnings tools/tyre_list.mjs "$C" "${DATA_DIR:-data}/tyre-list.csv"
