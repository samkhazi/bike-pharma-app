#!/usr/bin/env bash
# Builds the app and installs it on the iPhone connected to this Mac.
# Needs an Apple ID in Xcode > Settings > Accounts. Set TEAM_ID to pick a team when you have more than one.
set -euo pipefail
cd "$(dirname "$0")/.."

bundle_id="com.bikesurgeon.customer"
derived="ios/DerivedData"

team="${TEAM_ID:-}"
if [ -z "$team" ]; then
  team=$(security find-certificate -c "Apple Development" -p 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null \
    | sed -n 's/.*OU *= *\([A-Z0-9]\{10\}\).*/\1/p' | head -1 || true)
fi
if [ -z "$team" ]; then
  team=$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null \
    | sed -n 's/.*teamID = \([A-Z0-9]\{10\}\);.*/\1/p' | head -1 || true)
fi
if [ -z "$team" ]; then
  echo "No Apple development team found."
  echo "Open Xcode > Settings > Accounts, add your Apple ID, then run this again."
  exit 1
fi

devices_json=$(mktemp)
xcrun devicectl list devices --json-output "$devices_json" >/dev/null 2>&1 || true
udid=$(node -e '
  const fs = require("fs");
  const list = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).result?.devices ?? [];
  const paired = list.filter((d) => d.hardwareProperties?.platform === "iOS" && d.connectionProperties?.pairingState === "paired");
  // Skip phones that are paired but not reachable right now (other people'\''s phones, unplugged ones).
  const phone = paired.find((d) => d.connectionProperties?.tunnelState !== "unavailable") ?? paired[0];
  if (phone) console.log(phone.hardwareProperties.udid);
' "$devices_json" 2>/dev/null || true)
rm -f "$devices_json"
if [ -z "$udid" ]; then
  echo "No paired iPhone found."
  echo "Plug the iPhone in with a cable, unlock it and tap Trust, then run this again."
  exit 1
fi

echo "Team $team, iPhone $udid"
npm run build
npx cap sync ios

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination "id=$udid" \
  -derivedDataPath "$derived" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$team" \
  build | grep -E "error:|BUILD (SUCCEEDED|FAILED)" || true

app="$derived/Build/Products/Debug-iphoneos/App.app"
[ -d "$app" ] || { echo "Build failed. Open ios/App/App.xcodeproj in Xcode to see the signing error."; exit 1; }

xcrun devicectl device install app --device "$udid" "$app"
if ! launch=$(xcrun devicectl device process launch --device "$udid" "$bundle_id" 2>&1); then
  if grep -q "Locked" <<<"$launch"; then
    echo "Installed. Unlock the iPhone and open Bike Surgeon."
  elif grep -qi "profile\|trust\|verify" <<<"$launch"; then
    echo "Installed. iOS blocks the first launch until you trust the developer:"
    echo "Settings > General > VPN & Device Management > your Apple ID > Trust. Then open Bike Surgeon."
  else
    echo "Installed, but it didn't open:"
    tail -3 <<<"$launch"
  fi
fi
