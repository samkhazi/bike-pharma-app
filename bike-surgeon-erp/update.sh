#!/bin/bash
# Bike Surgeon ERP 2.0 (panel.bikesurgeon.online): update from GitHub. Run as root on the Bike Surgeon server.
# First time (or any time):
#   curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/bike-surgeon-erp/update.sh -o /root/bs-erp-update.sh && bash /root/bs-erp-update.sh
# After that:   bash /root/bs-erp-update.sh            (it takes the newest code from GitHub by itself)
#               bash /root/bs-erp-update.sh old-off    (older role-email staff logins off, once everyone uses their own)
#               bash /root/bs-erp-update.sh undo       (logins back as before the last update; again = one more back)
#               bash /root/bs-erp-update.sh names      (the name-wise logins again from the attendance app; passwords + PINs kept)
# 27 Nov update 4 (Sam: "I need instant"): the admin panel checks the Bike Surgeon billing's database every 3 seconds (a
# checksum of each table; only a changed table is read again) and the Cashier asks the admin panel every 3 seconds, so a
# new bill or job card shows within seconds there and on the open screens. If the quick check cannot be used, it reads
# everything every minute as before. A file is replaced only when it is the 26 or 27 Nov one; a failure puts it back.
# Every Bike Surgeon bill is now worked out exactly like the billing itself (its own bill calculation of 28 Oct: line
# discounts, labour rate card, free service, special discount, coupon, wallet, advance, split with card): checked on all
# 5,513 bills, 1,927 Moto Lab bills and the billing's Sales Report for 34 date ranges, equal to the paisa.
# 27 Nov update 3 (Sam: "direct connect database only, I need instant"): the Moto Lab panel reads the Moto Lab billing's
# database itself (read only, the admin panel's database lines are copied into its .env), a checksum check every 3 seconds;
# a new bill shows on the open screens within seconds. If it cannot read the database, it keeps the admin panel's feed.
# 27 Nov update 2 (Sam: "all data live, Moto Lab connected"): Mehek's Moto Lab panel shows the real items, bills and
# customers of the Moto Lab billing site (themotolab), read by the admin panel every minute (worked out exactly like the
# billing). Bills, returns and stock in are still made in the billing site; orders with advance, warranty claims, the
# purchase budget, rack counts, sizes and the day closing are made in the panel. It goes into the menu once it shows the
# real bills. A file of the admin or Moto Lab panel is replaced only when it is the 26 Nov one; if anything fails, the
# old code goes back by itself.
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

STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/bikesurgeon-backup-names-$STAMP; [ $RUN_NAMES = 1 ] || BK=/root/bikesurgeon-backup-code-$STAMP
mkdir -p "$BK" && chmod 700 "$BK"

echo "== 3. Admin panel and Moto Lab panel: the billing within seconds"
# .env lines: setenv keeps the file (owner, rights); getenv gives the value without quotes; nothing is printed
setenv() { local f=$1; { grep -v "^$2=" "$f" || true; echo "$2=$3"; } > "$T/env" && cat "$T/env" > "$f"; rm -f "$T/env"; }
getenv() { [ -f "$1" ] && grep "^$2=" "$1" | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r' || true; }
sha() { sha256sum < "$1" | cut -d' ' -f1; }
# restart the pm2 app that runs a folder (found by its folder, or by the process on its port)
restart() { local pid n; pid=$(pidof_port "$2")
  n=$(su - "$PU" -c "$NODE; cd $PANEL && npx pm2 jlist 2>/dev/null" | "$B/node" "$CODE/front-door/tools/pm2-name.js" "$1" "${pid:-0}")
  [ -n "$n" ] && su - "$PU" -c "$NODE; cd $PANEL && npx pm2 restart '$n' >/dev/null"; }
# the Moto Lab items and bills the admin panel gives ("<items> <bills>" or "no")
mlfeed() { curl -s -m 30 -H @"$T/hdr" http://127.0.0.1:3040/api/feed/motolab | "$B/node" -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{let o="no";try{const d=JSON.parse(t);if(d.live&&Array.isArray(d.items)&&d.items.length&&d.bills.length)o=d.items.length+" "+d.bills.length}catch{}console.log(o)})'; }
# is the Moto Lab panel on the real bills? ("on <bills>" or "off")
mlive() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const s=d.prepare("SELECT value FROM settings WHERE key=?").get("live"),n=d.prepare("SELECT count(*) n FROM records WHERE collection=?").get("bills").n;
  console.log(s&&s.value==="on"?"on "+n:"off");d.close()}catch{console.log("off")}' "$MLDB"; }
# how the Moto Lab panel read the billing last (its new code keeps it): "<ms> <db|admin> <ok|err> <bills>" or "none";
# mlerr: the database's answer when it could not be read (nothing secret: no password is in it)
mlink() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const s=d.prepare("SELECT value FROM settings WHERE key=?").get("link_last");d.close();const l=JSON.parse(s.value);
  console.log(Date.parse(l.at)+" "+l.mode+" "+(l.ok?"ok":"err")+" "+(l.bills||0))}catch{console.log("none")}' "$MLDB"; }
mlerr() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("link_last").value);console.log(String(l.dbError||l.error||"").slice(0,160))}catch{}' "$MLDB"; }
# how the admin panel read the Bike Surgeon billing last (its new code keeps it): "<ok|err> <fast 1|0> <every s> <check ms>
# <bills>" or "none" (older code); aerr: why the quick check or the read did not work
alast() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("old_last").value);d.close();if(l.every===undefined)throw 0;
  console.log((l.ok?"ok":"err")+" "+(l.fast?1:0)+" "+l.every+" "+(l.check||0)+" "+(l.bills||0))}catch{console.log("none")}' "$ADB"; }
aerr() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("old_last").value);console.log(String(l.err||l.sumErr||"").slice(0,160))}catch{}' "$ADB"; }
# awarn: a table the bills need that this database login could not read (the bills still come, without that table)
awarn() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("old_last").value);console.log(String(l.warn||"").slice(0,200))}catch{}' "$ADB"; }
# the database lines of the admin panel's .env, copied as they are (the password is never printed); CH=1 when one changed
DBK="OLD_DB_HOST OLD_DB_PORT OLD_DB_USER OLD_DB_PASS OLD_DB_ML OLD_ML_USER OLD_ML_PASS OLD_DB_PUBKEY MYSQL_BIN"
cpenv() { local k l; for k in $DBK; do l=$(grep "^$k=" "$ADM/.env" | tail -1)
  if [ -n "$l" ]; then grep -qxF -- "$l" "$MLD/.env" && [ "$(grep -c "^$k=" "$MLD/.env")" = 1 ] && continue
    { grep -v "^$k=" "$MLD/.env" || true; printf '%s\n' "$l"; } > "$T/env" && cat "$T/env" > "$MLD/.env"; CH=1
  elif grep -q "^$k=" "$MLD/.env"; then { grep -v "^$k=" "$MLD/.env" || true; } > "$T/env"; cat "$T/env" > "$MLD/.env"; CH=1; fi
  rm -f "$T/env"; done; }
ML=1   # 0 = the Moto Lab panel is on real data
ADM=$(dirof 3040 "$PANEL"); MLD=$(dirof 3031 "$PANEL/portals/11-moto-lab")
PF="01-admin-panel/server/oldbill.js 01-admin-panel/server/routes.js 01-admin-panel/public/app.js 11-moto-lab/server/oldlink.js 11-moto-lab/server/motolab.js
  11-moto-lab/server/routes.js 11-moto-lab/server/links.js 11-moto-lab/server/index.js 11-moto-lab/public/app.js 11-moto-lab/server/mldb.js"
dst() { case "$1" in 01-admin-panel/*) echo "$ADM/${1#01-admin-panel/}";; *) echo "$MLD/${1#11-moto-lab/}";; esac; }
put() { local f d; for f in $PF; do case "$f" in "$1"/*) d=$(dst "$f")
  install -m 644 -o "$(stat -c %U "$(dirname "$d")")" -g "$(stat -c %G "$(dirname "$d")")" "$CODE/portals/$f" "$d" || return 1;; esac; done; }
if [ -z "$ADM" ] || [ -z "$MLD" ] || [ ! -f "$ADM/server/oldbill.js" ] || [ ! -f "$MLD/server/motolab.js" ] || [ ! -f "$MLD/.env" ]; then
  echo "FAILED  admin panel or Moto Lab panel folder not found: not changed"
elif [ ! -f "$CODE/portals/base-26nov.sha256" ]; then
  echo "FAILED  the panel code is not in the download: not changed"
else
  MLDB=$(getenv "$MLD/.env" DB_FILE); case "$MLDB" in "") MLDB=$MLD/data/motolab.db;; /*) ;; *) MLDB=$MLD/$MLDB;; esac
  ADB=$(getenv "$ADM/.env" DB_FILE); case "$ADB" in "") ADB=$ADM/data/admin.db;; /*) ;; *) ADB=$ADM/$ADB;; esac
  NEWA=0; NEWM=0; BAD=""
  for f in $PF; do d=$(dst "$f")
    [ -f "$d" ] && [ "$(sha "$d")" = "$(sha "$CODE/portals/$f")" ] && continue
    case "$f" in 01-*) NEWA=1;; *) NEWM=1;; esac
    # a file there must be one of ours: as on 26 Nov (before the Moto Lab went live) or 27 Nov (live through the admin panel)
    [ ! -f "$d" ] || grep -qxF "$(sha "$d")  $f" "$CODE"/portals/base-*.sha256 || BAD="$BAD $f"
  done
  AK=$(getenv "$ADM/.env" ALERT_KEY)
  if [ -n "$BAD" ]; then
    echo "STOP    changed on this server by hand:$BAD"
    echo "        The admin and Moto Lab panels are not changed. Send me a screenshot of this."
  elif [ -z "$AK" ]; then
    echo "FAILED  the admin panel has no ALERT_KEY in its .env: not changed"
  else
    printf 'X-Alert-Key: %s\n' "$AK" > "$T/hdr"
    tar -C "$ADM" -czf "$BK/admin-code.tgz" server/oldbill.js server/routes.js public/app.js && tar -C "$MLD" -czf "$BK/motolab-code.tgz" server public .env \
      && chmod 600 "$BK"/*.tgz || { echo "FAILED  backup of the panels in $BK: not changed"; NEWA=x; }
    if [ "$NEWA" = 1 ]; then   # the admin panel first: it gives the Moto Lab items and bills
      OLDPID=$(pidof_port 3040); put 01-admin-panel && restart "$ADM" 3040 || echo "FAILED  copy or restart of the admin panel"
      GOT=no; for i in $(seq 1 24); do NEWPID=$(pidof_port 3040)
        [ -n "$NEWPID" ] && [ "$NEWPID" != "$OLDPID" ] && GOT=$(mlfeed) && [ "$GOT" != no ] && break; sleep 5; done
      if [ "$GOT" = no ]; then
        echo "FAILED  the admin panel did not give the Moto Lab bills: its old code is put back"
        tar -C "$ADM" -xzf "$BK/admin-code.tgz"; restart "$ADM" 3040; NEWA=x
      else echo "OK      admin panel: new code, it gives ${GOT% *} Moto Lab items and ${GOT#* } bills"; fi
    elif [ "$NEWA" = 0 ]; then GOT=$(mlfeed)
      [ "$GOT" = no ] && echo "OK      admin panel code already new (its Moto Lab feed is not ready yet)" || echo "OK      admin panel code already new (it gives ${GOT% *} Moto Lab items and ${GOT#* } bills)"; fi
    if [ "$NEWA" != x ]; then   # how it reads the Bike Surgeon billing now (its first round after the restart)
      A=none; for i in $(seq 1 12); do A=$(alast); [ "$A" != none ] && break; sleep 5; done; read -r AO AF AE AC AB <<<"$A"
      if [ "$A" = none ]; then echo "WARN    the admin panel did not say yet how it reads the billing. Send me a screenshot of this."
      elif [ "$AO $AF" = "ok 1" ]; then echo "OK      admin panel checks the Bike Surgeon billing every $AE seconds (a check takes $AC ms; $AB bills)"
        AW=$(awarn); [ -z "$AW" ] || { echo "WARN    admin panel could not read a billing table: $AW"; echo "        Send me a screenshot of this."; }
      elif [ "$AO" = ok ]; then echo "WARN    admin panel reads the billing every minute: the quick check did not work ($(aerr))"; echo "        Send me a screenshot of this."
      else echo "WARN    admin panel could not read the billing just now: $(aerr)"; echo "        Send me a screenshot of this."; fi
    fi
    if [ "$NEWA" != x ]; then   # then the Moto Lab panel: the database lines and the admin panel's address and key, the new code
      CH=0
      [ "$(getenv "$MLD/.env" ADMIN_URL)" = http://127.0.0.1:3040 ] || { setenv "$MLD/.env" ADMIN_URL http://127.0.0.1:3040; CH=1; }
      [ "$(getenv "$MLD/.env" ALERT_KEY)" = "$AK" ] || { setenv "$MLD/.env" ALERT_KEY "$AK"; CH=1; }
      grep -q '^MOTOLAB_LIVE=0' "$MLD/.env" && { setenv "$MLD/.env" MOTOLAB_LIVE 1; CH=1; }
      cpenv; [ "$(stat -c %U "$MLD/.env")" = "$PU" ] && chmod 600 "$MLD/.env"   # it holds the database password now
      L=$(mlive); K=$(mlink)
      if [ "$NEWM" = 1 ] || [ "$CH" = 1 ] || [ "$L" = off ] || [ "$K" = none ]; then
        OLDPID=$(pidof_port 3031); L=off; K=none; T0=$(date +%s%3N)
        put 11-moto-lab && restart "$MLD" 3031 || echo "FAILED  copy or restart of the Moto Lab panel"
        echo "        waiting for the Moto Lab panel to read the billing (up to 3 minutes)"
        for i in $(seq 1 36); do sleep 5; NEWPID=$(pidof_port 3031); [ -n "$NEWPID" ] && [ "$NEWPID" != "$OLDPID" ] || continue
          L=$(mlive); K=$(mlink); [ "$L" != off ] && [ "$K" != none ] && [ "${K%% *}" -ge "$T0" ] && break; K=none; done
      fi
      if [ "$L" != off ] && [ "$K" != none ] && [ -n "$(pidof_port 3031)" ]; then
        ML=0; read -r _ KM KS KB <<<"$K"
        if [ "$KM $KS" = "db ok" ]; then echo "OK      Moto Lab panel straight on the billing database, every 3 seconds ($KB bills)"
        else echo "OK      Moto Lab panel on real data through the admin panel, every minute ($KB bills)"
          echo "WARN    it could not read the billing database itself: $(mlerr)"; echo "        Send me a screenshot of this."; fi
      else
        echo "FAILED  the Moto Lab panel did not read the billing: its code before this update is put back"
        for f in $PF; do case "$f" in 11-moto-lab/*) tar -tzf "$BK/motolab-code.tgz" "${f#11-moto-lab/}" >/dev/null 2>&1 || rm -f "$(dst "$f")";; esac; done
        tar -C "$MLD" -xzf "$BK/motolab-code.tgz"; restart "$MLD" 3031
        [ "$(mlive)" = off ] || ML=0   # live before this update: it stays in the menu with its old code
      fi
    fi
    rm -f "$T/hdr"
  fi
fi
# in the menu once it is on real data (PANELS_OFF in the front door .env; the code's list hides it)
if [ $ML = 0 ]; then
  if grep -q '^PANELS_OFF=' "$FD/.env"; then OFFL=$(getenv "$FD/.env" PANELS_OFF | tr ',' '\n' | grep -vx motolab | grep -v '^$' | paste -sd, -)
  else OFFL=floor,maintainer,desk,accounts,counter,spares,supervisor; fi
  [ "$(getenv "$FD/.env" PANELS_OFF)" = "$OFFL" ] && grep -q '^PANELS_OFF=' "$FD/.env" || { setenv "$FD/.env" PANELS_OFF "$OFFL"; echo "OK      The Moto Lab goes into the menu (Mehek, Saddam sir, Ramzan sir, Sajiya)"; }
fi

echo "== 3b. The Cashier: bills and job cards within seconds"
CS=1   # 0 = the Cashier is on its new code (or already was) and reads the admin panel
CSH=$(dirof 3023 "$PANEL/portals/03-cashier"); CF="03-cashier/server/oldlink.js 03-cashier/public/app.js"
# how the Cashier read the admin panel last (its new code keeps it): "<ms> <ok|err> <fast 1|0> <bills>" or "none"; cerr: why not
clast() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("link_last").value);d.close();
  console.log(Date.parse(l.at)+" "+(l.ok?"ok":"err")+" "+(l.fast?1:0)+" "+(l.bills||0))}catch{console.log("none")}' "$CDB"; }
cerr() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("link_last").value);console.log(String(l.error||"").slice(0,160))}catch{}' "$CDB"; }
cput() { local f d; for f in $CF; do d=$CSH/${f#03-cashier/}
  install -m 644 -o "$(stat -c %U "$(dirname "$d")")" -g "$(stat -c %G "$(dirname "$d")")" "$CODE/portals/$f" "$d" || return 1; done; }
AK=""; [ -n "$ADM" ] && AK=$(getenv "$ADM/.env" ALERT_KEY)
if [ -z "$CSH" ] || [ ! -f "$CSH/server/oldlink.js" ] || [ ! -f "$CSH/.env" ]; then
  echo "FAILED  Cashier folder not found: not changed"
elif [ -z "$AK" ]; then
  echo "FAILED  the admin panel has no ALERT_KEY in its .env: the Cashier is not changed"
else
  CDB=$(getenv "$CSH/.env" DB_FILE); case "$CDB" in "") CDB=$CSH/data/cashier.db;; /*) ;; *) CDB=$CSH/$CDB;; esac
  NEWC=0; BAD=""
  for f in $CF; do d=$CSH/${f#03-cashier/}
    [ -f "$d" ] && [ "$(sha "$d")" = "$(sha "$CODE/portals/$f")" ] && continue
    NEWC=1; [ ! -f "$d" ] || grep -qxF "$(sha "$d")  $f" "$CODE"/portals/base-*.sha256 || BAD="$BAD $f"
  done
  CH=0; [ "$(getenv "$CSH/.env" ADMIN_URL)" = http://127.0.0.1:3040 ] && [ "$(getenv "$CSH/.env" ALERT_KEY)" = "$AK" ] && ! grep -q '^CASHIER_LIVE=0' "$CSH/.env" || CH=1
  K=$(clast)
  if [ -n "$BAD" ]; then
    echo "STOP    changed on this server by hand:$BAD"
    echo "        The Cashier is not changed. Send me a screenshot of this."
  elif [ "$NEWC" = 0 ] && [ "$CH" = 0 ] && [ "$K" != none ]; then
    read -r _ KS KF KB <<<"$K"; CS=0
    # the admin panel may have restarted just now: the Cashier gets up to 30 seconds for a good read again
    [ "$KS" = ok ] || for i in $(seq 1 10); do sleep 3; K=$(clast); read -r _ KS KF KB <<<"$K"; [ "$KS" = ok ] && break; done
    if [ "$KS $KF" = "ok 1" ]; then echo "OK      Cashier code already new: bills and job cards within seconds ($KB bills of the last 40 days)"
    else echo "OK      Cashier code already new (its last read: $KS$( [ "$KS" = err ] && echo ": $(cerr)"))"; fi
  elif ! { tar -C "$CSH" -czf "$BK/cashier-code.tgz" server/oldlink.js public/app.js .env && chmod 600 "$BK/cashier-code.tgz"; }; then
    echo "FAILED  backup of the Cashier in $BK: not changed"
  else   # its .env: the admin panel's address and key (copied, never printed), the link on; then the new code
    [ "$(getenv "$CSH/.env" ADMIN_URL)" = http://127.0.0.1:3040 ] || setenv "$CSH/.env" ADMIN_URL http://127.0.0.1:3040
    [ "$(getenv "$CSH/.env" ALERT_KEY)" = "$AK" ] || setenv "$CSH/.env" ALERT_KEY "$AK"
    grep -q '^CASHIER_LIVE=0' "$CSH/.env" && setenv "$CSH/.env" CASHIER_LIVE 1
    [ "$(stat -c %U "$CSH/.env")" = "$PU" ] && chmod 600 "$CSH/.env"
    OLDPID=$(pidof_port 3023); T0=$(date +%s%3N); K=none
    cput && restart "$CSH" 3023 || echo "FAILED  copy or restart of the Cashier"
    for i in $(seq 1 24); do sleep 5; NEWPID=$(pidof_port 3023); [ -n "$NEWPID" ] && [ "$NEWPID" != "$OLDPID" ] || continue
      K=$(clast); [ "$K" != none ] && [ "${K%% *}" -ge "$T0" ] && break; K=none; done
    read -r _ KS KF KB <<<"$K"
    if [ "$K" != none ] && [ "$KS" = ok ] && [ -n "$(pidof_port 3023)" ]; then
      CS=0
      if [ "$KF" = 1 ]; then echo "OK      Cashier: bills and job cards within seconds ($KB bills of the last 40 days)"
      else echo "OK      Cashier on the real bills, every minute ($KB bills of the last 40 days)"; fi
    else
      [ "$K" = none ] && W="it did not read the admin panel in 2 minutes" || W="it could not read the admin panel: $(cerr)"
      echo "FAILED  Cashier: $W. Its code before this update is put back"
      tar -C "$CSH" -xzf "$BK/cashier-code.tgz"; restart "$CSH" 3023
    fi
  fi
fi

echo "== 4. Front door: the new code (sign-in page, one screen)"
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
  echo "== 5. Name-wise logins (backup first: $BK)"
  (cd "$FD" && "$B/node" --env-file=.env --disable-warning=ExperimentalWarning tools/name-logins.js --people "$T/people.json" --dirs "$T/dirs.json" --out "$OUT" --backup "$BK"); N=$?
fi
rm -rf "$T"

echo "== 6. Check of every login"
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
[ $N = 0 ] && [ $C = 0 ] && [ $MISS = 0 ] && [ $ML = 0 ] && [ $CS = 0 ] && echo "All done." || echo "Something failed: send me a screenshot of this (it shows no passwords)."
