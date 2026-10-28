#!/usr/bin/env bash
# One-time setup of brand_sync on the Bike Pharma server. Run as root:
#   bash /home/bikepharma/htdocs/bikepharma.com/brand_sync/setup.sh
# Makes the Python env (as the site user), installs the Chromium the syncs drive, writes or completes brand_sync/.env (logins stay
# empty: fill the Hero DMS, Honda and TVS logins yourself) and prints the cron lines. Nothing is scheduled by this script.
# Safe to run again: a value already in .env is never changed.
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
command -v pdftotext >/dev/null || apt-get install -y poppler-utils   # 16i: reads the Yamaha model catalogue PDFs the sync downloads
[ -d .venv ] || sudo -u "$U" python3 -m venv .venv || { apt-get install -y python3-venv && sudo -u "$U" python3 -m venv .venv; }
sudo -u "$U" .venv/bin/pip install -q --upgrade pip
sudo -u "$U" .venv/bin/pip install -q -r requirements.txt
.venv/bin/playwright install-deps chromium
sudo -u "$U" .venv/bin/playwright install chromium

mkdir -p "$SYNC/logs" "$SYNC/seed"
# start data from brand_sync.zip uploaded in Admin > Catalogue files > "Hero sync start data": Hero DMS (27 Oct 2026 full list),
# Honda (23 Oct 2026) and TVS (22 Oct 2026), so the first runs only fetch what changed after that
if [ -f "$SEED/brand_sync.zip" ]; then
  python3 - "$SEED/brand_sync.zip" "$SYNC/seed" <<'PY'
import sys, zipfile, os
z, out = zipfile.ZipFile(sys.argv[1]), sys.argv[2]
for n in z.namelist():
    if n.endswith('seed/hero_dms/parts.json') or n.endswith('seed/hero_dms/state.json'):
        if not os.path.exists(os.path.join(out, os.path.basename(n))): open(os.path.join(out, os.path.basename(n)), 'wb').write(z.read(n))
    for b in ('honda', 'tvs'):
        if n.endswith(f'seed/{b}/seed.json.gz'):
            os.makedirs(os.path.join(out, b), exist_ok=True); open(os.path.join(out, b, 'seed.json.gz'), 'wb').write(z.read(n))
print('start data ready:', ', '.join(b for b, f in (('Hero DMS', 'parts.json'), ('Honda', 'honda/seed.json.gz'), ('TVS', 'tvs/seed.json.gz')) if os.path.exists(os.path.join(out, f))))
PY
else echo "NOTE: upload brand_sync.zip in Admin > Catalogue files > Hero sync start data, then run this again (else the first runs fetch everything)"; fi
chown -R "$U" "$SYNC"
[ -f .env ] || { sed -e "s#^DATA_DIR=.*#DATA_DIR=$SYNC#" -e "s#^BRANDS=.*#BRANDS=hero,honda,tvs#" .env.example > .env; echo "brand_sync/.env made"; }
# fill what this server needs; a value already there is never changed (logins stay as they are)
setkey() { if grep -qE "^$1=.+" .env; then :; elif grep -qE "^$1=\$" .env; then sed -i "s#^$1=\$#$1=$2#" .env; else printf '%s=%s\n' "$1" "$2" >> .env; fi; }
grep -q '^# Bike Pharma server' .env || printf '\n# Bike Pharma server\n' >> .env
setkey SKIP_PDFS 1; setkey HERO_DMS_SEED "$SYNC/seed"; setkey HONDA_SEED "$SYNC/seed/honda/seed.json.gz"; setkey TVS_SEED "$SYNC/seed/tvs/seed.json.gz"
SITE_URL=$(val SITE_URL); SITE_URL=${SITE_URL:-https://bikepharma.com}
setkey CODE_BIND 127.0.0.1; setkey HONDA_CODE_LINK_BASE "$SITE_URL"; setkey TVS_OTP_LINK_BASE "$SITE_URL"; setkey REPORT_TO samkhazi25@gmail.com
for k in HERO_DMS_USER HERO_DMS_PASS HONDA_USER HONDA_PASS TVS_DEALER_ID TVS_USER TVS_PASS RE_EPC_USER RE_EPC_PASS RE_EPC_PROXY; do grep -qE "^$k=" .env || printf '%s=\n' "$k" >> .env; done
chown "$U" .env; chmod 600 .env
for k in HERO_DMS_USER HERO_DMS_PASS HONDA_USER HONDA_PASS TVS_DEALER_ID TVS_USER TVS_PASS RE_EPC_USER RE_EPC_PASS RE_EPC_PROXY; do grep -qE "^$k=.+" .env || echo "  $k khali hai: nano $BS/.env"; done

echo; echo "Hero e-catalogue from this server:"
curl -s -m 30 -X POST https://ecatalogue.heromotocorp.biz:8080/HeroeCat/getGeneralUserDetails | grep -q authToken && echo "  OK" || echo "  NOT reachable (the site answers only Indian IPs)"
echo; echo "Royal Enfield EPC from this server:"
c=$(curl -s -o /dev/null -w "%{http_code}" -m 30 https://epc.royalenfield.com/ACD/delivery || true)
[ "$c" = "403" ] && echo "  BLOCKED (RE Akamai: data-centre IP) -> RE_EPC_PROXY bharo (README: Royal Enfield)" || echo "  HTTP $c"
echo; echo "Done. Weekly runs (crontab -u $U -e), server time ($(date +%Z)):"
echo "0 21 * * 6  cd $BS && .venv/bin/python sync.py hero_dms >> $SYNC/logs/cron.log 2>&1"
echo "0 1 * * 0  cd $BS && .venv/bin/python sync.py hero >> $SYNC/logs/cron.log 2>&1"
echo "0 10 * * 0  cd $BS && .venv/bin/python sync.py honda >> $SYNC/logs/cron.log 2>&1   # login code: link comes by email"
echo "0 14 * * 0  cd $BS && .venv/bin/python sync.py tvs >> $SYNC/logs/cron.log 2>&1   # OTP: link comes by email"
echo "0 4 * * 0  cd $BS && .venv/bin/python sync.py re_spares >> $SYNC/logs/cron.log 2>&1   # RE spares store: MRP + models"
echo "0 5 * * 0  cd $BS && .venv/bin/python sync.py royal_enfield >> $SYNC/logs/cron.log 2>&1   # RE EPC: needs RE_EPC_PROXY (RE blocks this server IP)"
