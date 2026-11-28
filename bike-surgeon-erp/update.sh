#!/bin/bash
# Bike Surgeon ERP 2.0 (panel.bikesurgeon.online): update from GitHub. Run as root on the Bike Surgeon server.
# First time (or any time):
#   curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/bike-surgeon-erp/update.sh -o /root/bs-erp-update.sh && bash /root/bs-erp-update.sh
# After that:   bash /root/bs-erp-update.sh            (it takes the newest code from GitHub by itself)
#               bash /root/bs-erp-update.sh old-off    (older role-email staff logins off, once everyone uses their own)
#               bash /root/bs-erp-update.sh undo       (logins back as before the last update; again = one more back)
#               bash /root/bs-erp-update.sh names      (the name-wise logins again from the attendance app; passwords + PINs kept)
#               bash /root/bs-erp-update.sh vrgarage   (the VR Garage login + password for the Vehicle number page, typed here once)
#               bash /root/bs-erp-update.sh catalogue  (all Bike Pharma catalogues in the menu: the key both servers share, once)
# 28 Nov update 11 (Sam: "can u add all catalogues from bikepharma"): a new page "Catalogue" in every login's menu. It is
# Bike Pharma's own Find Part (every brand's catalogue, diagrams, part numbers, MRPs, chassis and vehicle number search),
# opened from bikepharma.com through this server with Bike Surgeon's key, so nothing is copied and a catalogue added on
# Bike Pharma shows here at once. Next to each part: Bike Surgeon's own stock and rack (the billing's parts, read only,
# every 2 minutes). A vehicle number in it is answered by the Vehicle number page's saved VR Garage details (asked only
# once, the same limits); the Vehicle number page gets a button "Parts of this bike (Catalogue)". Bike Pharma's server
# gives this key Find Part only: none of its bills, customers, prices or stock, and nothing is saved there. The page runs
# sealed off from the panels (no cookies, no way into the billing pages). Once:  bash /root/bs-erp-update.sh catalogue
# 28 Nov update 10 (Sam's Bike Pharma RC code, "why does Bike Pharma find it and Bike Surgeon not?"): the REAL cause of the
# "VR Garage answered 500". The front door cut VR Garage's login token to 160 letters (the RC fields' length limit); the
# token is a JWT of about 350 letters, so every search went with a broken token and VR Garage answered 500. Bike Pharma
# sends the token whole, which is why it works. Now the whole token is sent, exactly like Bike Pharma's lib/rclook.mjs.
# 28 Nov update 9 (Sam: "Error is coming. Why?"): the Vehicle number page said only "VR Garage answered 500". VR Garage's
# own words now show instead. Checked on this server on 28 Nov: our login and request are right (a number VR Garage already
# had came at once, without a credit); new numbers failed because the government RC server behind VR Garage (M-Parivahan)
# was down. The page now says so, and the vehicle of a new job card is asked again by itself every 30 minutes (at most 8
# times a day) until it comes. A server error makes the front door log in to VR Garage again once (an old login can
# answer 500). Failed searches no longer use up the shop's 300 searches a day; the search log says when a credit was used.
# 28 Nov update 8 (Sam: "the job card people get their portal, everything clearly, exactly right"): the Service floor panel
# becomes the service advisors' job card portal (Sharath, Syed Shahid, Yaseen Raza; also Sultan and the owners), straight on
# the Bike Surgeon billing (read only: the admin panel's database lines are copied into its .env), a checksum check every
# 3 seconds. It shows today's job cards, pending approval, ongoing (the mechanic, the time left), completed, not approved,
# each job card (labour, parts, the parts request, the bill, the quality check), the online bookings, the service reminders
# and the mechanics, counted the service app's own way. New job cards, approvals and bookings are still made in the service
# app (its buttons open it). The panel's files are copied to the backup folder first; if it cannot read the billing, its
# old code goes back. It goes into the menu once it shows the billing's job cards.
# 28 Nov update 7 (Sam: "VR Garage in job card + billing counter"): a new page "Vehicle number" at the top of every login's
# menu. A number gives the chassis, model, engine number and owner from VR Garage; staff can change the customer name and
# the model. Each vehicle is asked ONLY ONCE (the answer is kept in the front door's database for ever). The front door reads
# the job cards of the Bike Surgeon billing (read only, the admin panel's database lines are copied into its .env) every
# 5 seconds: a number shows its old job cards at once, and the vehicle of every NEW job card is asked by itself, once. The
# Cashier shows the model, chassis and engine under a ready vehicle. VR Garage's login is typed on this server only:
#   bash /root/bs-erp-update.sh vrgarage   (it tries the login first and saves it only when VR Garage accepts it)
# 27 Nov update 6 (Sam: "old inventory and new inventory numbers mismatch"): Inventory 2.0 reads the parts table of the
# Bike Surgeon billing and of the Moto Lab billing straight from their databases (read only: the admin panel's database
# lines are copied into its .env), a checksum check every 3 seconds. Every part number, name, MRP, cost, GST, discount,
# stock, alert level and rack is exactly as in the billing (read the billing's own way: "1,250.00" = 1250, "18%" = 18),
# and the admin panel's Stock gets the same list. Until switch day parts, stock and prices are changed in the billing
# only. The inventory database is copied to the backup folder first; if it cannot read the billing, its old code goes back.
# "Low stock" is counted the billing's way everywhere (its Low Stock page: an alert level set and the stock at or below
# it): Inventory 2.0, the admin panel and the Moto Lab panel show the same number (the Moto Lab panel counted only items
# that sell, and gave items without an alert level the level 1).
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
case "$MODE" in ""|undo|old-off|names|vrgarage|catalogue) ;; *) echo "Unknown word: $MODE (use nothing, names, undo, old-off, vrgarage or catalogue). Nothing changed."; exit 1;; esac

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

if [ "$MODE" = vrgarage ]; then
  # the VR Garage login of the Vehicle number page: typed here (never in a chat), tried with VR Garage first (a login only,
  # no search, nothing is paid), then kept only in the front door's .env (the password as base64, so any sign works).
  # The login is what goes in VR Garage's email box: a mobile number (Sam's, 28 Nov) or an email.
  [ -f "$FD/server/vehicles.js" ] || { echo "Run the update first:  bash $ME   Nothing changed."; exit 1; }
  echo "VR Garage login for the Vehicle number page. It is kept only on this server ($FD/.env)."
  read -r -p "VR Garage login (the mobile number or email you sign in with): " VE; read -r -s -p "VR Garage password (it does not show while you type): " VP; echo
  VE=$(printf '%s' "$VE" | tr -d ' \r')
  [[ "$VE" =~ ^[^@]+@[^@]+\.[^@]+$ || "$VE" =~ ^\+?[0-9]{10,13}$ ]] || { echo "That is not a mobile number or an email. Nothing changed."; exit 1; }
  [ -n "$VP" ] || { echo "No password typed. Nothing changed."; exit 1; }
  echo "== Trying the login with VR Garage (no search: nothing is paid)"
  R=$(cd "$FD" && VRG_E="$VE" VRG_P="$VP" "$B/node" --env-file-if-exists=.env --disable-warning=ExperimentalWarning -e '
    require("./server/vehicles").loginTest(process.env.VRG_E, process.env.VRG_P).then(t => console.log(t), e => console.log("could not try the login: " + e.message))' 2>&1 | tail -1)
  if [ "$R" != ok ]; then echo "FAILED  $R"; echo "        Nothing saved. Send me a screenshot of this (it shows no password)."; unset VP; exit 1; fi
  echo "OK      VR Garage accepted the login"
  VT=$(mktemp); chmod 600 "$VT"; P64=$(printf '%s' "$VP" | base64 -w0); unset VP
  { grep -vE '^(VRGARAGE_EMAIL|VRGARAGE_PASS64|VRGARAGE_PASSWORD)=' "$FD/.env" || true; echo "VRGARAGE_EMAIL=$VE"; echo "VRGARAGE_PASS64=$P64"; } > "$VT" && cat "$VT" > "$FD/.env"
  rm -f "$VT"; unset P64
  [ "$(stat -c %U "$FD/.env")" = "$PU" ] && chmod 600 "$FD/.env"
  su - "$PU" -c "$NODE; cd $PANEL && npx pm2 restart front-door >/dev/null" || echo "FAILED  restart of the front door"
  UP=0; for i in $(seq 1 30); do sleep 1; curl -s -m 3 http://127.0.0.1:3022/__gate/login | grep -q 'Mobile number or email' && { UP=1; break; }; done
  if [ $UP = 1 ]; then echo "OK      VR Garage connected. The vehicle of every new job card is asked by itself (once); any number on the Vehicle number page too."; echo "All done."
  else echo "FAILED  the front door did not start again. Send me a screenshot of this."; exit 1; fi
  exit 0
fi

# the Catalogue page: the probe asks bikepharma.com one staff question with the key (no catalogue is read)
catprobe() { (cd "$FD" && "$B/node" --env-file=.env --disable-warning=ExperimentalWarning -e '
  require("./server/catalogue")._.probe().then(p => console.log(p.ok ? "ok" : p.msg), e => console.log("could not ask: " + e.message))' 2>&1 | tail -1); }
if [ "$MODE" = catalogue ]; then
  # Bike Pharma's catalogues in the menu (Catalogue page): one key, made here once and kept in the front door's .env
  # (BP_CAT_KEY); the same key goes into bikepharma.com's .env (BS_CAT_KEY) with the one line printed below.
  [ -f "$FD/server/catalogue.js" ] || { echo "Run the update first:  bash $ME   Nothing changed."; exit 1; }
  K=$(grep '^BP_CAT_KEY=' "$FD/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
  if [ ${#K} -lt 32 ]; then
    K=$("$B/node" -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')
    KT=$(mktemp); chmod 600 "$KT"
    { grep -v '^BP_CAT_KEY=' "$FD/.env" || true; echo "BP_CAT_KEY=$K"; } > "$KT" && cat "$KT" > "$FD/.env"; rm -f "$KT"
    [ "$(stat -c %U "$FD/.env")" = "$PU" ] && chmod 600 "$FD/.env"
    su - "$PU" -c "$NODE; cd $PANEL && npx pm2 restart front-door >/dev/null" || echo "FAILED  restart of the front door"
    for i in $(seq 1 30); do sleep 1; curl -s -m 3 http://127.0.0.1:3022/__gate/login | grep -q 'Mobile number or email' && break; done
    echo "OK      Bike Surgeon's catalogue key made (kept only in $FD/.env)"
  fi
  echo "== Asking bikepharma.com with the key"
  R=$(catprobe)
  if [ "$R" = ok ]; then echo "OK      bikepharma.com takes the key: Catalogue is in every login's menu (reload the page once)."; echo "All done."; exit 0; fi
  echo "WAITING $R"
  echo
  echo "Once, on the BIKE PHARMA server as root: copy this ONE line with the mouse and run it there (it adds the key and runs the Bike Pharma update):"
  echo
  echo "cd /home/bikepharma/htdocs/bikepharma.com && (umask 077; { grep -v '^BS_CAT_KEY=' .env; echo 'BS_CAT_KEY=$K'; } > .env.k) && cat .env.k > .env && rm -f .env.k && bash update.sh"
  echo
  echo "That line holds a password: never send a screenshot or a photo of it, and type  clear  here after copying it."
  echo "Then here once more:  bash $ME catalogue   (it only checks; the key is not shown again when it works)"
  exit 0
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

echo "== 3c. Inventory 2.0: parts, stock and prices straight from the billing"
IV=1   # 0 = Inventory 2.0 reads the billing (or already did)
IU=bikesurgeon-inventory; IB=$(ls -d /home/$IU/.nvm/versions/node/v22*/bin 2>/dev/null | sort -V | tail -1)
INVD=$(dirof 3021 "$INV"); IC=$CODE/portals/12-inventory
IFL=$( [ -d "$IC/server" ] && cd "$IC" && find server public -type f | sort )
# how Inventory 2.0 read the billing last (its new code keeps it): "<ms> <ok|err> <fast 1|0> <Bike Surgeon parts> <Moto Lab
# items>" or "none"; ierr: why not (the database's answer, nothing secret)
ilast() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("billing_last").value);d.close();const s=l.stores||{};
  console.log((l.t||0)+" "+(l.ok&&(s.BS||{}).ok?"ok":"err")+" "+(l.fast?1:0)+" "+((s.BS||{}).parts||0)+" "+((s.ML||{}).parts||0))}catch{console.log("none")}' "$IDB"; }
ierr() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("billing_last").value);
  console.log(String(Object.values(l.stores||{}).map(x=>x.err||x.sumErr||"").filter(Boolean)[0]||"").slice(0,160))}catch{}' "$IDB"; }
# the admin panel's Stock list: "<Bike Surgeon rows> <Moto Lab rows>"
astock() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const n=b=>d.prepare("SELECT count(*) n FROM records WHERE collection=? AND json_extract(data,?)=?").get("inventory","$.b",b).n;console.log(n("bs")+" "+n("ml"));d.close()}catch{console.log("0 0")}' "$ADB"; }
irestart() { local pid n; pid=$(pidof_port 3021)
  n=$(su - "$IU" -c "export PATH=$IB:\$PATH; cd $INVD && npx pm2 jlist 2>/dev/null" | "$B/node" "$CODE/front-door/tools/pm2-name.js" "$INVD" "${pid:-0}")
  su - "$IU" -c "export PATH=$IB:\$PATH; cd $INVD && npx pm2 restart '${n:-inventory}' >/dev/null"; }
iput() { local f d; for f in $IFL; do d=$INVD/$f
  install -m 644 -o "$(stat -c %U "$(dirname "$d")")" -g "$(stat -c %G "$(dirname "$d")")" "$IC/$f" "$d" || return 1; done; }
# the admin panel's database lines (read only login), copied as they are (the password is never printed); CH=1 when one changed
IDBK="OLD_DB_HOST OLD_DB_PORT OLD_DB_USER OLD_DB_PASS OLD_DB_BS OLD_DB_ML OLD_ML_USER OLD_ML_PASS OLD_DB_PUBKEY MYSQL_BIN"
ienv() { local k l; for k in $IDBK; do l=$(grep "^$k=" "$ADM/.env" | tail -1)
  if [ -n "$l" ]; then grep -qxF -- "$l" "$INVD/.env" && [ "$(grep -c "^$k=" "$INVD/.env")" = 1 ] && continue
    [ "${1:-}" = check ] && { CH=1; continue; }
    { grep -v "^$k=" "$INVD/.env" || true; printf '%s\n' "$l"; } > "$T/env" && cat "$T/env" > "$INVD/.env"; CH=1
  elif grep -q "^$k=" "$INVD/.env"; then CH=1; [ "${1:-}" = check ] && continue
    { grep -v "^$k=" "$INVD/.env" || true; } > "$T/env"; cat "$T/env" > "$INVD/.env"; fi
  rm -f "$T/env"; done; }
if [ -z "$INVD" ] || [ ! -f "$INVD/server/inv.js" ] || [ ! -f "$INVD/.env" ]; then
  echo "FAILED  Inventory 2.0 folder not found: not changed"
elif [ -z "$IB" ] || [ ! -x "$IB/node" ]; then
  echo "FAILED  Node 22 of the inventory site not found: not changed"
elif [ -z "$IFL" ] || [ ! -f "$CODE/portals/base-inv.sha256" ]; then
  echo "FAILED  the inventory code is not in the download: not changed"
elif [ -z "$ADM" ] || [ -z "$(getenv "$ADM/.env" OLD_DB_BS)" ] || [ -z "$(getenv "$ADM/.env" OLD_DB_USER)" ]; then
  echo "FAILED  the admin panel has no billing database lines in its .env: Inventory 2.0 not changed"
else
  IDB=$(getenv "$INVD/.env" DB_FILE); case "$IDB" in "") IDB=$INVD/data/inventory.db;; /*) ;; *) IDB=$INVD/$IDB;; esac
  ADB=$(getenv "$ADM/.env" DB_FILE); case "$ADB" in "") ADB=$ADM/data/admin.db;; /*) ;; *) ADB=$ADM/$ADB;; esac
  NEWI=0; BAD=""
  for f in $IFL; do d=$INVD/$f
    [ -f "$d" ] && [ "$(sha "$d")" = "$(sha "$IC/$f")" ] && continue
    # a file there must be one of ours (a version of 29 Oct to 26 Nov)
    NEWI=1; [ ! -f "$d" ] || grep -qxF "$(sha "$d")  12-inventory/$f" "$CODE"/portals/base-*.sha256 || BAD="$BAD $f"
  done
  CH=0; ienv check; K=$(ilast)
  if [ -n "$BAD" ]; then
    echo "STOP    changed on this server by hand:$BAD"
    echo "        Inventory 2.0 is not changed. Send me a screenshot of this."
  elif [ "$NEWI" = 0 ] && [ "$CH" = 0 ] && [ "$K" != none ]; then
    read -r _ KS KF KP KM <<<"$K"
    if [ "$KS" = ok ]; then IV=0; echo "OK      Inventory 2.0 code already new: straight on the billing ($KP Bike Surgeon parts, $KM Moto Lab items)"
    else echo "WARN    Inventory 2.0 code already new, but its last read of the billing did not work: $(ierr)"; echo "        Send me a screenshot of this."; fi
  elif ! { tar -C "$INVD" -czf "$BK/inventory-code.tgz" server public .env && chmod 600 "$BK/inventory-code.tgz" \
      && "$IB/node" --disable-warning=ExperimentalWarning -e 'new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true}).exec("VACUUM INTO \x27"+process.argv[2].replace(/\x27/g,"\x27\x27")+"\x27")' "$IDB" "$BK/inventory.db" \
      && chmod 600 "$BK/inventory.db"; }; then
    echo "FAILED  backup of Inventory 2.0 in $BK: not changed"
  else   # its .env: the billing's database lines, then the new code
    ienv; [ "$(stat -c %U "$INVD/.env")" = "$IU" ] && chmod 600 "$INVD/.env"   # it holds the database password now
    OLDPID=$(pidof_port 3021); T0=$(date +%s%3N); K=none
    iput && irestart || echo "FAILED  copy or restart of Inventory 2.0"
    echo "        waiting for Inventory 2.0 to read the billing (up to 3 minutes; its database copy: $BK/inventory.db)"
    for i in $(seq 1 36); do sleep 5; NEWPID=$(pidof_port 3021); [ -n "$NEWPID" ] && [ "$NEWPID" != "$OLDPID" ] || continue
      K=$(ilast); read -r KT KS _ <<<"$K"; [ "$K" != none ] && [ "$KT" -ge "$T0" ] && [ "$KS" = ok ] && break; done
    read -r KT KS KF KP KM <<<"$K"
    if [ "$K" != none ] && [ "$KT" -ge "$T0" ] && [ "$KS" = ok ] && [ -n "$(pidof_port 3021)" ]; then
      IV=0
      if [ "$KF" = 1 ]; then echo "OK      Inventory 2.0 straight on the billing: $KP Bike Surgeon parts, $KM Moto Lab items, checked every 3 seconds"
      else echo "OK      Inventory 2.0 on the billing, read every minute ($KP Bike Surgeon parts, $KM Moto Lab items)"
        echo "WARN    the quick check did not work: $(ierr)"; echo "        Send me a screenshot of this."; fi
    else
      [ "$K" = none ] || [ "$KT" -lt "$T0" ] && W="it did not read the billing in 3 minutes" || W="it could not read the billing: $(ierr)"
      echo "FAILED  Inventory 2.0: $W. Its code before this update is put back"
      for f in $IFL; do tar -tzf "$BK/inventory-code.tgz" "$f" >/dev/null 2>&1 || rm -f "$INVD/$f"; done
      tar -C "$INVD" -xzf "$BK/inventory-code.tgz"; irestart
    fi
  fi
  if [ $IV = 0 ]; then   # the admin panel's Stock gets the same list from Inventory 2.0 (in steps, a minute or two)
    read -r _ _ _ KP KM <<<"$(ilast)"; A="0 0"
    for i in $(seq 1 36); do A=$(astock); [ "$A" = "$KP $KM" ] && break; sleep 5; done
    if [ "$A" = "$KP $KM" ]; then echo "OK      admin panel Stock: the same $KP Bike Surgeon parts and $KM Moto Lab items"
    else echo "WARN    admin panel Stock has ${A% *} Bike Surgeon and ${A#* } Moto Lab parts so far (Inventory 2.0: $KP and $KM)."
      echo "        It comes in steps: look again in 5 minutes. If it stays different, send me a screenshot of this."; fi
  fi
fi

echo "== 3d. Service floor: the advisors' job cards straight from the billing"
FL=1   # 0 = the Service floor shows the billing's job cards (or already did)
FLD=$(dirof 3026 "$PANEL/portals/06-floor-manager"); FC=$CODE/portals/06-floor-manager; FLM=0
FFL=$( [ -d "$FC/server" ] && cd "$FC" && find server public -type f | sort )
# how the Service floor read the billing last (its new code keeps it): "<ms> <ok|err> <fast 1|0> <job cards> <bookings>" or
# "none"; ferr: why not; fwarn: a part it could not read (the database's answer, nothing secret)
fq() { "$B/node" --disable-warning=ExperimentalWarning -e 'let l=null;try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  l=JSON.parse(d.prepare("SELECT value FROM settings WHERE key=?").get("billing_last").value);d.close()}catch{}const w=process.argv[2];
  if(w==="last")console.log(l?(Date.parse(l.at)||0)+" "+(l.ok?"ok":"err")+" "+(l.fast?1:0)+" "+(l.cards||0)+" "+(l.bookings||0):"none");
  else if(l)console.log(String((w==="err"?l.err||l.sumErr:l.warn)||"").slice(0,200))' "$FLDB" "$1"; }
fput() { local f d; for f in $FFL; do d=$FLD/$f
  install -m 644 -o "$(stat -c %U "$(dirname "$d")")" -g "$(stat -c %G "$(dirname "$d")")" "$FC/$f" "$d" || return 1; done; }
# the admin panel's database lines of the Bike Surgeon billing (read only login), copied as they are (the password is never
# printed); CH=1 when one changed
FLK="OLD_DB_HOST OLD_DB_PORT OLD_DB_USER OLD_DB_PASS OLD_DB_BS OLD_DB_PUBKEY MYSQL_BIN"
fenv() { local k l; for k in $FLK; do l=$(grep "^$k=" "$ADM/.env" | tail -1)
  if [ -n "$l" ]; then grep -qxF -- "$l" "$FLD/.env" && [ "$(grep -c "^$k=" "$FLD/.env")" = 1 ] && continue
    [ "${1:-}" = check ] && { CH=1; continue; }
    { grep -v "^$k=" "$FLD/.env" || true; printf '%s\n' "$l"; } > "$T/env" && cat "$T/env" > "$FLD/.env"; CH=1
  elif grep -q "^$k=" "$FLD/.env"; then CH=1; [ "${1:-}" = check ] && continue
    { grep -v "^$k=" "$FLD/.env" || true; } > "$T/env"; cat "$T/env" > "$FLD/.env"; fi
  rm -f "$T/env"; done; }
if [ -z "$FLD" ] || [ ! -f "$FLD/server/routes.js" ] || [ ! -f "$FLD/.env" ]; then
  echo "FAILED  Service floor folder not found: not changed"
elif [ -z "$FFL" ] || [ ! -f "$CODE/portals/base-28nov-floor.sha256" ]; then
  echo "FAILED  the Service floor code is not in the download: not changed"
elif [ -z "$ADM" ] || [ -z "$(getenv "$ADM/.env" OLD_DB_BS)" ] || [ -z "$(getenv "$ADM/.env" OLD_DB_USER)" ]; then
  echo "FAILED  the admin panel has no billing database lines in its .env: the Service floor is not changed"
elif [ "$(getenv "$FLD/.env" FLOOR_LIVE)" = 0 ]; then
  FL=0; echo "OK      Service floor: FLOOR_LIVE=0 in its .env, so it stays as it is (not changed)"
else
  FLDB=$(getenv "$FLD/.env" DB_FILE); case "$FLDB" in "") FLDB=$FLD/data/portal.db;; /*) ;; *) FLDB=$FLD/$FLDB;; esac
  NEWF=0; BAD=""
  for f in $FFL; do d=$FLD/$f
    [ -f "$d" ] && [ "$(sha "$d")" = "$(sha "$FC/$f")" ] && continue
    # a file there must be the one of the first install (29 Oct); the other files are new
    NEWF=1; [ ! -f "$d" ] || grep -qxF "$(sha "$d")  06-floor-manager/$f" "$CODE"/portals/base-*.sha256 || BAD="$BAD $f"
  done
  CH=0; fenv check; [ -n "$(getenv "$FLD/.env" DEMO_CLOCK)" ] && CH=1; K=$(fq last)
  if [ -n "$BAD" ]; then
    echo "STOP    changed on this server by hand:$BAD"
    echo "        The Service floor is not changed. Send me a screenshot of this."
  elif [ "$NEWF" = 0 ] && [ "$CH" = 0 ] && [ "$K" != none ]; then
    read -r _ KS _ KC KB <<<"$K"
    [ "$KS" = ok ] || for i in $(seq 1 10); do sleep 3; K=$(fq last); read -r _ KS _ KC KB <<<"$K"; [ "$KS" = ok ] && break; done
    if [ "$KS" = ok ]; then FL=0; FLM=1; echo "OK      Service floor code already new: straight on the billing ($KC job cards, $KB online bookings)"
    else echo "WARN    Service floor code already new, but its last read of the billing did not work: $(fq err)"; echo "        Send me a screenshot of this."; fi
  elif ! { tar -C "$FLD" -czf "$BK/floor-code.tgz" server public .env && chmod 600 "$BK/floor-code.tgz" \
      && "$B/node" --disable-warning=ExperimentalWarning -e 'new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true}).exec("VACUUM INTO \x27"+process.argv[2].replace(/\x27/g,"\x27\x27")+"\x27")' "$FLDB" "$BK/floor-portal.db" \
      && chmod 600 "$BK/floor-portal.db"; }; then
    echo "FAILED  backup of the Service floor in $BK: not changed"
  else   # its .env: the billing's database lines and the real clock (a demo clock would make "today" another day), then the new code
    fenv; [ -n "$(getenv "$FLD/.env" DEMO_CLOCK)" ] && setenv "$FLD/.env" DEMO_CLOCK ""
    [ "$(stat -c %U "$FLD/.env")" = "$PU" ] && chmod 600 "$FLD/.env"   # it holds the database password now
    OLDPID=$(pidof_port 3026); T0=$(date +%s%3N); K=none
    fput && restart "$FLD" 3026 || echo "FAILED  copy or restart of the Service floor"
    echo "        waiting for the Service floor to read the billing (up to 3 minutes)"
    for i in $(seq 1 36); do sleep 5; NEWPID=$(pidof_port 3026); [ -n "$NEWPID" ] && [ "$NEWPID" != "$OLDPID" ] || continue
      K=$(fq last); read -r KT KS _ <<<"$K"; [ "$K" != none ] && [ "$KT" -ge "$T0" ] && [ "$KS" = ok ] && break; done
    read -r KT KS KF KC KB <<<"$K"
    if [ "$K" != none ] && [ "$KT" -ge "$T0" ] && [ "$KS" = ok ] && [ -n "$(pidof_port 3026)" ] && curl -s -m 5 http://127.0.0.1:3026/ | grep -q 'src="live.js"'; then
      FL=0; FLM=1
      if [ "$KF" = 1 ]; then echo "OK      Service floor straight on the billing: $KC job cards, $KB online bookings, checked every 3 seconds"
      else echo "OK      Service floor on the billing, read every minute ($KC job cards, $KB online bookings)"
        echo "WARN    the quick check did not work: $(fq err)"; echo "        Send me a screenshot of this."; fi
    else
      [ "$K" = none ] || [ "$KT" -lt "$T0" ] && W="it did not read the billing in 3 minutes" || W="it could not read the billing: $(fq err)"
      [ "$K" != none ] && [ "$KT" -ge "$T0" ] && [ "$KS" = ok ] && W="its new page did not open"
      echo "FAILED  Service floor: $W. Its code before this update is put back"
      for f in $FFL; do tar -tzf "$BK/floor-code.tgz" "$f" >/dev/null 2>&1 || rm -f "$FLD/$f"; done
      tar -C "$FLD" -xzf "$BK/floor-code.tgz"; restart "$FLD" 3026
    fi
  fi
  if [ $FLM = 1 ]; then
    W=$(fq warn); [ -n "$W" ] && { echo "WARN    the Service floor could not read a part of the billing (the job cards still show): $W"; echo "        Send me a screenshot of this."; }
  fi
fi
# in the menu once it is on the billing (PANELS_OFF in the front door .env; the code's list hides it)
if [ $FLM = 1 ]; then
  if grep -q '^PANELS_OFF=' "$FD/.env"; then OFFL=$(getenv "$FD/.env" PANELS_OFF | tr ',' '\n' | grep -vx floor | grep -v '^$' | paste -sd, -)
  else OFFL=maintainer,desk,accounts,counter,spares,supervisor,motolab; fi
  [ "$(getenv "$FD/.env" PANELS_OFF)" = "$OFFL" ] && grep -q '^PANELS_OFF=' "$FD/.env" || { setenv "$FD/.env" PANELS_OFF "$OFFL"; echo "OK      The Service floor goes into the menu (Sharath, Syed Shahid, Yaseen Raza, Sultan, the owners)"; }
fi

echo "== 4. Front door: the new code (sign-in page, one screen, Vehicle number page)"
tar -C "$FD" --exclude=./data --exclude=./node_modules -czf "$BK/front-door-code.tgz" . && chmod 600 "$BK/front-door-code.tgz" \
  || { echo "The front door code could not be copied to $BK. Nothing changed."; exit 1; }
# the Vehicle number page reads the billing's job cards: the admin panel's database lines of the Bike Surgeon billing (read
# only login), copied as they are (the password is never printed)
GA=1; FDBK="OLD_DB_HOST OLD_DB_PORT OLD_DB_USER OLD_DB_PASS OLD_DB_BS OLD_DB_PUBKEY MYSQL_BIN"
if [ -n "$ADM" ] && [ -f "$ADM/.env" ] && [ -n "$(getenv "$ADM/.env" OLD_DB_BS)" ]; then
  for k in $FDBK; do l=$(grep "^$k=" "$ADM/.env" | tail -1)
    if [ -n "$l" ]; then grep -qxF -- "$l" "$FD/.env" && [ "$(grep -c "^$k=" "$FD/.env")" = 1 ] && continue
      { grep -v "^$k=" "$FD/.env" || true; printf '%s\n' "$l"; } > "$T/env" && cat "$T/env" > "$FD/.env"
    elif grep -q "^$k=" "$FD/.env"; then { grep -v "^$k=" "$FD/.env" || true; } > "$T/env"; cat "$T/env" > "$FD/.env"; fi
    rm -f "$T/env"; done
  [ "$(stat -c %U "$FD/.env")" = "$PU" ] && chmod 600 "$FD/.env"   # it holds the database password now
else echo "WARN    the admin panel has no billing database lines: the Vehicle number page cannot read the job cards"; fi
OLDPID=$(pidof_port 3022); T0=$(date +%s%3N)
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
if [ -z "$(getenv "$FD/.env" BP_CAT_KEY)" ]; then echo "NEXT    Catalogue (all Bike Pharma catalogues in the menu, with Bike Surgeon's stock): once,  bash $ME catalogue"
else CR=$(catprobe); if [ "$CR" = ok ]; then echo "OK      Catalogue: bikepharma.com takes Bike Surgeon's key (all its catalogues are in the menu)"; else echo "NEXT    Catalogue: $CR"; fi; fi
# the Vehicle number page: its first read of the billing's job cards (front door database, kv gaadi_last)
FDB=$(getenv "$FD/.env" DB_FILE); case "$FDB" in "") FDB=$FD/data/front.db;; /*) ;; *) FDB=$FD/$FDB;; esac
glast() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  const r=d.prepare("SELECT v FROM kv WHERE k=?").get("gaadi_last");d.close();const l=JSON.parse(r.v);
  console.log((l.at||0)+" "+(l.on?1:0)+" "+(l.ok?"ok":"err")+" "+(l.cards||0)+" "+(l.plates||0)+" "+(l.vr?1:0))}catch{console.log("none")}' "$FDB"; }
gerr() { "$B/node" --disable-warning=ExperimentalWarning -e 'try{const d=new (require("node:sqlite").DatabaseSync)(process.argv[1],{readOnly:true});
  console.log(String(JSON.parse(d.prepare("SELECT v FROM kv WHERE k=?").get("gaadi_last").v).err||"").slice(0,160))}catch{}' "$FDB"; }
G=none; for i in $(seq 1 30); do G=$(glast); read -r GT _ <<<"$G"; [ "$G" != none ] && [ "$GT" -ge "$T0" ] && break; G=none; sleep 2; done
read -r _ GO GS GC GP GV <<<"$G"
if [ "$G" = none ]; then echo "FAILED  Vehicle number page: it did not read the billing's job cards in a minute. Send me a screenshot of this."
elif [ "$GO" != 1 ]; then echo "FAILED  Vehicle number page: no billing database lines in the front door's .env. Send me a screenshot of this."
elif [ "$GS" != ok ]; then echo "FAILED  Vehicle number page: the billing's job cards could not be read: $(gerr)"; echo "        Send me a screenshot of this."
else GA=0; echo "OK      Vehicle number page: $GC job cards of the billing read ($GP vehicles), new ones within 5 seconds"
  if [ "$GV" = 1 ]; then echo "OK      VR Garage is connected"
  else echo "NEXT    VR Garage is not connected yet. Once, to type its login (mobile number) and password:  bash $ME vrgarage"; fi
fi

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
[ $N = 0 ] && [ $C = 0 ] && [ $MISS = 0 ] && [ $ML = 0 ] && [ $CS = 0 ] && [ $IV = 0 ] && [ $FL = 0 ] && [ $GA = 0 ] && echo "All done." || echo "Something failed: send me a screenshot of this (it shows no passwords)."
