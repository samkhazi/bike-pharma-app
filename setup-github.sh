#!/usr/bin/env bash
# EK BAAR: bikepharma.com folder ko GitHub (samkhazi/bike-pharma-app, branch "website") se jodo.
# Uske baad har update sirf:  bash /home/bikepharma/htdocs/bikepharma.com/update.sh
# Root se chalao:  bash setup-github.sh
set -e
SITE_DIR=/home/bikepharma/htdocs/bikepharma.com
SITE_USER=bikepharma
REPO=git@github.com:samkhazi/bike-pharma-app.git
BRANCH=website
GH_ED25519='SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU'   # GitHub ki published host key

[ "$(id -u)" = "0" ] || { echo "Root se chalao (ssh root@72.62.246.246)"; exit 1; }
[ -d "$SITE_DIR" ] || { echo "$SITE_DIR nahi mila"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "== git install"; apt-get update -qq && apt-get install -y -qq git; }
HOME_DIR=$(getent passwd "$SITE_USER" | cut -d: -f6)
KEY="$HOME_DIR/.ssh/bikepharma_github"

echo "== 1. Server ki GitHub key"
mkdir -p "$HOME_DIR/.ssh"; chmod 700 "$HOME_DIR/.ssh"
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N '' -C 'bikepharma.com server' -f "$KEY"
grep -q 'bikepharma_github' "$HOME_DIR/.ssh/config" 2>/dev/null || cat >> "$HOME_DIR/.ssh/config" <<CFG
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/bikepharma_github
  IdentitiesOnly yes
CFG
scan=$(ssh-keyscan -T 10 -t ed25519 -p 443 ssh.github.com 2>/dev/null)
fp=$(printf '%s\n' "$scan" | ssh-keygen -lf - 2>/dev/null | awk '{print $2}')
if [ "$fp" != "$GH_ED25519" ]; then echo "!! GitHub ki host key match nahi hui ($fp). Ruk gaya. Ye output mujhe bhejo."; exit 1; fi
# the [ssh.github.com]:443 line itself (github.com has the same key, so looking only for the key missed it: "Host key verification failed")
grep -qF "$(printf '%s' "$scan" | awk '{print $1, $3}')" "$HOME_DIR/.ssh/known_hosts" 2>/dev/null || printf '%s\n' "$scan" >> "$HOME_DIR/.ssh/known_hosts"
chown -R "$SITE_USER":"$SITE_USER" "$HOME_DIR/.ssh"; chmod 600 "$HOME_DIR/.ssh/config" "$KEY"

echo
echo "== 2. Ye key GitHub me daalo (sirf ek baar):"
echo "   Browser me kholo: https://github.com/samkhazi/bike-pharma-app/settings/keys/new"
echo "   Title: bikepharma.com server    Key: neeche wali poori line    'Allow write access' OFF rakho > Add key"
echo
cat "$KEY.pub"
echo
for i in 1 2 3 4 5; do
  read -r -p "Key add karke Enter dabao... " _ </dev/tty
  out=$(su - "$SITE_USER" -c "ssh -o BatchMode=yes -T git@github.com" 2>&1 || true)
  case "$out" in *"successfully authenticated"*) echo "   OK GitHub ne server ko pehchan liya"; break;; esac
  echo "   Abhi nahi juda: $out"
  [ "$i" = 5 ] && { echo "Key add nahi hui. Dobara chalao: bash setup-github.sh"; exit 1; }
done

echo "== 3. Site folder ko GitHub se jodna"
su - "$SITE_USER" -c "cd '$SITE_DIR' && { [ -d .git ] || git init -q; } && { git remote get-url origin >/dev/null 2>&1 || git remote add origin '$REPO'; } && git fetch -q origin '$BRANCH' && git checkout -q -f -B '$BRANCH' 'origin/$BRANCH' && git branch -q -u 'origin/$BRANCH' && git log -1 --format='   latest: %h %s'"
echo
bash "$SITE_DIR/update.sh" --pulled
echo
echo "Ho gaya. Aage har update ke liye bas:  bash $SITE_DIR/update.sh"
