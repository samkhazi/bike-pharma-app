"""Update 8y: aftermarket match more accurate (Sam 2026-10-15 17:50Z "isko aur bhi kaise accurate bana sakte hein bana").
- Close number: the OEM number printed with one more / one less ending than our book's (Hero 32100-ABS-2000 = 32100-ABS-200,
  TVS N9221150BR = N9221150): own group "Number almost the same (check the last digit)".
- Same bike: front/rear, LH/RH, disc/drum and BS IV/BS VI must not contradict; the closest ones first.
- Admin: "Right" makes a match exact for everyone (Confirmed by Admin), "Not right" hides it (DB.amPick, only the Admin writes it).
usage: python3 amfix2.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'AM_NR' in a: raise SystemExit('already done')
def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:80]}')
    a = a.replace(old, new)

sub("let AM=null,AM_ST=0,AM_PK=null,AM_OE=null,AM_TY=null;", "let AM=null,AM_ST=0,AM_PK=null,AM_OE=null,AM_TY=null,AM_NR=null;")
sub("d.p.forEach((p,i)=>{const k=catPk(p[1]);", "AM_NR=new Map();d.p.forEach((p,i)=>{(p[10]||[]).forEach(o=>{const q=catPk(o);(AM_NR.get(q)||AM_NR.set(q,[]).get(q)).push(i);});const k=catPk(p[1]);")
sub("ty:p[8],fm:p[9].map(([b,m])=>[AM.ob[b],m])};};", "ty:p[8],fm:p[9].map(([b,m])=>[AM.ob[b],m]),near:p[10]||[]};};")
# same bike: no contradiction, best first; minus what the Admin turned down or already confirmed
sub("""function amBike(r){if(!AM||!r)return [];const ty=amType(r.desc)||amType(r.asm);if(!ty)return [];const ms=new Set(m2FitL(r).map(m=>m.replace(/ \\(.*$/,'')).concat(r.vms||[]));
 const ex=new Set(amByOem(r.pk).map(p=>p.i)),out=[];AM.p.forEach((p,i)=>{if(p[8]!==ty||ex.has(i))return;if(p[9].some(([b,m])=>AM.ob[b]===r.vb&&ms.has(m)))out.push(amP(i));});return out;}""",
"""const AM_TG=[['front',/\\b(FRONT|FR|FRT)\\b/],['rear',/\\b(REAR|RR)\\b/],['lh',/\\b(LH|LEFT)\\b/],['rh',/\\b(RH|RIGHT)\\b/],['disc',/\\bDISC\\b/],['drum',/\\bDRUM\\b/],['bs6',/\\bBS ?-?(VI|6)\\b/],['bs4',/\\bBS ?-?(IV|4)\\b/]];
function amTags(s){const u=String(s||'').toUpperCase().replace(/F ?& ?R\\b|FRONT ?& ?REAR/g,' FRONT REAR '),t=new Set();AM_TG.forEach(([k,x])=>{if(x.test(u))t.add(k);});return t;}
/* two tag sets contradict: one says front only, the other rear only (same for LH/RH, disc/drum, BS VI/BS IV) */
const amClash=(a,b)=>[['front','rear'],['lh','rh'],['disc','drum'],['bs6','bs4']].some(([x,y])=>(a.has(x)&&!a.has(y)&&b.has(y)&&!b.has(x))||(a.has(y)&&!a.has(x)&&b.has(x)&&!b.has(y)));
function amBike(r){if(!AM||!r)return [];const ty=amType(r.desc)||amType(r.asm);if(!ty)return [];const ms=new Set(m2FitL(r).map(m=>m.replace(/ \\(.*$/,'')).concat(r.vms||[]));
 const ot=amTags(r.desc+' '+(r.asm||'')),nn=r.kind==='d'&&r.pk?catPkNorms(r.vb,r.pk):null;if(nn&&!nn.none&&nn.n.size===1){const z=[...nn.n][0];if(/6|VI/.test(z))ot.add('bs6');else if(/4|IV/.test(z))ot.add('bs4');}
 const ex=new Set(amByOem(r.pk).concat(amNear(r.pk)).map(p=>p.i)),out=[];
 AM.p.forEach((p,i)=>{if(p[8]!==ty||ex.has(i))return;if(!p[9].some(([b,m])=>AM.ob[b]===r.vb&&ms.has(m)))return;const t=amTags(p[2]+' '+p[3]+' '+p[5]);if(amClash(ot,t))return;
  let sc=0;t.forEach(x=>{if(ot.has(x))sc++;});out.push(Object.assign(amP(i),{sc}));});return out.sort((x,y)=>y.sc-x.sc);}
const amNear=pk=>AM_NR&&pk?(AM_NR.get(pk)||[]).map(amP):[];
/* the Admin's word on a match: DB.amPick[original pk] = {ok:[brand|pk], no:[...]} */
const amKey=p=>p.b+'|'+catPk(p.pn);
const amPickOf=opk=>((DB.amPick||{})[opk])||{ok:[],no:[]};
function amAct(opk,key,v){if(!S.user||S.user.role!=='admin')return;DB.amPick=DB.amPick||{};const o=DB.amPick[opk]||(DB.amPick[opk]={ok:[],no:[]});
 o.ok=o.ok.filter(k=>k!==key);o.no=o.no.filter(k=>k!==key);if(v==='ok')o.ok.push(key);else if(v==='no')o.no.push(key);if(!o.ok.length&&!o.no.length)delete DB.amPick[opk];save();refresh();toast(v==='ok'?'Saved: this is the right aftermarket part':v==='no'?'Hidden: not the right part':'Undone');}
/* original numbers the Admin confirmed for an aftermarket part */
function amOkOrig(p){const k=amKey(p),out=[];Object.entries(DB.amPick||{}).forEach(([o,v])=>{if((v.ok||[]).includes(k))out.push(o);});return out;}""")
# rows with the Admin's buttons
sub("""function amRow(p,ok){return `<button class="m2-row" onclick="amGo('${m2Q(p.pn)}')">""",
"""function amRowA(p,opk,st){const ad=S.user&&S.user.role==='admin',k=m2Q(amKey(p));return `<div class="stack" style="gap:4px">${amRow(p,st==='ok')}${ad?`<div class="row" style="gap:6px;justify-content:flex-end">${st==='ok'?`<span class="cap">Confirmed by you</span><button class="link" onclick="amAct('${opk}','${k}','')">Undo</button>`:`<button class="btn line sm" onclick="amAct('${opk}','${k}','ok')">${ic('check','s16')} Right</button><button class="btn line sm" onclick="amAct('${opk}','${k}','no')">Not right</button>`}</div>`:''}</div>`;}
function amRow(p,ok){return `<button class="m2-row" onclick="amGo('${m2Q(p.pn)}')">""")
sub("""function amSection(r){const X=amLoad();if(!X)return AM_ST===1?`<div class="cap">Looking up aftermarket parts…</div>`:'';
 const ex=amByOem(r.pk),bk=amBike(r),all=!!S.ui.amAll;if(!ex.length&&!bk.length)return '';
 const a=ex.length?""",
"""function amSection(r){const X=amLoad();if(!X)return AM_ST===1?`<div class="cap">Looking up aftermarket parts…</div>`:'';
 const pc=amPickOf(r.pk),no=new Set(pc.no),okk=new Set(pc.ok),opk=m2Q(r.pk);
 const ex0=amByOem(r.pk).filter(p=>!no.has(amKey(p))),nr0=amNear(r.pk).filter(p=>!no.has(amKey(p))),bk0=amBike(r).filter(p=>!no.has(amKey(p))),seen=new Set(ex0.map(amKey));
 const conf=nr0.concat(bk0).filter(p=>okk.has(amKey(p))&&!seen.has(amKey(p))&&seen.add(amKey(p))),nr=nr0.filter(p=>!seen.has(amKey(p))&&seen.add(amKey(p))),bk=bk0.filter(p=>!seen.has(amKey(p))),all=!!S.ui.amAll;
 if(!ex0.length&&!conf.length&&!nr.length&&!bk.length)return '';const ex=ex0;
 const c=conf.length?`<div class="sec"><h3 class="h2">Aftermarket part confirmed by Admin</h3><span class="cap">${conf.length}</span></div><div class="stack g8">${conf.map(p=>amRowA(p,opk,'ok')).join('')}</div>`:'';
 const n=nr.length?`<div class="sec"><h3 class="h2">Number almost the same (check the last digit)</h3><span class="cap">${nr.length}</span></div><div class="stack g8">${nr.map(p=>amRowA(p,opk,'')).join('')}</div><div class="cap">The aftermarket catalogue prints ${esc(nr[0].oem.join(', '))}: the same number as ${esc(r.part)} with a different ending. Check the last digit before ordering.</div>`:'';
 const a=c+n+(ex.length?""")
sub("""for its part.</div>`:'';
 const b=bk.length?`<div class="sec"><h3 class="h2">Aftermarket for the same bike (check)</h3><span class="cap">${bk.length}</span></div><div class="stack g8">${bk.slice(0,all?bk.length:6).map(p=>amRow(p,0)).join('')}</div>""",
"""for its part.</div>`:'');
 const b=bk.length?`<div class="sec"><h3 class="h2">Aftermarket for the same bike (check)</h3><span class="cap">${bk.length}</span></div><div class="stack g8">${bk.slice(0,all?bk.length:6).map(p=>amRowA(p,opk,'')).join('')}</div>""")
sub("""so check it before fitting.</div>`:'';""", """so check it before fitting.${S.user&&S.user.role==='admin'?' Tap Right on the correct one: it then shows as confirmed for everyone.':''}</div>`:'';""")
# the aftermarket number searched: its original numbers incl. close and confirmed ones
sub("""${p.oem.length?`<div class="micro muted">Original part number${p.oem.length>1?'s':''} (printed in the ${esc(p.b)} catalogue)</div><div class="row wrap" style="gap:6px">${p.oem.map(o=>`<button class="chip" onclick="amGo('${m2Q(o)}')">${esc(o)}</button>`).join('')}</div>`:`<div class="cap muted">The ${esc(p.b)} catalogue prints no original number for it.</div>`}""",
"""${p.oem.length?`<div class="micro muted">Original part number${p.oem.length>1?'s':''} (printed in the ${esc(p.b)} catalogue)</div><div class="row wrap" style="gap:6px">${p.oem.map(o=>`<button class="chip" onclick="amGo('${m2Q(o)}')">${esc(o)}</button>`).join('')}</div>`:`<div class="cap muted">The ${esc(p.b)} catalogue prints no original number for it.</div>`}
   ${p.near.length?`<div class="micro muted">In our books with a different ending (check the last digit)</div><div class="row wrap" style="gap:6px">${p.near.map(o=>`<button class="chip" onclick="amGo('${m2Q(o)}')">${esc(o)}</button>`).join('')}</div>`:''}
   ${amOkOrig(p).length?`<div class="micro muted">Confirmed by Admin for</div><div class="row wrap" style="gap:6px">${amOkOrig(p).map(o=>`<button class="chip" onclick="amGo('${m2Q(o)}')">${esc(o)}</button>`).join('')}</div>`:''}""")
# an original number searched: confirmed + close ones too
sub("""const k=catPk(q),own=amByPn(k),ex=amByOem(k);if(!own.length&&!ex.length)return '';""",
"""const k=catPk(q),own=amByPn(k),pc=amPickOf(k),no=new Set(pc.no),ok=new Set(pc.ok);
 const ex=amByOem(k).filter(p=>!no.has(amKey(p))).concat(AM.p.map((_,i)=>i).filter(i=>ok.has(AM.b[AM.p[i][0]]+'|'+catPk(AM.p[i][1]))).map(amP)).concat(amNear(k).filter(p=>!no.has(amKey(p))&&!ok.has(amKey(p))));
 if(!own.length&&!ex.length)return '';""")
sub("""${ex.map(p=>amRow(p,1)).join('')}</div><div class="cap"><span class="pill g">Exact match</span> The aftermarket catalogue prints this original number for its part.</div>`:'';
 return A+B;}""",
"""${ex.map(p=>{const nr=!p.oem.some(o=>catPk(o)===k)&&!ok.has(amKey(p));return amRow(p,!nr)+(nr?`<div class="cap">Number almost the same: ${esc(p.oem.join(', '))} (check the last digit)</div>`:'');}).join('')}</div><div class="cap"><span class="pill g">Exact match</span> The aftermarket catalogue prints this original number for its part, or the Admin confirmed it.</div>`:'';
 return A+B;}""")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
