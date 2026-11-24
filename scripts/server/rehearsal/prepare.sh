#!/usr/bin/env bash
# CI rehearsal: makes this container look like the Bike Surgeon CloudPanel server (CloudPanel's clpctl, the admin
# panel's .env, the old billing MySQL with a read-only login, the Inventory and a bay camera), so that
# scripts/server/setup.sh runs exactly as it will on the server.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
MYSQL_HOST=${MYSQL_HOST:-mysql}
FEED_KEY=rehearsal-feed-key-0123456789

install -m 755 "$HERE/clpctl" /usr/local/bin/clpctl
git config --system --add safe.directory '*'

# Node for the stand-in services only (the site user gets its own from "CloudPanel")
curl -fsSL https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz | tar -xJ -C /opt
ln -sf /opt/node-v22.12.0-linux-x64/bin/node /usr/local/bin/node

# Old billing database + read-only login (a password with # and " in it, written the way node --env-file reads it)
export MYSQL_PWD=root
until mysql -h "$MYSQL_HOST" -u root -e "SELECT 1" >/dev/null 2>&1; do sleep 2; done
mysql -h "$MYSQL_HOST" -u root -e "CREATE DATABASE bikesurgeonoff CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -h "$MYSQL_HOST" -u root bikesurgeonoff < "$ROOT/app-backend/test/fixtures/old-billing-schema.sql"
mysql -h "$MYSQL_HOST" -u root bikesurgeonoff < "$HERE/old-data.sql"
mysql -h "$MYSQL_HOST" -u root -e "CREATE USER 'bs_read'@'%' IDENTIFIED BY 'r3ad#only\"pw'; GRANT SELECT ON bikesurgeonoff.* TO 'bs_read'@'%';"
unset MYSQL_PWD

# The admin panel site, with the settings the real one has
useradd -m -s /bin/bash bikesurgeon-panel
mkdir -p /home/bikesurgeon-panel/htdocs/panel.bikesurgeon.online
cat > /home/bikesurgeon-panel/htdocs/panel.bikesurgeon.online/.env <<ENV
PORT=3040
OLD_DB_HOST=$MYSQL_HOST
OLD_DB_PORT=3306
OLD_DB_USER=bs_read
OLD_DB_PASS='r3ad#only"pw'
OLD_DB_BS=bikesurgeonoff
OLD_DB_ML=themotolab
INV_URL=http://127.0.0.1:3021
INV_FEED_KEY=$FEED_KEY
ENV
chmod 600 /home/bikesurgeon-panel/htdocs/panel.bikesurgeon.online/.env

# Bay camera (HLS like the real cam server) and the Inventory feed
mkdir -p /srv/cam/live/streams
ffmpeg -loglevel error -f lavfi -i testsrc=size=640x360:rate=25 -t 30 -c:v libx264 -pix_fmt yuv420p -g 25 \
  -f hls -hls_time 2 -hls_list_size 0 /srv/cam/live/streams/cam5.m3u8
FEED_KEY=$FEED_KEY nohup node "$HERE/fake-services.mjs" > /tmp/fake-services.log 2>&1 &
for _ in $(seq 1 20); do curl -fsS http://127.0.0.1:5080/live/streams/cam5.m3u8 >/dev/null 2>&1 && break; sleep 1; done
echo "rehearsal server ready"
