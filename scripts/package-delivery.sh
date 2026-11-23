#!/usr/bin/env bash
# Builds delivery/bike-surgeon-<version>-<date>.zip from the files git tracks or would track.
# node_modules, build output, .env files and native build caches are excluded by .gitignore.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this inside the git repository." >&2
  exit 1
fi

version=$(node -p "require('./app-backend/package.json').version")
archive="delivery/bike-surgeon-${version}-$(date +%Y%m%d).zip"
mkdir -p delivery
rm -f "$archive"

list=$(mktemp)
trap 'rm -f "$list"' EXIT
git ls-files --cached --others --exclude-standard | grep -v '^delivery/' > "$list"
zip -q -X "$archive" -@ < "$list"

if unzip -Z1 "$archive" | grep -qE '(^|/)(node_modules/|\.env$)'; then
  echo "node_modules or a .env file ended up in the archive; check .gitignore." >&2
  exit 1
fi

echo "$archive: $(unzip -Z1 "$archive" | wc -l | tr -d ' ') files, $(du -h "$archive" | cut -f1)"
