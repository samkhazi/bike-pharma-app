#!/usr/bin/env bash
# Bike Surgeon customer app: one-time setup on the CloudPanel server. Run as root. Safe to run again.
#
#   curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/scripts/server/setup.sh -o /root/bs-app-setup.sh && bash /root/bs-app-setup.sh
#
# What it does:
#   1. makes the site app.bikesurgeon.online in CloudPanel (Node 22, port 3050, site user bikesurgeon-app)
#   2. makes a PostgreSQL database for the app (installs PostgreSQL if it is missing)
#   3. writes the app's settings (~/shared/.env, only root and the site user can read it). The old billing login and
#      the Inventory key are copied from the admin panel's .env and never printed.
#   4. takes the code from GitHub, builds it and starts it (pm2 name bs-app); checks GitHub every 5 minutes after that
#   5. asks Let's Encrypt for the https certificate
# Test mode: only the phone numbers you give can log in, with one fixed code, and no SMS is sent.
# The old billing database is only read. Nothing in the other panels is changed.
main() {
set -euo pipefail

DOMAIN=${DOMAIN:-app.bikesurgeon.online}
SITE_USER=${SITE_USER:-bikesurgeon-app}
PORT=${PORT:-3050}
REPO_URL=${REPO_URL:-https://github.com/samkhazi/bike-pharma-app.git}
BRANCH=${BRANCH:-claude/project-thread-vczbd1}
PUBLIC_URL=${PUBLIC_URL:-https://$DOMAIN}
DB_NAME=${DB_NAME:-bikesurgeon_app}
DB_USER=${DB_USER:-bikesurgeon_app}
INV_ENV=${INV_ENV:-/home/bikesurgeon-inventory/htdocs/inventory.bikesurgeon.online/.env}
H=/home/$SITE_USER
ENV_FILE=$H/shared/.env
cd /tmp

[ "$(id -u)" = 0 ] || stop "run this as root (type  su -  first, then the same command again)"
for program in git curl openssl mysql flock crontab ss tar; do
  command -v "$program" >/dev/null || stop "the program '$program' is missing on this server"
done
command -v clpctl >/dev/null || stop "clpctl (CloudPanel) was not found: run this on the Bike Surgeon CloudPanel server"

# The admin panel already reads the old billing database; its login and the Inventory key are reused.
PANEL_ENV=${PANEL_ENV:-$(grep -ls '^OLD_DB_USER=' /home/*/htdocs/*/.env 2>/dev/null | grep -v "^$H/" | head -1 || true)}
[ -n "$PANEL_ENV" ] || stop "the admin panel's .env with OLD_DB_USER was not found (looked in /home/*/htdocs/*/.env)"

step "Questions (asked only the first time)"
if [ ! -f "$ENV_FILE" ] || [ -n "${TEST_PHONES:-}" ]; then
  ask TEST_PHONES "Test phone numbers that may log in (10 digits, comma between numbers):"
  PHONES=$(phones "$TEST_PHONES") || stop "test numbers must be 10-digit mobile numbers, for example 9876543210,9123456780"
fi
if [ ! -f "$ENV_FILE" ] || [ -n "${WORKSHOP_PHONE:-}" ]; then
  ask WORKSHOP_PHONE "Workshop phone number customers should call and WhatsApp (10 digits):"
  SHOP=$(phones "$WORKSHOP_PHONE") || stop "the workshop phone must be one 10-digit mobile number"
  case "$SHOP" in *,*) stop "give only one workshop phone number";; esac
fi
echo "ok"

if [ ! -f "$ENV_FILE" ] && ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q LISTEN; then
  stop "port $PORT is already used by another program; run again with another port, e.g.  PORT=3051 bash $0"
fi

step "Site $DOMAIN"
if [ ! -d "$H" ]; then
  clpctl site:add:nodejs --domainName="$DOMAIN" --nodejsVersion=22 --appPort="$PORT" --siteUser="$SITE_USER" \
    --siteUserPassword="$(openssl rand -hex 12)Aa1!" \
    || stop "CloudPanel could not make the site. Make it by hand (CloudPanel > Add Site > Node.js: domain $DOMAIN, Node 22, port $PORT, site user $SITE_USER) and run this again"
fi
[ -d "$H" ] || stop "the folder $H is missing after making the site"
echo "ok"

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
      echo "WEB_DIR=$H/current/app-frontend/dist"
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
chown -R "$SITE_USER:$SITE_USER" "$H/shared" "$H/logs" "$H/releases"
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
MARK="# bike-surgeon-app"
{
  crontab -u "$SITE_USER" -l 2>/dev/null | grep -v "$MARK" || true
  echo "@reboot export PATH=$NODE_BIN:/usr/bin:/bin; pm2 resurrect >/dev/null 2>&1 $MARK"
  echo "*/5 * * * * bash \$HOME/update.sh >> \$HOME/logs/update.log 2>&1 $MARK"
} | crontab -u "$SITE_USER" -
echo "ok"

step "https certificate"
if [ "${SKIP_SSL:-0}" = 1 ]; then
  echo "skipped (SKIP_SSL=1)"
elif clpctl lets-encrypt:install:certificate --domainName="$DOMAIN" >/dev/null 2>&1; then
  echo "ok"
else
  SSL_TODO=1
  echo "NOT YET: the domain does not point here yet. Check the 'app' record in Cloudflare (A, 72.62.246.246, DNS only), wait 5 minutes, then run:"
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
echo "App:          $PUBLIC_URL"
echo "Android app:  $PUBLIC_URL/download/bike-surgeon.apk (when the APK is ready)"
echo "Test login:   numbers $ALLOWED, code $CODE"
echo "Updates:      checked every 5 minutes, log $H/logs/update.log"
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
