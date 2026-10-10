#!/usr/bin/env bash
# Bike Pharma site: one-time setup + start (run again any time; it restarts the server).
#   cd /home/bikepharma/htdocs/bikepharma.com && bash install.sh
set -e
cd "$(dirname "$0")"
echo "== Bike Pharma site setup ($(pwd))"

if ! command -v node >/dev/null 2>&1; then
  for n in /usr/bin/node /usr/local/bin/node /usr/local/node*/bin/node /opt/node*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$n" ]; then export PATH="$(dirname "$n"):$PATH"; break; fi
  done
fi
if ! command -v node >/dev/null 2>&1; then echo "node nahi mila. CloudPanel me site ka Node.js version check karo."; exit 1; fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
echo "node $(node -v)"
if [ "$NODE_MAJOR" -lt 20 ]; then echo "Node 20 ya naya chahiye (abhi $(node -v))."; exit 1; fi

NODE_ARGS=""
if node -e "require('node:sqlite')" >/dev/null 2>&1; then echo "database: SQLite (built in)";
elif node --experimental-sqlite -e "require('node:sqlite')" >/dev/null 2>&1; then NODE_ARGS="--experimental-sqlite"; echo "database: SQLite (experimental flag)";
else echo "database: JSON file (is Node me SQLite nahi hai; Node 22 better hai)"; fi

[ -f .env ] || { cp .env.example .env; echo ".env banaya (.env.example se)"; }
mkdir -p data/logs data/project-files

if ! node $NODE_ARGS --no-warnings admin.mjs has-admin >/dev/null 2>&1; then
  echo
  echo "== Pehla Admin login banao (app me Admin profile ke liye)"
  read -r -p "Admin login (email ya 10-digit mobile): " ADMIN_ID
  read -r -p "Admin ka naam: " ADMIN_NAME
  node $NODE_ARGS --no-warnings admin.mjs add-admin "$ADMIN_ID" "$ADMIN_NAME"
fi

PORT=$(grep -E '^PORT=' .env | head -1 | cut -d= -f2); PORT=${PORT:-3010}

if [ ! -x node_modules/.bin/pm2 ]; then
  echo "== pm2 install ho raha hai (server ko hamesha chalu rakhne ke liye)"
  if ! npm install --no-audit --no-fund --loglevel=error pm2@5 >/dev/null 2>&1; then
    echo "pm2 install nahi hua. Server aise chalao:  NODE_ARGS='$NODE_ARGS' nohup node $NODE_ARGS server.mjs > data/logs/out.log 2>&1 &"; exit 1
  fi
fi
export NODE_ARGS
./node_modules/.bin/pm2 delete bikepharma >/dev/null 2>&1 || true
./node_modules/.bin/pm2 start ecosystem.config.cjs >/dev/null
./node_modules/.bin/pm2 save >/dev/null 2>&1 || true
sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  echo
  echo "== Chal gaya: http://127.0.0.1:$PORT  (CloudPanel App Port $PORT hona chahiye)"
  echo "   Logs:    npx pm2 logs bikepharma"
  echo "   Restart: npx pm2 restart bikepharma"
  echo "   Reboot ke baad auto-start: CloudPanel > Cron Jobs me add karo:  @reboot cd $(pwd) && ./node_modules/.bin/pm2 resurrect"
else
  echo "Server start nahi hua. Dekho: ./node_modules/.bin/pm2 logs bikepharma --lines 50"; exit 1
fi
