#!/usr/bin/env bash
# update 19n: puts brand_sync/crontab.txt in place as the site user's crontab (run as root). The crontab it replaces is kept beside the logs.
set -e
D="$(cd "$(dirname "$0")" && pwd)"; U="$(stat -c %U "$D")"
[ -s "$D/crontab.txt" ] || { echo "crontab.txt missing"; exit 1; }
grep -q 'sync.py hero ' "$D/crontab.txt" && grep -q 'sync.py tvs ' "$D/crontab.txt" || { echo "crontab.txt looks wrong, nothing changed"; exit 1; }
K="/home/$U/crontab.before-$(date +%F_%H%M).txt"
crontab -l -u "$U" > "$K" 2>/dev/null || true
crontab -u "$U" "$D/crontab.txt"
echo "OK: crontab of $U replaced (old one kept at $K). Now:"
crontab -l -u "$U" | grep -v '^#' | grep -v '^$'
