#!/usr/bin/env bash
# Bike Surgeon customer app: one-time setup on the CloudPanel server. Run as root. Safe to run again.
#
#   curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/scripts/server/setup.sh -o /root/bs-app-setup.sh && bash /root/bs-app-setup.sh
#
# What it does:
#   1. makes the site api.bikesurgeon.online in CloudPanel (Node 22, port 3050, its own site user bikesurgeon-api);
#      the app talks to it. It never uses an address or a site user that belongs to another site.
#   2. makes a PostgreSQL database for the app (installs PostgreSQL if it is missing)
#   3. writes the app's settings (~/shared/.env, only root and the site user can read it). The old billing login and
#      the Inventory key are copied from the admin panel's .env and never printed.
#   4. takes the code from GitHub, builds it and starts it (pm2 name bs-app); checks GitHub every 5 minutes after that
#   5. asks Let's Encrypt for the https certificate
# Test mode: only the phone numbers you give can log in, with one fixed code, and no SMS is sent.
# The old billing database is only read. Nothing in the other panels is changed.
# The first version of this script (25 Nov 2026) put the app into the site user of the live app.bikesurgeon.online
# (bikesurgeon-app) because that user already existed. Running this version moves the app out of there: it stops the app
# there, takes its settings, removes only its own cron lines and parks its own files in /root. The live app is not touched.
main() {
set -euo pipefail

DOMAIN=${DOMAIN:-api.bikesurgeon.online}
SITE_USER=${SITE_USER:-bikesurgeon-api}
PORT=${PORT:-3050}
REPO_URL=${REPO_URL:-https://github.com/samkhazi/bike-pharma-app.git}
BRANCH=${BRANCH:-claude/project-thread-vczbd1}
PUBLIC_URL=${PUBLIC_URL:-https://$DOMAIN}
DB_NAME=${DB_NAME:-bikesurgeon_app}
DB_USER=${DB_USER:-bikesurgeon_app}
INV_ENV=${INV_ENV:-/home/bikesurgeon-inventory/htdocs/inventory.bikesurgeon.online/.env}
H=/home/$SITE_USER
ENV_FILE=$H/shared/.env
MARK="# bike-surgeon-app"
cd /tmp

[ "$(id -u)" = 0 ] || stop "run this as root (type  su -  first, then the same command again)"
for program in git curl openssl mysql flock crontab ss tar; do
  command -v "$program" >/dev/null || stop "the program '$program' is missing on this server"
done
command -v clpctl >/dev/null || stop "clpctl (CloudPanel) was not found: run this on the Bike Surgeon CloudPanel server"

# The admin panel already reads the old billing database; its login and the Inventory key are reused.
PANEL_ENV=${PANEL_ENV:-$(grep -ls '^OLD_DB_USER=' /home/*/htdocs/*/.env 2>/dev/null | grep -v "^$H/" | head -1 || true)}
[ -n "$PANEL_ENV" ] || stop "the admin panel's .env with OLD_DB_USER was not found (looked in /home/*/htdocs/*/.env)"

# The address and the site user must be this app's own (checked before anything is changed).
for dir in /home/*/htdocs/"$DOMAIN"; do
  if [ -d "$dir" ] && [ "$dir" != "$H/htdocs/$DOMAIN" ]; then
    stop "the address $DOMAIN is already used by another site on this server (${dir%/htdocs/*}); nothing was changed"
  fi
done
if [ ! -d "$H/htdocs/$DOMAIN" ] && ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -qxF "$DOMAIN.conf"; then
  stop "the address $DOMAIN is already used by another site on this server; nothing was changed"
fi
if [ -d "$H" ] || id "$SITE_USER" >/dev/null 2>&1; then
  OTHER_SITE=$(sites_of "$H" | grep -vxF "$DOMAIN" | head -1 || true)
  if [ -n "$OTHER_SITE" ]; then
    stop "the user $SITE_USER belongs to the site $OTHER_SITE; nothing was changed. Run again with a new user, e.g.  SITE_USER=bikesurgeon-api2 bash $0"
  fi
  [ -d "$H/htdocs/$DOMAIN" ] \
    || stop "the user $SITE_USER already exists but has no site $DOMAIN; nothing was changed. Run again with a new user, e.g.  SITE_USER=bikesurgeon-api2 bash $0"
fi

# An install of this app in another site's user (made by the first version of this script) is moved here below.
OLD_H=""
if [ ! -f "$ENV_FILE" ]; then
  for envf in /home/*/shared/.env; do
    old=${envf%/shared/.env}
    [ -f "$envf" ] && [ "$old" != "$H" ] && [ ! -d "$old/htdocs/$DOMAIN" ] || continue
    first=""; IFS= read -r first < "$envf" || true
    case "$first" in "# Bike Surgeon customer app. Made by scripts/server/setup.sh"*) OLD_H=$old;; esac
  done
fi
if [ -n "$OLD_H" ]; then
  OLD_USER=${OLD_H##*/}
  [ "$OLD_USER" != root ] && id "$OLD_USER" >/dev/null 2>&1 && [ "$(stat -c %U "$OLD_H/shared")" = "$OLD_USER" ] \
    || stop "found an old copy of the app in $OLD_H but could not tell its user; nothing was changed"
  OLD_SITE=$(sites_of "$OLD_H" | head -1 || true)
  OLD_PORT=$(sed -n 's/^PORT=//p' "$OLD_H/shared/.env" | tail -1)
  PORT=${OLD_PORT:-$PORT}
fi

step "Questions (asked only the first time)"
if [ -n "$OLD_H" ]; then
  # moving: the settings come along, only the test numbers may be changed now
  ask_or_keep TEST_PHONES "Test phone numbers that may log in, comma between numbers (now $(sed -n 's/^LOGIN_ALLOWLIST=//p' "$OLD_H/shared/.env" | tail -1); press Enter to keep them):"
  if [ -n "${TEST_PHONES:-}" ]; then
    PHONES=$(phones "$TEST_PHONES") || stop "test numbers must be 10-digit mobile numbers, for example 9876543210,9123456780"
  fi
elif [ ! -f "$ENV_FILE" ] || [ -n "${TEST_PHONES:-}" ]; then
  ask TEST_PHONES "Test phone numbers that may log in (10 digits, comma between numbers):"
  PHONES=$(phones "$TEST_PHONES") || stop "test numbers must be 10-digit mobile numbers, for example 9876543210,9123456780"
fi
if [ -n "${WORKSHOP_PHONE:-}" ] || { [ ! -f "$ENV_FILE" ] && [ -z "$OLD_H" ]; }; then
  ask WORKSHOP_PHONE "Workshop phone number customers should call and WhatsApp (10 digits):"
  SHOP=$(phones "$WORKSHOP_PHONE") || stop "the workshop phone must be one 10-digit mobile number"
  case "$SHOP" in *,*) stop "give only one workshop phone number";; esac
fi
echo "ok"

if [ ! -f "$ENV_FILE" ] && [ -z "$OLD_H" ] && ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q LISTEN; then
  stop "port $PORT is already used by another program; run again with another port, e.g.  PORT=3051 bash $0"
fi

if [ -n "$OLD_H" ]; then
  step "Stopping the app in $OLD_H (the site user of ${OLD_SITE:-another site}; nothing of that site is changed)"
  stop_old_install
fi

step "Site $DOMAIN (site user $SITE_USER)"
if [ ! -d "$H" ]; then
  clpctl site:add:nodejs --domainName="$DOMAIN" --nodejsVersion=22 --appPort="$PORT" --siteUser="$SITE_USER" \
    --siteUserPassword="$(openssl rand -hex 12)Aa1!" \
    || stop "CloudPanel could not make the site. Make it by hand (CloudPanel > Add Site > Node.js: domain $DOMAIN, Node 22, port $PORT, site user $SITE_USER) and run this again"
fi
[ -d "$H/htdocs/$DOMAIN" ] || stop "CloudPanel did not make the site (the folder $H/htdocs/$DOMAIN is missing). Make it by hand (CloudPanel > Add Site > Node.js: domain $DOMAIN, Node 22, port $PORT, site user $SITE_USER) and run this again"
echo "ok"

if [ -n "$OLD_H" ]; then
  step "Moving the app's settings here and its old files out of $OLD_H"
  move_old_install
fi

step "Node 22 and pm2 for $SITE_USER"
if ! ls -d "$H"/.nvm/versions/node/v22*/bin >/dev/null 2>&1; then
  as_site '[ -s "$HOME/.nvm/nvm.sh" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
    . "$HOME/.nvm/nvm.sh" && nvm install 22 >/dev/null'
fi
NODE_BIN=$(ls -d "$H"/.nvm/versions/node/v22*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$NODE_BIN" ] || stop "Node 22 could not be installed for $SITE_USER"
as_site "export PATH=$NODE_BIN:\$PATH; command -v pm2 >/dev/null || npm i -g pm2 --no-audit --no-fund --loglevel=error >/dev/null"
echo "node $("$NODE_BIN/node" -v)"

step "PostgreSQL database"
if ! command -v psql >/dev/null || ! id postgres >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  { apt-get install -y -qq postgresql >/dev/null 2>&1 || { apt-get update -qq >/dev/null && apt-get install -y -qq postgresql >/dev/null; }; } \
    || stop "PostgreSQL could not be installed"
fi
if [ -d /run/systemd/system ]; then systemctl enable --now postgresql >/dev/null 2>&1 || true; else service postgresql start >/dev/null 2>&1 || true; fi
for _ in $(seq 1 15); do pg -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done
if ! pg -c "SELECT 1" >/dev/null 2>&1; then
  for version in $(ls /etc/postgresql 2>/dev/null); do pg_ctlcluster "$version" main start >/dev/null 2>&1 || true; done
  for _ in $(seq 1 15); do pg -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done
fi
pg -c "SELECT 1" >/dev/null 2>&1 || stop "PostgreSQL does not start"
PG_PORT=$(pg -c "SHOW port")
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS=$(openssl rand -hex 16)
  if [ "$(pg -c "SELECT count(*) FROM pg_roles WHERE rolname = '$DB_USER'")" = 1 ]; then
    pg -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS'" >/dev/null
  else
    pg -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS'" >/dev/null
  fi
  [ "$(pg -c "SELECT count(*) FROM pg_database WHERE datname = '$DB_NAME'")" = 1 ] || pg -c "CREATE DATABASE $DB_NAME OWNER $DB_USER" >/dev/null
fi
echo "PostgreSQL $(pg -c "SHOW server_version" | cut -d' ' -f1), database $DB_NAME"

step "App settings ($ENV_FILE)"
mkdir -p "$H/shared" "$H/logs" "$H/releases"
if [ ! -f "$ENV_FILE" ]; then
  INV_URL_LINE=$(sed -n 's/^INV_URL=/INVENTORY_URL=/p' "$PANEL_ENV" | tail -1)
  INV_KEY_LINE=$(sed -n 's/^INV_FEED_KEY=/INVENTORY_FEED_KEY=/p' "$PANEL_ENV" | tail -1)
  if [ -z "$INV_KEY_LINE" ] && [ -f "$INV_ENV" ]; then INV_KEY_LINE=$(sed -n 's/^FEED_KEY=/INVENTORY_FEED_KEY=/p' "$INV_ENV" | tail -1); fi
  [ -n "$INV_URL_LINE" ] || INV_URL_LINE="INVENTORY_URL=http://127.0.0.1:3021"
  ( umask 077
    {
      echo "# Bike Surgeon customer app. Made by scripts/server/setup.sh on $(date +%F). Secrets live only in this file."
      echo "NODE_ENV=production"
      echo "PORT=$PORT"
      echo "PUBLIC_BASE_URL=$PUBLIC_URL"
      echo "CORS_ORIGINS=$PUBLIC_URL,https://localhost,capacitor://localhost,http://localhost"
      echo "DATABASE_URL=postgres://$DB_USER:$DB_PASS@127.0.0.1:$PG_PORT/$DB_NAME"
      echo "JWT_SECRET=$(openssl rand -hex 32)"
      echo "INTEGRATION_API_KEYS=$(openssl rand -hex 24)"
      echo "TIMEZONE=Asia/Kolkata"
      echo "# Test mode: only these numbers can log in, with TEST_LOGIN_CODE, and no SMS is sent."
      echo "OTP_PROVIDER=console"
      echo "LOGIN_ALLOWLIST=$PHONES"
      echo "TEST_LOGIN_CODE=$(shuf -i 1000-9999 -n 1)"
      echo "WEB_DIR=$H/current/public"
      echo "# Old billing database (read only) and Inventory, copied from $PANEL_ENV"
      echo "BRIDGE=on"
      grep -E '^(OLD_DB_HOST|OLD_DB_PORT|OLD_DB_USER|OLD_DB_PASS|OLD_DB_BS|OLD_DB_PUBKEY|MYSQL_BIN)=' "$PANEL_ENV" || true
      echo "OLD_DB_WRITE=off"
      if [ -n "$INV_KEY_LINE" ]; then echo "$INV_URL_LINE"; echo "$INV_KEY_LINE"; fi
    } > "$ENV_FILE" )
  [ -n "$INV_KEY_LINE" ] || echo "Note: no Inventory key found, so parts prices from the Inventory are off for now."
elif [ -n "${PHONES:-}" ] && ! grep -qx "LOGIN_ALLOWLIST=$PHONES" "$ENV_FILE"; then
  if grep -q '^LOGIN_ALLOWLIST=' "$ENV_FILE"; then
    sed -i "s/^LOGIN_ALLOWLIST=.*/LOGIN_ALLOWLIST=$PHONES/" "$ENV_FILE"
  else
    echo "LOGIN_ALLOWLIST=$PHONES" >> "$ENV_FILE"
  fi
  ENV_CHANGED=1
fi
# the update log is written by the site user from cron (a root-owned file would stop the 5-minute updates)
touch "$H/logs/update.log"
chown -R "$SITE_USER:$SITE_USER" "$H/shared" "$H/releases"
chown "$SITE_USER:$SITE_USER" "$H/logs" "$H/logs/update.log"
chmod 600 "$ENV_FILE"
echo "ok (old billing login and keys copied, not shown)"

step "Code from GitHub ($BRANCH)"
if [ ! -d "$H/repo/.git" ]; then
  as_site "git clone -q --depth 1 --branch '$BRANCH' '$REPO_URL' \"\$HOME/repo\"" || stop "the code could not be downloaded from GitHub"
fi
cp "$H/repo/scripts/server/update.sh" "$H/update.sh"
chown "$SITE_USER:$SITE_USER" "$H/update.sh"
chmod 700 "$H/update.sh"
echo "ok"

step "Build and start (takes a few minutes the first time)"
FIRST=1
if [ -e "$H/current/.commit" ] && [ ! -f "$H/.failed" ]; then FIRST=0; fi
as_site "FORCE=$FIRST bash \"\$HOME/update.sh\"" 2>&1 | tee -a "$H/logs/update.log" | sed 's/^/   /' || true
[ -e "$H/current/.commit" ] || stop "the app did not build or start; see $H/logs/update.log"
if [ "${ENV_CHANGED:-0}" = 1 ]; then
  as_site "export PATH=$NODE_BIN:\$PATH; pm2 restart bs-app >/dev/null" || stop "the app could not restart with the new settings"
  echo "restarted with the new test numbers"
fi

step "Workshop details"
WS_SQL="UPDATE workshops SET updated_at = now()"
[ -z "${SHOP:-}" ] || WS_SQL="UPDATE workshops SET phone = '+91$SHOP', whatsapp = '+91$SHOP', roadside_phone = '+91$SHOP', updated_at = now()"
db_as_app "$WS_SQL"
# The sample people and bays of the reference data are switched off: the real ones come from the old billing.
db_as_app "UPDATE staff SET active = false WHERE code IN ('ADV-AMIT', 'MEC-RAHUL', 'RID-ARJUN');
           UPDATE bays SET active = false WHERE id::text LIKE '00000000-0000-4000-8000-0000000002%'"
echo "ok"

step "Restart on reboot and update every 5 minutes"
{
  crontab -u "$SITE_USER" -l 2>/dev/null | grep -v "$MARK" || true
  echo "@reboot export PATH=$NODE_BIN:/usr/bin:/bin; pm2 resurrect >/dev/null 2>&1 $MARK"
  echo "*/5 * * * * bash \$HOME/update.sh >> \$HOME/logs/update.log 2>&1 $MARK"
} | crontab -u "$SITE_USER" -
echo "ok"

step "https certificate"
if [ "${SKIP_SSL:-0}" = 1 ]; then
  echo "skipped (SKIP_SSL=1)"
elif cert_ok; then
  echo "ok (already there; CloudPanel renews it)"
elif SSL_OUT=$(clpctl lets-encrypt:install:certificate --domainName="$DOMAIN" 2>&1); then
  echo "ok"
else
  SSL_TODO=1
  echo "NOT YET. CloudPanel said:"
  printf '%s\n' "$SSL_OUT" | tail -n 6 | sed 's/^/   /'
  echo "Check the '${DOMAIN%%.*}' record in Cloudflare (A, 72.62.246.246, DNS only), wait 5 minutes, then run:"
  echo "   clpctl lets-encrypt:install:certificate --domainName=$DOMAIN"
fi

step "Check"
READY=0
for _ in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/health/ready" >/dev/null 2>&1 && READY=1 && break; sleep 2; done
[ "$READY" = 1 ] || stop "the app does not answer on port $PORT; see: su - $SITE_USER -c 'pm2 logs bs-app --lines 50'"
sleep 3
grep -h '\[bridge\]' "$H"/.pm2/logs/bs-app-out*.log 2>/dev/null | tail -2 | sed 's/^/   /' || true
CODE=$(sed -n 's/^TEST_LOGIN_CODE=//p' "$ENV_FILE")
ALLOWED=$(sed -n 's/^LOGIN_ALLOWLIST=//p' "$ENV_FILE")
echo
echo "Server:       $PUBLIC_URL (for the app only, no web pages)"
echo "Android app:  $PUBLIC_URL/download/bike-surgeon.apk"
echo "Test login:   numbers $ALLOWED, code $CODE"
echo "Updates:      checked every 5 minutes, log $H/logs/update.log"
[ -z "${PARK:-}" ] || echo "Moved:        out of $OLD_H; its old files are parked in $PARK"
[ -z "${SSL_TODO:-}" ] || echo "Still to do:  the https certificate (see above)"
echo
echo "All done"
}

step() { printf '\n== %s\n' "$*"; }
stop() { printf '\nSTOPPED: %s\nFix this and run the same command again (it is safe to run again).\n' "$*" >&2; exit 1; }
as_site() { su - "$SITE_USER" -s /bin/bash -c "$1"; }
pg() { runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -qtA "$@"; }
db_as_app() {
  # runs SQL in the app's database with the app's own login (read from .env, never printed)
  local url; url=$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | tail -1)
  PGCONNECT_TIMEOUT=10 runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -qtA "$url" -c "$1" >/dev/null
}
ask() {
  local var=$1 question=$2 answer=""
  [ -z "${!var:-}" ] || return 0
  [ -r /dev/tty ] || stop "$var is needed (run the command in a terminal)"
  read -r -p "$question " answer < /dev/tty
  printf -v "$var" '%s' "$answer"
}
sites_of() {
  # the sites of a site user: the folders in its htdocs (CloudPanel also puts files there, such as .gitignore)
  find "$1/htdocs" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort
}
ask_or_keep() {
  # like ask, but Enter (or no terminal) keeps what there is
  local var=$1 question=$2 answer=""
  [ -z "${!var:-}" ] || return 0
  if { exec 3</dev/tty; } 2>/dev/null; then
    read -r -p "$question " answer <&3 || answer=""
    exec 3<&-
  fi
  printf -v "$var" '%s' "$answer"
}
stop_old_install() {
  # The app was put into another site's user ($OLD_H). Stop it there: only this app's cron lines and pm2 process.
  local keep old_bin
  # no more updates there, and wait for an update that may be running
  if crontab -u "$OLD_USER" -l >/dev/null 2>&1; then
    keep=$(crontab -u "$OLD_USER" -l 2>/dev/null | grep -v -- " $MARK\$" || true)
    if [ -n "$keep" ]; then printf '%s\n' "$keep" | crontab -u "$OLD_USER" -; else crontab -u "$OLD_USER" -r; fi
  fi
  if [ -e "$OLD_H/.update.lock" ]; then
    flock -w 300 "$OLD_H/.update.lock" true || stop "an update in $OLD_H is still running; wait 5 minutes and run this again"
  fi
  # the app itself (pm2 too, but only when it runs nothing else)
  old_bin=$(ls -d "$OLD_H"/.nvm/versions/node/v22*/bin 2>/dev/null | sort -V | tail -1 || true)
  if [ -n "$old_bin" ] && [ -x "$old_bin/pm2" ]; then
    su - "$OLD_USER" -s /bin/bash -c "export PATH=$old_bin:\$PATH; pm2 delete bs-app >/dev/null 2>&1; pm2 save --force >/dev/null 2>&1; [ \"\$(pm2 jlist 2>/dev/null)\" != '[]' ] || pm2 kill >/dev/null 2>&1; true" || true
  fi
  for _ in $(seq 1 15); do ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q LISTEN || break; sleep 1; done
  if ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q LISTEN; then
    stop "the app in $OLD_H still runs on port $PORT. Stop it with:  su - $OLD_USER -c 'pm2 delete bs-app'  and run this again"
  fi
  echo "ok"
}
move_old_install() {
  # Its settings come here (same database, secrets and test code); only the files this app made there are parked in /root.
  local url ours r f
  mkdir -p "$H/shared"
  ( umask 077; sed "s#$OLD_H/#$H/#g" "$OLD_H/shared/.env" > "$ENV_FILE.new" )
  mv -f "$ENV_FILE.new" "$ENV_FILE"
  PARK=/root/bs-app-moved-from-$OLD_USER-$(date +%Y%m%d-%H%M%S)
  mkdir -p "$PARK"
  chmod 700 "$PARK"
  url=$(git -c safe.directory='*' -C "$OLD_H/repo" remote get-url origin 2>/dev/null || true)
  case "$url" in "$REPO_URL"|*samkhazi/bike-pharma-app*) park repo;; esac
  if [ -d "$OLD_H/releases" ]; then
    ours=1
    for r in "$OLD_H"/releases/* "$OLD_H"/releases/.[!.]*; do
      [ -e "$r" ] || [ -L "$r" ] || continue
      [[ "${r##*/}" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{7}$ ]] || ours=0
    done
    [ "$ours" = 0 ] || park releases
  fi
  case "$(readlink "$OLD_H/current" 2>/dev/null || true)" in "$OLD_H/releases/"*) park current;; esac
  if [ "$(ls -1A "$OLD_H/shared" 2>/dev/null)" = ".env" ]; then park shared; else park shared/.env; fi
  for f in update.sh update.sh.new; do
    [ ! -f "$OLD_H/$f" ] || ! grep -q 'Bike Surgeon customer app' "$OLD_H/$f" || park "$f"
  done
  [ ! -f "$OLD_H/.update.lock" ] || [ -s "$OLD_H/.update.lock" ] || park .update.lock
  ! grep -qxE '[0-9a-f]{40}' "$OLD_H/.failed" 2>/dev/null || park .failed
  park logs/update.log logs/update.log.tmp
  for f in "$OLD_H"/.pm2/logs/bs-app-*.log; do [ ! -f "$f" ] || park ".pm2/logs/${f##*/}"; done
  echo "ok (the site ${OLD_SITE:-of $OLD_USER} was not touched)"
}
park() {
  local p
  for p in "$@"; do
    [ -e "$OLD_H/$p" ] || [ -L "$OLD_H/$p" ] || continue
    mkdir -p "$PARK/$(dirname "$p")"
    mv "$OLD_H/$p" "$PARK/$p"
    echo "   parked $OLD_H/$p"
  done
}
cert_ok() {
  # a Let's Encrypt certificate for the address, good for 30 more days, is already served here
  local pem
  pem=$(echo | timeout 15 openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null | openssl x509 2>/dev/null || true)
  [ -n "$pem" ] || return 1
  printf '%s\n' "$pem" | openssl x509 -noout -checkend 2592000 >/dev/null 2>&1 || return 1
  printf '%s\n' "$pem" | openssl x509 -noout -issuer 2>/dev/null | grep -qi "let's encrypt" || return 1
  printf '%s\n' "$pem" | openssl x509 -noout -ext subjectAltName 2>/dev/null | grep -qF "DNS:$DOMAIN"
}
phones() {
  # "98765 43210, +91 91234-56780" -> "9876543210,9123456780"; fails on anything that is not a mobile number
  local out="" item digits
  IFS=',' read -ra items <<< "$1"
  for item in "${items[@]}"; do
    digits=$(printf '%s' "$item" | tr -cd '0-9')
    [ -z "$digits" ] && continue
    digits=${digits: -10}
    [[ "$digits" =~ ^[6-9][0-9]{9}$ ]] || return 1
    out="${out:+$out,}$digits"
  done
  [ -n "$out" ] || return 1
  printf '%s' "$out"
}

main "$@"; exit $?
