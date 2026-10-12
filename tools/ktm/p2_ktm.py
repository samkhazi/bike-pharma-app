"""KTM from Sam's HD PDFs (11 Oct 2026): diagrams read as 'pa:' (ASCII85 JPEG streams inside the PDFs on the server), brand tiles say which
catalogues are in, and Admin uploads each brand's catalogue folder to the server (Catalogue files)."""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
def sub(old, new, n=1):
    global a
    c = a.count(old); assert c == n, (c, old[:100]); a = a.replace(old, new)

# 1. 'pa:' pictures: a JPEG kept inside a catalogue PDF as ASCII85 text (the server decodes it; this decodes it if it did not)
sub("""const catPf=u=>{if(CAT_PFURL[u])return CAT_PFURL[u];const m=/^pf:(.+):(\\d+):(\\d+)$/.exec(u);
 const p=new Promise((ok,no)=>CAT_PFQ.push(async()=>{try{const fs=await catFs();if(!fs)throw{code:'unavailable'};const path=await catPfPath(fs,m[1]);
  for(let t=0;;t++){try{const r=await fs.read(path,{offset:+m[2],length:+m[3]});CAT_PFOK=true;ok(URL.createObjectURL(new Blob([r.bytes],{type:'image/jpeg'})));return;}
   catch(e){if(t<3&&e&&(e.code==='rate_limited'||e.code==='changed')){await new Promise(w=>setTimeout(w,e.retryAfterMs||1200));continue;}throw e;}}}
  catch(e){if(CAT_PFOK!==true&&e&&['not_granted','not_found','unavailable','capability_disabled','capability_removed'].includes(e.code))CAT_PFOK=false;no(e);}}));""",
"""const catPf=u=>{if(CAT_PFURL[u])return CAT_PFURL[u];const m=/^p([fa]):(.+):(\\d+):(\\d+)$/.exec(u);
 const p=new Promise((ok,no)=>CAT_PFQ.push(async()=>{try{if(!m)throw{code:'not_found'};const fs=await catFs();if(!fs)throw{code:'unavailable'};const path=await catPfPath(fs,m[2]);
  for(let t=0;;t++){try{const r=await fs.read(path,{offset:+m[3],length:+m[4],a85:m[1]==='a'});let b=r.bytes;if(m[1]==='a'&&!(b[0]===0xFF&&b[1]===0xD8))b=catA85(b);
    if(!b||b[0]!==0xFF||b[1]!==0xD8)throw{code:'not_found'};CAT_PFOK=true;ok(URL.createObjectURL(new Blob([b],{type:'image/jpeg'})));return;}
   catch(e){if(t<3&&e&&(e.code==='rate_limited'||e.code==='changed')){await new Promise(w=>setTimeout(w,e.retryAfterMs||1200));continue;}throw e;}}}
  catch(e){if(CAT_PFOK!==true&&e&&['not_granted','unavailable','capability_disabled','capability_removed'].includes(e.code))CAT_PFOK=false;no(e);}}));""")
sub("""/* Yamaha (Sam's distributor package, 1 Oct 2026; for Bike Pharma staff)""",
"""/* ASCII85 text (a picture stream inside a catalogue PDF) -> the JPEG's own bytes, unchanged */
const catA85=b=>{let s=new TextDecoder('latin1').decode(b).replace(/\\s+/g,'');if(s.startsWith('<~'))s=s.slice(2);const e=s.indexOf('~>');if(e<0)return null;s=s.slice(0,e);
 let z=0;for(let i=0;i<s.length;i++)if(s.charCodeAt(i)===122)z++;const out=new Uint8Array(Math.ceil((s.length-z)/5)*4+z*4+4);let n=0,acc=0,k=0;
 const put=(v,c)=>{for(let j=0;j<c;j++)out[n++]=(v>>>(24-8*j))&255;};
 for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c===122&&k===0){n+=4;continue;}if(c<33||c>117)return null;acc=acc*85+(c-33);if(++k===5){put(acc>>>0,4);acc=0;k=0;}}
 if(k){for(let j=k;j<5;j++)acc=acc*85+84;put(acc>>>0,k-1);}return out.subarray(0,n);};
/* Yamaha (Sam's distributor package, 1 Oct 2026; for Bike Pharma staff)""")
# a file uploaded after its folder was listed: list the folder again once before saying it is not there
sub("""const catPfPath=(fs,path)=>{const parts=path.split('/'),name=parts.pop(),dir=parts.join('/');""",
    """const catPfPath=(fs,path,again)=>{const parts=path.split('/'),name=parts.pop(),dir=parts.join('/');""")
sub(""" return w.then(es=>{const e=es.find(e=>!e.isDirectory&&e.path.split('/').pop()===name);if(!e)throw{code:'not_found'};return e.path;});};""",
    """ return w.then(es=>{const e=es.find(e=>!e.isDirectory&&e.path.split('/').pop()===name);if(e)return e.path;if(!again){if(CAT_PFDIR[dir]===w)delete CAT_PFDIR[dir];return catPfPath(fs,path,1);}throw{code:'not_found'};});};""")
# a picture that could not be read is tried again on the next screen (it may have been uploaded since)
sub("""(()=>{const IM={};const img=u=>IM[u]||(IM[u]=catPf(u).then(b=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok({b,w:i.naturalWidth,h:i.naturalHeight});i.onerror=no;i.src=b;})));IM.x=1;""",
    """(()=>{const IM={};const img=u=>IM[u]||(IM[u]=catPf(u).then(b=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok({b,w:i.naturalWidth,h:i.naturalHeight});i.onerror=no;i.src=b;})).catch(e=>{delete IM[u];throw e;}));IM.x=1;""")

# 2. counts from the new KTM data
sub('"KTM":{"m":32,"pn":6618},"Husqvarna":{"m":3,"pn":1892}', '"KTM":{"m":32,"pn":6559},"Husqvarna":{"m":3,"pn":1891}')

# 3. brand tiles: the brands whose catalogue is in come first; the others say it is coming
sub("""const brands=Object.keys(BRANDS_V).map(b=>{const c=M2_CNT[b]||{};const m=(BRANDS_V[b]||[]).length;return `<button class="m2-br" onclick="go('findpart',{v:'brand',vb:'${m2Q(b)}'})"><b>${esc(b)}</b><span class="cap">${m} model${m===1?'':'s'}${c.pn?' · '+m2N(c.pn)+' parts':''}</span></button>`;}).join('');""",
    """const isIn=b=>CAT_ALL.some(e=>e.vb===b),BL=Object.keys(BRANDS_V).sort((x,y)=>isIn(y)-isIn(x)),nIn=BL.filter(isIn).length;
 const brands=BL.map(b=>{const c=M2_CNT[b]||{};const m=(BRANDS_V[b]||[]).length;return isIn(b)?`<button class="m2-br" onclick="go('findpart',{v:'brand',vb:'${m2Q(b)}'})"><b>${esc(b)}</b><span class="cap">${m} model${m===1?'':'s'}${c.pn?' · '+m2N(c.pn)+' parts':''}</span></button>`:`<div class="m2-br off"><b>${esc(b)}</b><span class="cap">Catalogue coming soon</span></div>`;}).join('');""")
sub("""<div class="sec"><h3 class="h2">Shop by brand</h3><span class="cap">${Object.keys(BRANDS_V).length} brands</span></div>""",
    """<div class="sec"><h3 class="h2">Shop by brand</h3><span class="cap">${nIn<BL.length?nIn+' of '+BL.length+' brands in':BL.length+' brands'}</span></div>""")
sub("""<p class="cap m2-hint">Mechanics' names work too: brake liner, cone set, T bracket, bend pipe, self gear, sheesha, tanki…</p>${fpVia()}${m2Form(f)}""",
    """<p class="cap m2-hint">Mechanics' names work too: brake liner, cone set, T bracket, bend pipe, self gear, sheesha, tanki…</p>${fpVia()}${cupHome()}${m2Form(f)}""")
# the brand list of the vehicle form: only brands whose catalogue is in
sub("""function m2Form(f){const brands=Object.keys(BRANDS_V);""", """function m2Form(f){const brands=Object.keys(BRANDS_V).filter(b=>CAT_ALL.some(e=>e.vb===b));""")
sub(""".m2-br:hover{border-color:var(--y)}""", """.m2-br:hover{border-color:var(--y)}.m2-br.off{opacity:.6;border-style:dashed}.m2-br.off:hover{border-color:var(--line)}.cup-bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden}.cup-bar i{display:block;height:100%;background:var(--y);border-radius:99px;transition:width .3s}""")

# 4. Admin: Catalogue files (upload each brand's catalogue folder to the server)
CUP = r"""
/* ----- Admin · Catalogue files: each brand's catalogue (cat/<slug>-dg.json) lists the files its diagrams are read from (dir + [name, size]).
   Admin picks the brand's folder on his computer; only those files go to the server, in pieces, once each: a file already there with the
   same size is never sent again, a broken connection carries on where it stopped (Sam: "double double upload nahi hona he"). ----- */
const CUP={st:0,sets:null,run:null,t:0};
function cupLoad(force){if(CUP.st===1||(CUP.st===2&&!force)||typeof SRV==='undefined')return;CUP.st=1;
 const sl=[...new Set(CAT_ALL.map(e=>DG_SLUG[e.vb]).filter(Boolean))];
 Promise.all(sl.map(s=>fetch('cat/'+s+'-dg.json',{credentials:'same-origin'}).then(r=>r.ok?r.json():null,()=>null).then(d=>[s,d]))).then(async L=>{const sets={};
  for(const [s,d] of L){if(!d||!d.dir||!Array.isArray(d.files))continue;const o=sets[d.dir]||(sets[d.dir]={dir:d.dir,brands:[],files:new Map(),spare:new Map(),have:new Map()});
   const vb=Object.keys(DG_SLUG).find(k=>DG_SLUG[k]===s);if(vb&&!o.brands.includes(vb))o.brands.push(vb);d.files.forEach(f=>o.files.set(f[0],f[1]));(d.spare||[]).forEach(f=>o.spare.set(f[0],f[1]));}
  for(const o of Object.values(sets)){o.files.forEach((z,n)=>o.spare.delete(n));try{const r=await fetch('/api/files/list?path='+encodeURIComponent(o.dir),{credentials:'same-origin'});if(r.ok)(await r.json()).entries.forEach(e=>{if(!e.isDirectory)o.have.set(e.path.split('/').pop(),e.size);});}catch(e){}}
  CUP.sets=sets;CUP.st=2;refresh();}).catch(()=>{CUP.st=3;refresh();});}
const cupStat=o=>{let n=0,b=0,tb=0;o.files.forEach((z,f)=>{tb+=z;if(o.have.get(f)===z){n++;b+=z;}});return {n,all:o.files.size,b,tb};};
const cupMB=b=>b>=1e9?(b/1e9).toFixed(2)+' GB':Math.max(1,Math.round(b/1e6))+' MB';
const cupLive=()=>CUP.run&&!CUP.run.end?CUP.run:null;
function cupTick(){const n=Date.now();if(n-CUP.t<500)return;CUP.t=n;let s='';try{s=cur().s;}catch(e){}if(s!=='catup'&&s!=='findpart')return;const a=document.activeElement;if(a&&a.matches&&a.matches('input,textarea,select'))return;if(document.querySelector('#vp .scrim'))return;refresh();}
function cupWarn(e){e.preventDefault();e.returnValue='';return '';}
function cupProg(r){const pc=Math.min(100,Math.floor(100*r.sent/(r.total||1))),sec=(Date.now()-r.t0)/1000,sp=r.sent/Math.max(1,sec),left=sp>0?(r.total-r.sent)/sp:0;
 const L=[r.end?(r.stopped?(r.err?'':'Upload stopped.')+' Choose the folder again to carry on from where it stopped.':r.todo.length?`Done: ${r.done} file${r.done===1?'':'s'} uploaded.`:'Nothing to upload.'):`Uploading ${Math.min(r.done+1,r.todo.length)} of ${r.todo.length} · ${esc(r.cur)}`,
  !r.end&&sec>4&&r.sent?`${cupMB(r.sent)} of ${cupMB(r.total)} · about ${left>90?Math.ceil(left/60)+' min':Math.ceil(left)+' s'} left`:'',
  r.skip?`${r.skip} file${r.skip===1?' was':'s were'} already on the server, not sent again.`:'',
  r.dup?`${r.dup} duplicate cop${r.dup===1?'y':'ies'} in the folder skipped.`:'',
  r.spare?`${r.spare} other PDF${r.spare===1?' is':'s are'} not needed: the same diagrams are in the files above.`:'',
  r.other?`${r.other} other file${r.other===1?' is':'s are'} not part of this catalogue, left on your computer.`:'',
  r.missing?`${r.missing} needed file${r.missing===1?' is':'s are'} not in the folder you chose.`:''].filter(Boolean);
 return `<div class="stack g6"><div class="cup-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i style="width:${pc}%"></i></div>${L.map(x=>`<div class="cap">${x}</div>`).join('')}${r.err?`<div class="cap" style="color:var(--r)">${esc(r.err)}</div>`:''}</div>`;}
function cupCard(o){const t=cupStat(o),r=CUP.run&&CUP.run.dir===o.dir?CUP.run:null,live=r&&!r.end,ready=t.n===t.all,id='cup'+o.dir.replace(/\W/g,''),nm=o.brands.join(' + ');
 const pill=live?`<span class="pill b">Uploading · ${Math.min(100,Math.floor(100*r.sent/(r.total||1)))}%</span>`:ready?`<span class="pill g">Ready</span>`:`<span class="pill a">Waiting for files</span>`;
 return `<div class="card stack g10"><div class="row" style="gap:10px"><div class="tile y">${ic('file','s20')}</div><div class="grow" style="min-width:0"><div class="h3">${esc(nm)}</div><div class="cap">${t.n} of ${t.all} files on the server · ${cupMB(t.b)} of ${cupMB(t.tb)}</div></div>${pill}</div>
  ${r?cupProg(r):''}
  ${live?`<button class="btn line" onclick="cupStop()">Stop upload</button>`:ready?`<p class="cap" style="margin:0">Every ${esc(o.brands.join(' and '))} diagram opens from your server now, in its original quality.</p>`:`<label class="btn" for="${id}" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}">${ic('upload','s18')} Choose the ${esc(o.brands[0])} folder</label><input id="${id}" type="file" webkitdirectory directory multiple hidden onchange="cupPick(this,'${m2Q(o.dir)}')">
   <label class="link" for="${id}f" style="text-align:center" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}">or choose the files</label><input id="${id}f" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.zip,.json,.csv" hidden onchange="cupPick(this,'${m2Q(o.dir)}')">
   <p class="cap" style="margin:0">On your computer: the ${esc(o.brands[0])} folder inside All Catalogues. Only the files this catalogue needs are sent. Keep this page open until it says Done.</p>`}</div>`;}
SCREENS.catup=()=>{cupLoad();const s=CUP.sets;
 const body=CUP.st===3?`<div class="card cap">Could not read the catalogue list. <button class="link" onclick="CUP.st=0;refresh()">Try again</button></div>`:!s?`<div class="card cap">Checking the files on your server…</div>`
  :!Object.keys(s).length?`<div class="card cap">No brand catalogue on the website needs files yet.</div>`:Object.values(s).map(cupCard).join('');
 return bar('Catalogue files',{back:S.stack.length>1})+`<div class="scroll"><div class="pad" style="gap:16px"><p class="cap" style="margin:0">Each brand's diagrams open straight from its catalogue files on your server, exactly as they are: no change in quality. Every staff profile with Find Part uses these same files.</p>${body}</div></div>`;};
const cupHome=()=>{if(!S.user||S.user.role!=='admin'||typeof SRV==='undefined')return '';cupLoad();const s=CUP.sets;if(!s||!Object.keys(s).length)return '';const r=cupLive();
 const miss=Object.values(s).filter(o=>{const t=cupStat(o);return t.n<t.all;});
 return `<button class="row card" style="flex-direction:row;text-align:left;gap:12px;align-items:center" onclick="go('catup')"><div class="tile y">${ic('upload','s20')}</div><div class="grow" style="min-width:0"><div class="h3">Catalogue files · Admin</div><div class="cap">${r?`Uploading ${esc(r.cur)} · ${Math.min(100,Math.floor(100*r.sent/(r.total||1)))}%`:miss.length?miss.map(o=>{const t=cupStat(o);return `${esc(o.brands.join(' + '))}: ${t.n} of ${t.all} files on the server`;}).join(' · ')+'. Upload them to see the diagrams.':'All catalogue files are on your server.'}</div></div><span class="chev">${ic('chevR','s18')}</span></button>`;};
function cupPick(inp,dir){const o=CUP.sets&&CUP.sets[dir];const fl=[...(inp.files||[])];inp.value='';if(!o||!fl.length)return;if(cupLive()){toast('An upload is already running');return;}
 const pick=new Map();let dup=0,other=0,spare=0;const sp=new Set();
 fl.forEach(f=>{const z=o.files.get(f.name);if(z===f.size){if(pick.has(f.name))dup++;else pick.set(f.name,f);}else if(o.spare.get(f.name)===f.size){if(sp.has(f.name))dup++;else{sp.add(f.name);spare++;}}else other++;});
 const todo=[...pick.values()].filter(f=>o.have.get(f.name)!==f.size);
 const missing=[...o.files.keys()].filter(n=>!pick.has(n)&&o.have.get(n)!==o.files.get(n)).length;
 const r=CUP.run={dir,todo,done:0,sent:0,total:todo.reduce((t,f)=>t+f.size,0),cur:'',err:'',skip:pick.size-todo.length,dup,other,spare,missing,t0:Date.now(),end:0,stopped:0};
 if(!todo.length){r.end=Date.now();refresh();if(!pick.size)toastWarn('No '+o.brands[0]+' catalogue files in that folder');return;}
 cupRun(r,o);refresh();}
function cupStop(){const r=cupLive();if(r){r.stopped=1;if(r.ac)try{r.ac.abort();}catch(e){}}refresh();}
async function cupRun(r,o){const wait=ms=>new Promise(w=>setTimeout(w,ms));let chunk=4*1024*1024,lock=null;
 try{if(navigator.wakeLock)lock=await navigator.wakeLock.request('screen');}catch(e){}
 addEventListener('beforeunload',cupWarn);
 for(const f of r.todo){if(r.stopped)break;r.cur=f.name;cupTick();const q='/api/catup?path='+encodeURIComponent(o.dir+'/'+f.name)+'&size='+f.size;let have=-1,fails=0;
  while(!r.stopped){let res=null,j={};r.ac=new AbortController();
   try{res=have<0?await fetch(q,{credentials:'same-origin',signal:r.ac.signal}):await fetch(q+'&offset='+have,{method:'POST',body:f.slice(have,Math.min(f.size,have+chunk)),headers:{'Content-Type':'application/octet-stream'},credentials:'same-origin',signal:r.ac.signal});j=await res.json().catch(()=>({}));}catch(e){res=null;}
   if(r.stopped)break;
   if(res&&res.status===413&&chunk>256*1024){chunk=Math.max(256*1024,chunk>>2);continue;}
   if(res&&(res.ok||res.status===409)&&typeof j.have==='number'){const was=Math.max(0,have);if(res.status===409&&j.error){r.err=j.error;cupTick();await wait(3000);}r.sent+=Math.max(0,j.have-was);have=j.have;fails=0;if(res.ok)r.err='';if(j.done||have>=f.size)break;cupTick();continue;}
   if(res&&res.status===400&&typeof j.have==='number'){r.sent-=Math.max(0,have-j.have);have=j.have;}
   else if(res&&[400,401,403,405,507].includes(res.status)){r.err=(j.error||'The server refused the file')+(res.status===401?'. Log in again and choose the folder again.':'');r.stopped=1;break;}
   fails++;r.err='Connection problem, trying again…';cupTick();await wait(Math.min(30000,1500*fails));}
  if(!r.stopped&&have>=f.size){r.done++;o.have.set(f.name,f.size);r.err='';}}
 r.end=Date.now();r.cur='';r.ac=null;try{if(lock)lock.release();}catch(e){}removeEventListener('beforeunload',cupWarn);
 for(const k in CAT_PFDIR)delete CAT_PFDIR[k];
 if(r.done&&!r.stopped)toast(`${o.brands.join(' + ')}: ${r.done} file${r.done===1?'':'s'} uploaded`);refresh();}
"""
sub("""/* ----- compatible: the same part number in another brand's book (cat/xref.json)""", CUP.lstrip('\n') + """/* ----- compatible: the same part number in another brand's book (cat/xref.json)""")
sub("""li('Find Part','Part number + picture from brand catalogues','','pin',"go('findpart')")}""",
    """li('Find Part','Part number + picture from brand catalogues','','pin',"go('findpart')")}${typeof SRV!=='undefined'?li('Catalogue files','Upload brand catalogues to your server','','upload',"go('catup')"):''}""")
sub(""" admin:['findpart',""", """ admin:['findpart','catup',""")
open(P, 'w', encoding='utf-8').write(a)
print('p2_ktm ok')
