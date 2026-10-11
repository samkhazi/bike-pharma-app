"""Sam 2026-10-11 14:18Z: "me staff ka ek login ready kiya tha lkn password kuch set nhi kiya phir bhi password pooch arha he aur password
set karne ka ya change karne ka option bhi nhi he admin me".
Staff log in with a password. Before, New staff login made one up and showed it only once in a sheet, and a new one could only be made
from a button at the bottom of the staff sheet. Now Admin types the password (or taps Make one) in New staff login, the login is made only
once the server has saved it, and Users > Staff > tap a name opens the staff sheet with Set password at the top."""

PWJS = r"""
/* ---------- staff passwords: Admin sets them (Sam 2026-10-11) ---------- */
async function srvSetPw(id,pw){try{const r=await api('POST','/api/users/password',{id,password:pw});return r.error||'';}catch(e){return 'Could not reach the server. Try again.';}}
const pwBad=pw=>!pw?'Enter a password for this login.':pw.length<6?'Password must be at least 6 characters.':/\s/.test(pw)?'Password can’t have spaces.':'';
function pwMake(inp){const el=document.getElementById(inp);if(!el)return;el.value=genPw().slice(0,8);el.dispatchEvent(new Event('input'));el.focus();}
function pwCopy(){const t=S.ui.pwShow||'';const fb=()=>toast('Password: '+t);try{navigator.clipboard.writeText(t).then(()=>toast('Password copied'),fb);}catch(e){fb();}}
const pwField=(id,val,oninput)=>`<div class="row" style="gap:8px"><div class="inp grow">${ic('lock','s18')}<input id="${id}" value="${esc(val||'')}" placeholder="At least 6 characters" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false"${oninput?` oninput="${oninput}"`:''}></div><button class="btn line sm" type="button" onclick="pwMake('${id}')">Make one</button></div>`;
const pwCard=(name,id,pw)=>`<div class="card"><div class="kv"><span>Name</span><span>${esc(name)}</span></div><div class="kv"><span>Login</span><span>${esc(id)}</span></div><div class="kv"><span>Password</span><span><b class="num" style="user-select:all">${esc(pw)}</b></span></div></div><button class="btn line" onclick="pwCopy()">${ic('copy','s18')} Copy password</button>`;
async function staffPw(k){const a=ACC()[k];const el=document.getElementById('sp-pw');const e=document.getElementById('sp-err');const pw=el?el.value.trim():'';
 const show=t=>{if(e){e.textContent=t;e.style.display=t?'':'none';}if(el)el.closest('.inp').classList.toggle('err',!!t);};
 const bad=pwBad(pw);if(bad)return show(bad);if(S.ui.spBusy)return;S.ui.spBusy=1;const err=await srvSetPw(k,pw);S.ui.spBusy=0;if(err)return show('Password not saved: '+err);
 audit('Staff password set',a.sid||k,'—','New password');save();S.ui.pwShow=pw;closeSheet();
 sheet(`${okBadge(72)}<h3 class="h2">Password saved</h3>${pwCard(a.name,k,pw)}<p class="cap">Give this to ${esc(a.name)}. They log in with ${k.includes('@')?'this email':'this mobile number'} and this password. Their old password stops working now.</p><button class="btn" onclick="closeSheet()">Done</button>`);}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'staffpw.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    # New staff login: Admin sets the password
    sub("<p class=\"cap\">Staff can’t sign up themselves. Each staff login gets a password here (shown once). Mechanic logins are made from their first bill.</p>",
        "<p class=\"cap\">Staff can’t sign up themselves. Set their password here: they log in with their mobile number or email and this password. Mechanic logins are made from their first bill.</p>")
    sub("placeholder=\"10-digit mobile or email\" oninput=\"S.ui.ns.login=this.value\"></div></div>\n",
        "placeholder=\"10-digit mobile or email\" oninput=\"S.ui.ns.login=this.value\"></div></div>\n"
        " <div class=\"field\"><label for=\"ns3\">Password</label>${pwField('ns3',f.pw,'S.ui.ns.pw=this.value')}<div class=\"cap\">Give this password to the staff member. You can change it any time: Users › Staff › tap their name.</div></div>\n")
    sub("<button class=\"btn\" onclick=\"createStaff()\">Create staff login</button>",
        "<button class=\"btn\" onclick=\"createStaff()\" ${S.ui.nsBusy?'disabled':''}>${S.ui.nsBusy?'Saving…':'Create staff login'}</button>")
    i = a.index("function createStaff(){")
    j = a.index("tab('users')\">Done</button>`);}", i) + len("tab('users')\">Done</button>`);}")
    old = a[i:j]
    assert old.count('function ') == 1 and 'srvNewPw(id)' in old, 'createStaff changed'
    a = a[:i] + r"""async function createStaff(){const f=S.ui.ns;const id=normId(f.login);const pw=String(f.pw||'').trim();
 if(!f.name.trim()){S.ui.nsErr='Enter the staff member’s name.';return refresh();}
 if(!id||(!id.includes('@')&&id.length!==10)){S.ui.nsErr='Enter a valid 10-digit mobile number or an email.';return refresh();}
 if(ACC()[id]){S.ui.nsErr='This mobile/email already has a Bike Pharma account.';return refresh();}
 const bad=pwBad(pw);if(bad){S.ui.nsErr=bad;return refresh();}
 if(S.ui.nsBusy)return;S.ui.nsBusy=1;S.ui.nsErr=null;refresh();const err=await srvSetPw(id,pw);S.ui.nsBusy=0;
 if(err){S.ui.nsErr='Password not saved: '+err;return refresh();}
 const role=ROLEKEY[f.role];const sid=nextSid(f.role);const name=f.name.trim();
 DB.accounts[id]={role,name,label:LABEL[role],sub:'Staff ID '+sid,sid,status:'active'};
 audit('Staff login created · '+LABEL[role],sid,'—',id);save();S.ui.ns=null;S.ui.nsErr=null;S.ui.pwShow=pw;refresh();
 sheet(`${okBadge(72)}<h3 class="h2">Login created</h3><div class="card"><div class="kv"><span>Role</span><span>${LABEL[role]}</span></div><div class="kv"><span>Staff ID</span><span>${sid}</span></div></div>${pwCard(name,id,pw)}<p class="cap">Give them this ${id.includes('@')?'email':'number'} and password. To change it later: Users › Staff › tap their name.</p><button class="btn" onclick="closeSheet();S.ui.ut='Staff';tab('users')">Done</button>`);}""" + a[j:]
    n += 1
    # staff sheet: Set password first, the old "make one up" button goes
    sub("<div class=\"cap\">${esc(a.sid)} · ${esc(a.label)} · ${esc(k)}</div>\n <div class=\"field\"><label>Role</label>",
        "<div class=\"cap\">${esc(a.sid)} · ${esc(a.label)} · ${esc(k)}</div>\n"
        " <div class=\"field\"><label for=\"sp-pw\">Set a new password</label>${pwField('sp-pw','')}<div class=\"errmsg\" id=\"sp-err\" style=\"display:none\"></div><button class=\"btn\" style=\"margin-top:8px\" onclick=\"staffPw('${k}')\">Save password</button></div>\n"
        " <div class=\"field\"><label>Role</label>")
    sub("<button class=\"btn line\" onclick=\"staffRole('${k}')\">Save role</button></div><button class=\"btn line\" onclick=\"staffPw('${k}')\">Set a new password</button>`);}",
        "<button class=\"btn line\" onclick=\"staffRole('${k}')\">Save role</button></div>`);}")
    i = a.index("function staffPw(k){const a=ACC()[k];const pw=srvNewPw(k);")
    j = a.index("\n", i)
    a = a[:i] + a[j + 1:]
    n += 1
    sub("<div class=\"cap\">Tap a staff member to change their role or deactivate their login.</div>",
        "<div class=\"cap\">Tap a staff member to set a new password, change their role or turn off their login.</div>")
    sub("/* ---------- boot ---------- */\nasync function start(){", PWJS + "/* ---------- boot ---------- */\nasync function start(){")
    assert 'srvNewPw(' not in a.replace('function srvNewPw(', ''), 'srvNewPw still used'
    return a, n
