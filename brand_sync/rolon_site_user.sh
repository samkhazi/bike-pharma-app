#!/usr/bin/env bash
# update 19q (11 Nov 2026): the Rolon catalogue PDF job runs as the site user, not root.
# Why: Chrome does not print as root with its sandbox on, and the sandbox stays on. As the site user it prints as it is.
# Run once as root after rolon_install.sh:  bash /home/bikepharma/htdocs/bikepharma.com/brand_sync/rolon_site_user.sh
# Moves /root/rolon_pdf4.py + /root/rolon_dump to the site user's home (nothing inside is changed), takes the Rolon line
# out of root's crontab (the line is in brand_sync/crontab.txt now), then builds the PDF once the way cron will.
set -u
D="$(cd "$(dirname "$0")" && pwd)"
U="${ROLON_USER:-$(stat -c %U "$D")}"; R="${ROLON_FROM:-/root}"; H="${ROLON_HOME:-/home/$U}"
[ "$(id -u)" = "0" ] || [ -n "${ROLON_TEST:-}" ] || { echo "run as root"; exit 1; }
if [ -d "$R/rolon_dump" ]; then
  [ -e "$H/rolon_dump" ] && { echo "$H/rolon_dump is already there: not moving again"; } || mv "$R/rolon_dump" "$H/rolon_dump"
fi
[ -f "$R/rolon_pdf4.py" ] && [ ! -e "$H/rolon_pdf4.py" ] && mv "$R/rolon_pdf4.py" "$H/rolon_pdf4.py"
[ -s "$H/rolon_pdf4.py" ] && [ -s "$H/rolon_dump/_state.json" ] && [ -x "$H/rolon_dump/rolon_weekly.sh" ] || { echo "FATAL: Rolon files not found in $H (run rolon_install.sh first)"; exit 1; }
[ -d "$R/rolon_out" ] && rmdir "$R/rolon_out" 2>/dev/null
mkdir -p "$H/rolon_out"; rm -rf "$H/rolon_dump/.lock.d"
chown -R "$U": "$H/rolon_pdf4.py" "$H/rolon_dump" "$H/rolon_out"
# root's crontab: only the Rolon line goes
T="$(crontab -l 2>/dev/null | grep -v rolon_weekly || true)"; printf '%s\n' "$T" | crontab -
echo "--- root cron ---"; crontab -l
bash "$D/install_cron.sh" | grep -i 'rolon\|OK:\|wrong'
echo "--- build as $U, cron-like (2-6 min) ---"
sudo -u "$U" -H env -i HOME="$H" PATH=/usr/bin:/bin /bin/bash "$H/rolon_dump/rolon_weekly.sh"; RC=$?
echo "rc=$RC"; tail -6 "$H/rolon_dump/logs/run_$(date +%F).log" 2>/dev/null
ls -lh "$H/rolon_out"
[ "$RC" -eq 0 ] && echo "STATUS: OK" || echo "STATUS: CHECK rc=$RC"
