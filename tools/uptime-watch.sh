#!/bin/bash
# Update 11w: runs on the OTHER server (the old Kuala Lumpur VPS) every minute from cron, because a site that is down cannot email by
# itself. Two failed checks in a row = "down" email; the first good check after = "back up" email. Only curl is needed.
# Settings in /root/bp-alert.conf (root only, chmod 600):
#   SMTP_USER=bikepharma.alerts@gmail.com
#   SMTP_PASS=the Gmail App Password
#   ALERT_TO=first@gmail.com,second@gmail.com
#   SITE_URL=https://bikepharma.com/api/health      (optional)
# cron line (/etc/cron.d/bp-uptime):  * * * * * root bash /root/uptime-watch.sh
set -u
CONF=${BP_ALERT_CONF:-/root/bp-alert.conf}; STATE=${BP_ALERT_STATE:-/root/.bp-uptime}
[ -f "$CONF" ] || { echo "no $CONF"; exit 1; }
# shellcheck disable=SC1090
. "$CONF"
URL=${SITE_URL:-https://bikepharma.com/api/health}; SMTP=${SMTP_URL:-smtps://smtp.gmail.com:465}
mkdir -p "$STATE"
send() {   # subject, text
  local f; f=$(mktemp); local IFS=','
  { echo "From: Bike Pharma <$SMTP_USER>"; echo "To: $ALERT_TO"; echo "Subject: $1"; echo "Date: $(date -R)"; echo "Content-Type: text/plain; charset=utf-8"; echo; echo -e "$2"; } > "$f"
  local rc=(); for t in $ALERT_TO; do rc+=(--mail-rcpt "$t"); done
  curl -s --ssl-reqd --url "$SMTP" --user "$SMTP_USER:$SMTP_PASS" --mail-from "$SMTP_USER" "${rc[@]}" -T "$f" --max-time 40 || echo "$(date -Is) email failed" >> "$STATE/log"
  rm -f "$f"
}
now=$(TZ=Asia/Kolkata date '+%d %b %Y, %I:%M %p')
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL"); fails=$(cat "$STATE/fails" 2>/dev/null || echo 0)
if [ "$code" = "200" ]; then
  if [ -f "$STATE/down" ]; then send "[Bike Pharma alert] Website is back up" "bikepharma.com answers again.\n\nDown since: $(cat "$STATE/down")\nBack: $now (India)"; rm -f "$STATE/down"; fi
  echo 0 > "$STATE/fails"
else
  fails=$((fails + 1)); echo $fails > "$STATE/fails"
  if [ $fails -ge 2 ] && [ ! -f "$STATE/down" ]; then
    echo "$now" > "$STATE/down"
    send "[Bike Pharma alert] WEBSITE DOWN" "bikepharma.com is not answering (checked twice, 1 minute apart).\n\nAnswer: ${code:-none} from $URL\nTime: $now (India)\n\nCheck the Hostinger server (pm2 status, nginx). You get another email when it is back."
  fi
fi
echo "$(date -Is) $code" >> "$STATE/log"; tail -n 3000 "$STATE/log" > "$STATE/log.t" && mv "$STATE/log.t" "$STATE/log"
