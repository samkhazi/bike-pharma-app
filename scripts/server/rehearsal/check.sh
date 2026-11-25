#!/usr/bin/env bash
# CI rehearsal: checks the app that scripts/server/setup.sh set up, the way a tester would use it.
set -euo pipefail
H=${H:-/home/bikesurgeon-api}
U=${H##*/}
ENV=$H/shared/.env
PHONES=${EXPECT_PHONES:-9876543210,9123456780}
B=http://127.0.0.1:3050
pass() { echo "PASS $*"; }
fail() {
  echo "FAIL $*"
  tail -n 40 "$H"/.pm2/logs/bs-app-out*.log "$H"/.pm2/logs/bs-app-error*.log 2>/dev/null || true
  exit 1
}
val() { sed -n "s/^$1=//p" "$ENV" | tail -1; }
json() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); const v=($1); process.stdout.write(v===undefined||v===null?'':String(v))"; }

[ "$(stat -c %a "$ENV")" = 600 ] && [ "$(stat -c %U "$ENV")" = "$U" ] || fail ".env must be private to the site user"
grep -qx "OLD_DB_PASS='r3ad#only\"pw'" "$ENV" || fail "the old billing password was not copied as it is"
grep -qx 'INVENTORY_FEED_KEY=rehearsal-feed-key-0123456789' "$ENV" || fail "the Inventory key was not copied"
grep -qx "LOGIN_ALLOWLIST=$PHONES" "$ENV" || fail "test numbers"
crontab -u "$U" -l | grep -q 'update.sh' || fail "the 5-minute update is not in cron"
crontab -u "$U" -l | grep -q 'pm2 resurrect' || fail "the restart after reboot is not in cron"
pass "settings, secrets and cron"

curl -fsS "$B/health/ready" | grep -q '"ready"' || fail "health"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/")" = 404 ] || fail "the server must not show a web app at /"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/garage/bikes")" = 404 ] || fail "the server must not show app screens"
grep -qx "WEB_DIR=$H/current/public" "$ENV" || fail "WEB_DIR"
pass "no web app on the server, only the API"

APK=$H/current/downloads/bike-surgeon.apk
if [ -f "$APK" ]; then
  curl -fsS -D /tmp/apk.headers -o /tmp/apk.bin "$B/download/bike-surgeon.apk" || fail "Android app download"
  grep -qi '^content-type: application/vnd.android.package-archive' /tmp/apk.headers || fail "Android app download type"
  cmp -s /tmp/apk.bin "$APK" || fail "the downloaded Android app is not the one built on GitHub"
  pass "Android app downloads from /download/bike-surgeon.apk"
fi

status=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d '{"phone":"9811100002"}' "$B/v1/auth/otp/request")
[ "$status" = 403 ] || fail "a number that is not on the test list got $status"
curl -fsS -H 'content-type: application/json' -d '{"phone":"98765 43210"}' "$B/v1/auth/otp/request" >/dev/null || fail "code request"
TOKEN=$(curl -fsS -H 'content-type: application/json' -d "{\"phone\":\"9876543210\",\"code\":\"$(val TEST_LOGIN_CODE)\"}" "$B/v1/auth/otp/verify" | json 'd.accessToken')
[ -n "$TOKEN" ] || fail "login with the test code"
pass "test login: only listed numbers, fixed code"

BOOKINGS=""
for _ in $(seq 1 40); do
  BOOKINGS=$(curl -fsS -H "authorization: Bearer $TOKEN" "$B/v1/bookings" || true)
  [ -n "$(printf '%s' "$BOOKINGS" | json 'd.find?.((b) => b.status === "in_service")?.id')" ] && break
  sleep 3
done
BID=$(printf '%s' "$BOOKINGS" | json 'd.find?.((b) => b.status === "in_service")?.id')
[ -n "$BID" ] || { echo "$BOOKINGS"; fail "the open job card from the old billing did not reach the app"; }
pass "old billing job card is in the app (booking $BID)"

PLAY=$(curl -fsS -H "authorization: Bearer $TOKEN" "$B/v1/bookings/$BID/camera" | json 'd.playbackUrl')
[ -n "$PLAY" ] || fail "no camera link"
LIST=$(curl -fsS "$PLAY") || fail "camera playlist through the app"
printf '%s' "$LIST" | grep -q '#EXTM3U' || fail "not an HLS playlist"
SEG=$(printf '%s\n' "$LIST" | grep -v '^#' | grep -v '^$' | head -1)
case "$SEG" in http*) SEG_URL=$SEG;; /*) SEG_URL="$B$SEG";; *) SEG_URL="${PLAY%/*}/$SEG";; esac
curl -fsS -o /tmp/segment.ts "$SEG_URL" || fail "camera video segment"
[ "$(stat -c %s /tmp/segment.ts)" -gt 1000 ] || fail "empty video segment"
pass "live bay camera plays through the app"

grep -q 'GET /api/feed/parts key=right portal=desk' /tmp/fake-inventory.log || fail "the Inventory parts were not read"
pass "Inventory linked"

# the 5-minute update exactly as cron runs it (as the site user, plain sh, cron's PATH, its own log file)
CRON_CMD=$(crontab -u "$U" -l | grep 'update.sh' | sed -E 's/^([^ ]+ ){5}//')
runuser -u "$U" -- env -i HOME="$H" LOGNAME="$U" PATH=/usr/bin:/bin SHELL=/bin/sh /bin/sh -c "$CRON_CMD" || fail "the update from cron fails: $CRON_CMD"
[ "$(stat -c %U "$H/logs/update.log")" = "$U" ] || fail "the update log is not the site user's"
pass "the 5-minute update from cron runs (nothing new: quiet)"
echo "REHEARSAL OK"
