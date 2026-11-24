#!/usr/bin/env bash
# Bike Surgeon customer app: takes the newest code from GitHub, builds it and switches the running app to it.
# Runs as the site user: every 5 minutes from cron, and once from setup.sh. setup.sh copies it to ~/update.sh.
# A build that fails, or a new version that does not start, leaves the running app as it was.
# Folders: ~/repo (code from GitHub), ~/releases/<time>-<commit> (builds), ~/current (the running build), ~/shared/.env
main() {
set -euo pipefail
H=$HOME
ENV_FILE=$H/shared/.env
BIN=$(ls -d "$H"/.nvm/versions/node/v22*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$BIN" ] || { log "Node 22 not found in ~/.nvm"; return 1; }
export PATH="$BIN:/usr/local/bin:/usr/bin:/bin"
renice -n 10 $$ >/dev/null 2>&1 || true

exec 9>"$H/.update.lock"
flock -n 9 || return 0
if [ -f "$H/logs/update.log" ] && [ "$(stat -c %s "$H/logs/update.log")" -gt 5000000 ]; then
  tail -n 2000 "$H/logs/update.log" > "$H/logs/update.log.tmp" && mv "$H/logs/update.log.tmp" "$H/logs/update.log"
fi

cd "$H/repo"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git fetch -q --depth 1 origin "$BRANCH"
NEW=$(git rev-parse FETCH_HEAD)
CUR=$(cat "$H/current/.commit" 2>/dev/null || echo none)
FORCE=${FORCE:-0}
[ "$NEW" != "$CUR" ] || [ "$FORCE" = 1 ] || return 0
[ "$(cat "$H/.failed" 2>/dev/null || true)" != "$NEW" ] || [ "$FORCE" = 1 ] || return 0
git reset -q --hard "$NEW"

# Only the app's screens, screenshots, docs or the API description changed: nothing to build here (the Android app is
# built on GitHub). This script itself is still updated.
if [ "$FORCE" != 1 ] && [ -d "$H/current" ] && git cat-file -e "$CUR^{commit}" 2>/dev/null \
  && git diff --quiet "$CUR" "$NEW" -- app-backend downloads ':(exclude)app-backend/openapi.json'; then
  echo "$NEW" > "$H/current/.commit"
  self_update
  log "${NEW:0:7}: no server changes, nothing to build"
  return 0
fi

log "${NEW:0:7}: building"
REL="$H/releases/$(date +%Y%m%d-%H%M%S)-${NEW:0:7}"
SWITCHED=0
trap 'on_exit' EXIT
mkdir -p "$REL"
git archive "$NEW" | tar -x -C "$REL"
ln -s "$ENV_FILE" "$REL/app-backend/.env"
( cd "$REL/app-backend" && npm ci --no-audit --no-fund --loglevel=error && npm run -s build )
# No web app: the server only offers the Android app built on GitHub, at /download/bike-surgeon.apk
mkdir -p "$REL/public/download"
[ ! -f "$REL/downloads/bike-surgeon.apk" ] || cp "$REL/downloads/bike-surgeon.apk" "$REL/public/download/bike-surgeon.apk"
( cd "$REL/app-backend" && npm run -s db:migrate )
# The first build also loads the reference data (workshop, services, offers). Safe to run again.
[ -e "$H/current" ] || ( cd "$REL/app-backend" && npm run -s db:seed )

PREV=$(readlink -f "$H/current" 2>/dev/null || true)
echo "$NEW" > "$REL/.commit"
point_current_to "$REL"
start_app "$REL"
if ! wait_ready; then
  log "${NEW:0:7}: the new version did not start:"
  pm2 logs bs-app --lines 25 --nostream 2>/dev/null | tail -n 25 || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    point_current_to "$PREV"
    start_app "$PREV"
    log "back on the previous version $(cat "$PREV/.commit" 2>/dev/null | cut -c1-7)"
  fi
  return 1
fi
SWITCHED=1
pm2 save --force >/dev/null
rm -f "$H/.failed"
# keep the running build and the two before it
for dir in $(ls -1dt "$H"/releases/*/ 2>/dev/null | tail -n +4); do
  [ "${dir%/}" = "$(readlink -f "$H/current")" ] || rm -rf "${dir%/}"
done
self_update
log "${NEW:0:7}: running"
}

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

on_exit() {
  local rc=$?
  if [ "${SWITCHED:-0}" != 1 ] && [ -n "${REL:-}" ]; then
    [ "$(readlink -f "$H/current" 2>/dev/null)" = "$REL" ] || rm -rf "$REL"
    echo "$NEW" > "$H/.failed"
    log "${NEW:0:7}: update FAILED, the app keeps running the version it had (tried again when a newer commit comes)"
  fi
  return $rc
}

# the next run uses this version of the script (a new file, so this running copy is not touched)
self_update() { cp "$H/repo/scripts/server/update.sh" "$H/update.sh.new" && chmod 700 "$H/update.sh.new" && mv -f "$H/update.sh.new" "$H/update.sh"; }

point_current_to() { ln -sfn "$1" "$H/current.new" && mv -Tf "$H/current.new" "$H/current"; }

start_app() {
  pm2 delete bs-app >/dev/null 2>&1 || true
  pm2 start "$1/app-backend/dist/src/index.js" --name bs-app --cwd "$1/app-backend" \
    --node-args="--env-file=$ENV_FILE" --time >/dev/null
}

wait_ready() {
  local port; port=$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -1)
  for _ in $(seq 1 45); do
    curl -fsS "http://127.0.0.1:${port:-3050}/health/ready" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

main "$@"; exit $?
