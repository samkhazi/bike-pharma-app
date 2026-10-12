"""Sam 2026-10-12 06:20Z "eh ek part ka alternate part number he lkn eh data mere paas nhi he toh ek kaam kar tu mere system me ek agent ko
daalde o mere catalogues ko update karta rahega google search engine se search karke", plan OK'd 06:27Z ("ohkay", "banade").

Update 8h, the app side of the web agent (the server side is lib/altagent.mjs):
- A part number that no catalogue has goes to the agent's list by itself: a Find Part search that finds nothing, a part saved in
  Add product (not Aftermarket) and a Stock in line marked "Not in a catalogue". Partly typed numbers never go.
- Admin > More > Alternate numbers: the agent's switch, numbers a day, this month's use and cost (estimate), the Anthropic key
  (pasted once, kept on the server only), a box to look up any number, and the list: To check, In the queue, Approved, Not found.
  The agent searches Scribd first (Sam 06:52Z), then the whole web. A found number shows what the page says (name, brand, bikes), the pages it read (links), our catalogue parts with the numbers the web
  gave, or with the same name ("KIT PIST.RING KTM125" -> KTM 125 piston ring kit 36JU0138), and "This is it" for each.
  Admin can also type the other number (found on Google by hand) or say "None of these".
- Find Part: a number Admin approved shows its other number's parts with a line saying so. A number that is not found says what the
  agent is doing and has "Search on Google" (opens Google in a new tab; nothing from Google is read or kept by the app).
"""

ALTJS = r"""
/* ---------- Alternate numbers: the web agent (update 8h, lib/altagent.mjs) ---------- */
const ALTC={ap:{},st:{},on:false,t:0,busy:false,asked:new Set(),adm:null,err:null,sig:'',tm:null};
const altStaff=()=>!!(S.user&&['billing','sales','manager','inventory','admin'].includes(S.user.role));
function altLoad(force){if(typeof SRV==='undefined'||!altStaff()||ALTC.busy)return;if(!force&&ALTC.t&&Date.now()-ALTC.t<120e3)return;ALTC.busy=true;
 fetch('/api/alt',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).then(j=>{ALTC.busy=false;ALTC.t=Date.now();
  if(!j||j.error){ALTC.err=(j&&j.error)||'Could not load the list.';return;}
  const sig=JSON.stringify([j.ap,j.st,j.on,j.admin]),ch=sig!==ALTC.sig;ALTC.sig=sig;ALTC.ap=j.ap||{};ALTC.st=j.st||{};ALTC.on=!!j.on;ALTC.adm=j.admin||null;ALTC.err=null;
  if(ch)try{const s=cur().s;if(s==='altno'||(s==='findpart'&&(cur().p||{}).v==='res'))refresh();}catch(e){}})
 .catch(()=>{ALTC.busy=false;ALTC.t=Date.now()-90e3;ALTC.err='Could not reach the server. Check the internet.';try{if(cur().s==='altno')refresh();}catch(e){}});}
const altOf=q=>{const k=catPk(q);return k?ALTC.ap[k]||null:null;};
function altPost(o){return fetch('/api/alt',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)}).then(r=>r.json()).catch(()=>({error:'Could not reach the server. Check the internet and try again.'}));}
function altAsk(pn,from){const k=catPk(pn);if(typeof SRV==='undefined'||!altStaff()||k.length<5||(k.match(/\d/g)||[]).length<4||ALTC.asked.has(k)||ALTC.ap[k])return;ALTC.asked.add(k);
 altPost({act:'ask',pn:String(pn).trim(),from}).then(j=>{if(j&&j.st&&j.st!=='incat')ALTC.st[k]=j.st;if(j&&j.st==='part')try{if(cur().s==='findpart')refresh();}catch(e){}});}
const altG=pn=>'https://www.google.com/search?q='+encodeURIComponent('"'+String(pn).trim()+'"');
const altGl=(pn,t)=>`<a class="link" href="${esc(altG(pn))}" target="_blank" rel="noopener">${t||'Search on Google'}</a>`;
function altNote(pn,from){if(typeof SRV==='undefined'||!altStaff())return '';altLoad();const k=catPk(pn);if(from)setTimeout(()=>altAsk(pn,from),0);
 const st=ALTC.st[k],where=S.user.role==='admin'?'More > Alternate numbers':'the Admin’s Alternate numbers page';
 const t=st==='part'?'This looks like part of a longer number. Type the whole part number.':st==='found'?`The web agent found this number on the internet. Find Part shows it once Admin approves it in ${where}.`:st==='none'||st==='no'?'The web agent could not find this number on the internet.'
  :ALTC.on?`The web agent will look for this number on the internet. Admin approves what it finds in ${where}.`:`Admin can add this number’s other number in ${where}.`;
 return `<div class="row cap alt-note">${ic('globe','s16')}<span class="grow">${t}</span>${altGl(pn)}</div>`;}
function altVia(q,al){return `<div class="row cap fp-via alt-via">${ic('repeat','s16')}<span class="grow" style="overflow-wrap:anywhere"><b class="num">${esc(String(q).trim().toUpperCase())}</b> is another number for <b class="num">${esc(al.alt)}</b>${al.name?' ('+esc(al.name)+')':''}. Found by the web agent, approved by Admin.</span></div>`;}
function altInv(pn){if(typeof SRV==='undefined'||!altStaff()||!String(pn||'').trim())return '';altLoad();const al=altOf(pn);
 if(al)return `<p class="cap alt-note">${ic('repeat','s16')} <span class="grow">Same part as <b class="num">${esc(al.alt)}</b>${al.name?' ('+esc(al.name)+')':''}: found by the web agent, approved by Admin.</span></p>`;
 return `<p class="cap">${ALTC.on?'When this part is saved, the web agent looks its number up on the internet. ':''}${altGl(pn)}</p>`;}
/* a part number no catalogue has goes to the agent when the part is saved (Add product, not Aftermarket) or taken in (Stock in) */
(()=>{if(typeof geSave==='function'){const f=geSave;geSave=function(){const g=S.ui.ge;const ks=((g&&g.nw)||[]).filter(n=>n&&n.hand&&n.pn).map(n=>n.pn);try{return f.apply(this,arguments);}finally{try{ks.forEach(pn=>altAsk(pn,'stockin'));}catch(e){}}};}
 if(typeof saveProduct==='function'){const f=saveProduct;saveProduct=function(){let pn='';try{const a=S.ui.ap;pn=a&&a.type!=='Aftermarket'?String(a.pn||'').trim():'';const o=pn?invLook(pn,true):null;if(!(o&&o.st==='done'&&!o.hits.length&&!o.wide))pn='';}catch(e){pn='';}
  try{return f.apply(this,arguments);}finally{if(pn)altAsk(pn,'product');}};}})();
/* Admin > More > Alternate numbers */
const altDay=t=>{try{return new Date(t).toLocaleDateString('en-IN',{day:'2-digit',month:'short'});}catch(e){return '';}};
const altPill=it=>({found:'<span class="pill a">Check</span>',ok:'<span class="pill g">Approved</span>',wait:'<span class="pill b">In the queue</span>',run:'<span class="pill b">Searching</span>',none:'<span class="pill r">Not found</span>',no:'<span class="pill r">None right</span>',incat:'<span class="pill g">In a catalogue</span>'})[it.st]||'';
function altCatTxt(c){const ms=c.models||[];return `${esc(c.brand)} · ${esc(c.desc||'')}${ms.length?' · '+esc(ms.slice(0,4).join(', '))+(ms.length>4?' +'+(ms.length-4)+' more':''):''}${c.mrp?' · MRP '+inr(c.mrp):''}`;}
function altPick(it,pn,c,why){return `<div class="alt-opt"><div class="grow" style="min-width:0"><b class="num">${esc(pn)}</b>${why?` <span class="pill b">${esc(why)}</span>`:''}<div class="cap">${c?altCatTxt(c):'Not in our catalogues'}</div></div>${c?`<button class="btn sm" onclick="altDo('ok','${m2Q(it.pn)}','${m2Q(pn)}')">This is it</button>`:''}</div>`;}
function altSrc(r){const L=((r.cites&&r.cites.length)?r.cites:(r.pages||[])).slice(0,5);return L.length?`<div class="cap alt-src">Pages it read: ${L.map(x=>`<a class="link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title||x.url.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a>`).join(' · ')}</div>`:'';}
function altManual(it){return `<div class="row alt-man"><div class="inp grow"><input id="altm-${esc(it.k)}" placeholder="Type the other number" autocomplete="off"></div><button class="btn line sm" onclick="altMan('${m2Q(it.pn)}','${esc(it.k)}')">Save</button></div>`;}
function altCard(it){const r=it.res,P=m2Q(it.pn);
 const head=`<div class="row wrap" style="gap:8px"><b class="num alt-pn">${esc(it.pn)}</b>${altPill(it)}<span class="grow"></span><span class="cap">${esc((it.from||[]).join(', '))}${it.at?' · '+altDay(it.at):''}</span></div>`;
 if(it.st==='found'&&r){const opts=[...(r.alts||[]).map(a=>altPick(it,a.cat?a.cat.pn:a.pn,a.cat,a.how||'web')),...(r.maybe||[]).map(m=>altPick(it,m.pn,m,'same name'))];
  return `<div class="card alt-card">${head}<div class="cap">${r.where==='scribd'?'On Scribd':'On the web'}: <b>${esc(r.name||'—')}</b>${r.brand?' · '+esc(r.brand):''}${r.bikes?' · '+esc(r.bikes):''}</div>${r.note?`<div class="cap muted">${esc(r.note)}</div>`:''}
   ${opts.length?`<div class="h3">Which part is it in our catalogues?</div><div class="stack g8">${opts.join('')}</div>`:'<div class="cap">The web gave no number that our catalogues have. Type it below if you know it.</div>'}
   ${altSrc(r)}${altManual(it)}<div class="row wrap" style="gap:8px"><button class="btn line sm" onclick="altDo('no','${P}')">None of these</button>${altGl(it.pn)}</div></div>`;}
 if(it.st==='ok'){const d=it.dec||{};return `<div class="card alt-card">${head}<div class="cap">Same part as <b class="num">${esc(d.alt)}</b>${d.name?' · '+esc(d.name):''}${d.brand?' · '+esc(d.brand):''}</div><div class="cap muted">Approved by ${esc(d.by||'Admin')}${d.at?' on '+altDay(d.at):''}. Find Part shows ${esc(d.alt)} when someone searches ${esc(it.pn)}.</div><div class="row"><button class="btn line sm" onclick="altDo('undo','${P}')">Undo</button></div></div>`;}
 if(it.st==='incat')return `<div class="card alt-card">${head}<div class="cap">Now in our ${esc((it.inCat||[]).join(', '))} catalogue: Find Part shows it.</div><div class="row"><button class="btn line sm" onclick="altDo('del','${P}')">Remove from the list</button></div></div>`;
 const wait=it.st==='wait'||it.st==='run',keyOk=!!(ALTC.adm&&ALTC.adm.cfg.keySet);
 const t=it.st==='run'?'The agent is searching the web now…':it.st==='wait'?(keyOk?'Waiting for its turn.':'Waiting: the agent needs a key (above).'):it.st==='no'?'You marked: none of the web’s numbers is right.'
  :(it.tries<3&&it.next?`Not on the web yet. The agent tries again on ${altDay(it.next)} (${it.tries} of 3 tries).`:'Not found on the web (3 tries).');
 return `<div class="card alt-card">${head}<div class="cap">${t}</div>${r&&r.name?`<div class="cap muted">Last answer: ${esc(r.name)}</div>`:''}${wait?'':altManual(it)}<div class="row wrap" style="gap:8px">${it.st==='run'?'':`<button class="btn line sm" onclick="altDo('retry','${P}')">${wait?'Search it next':'Search again'}</button>`}<button class="btn line sm" onclick="altDo('del','${P}')">Delete</button>${altGl(it.pn)}</div></div>`;}
SCREENS.altno=()=>{const B=bar('Alternate numbers',{back:S.stack.length>1});
 if(!S.user||S.user.role!=='admin')return B+'<div class="scroll"><div class="pad"><div class="card cap">Only the Admin opens this page.</div></div></div>';
 altLoad();const A=ALTC.adm;
 if(!A)return B+`<div class="scroll"><div class="pad"><div class="card cap">${ALTC.err?esc(ALTC.err)+' <button class="link" onclick="altLoad(true)">Try again</button>':'Loading…'}</div></div></div>`;
 const c=A.cfg,u=A.use,L=A.items;
 if(c.on&&c.keySet&&L.some(it=>it.st==='run'||it.st==='wait')){clearTimeout(ALTC.tm);ALTC.tm=setTimeout(()=>{try{if(cur().s==='altno')altLoad(true);}catch(e){}},15000);}
 const keyIn=`<div class="row alt-man"><div class="inp grow"><input id="altkey" type="password" placeholder="Paste the key (sk-ant-…)" autocomplete="off"></div><button class="btn sm" onclick="altKey()">Save key</button></div>`;
 const errH=c.err&&c.pause>Date.now()?`<div class="row cap alt-err">${ic('alert','s16')}<span class="grow">${esc(c.err.msg)}</span></div>`:'';
 const agent=!c.keySet?`<div class="card alt-agent"><div class="row"><div class="h3 grow">Web agent</div><span class="pill r">Off · no key</span></div><p class="cap" style="margin:0">To switch it on, make an API key at <b>console.anthropic.com</b> (API keys, with some credit) and paste it here. It stays on your server only. Until then numbers still collect below: use Search on Google and type the other number yourself.</p>${keyIn}</div>`
  :`<div class="card alt-agent"><div class="row"><div class="h3 grow">Web agent</div><span class="pill ${c.on?'g':'r'}">${c.on?'On':'Off'}</span><button class="btn line sm" onclick="altCfg({on:${c.on?'false':'true'}})">${c.on?'Turn off':'Turn on'}</button></div>
   <div class="row wrap alt-stat"><label class="cap">Numbers a day<select onchange="altCfg({perDay:+this.value})" aria-label="Numbers a day">${[5,10,20,50,100,c.perDay].filter((v,i,a)=>a.indexOf(v)===i).sort((x,y)=>x-y).map(v=>`<option value="${v}"${v===c.perDay?' selected':''}>${v}</option>`).join('')}</select></label>
   <span class="cap">Today ${u.today} of ${c.perDay} · This month ${u.month} number${u.month===1?'':'s'}, ${u.searches} web search${u.searches===1?'':'es'}, about ₹${u.inr} (estimate; the exact bill is on console.anthropic.com)</span></div>
   ${errH}<div class="cap muted">Key ••••${esc(c.keyTail)}${c.keySet==='env'?' (from the server’s .env file)':''} · AI ${esc(c.model)}${c.keySet==='admin'?` · <button class="link" onclick="S.ui.altKey=!S.ui.altKey;refresh()">Change key</button> · <button class="link" onclick="altKey('')">Remove key</button>`:''}</div>${S.ui.altKey?keyIn:''}</div>`;
 const add=`<div class="card alt-agent"><div class="h3">Look up a number</div><div class="row alt-man"><div class="inp grow">${ic('search','s18')}<input id="altpn" placeholder="Part number, e.g. 36JG0016" autocomplete="off" onkeydown="if(event.key==='Enter')altAdd()"></div><button class="btn sm" onclick="altAdd()">Add</button></div></div>`;
 const grp=[['To check','found'],['In the queue','wait run'],['Approved','ok'],['Not found','none no'],['Now in a catalogue','incat']].map(([t,st])=>{const l=L.filter(it=>st.split(' ').includes(it.st));
  return l.length?`<div class="sec"><h3 class="h2">${t}</h3><span class="cap">${l.length}</span></div><div class="stack g8">${l.map(altCard).join('')}</div>`:'';}).join('');
 return B+`<div class="scroll"><div class="pad" style="gap:16px"><p class="cap" style="margin:0">Part numbers that none of our catalogues has collect here by themselves: from Find Part searches, Add product and Stock in. The web agent looks each one up on Scribd first, then on the rest of the internet, and brings the part’s name and its other numbers, with the pages it read. Find Part shows another number only after you approve it here. The catalogue files never change.</p>${agent}${add}${grp||'<div class="card cap">No numbers yet. A part number that Find Part cannot find comes here by itself.</div>'}</div></div>`;};
function altDo(act,pn,alt){altPost({act,pn,alt}).then(j=>{if(j.error){toast(j.error);return;}if(act==='ok')toast(pn+' = '+alt+': approved');else if(act==='del')toast(pn+' removed');altLoad(true);});}
function altMan(pn,k){const el=document.getElementById('altm-'+k);const v=el?el.value.trim():'';if(!v){toast('Type the other number');return;}altDo('ok',pn,v);}
function altAdd(){const el=document.getElementById('altpn');const v=el?el.value.trim():'';if(!v){toast('Type a part number');return;}altPost({act:'add',pn:v}).then(j=>{if(j.error){toast(j.error);return;}toast(v+' added: the agent looks it up next');altLoad(true);});}
function altKey(v){const el=document.getElementById('altkey');const k=v===''?'':(el?el.value.trim():'');if(v!==''&&!k){toast('Paste the key first');return;}toast(k?'Checking the key…':'Removing the key…');
 altPost({act:'key',key:k}).then(j=>{if(j.error){toast(j.error);return;}S.ui.altKey=false;toast(k?'Key saved: the web agent is on':'Key removed');altLoad(true);});}
function altCfg(o){altPost({act:'cfg',...o}).then(j=>{if(j.error){toast(j.error);return;}altLoad(true);});}
"""

ALTCSS = r"""
/* ---- alternate numbers, the web agent (update 8h) ---- */
.alt-note{margin-top:10px;background:var(--blue-soft);border-radius:10px;padding:10px;gap:8px;align-items:flex-start}
.alt-note .link{white-space:nowrap}
.alt-card,.alt-agent{gap:10px}
.alt-pn{font-size:16px;overflow-wrap:anywhere}
.alt-opt{display:flex;gap:10px;align-items:center;border:1.5px solid var(--line);border-radius:12px;padding:10px}
.alt-man{gap:8px;align-items:center}
.alt-man .inp{height:44px;min-width:0}
.alt-man input{border:0;outline:0;background:transparent;font:inherit;width:100%;min-width:0;color:inherit}
.alt-err{background:var(--amber-soft);border-radius:10px;padding:8px 10px;gap:8px;align-items:flex-start}
.alt-src{overflow-wrap:anywhere}
.alt-stat{gap:10px;align-items:center}
.alt-stat label{display:flex;align-items:center;gap:6px}
.alt-stat select{height:34px;border-radius:8px;border:1.5px solid var(--line);background:var(--card);color:inherit;font:inherit;padding:0 6px}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'altno.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    assert '123456' not in ALTJS + ALTCSS and '</script' not in ALTJS
    sub("/* ---------- Waiting for photos ---------- */", ALTJS.strip() + "\n/* ---------- Waiting for photos ---------- */")
    sub("/* ---- inventory (update 8): phone stacks, website two columns ---- */", ALTCSS.strip() + "\n/* ---- inventory (update 8): phone stacks, website two columns ---- */")
    # only the Admin opens the page; it sits under Catalogue files in More
    sub("admin:['supbills','supdue','ainv',", "admin:['altno','supbills','supdue','ainv',")
    sub("typeof SRV!=='undefined'?li('Catalogue files','Upload brand catalogues to your server','','upload',\"go('catup')\"):''",
        "typeof SRV!=='undefined'?li('Catalogue files','Upload brand catalogues to your server','','upload',\"go('catup')\")"
        "+li('Alternate numbers','Web agent: other numbers for parts our catalogues lack','','globe',\"go('altno')\"):''")
    # Find Part: a number Admin approved shows its other number's parts
    sub("const c=catSearch({...A,lim:600});if(!c)return {list:[],none:1};if(c.loading)return {loading:c};",
        "const c=catSearch({...A,lim:600});if(!c)return {list:[],none:1};if(c.loading)return {loading:c};\n"
        " if(!c.hits.length&&!(c.pend||[]).length&&A.q&&fpIsPn(A.q)){const al=altOf(A.q);if(al){let c2=catSearch({...A,q:al.alt,lim:600});"
        "if(c2&&!c2.loading&&!c2.hits.length&&A.vb!=='Any')c2=catSearch({...m2A({q:al.alt}),lim:600});if(c2&&c2.loading)return {loading:c2};"
        "if(c2&&c2.hits.length)return {list:c2.hits,c:c2,label:c2.label,alt:al};}}")
    sub("function m2ResView(p){xrLoad();", "function m2ResView(p){xrLoad();altLoad();")
    sub("return `${fpVia()}${spellH}${m2Head(count,", "return `${fpVia()}${spellH}${R.alt?altVia(p.q,R.alt):''}${m2Head(count,")
    # ... and a number that is not found goes to the agent, with Search on Google
    sub("the part number.'}</div>${c&&(c.pend||[]).length?",
        "the part number.'}</div>${!p.cat&&fpIsPn(p.q)&&!(c&&(c.pend||[]).length)?altNote(p.q,'findpart'):''}${c&&(c.pend||[]).length?")
    # Add product: a number no catalogue has (its approved other number, or Search on Google)
    sub("Fill in name, brand and MRP by hand below.</p>", "Fill in name, brand and MRP by hand below.</p>${altInv(a.pn)}")
    return a, n
