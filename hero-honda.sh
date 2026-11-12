#!/bin/bash
# Lists Hero and Honda part numbers that are the same or differ only at the end (read only, changes nothing). Run as root or the site user:
#   bash /home/bikepharma/htdocs/bikepharma.com/hero-honda.sh
D="$(cd "$(dirname "$0")" && pwd)"; cd "$D" || exit 1
OWNER="$(stat -c %U "$D/data" 2>/dev/null || echo bikepharma)"
if [ "$(id -u)" = "0" ] && [ "$OWNER" != "root" ]; then exec sudo -u "$OWNER" -H bash "$D/hero-honda.sh" "$@"; fi
if ! command -v node >/dev/null 2>&1; then
  for n in /usr/bin/node /usr/local/bin/node /usr/local/node*/bin/node /opt/node*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$n" ] && { export PATH="$(dirname "$n"):$PATH"; break; }
  done
fi
C="${DATA_DIR:-data}/cat"
for f in hero honda; do [ -f "$C/$f.json" ] || { echo "$C/$f.json nahi mila"; exit 1; }; done
node --no-warnings tools/hero_honda_compare.mjs "$C" "${DATA_DIR:-data}/hero-honda-compare.csv"
