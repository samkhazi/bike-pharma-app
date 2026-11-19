<?php header('Cache-Control: no-cache'); header('X-Frame-Options: SAMEORIGIN'); ?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Labour Prices · Bike Surgeon</title>
<style>
:root{--bg:#ffffff;--ink:#111111;--mut:#6b6b6b;--line:#e4e4e4;--soft:#f6f6f4;--y:#ffd400;--ys:#fff6c2;--ok:#17803d;--bad:#b42318}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
button,input,select{font:inherit;color:inherit}
.wrap{max-width:720px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-right,0px)) 120px max(16px,env(safe-area-inset-left,0px))}
header{position:sticky;top:0;z-index:5;background:var(--ink);color:#fff}
.hd{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:10px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px))}
.hd b{font-size:17px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd small{display:block;font-weight:400;font-size:12px;color:#cfcfcf}
.back{background:none;border:0;color:#fff;font-size:26px;line-height:1;padding:4px 8px 6px 0;cursor:pointer}
.btn{border:2px solid var(--ink);background:#fff;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;min-height:44px}
.btn.y{background:var(--y)}
.btn.sm{padding:6px 10px;min-height:36px;font-size:14px}
.btn.k{background:var(--ink);color:#fff}
.btn:disabled{opacity:.45}
.hd .btn{border-color:var(--y);min-height:38px;padding:6px 12px}
.note{margin:12px 0;padding:10px 12px;border-radius:10px;background:var(--ys);font-size:14px}
.note.bad{background:#fde8e6;color:var(--bad)}
h2{font-size:15px;margin:18px 0 8px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(min-width:560px){.grid{grid-template-columns:repeat(3,1fr)}}
.tile{border:2px solid var(--ink);border-radius:12px;background:#fff;padding:12px;text-align:left;cursor:pointer;min-height:72px}
.tile b{display:block;font-size:17px}
.tile span{font-size:13px;color:var(--mut)}
.tile.done{background:var(--ys)}
.bar{height:5px;background:var(--line);border-radius:3px;margin-top:8px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--y);border-right:1px solid var(--ink)}
.search{width:100%;border:2px solid var(--ink);border-radius:10px;padding:10px 12px;margin:12px 0 4px;background:#fff}
.vrow{display:flex;align-items:center;gap:10px;width:100%;border:0;border-bottom:1px solid var(--line);background:#fff;padding:13px 2px;text-align:left;cursor:pointer}
.vrow b{flex:1;min-width:0;font-weight:600}
.cc{font-size:13px;color:var(--mut);white-space:nowrap}
.tag{font-size:12px;font-weight:700;border-radius:20px;padding:3px 9px;background:var(--y);white-space:nowrap}
.tag.n{background:var(--soft);color:var(--mut);font-weight:500}
.chips{display:flex;gap:8px;overflow-x:auto;padding:10px 0 4px;margin:0 -2px}
.chip{border:1.5px solid var(--ink);border-radius:20px;background:#fff;padding:6px 12px;font-size:13px;font-weight:600;white-space:nowrap;cursor:pointer}
.chip.on{background:var(--ink);color:#fff}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.cat{position:sticky;top:58px;background:var(--soft);margin:14px -4px 0;padding:7px 8px;font-size:13px;font-weight:700;border-left:4px solid var(--y);z-index:2}
.job{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}
.job label{flex:1;min-width:0;font-size:13px;line-height:1.3;overflow-wrap:anywhere}
.job label small{display:block;color:var(--mut);font-size:11.5px;margin-top:2px}
.pr{display:flex;align-items:center;border:2px solid var(--ink);border-radius:10px;background:#fff;overflow:hidden;flex:none}
.pr span{padding:0 0 0 9px;color:var(--mut)}
.pr input{width:84px;border:0;outline:0;padding:10px 9px 10px 4px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;background:transparent}
.pr.ch{background:var(--ys)}
.pr:focus-within{box-shadow:0 0 0 3px var(--y)}
.foot{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:2px solid var(--ink);z-index:6}
.foot>div{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:8px;padding:10px max(16px,env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.st{flex:1;min-width:0;font-size:13px;color:var(--mut)}
.st.ok{color:var(--ok);font-weight:600}.st.bad{color:var(--bad);font-weight:600}
.panel{border:2px solid var(--ink);border-radius:12px;padding:12px;margin:10px 0;background:#fff}
.panel h3{margin:0 0 8px;font-size:16px}
.panel p{margin:0 0 10px;font-size:14px;color:var(--mut)}
.panel select,.panel input[type=text],.panel input[type=number]{width:100%;border:2px solid var(--ink);border-radius:10px;padding:10px;background:#fff;margin-bottom:8px}
.ck{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px}
.ck input{width:20px;height:20px;accent-color:#111}
.ckl{max-height:260px;overflow:auto;margin-bottom:10px}
.row{display:flex;gap:8px;flex-wrap:wrap}
.exp .btn{width:100%;text-align:left;margin-bottom:8px}
.exp .btn small{display:block;font-weight:400;font-size:13px;color:var(--mut)}
.hide{display:none!important}

.who{background:none;border:0;color:#cfcfcf;font-size:12px;padding:4px 0;max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.panel input[type=password]{width:100%;border:2px solid var(--ink);border-radius:10px;padding:10px;background:#fff;margin-bottom:8px}
.panel p:empty{display:none}
</style></head><body>
<header><div class="hd"><button class="back hide" id="back" aria-label="Back">‹</button><b id="ttl">Labour Prices<small>Bike Surgeon</small></b><button class="who hide" id="who"></button><button class="btn y hide" id="expBtn">Export</button></div></header>
<div class="wrap"><div id="msg"></div><div id="view"></div></div>
<div class="foot hide" id="foot"><div><span class="st" id="st"></span><button class="btn sm" id="saveBtn">Save</button><button class="btn sm y" id="nextBtn">Next ›</button></div></div>
<script>

const BK=[110,125,150,200,300,650];
const bucket=cc=>!cc?110:cc<=110?110:cc<=125?125:cc<=160?150:cc<=250?200:cc<=400?300:650;
let VEH=[],JOBS=[],CATS=[],ME=null,PINSET=false;
let saved={};
let S={v:'home',brand:null,vid:null,q:'',cat:'ALL',panel:null};
let cur=null,dirty=false,timer=null,lastLoad=0;
async function api(a,body){
  const r=await fetch('api.php?a='+a,body?{method:'POST',headers:{'Content-Type':'application/json','X-VL':'1'},body:JSON.stringify(body),credentials:'same-origin'}:{credentials:'same-origin',cache:'no-store'});
  let j=null;try{j=await r.json()}catch(e){}
  if(r.status===401){showLogin();throw {code:401,message:'Login needed'}}
  if(!r.ok||!j||!j.ok)throw {code:r.status,message:(j&&j.error)||'Server error'};
  return j}
function setState(j){ME=j.me;PINSET=j.pinSet;
  VEH=j.V.map(a=>({id:a[0],brand:a[1],model:a[2],cc:a[3],b:bucket(a[3]),by:a[5],at:a[6]}));
  JOBS=j.J.map(a=>({id:a[0],cat:a[1],job:a[2],p:a[3]}));CATS=[...new Set(JOBS.map(j=>j.cat))];
  const m={};for(const k in j.P)m[k]=j.P[k];
  for(const id of pend.keys())if(saved[id])m[id]=saved[id];
  if(S.v==='edit'&&dirty&&saved[S.vid])m[S.vid]=saved[S.vid];
  saved=m;lastLoad=Date.now()}
async function load(){const j=await api('state');setState(j)}
const $=id=>document.getElementById(id);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const vehicles=()=>VEH;
const brands=()=>{const o=[];for(const v of vehicles())if(!o.includes(v.brand))o.push(v.brand);return o};
const byBrand=b=>vehicles().filter(v=>v.brand===b);
const veh=id=>vehicles().find(v=>v.id===+id);
const start=(v,j)=>j.p[BK.indexOf(v.b)];
const price=(v,j)=>{const s=saved[v.id];return s&&s[j.id]!=null?s[j.id]:start(v,j)};
const allPrices=v=>{const o={};for(const j of JOBS)o[j.id]=price(v,j);return o};
function note(t,bad){const m=$('msg');m.textContent='';if(t){m.appendChild(el('div','note'+(bad?' bad':''),t))}}
function status(t,k){const s=$('st');s.textContent=t;s.className='st'+(k?' '+k:'')}

/* ---------- saving ---------- */
function touch(){dirty=true;status('Not saved yet');clearTimeout(timer);timer=setTimeout(flush,1200)}
let chain=Promise.resolve();const pend=new Map();
function put(vids,p){for(const vid of vids){saved[vid]=p;pend.set(vid,(pend.get(vid)||0)+1)}
  const r=chain.then(()=>api('save',{vids,p}));
  const done=()=>{for(const vid of vids){const n=pend.get(vid)-1;if(n>0)pend.set(vid,n);else pend.delete(vid)}};
  chain=r.then(done,done);return r}
async function flush(){
  clearTimeout(timer);
  if(!dirty||!cur||!S.vid)return true;
  const vid=S.vid,p=Object.assign({},cur);dirty=false;
  if(S.v==='edit')status('Saving…');
  try{await put([vid],p);if(S.vid===vid&&S.v==='edit'&&!dirty)status('Saved ✓','ok');return true}
  catch(e){if(S.vid===vid&&S.v==='edit'){dirty=true;status(e.code===401?'Login again to save':'Could not save. Check the internet and tap Save.','bad')}return false}
}

/* ---------- views ---------- */
function go(n){flush();S=Object.assign(S,n,{panel:n.panel||null});render();window.scrollTo(0,0);if(S.v!=='edit'&&S.v!=='add'&&Date.now()-lastLoad>20000)chain.then(load).then(()=>{if(S.v!=='edit'&&S.v!=='add')render()}).catch(()=>{})}
function render(){
  const v=$('view');v.textContent='';
  $('back').classList.toggle('hide',S.v==='home');
  $('foot').classList.toggle('hide',S.v!=='edit');
  const t=$('ttl');t.textContent='';
  if(S.v==='home'){t.append('Labour Prices',el('small',null,'Bike Surgeon'));home(v)}
  else if(S.v==='brand'){t.append(S.brand,el('small',null,'Choose a vehicle'));brand(v)}
  else if(S.v==='edit'){const x=veh(S.vid);t.append(x.model,el('small',null,x.brand+' · '+(x.cc?x.cc+' cc':'Electric')));edit(v,x)}
  else if(S.v==='export'){t.append('Export',el('small',null,'Download the prices'));exportV(v)}
  else if(S.v==='add'){t.append('Add vehicle',el('small',null,'A vehicle that is not in the list'));addV(v)}
}
function home(v){
  const all=vehicles(),done=all.filter(x=>saved[x.id]).length;
  v.appendChild(el('h2',null,'1. Choose a brand'));
  const g=el('div','grid');
  for(const b of brands()){
    const l=byBrand(b),d=l.filter(x=>saved[x.id]).length;
    const t=el('button','tile'+(d===l.length?' done':''));
    t.append(el('b',null,b),el('span',null,d+' of '+l.length+' vehicles done'));
    const bar=el('div','bar'),i=el('i');i.style.width=(100*d/l.length)+'%';if(!d)i.style.display='none';bar.appendChild(i);t.appendChild(bar);
    t.onclick=()=>go({v:'brand',brand:b,q:''});g.appendChild(t);
  }
  v.appendChild(g);
  const p=el('div','tools');
  const a=el('button','btn','+ Add vehicle');a.onclick=()=>go({v:'add'});p.appendChild(a);
  if(ME&&ME.admin){const k=el('button','btn',PINSET?'Change or remove PIN':'Lock with a PIN');k.onclick=()=>{S.panel=S.panel==='pin'?null:'pin';render()};p.appendChild(k)}
  v.appendChild(p);
  if(S.panel==='pin')v.appendChild(pPin());
  if(ME&&ME.admin&&!PINSET&&S.panel!=='pin')v.appendChild(el('div','note','This page is open: anyone with the link can enter prices without a login.'));
  v.appendChild(el('div','note',done+' of '+all.length+' vehicles have your prices. The others keep the old cc-wise price until you change them.'));
}
function brand(v){
  const s=el('input','search');s.type='search';s.placeholder='Search vehicle';s.value=S.q;v.appendChild(s);
  const box=el('div');v.appendChild(box);
  const draw=()=>{box.textContent='';const q=S.q.trim().toLowerCase();
    const l=byBrand(S.brand).filter(x=>!q||x.model.toLowerCase().includes(q));
    if(!l.length)box.appendChild(el('div','note','No vehicle found. Use "Add vehicle" to add it.'));
    for(const x of l){const r=el('button','vrow');r.append(el('b',null,x.model),el('span','cc',x.cc?x.cc+' cc':'Electric'),el('span','tag'+(saved[x.id]?'':' n'),saved[x.id]?'Done':'Old price'));if(saved[x.id]&&x.by)r.title='By '+x.by+' '+x.at;
      r.onclick=()=>open(x.id);box.appendChild(r)}};
  s.oninput=()=>{S.q=s.value;draw()};draw();
  const p=el('div','tools');const a=el('button','btn','+ Add vehicle');a.onclick=()=>go({v:'add'});p.appendChild(a);v.appendChild(p);
}
function open(vid){flush();vid=+vid;const x=veh(vid);cur=allPrices(x);dirty=false;S=Object.assign(S,{v:'edit',vid,brand:x.brand,cat:'ALL',panel:null});render();window.scrollTo(0,0);status(saved[vid]?'Saved ✓':'Old cc-wise prices shown',saved[vid]?'ok':'')}
function edit(v,x){
  const tl=el('div','tools');
  const b1=el('button','btn sm','Copy from…'),b2=el('button','btn sm','Apply to other vehicles'),b3=el('button','btn sm','Reset');
  b1.onclick=()=>{S.panel=S.panel==='from'?null:'from';render()};
  b2.onclick=()=>{S.panel=S.panel==='to'?null:'to';render()};
  b3.onclick=()=>{S.panel=S.panel==='reset'?null:'reset';render()};
  tl.append(b1,b2,b3);v.appendChild(tl);
  if(S.panel==='from')v.appendChild(pFrom(x));
  if(S.panel==='to')v.appendChild(pTo(x));
  if(S.panel==='reset')v.appendChild(pReset(x));
  const ch=el('div','chips');
  for(const c of ['ALL'].concat(CATS)){const k=el('button','chip'+(S.cat===c?' on':''),c==='ALL'?'All jobs':c[0]+c.slice(1).toLowerCase());k.onclick=()=>{S.cat=c;render()};ch.appendChild(k)}
  v.appendChild(ch);
  for(const c of CATS){if(S.cat!=='ALL'&&S.cat!==c)continue;
    v.appendChild(el('div','cat',c));
    for(const j of JOBS){if(j.cat!==c)continue;
      const r=el('div','job'),lb=el('label',null,j.job),st=start(x,j);
      lb.htmlFor='j'+j.id;lb.appendChild(el('small',null,'Old price ₹'+st));
      const pr=el('div','pr'+(cur[j.id]!==st?' ch':''));pr.appendChild(el('span',null,'₹'));
      const i=el('input');i.id='j'+j.id;i.type='text';i.inputMode='decimal';i.autocomplete='off';i.value=cur[j.id];
      i.onfocus=()=>i.select();
      i.oninput=()=>{const n=parseFloat(i.value.replace(/[^0-9.]/g,''));cur[j.id]=isFinite(n)?Math.round(n*100)/100:0;pr.classList.toggle('ch',cur[j.id]!==st);touch()};
      i.onblur=()=>{i.value=cur[j.id]};
      i.onkeydown=e=>{if(e.key==='Enter'){const a=[...document.querySelectorAll('.pr input')],n=a[a.indexOf(i)+1];if(n)n.focus();else i.blur()}};
      pr.appendChild(i);r.append(lb,pr);v.appendChild(r)}
  }
}
function optAll(skip){const s=el('select');s.appendChild(new Option('Choose a vehicle',''));
  for(const b of [S.brand].concat(brands().filter(z=>z!==S.brand))){const g=document.createElement('optgroup');g.label=b;
    for(const y of byBrand(b))if(y.id!==skip)g.appendChild(new Option(y.model+(y.cc?' ('+y.cc+' cc)':'')+(saved[y.id]?' ✓':''),y.id));
    s.appendChild(g)}return s}
function pFrom(x){const p=el('div','panel');p.append(el('h3',null,'Copy prices from another vehicle'),el('p',null,'All 54 prices of that vehicle come here. You can still change them after.'));
  const s=optAll(x.id),b=el('button','btn y','Copy here');
  b.onclick=()=>{const y=s.value?veh(s.value):null;if(!y)return;cur=allPrices(y);S.panel=null;render();touch();flush()};
  p.append(s,b);return p}
function pTo(x){const p=el('div','panel');p.append(el('h3',null,'Apply these prices to other vehicles'),el('p',null,'Tick the '+x.brand+' vehicles that should get the same prices as '+x.model+'.'));
  const l=el('div','ckl'),bs=[];
  for(const y of byBrand(x.brand)){if(y.id===x.id)continue;const r=el('label','ck'),c=el('input');c.type='checkbox';c.value=y.id;c.dataset.cc=y.cc||0;bs.push(c);
    r.append(c,el('span',null,y.model+(y.cc?' · '+y.cc+' cc':'')+(saved[y.id]?' · Done':'')));l.appendChild(r)}
  const row=el('div','row'),a=el('button','btn sm','Tick same cc ('+(x.cc||0)+')'),n=el('button','btn sm','Tick all'),g=el('button','btn y','Apply');
  a.onclick=()=>bs.forEach(c=>c.checked=+c.dataset.cc===(x.cc||0));n.onclick=()=>{const on=bs.some(c=>!c.checked);bs.forEach(c=>c.checked=on)};
  g.onclick=async()=>{const ids=bs.filter(c=>c.checked).map(c=>+c.value);if(!ids.length)return;g.disabled=true;await flush();status('Applying to '+ids.length+' vehicles…');
    try{await put(ids,Object.assign({},cur));S.panel=null;render();status('Applied to '+ids.length+' vehicles ✓','ok')}
    catch(e){g.disabled=false;status('Could not apply. Try again.','bad')}};
  row.append(a,n);p.append(row,l,g);return p}
function pReset(x){const p=el('div','panel');p.append(el('h3',null,'Reset '+x.model+'?'),el('p',null,'Your prices for this vehicle are removed and the old cc-wise prices come back.'));
  const row=el('div','row'),y=el('button','btn k','Yes, reset'),n=el('button','btn','No');
  n.onclick=()=>{S.panel=null;render()};
  y.onclick=async()=>{clearTimeout(timer);dirty=false;y.disabled=true;try{await chain;await api('reset',{vid:x.id});delete saved[x.id];cur=allPrices(x);S.panel=null;render();status('Old cc-wise prices shown')}catch(e){y.disabled=false;status('Could not reset. Try again.','bad')}};
  row.append(y,n);p.appendChild(row);return p}
function addV(v){const p=el('div','panel');p.appendChild(el('h3',null,'New vehicle'));
  const b=el('select');for(const z of brands())b.appendChild(new Option(z,z));b.appendChild(new Option('Other brand…','__'));if(S.brand)b.value=S.brand;
  const nb=el('input','hide');nb.type='text';nb.placeholder='Brand name';
  const m=el('input');m.type='text';m.placeholder='Vehicle name (model)';
  const c=el('input');c.type='number';c.inputMode='numeric';c.placeholder='Engine cc (0 for electric)';
  const er=el('p'),g=el('button','btn y','Add and enter prices');
  b.onchange=()=>nb.classList.toggle('hide',b.value!=='__');
  g.onclick=async()=>{const br=(b.value==='__'?nb.value:b.value).trim(),mo=m.value.trim(),cc=parseInt(c.value,10)||0;
    if(!br||!mo){er.textContent='Fill the brand and the vehicle name.';return}
    if(vehicles().some(y=>y.brand.toLowerCase()===br.toLowerCase()&&y.model.toLowerCase()===mo.toLowerCase())){er.textContent='This vehicle is already in the list.';return}
    g.disabled=true;
    try{const r=await api('addveh',{brand:br,model:mo,cc});await load();open(r.id)}
    catch(e){g.disabled=false;er.textContent=e.message||'Could not add the vehicle. Try again.'}};
  p.append(b,nb,m,c,er,g);v.appendChild(p)}

/* ---------- export ---------- */
const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
const sq=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"''")+"'";
function csvList(l){const o=['Vehicle ID,Brand,Vehicle,CC,Category,Labour ID,Labour job,Price,Changed,Changed by,Changed on'];
  for(const v of l)for(const j of JOBS)o.push([v.id,q(v.brand),q(v.model),v.cc,q(j.cat),j.id,q(j.job),price(v,j),saved[v.id]?'Yes':'No',q(saved[v.id]?v.by||'':''),q(saved[v.id]?v.at||'':'')].join(','));
  return '﻿'+o.join('\r\n')}
function csvBrand(b){const l=byBrand(b),o=[['Category','Labour ID','Labour job'].concat(l.map(v=>q(v.model+(v.cc?' ('+v.cc+' cc)':'')))).join(',')];
  for(const j of JOBS)o.push([q(j.cat),j.id,q(j.job)].concat(l.map(v=>price(v,j))).join(','));
  return '﻿'+o.join('\r\n')}
function save(filename,data,out){const u=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);out.textContent='Downloaded: '+filename}
function exportV(v){const p=el('div','exp'),out=el('div','note','Vehicles you did not change go out with the old cc-wise price.');
  const mk=(t,s,f)=>{const b=el('button','btn',t);b.appendChild(el('small',null,s));b.onclick=f;p.appendChild(b)};
  const day=new Date().toISOString().slice(0,10),slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  v.appendChild(el('h2',null,'All brands'));
  mk('Excel list, all vehicles','One row per vehicle and job (opens in Excel)',()=>save('labour-prices-all-'+day+'.csv',csvList(vehicles()),out));
  mk('Excel list, only changed vehicles','Only the vehicles marked Done',()=>{const l=vehicles().filter(x=>saved[x.id]);if(!l.length){out.textContent='No vehicle is changed yet.';return}save('labour-prices-changed-'+day+'.csv',csvList(l),out)});
  v.appendChild(p);v.appendChild(out);
  v.appendChild(el('h2',null,'One brand (jobs down, vehicles across)'));
  const g=el('div','grid');for(const b of brands()){const t=el('button','tile');t.append(el('b',null,b),el('span',null,byBrand(b).length+' vehicles'));t.onclick=()=>{save('labour-'+slug(b)+'-'+day+'.csv',csvBrand(b),out);out.scrollIntoView({block:'center'})};g.appendChild(t)}
  v.appendChild(g)}

/* ---------- wiring ---------- */
$('back').onclick=()=>{if(S.v==='edit')go({v:'brand'});else if(S.v==='export'||S.v==='add')go({v:S.from||'home'});else go({v:'home'})};
$('expBtn').onclick=()=>{if(S.v!=='export')go({v:'export',from:S.v==='edit'?'brand':S.v==='add'?'home':S.v})};
$('saveBtn').onclick=()=>{if(dirty)flush();else if(!saved[S.vid]){dirty=true;flush()}else status('Saved ✓','ok')};
$('nextBtn').onclick=async()=>{if(!saved[S.vid])dirty=true;await flush();const l=byBrand(S.brand),i=l.findIndex(x=>x.id===S.vid),n=l[i+1];if(n)open(n.id);else go({v:'brand'})};
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
function pPin(){const p=el('div','panel');p.append(el('h3',null,'Lock with a PIN'),el('p',null,'Without a PIN the page is open to anyone with the link. With a PIN, the mechanic types a name and the PIN first.'));
  const i=el('input');i.type='text';i.inputMode='numeric';i.maxLength=8;i.placeholder='New PIN (4 to 8 digits)';i.autocomplete='off';
  const er=el('p'),g=el('button','btn y','Save PIN');
  g.onclick=async()=>{try{await api('setpin',{pin:i.value.trim()});PINSET=true;S.panel=null;render();note('PIN saved. Give the mechanic this page link and the PIN.')}catch(e){er.textContent=e.message}};
  p.append(i,er,g);if(PINSET){const x=el('button','btn','Remove PIN (open page)');x.style.marginLeft='8px';x.onclick=async()=>{try{await api('setpin',{pin:''});PINSET=false;S.panel=null;render()}catch(e){er.textContent=e.message}};p.appendChild(x)}return p}
function showLogin(){clearTimeout(timer);S.v='login';$('foot').classList.add('hide');$('back').classList.add('hide');$('expBtn').classList.add('hide');$('who').classList.add('hide');
  const t=$('ttl');t.textContent='';t.append('Labour Prices',el('small',null,'Bike Surgeon'));note('');
  const v=$('view');v.textContent='';const p=el('div','panel');p.append(el('h3',null,'Login'),el('p',null,'Type your name and the PIN given by the owner.'));
  const n=el('input');n.type='text';n.placeholder='Your name';n.maxLength=40;try{n.value=localStorage.getItem('vl_name')||''}catch(e){}
  const i=el('input');i.type='password';i.inputMode='numeric';i.placeholder='PIN';i.autocomplete='off';
  const er=el('p'),g=el('button','btn y','Login');
  const f=async()=>{g.disabled=true;er.textContent='';try{const r=await fetch('api.php?a=login',{method:'POST',headers:{'Content-Type':'application/json','X-VL':'1'},body:JSON.stringify({name:n.value.trim(),pin:i.value.trim()}),credentials:'same-origin'});const j=await r.json().catch(()=>null);
      if(!r.ok||!j||!j.ok){er.textContent=(j&&j.error)||'Could not login.';g.disabled=false;return}
      try{localStorage.setItem('vl_name',n.value.trim())}catch(e){}boot()}catch(e){er.textContent='No internet. Try again.';g.disabled=false}};
  g.onclick=f;i.onkeydown=e=>{if(e.key==='Enter')f()};
  p.append(n,i,er,g);v.appendChild(p)}
async function boot(){note('Loading…');
  try{await load()}catch(e){if(e.code!==401)note(e.message||'Could not load. Check the internet and open the page again.',true);return}
  note('');$('expBtn').classList.remove('hide');const w=$('who');w.classList.remove('hide');w.textContent=ME.name+(ME.pin?' · Logout':'');
  w.onclick=ME.pin?async()=>{await flush();try{await api('logout',{})}catch(e){}showLogin()}:null;
  S=Object.assign(S,{v:'home',panel:null});render()}
$('back').onclick=()=>{if(S.v==='edit')go({v:'brand'});else if(S.v==='export'||S.v==='add')go({v:S.from||'home'});else go({v:'home'})};
$('expBtn').onclick=()=>{if(S.v!=='export')go({v:'export',from:S.v==='edit'?'brand':S.v==='add'?'home':S.v})};
$('saveBtn').onclick=()=>{if(dirty)flush();else if(!saved[S.vid]){dirty=true;flush()}else status('Saved ✓','ok')};
$('nextBtn').onclick=async()=>{if(!saved[S.vid])dirty=true;const ok=await flush();if(!ok)return;const l=byBrand(S.brand),i=l.findIndex(x=>x.id===S.vid),n=l[i+1];if(n)open(n.id);else go({v:'brand'})};
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
window.addEventListener('beforeunload',e=>{if(dirty||pend.size){e.preventDefault();e.returnValue=''}});
boot();
</script></body></html>
