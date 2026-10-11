"""Update 8c (Sam 2026-10-11 19:53Z-20:51Z, "sabhi saath me hi chahiye"): supplier bills read by "Apna AI" on our own server (free,
nothing kept), PDF bills and many pages, the bill's header / totals / MRP / discount / HSN / GST, tap a line to fix its part no.,
supplier bills to pay with due alerts for Admin, View of a bill, and the phone's bottom menu on every page with a little animation.
The code is in tools/bill8c_parse.js (reads a bill's text) and tools/bill8c_app.js (screens); this file puts them into the app.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

BPCSS = r"""
/* ---- update 8c: supplier bill read by Apna AI, bills to pay, phone bottom menu on every page ---- */
.bp-i{color:var(--ink5)}
.bp-w{display:flex;gap:6px;align-items:flex-start;margin-top:5px;padding:6px 9px;border-radius:9px;font-size:12px;font-weight:600;line-height:1.35;background:var(--amber-soft);color:var(--amber)}
.bp-w svg{flex:none;margin-top:1px}
.bp-w.r{background:var(--r-soft);color:var(--r)}
.bp-w.g{background:var(--g-soft);color:var(--g)}
.bp-w.i{background:var(--paper);color:var(--ink7);border:1px solid var(--line)}
.bp-ok{color:var(--g);display:grid;place-items:center;flex:none}
.bp-bill{display:flex;flex-direction:column;gap:10px}
.bp-fix{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px}
.bp-fix input{flex:1 1 140px;min-width:0;height:38px;border:1.5px solid var(--line2);border-radius:10px;padding:0 10px;font:inherit;font-weight:700;letter-spacing:.02em;text-transform:uppercase;background:var(--card);color:var(--ink)}
.bp-fix input:focus{outline:none;border-color:var(--ink)}
.bp-fl{display:inline-block;margin-top:4px;font-size:12px}
.sup-due{width:100%;border:1.5px solid var(--amber)}
.sup-due.r{border-color:var(--r)}
.sup-b{display:flex;flex-direction:column;gap:8px}
.sup-b .h3 .link{margin-left:6px;font-size:12px}
.nav.rise{animation:navRise .42s cubic-bezier(.2,.9,.3,1.15) both}
@keyframes navRise{from{transform:translateY(110%)}to{transform:none}}
.nav.go .bubble{animation:navHop .42s cubic-bezier(.3,1.3,.5,1)}
@keyframes navHop{0%{transform:none}35%{transform:translateY(-7px) scale(.9,1.08)}100%{transform:none}}
.nav button{transition:color .2s,transform .15s}
.nav button:active{transform:scale(.9)}
html:not(.wv) .screen.hasnav.in-push,html:not(.wv) .screen.hasnav.in-back,html:not(.wv) .screen.hasnav.in-fade{animation:none}
html:not(.wv) .screen.hasnav.in-push>:not(.nav){animation:push .32s cubic-bezier(.2,.8,.2,1)}
html:not(.wv) .screen.hasnav.in-back>:not(.nav){animation:back .32s cubic-bezier(.2,.8,.2,1)}
html:not(.wv) .screen.hasnav.in-fade>:not(.nav){animation:fade .28s ease-out}
@media (prefers-reduced-motion:reduce){.nav.rise,.nav.go .bubble{animation:none}html:not(.wv) .screen.hasnav>:not(.nav){animation:none!important}}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'bill8c.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    js = '\n'.join(open(os.path.join(HERE, f), encoding='utf-8').read().strip() for f in ('bill8c_parse.js', 'bill8c_app.js'))
    js += '\nvar NAV_LAST=-1;'
    assert '123456' not in js + BPCSS and '</script' not in js
    sub("/* ---------- Waiting for photos ---------- */", js + "\n/* ---------- Waiting for photos ---------- */")
    sub("/* ---- inventory (update 8): phone stacks, website two columns ---- */", BPCSS.strip() + "\n/* ---- inventory (update 8): phone stacks, website two columns ---- */")
    # the phone's bottom menu on every page except the login pages and pages with their own bottom buttons; the bubble moves over
    sub(" const navs=S.user?NAVS[S.user.role]:null;const idx=navs?navs.findIndex(n=>n[0]===s):-1;\n const showNav=navs&&idx>-1;\n"
        " vp.innerHTML=`<div class=\"screen ${anim?'in-'+anim:''}\">${offBar()}${html}${showNav?navHTML(navs,idx):''}</div>`;translateVp();",
        " const navs=S.user?NAVS[S.user.role]:null;const idx=navs?navIdx(navs,s,html):-1;\n const showNav=navs&&idx>-1,from=NAV_LAST;NAV_LAST=showNav?idx:-1;\n"
        " vp.innerHTML=`<div class=\"screen ${anim?'in-'+anim:''}${showNav?' hasnav':''}\">${offBar()}${html}${showNav?navHTML(navs,idx,from):''}</div>`;translateVp();if(showNav)navMove();")
    # the bell: Admin sees supplier bills due (3 days before, on the day, late)
    sub("<button class=\"iconbtn line\" onclick=\"toast('No new notifications')\" aria-label=\"Notifications\">${ic('bell','s20')}</button>",
        "<button class=\"iconbtn line\" onclick=\"supBellOn()\" aria-label=\"Notifications\">${ic('bell','s20')}${supBellDot('cnt')}</button>")
    sub("<button class=\"wv-ibtn\" onclick=\"${notif?\"go('notifs')\":\"toast('No new notifications')\"}\" aria-label=\"Notifications\">${ic('bell','s20')}</button>",
        "<button class=\"wv-ibtn\" onclick=\"${notif?\"go('notifs')\":\"supBellOn()\"}\" aria-label=\"Notifications\">${ic('bell','s20')}${notif?'':supBellDot('wv-cnt')}</button>")
    sub("admin:['ainv',", "admin:['supbills','supdue','ainv',")
    sub("<div class=\"scroll\"><div class=\"pad\">${staffHead()}\n <div class=\"chips\">${['All branches',",
        "<div class=\"scroll\"><div class=\"pad\">${staffHead()}${supDueCard()}\n <div class=\"chips\">${['All branches',")
    # Stock in: the same bill twice (tap Post again to post it anyway), GSTIN on a new supplier, the bill's MRP / HSN / GST on posting
    sub("{const s0=sups().find(s=>s.n.toLowerCase()===sn.toLowerCase());",
        "if(post){const dd=bpDup(sn,g.gstin,g.inv,g.id),dk=dd?g.inv+'|'+dd.id:'';if(dd&&S.ui.geDup!==dk){S.ui.geDup=dk;toast('Bill '+g.inv+' is already in '+dd.id+'. Tap Post again to post it anyway.');return refresh();}}\n"
        " {const s0=sups().find(s=>s.n.toLowerCase()===sn.toLowerCase());")
    sub("sups().unshift({n:sn,c:'—',gst:'—',pay:0,days:30,lead:3,fill:100,rate:5,cat:'General'})",
        "sups().unshift({n:sn,c:'—',gst:g.gstin||'—',pay:0,days:30,lead:3,fill:100,rate:5,cat:'General'})")
    sub("if(post){geNwPost(g);g.items.forEach(", "if(post){geNwPost(g);bpPostFx(g);g.items.forEach(")
    sub(" ${e.inv?`<div class=\"errmsg\">${e.inv}</div>`:''}\n </div>", " ${e.inv?`<div class=\"errmsg\">${e.inv}</div>`:''}\n  ${geBillMore(g,e)}\n </div>")
    sub("<div class=\"s\">${x.pn} · Rack ${binOf(x.id)} · now ${DB.stock[x.id]} pcs</div></div>",
        "<div class=\"s\">${x.pn} · Rack ${binOf(x.id)} · now ${DB.stock[x.id]} pcs</div>${geItemNote(it,x,g)}</div>")
    sub("<div class=\"card\"><div class=\"kv\"><span>Items total</span><span>${inr(tot)}</span></div>${bill?`<div class=\"kv\"><span>Supplier bill</span><span>${inr(bill)}</span></div><div class=\"kv\"><span>Difference</span><span style=\"color:${Math.abs(bill-tot)<1?'var(--g)':'var(--r)'}\">${Math.abs(bill-tot)<1?'Matches bill':(tot>bill?'+':'−')+inr(Math.abs(bill-tot))}</span></div>`:'<div class=\"cap\">Enter the bill amount to check it against the items.</div>'}</div>",
        "${geTotCard(g,tot,bill)}")
    # the bill's extras (rate before discount, discount, MRP, HSN, GST) stay with each line, new parts and parts waiting for photos too
    sub("if(ex){g.items.push({pid:ex.id,exp:null,q:+n.q,rate:n.rate});return;}", "if(ex){g.items.push({pid:ex.id,exp:null,q:+n.q,rate:n.rate,...bpEx(n)});return;}")
    sub("if(invNwReady(n)){const p=invMkProduct({...n,grn:g.id},0);g.items.push({pid:p.id,exp:null,q:+n.q,rate:n.rate});return;}",
        "if(invNwReady(n)){const p=invMkProduct({...n,grn:g.id},0);g.items.push({pid:p.id,exp:null,q:+n.q,rate:n.rate,...bpEx(n)});return;}")
    sub("grn:g.id,inv:g.inv,sup:g.supplier,at:today()+' · '+nowT(),by:S.user.sid,hand:n.hand||0});",
        "grn:g.id,inv:g.inv,sup:g.supplier,at:today()+' · '+nowT(),by:S.user.sid,hand:n.hand||0,...bpEx(n)});")
    sub("(g.wait=g.wait||[]).push({wid:id,pn:n.pn,name:n.name||n.pn,q:+n.q,rate:n.rate});", "(g.wait=g.wait||[]).push({wid:id,pn:n.pn,name:n.name||n.pn,q:+n.q,rate:n.rate,...bpEx(n)});")
    sub("g.items.push({pid:p.id,exp:null,q,rate:w.rate});}", "const it={pid:p.id,exp:null,q,rate:w.rate,...bpEx(w)};g.items.push(it);if(g.status==='posted')bpApplyItem(it,g);}")
    # a new part takes the bill's HSN and GST
    sub("unit:'pcs',gst:'18',hsn:'8714',src:n.vb&&!n.hand",
        "unit:'pcs',gst:n.gst!=null&&n.gst!==''&&BP_GST.includes(+n.gst)?String(+n.gst):'18',hsn:/^\\d{4,8}$/.test(n.hsn||'')?String(n.hsn):'8714',src:n.vb&&!n.hand")
    sub("const HSN=x=>x&&x.cat==='Lubricants'?'2710':", "const HSN=x=>x&&/^\\d{4,8}$/.test(x.hsn||'')?String(x.hsn):x&&x.cat==='Lubricants'?'2710':")
    # the catalogue shows the MRP from the last supplier bill when it changed
    sub("mrp:d.mrp&&d.mrp[r[5]]||0", "mrp:catMrpFix(r[5],d.mrp&&d.mrp[r[5]]||0)")
    return a, n
