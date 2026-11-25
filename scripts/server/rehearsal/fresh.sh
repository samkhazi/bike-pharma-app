#!/usr/bin/env bash
# CI rehearsal on a server without the app: the guards first (never the live app's site user, never another site's
# address), then the first setup, a tester's checks, running it again and new test numbers. The live app
# (app.bikesurgeon.online, site user bikesurgeon-app) must stay exactly as it was.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE/../../.."
live() { (cd /home/bikesurgeon-app && find . -printf '%p %u %g %m %s %T@\n' | sort; crontab -u bikesurgeon-app -l); }
live > /tmp/live-before

if SITE_USER=bikesurgeon-app bash scripts/server/setup.sh > /tmp/setup-0.log 2>&1; then
  cat /tmp/setup-0.log; echo "FAIL the setup used the live app's site user"; exit 1
fi
grep -q "the user bikesurgeon-app belongs to the site app.bikesurgeon.online; nothing was changed" /tmp/setup-0.log \
  || { cat /tmp/setup-0.log; echo "FAIL wrong reason"; exit 1; }
echo "PASS the live app's site user is never used"

bash scripts/server/setup.sh 2>&1 | tee /tmp/setup-1.log
grep -q "^All done" /tmp/setup-1.log
grep -q "^== Site api.bikesurgeon.online (site user bikesurgeon-api)" /tmp/setup-1.log
grep -A1 "^== https certificate" /tmp/setup-1.log | grep -qx "ok" || { echo "FAIL no certificate"; exit 1; }
grep -qxF "api.bikesurgeon.online" /etc/clp-sites || { echo "FAIL the site is not in CloudPanel"; exit 1; }
echo "PASS own site user bikesurgeon-api, site and certificate made"
bash "$HERE/check.sh"

env -u TEST_PHONES -u WORKSHOP_PHONE bash scripts/server/setup.sh > /tmp/setup-2.log 2>&1 || { cat /tmp/setup-2.log; exit 1; }
grep -q "^All done" /tmp/setup-2.log && echo "PASS running setup again is safe"
TEST_PHONES="9876543210, 9811100002" env -u WORKSHOP_PHONE bash scripts/server/setup.sh > /tmp/setup-3.log 2>&1 || { cat /tmp/setup-3.log; exit 1; }
grep -q "^All done" /tmp/setup-3.log && grep -q "restarted with the new test numbers" /tmp/setup-3.log
status=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d '{"phone":"9811100002"}' http://127.0.0.1:3050/v1/auth/otp/request)
case "$status" in 2??) echo "PASS a test number added later can log in";; *) echo "FAIL added number got $status"; exit 1;; esac

if DOMAIN=app.bikesurgeon.online SITE_USER=bikesurgeon-other PORT=3059 bash scripts/server/setup.sh > /tmp/setup-4.log 2>&1; then
  cat /tmp/setup-4.log; echo "FAIL took an address another site uses"; exit 1
fi
grep -q "already used by another site" /tmp/setup-4.log && ! id bikesurgeon-other >/dev/null 2>&1 && echo "PASS an address another site uses is never taken"

live > /tmp/live-after
diff /tmp/live-before /tmp/live-after || { echo "FAIL the live app's site user changed"; exit 1; }
echo "PASS the live app's files, logs and cron are exactly as they were"
echo "FRESH SERVER OK"
