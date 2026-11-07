#!/usr/bin/env bash
# RE weekly: EPC + spares. Error khud sync.py report se mail hota hai; ye wrapper sirf crash (OOM/kill/traceback) par mail karta hai.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")" || exit 1
mkdir -p data/logs
exec 9>/var/lock/re_weekly.lock
flock -n 9 || { echo "$(date -Is) already running, skip" >>data/logs/re_cron.log; exit 0; }
LOG="data/logs/re_cron_$(date +%F_%H%M).log"
for brand in re_spares royal_enfield; do
  echo "$(date -Is) START $brand" >>"$LOG"
  xvfb-run -a .venv/bin/python sync.py "$brand" >>"$LOG" 2>&1
  rc=$?
  echo "$(date -Is) END $brand rc=$rc" >>"$LOG"
  if [ "$rc" -ne 0 ]; then
    .venv/bin/python - "$brand" "$rc" "$LOG" <<'PY' >>"$LOG" 2>&1 || true
import sys
from notify import send
send(open(sys.argv[3], encoding='utf-8', errors='replace').read()[-4000:],
     subject='RE sync CRASH: %s rc=%s' % (sys.argv[1], sys.argv[2]))
PY
  fi
done
find data/logs -name 're_cron_*.log' -mtime +30 -delete 2>/dev/null
