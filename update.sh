#!/usr/bin/env bash
# bikepharma.com: GitHub se latest website lo aur server restart karo. Ek command (root ya site user):
#   bash /home/bikepharma/htdocs/bikepharma.com/update.sh
set -e
SITE_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
cd "$SITE_DIR"
SITE_USER=$(stat -c %U "$SITE_DIR")
as_site() { if [ "$(id -u)" = "0" ] && [ "$SITE_USER" != "root" ]; then su - "$SITE_USER" -c "cd '$SITE_DIR' && $1"; else bash -c "$1"; fi; }

if [ "${1:-}" != "--pulled" ]; then
  if [ -d .git ]; then
    echo "== GitHub se latest code (branch website)"
    as_site "git fetch -q origin website && git reset -q --hard origin/website && git log -1 --format='   ab chal raha hai: %h %s'"   # server folder hamesha GitHub jaisa (data/, .env, public/cat ko haath nahi lagta)
  else
    echo "== GitHub abhi juda nahi hai (pehle ek baar: bash setup-github.sh). Folder ki files se hi restart kar raha hu."
  fi
  exec bash "$SITE_DIR/update.sh" --pulled   # naya update.sh chalao (pull ne badla ho to)
fi

# purane installer zips ki ab zaroorat nahi; site folder me download hone layak kuch nahi rehna chahiye
rm -f bikepharma-site.zip bikepharma-update-*.zip
[ "$(id -u)" = "0" ] && chown -R "$SITE_USER":"$SITE_USER" "$SITE_DIR"
echo "== Photo AI (product photos: background white + halka logo)"
as_site "bash ai/install.sh" || echo "   !! photo AI install nahi hua: website chalti rahegi, photos waise hi dikhengi. Ye output mujhe bhejo"
echo "== Server restart"
as_site "bash restart.sh"
sleep 2
bash "$SITE_DIR/check.sh" || true
