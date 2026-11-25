#!/usr/bin/env bash
# CI rehearsal of the real server on 25 Nov 2026: the first version of setup.sh (commit 2121f58) found the site user
# bikesurgeon-app (it belongs to the live app.bikesurgeon.online), put the app into it and made no api site, so the
# certificate failed. Running the new setup must move the app into its own site user and leave the live app as it was.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE/../../.."
V1=2121f58ff12f002e4a9b10bfc0381a069b187cc5
fail() { echo "FAIL $*"; exit 1; }
git fetch -q --depth=1 origin "$V1"
git show "$V1:scripts/server/setup.sh" > /tmp/setup-v1.sh
live_files() { (cd /home/bikesurgeon-app/htdocs && find . -printf '%p %u %g %m %s %T@\n' | sort); }
live_files > /tmp/live-files-before
crontab -u bikesurgeon-app -l > /tmp/live-cron-before

# 1. what the first version did on the server
bash /tmp/setup-v1.sh > /tmp/setup-v1.log 2>&1 || { cat /tmp/setup-v1.log; fail "the first version did not run"; }
grep -q "^All done" /tmp/setup-v1.log || { cat /tmp/setup-v1.log; fail "the first version did not finish"; }
[ -f /home/bikesurgeon-app/shared/.env ] && [ ! -d /home/bikesurgeon-api ] || fail "the server's state was not reproduced"
grep -q 'does not exist' /tmp/clpctl.log 2>/dev/null || grep -q '^NOT YET' /tmp/setup-v1.log || fail "the certificate did not fail like on the server"
curl -fsS http://127.0.0.1:3050/health/ready >/dev/null || fail "the first version's app does not run"
CODE=$(sed -n 's/^TEST_LOGIN_CODE=//p' /home/bikesurgeon-app/shared/.env)
echo "PASS the server of 25 Nov is reproduced: the app inside bikesurgeon-app, no api site, no certificate"

# 2. the new setup moves it
bash scripts/server/setup.sh 2>&1 | tee /tmp/setup-move.log
grep -q "^All done" /tmp/setup-move.log || fail "the new setup did not finish"
grep -q "^== Stopping the app in /home/bikesurgeon-app (the site user of app.bikesurgeon.online" /tmp/setup-move.log || fail "it did not stop the old copy"
grep -q "^== Moving the app's settings here and its old files out of /home/bikesurgeon-app" /tmp/setup-move.log || fail "it did not move the old copy"
grep -A1 "^== https certificate" /tmp/setup-move.log | grep -qx "ok" || fail "no certificate for the new site"
grep -q "^Moved: .*parked in /root/bs-app-moved-from-bikesurgeon-app-" /tmp/setup-move.log || fail "the summary does not say where the old files are"
[ "$(sed -n 's/^TEST_LOGIN_CODE=//p' /home/bikesurgeon-api/shared/.env)" = "$CODE" ] || fail "the test code changed"
grep -qx 'WEB_DIR=/home/bikesurgeon-api/current/public' /home/bikesurgeon-api/shared/.env || fail "WEB_DIR still points at the old place"
for p in repo releases current shared update.sh .update.lock logs/update.log; do
  [ ! -e "/home/bikesurgeon-app/$p" ] && [ ! -L "/home/bikesurgeon-app/$p" ] || fail "$p was left in the live app's site user"
done
ls /root/bs-app-moved-from-bikesurgeon-app-*/shared/.env /root/bs-app-moved-from-bikesurgeon-app-*/repo/.git >/dev/null || fail "the old files were not parked"
[ "$(stat -c %a /root/bs-app-moved-from-bikesurgeon-app-*)" = 700 ] || fail "the parked files are not private"
live_files | diff /tmp/live-files-before - || fail "the live app's files changed"
crontab -u bikesurgeon-app -l | diff /tmp/live-cron-before - || fail "the live app's cron is not as it was"
# (a container has no init to reap exited processes: those show as Z, defunct, and are not running)
LEFT=$(ps -u bikesurgeon-app -o stat=,pid=,args= 2>/dev/null | awk '$1 !~ /^Z/' || true)
[ -z "$LEFT" ] || { echo "$LEFT"; fail "something still runs as bikesurgeon-app"; }
echo "PASS moved into bikesurgeon-api; the live app's files and cron are as they were and nothing runs as its user"
bash "$HERE/check.sh"

# 3. again: nothing left to move
env -u TEST_PHONES -u WORKSHOP_PHONE bash scripts/server/setup.sh > /tmp/setup-again.log 2>&1 || { cat /tmp/setup-again.log; exit 1; }
grep -q "^All done" /tmp/setup-again.log && ! grep -q "Moving the app" /tmp/setup-again.log || fail "running it again"
echo "PASS running it again is safe"
echo "MOVED SERVER OK"
