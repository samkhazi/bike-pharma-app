#!/usr/bin/env bash
# One-time setup of brand_sync on the Bike Pharma server. Run as root:
#   bash /home/bikepharma/htdocs/bikepharma.com/brand_sync/setup.sh
# Makes the Python env (as the site user), installs the Chromium the Hero DMS sync drives, writes brand_sync/.env (logins stay
# empty: fill HERO_DMS_USER / HERO_DMS_PASS yourself) and prints the two cron lines. Nothing is scheduled by this script.
set -e
cd "$(dirname "$0")"
BS=$(pwd); SITE=$(dirname "$BS"); U=$(stat -c %U "$SITE")
val() { [ -f "$SITE/.env" ] && grep -E "^$1=" "$SITE/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'" || true; }
DATA=$(val DATA_DIR); DATA=${DATA:-data}; case "$DATA" in /*) ;; *) DATA="$SITE/$DATA";; esac
FILES=$(val FILES_DIR); FILES=${FILES:-$DATA/project-files}; case "$FILES" in /*) ;; *) FILES="$SITE/$FILES";; esac
SYNC="$FILES/catalogues/hero-sync"; SEED="$FILES/catalogues/hero-dms-seed"   # SEED = the uploaded zip's folder
echo "site $SITE (user $U)"; echo "sync data $SYNC"

command -v python3 >/dev/null || { echo "python3 missing: apt-get install -y python3 python3-venv"; exit 1; }
python3 -m venv --help >/dev/null 2>&1 || apt-get install -y python3-venv
[ -d .venv ] || sudo -u "$U" python3 -m venv .venv || { apt-get install -y python3-venv && sudo -u "$U" python3 -m venv .venv; }
sudo -u "$U" .venv/bin/pip install -q --upgrade pip
sudo -u "$U" .venv/bin/pip install -q -r requirements.txt
.venv/bin/playwright install-deps chromium
sudo -u "$U" .venv/bin/playwright install chromium

mkdir -p "$SYNC/logs" "$SYNC/seed"
# Hero DMS start data (27 Oct 2026 full list): from brand_sync.zip uploaded in Admin > Catalogue files > "Hero sync start data"
if [ -f "$SEED/brand_sync.zip" ] && [ ! -f "$SYNC/seed/parts.json" ]; then
  python3 - "$SEED/brand_sync.zip" "$SYNC/seed" <<'PY'
import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1])
for n in z.namelist():
    if n.endswith('seed/hero_dms/parts.json') or n.endswith('seed/hero_dms/state.json'):
        open(os.path.join(sys.argv[2], os.path.basename(n)), 'wb').write(z.read(n))
PY
  echo "Hero DMS start data ready"
elif [ ! -f "$SYNC/seed/parts.json" ]; then echo "NOTE: upload brand_sync.zip in Admin > Catalogue files > Hero sync start data, then run this again (else the first DMS run fetches everything)"; fi
chown -R "$U" "$SYNC"
if [ ! -f .env ]; then
  sed -e "s#^DATA_DIR=.*#DATA_DIR=$SYNC#" -e "s#^BRANDS=.*#BRANDS=hero#" .env.example > .env
  printf '\n# Bike Pharma server\nSKIP_PDFS=1\nHERO_DMS_SEED=%s\n' "$SYNC/seed" >> .env
  chown "$U" .env; chmod 600 .env
  echo "brand_sync/.env made: put HERO_DMS_USER and HERO_DMS_PASS in it (nano $BS/.env)"
else echo "brand_sync/.env already there, kept"; fi

echo; echo "Hero e-catalogue from this server:"
curl -s -m 30 -X POST https://ecatalogue.heromotocorp.biz:8080/HeroeCat/getGeneralUserDetails | grep -q authToken && echo "  OK" || echo "  NOT reachable (the site answers only Indian IPs)"
echo; echo "Done. To run every week, add these two lines with: crontab -u $U -e"
echo "0 21 * * 6  cd $BS && .venv/bin/python sync.py hero_dms >> $SYNC/logs/cron.log 2>&1"
echo "0 1 * * 0  cd $BS && .venv/bin/python sync.py hero >> $SYNC/logs/cron.log 2>&1"
