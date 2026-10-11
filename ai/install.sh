#!/usr/bin/env bash
# Photo AI for product photos (Sam 2026-10-11: background white, faint Bike Pharma logo behind the part). update.sh runs this as the
# site user: it installs sharp + onnxruntime-node into ai/node_modules (only when they change) and downloads the AI model once
# (178 MB, checked byte for byte) into data/models. If anything here fails, the website still works and photos show as taken.
set -e
cd "$(dirname "$(readlink -f "$0")")"
if ! command -v node >/dev/null 2>&1; then
  for n in /usr/bin/node /usr/local/bin/node /usr/local/node*/bin/node /opt/node*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$n" ]; then export PATH="$(dirname "$n"):$PATH"; break; fi
  done
fi
command -v npm >/dev/null 2>&1 || { echo "   npm nahi mila"; exit 1; }
want="$(cat package.json package-lock.json | sha1sum | cut -c1-40) $(node -v) $(uname -m)"
if [ "$(cat node_modules/.bp-hash 2>/dev/null)" != "$want" ] || [ ! -f node_modules/sharp/package.json ] || [ ! -f node_modules/onnxruntime-node/package.json ]; then
  echo "   photo AI install ho raha hai (pehli baar ~250 MB download, thoda time lagega)"
  ONNXRUNTIME_NODE_INSTALL_CUDA=skip npm ci --omit=dev --no-audit --no-fund --loglevel=error
  echo "$want" > node_modules/.bp-hash
fi
node worker.mjs --model
node worker.mjs --check
