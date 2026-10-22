#!/usr/bin/env bash
# bikepharma.com ki jaanch (server pe). OK = theek, !! = dekhna hai. update.sh ke end me khud chalta hai.
cd "$(dirname "$(readlink -f "$0")")"
DOM=bikepharma.com
PORT=$(grep -E '^PORT=' .env 2>/dev/null | head -1 | cut -d= -f2); PORT=${PORT:-3010}
ok()  { echo "  OK  $*"; }
bad() { echo "  !!  $*"; }
code() { curl -sk -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null; }
NG=(--resolve "$DOM:443:127.0.0.1")
echo "== bikepharma.com check"

h=$(curl -s --max-time 8 "http://127.0.0.1:$PORT/api/health" 2>/dev/null)
case "$h" in *'"ok":true'*) ok "app chal raha hai (port $PORT) $h";; *) bad "app port $PORT pe jawab nahi de raha. Logs: npx pm2 logs bikepharma --lines 50";; esac
pa=$(printf '%s' "$h" | grep -o '"photoAi":{[^}]*}' || true)
case "$pa" in
  *'"state":"ready"'*|*'"state":"working"'*) ok "photo AI taiyaar (photo ka background white + halka logo)";;
  *'"state":"off"'*) ok "photo AI band hai (.env me PHOTO_AI=off), photos waise hi dikhti hain";;
  '') ;;
  *) bad "photo AI: $pa (photos abhi waise hi dikh rahi hain). Ye line mujhe bhejo";;
esac
ba=$(printf '%s' "$h" | grep -o '"billAi":{[^}]*}' || true)
case "$ba" in
  *'"state":"off"'*) ok "bill reader band hai (.env me BILL_AI=off), bill phone wale reader se padhe jayenge";;
  *'"model":true'*) ok "bill reader (Apna AI) taiyaar";;
  '') ;;
  *) bad "bill reader (Apna AI): $ba (bill phone wale reader se padhe jayenge). Ye line mujhe bhejo";;
esac

c=$(code "${NG[@]}" "https://$DOM/"); [ "$c" = 200 ] && ok "https://$DOM/ khulta hai" || bad "https://$DOM/ ka jawab $c"
LP=$(curl -sk --max-time 20 "${NG[@]}" "https://$DOM/" 2>/dev/null || true)
if [ -z "$LP" ]; then bad "landing page nahi mili"; elif printf '%s' "$LP" | grep -q "Back to website"; then bad "purani landing file (Back to website abhi bhi hai)"; else ok "landing page nayi wali hai"; fi
c=$(code "${NG[@]}" "https://$DOM/app.html"); [ "$c" = 200 ] && ok "app (login) khulta hai" || bad "/app.html ka jawab $c"
c=$(code "${NG[@]}" "https://$DOM/vendor/zxing.min.js")
[ "$c" = 200 ] && ok "scripts load hote hain" || bad "/vendor/zxing.min.js ka jawab $c: nginx .js/.png files site folder se de raha hai, app se nahi (CloudPanel Vhost me static files wala block)"
p=".check-$$.js"; echo "x" > "$p"; c=$(code "${NG[@]}" "https://$DOM/$p"); rm -f "$p"
[ "$c" = 200 ] && bad "site folder ki files internet pe download ho sakti hain (nginx static block). Mujhe batao, fix dunga" || ok "site folder ki files bahar se download nahi hoti"
open_=""; for f in .env .git/config data/ data/bikepharma.sqlite server.mjs; do c=$(code "${NG[@]}" "https://$DOM/$f"); [ "$c" = 200 ] && open_="$open_ /$f"; done
[ -z "$open_" ] && ok ".env / .git / data / server files bahar se band" || bad "ye bahar se khul rahe hain:$open_"

c=$(code --resolve "www.$DOM:443:127.0.0.1" "https://www.$DOM/")
case "$c" in 200|301|302|308) ok "www.$DOM is server pe set hai ($c)";; *) bad "www.$DOM is server pe set nahi ($c): CloudPanel > site > Settings me Domain Aliases me www.$DOM add karo";; esac
getent hosts "www.$DOM" >/dev/null 2>&1 && ok "www.$DOM DNS me hai" || bad "www.$DOM ka DNS record nahi: Cloudflare me CNAME www -> $DOM"

m=$(grep -E '^OTP_MODE=' .env 2>/dev/null | cut -d= -f2)
rk=$(grep -E '^RENFLAIR_API_KEY=.+' .env 2>/dev/null | head -1)
if [ -n "$rk" ] && [ "$m" != "log" ]; then ok "OTP asli SMS se (Renflair)"; elif [ "$m" = "msg91" ]; then ok "OTP asli SMS se (MSG91)"; else bad "OTP test mode me hai ($m): koi bhi number + 123456 se login ho sakta hai. .env me RENFLAIR_API_KEY= ke aage apni Renflair key daalo"; fi
crontab -l -u "$(stat -c %U .)" 2>/dev/null | grep -q "pm2 resurrect" || grep -rqs "pm2 resurrect" /etc/cron.d 2>/dev/null \
  && ok "reboot ke baad auto-start set hai" || bad "reboot auto-start nahi mila: CloudPanel > Cron Jobs me  @reboot cd $(pwd) && ./node_modules/.bin/pm2 resurrect"
[ -d .git ] && ok "GitHub se juda hai ($(git -c safe.directory='*' log -1 --format='%h %cd' --date=format:'%d %b %H:%M' 2>/dev/null))" || bad "GitHub se juda nahi (ek baar: bash setup-github.sh)"
