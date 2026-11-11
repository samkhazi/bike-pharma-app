#!/usr/bin/env bash
# ============================================================
#  Rolon Catalogue — full server install (one file)
#  Usage:  bash rolon_install.sh
#  Idempotent: safe to re-run.
#  On this server run rolon_site_user.sh right after it (19q): the job then lives with the site user, cron line in crontab.txt.
#  Sam's installer as sent on 11 Nov 2026; only the cron step is changed for this server (run as root):
#  no CRON_TZ line (it would move root's other cron lines), time written in UTC.
# ============================================================
set -uo pipefail

# ---------- config ----------
BASE="$HOME/rolon_dump"
SCRIPT="$HOME/rolon_pdf4.py"
OUT="$HOME/rolon_out"
TARBALL="$HOME/rolon_handoff.tgz"
CRON_TZ_VAL="Asia/Kolkata"
CRON_SCHED="30 21 * * 6"        # server clock is UTC: Saturday 21:30 UTC = Sunday 03:00 India
MIN_PAGES=120
RETENTION_DAYS=56
# Optional upstream fetch script — set full path to enable, e.g.
#   ROLON_FETCH=/home/USER/rolon_fetch.py bash rolon_install.sh
ROLON_FETCH="${ROLON_FETCH:-}"

export PATH="/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

say(){ printf '\n== %s ==\n' "$*"; }
die(){ printf '\nFATAL: %s\n' "$*" >&2; exit 1; }

# ---------- 0. preflight ----------
say "preflight"
[ -f /etc/os-release ] || die "Linux only. macOS ke liye alag path hai."
. /etc/os-release
echo "os=$PRETTY_NAME arch=$(uname -m)"
[ "$(uname -m)" = "x86_64" ] || echo "WARN: arch $(uname -m) — google-chrome deb amd64 only. chromium use karna padega."

AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')
echo "ram_available=${AVAIL_MB}MB"
if [ "${AVAIL_MB:-0}" -lt 1500 ]; then
  if ! swapon --show 2>/dev/null | grep -q .; then
    say "adding 2G swap (Chrome needs ~1GB for a 135-page render)"
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
fi

# ---------- 1. system packages ----------
say "apt packages"
sudo apt-get update -qq
sudo apt-get install -y \
  python3 python3-pip ghostscript fonts-liberation \
  libnss3 libatk-bridge2.0-0 libcups2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 || die "apt install failed"
# libasound2 renamed on Ubuntu 24.04+
sudo apt-get install -y libasound2t64 2>/dev/null \
  || sudo apt-get install -y libasound2 2>/dev/null \
  || echo "WARN: libasound2 not installed (usually fine for headless print)"

say "pillow"
python3 -c "import PIL" 2>/dev/null || pip3 install --user pillow || die "pillow install failed"

# ---------- 2. google chrome ----------
say "google chrome"
if ! command -v google-chrome >/dev/null 2>&1; then
  wget -q -O - https://dl.google.com/linux/linux_signing_key.pub \
    | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    | sudo tee /etc/apt/sources.list.d/google-chrome.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y google-chrome-stable || die "chrome install failed"
fi
CHROME_VER=$(google-chrome --version | grep -oE '[0-9]+' | head -1)
echo "chrome=$CHROME_VER"
[ "${CHROME_VER:-0}" -ge 112 ] || echo "WARN: chrome <112 — '--headless=new' fail karega. rolon_pdf4.py se 'new' hatao."
gs --version | head -1

# ---------- 3. extract bundle ----------
say "extract bundle"
if [ -f "$TARBALL" ]; then
  tar xzf "$TARBALL" -C "$HOME"
  [ -f "$HOME/rolon_handoff/rolon_pdf4.py" ] && cp -f "$HOME/rolon_handoff/rolon_pdf4.py" "$SCRIPT"
  [ -f "$HOME/rolon_handoff/rolon_weekly.sh" ] && mkdir -p "$BASE" && cp -f "$HOME/rolon_handoff/rolon_weekly.sh" "$BASE/"
  mkdir -p "$BASE"
  [ -f "$HOME/rolon_handoff/_state.json" ] && cp -f "$HOME/rolon_handoff/_state.json" "$BASE/"
  [ -f "$HOME/rolon_handoff/_kits.json"  ] && cp -f "$HOME/rolon_handoff/_kits.json"  "$BASE/"
  [ -d "$HOME/rolon_handoff/img" ] && cp -rf "$HOME/rolon_handoff/img" "$BASE/"
  echo "extracted from $TARBALL"
else
  echo "WARN: $TARBALL nahi mila — maan raha hoon files already in place"
fi
[ -f "$SCRIPT" ] || die "missing $SCRIPT (rolon_handoff.tgz bhejo ya manually copy karo)"
[ -s "$BASE/_state.json" ] || die "missing $BASE/_state.json"
[ -s "$BASE/_kits.json"  ] || die "missing $BASE/_kits.json"

# ---------- 4. wrapper ----------
say "write wrapper -> $BASE/rolon_weekly.sh"
mkdir -p "$BASE/logs" "$OUT"
cat > "$BASE/rolon_weekly.sh" <<'WRAPPER'
#!/usr/bin/env bash
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

BASE="$HOME/rolon_dump"
SCRIPT="${ROLON_SCRIPT:-$HOME/rolon_pdf4.py}"
FETCH="${ROLON_FETCH:-}"
OUT="${ROLON_OUT:-$HOME/rolon_out}"
GS="$(command -v gs || echo /usr/bin/gs)"
PY="$(command -v python3)"
DATE="$(date +%F)"
LOG="$BASE/logs"
mkdir -p "$OUT" "$LOG"
L="$LOG/run_$DATE.log"

LOCK="$BASE/.lock.d"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -z "$(find "$LOCK" -mmin +360 2>/dev/null)" ]; then
    echo "$(date -Iseconds) locked, skip" >>"$LOG/cron.log"; exit 0
  fi
  rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 0
fi
trap 'rm -rf "$LOCK"' EXIT

{
  echo "=== start $(date -Iseconds) ==="
  echo "py=$PY gs=$GS script=$SCRIPT fetch=${FETCH:-none}"

  [ -f "$SCRIPT" ] || { echo "SCRIPT MISSING: $SCRIPT"; exit 1; }
  [ -d "$BASE/img" ] || { echo "IMG DIR MISSING: $BASE/img"; exit 1; }

  if [ -n "$FETCH" ]; then
    [ -f "$FETCH" ] || { echo "FETCH MISSING: $FETCH"; exit 1; }
    "$PY" -u "$FETCH" || { echo "FETCH FAIL rc=$?"; exit 1; }
  fi

  "$PY" -u "$SCRIPT" || { echo "PYTHON FAIL rc=$?"; exit 1; }

  SRC="$BASE/Rolon_Catalogue_Full_$DATE.pdf"
  [ -s "$SRC" ] || { echo "PDF missing: $SRC"; exit 2; }

  PAGES="$("$GS" -q -dNODISPLAY -dNOSAFER \
    -c "($SRC) (r) file runpdfbegin pdfpagecount = quit" | tr -dc '0-9')"
  echo "pages=$PAGES"
  [ "${PAGES:-0}" -ge 120 ] || { echo "PAGE COUNT LOW ($PAGES) - not publishing"; exit 3; }

  "$GS" -sDEVICE=pdfwrite -dNOPAUSE -dQUIET -dBATCH -dPDFSETTINGS=/ebook \
     -dDetectDuplicateImages=true \
     -o "$OUT/Rolon_Catalogue_WEB_$DATE.pdf" "$SRC" || exit 4

  cp -f "$SRC" "$OUT/Rolon_Catalogue_PRINT_$DATE.pdf" || exit 5
  ln -sfn "Rolon_Catalogue_WEB_$DATE.pdf"   "$OUT/latest_web.pdf"
  ln -sfn "Rolon_Catalogue_PRINT_$DATE.pdf" "$OUT/latest_print.pdf"

  find "$OUT" -name 'Rolon_Catalogue_*_*.pdf' -mtime +56 -delete
  echo "=== ok $(date -Iseconds) ==="
} >>"$L" 2>&1
WRAPPER
chmod +x "$BASE/rolon_weekly.sh"
grep -q flock "$BASE/rolon_weekly.sh" && die "wrapper mein flock hai — galat file"

# ---------- 5. verify script ----------
say "write verify -> $BASE/verify.sh"
cat > "$BASE/verify.sh" <<'VERIFY'
#!/usr/bin/env bash
set -uo pipefail
PASS=0; FAIL=0
ck(){ if eval "$2"; then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1"; FAIL=$((FAIL+1)); fi; }
ck "script exists"        '[ -f "$HOME/rolon_pdf4.py" ]'
ck "state json"           '[ -s "$HOME/rolon_dump/_state.json" ]'
ck "kits json"            '[ -s "$HOME/rolon_dump/_kits.json" ]'
ck "img dir"              '[ "$(ls "$HOME/rolon_dump/img"/*.png 2>/dev/null | wc -l)" -ge 1 ]'
ck "chrome present"       'command -v google-chrome >/dev/null'
ck "gs present"           'command -v gs >/dev/null'
ck "pillow"               'python3 -c "import PIL" 2>/dev/null'
ck "wrapper exec"         '[ -x "$HOME/rolon_dump/rolon_weekly.sh" ]'
ck "no flock"             '! grep -q flock "$HOME/rolon_dump/rolon_weekly.sh"'
ck "cron entry"           'crontab -l 2>/dev/null | grep -q rolon_weekly'
echo "---"; echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
VERIFY
chmod +x "$BASE/verify.sh"

# ---------- 6. first build ----------
say "first build (2-6 min)"
bash "$BASE/rolon_weekly.sh"; RC=$?
echo "wrapper rc=$RC"
tail -12 "$BASE/logs/run_$(date +%F).log" 2>/dev/null
ls -lh "$OUT" 2>/dev/null
[ "$RC" -eq 0 ] || echo "WARN: first build rc=$RC — cron install kar raha hoon, par log check karo"

# ---------- 7. cron ----------
say "install cron"
EXIST="$(crontab -l 2>/dev/null || true)"
NEW="$(printf '%s\n' "$EXIST" | grep -v 'rolon_weekly' | grep -v '^CRON_TZ=' | sed '/^$/d')"
{
  [ -n "$NEW" ] && printf '%s\n' "$NEW"
  if [ -n "$ROLON_FETCH" ]; then
    echo "ROLON_FETCH=$ROLON_FETCH"
  fi
  echo "$CRON_SCHED /bin/bash $HOME/rolon_dump/rolon_weekly.sh"
} | crontab -
echo "--- crontab -l ---"; crontab -l

# ---------- 8. cron simulation ----------
say "cron environment simulation (the real test)"
env -i HOME="$HOME" PATH="/usr/bin:/bin" ROLON_FETCH="$ROLON_FETCH" \
  /bin/bash "$BASE/rolon_weekly.sh"; SIM=$?
echo "cron-sim rc=$SIM"
ls -lh "$OUT" 2>/dev/null

# ---------- 9. summary ----------
say "SUMMARY"
echo "script   : $SCRIPT"
echo "data     : $BASE/{_state.json,_kits.json,img/}"
echo "wrapper  : $BASE/rolon_weekly.sh"
echo "output   : $OUT/latest_web.pdf -> $(readlink "$OUT/latest_web.pdf" 2>/dev/null)"
echo "output   : $OUT/latest_print.pdf -> $(readlink "$OUT/latest_print.pdf" 2>/dev/null)"
echo "cron     : $CRON_SCHED  (UTC = Sunday 03:00 India)"
echo "logs     : $BASE/logs/"
echo "verify   : bash $BASE/verify.sh"
[ "$SIM" -eq 0 ] && echo "STATUS   : OK — Sunday chalega" || echo "STATUS   : CHECK — cron-sim rc=$SIM"
