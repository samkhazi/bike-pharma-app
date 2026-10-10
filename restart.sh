#!/usr/bin/env bash
# bikepharma app ko pm2 se (re)start karo. Site user se chalta hai (update.sh khud chalata hai).
cd "$(dirname "$(readlink -f "$0")")"
if ! command -v node >/dev/null 2>&1; then
  for n in /usr/bin/node /usr/local/bin/node /usr/local/node*/bin/node /opt/node*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$n" ]; then export PATH="$(dirname "$n"):$PATH"; break; fi
  done
fi
PM2=./node_modules/.bin/pm2
if [ ! -x "$PM2" ]; then echo "pm2 nahi mila: pehle  bash install.sh  chalao"; exit 1; fi
if "$PM2" jlist 2>/dev/null | grep -q '"name":"bikepharma"'; then
  "$PM2" restart bikepharma >/dev/null
else
  NODE_ARGS=""; node -e "require('node:sqlite')" >/dev/null 2>&1 || NODE_ARGS="--experimental-sqlite"
  NODE_ARGS="$NODE_ARGS" "$PM2" start ecosystem.config.cjs >/dev/null
fi
"$PM2" save >/dev/null 2>&1 || true
"$PM2" status bikepharma 2>/dev/null | grep -E "bikepharma" | head -1 || true
