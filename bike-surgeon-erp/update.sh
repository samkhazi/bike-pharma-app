#!/bin/bash
# Bike Surgeon ERP 2.0 (panel.bikesurgeon.online): update from GitHub. Run as root on the Bike Surgeon server.
# First time (or any time):
#   curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/bike-surgeon-erp/update.sh -o /root/bs-erp-update.sh && bash /root/bs-erp-update.sh
# After that:   bash /root/bs-erp-update.sh            (it takes the newest code from GitHub by itself)
#               bash /root/bs-erp-update.sh old-off    (older role-email staff logins off, once everyone uses their own)
#               bash /root/bs-erp-update.sh undo       (logins back as before the last update; again = one more back)
#               bash /root/bs-erp-update.sh names      (the name-wise logins again from the attendance app; passwords + PINs kept)
# 27 Nov update: the new sign-in page (the shop in 3D). An update changes the code only: once the name-wise logins
# are there, the logins are not touched (everyone keeps their password and PIN; the Logins screen keeps its changes).
# 26 Nov update, name-wise logins (Sam): every staff member gets their OWN login (mobile number + password) and is their
# own person, with their own PIN, inside every panel of their role: the same names and roles as in Saddam sir's panels.
# The mobile numbers are read from the attendance app (only read). The front door also takes a mobile number at sign in.
# New passwords and PINs go ONLY to /root/bikesurgeon-staff-logins.txt (never printed here). The older logins
# (misba@gmail.com ...) keep working, now as the real person, so nobody is locked out.
# Before any change every database is copied to /root/bikesurgeon-backup-names-<time>/.
set -u
REPO_URL=${REPO_URL:-https://github.com/samkhazi/bike-pharma-app.git}
BRANCH=${BRANCH:-claude/project-thread-vczbd1}
SRC=/root/bike-surgeon-erp-src           # the code from GitHub (only root can read it)
ME=/root/bs-erp-update.sh
PANEL=/home/bikesurgeon-panel/htdocs/panel.bikesurgeon.online
INV=/home/bikesurgeon-inventory/htdocs/inventory.bikesurgeon.online
FD=$PANEL/front-door
OUT=/root/bikesurgeon-staff-logins.txt
ATTCFG=/home/bikesurgeon-billing/attendance-private/config.php
PU=bikesurgeon-panel
MODE=${1:-}

[ "$(id -u)" = 0 ] || { echo "Run this as root (type su - first, then this line). Nothing changed."; exit 1; }
case "$MODE" in ""|undo|old-off|names) ;; *) echo "Unknown word: $MODE (use nothing, names, undo or old-off). Nothing changed."; exit 1;; esac

# ---- 0. the newest code from GitHub; a newer copy of this script takes over --------------------------------------------
if [ "${BS_ERP_FRESH:-}" != 1 ]; then
  command -v git >/dev/null || { echo "git not found. Nothing changed."; exit 1; }
  umask 077
  if [ -d "$SRC/.git" ]; then
    git -C "$SRC" fetch -q --depth 1 origin "$BRANCH" && git -C "$SRC" reset -q --hard FETCH_HEAD
  else
    rm -rf "$SRC" && git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$SRC"
  fi
  GOT=$?
  umask 022
  if [ $GOT != 0 ] || [ ! -f "$SRC/bike-surgeon-erp/update.sh" ]; then
    [ -z "$MODE" ] && { echo "The code could not be downloaded from GitHub. Nothing changed. Try again in a few minutes."; exit 1; }
    echo "(GitHub not reachable: $MODE runs with the code already on this server.)"
  elif [ "$(readlink -f "$0")" != "$ME" ] || ! cmp -s "$0" "$SRC/bike-surgeon-erp/update.sh"; then   # always runs as the newest $ME
    cp "$SRC/bike-surgeon-erp/update.sh" "$ME.new" && chmod 700 "$ME.new" && mv -f "$ME.new" "$ME" \
      && BS_ERP_FRESH=1 exec bash "$ME" "$@"
    echo "This script could not be renewed in /root. Nothing changed."; exit 1
  fi
fi
CODE=$SRC/bike-surgeon-erp
case "$MODE" in ""|names) echo "Code from GitHub: $(TZ=Asia/Kolkata git -C "$SRC" log -1 --format='%h, %cd' --date=format-local:'%d %b %H:%M IST' 2>/dev/null)";; esac

B=$(ls -d /home/$PU/.nvm/versions/node/v22*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$B" ] && [ -x "$B/node" ] || { echo "Node 22 of the panel site not found. Nothing changed."; exit 1; }
[ -f "$FD/server/index.js" ] && [ -f "$FD/.env" ] || { echo "Front door folder not found ($FD). Nothing changed."; exit 1; }
grep -q '^GATE_KEY=.' "$FD/.env" || { echo "GATE_KEY is missing in the front door .env. Nothing changed."; exit 1; }
NODE="export PATH=$B:\$PATH"
check() { su - "$PU" -c "$NODE; cd $FD && node --env-file=.env --disable-warning=ExperimentalWarning tools/check-all.js --short"; }
# the backups of updates that changed logins (they have a manifest) and are not undone yet, newest first
backups() { for d in $(ls -d /root/bikesurgeon-backup-names-* 2>/dev/null | grep -v -- '-undone$' | sort -r); do [ -f "$d/manifest.json" ] && echo "$d"; done; }

if [ "$MODE" = old-off ]; then
  [ -f "$FD/tools/name-logins.js" ] || { echo "Run the update first. Nothing changed."; exit 1; }
  (cd "$FD" && "$B/node" --env-file=.env --disable-warning=ExperimentalWarning tools/name-logins.js --old-off); exit $?
fi
if [ "$MODE" = undo ]; then
  BK=$(backups | head -1)
  [ -n "$BK" ] || { echo "No backup found in /root. Nothing changed."; exit 1; }
  [ -f "$FD/tools/name-logins.js" ] || { echo "The name-wise login tool is not in the front door. Nothing changed."; exit 1; }
  echo "== Undo from $BK"
  (cd "$FD" && "$B/node" --env-file=.env --disable-warning=ExperimentalWarning tools/name-logins.js --undo "$BK" --out "$OUT"); U=$?
  [ $U = 0 ] && mv "$BK" "$BK-undone"   # used: a next undo goes one more update back
  echo "== Check of every login"
  check
  if [ $U = 0 ]; then echo "Undo done: the logins are as they were before that update."
    [ -n "$(backups)" ] && echo "(An older update has a backup too: undo again goes one more update back.)"
  else echo "Something failed: send me a screenshot of this."; fi
  exit $U
fi

[ -f "$CODE/front-door/tools/name-logins.js" ] && [ -f "$CODE/front-door/server/index.js" ] || { echo "The front door code is not in the download. Nothing changed."; exit 1; }
T=$(mktemp -d); chmod 700 "$T"; trap 'rm -rf "$T"' EXIT

# folder of the app on a port (from its running process), else the usual folder
pidof_port() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2; }
dirof() { local pid d; pid=$(pidof_port "$1"); [ -n "$pid" ] && d=$(readlink -f "/proc/$pid/cwd" 2>/dev/null) && [ -f "$d/server/index.js" ] && { echo "$d"; return; }
  [ -f "$2/server/index.js" ] && echo "$2"; }

# the name-wise logins run only the first time (no name-wise login yet) or when asked (names); else the logins stay as they are
NAMED=$(cd "$FD" && "$B/node" --env-file=.env --disable-warning=ExperimentalWarning -e '
  const { DatabaseSync } = require("node:sqlite");
  const D = new DatabaseSync(process.env.DB_FILE || "data/front.db", { readOnly: true });
  try { const has = D.prepare("PRAGMA table_info(logins)").all().some(c => c.name === "person");
    console.log(has ? D.prepare("SELECT COUNT(*) AS n FROM logins WHERE person IS NOT NULL").get().n : 0); } finally { D.close(); }' 2>/dev/null)
RUN_NAMES=0; { [ "$MODE" = names ] || [ "$NAMED" = 0 ]; } && RUN_NAMES=1
if [ $RUN_NAMES = 1 ]; then
  [ -f "$ATTCFG" ] || { echo "The attendance app settings were not found ($ATTCFG). Nothing changed."; exit 1; }
  PHP="$(command -v php || ls /usr/bin/php8* /usr/bin/php7* 2>/dev/null | sort -V | tail -1)"
  [ -n "$PHP" ] || { echo "php not found. Nothing changed."; exit 1; }
  echo "== 1. Staff list of the attendance app (only read)"
  "$PHP" "$CODE/front-door/tools/att-people.php" "$ATTCFG" > "$T/people.json" 2> "$T/php.err" && [ -s "$T/people.json" ] \
    || { echo "The attendance staff list could not be read: $(head -c 200 "$T/php.err"). Nothing changed."; exit 1; }
  "$B/node" -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(!(j.users||[]).length)process.exit(1);console.log(`OK      ${j.users.length} staff, ${(j.admins||[]).length} admin users`)' "$T/people.json" \
    || { echo "The attendance staff list is empty. Nothing changed."; exit 1; }
elif [ -n "$NAMED" ]; then
  echo "== 1. Logins: not changed ($NAMED name-wise logins are there; everyone keeps their password and PIN)"
else
  echo "== 1. Logins: not changed (to make the name-wise logins again:  bash $ME names )"
fi

echo "== 2. Panels"
J="{"; MISS=0
for x in "admin:$PANEL:3040" "cashier:$PANEL/portals/03-cashier:3023" "counter:$PANEL/portals/04-counter-staff:3024" \
  "desk:$PANEL/portals/05-workshop-desk-saniya:3025" "floor:$PANEL/portals/06-floor-manager:3026" "maintainer:$PANEL/portals/07-spares-maintainer:3027" \
  "spares:$PANEL/portals/08-spares-manager:3028" "supervisor:$PANEL/portals/09-supervisor:3029" "accounts:$PANEL/portals/02-accountant-panel:3030" \
  "motolab:$PANEL/portals/11-moto-lab:3031" "inventory:$INV:3021"; do
  IFS=: read -r k d p <<<"$x"; f=$(dirof "$p" "$d")
  if [ -n "$f" ]; then echo "OK      $k: $f"; J="$J\"$k\":\"$f\","; else echo "MISSING $k (port $p)"; MISS=1; fi
done
printf '%s}\n' "${J%,}" > "$T/dirs.json"

echo "== 3. Front door: the new code (sign-in page, one screen)"
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/bikesurgeon-backup-names-$STAMP; [ $RUN_NAMES = 1 ] || BK=/root/bikesurgeon-backup-code-$STAMP
mkdir -p "$BK" && chmod 700 "$BK"
tar -C "$FD" --exclude=./data --exclude=./node_modules -czf "$BK/front-door-code.tgz" . && chmod 600 "$BK/front-door-code.tgz" \
  || { echo "The front door code could not be copied to $BK. Nothing changed."; exit 1; }
OLDPID=$(pidof_port 3022)
cp -r "$CODE/front-door/." "$FD/" && chown -R "$PU:" "$FD/server" "$FD/public" "$FD/tools" "$FD/tests" "$FD/package.json" "$FD/README.md"
su - "$PU" -c "$NODE; cd $PANEL && npx pm2 restart front-door >/dev/null" || echo "FAILED  restart of the front door"
UP=0; for i in $(seq 1 30); do NEWPID=$(pidof_port 3022)
  if [ -n "$NEWPID" ] && [ "$NEWPID" != "$OLDPID" ] && curl -s -m 3 http://127.0.0.1:3022/__gate/login | grep -q 'Mobile number or email'; then UP=1; break; fi; sleep 1; done
if [ $UP != 1 ]; then
  echo "FAILED  the new front door did not start: the old one is put back. Logins not changed."
  tar -C "$FD" -xzf "$BK/front-door-code.tgz" && chown -R "$PU:" "$FD/server" "$FD/public" "$FD/tools"
  su - "$PU" -c "$NODE; cd $PANEL && npx pm2 restart front-door >/dev/null"
  echo "Send me a screenshot of this."; exit 1
fi
echo "OK      front door restarted with the new code"

N=0
if [ $RUN_NAMES = 1 ]; then
  echo "== 4. Name-wise logins (backup first: $BK)"
  (cd "$FD" && "$B/node" --env-file=.env --disable-warning=ExperimentalWarning tools/name-logins.js --people "$T/people.json" --dirs "$T/dirs.json" --out "$OUT" --backup "$BK"); N=$?
fi
rm -rf "$T"

echo "== 5. Check of every login"
check; C=$?

echo
if [ $RUN_NAMES = 1 ]; then
  case $N in
    0|2) echo "New passwords and PINs (if any): $OUT   (see them with:  cat $OUT )"
         echo "Send each person ONLY their own part. Never post this file or a photo of it in a chat."
         echo "The older logins keep working. When everyone uses the new one:  bash $ME old-off";;
    1) echo "The logins were NOT changed (see the STOP line above). Only the front door code is new.";;
    *) echo "The logins were NOT changed: an error put everything back (see the FAILED line above).";;
  esac
  echo "Backup: $BK   (undo:  bash $ME undo )"
else
  echo "Logins not changed: everyone keeps their password and PIN. Front door code backup: $BK"
fi
[ $N = 0 ] && [ $C = 0 ] && [ $MISS = 0 ] && echo "All done." || echo "Something failed: send me a screenshot of this (it shows no passwords)."
