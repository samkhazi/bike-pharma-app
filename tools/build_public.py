#!/usr/bin/env python3
"""Build srv/public/ for the bikepharma.com Node server:
   app.html = website app (site/com/app.html) patched for server mode (API login, shared DB sync, files shim),
   index.html = landing page as is, plus the catalogue/photo folders from proto/."""
import json, os, re, shutil, sys
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(SP, 'site', 'com', 'app.html')
OUT = os.path.join(SP, 'srv', 'public')
# a fresh clone of branch `website` (a new project, 2026-10-12 handoff): the sources are in the repo itself (src/app.html, src/index.html),
# the brand files are the ones already in public/cat (copied aside first, the build remakes public/cat) and public/vendor is kept
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRESH = not os.path.exists(SRC)
if FRESH:
    SRC, OUT = os.path.join(REPO, 'src', 'app.html'), os.path.join(REPO, 'public')
    _keep = os.path.join(REPO, '.build', 'cat-in'); shutil.rmtree(_keep, ignore_errors=True); os.makedirs(_keep)
    for _f in os.listdir(os.path.join(OUT, 'cat')):
        if _f.endswith('.json') and _f != 'xref.json': shutil.copyfile(os.path.join(OUT, 'cat', _f), os.path.join(_keep, _f))
a = open(SRC, encoding='utf-8').read()
n_patch = 0
def sub1(old, new, count=1, regex=False):
    global a, n_patch
    if regex:
        a, n = re.subn(old, new, a, count=0, flags=re.S)
    else:
        n = a.count(old); a = a.replace(old, new)
    assert n == count, f'pattern matched {n}x (wanted {count}): {old[:90]!r}'
    n_patch += 1

# 1. no demo accounts
sub1(r"const ACCOUNTS=\{.*?\};\nconst ACC=", "const ACCOUNTS={};\nconst ACC=", regex=True)
# 2. DB comes from the server, never from this browser
sub1("function load(){try{const s=localStorage.getItem('bp-db');DB=s?JSON.parse(s):seed();}catch(e){DB=seed();}",
     "function load(){DB=window.BOOT_DB||seed();window.BOOT_DB=null;{const sd=seed();for(const k in sd)if(!(k in DB))DB[k]=sd[k];}")
sub1("function save(){if(typeof OFF!=='undefined'&&OFF.on)OFF.q++;try{localStorage.setItem('bp-db',JSON.stringify(DB));}catch(e){}}",
     "function save(){if(typeof OFF!=='undefined'&&OFF.on)OFF.q++;srvSchedule();}")
sub1("SEED_BILLS.forEach(sb=>{if(!DB.bills.some(b=>b.id===sb.id))DB.bills.push(JSON.parse(JSON.stringify(sb)));});",
     "if(!DB.noSeed)SEED_BILLS.forEach(sb=>{if(!DB.bills.some(b=>b.id===sb.id))DB.bills.push(JSON.parse(JSON.stringify(sb)));});")
# 3. login: ask the server (OTP by SMS for customers/mechanics, password for staff)
sub1(r"function sendOtp\(\)\{.*?go\('otp'\);\}\nSCREENS\.signup=", r"""function sendOtp(){const v=document.getElementById('loginId').value;S.ui.loginVal=v;const id=normId(v);
 if(!id){S.ui.loginErr='Enter your mobile number or email.';return refresh();}
 if(!id.includes('@')&&id.length!==10){S.ui.loginErr='Enter a 10-digit mobile number.';return refresh();}
 if(S.ui.lgBusy)return;S.ui.lgBusy=1;
 api('POST','/api/otp',{id}).then(r=>{S.ui.lgBusy=0;if(r.error){S.ui.loginErr=r.error;return refresh();}S.ui.loginErr=null;S.ui.suRole=null;
  if(r.kind==='password'){S.ui.signup=null;S.ui.pending=id;S.ui.pwErr=null;S.ui.after=()=>{const f=document.getElementById('pw1');if(f)f.focus();};return go('pw');}
  S.ui.otpTries=0;S.ui.otpSent=Date.now();
  if(r.signup){S.ui.signup={id,role:'customer',name:'',shop:'',area:''};return go('signup');}
  S.ui.signup=null;S.ui.pending=id;S.ui.after=()=>{const f=document.querySelector('.otp input');if(f)f.focus();};go('otp');}).catch(()=>{S.ui.lgBusy=0;S.ui.loginErr='Could not reach the server. Try again.';refresh();});}
SCREENS.signup=""", regex=True)
sub1(r"function verify\(\)\{.*?render\('push'\);\}\nSCREENS\.roleok=", r"""function verify(){clearTimeout(window._otpT);if(cur().s!=='otp'||!document.getElementById('otp0'))return;const code=[0,1,2,3,4,5].map(i=>document.getElementById('otp'+i).value).join('');if((S.ui.otpTries||0)>=5)return;
 if(code.length<6){S.ui.otpErr='Enter all 6 digits.';refresh();return;}
 const id=S.ui.pending;const su=S.ui.signup;if(S.ui.otpBusy)return;S.ui.otpBusy=1;
 api('POST','/api/login',{id,otp:code,signup:su&&su.id===id?{name:su.name.trim()}:null}).then(r=>{S.ui.otpBusy=0;if(r.error){S.ui.otpTries=(S.ui.otpTries||0)+1;S.ui.otpErr=r.error;refresh();return;}srvLogin(r);}).catch(()=>{S.ui.otpBusy=0;S.ui.otpErr='Could not reach the server. Try again.';refresh();});}
SCREENS.roleok=""", regex=True)
sub1("<div class=\"hint\">${ic('lock','s16')} Demo OTP for every account: 123456</div>",
     "${SRV.cfg.otpHint?`<div class=\"hint\">${ic('lock','s16')} Test OTP (SMS not set up yet): ${SRV.cfg.otpHint}</div>`:''}")
sub1("<button class=\"link\" style=\"text-align:center\" onclick=\"fillOtp()\">Auto-fill OTP</button>",
     "${SRV.cfg.otpHint?`<button class=\"link\" style=\"text-align:center\" onclick=\"fillOtp()\">Auto-fill OTP</button>`:''}")
sub1("function fillOtp(){if(!document.getElementById('otp0'))return;'123456'.split('')",
     "function fillOtp(){if(!document.getElementById('otp0')||!SRV.cfg.otpHint)return;String(SRV.cfg.otpHint).split('')")
sub1("onclick=\"S.ui.otpSent=Date.now();toast('New OTP sent');refresh()\">Resend OTP</button>",
     "onclick=\"resendOtp()\">Resend OTP</button>")
# 4. demo login list on the login screen
a2, n = re.subn(r"<details(?:(?!</details>).)*?Demo logins(?:(?!</details>).)*?</details>", "", a, flags=re.S)
assert n == 1, n; a = a2; n_patch += 1
sub1("<p>Clickable prototype. Log in with a registered mobile number or email; the OTP for every account is <b style=\"color:#fff\">123456</b>. Each ID opens only its own role.</p>", "")
# 5. staff logins get a password; mechanics are never made here (Sam 2026-10-10: their login comes from their first bill)
sub1("<p class=\"cap\">Staff can’t sign up themselves. The login you create here works right away with OTP.</p>",
     "<p class=\"cap\">Staff can’t sign up themselves. Each staff login gets a password here (shown once). Mechanic logins are made from their first bill.</p>")
sub1(" audit('Staff login created · '+LABEL[role],sid,'—',id);save();S.ui.ns=null;S.ui.nsErr=null;",
     " audit('Staff login created · '+LABEL[role],sid,'—',id);save();S.ui.ns=null;S.ui.nsErr=null;const pw=srvNewPw(id);")
sub1("<div class=\"kv\"><span>Login</span><span>${esc(id)}</span></div></div><p class=\"cap\">They can log in now with this ${id.includes('@')?'email':'number'} and OTP 123456.</p>",
     "<div class=\"kv\"><span>Login</span><span>${esc(id)}</span></div><div class=\"kv\"><span>Password</span><span><b>${pw}</b></span></div></div><p class=\"cap\">Give them this ${id.includes('@')?'email':'number'} and password. The password is shown only once; you can set a new one any time from their profile.</p>")
sub1("<button class=\"btn line\" onclick=\"staffRole('${k}')\">Save role</button></div>`);}",
     "<button class=\"btn line\" onclick=\"staffRole('${k}')\">Save role</button></div><button class=\"btn line\" onclick=\"staffPw('${k}')\">Set a new password</button>`);}")
# 6. logout tells the server
sub1("function logout(all){S.user=null;S.uid=null;try{localStorage.removeItem('bp-user');}catch(e){}",
     "function logout(all){srvLogout();bpIn(0);S.user=null;S.uid=null;try{localStorage.removeItem('bp-user');}catch(e){}")
# 7. boot from the server
sub1(r"function start\(\)\{load\(\);perCust\(\);applySettings\(\);applyTheme\(\);S\.ui\.lgLang=LANG;\n.*?render\(''\);splash\(\);", r"""async function start(){SCREENS.boot=()=>'<div class="scroll"></div>';S.stack=[{s:'boot',p:{}}];let b=null;try{b=await api('GET','/api/boot');}catch(e){}
 if(!b||b.error||!b.db){document.getElementById('vp').innerHTML='<div class="screen"><div class="scroll"><div class="pad" style="padding-top:60px;text-align:center;gap:12px"><h1 class="h1">Can’t reach the server</h1><p class="cap">Check your internet connection and try again.</p><button class="btn" onclick="start()">Try again</button></div></div></div>';return;}
 SRV.cfg=b.cfg||{};catManifest(SRV.cfg.cat);srvSetDb(b.db,b.rev);applyTheme();S.ui.lgLang=LANG;
 if(b.user){S.uid=b.user.id;S.user=ACC()[S.uid]||b.user;S.stack=[{s:HOME[S.user.role]||'login',p:{}}];}else{S.uid=null;S.user=null;S.stack=[{s:'login',p:{}}];}
 bpIn(!!b.user);
 render('');splash();""", regex=True)
# 7b. theme sync from the landing page only when really inside it (direct app.html would observe itself and loop)
sub1("th();try{new parent.MutationObserver(th).observe(parent.document.documentElement,{attributes:true,attributeFilter:['data-theme']});",
     "th();try{if(parent!==window)new parent.MutationObserver(th).observe(parent.document.documentElement,{attributes:true,attributeFilter:['data-theme']});")
# 7c. catalogue files are staff-only on the server: do not even ask for them as a customer/mechanic
sub1("function catFetch(url,e){const ac=", "function catFetch(url,e){if(!srvStaff())return Promise.reject(new Error('staff only'));const ac=")
# 9. mechanics: Bike Pharma bills them at the counter, so their app never makes its own invoice, payment or reward;
#    the server makes a new mechanic's login from the bill itself
sub1(r"function mechLogin\(mob,m\)\{[^\n]*\}\n", "function mechLogin(){/* the server makes the mechanic login from the bill */}\n", regex=True)
sub1("function mBuy(id,q,tot0,rew){", "function mBuy(id,q,tot0,rew){if(S.user&&S.user.role==='mechanic')return mOrder([[P(id),q]],tot0);")
sub1("function mReorder(mode,tot){", "function mReorder(mode,tot){if(S.user&&S.user.role==='mechanic')return mOrder(Object.entries(S.ui.rq2||{}).filter(([,q])=>q>0).map(([k,q])=>[P(k),q]),tot);")
sub1("function payOut(amt,pm,by){", "function payOut(amt,pm,by){if(!by&&S.user&&S.user.role==='mechanic')return mPayInfo(amt);")
sub1("if(j.parts.length){const inv='INV-0'+(21+DB.minv.length);DB.minv.unshift({id:inv,d:today(),amt:cost,paid:cost});DB.wl.push({d:today(),t:'Purchase reward · '+inv,cr:Math.round(cost*0.03)});j.parts.forEach(x=>DB.stock[x.pid]=Math.max(0,DB.stock[x.pid]-x.q));}", "")
sub1("${j.parts.length?'Parts ordered from Bike Pharma. ':''}", "${j.parts.length?'Order the parts from Bike Pharma at the counter or on WhatsApp. ':''}")
sub1("<span class=\"grow\">Parts will be ordered from Bike Pharma at your mechanic price (${inr(cost)}).</span>", "<span class=\"grow\">Order these parts from Bike Pharma at your mechanic price (${inr(cost)}).</span>")
sub1("const mCusts=()=>DB.mcust||(DB.mcust=MCUST_SEED.map(x=>({...x})));", "const mCusts=()=>DB.mcust||(DB.mcust=[]);")
sub1(r" <div class=\"row\" style=\"background:var\(--g-soft\);border-radius:14px;padding:12px;color:var\(--g\)\">\$\{ic\('wallet','s18'\)\}<span class=\"cap grow\" style=\"color:var\(--g\)\">Earn \$\{inr\(rew\)\} wallet reward on this purchase</span></div>\n.*?<b>Buy on credit</b>[^\n]*\n",
     " <div class=\"row cap\" style=\"background:var(--blue-soft);border-radius:12px;padding:12px;gap:8px\">${ic('receipt','s18')}<span class=\"grow\" style=\"color:var(--ink7)\">Bike Pharma bills your order at the counter: pay then or take it on credit. Outstanding now ${inr(outstanding())}.</span></div>${creditBlocked(myCode())?blockNote(myCode(),0):''}\n", regex=True)
sub1("<button class=\"btn\" onclick=\"mBuy('${x.id}',${q},${tot},${rew})\" ${x.stock?'':'disabled'}>${mode==='credit'?'Buy on credit':'Pay '+inr(tot-use)}</button>",
     "<button class=\"btn\" onclick=\"mBuy('${x.id}',${q},${tot},${rew})\" ${x.stock?'':'disabled'}>Order ${q} pcs</button>")
sub1("<div class=\"kv\" style=\"color:var(--g)\"><span>Wallet reward (3%)</span><span>+ ${inr(tot*0.03)}</span></div>", "")
sub1("<div class=\"foot\"><div class=\"grid2\" style=\"width:100%\"><button class=\"btn line\" ${tot?'':'disabled'} onclick=\"mReorder('now',${tot})\">Pay now</button><button class=\"btn\" ${tot&&!blocked?'':'disabled'} onclick=\"mReorder('credit',${tot})\">Buy on credit</button></div></div>",
     "<div class=\"foot\"><button class=\"btn\" ${tot?'':'disabled'} onclick=\"mReorder('order',${tot})\">Order these parts</button></div>")
# 8. server layer: API helper, shared DB sync, password screen, files shim
SRVJS = r"""
/* ===== bikepharma.com server mode: login via /api, shop database shared through /api/sync ===== */
async function api(m,u,b){const r=await fetch(u,{method:m,headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});let j=null;try{j=await r.json();}catch(e){}if(!r.ok)return (j&&j.error)?{error:j.error,status:r.status}:{error:'Server error '+r.status,status:r.status};return j||{};}
const SRV={rev:0,snap:{},cfg:{},busy:false,again:false,fail:0,t:null};
function srvSnap(){SRV.snap={};for(const k of Object.keys(DB)){try{const j=JSON.stringify(DB[k]);if(j!==undefined)SRV.snap[k]=j;}catch(e){}}}
function srvSetDb(db,rev){window.BOOT_DB=db;load();perCust();applySettings();SRV.rev=rev||0;srvSnap();}
function srvDiff(){const ch={};for(const k of Object.keys(DB)){let j;try{j=JSON.stringify(DB[k]);}catch(e){continue;}if(j===undefined)continue;if(SRV.snap[k]!==j)ch[k]=j;}return ch;}
function srvSchedule(){clearTimeout(SRV.t);SRV.t=setTimeout(srvPush,400);}
function srvApply(ch,sent){if(!ch)return;let n=0;for(const k of Object.keys(ch)){if(sent&&k in sent){let now;try{now=JSON.stringify(DB[k]);}catch(e){}if(now!==sent[k])continue;}const v=ch[k];if(v===null)continue;const j=JSON.stringify(v);if(SRV.snap[k]===j){let cur;try{cur=JSON.stringify(DB[k]);}catch(e){}if(cur===j)continue;}DB[k]=v;SRV.snap[k]=j;n++;}
 if(n&&S.user&&!(document.activeElement&&document.activeElement.matches('input,textarea,select'))&&!document.querySelector('#vp .scrim'))try{refresh();}catch(e){}}
function srvPush(){if(!S.user)return;if(SRV.busy){SRV.again=true;return;}const ch=srvDiff();const keys=Object.keys(ch);if(!keys.length)return;SRV.busy=true;
 const body='{"base":'+SRV.rev+',"changes":{'+keys.map(k=>JSON.stringify(k)+':'+ch[k]).join(',')+'}}';
 fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body,credentials:'same-origin',keepalive:body.length<60000}).then(async r=>{if(r.status===401){srvExpired();return;}if(!r.ok)throw new Error('sync '+r.status);const j=await r.json();keys.forEach(k=>SRV.snap[k]=ch[k]);SRV.rev=j.rev;srvApply(j.changed,ch);if(SRV.fail>=3)toast('Saved to the server ✓');SRV.fail=0;})
 .catch(()=>{SRV.fail++;if(SRV.fail===3)toast('Could not save to the server · retrying');SRV.again=true;})
 .finally(()=>{SRV.busy=false;if(SRV.again){SRV.again=false;clearTimeout(SRV.t);SRV.t=setTimeout(srvPush,SRV.fail?Math.min(30000,2000*SRV.fail):300);}});}
function srvPoll(){if(!S.user||SRV.busy||document.hidden)return;if(Object.keys(srvDiff()).length){srvPush();return;}
 fetch('/api/sync?since='+SRV.rev,{credentials:'same-origin'}).then(r=>r.status===401?(srvExpired(),null):r.ok?r.json():null).then(j=>{if(j){SRV.rev=j.rev;srvApply(j.changed);}}).catch(()=>{});}
setInterval(srvPoll,15000);
addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(SRV.t);srvPush();}else srvPoll();});
function srvExpired(){if(!S.user)return;bpIn(0);S.user=null;S.uid=null;S.ui={};S.stack=[{s:'login',p:{}}];render('fade');toast('Your login expired · please log in again');api('GET','/api/boot').then(b=>{if(b&&b.db)srvSetDb(b.db,b.rev);}).catch(()=>{});}
const srvStaff=()=>!!S.user&&['billing','sales','manager','inventory','admin'].includes(S.user.role);
/* catalogue brands = the files present in public/cat (the server lists them); none -> Find Part says so instead of failing */
function catManifest(list){if(!Array.isArray(list))return;const have=new Set(list);[CAT_ALL,typeof CAT_EXT!=='undefined'?CAT_EXT:[],typeof CAT_NEED!=='undefined'?CAT_NEED:[]].forEach(arr=>{for(let i=arr.length-1;i>=0;i--){const u=(arr[i].url||'').split('/').pop();if(!have.has(u))arr.splice(i,1);}});window.CAT_OFF=CAT_ALL.length===0;}
const _fpScreen=SCREENS.findpart;SCREENS.findpart=(...a)=>window.CAT_OFF?catOffScreen():_fpScreen(...a);
function catOffScreen(){return bar('Find Part')+`<div class="scroll"><div class="pad" style="gap:16px"><div class="card stack g8" style="align-items:center;text-align:center;padding:28px 18px"><div class="tile y">${ic('pin','s20')}</div><h2 class="h2">Catalogue not uploaded yet</h2><p class="cap">Brand catalogues will be added one by one. Search, diagrams and part numbers appear here as each brand is uploaded.</p></div></div></div>`;}

function srvLogin(r){bpIn(1);S.ui.otpErr=null;S.ui.pwErr=null;srvSetDb(r.db,r.rev);try{CAT_ALL.forEach(e=>{if(e.st===3)e.st=0;});}catch(e){}S.uid=r.user.id;S.user=ACC()[S.uid]||r.user;S.ui.signup=null;S.ui.pending=null;S.stack=[{s:'roleok',p:{}}];render('push');}
function srvLogout(){clearTimeout(SRV.t);const ch=srvDiff();const done=()=>api('POST','/api/logout').then(r=>{if(r&&r.db)srvSetDb(r.db,r.rev);}).catch(()=>{});if(Object.keys(ch).length&&S.user){SRV.busy=false;srvPush();setTimeout(done,600);}else done();}
function resendOtp(){api('POST','/api/otp',{id:S.ui.pending}).then(r=>{if(r.error)return toast(r.error);S.ui.otpSent=Date.now();S.ui.otpTries=0;S.ui.otpErr=null;toast('New OTP sent');refresh();}).catch(()=>toast('Could not reach the server'));}
/* mechanics order and pay at the Bike Pharma counter (or on WhatsApp); the shop's bill then shows in their app */
function mOrder(lines,tot){lines=lines.filter(([x,q])=>x&&q>0);if(!lines.length){toast('Choose the parts first');return;}window._mOrd=`Bike Pharma order · ${myShop()} (${myCode()})\n`+lines.map(([x,q])=>`${x.name} · ${x.pn} × ${q}`).join('\n')+`\nAbout ${inr(tot)} at mechanic price`;
 sheet(`<div class="tile y round" style="width:64px;height:64px">${ic('cart','s28')}</div><h3 class="h2">Order from Bike Pharma</h3><p class="cap">Send this order on WhatsApp or give it at the counter. Your bill, credit and invoice show here as soon as Bike Pharma bills it.</p><div class="card">${lines.map(([x,q])=>`<div class="kv"><span>${esc(x.name)} × ${q}</span><span>${inr(x.mp*q)}</span></div>`).join('')}<div class="hr"></div><div class="kv big"><span>About</span><span>${inr(tot)}</span></div></div><button class="btn" onclick="mOrderWa()">${ic('chat','s18')} Send on WhatsApp</button><button class="link" style="align-self:center" onclick="closeSheet()">Close</button>`);}
function mOrderWa(){const p=telOf(SHOP.ph).replace(/\D/g,'');if(p.length<10){toastWarn('The shop phone number will be added soon. Give this order at the counter.');return;}extOpen('https://wa.me/'+(p.length===10?'91'+p:p)+'?text='+encodeURIComponent(window._mOrd||''),'Opening WhatsApp…');}
function mPayInfo(amt){sheet(`<div class="tile r round" style="width:64px;height:64px">${ic('rupee','s28')}</div><h3 class="h2">Pay at Bike Pharma</h3><p class="cap">Pay ${inr(amt)} at the Bike Pharma counter, or by UPI and show it at the counter. Bike Pharma records it and your outstanding updates here.</p><div class="card"><div class="kv"><span>Shop UPI</span><span>${esc(SHOP.upi)}</span></div><div class="kv"><span>Your code</span><span>${myCode()}</span></div></div><button class="btn" onclick="closeSheet()">OK</button>`);}
function genPw(){const A='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';const b=new Uint8Array(10);crypto.getRandomValues(b);return Array.from(b,x=>A[x%A.length]).join('');}
function srvNewPw(id){const pw=genPw();api('POST','/api/users/password',{id,password:pw}).then(r=>{if(r.error)toast('Password not saved · '+r.error);}).catch(()=>toast('Password not saved · server unreachable'));return pw;}
function staffPw(k){const a=ACC()[k];const pw=srvNewPw(k);closeSheet();sheet(`${okBadge(72)}<h3 class="h2">New password set</h3><div class="card"><div class="kv"><span>Name</span><span>${esc(a.name)}</span></div><div class="kv"><span>Login</span><span>${esc(k)}</span></div><div class="kv"><span>Password</span><span><b>${pw}</b></span></div></div><p class="cap">Give this to ${esc(a.name)}. Their old password stops working now and they are logged out everywhere.</p><button class="btn" onclick="closeSheet()">Done</button>`);}
SCREENS.pw=()=>{const id=S.ui.pending||'';return bar('')+`<div class="scroll"><div class="pad" style="gap:22px">
 <div class="stack g6"><h1 class="h1">Enter password</h1><p class="cap">Staff login for <b style="color:var(--ink)">${esc(id)}</b> · <button class="link" onclick="back()">Edit</button></p></div>
 <form class="field" onsubmit="event.preventDefault();pwGo()" novalidate><label for="pw1">Password</label><div class="inp ${S.ui.pwErr?'err':''}">${ic('lock','s18')}<input id="pw1" type="password" autocomplete="current-password" placeholder="Password"></div>${S.ui.pwErr?`<div class="errmsg">${esc(S.ui.pwErr)}</div>`:''}<button class="btn" type="submit" style="margin-top:12px">Log in ${ic('chevR','s18')}</button></form>
 <div class="hint">${ic('shield','s16')} Forgot it? The Bike Pharma Admin can set a new password for you.</div></div></div>`;};
function pwGo(){const el=document.getElementById('pw1');const pw=el?el.value:'';if(!pw){S.ui.pwErr='Enter your password.';return refresh();}if(S.ui.pwBusy)return;S.ui.pwBusy=1;api('POST','/api/login',{id:S.ui.pending,password:pw}).then(r=>{S.ui.pwBusy=0;if(r.error){S.ui.pwErr=r.error;return refresh();}srvLogin(r);}).catch(()=>{S.ui.pwBusy=0;S.ui.pwErr='Could not reach the server.';refresh();});}
/* diagrams and photos: the app reads them through a "files" object; here it is this server's /api/files (staff only) */
const FILES_SHIM={list:async o=>{const r=await fetch('/api/files/list?path='+encodeURIComponent((o&&o.path)||''),{credentials:'same-origin'});if(!r.ok)throw{code:r.status===401||r.status===403?'not_granted':r.status===404?'not_found':'unavailable'};return r.json();},
 read:async(p,o)=>{const r=await fetch('/api/files/read?path='+encodeURIComponent(p)+'&offset='+((o&&o.offset)||0)+'&length='+((o&&o.length)||0)+(o&&o.a85?'&a85=1':''),{credentials:'same-origin'});if(!r.ok)throw{code:r.status===401||r.status===403?'not_granted':r.status===404?'not_found':'unavailable'};return {bytes:new Uint8Array(await r.arrayBuffer()),size:+r.headers.get('x-file-size')||0,revision:''};}};
/* defined, not assigned: inside the website's frame the app's first script already made window.claude a read-only "use the parent's"
   (for claude.ai), so a plain assignment was silently ignored there and no diagram opened (Sam 2026-10-11 "Diagram show nhi ho raha") */
try{Object.defineProperty(window,'claude',{configurable:true,enumerable:true,writable:true,value:{use:async n=>n==='files'?FILES_SHIM:null}});}catch(e){window.claude={use:async n=>n==='files'?FILES_SHIM:null};}
/* the claude.ai catalogue pages are not open to staff here: each brand's diagrams come from its own files on this server */
for(const k in CAT_SITE)delete CAT_SITE[k];
function dgMiss(){return '<div class="cap">This diagram is not on the server yet: its catalogue file is still to be uploaded.</div>'+(S.user&&S.user.role==='admin'?`<button class="btn line sm" style="margin-top:8px" onclick="go('catup')">${ic('upload','s16')} Upload catalogue files</button>`:'');}
"""
sub1("/* ---------- boot ---------- */\nasync function start(){", SRVJS + "/* ---------- boot ---------- */\nasync function start(){")
sub1("'<div class=\"cap\">The diagram could not be opened: the project’s files are not readable from here.</div>'", "dgMiss()")
# Sam 2026-10-11 (screen recording): the browser's Back / Forward and the Mac trackpad swipe step through the app's own
# screens, like the app's back button, instead of leaving the app for the website. One browser history entry per screen.
NAVJS = r"""
/* ---------- browser Back / Forward = the app's own screens ---------- */
var NAVH={on:0,i:0};
var NAV_PRE=['login','otp','signup','pw','roleok','boot'];
function navSave(push){if(!NAVH||!NAVH.on)return;let st;try{st=JSON.parse(JSON.stringify(S.stack));}catch(e){return;}if(push)NAVH.i++;try{history[push?'pushState':'replaceState']({bpnav:{i:NAVH.i,st}},'');}catch(e){}}
window.addEventListener('popstate',e=>{const h=e.state&&e.state.bpnav;if(!h||!NAVH.on)return;
 const dir=h.i<NAVH.i?'back':'push';NAVH.i=h.i;let st=h.st||[];const same=(a,b)=>a.every((x,k)=>b[k]&&x&&x.s===b[k].s);
 if(st.length<S.stack.length&&same(st,S.stack))st=S.stack.slice(0,st.length);
 else if(st.length>S.stack.length&&same(S.stack,st))st=S.stack.concat(st.slice(S.stack.length));
 const ok=x=>x&&SCREENS[x.s]&&(S.user?!NAV_PRE.includes(x.s)&&allowed(x.s):NAV_PRE.includes(x.s));
 try{closeSheet();}catch(err){}
 /* a screen this login may not see (the login screens once logged in, staff screens after log out): stay where we are.
    Logged in, the website stays behind the app until log out (Sam 2026-10-11): the landing page re-opens the app on Back (bpIn) */
 if(!st.length||!st.every(ok)){navSave(false);return;}
 S.stack=st;render(dir);});
/* tells the landing page (same site) that someone is logged in on this browser */
function bpIn(on){try{if(on)localStorage.setItem('bp_in','1');else localStorage.removeItem('bp_in');}catch(e){}}
"""
sub1("function go(s,p={}){S.stack.push({s,p});render('push');}", "function go(s,p={}){S.stack.push({s,p});navSave(true);render('push');}")
sub1("function back(){if(S.stack.length>1){S.stack.pop();render('back');}}",
     "function back(){if(S.stack.length>1){if(NAVH&&NAVH.on&&NAVH.i>0&&history.state&&history.state.bpnav){history.back();return;}S.stack.pop();render('back');}}")
sub1("function tab(s){S.stack=[{s,p:{}}];render('fade');}", "function tab(s){S.stack=[{s,p:{}}];navSave(true);render('fade');}")
sub1("function reset(s,p={}){S.stack=[{s,p}];render('fade');}",
     "function reset(s,p={}){const was=cur();S.stack=[{s,p}];navSave(!!(S.user&&was&&!NAV_PRE.includes(was.s)&&!NAV_PRE.includes(s)));render('fade');}")
sub1(" if(S.ui.after){const f=S.ui.after;S.ui.after=null;f();}\n}\nfunction navHTML(", " if(S.ui.after){const f=S.ui.after;S.ui.after=null;f();}\n navSave(false);\n}\nfunction navHTML(")
sub1("render('');splash();", "render('');splash();NAVH.on=1;NAVH.i=0;navSave(false);")
sub1("/* ---------- boot ---------- */\nasync function start(){", NAVJS + "/* ---------- boot ---------- */\nasync function start(){")
# Sam 2026-10-11 "sabhi brands ke catalogue ... sabhi upload karna he aaj": every brand of his package (All Catalogues >
# BikeSurgeon_Catalog_Import) as cat/<slug>.json + <slug>-dg.json (brands/tools/brands_build.py). Their diagrams and part photos are read
# byte for byte out of the brand's own zips, which Admin uploads unchanged from Catalogue files. "jin jin brands ke MRP he o us us parts me
# daaldo search me": the MRP of every part that has one shows on the search cards, the section table and the part page.
# TVS's oils and lubricants are a "model" in Find Part (TVS > Oils & lubricants) but not a bike a customer can own
sub1("const custModels=(b,cur)=>{const l=(BRANDS_V[b]||[]).filter(m=>!MODEL_BASE[m]);", "const custModels=(b,cur)=>{const l=(BRANDS_V[b]||[]).filter(m=>!MODEL_BASE[m]&&m!=='Oils & lubricants');")
CAT_IN = [os.path.join(SP, 'ktm', 'out', f) for f in ('ktm.json', 'ktm-dg.json', 'husqvarna.json', 'husqvarna-dg.json')]
CAT_IN += [os.path.join(SP, 'brands', 'out', s + x) for s in ('hero', 'royal-enfield', 'yamaha', 'honda', 'tvs', 'bajaj', 'suzuki') for x in ('.json', '-dg.json')]
if FRESH: CAT_IN = [os.path.join(REPO, '.build', 'cat-in', os.path.basename(f)) for f in CAT_IN]
_bv, _cc = {}, {}
for f in CAT_IN:
    if f.endswith('-dg.json'): continue
    d = json.load(open(f, encoding='utf-8'))
    _bv[d['brand']] = d['models']
    for m, c in (d.get('cc') or {}).items(): _cc[m] = c
CATJS = """
/* ---------- every brand's catalogue on this server (Sam 2026-10-11): its list is cat/<slug>.json, its diagrams and part photos come out of
   the brand's own zips that Admin uploads (Catalogue files), its MRP shows wherever the part does ---------- */
DG_SLUG.Yamaha='yamaha';DG_SLUG.Bajaj='bajaj';
CAT_ALL.forEach(e=>{delete e.pf;delete e.pfz;delete e.pfe;if(DG_SLUG[e.vb])e.url='cat/'+DG_SLUG[e.vb]+'.json';e.lazy=1;e.txt=1;});CAT_EXT.length=0;
for(const k in CAT_PHOTO)delete CAT_PHOTO[k];
/* the vehicle form lists each brand's models exactly as its catalogue names them */
Object.assign(BRANDS_V,""" + json.dumps(_bv, ensure_ascii=False, separators=(',', ':')) + """);
{const cc=""" + json.dumps(_cc, ensure_ascii=False, separators=(',', ':')) + """;for(const m in cc)if(!(m in MODEL_CC))MODEL_CC[m]=cc[m];}
"""
sub1("/* ---------- boot ---------- */\nasync function start(){", CATJS + "/* ---------- boot ---------- */\nasync function start(){")
# Bajaj (Sam 2026-10-11): its diagrams are the pages of Bajaj's own PDF books (bajaj_spc_pdfs.zip, stored unchanged). A 'pdf:' link names the
# book's bytes in the zip, the page and the diagram's part of it; pdf.js (vendor/pdfjs) reads just what that page needs from the server and draws it.
PDFJS = r"""
/* ---------- Bajaj diagrams: a page of Bajaj's own PDF book, drawn here ----------
   'pdf:<zip>:<offset>:<length>:<page>:<x0>,<y0>,<x1>,<y1>' = where the book's PDF sits in the zip (stored as is), the page, and the diagram's part of
   the page (fractions of the page as shown). pdf.js (Mozilla's PDF reader, vendor/pdfjs) reads only the parts of the PDF that page needs, straight out
   of the zip on the server, and draws that part at 5 pixels per point (the books' own pictures are at most ~4 per point), kept as PNG: no quality lost. */
let PDF_LIB=null,PDF_W=null,PDF_Q=Promise.resolve();const PDF_DOCS=new Map();
const pdfLib=()=>PDF_LIB||(PDF_LIB=new Promise((ok,no)=>{const go=L=>{L.GlobalWorkerOptions.workerSrc=new URL('vendor/pdfjs/pdf.worker.min.js',document.baseURI).href;ok(L);};
 if(window.pdfjsLib)return go(window.pdfjsLib);const s=document.createElement('script');s.src='vendor/pdfjs/pdf.min.js';
 s.onload=()=>window.pdfjsLib?go(window.pdfjsLib):no({code:'pdfjs'});s.onerror=()=>{PDF_LIB=null;no({code:'pdfjs'});};document.head.appendChild(s);}));
/* one open book per PDF (the 3 last used stay open) */
const pdfDoc=async(fs,path,off,len)=>{const k=path+':'+off;let e=PDF_DOCS.get(k);if(e){PDF_DOCS.delete(k);PDF_DOCS.set(k,e);return e;}
 const L=await pdfLib();if(!PDF_W)PDF_W=new L.PDFWorker();
 let failRej;const failed=new Promise((_,rj)=>failRej=rj);failed.catch(()=>{});
 const tr=new L.PDFDataRangeTransport(len,null);
 const rd=(b,n,t=0)=>fs.read(path,{offset:off+b,length:n}).then(r=>r.bytes,err=>{if(t<1)return new Promise(w=>setTimeout(w,800)).then(()=>rd(b,n,t+1));throw err;});
 tr.requestDataRange=(b,en)=>{rd(b,en-b).then(x=>{if(!x||x.length!==en-b)throw{code:'not_found'};tr.onDataRange(b,x);}).catch(err=>e.fail(err));};
 const task=L.getDocument({range:tr,length:len,rangeChunkSize:262144,disableAutoFetch:true,disableStream:true,isEvalSupported:false,worker:PDF_W,
  standardFontDataUrl:new URL('vendor/pdfjs/standard_fonts/',document.baseURI).href});
 e={doc:task.promise,busy:0,failed,fail:err=>{failRej(err||{code:'unavailable'});if(PDF_DOCS.get(k)===e)PDF_DOCS.delete(k);try{task.destroy();}catch(x){}}};
 task.promise.catch(err=>e.fail(err));PDF_DOCS.set(k,e);
 for(const [k2,e2] of PDF_DOCS){if(PDF_DOCS.size<=3)break;if(e2!==e&&!e2.busy){PDF_DOCS.delete(k2);e2.doc.then(d=>d.destroy(),()=>{});}}
 return e;};
/* one page at a time (big pictures): the part of the page that is the diagram -> PNG */
const catPdf=u=>{if(CAT_PFURL[u])return CAT_PFURL[u];const m=/^pdf:(.+):(\d+):(\d+):(\d+):([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/.exec(u);
 const p=new Promise((ok,no)=>{PDF_Q=PDF_Q.then(async()=>{let e=null,tm=null;try{if(!m)throw{code:'not_found'};const fs=await catFs();if(!fs)throw{code:'unavailable'};
   const path=await catPfPath(fs,m[1]);e=await pdfDoc(fs,path,+m[2],+m[3]);e.busy++;
   const T=new Promise((_,rj)=>{tm=setTimeout(()=>rj({code:'timeout'}),90000);});const race=x=>Promise.race([x,e.failed,T]);
   const doc=await race(e.doc);const pg=await race(doc.getPage(+m[4]));
   const v1=pg.getViewport({scale:1}),x0=+m[5],y0=+m[6],x1=+m[7],y1=+m[8],cw=(x1-x0)*v1.width,ch=(y1-y0)*v1.height;
   const sc=Math.min(5,Math.sqrt(14e6/(cw*ch))),vp=pg.getViewport({scale:sc,offsetX:-x0*v1.width*sc,offsetY:-y0*v1.height*sc});
   const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(cw*sc));cv.height=Math.max(1,Math.round(ch*sc));const cx=cv.getContext('2d');
   cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);
   const job=pg.render({canvasContext:cx,viewport:vp});try{await race(job.promise);}catch(err){try{job.cancel();}catch(x){}throw err;}
   const b=await new Promise(r=>cv.toBlob(r,'image/png'));cv.width=cv.height=0;try{pg.cleanup();}catch(x){}if(!b)throw{code:'unavailable'};
   CAT_PFOK=true;ok(URL.createObjectURL(b));}
  catch(err){if(err&&err.code==='timeout'&&e)e.fail(err);if(CAT_PFOK!==true&&err&&['not_granted','capability_disabled','capability_removed'].includes(err.code))CAT_PFOK=false;no(err);}
  finally{clearTimeout(tm);if(e)e.busy--;}});});
 CAT_PFURL[u]=p;p.catch(()=>{delete CAT_PFURL[u];});return p;};
"""
# Suzuki (Sam 2026-10-11): its diagrams are pages of Suzuki's own PDF books, uploaded as they are: the same 'pdf:' link with offset 0 and the file's size
sub1("const catPf=u=>{if(CAT_PFURL[u])return CAT_PFURL[u];const m=/^p([fa]):(.+):(\\d+):(\\d+)$/.exec(u);",
     PDFJS + "const catPf=u=>{if(CAT_PFURL[u])return CAT_PFURL[u];if(u.startsWith('pdf:'))return catPdf(u);const m=/^p([fa]):(.+):(\\d+):(\\d+)$/.exec(u);")
# Sam's Suzuki folder has a PDF book named "oct150cc gixxer.txt": the file picker offers .txt too (the server already takes it)
sub1('accept=".pdf,.jpg,.jpeg,.png,.zip,.json,.csv"', 'accept=".pdf,.jpg,.jpeg,.png,.zip,.json,.csv,.txt"')
# model codes in section names and remarks stay capitals: "Front Wheel (UZ125NE)", not "(Uz125ne)"
sub1("|Led|[A-Z]?\\d+[A-Za-z0-9.x/]*)\\b/g,w=>w.toUpperCase());", "|Led|Tvs|Mrp|[A-Z]?\\d+[A-Za-z0-9.x/]*|[A-Za-z]{1,6}\\d[A-Za-z0-9]*)\\b/g,w=>w.toUpperCase());")
# part photos given only as zip byte ranges (phf + phz, no photo pages)
sub1("const catPh=(d,pn)=>{const x=d.ph&&d.ph[pn];if(x==null)return null;",
     "const catPh=(d,pn)=>{const x=d.ph&&d.ph[pn];if(x==null){const f=!d.ph&&d.phf&&d.phf[pn];return f?{z:'pf:'+d.phz[f[0]]+':'+f[1]+':'+f[2],w:f[3],h:f[4]}:null;}")
# TVS diagrams are PNG files: keep them PNG, byte for byte
sub1("if(!b||b[0]!==0xFF||b[1]!==0xD8)throw{code:'not_found'};CAT_PFOK=true;ok(URL.createObjectURL(new Blob([b],{type:'image/jpeg'})));return;",
     "const png=!!b&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47;if(!b||!png&&(b[0]!==0xFF||b[1]!==0xD8))throw{code:'not_found'};CAT_PFOK=true;ok(URL.createObjectURL(new Blob([b],{type:png?'image/png':'image/jpeg'})));return;")
# the price on search cards and the part page says what it is: the catalogue MRP
sub1('return v?`<b class="num">${inr(v)}</b> <span class="micro muted">incl. GST</span>`:`<span class="cap">Price on request</span>`;};',
     'return v?`<span class="micro muted">MRP</span> <b class="num">${inr(v)}</b> <span class="micro muted">incl. GST</span>`:`<span class="cap">Price on request</span>`;};')
# Catalogue files: which folder of Sam's package to pick, and the free space on the server (Honda's zip alone is 8 GB)
sub1("const vb=Object.keys(DG_SLUG).find(k=>DG_SLUG[k]===s);if(vb&&!o.brands.includes(vb))o.brands.push(vb);",
     "const vb=Object.keys(DG_SLUG).find(k=>DG_SLUG[k]===s);if(vb&&!o.brands.includes(vb))o.brands.push(vb);if(d.pick&&!o.pick)o.pick=d.pick;")
sub1("CUP.sets=sets;CUP.st=2;refresh();}).catch(()=>{CUP.st=3;refresh();});}",
     "try{const r=await fetch('/api/catup?space=1',{credentials:'same-origin'});if(r.ok){const j=await r.json();CUP.free=typeof j.free==='number'?j.free:null;}}catch(e){}\n  CUP.sets=sets;CUP.st=2;refresh();}).catch(()=>{CUP.st=3;refresh();});}\nconst cupSpace=o=>{const t=cupStat(o),need=t.tb-t.b;return CUP.free!=null&&need>CUP.free?`<p class=\"cap\" style=\"margin:0;color:var(--r)\">Not enough space on your server: these files need ${cupMB(need)} and ${cupMB(CUP.free)} is free.</p>`:'';};")
sub1("<p class=\"cap\" style=\"margin:0\">On your computer: the ${esc(o.brands[0])} folder inside All Catalogues. Only the files this catalogue needs are sent. Keep this page open until it says Done.</p>`}</div>`;}",
     "<p class=\"cap\" style=\"margin:0\">On your computer: ${o.pick?'<b>'+esc(o.pick)+'</b>':'the '+esc(o.brands[0])+' folder inside All Catalogues'}. Only the files this catalogue needs are sent. Keep this page open until it says Done.</p>${cupSpace(o)}`}</div>`;}")
sub1("Every staff profile with Find Part uses these same files.</p>${body}",
     "Every staff profile with Find Part uses these same files.</p>${CUP.free!=null?`<p class=\"cap\" style=\"margin:0\">Free space on your server: <b>${cupMB(CUP.free)}</b></p>`:''}${body}")
# Sam 2026-10-11 "sample data jo kuch bhi he sabhi delete karde": no demo shop data in the server build (tools/nosample.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nosample
a, k = nosample.apply(a); n_patch += k
# real numbers on every dashboard, no demo mechanic / staff / branch names (tools/nosample2.py)
import nosample2
a, k = nosample2.apply(a); n_patch += k
# Sam 2026-10-11 08:01Z "admin page pe inventory add karne ka option hi nhi he": Admin's Inventory page, Stock in, real suppliers (tools/inventory.py)
import inventory
a, k = inventory.apply(a); n_patch += k
# Sam 2026-10-11 14:18Z: Admin sets a staff login's password (New staff login, Users > Staff) (tools/staffpw.py)
import staffpw
a, k = staffpw.apply(a); n_patch += k
# Sam 2026-10-11 "Code karde": inventory from catalogues (part no. fills details, 1 to 4 photos, 1 must, price rule, bill paste, waiting for photos, Find Part Add to stock) (tools/invcat.py)
import invcat
a, k = invcat.apply(a); n_patch += k
# Sam 2026-10-11 18:56Z: "Photo of the bill" on Paste supplier bill; the phone reads it, the photo is never kept (tools/billocr.py)
import billocr
a, k = billocr.apply(a); n_patch += k
# Sam 2026-10-11 19:53Z-20:51Z: update 8c, bills read by Apna AI (PDF, many pages, header, totals, MRP/discount/HSN/GST, tap to fix),
# supplier bills to pay with due alerts, View of a bill, the phone's bottom menu on every page (tools/bill8c.py)
import bill8c
a, k = bill8c.apply(a); n_patch += k
# Sam 2026-10-11 18:19Z (phone video): "zoom nhi hona he sirf diagram/photos utna hi zoom hona he poora page zoom nhi hona he".
# The page never zooms (no pinch, no double tap, no zoom when a box is tapped); a diagram or part photo opened full screen zooms with
# two fingers or a tap. index.html (the landing page that holds the app) gets the same below.
NOZOOM_META = 'maximum-scale=1,user-scalable=no,'
sub1('<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>',
     '<meta name=viewport content="width=device-width,initial-scale=1,' + NOZOOM_META + 'viewport-fit=cover"><style>html{touch-action:pan-x pan-y}')
sub1("const img=d.querySelector('.fpz-in>*'),box=d.querySelector('.fpz-in');img.onclick=e=>{const fx=e.offsetX/img.clientWidth,fy=e.offsetY/img.clientHeight;d.classList.toggle('z');if(d.classList.contains('z')){box.scrollLeft=fx*img.clientWidth-box.clientWidth/2;box.scrollTop=fy*img.clientHeight-box.clientHeight/2;}};",
     "fpzWire(d);", count=2)
sub1("Tap to zoom in or out</div>", "Tap or pinch to zoom</div>", count=2)
sub1("function catZoom(i){", r"""document.addEventListener('gesturestart',e=>e.preventDefault());   // iPhone: no page pinch zoom
// full-screen diagram / photo: a tap zooms in or out where tapped, two fingers zoom from 1x to 8x round the fingers
function fpzWire(d){const box=d.querySelector('.fpz-in'),fig=box&&box.firstElementChild;if(!fig)return;
 const fit=()=>box.clientWidth;let p=null,pz=0;
 const at=(x,y)=>{const f=fig.getBoundingClientRect();return [(x-f.left)/f.width,(y-f.top)/f.height];};
 const size=(w,fx,fy,cx,cy)=>{w=Math.round(Math.max(fit(),Math.min(fit()*8,w)));fig.style.width=w+'px';fig.style.maxWidth='none';fig.style.flex='none';d.classList.toggle('z',w>fit()+1);
  const f=fig.getBoundingClientRect();box.scrollLeft+=f.left+fx*f.width-cx;box.scrollTop+=f.top+fy*f.height-cy;};
 fig.onclick=e=>{if(Date.now()-pz<500)return;const [fx,fy]=at(e.clientX,e.clientY),r=box.getBoundingClientRect();size(fig.offsetWidth>fit()+1?fit():Math.max(1430,fit()*2),fx,fy,r.left+r.width/2,r.top+r.height/2);};
 const gap=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY)||1,mid=t=>[(t[0].clientX+t[1].clientX)/2,(t[0].clientY+t[1].clientY)/2];
 box.addEventListener('touchstart',e=>{if(e.touches.length===2){const [cx,cy]=mid(e.touches);p={g:gap(e.touches),w:fig.offsetWidth,f:at(cx,cy)};}},{passive:true});
 box.addEventListener('touchmove',e=>{if(!p||e.touches.length<2)return;e.preventDefault();const [cx,cy]=mid(e.touches);size(p.w*gap(e.touches)/p.g,p.f[0],p.f[1],cx,cy);},{passive:false});
 box.addEventListener('touchend',e=>{if(p&&e.touches.length<2){p=null;pz=Date.now();}});}
function catZoom(i){""")
# Any brand part number search opens only the brands whose numbers have the typed number's shape (CAT_PNR, catRoute). The table in the
# app source was made from the old web files (re/edit_cat.py); make it again, the same way, from the brand files this build ships.
import base64, collections, hashlib
PN_AL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
pn_pk = lambda v: re.sub(r'[^A-Z0-9]', '', str(v or '').upper())
pn_shape = lambda k: ''.join(('d' if m[0].isdigit() else 'a') + str(len(m)) for m in re.findall(r'[A-Z]+|\d+', k))
def pn_pb(vb, p, rem):
    """catPb in Python: the base a colour or revision variant of the number shares"""
    p = str(p or '').strip().upper(); k = pn_pk(p)
    if not k: return ''
    if vb == 'Honda' and re.fullmatch(r'[A-Z0-9]{5}-[A-Z0-9]{3}-[A-Z0-9]{5}', p): return k[:11]
    if vb == 'Suzuki' and re.fullmatch(r'[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{3}', p): return k[:10]
    if vb == 'Kawasaki' and re.fullmatch(r'[A-Z0-9]{5}-[A-Z0-9]{4}-[A-Z0-9]{1,4}', p): return k[:9]
    if vb == 'Vespa' and 'Colour part' in str(rem or '') and len(k) >= 9: return k[:-2]
    return ''
PNR, PNR_OF = {}, []
for f in CAT_IN:
    if f.endswith('-dg.json'): continue
    raw = open(f, 'rb').read(); d = json.loads(raw); vb = d['brand']
    PNR_OF.append('%s %s' % (os.path.basename(f), hashlib.sha1(raw).hexdigest()[:10]))
    cnt, firsts, bits = collections.Counter(), collections.defaultdict(set), bytearray(162)
    for r in d['d']:
        alts = [pn_pk(m.group(1)) for m in re.finditer(r'(?:Alternate|Probiking\)) no\. ([A-Z0-9][A-Z0-9-]{4,})', str(r[8] or ''))]
        for j, k in enumerate([pn_pk(r[5]), pn_pb(vb, r[5], r[8])] + alts):
            if not k: continue
            if j != 1: cnt[pn_shape(k)] += 1; firsts[pn_shape(k)].add(k[:2])
            for x, y in zip(k, k[1:]):
                n = PN_AL.index(x) * 36 + PN_AL.index(y); bits[n >> 3] |= 1 << (n & 7)
    PNR[vb] = [' '.join('%s:%d:%s' % (s, n, ''.join(sorted(firsts[s]))) for s, n in cnt.most_common()), base64.b64encode(bytes(bits)).decode()]
_i = a.index('\nconst CAT_PNR={') + 1; _j = a.index('\n', _i)
assert a[_j + 1:].startswith('const CAT_PNA='), 'CAT_PNR is not one line'
a = a[:_i] + 'const CAT_PNR=' + json.dumps(PNR, separators=(',', ':')).replace('"', "'") + ';' + a[_j:]
a, _n = re.subn(r'made by edit_cat\.py from these files: [^*]*\*/', 'made by tools/build_public.py from these files: ' + ', '.join(PNR_OF) + ' */', a)
assert _n == 1, _n; n_patch += 1
print('CAT_PNR:', ', '.join('%s %d shapes' % (vb, len(t.split())) for vb, (t, g) in PNR.items()))
# the brand tiles' counts (models, part numbers) from the same brand files; the table in the source counted the old web files
CNT = {}
for f in CAT_IN:
    if f.endswith('-dg.json'): continue
    d = json.load(open(f, encoding='utf-8'))
    CNT[d['brand']] = {'m': len(d['models']), 'pn': len({pn_pk(r[5]) for r in d['d'] if pn_pk(r[5])})}
a, _n = re.subn(r'const M2_CNT=\{[^\n;]*\};', lambda m: 'const M2_CNT=' + json.dumps(CNT, separators=(',', ':')) + ';', a)
assert _n == 1, _n; n_patch += 1
print('M2_CNT:', CNT)
assert "123456" not in re.sub(r"KA0200123456|CAT_PNA='0123456789|\nconst CAT_PNR=[^\n]*", "", a), "demo OTP text still present"
assert 'bp-db' not in a
os.makedirs(OUT, exist_ok=True)
# Find Part form (Sam 2026-10-12 05:14Z "Engine (CC) me automatic aana he selected models ke kounse kounse CC ke vahicels hein", 05:15Z "year bhi
# same aise hi"): once a model is picked, Engine (cc) lists only that model's cc (picked for you) and Year only that model's years (picked for you
# when there is just one). A cc picked BEFORE the model still narrows the model list; picking a model no longer shrinks it.
sub1("const all=BRANDS_V[f.vb]||[];const ms=all.filter(m=>f.cc==='Any'||String(MODEL_CC[m]||'')===String(f.cc));\n const ccs=[...new Set(all.map(m=>MODEL_CC[m]).filter(Boolean))].sort((a,b)=>a-b);",
     "const all=BRANDS_V[f.vb]||[];const ms=all.filter(m=>f.cc==='Any'||(f.vm!=='Any'&&!f.ccU)||String(MODEL_CC[m]||'')===String(f.cc));\n const mcc=f.vm!=='Any'?MODEL_CC[f.vm]||0:0,ccs=f.vm!=='Any'?(mcc?[mcc]:[]):[...new Set(all.map(m=>MODEL_CC[m]).filter(Boolean))].sort((a,b)=>a-b);")
sub1("let yo=`<option value=\"Any\">Any year</option>`;if(f.vb!=='Any'&&f.vm!=='Any'){const Y=fpYrs(f);yo=Y==='wait'?`<option value=\"Any\">Loading years…</option>`:`<option value=\"Any\">${Y.ys.length?'Any year':'All books'}</option>`+Y.ys.map(y=>`<option value=\"${y}\"${String(f.yr)===String(y)?' selected':''}>${y}</option>`).join('');}",
     "let yo=`<option value=\"Any\">Any year</option>`;if(f.vb!=='Any'&&f.vm!=='Any'){const Y=fpYrs(f);if(Y==='wait')yo=`<option value=\"Any\">Loading years…</option>`;else{const one=Y.ys.length===1&&!Y.none;if(one&&f.yr==='Any')f.yr=String(Y.ys[0]);yo=(one?'':`<option value=\"Any\">${Y.ys.length?'Any year':'All books'}</option>`)+Y.ys.map(y=>`<option value=\"${y}\"${String(f.yr)===String(y)?' selected':''}>${y}</option>`).join('');}}")
sub1("${sel('cc','Engine (cc)',`<option value=\"Any\">Any cc</option>`+ccs.map(c=>`<option value=\"${c}\"${String(f.cc)===String(c)?' selected':''}>${c} cc</option>`).join(''),f.vb==='Any')}",
     "${sel('cc','Engine (cc)',(f.vm!=='Any'&&!mcc?`<option value=\"Any\">Not listed</option>`:f.vm==='Any'||f.ccU?`<option value=\"Any\">Any cc</option>`:'')+ccs.map(c=>`<option value=\"${c}\"${String(f.cc)===String(c)?' selected':''}>${c} cc</option>`).join(''),f.vb==='Any'||(f.vm!=='Any'&&!mcc))}")
sub1("function m2Set(k,v){const f=S.ui.fp;if(k==='vb'){f.yr='Any';fpSet('vb',v);return;}\n if(k==='vm'){f.vm=v;f.vv='Any';if(v!=='Any'&&MODEL_CC[v])f.cc=String(MODEL_CC[v]);f.yr='Any';refresh();return;}\n if(k==='cc'){f.cc=v;if(v!=='Any'&&f.vm!=='Any'&&String(MODEL_CC[f.vm]||'')!==String(v))f.vm='Any';f.yr='Any';refresh();return;}",
     "function m2Set(k,v){const f=S.ui.fp;if(k==='vb'){f.yr='Any';f.ccU=0;fpSet('vb',v);return;}\n if(k==='vm'){f.vm=v;f.vv='Any';if(v!=='Any')f.cc=MODEL_CC[v]?String(MODEL_CC[v]):'Any';else if(!f.ccU)f.cc='Any';f.yr='Any';refresh();return;}\n if(k==='cc'){f.cc=v;f.ccU=v!=='Any'?1:0;if(v==='Any'&&f.vm!=='Any'&&MODEL_CC[f.vm])f.cc=String(MODEL_CC[f.vm]);if(v!=='Any'&&f.vm!=='Any'&&String(MODEL_CC[f.vm]||'')!==String(v))f.vm='Any';f.yr='Any';refresh();return;}")
sub1("if(k==='vm'&&v!=='Any')f.cc=String(MODEL_CC[v]);refresh();}", "if(k==='vm'&&v!=='Any')f.cc=MODEL_CC[v]?String(MODEL_CC[v]):'Any';refresh();}")
# Sam 2026-10-12 06:20Z-06:27Z: update 8h, the web agent for part numbers no catalogue has (tools/altno.py; server lib/altagent.mjs)
import altno
a, k = altno.apply(a); n_patch += k
# 2026-10-12 update 8j: Find Part fixes from the 4-round test (tools/fpfix.py)
import fpfix
a, k = fpfix.apply(a); n_patch += k
# 2026-10-12 update 8k: a part number in any staff search bar shows what the brand catalogues have (tools/fphit.py)
import fphit
a, k = fphit.apply(a); n_patch += k
# 2026-10-12 update 8l: a number no catalogue has fills from its other number in Add product / Stock in / Paste bill (tools/altfill.py)
import altfill
a, k = altfill.apply(a); n_patch += k
# Sam 2026-10-12 11:13Z: update 8m, the Manager profile: purchase rates and margin Admin only, purchase order limit (tools/manager.py)
import manager
a, k = manager.apply(a); n_patch += k
# Sam 2026-10-12 11:47Z: update 8n, online orders page (Admin + Manager), money today, return approval with a limit (tools/manager2.py)
import manager2
a, k = manager2.apply(a); n_patch += k
# Sam 2026-10-12 11:40Z: update 8o, the Billing profile: fixed prices, warranty claims, bill cancel / change through Manager (tools/billing.py)
import billing
a, k = billing.apply(a); n_patch += k
# Sam 2026-10-12 11:52Z-11:57Z: update 8p, the Accountant profile (tools/accountant.py)
import accountant
a, k = accountant.apply(a); n_patch += k
# Sam 2026-10-12 12:14Z: update 8q, Dead stock page from the Figma design (Admin + Manager, tools/deadstock.py)
import deadstock
a, k = deadstock.apply(a); n_patch += k
open(os.path.join(OUT, 'app.html'), 'w', encoding='utf-8').write(a)
_ix = open(os.path.join(os.path.dirname(SRC), 'index.html'), encoding='utf-8').read()
_vp = '<meta name="viewport" content="width=device-width, initial-scale=1">'
assert _ix.count(_vp) == 1, 'index.html viewport'
_ix = _ix.replace(_vp, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n'
                  '<style>html{touch-action:pan-x pan-y}html:has(body.appopen),body.appopen{overflow:hidden;overscroll-behavior:none}</style>\n<script>document.addEventListener(\'gesturestart\',e=>e.preventDefault());</script>')
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(_ix)
CAT_DIRS = ['cat', 'bj', 'ph', 'phh', 'figs']
if '--no-cat' in sys.argv:  # Sam 2026-10-10: no catalogue data on the site, brands come one by one later
    for d in CAT_DIRS:
        if os.path.isdir(os.path.join(OUT, d)): shutil.rmtree(os.path.join(OUT, d))
for d in ([] if FRESH else ['vendor'] if '--no-cat' in sys.argv else CAT_DIRS + ['vendor']):
    dst = os.path.join(OUT, d); src = os.path.join(SP, 'proto', d)
    if os.path.isdir(dst) and len(os.listdir(dst)) == len(os.listdir(src)) and '--assets' not in sys.argv: continue
    if os.path.isdir(dst): shutil.rmtree(dst)
    shutil.copytree(src, dst)
# Sam 2026-10-11: catalogues come back brand by brand from his own files; their data (no pictures) ships here, the PDFs go up from Admin
os.makedirs(os.path.join(OUT, 'cat'), exist_ok=True)
for f in CAT_IN: shutil.copyfile(f, os.path.join(OUT, 'cat', os.path.basename(f)))
# cat/xref.json: part numbers that two of these brands' books share (same number = interchangeable), as proto/xref_build.py makes it
import collections
norm = lambda x: re.sub(r'[^A-Z0-9]', '', str(x or '').upper())
by = collections.defaultdict(lambda: collections.defaultdict(set))
for f in sorted(os.listdir(os.path.join(OUT, 'cat'))):
    if not f.endswith('.json') or f.endswith('-dg.json') or f == 'xref.json': continue
    d = json.load(open(os.path.join(OUT, 'cat', f), encoding='utf-8')); vb = d.get('brand') or f[:-5].title()
    for r in d['d']:
        pk = norm(r[5])
        if len(pk) >= 5:
            for k in r[11]: by[pk][vb].add(d['vmod'][d['vars'][k]])
brands = sorted({b for v in by.values() for b in v}); bi = {b: i for i, b in enumerate(brands)}
models = [[] for _ in brands]; mi = [{} for _ in brands]; xr = {}
for pk, bv in by.items():
    if len(bv) < 2: continue
    o = {}
    for b, ms in bv.items():
        for m in sorted(ms):
            if m not in mi[bi[b]]: mi[bi[b]][m] = len(models[bi[b]]); models[bi[b]].append(m)
        o[bi[b]] = [mi[bi[b]][m] for m in sorted(ms)]
    xr[pk] = o
open(os.path.join(OUT, 'cat', 'xref.json'), 'w', encoding='utf-8').write(json.dumps({'b': brands, 'm': models, 'x': xr}, separators=(',', ':'), ensure_ascii=False))
print('xref:', len(xr), 'shared part numbers between', ', '.join(brands))
# alternate number lists (update 8i, tools/altlist_build.py -> tools/altlists/lists.json): each pair gets a flag saying which of its two
# numbers these catalogues have (1 = the old one, 2 = the new one), so the app only tries numbers Find Part can show
_al = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'altlists', 'lists.json')
if os.path.exists(_al):
    _j = json.load(open(_al, encoding='utf-8'))
    for r in _j['p']: r[5:] = [(1 if norm(r[0]) in by else 0) | (2 if norm(r[2]) in by else 0)]
    os.makedirs(os.path.join(OUT, 'cat', 'alt'), exist_ok=True)
    open(os.path.join(OUT, 'cat', 'alt', 'lists.json'), 'w', encoding='utf-8').write(json.dumps(_j, separators=(',', ':'), ensure_ascii=False))
    print('alternate lists:', len(_j['p']), 'pairs,', sum(1 for r in _j['p'] if r[5] in (1, 2)), 'with only one number in these catalogues')
n_files = sum(len(f) for _, _, f in os.walk(OUT)); size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
print(f'{n_patch} patches applied; public/: {n_files} files, {size/1e6:.1f} MB')
