// Bike Pharma original, for reference: public/app.html (GitHub samkhazi/bike-pharma-app, branch website, commit 49c9099)
// Line 4831 (state codes), 4919-4947 (RC search: rcGo, rcOpen, RC card rcV, vinFind), 4967-4970 (Find Part number box + the RC card on the bike page).
// It runs inside Bike Pharma's app and uses its own parts: S.ui, refresh(), go(), esc(), ic(), m2Q(), m2Head(), vinClean/vinSite/vinAsk/vinOpen/vinBrands/vinKey,
// vqParse(), BRANDS_V, CAT_ALL, DB.vinMap, fitBike(), catLoad(), fpRecAdd(). The demo public/index.html in this zip is a small page that works alone.

const RC_ST=new Set('AN AP AR AS BR CH CG DD DL GA GJ HR HP JK JH KA KL LA LD MP MH MN ML MZ NL OD OR PY PB RJ SK TN TS TR UP UK UA WB'.split(' '));
// ...
const rcClean=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const rcIsReg=s=>/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(s)||/^\d{2}BH\d{4}[A-Z]{1,2}$/.test(s);
const RC_SEEN={};   /* reg no -> RC details, for the banner on the bike's page */
async function rcGo(reg){const s=S.ui.vin;s.rc={busy:1,reg};s.c='';s.look=null;s.pick=false;s.vb='';refresh();let r;
 try{const x=await fetch('/api/rclook?r='+encodeURIComponent(reg),{credentials:'same-origin'});r=await x.json();if(!x.ok&&!r.error)r={error:'Search failed ('+x.status+')'};}catch(e){r={error:'No internet connection'};}
 if(S.ui.vin!==s||!s.rc||s.rc.reg!==reg)return;s.rc={...r,reg};if(!r.found)return refresh();RC_SEEN[reg]=s.rc;fpRecAdd({t:'reg',q:reg});
 /* the full chassis number: the chassis way, where the maker's site names the model */
 const ch=vinClean(r.chassis);if(/^[A-HJ-NPR-Z0-9]{17}$/.test(ch)&&(vinSite(ch)||vinBrands(ch).length)){s.c=ch;if(vinSite(ch))return vinAsk(ch);const m=(DB.vinMap||{})[vinKey(ch)];if(m&&BRANDS_V[m.vb])return vinOpen(ch,m.vb,m.vm);}
 /* else the maker and model the RC names ("HERO MOTOCORP LTD" "SPLENDOR PLUS") */
 const v=vqParse((r.maker||'')+' '+(r.model||''),{}).set;if(v.vb&&BRANDS_V[v.vb]&&v.vm&&v.vm!=='Any')return rcOpen(reg,v.vb,v.vm);
 s.rcb=v.vb&&BRANDS_V[v.vb]?v.vb:'';s.mf='';refresh();}
function rcOpen(reg,vb,vm){if(fitBike(vb,vm,'',reg))return;const r=RC_SEEN[reg]||{};S.ui.fpBike={reg,vb,vm,vin:'',yr:r.year||''};catLoad(vb);go('findpart',{v:'year',vb,vm,yr:'Any',rcn:reg,vy:+r.year||0,vsrc:'RC: '+[r.maker,r.model].filter(Boolean).join(' ')});}
const RC_ROWS=[['owner','Owner'],['maker','Maker'],['model','Model'],['mfg','Made'],['regDate','Registered'],['fuel','Fuel'],['colour','Colour'],['cc','Engine cc'],['chassis','Chassis no.'],['engine','Engine no.'],['insurer','Insurance'],['insUpto','Insurance till'],['pucUpto','PUC till'],['status','RC status']];
const rcTable=(r,dark)=>`<div class="stack" style="gap:2px">${RC_ROWS.filter(([k])=>r[k]).map(([k,l])=>`<div class="row" style="gap:8px;align-items:baseline"><span class="cap" style="min-width:96px${dark?';color:var(--ink3)':''}">${l}</span><span class="grow" style="overflow-wrap:anywhere;font-weight:600${dark?';color:#fff':''}">${esc(r[k])}</span></div>`).join('')}</div>`;
function rcV(s){const r=s.rc;if(!r)return '';
 if(r.busy)return `<div class="card" style="border:2px solid var(--y)"><span class="pill y">${esc(r.reg)}</span><div class="h3">Getting the RC details…</div></div>`;
 if(!r.found)return `<div class="card" style="border:2px solid var(--y)"><span class="pill a">${esc(r.reg)}</span><div class="cap" style="font-weight:600">${r.off?'Registration number search is not switched on yet. Admin: in the server .env add RC_API=vrgarage, VRGARAGE_EMAIL and VRGARAGE_PASSWORD, then run update.sh.':r.error?esc(r.error)+'.':'The RC service has no record of this number. Check it, or type the chassis number.'}</div></div>`;
 const vb=s.rcb,mf=String(s.mf||'').trim().toLowerCase(),ms=vb?(BRANDS_V[vb]||[]).filter(m=>!mf||m.toLowerCase().includes(mf)):[];
 const all=Object.keys(BRANDS_V).filter(b=>CAT_ALL.some(e=>e.vb===b));
 const pick=s.c?'':`<div class="h3">Which bike is this?</div><div class="cap">The RC says ${esc([r.maker,r.model].filter(Boolean).join(' ')||'no model')}: pick it in our catalogue.</div>
  <div class="row wrap" style="gap:6px">${all.map(b=>`<button class="chip ${vb===b?'on':''}" onclick="S.ui.vin.rcb='${m2Q(b)}';S.ui.vin.mf='';refresh()">${esc(b)}</button>`).join('')}</div>
  ${vb?`<div class="inp" style="height:44px">${ic('search','s16')}<input id="vin-mf" placeholder="Type the model" aria-label="Filter models" autocomplete="off" value="${esc(s.mf||'')}" oninput="S.ui.vin.mf=this.value;refresh()"></div>
  <div class="row wrap" style="gap:6px">${ms.slice(0,60).map(m=>`<button class="chip" onclick="rcOpen('${m2Q(r.reg)}','${m2Q(vb)}','${m2Q(m)}')">${esc(m)}</button>`).join('')||'<span class="cap">No model matches.</span>'}</div>`:''}`;
 return `<div class="card" style="border:2px solid var(--y)"><div class="row" style="gap:8px"><span class="pill y">${esc(r.reg)}</span><span class="cap">RC details</span></div>${rcTable(r)}${pick}</div>`;}
function vinFind(){const s=S.ui.vin||(S.ui.vin={q:''});const i=document.getElementById('vin-q');if(i)s.q=i.value;const c=vinClean(s.q);s.err='';s.pick=false;s.vb='';s.rc=null;s.rcb='';
 const rg=rcClean(s.q);if(rg.length<17&&rcIsReg(rg)){s.q=rg;return rcGo(rg);}
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(c)){s.err=c.length===17?'This is not a chassis number: check the letters (no I, O or Q in a chassis number).':'Type the 17-letter chassis number, or the bike number like KA17HC3942. You typed '+c.length+' letters.';return refresh();}
 s.q=c;s.c=c;s.look=null;if(vinSite(c))return vinAsk(c);const m=(DB.vinMap||{})[vinKey(c)];if(m&&BRANDS_V[m.vb])return vinOpen(c,m.vb,m.vm);
 const bs=vinBrands(c);s.pick=true;s.vb=bs.length===1?bs[0]:'';s.mf='';refresh();}
// ... (vinV: the Find Part number screen, last lines)
 return `${m2Head('Check parts with bike or chassis number','Type the bike number (KA17HC3942) or the 17-letter chassis number. The bike opens by itself.')}
 <div class="fp-sb">${ic('scan','s20')}<input id="vin-q" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" maxlength="24" placeholder="Bike or chassis number" aria-label="Bike or chassis number" value="${esc(s.q||'')}" oninput="S.ui.vin.q=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();vinFind()}" style="font-family:var(--num,inherit);letter-spacing:.5px"><button class="fp-go" onclick="vinFind()" aria-label="Find bike">${ic('search','s20')}</button></div>
 ${s.err?`<div class="errmsg">${esc(s.err)}</div>`:'<p class="cap m2-hint">Bike number from the number plate, or the chassis number from the RC book or the frame near the steering.</p>'}${rcV(s)}${pick}`;}
function vinBanner(p){const c=p.vin||'',rc=p.rcn?RC_SEEN[p.rcn]:null;return `<div class="dark-card" style="gap:8px"><span class="micro" style="color:var(--y)">${p.rcn?'BIKE FOUND FROM THE BIKE NUMBER '+esc(p.rcn):'BIKE FOUND FROM THE CHASSIS NUMBER'}</span><div class="h2" style="color:#fff">${esc(m2Bike(p))}</div>${c?`<div class="cap" style="color:var(--ink3)">${esc(c)}</div>`:''}${rc?rcTable(rc,1):''}${p.vsrc?`<div class="cap" style="color:var(--y)">${esc(p.vsrc)}</div>`:''}${c?vinChips(c):''}<button class="btn line sm" onclick="${c?`vinChange('${c}')`:`S.ui.vin={q:'${m2Q(p.rcn||'')}'};go('findpart',{v:'vin'})`}">Change bike</button></div>`;}
