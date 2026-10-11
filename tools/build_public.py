#!/usr/bin/env python3
"""Build srv/public/ for the bikepharma.com Node server:
   app.html = website app (site/com/app.html) patched for server mode (API login, shared DB sync, files shim),
   index.html = landing page as is, plus the catalogue/photo folders from proto/."""
import json, os, re, shutil, sys
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(SP, 'site', 'com', 'app.html')
OUT = os.path.join(SP, 'srv', 'public')
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
# Sam 2026-10-11 "sample data jo kuch bhi he sabhi delete karde": no demo shop data in the server build (tools/nosample.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nosample
a, k = nosample.apply(a); n_patch += k
# real numbers on every dashboard, no demo mechanic / staff / branch names (tools/nosample2.py)
import nosample2
a, k = nosample2.apply(a); n_patch += k
assert "123456" not in re.sub(r"KA0200123456|CAT_PNA='0123456789", "", a), "demo OTP text still present"
assert 'bp-db' not in a
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'app.html'), 'w', encoding='utf-8').write(a)
shutil.copyfile(os.path.join(SP, 'site', 'com', 'index.html'), os.path.join(OUT, 'index.html'))
CAT_DIRS = ['cat', 'bj', 'ph', 'phh', 'figs']
if '--no-cat' in sys.argv:  # Sam 2026-10-10: no catalogue data on the site, brands come one by one later
    for d in CAT_DIRS:
        if os.path.isdir(os.path.join(OUT, d)): shutil.rmtree(os.path.join(OUT, d))
for d in (['vendor'] if '--no-cat' in sys.argv else CAT_DIRS + ['vendor']):
    dst = os.path.join(OUT, d); src = os.path.join(SP, 'proto', d)
    if os.path.isdir(dst) and len(os.listdir(dst)) == len(os.listdir(src)) and '--assets' not in sys.argv: continue
    if os.path.isdir(dst): shutil.rmtree(dst)
    shutil.copytree(src, dst)
# Sam 2026-10-11: catalogues come back brand by brand from his own files; their data (no pictures) ships here, the PDFs go up from Admin
CAT_IN = [os.path.join(SP, 'ktm', 'out', f) for f in ('ktm.json', 'ktm-dg.json', 'husqvarna.json', 'husqvarna-dg.json')]
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
n_files = sum(len(f) for _, _, f in os.walk(OUT)); size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
print(f'{n_patch} patches applied; public/: {n_files} files, {size/1e6:.1f} MB')
