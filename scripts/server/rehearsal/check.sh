#!/usr/bin/env bash
# CI rehearsal: checks the app that scripts/server/setup.sh set up, the way a tester would use it.
set -euo pipefail
H=/home/bikesurgeon-app
ENV=$H/shared/.env
B=http://127.0.0.1:3050
pass() { echo "PASS $*"; }
fail() {
  echo "FAIL $*"
  tail -n 40 "$H"/.pm2/logs/bs-app-out*.log "$H"/.pm2/logs/bs-app-error*.log 2>/dev/null || true
  exit 1
}
val() { sed -n "s/^$1=//p" "$ENV" | tail -1; }
json() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); const v=($1); process.stdout.write(v===undefined||v===null?'':String(v))"; }

[ "$(stat -c %a "$ENV")" = 600 ] && [ "$(stat -c %U "$ENV")" = bikesurgeon-app ] || fail ".env must be private to the site user"
grep -qx "OLD_DB_PASS='r3ad#only\"pw'" "$ENV" || fail "the old billing password was not copied as it is"
grep -qx 'INVENTORY_FEED_KEY=rehearsal-feed-key-0123456789' "$ENV" || fail "the Inventory key was not copied"
grep -qx 'LOGIN_ALLOWLIST=9876543210,9123456780' "$ENV" || fail "test numbers"
crontab -u bikesurgeon-app -l | grep -q 'update.sh' || fail "the 5-minute update is not in cron"
crontab -u bikesurgeon-app -l | grep -q 'pm2 resurrect' || fail "the restart after reboot is not in cron"
pass "settings, secrets and cron"

curl -fsS "$B/health/ready" | grep -q '"ready"' || fail "health"
curl -fsS "$B/" | grep -q 'id="root"' || fail "web app"
curl -fsS "$B/garage/bikes" | grep -q 'id="root"' || fail "web app screen link"
pass "web app served at /"

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

su - bikesurgeon-app -c 'bash ~/update.sh' || fail "update.sh"
pass "update with nothing new is quiet"
echo "REHEARSAL OK"
