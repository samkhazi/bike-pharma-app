#!/bin/bash
# Shows what the cross-brand file holds for the given part numbers (read only, changes nothing). Run as root or the site user:
#   bash /home/bikepharma/htdocs/bikepharma.com/xref-look.sh
D="$(cd "$(dirname "$0")" && pwd)"; cd "$D" || exit 1
OWNER="$(stat -c %U "$D/data" 2>/dev/null || echo bikepharma)"
if [ "$(id -u)" = "0" ] && [ "$OWNER" != "root" ]; then exec sudo -u "$OWNER" -H bash "$D/xref-look.sh" "$@"; fi
if ! command -v node >/dev/null 2>&1; then
  for n in /usr/bin/node /usr/local/bin/node /usr/local/node*/bin/node /opt/node*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$n" ] && { export PATH="$(dirname "$n"):$PATH"; break; }
  done
fi
C="${DATA_DIR:-data}/cat"

node --no-warnings tools/xref_look.mjs "$C" "$@"
