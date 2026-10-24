"""Update 10d: Check parts with the registration number too (Sam 2026-10-20 "sirf register number daalte hin sabhi details show hona he,
jaise VR Garage me").
- The chassis box in Find Part also takes the bike's number (KA17HC3942). Our server asks the RC service (/api/rclook, key in .env) and the
  RC details show: owner, maker, model, year, fuel, colour, chassis, engine, insurance, PUC.
- The RC gives the full chassis number: the bike then opens the chassis way (the maker's site gives the model). The RC hides part of the
  chassis: the maker and model written on the RC open the bike. Neither known: staff pick the model, with the RC in front of them.
usage: python3 rc10d.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function rcGo' in a: raise SystemExit('already done')

def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:80]}')
    a = a.replace(old, new)

RCJS = r"""/* ----- update 10d: the bike's registration number -> RC details (our server asks the RC service; its key stays on the server) ----- */
const rcClean=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const rcIsReg=s=>/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(s)||/^\d{2}BH\d{4}[A-Z]{1,2}$/.test(s);
const RC_SEEN={};   /* reg no -> RC details, for the banner on the bike's page */
async function rcGo(reg){const s=S.ui.vin;s.rc={busy:1,reg};s.c='';s.look=null;s.pick=false;s.vb='';refresh();let r;
 try{const x=await fetch('/api/rclook?r='+encodeURIComponent(reg),{credentials:'same-origin'});r=await x.json();if(!x.ok&&!r.error)r={error:'Search failed ('+x.status+')'};}catch(e){r={error:'No internet connection'};}
 if(S.ui.vin!==s||!s.rc||s.rc.reg!==reg)return;s.rc={...r,reg};if(!r.found)return refresh();RC_SEEN[reg]=s.rc;
 /* the full chassis number: the chassis way, where the maker's site names the model */
 const ch=vinClean(r.chassis);if(/^[A-HJ-NPR-Z0-9]{17}$/.test(ch)&&(vinSite(ch)||vinBrands(ch).length)){s.c=ch;if(vinSite(ch))return vinAsk(ch);const m=(DB.vinMap||{})[vinKey(ch)];if(m&&BRANDS_V[m.vb])return vinOpen(ch,m.vb,m.vm);}
 /* else the maker and model the RC names ("HERO MOTOCORP LTD" "SPLENDOR PLUS") */
 const v=vqParse((r.maker||'')+' '+(r.model||''),{}).set;if(v.vb&&BRANDS_V[v.vb]&&v.vm&&v.vm!=='Any')return rcOpen(reg,v.vb,v.vm);
 s.rcb=v.vb&&BRANDS_V[v.vb]?v.vb:'';s.mf='';refresh();}
function rcOpen(reg,vb,vm){const r=RC_SEEN[reg]||{};catLoad(vb);go('findpart',{v:'year',vb,vm,yr:'Any',rcn:reg,vy:+r.year||0,vsrc:'RC: '+[r.maker,r.model].filter(Boolean).join(' ')});}
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
"""

sub("function vinFind(){", RCJS + "function vinFind(){")
# a registration number goes to the RC; checked on the typed letters, before the chassis clean-up reads O as zero
sub("const c=vinClean(s.q);s.err='';s.pick=false;s.vb='';\n",
    "const c=vinClean(s.q);s.err='';s.pick=false;s.vb='';s.rc=null;s.rcb='';\n const rg=rcClean(s.q);if(rg.length<17&&rcIsReg(rg)){s.q=rg;return rcGo(rg);}\n")
sub("'A chassis number has 17 letters and numbers. You typed '+c.length+'.'",
    "'Type the 17-letter chassis number, or the bike number like KA17HC3942. You typed '+c.length+' letters.'")
# the chassis way after an RC keeps the RC with the bike
sub("function vinOpen(c,vb,vm,src){catLoad(vb);go('findpart',{v:'year',vb,vm,yr:'Any',vin:c,vy:vinYear(c),...(src?{vsrc:vb+' site: '+src}:{})});}",
    "function vinOpen(c,vb,vm,src){catLoad(vb);const rc=S.ui.vin&&S.ui.vin.rc&&S.ui.vin.rc.found?S.ui.vin.rc:null;go('findpart',{v:'year',vb,vm,yr:'Any',vin:c,vy:vinYear(c),...(src?{vsrc:vb+' site: '+src}:{}),...(rc?{rcn:rc.reg}:{})});}")
# the view: the RC card under the box, new title and placeholder
sub("${s.err?`<div class=\"errmsg\">${esc(s.err)}</div>`:'<p class=\"cap m2-hint\">On the RC book, and punched on the frame near the steering.</p>'}${pick}`;}",
    "${s.err?`<div class=\"errmsg\">${esc(s.err)}</div>`:'<p class=\"cap m2-hint\">Bike number from the number plate, or the chassis number from the RC book or the frame near the steering.</p>'}${rcV(s)}${pick}`;}")
sub("m2Head('Check parts with chassis number','Type or scan the 17-letter chassis number from the RC or the bike frame. The bike opens by itself.')",
    "m2Head('Check parts with bike or chassis number','Type the bike number (KA17HC3942) or the 17-letter chassis number. The bike opens by itself.')")
sub('placeholder="Chassis number, e.g. MBLHAW…" aria-label="Chassis number"', 'placeholder="Bike or chassis number" aria-label="Bike or chassis number"')
sub('<div class="h3">Check parts with chassis number</div><div class="cap">Type the chassis number: the app finds the bike, then search its parts.</div>',
    '<div class="h3">Check parts with bike or chassis number</div><div class="cap">Type the bike number or chassis number: the app finds the bike, then search its parts.</div>')
# the bike's page: the banner for a bike found from the RC
sub("function vinBanner(p){const c=p.vin;return `<div class=\"dark-card\" style=\"gap:8px\"><span class=\"micro\" style=\"color:var(--y)\">BIKE FOUND FROM THE CHASSIS NUMBER</span><div class=\"h2\" style=\"color:#fff\">${esc(m2Bike(p))}</div><div class=\"cap\" style=\"color:var(--ink3)\">${esc(c)}</div>",
    "function vinBanner(p){const c=p.vin||'',rc=p.rcn?RC_SEEN[p.rcn]:null;return `<div class=\"dark-card\" style=\"gap:8px\"><span class=\"micro\" style=\"color:var(--y)\">${p.rcn?'BIKE FOUND FROM THE BIKE NUMBER '+esc(p.rcn):'BIKE FOUND FROM THE CHASSIS NUMBER'}</span><div class=\"h2\" style=\"color:#fff\">${esc(m2Bike(p))}</div>${c?`<div class=\"cap\" style=\"color:var(--ink3)\">${esc(c)}</div>`:''}${rc?rcTable(rc,1):''}")
sub("${vinChips(c)}<button class=\"btn line sm\" onclick=\"vinChange('${c}')\">Change bike</button></div>`;}",
    "${c?vinChips(c):''}<button class=\"btn line sm\" onclick=\"${c?`vinChange('${c}')`:`S.ui.vin={q:'${m2Q(p.rcn||'')}'};go('findpart',{v:'vin'})`}\">Change bike</button></div>`;}")
sub("if(ys.length<2){if(p.vin&&V!=='wait')", "if(ys.length<2){if((p.vin||p.rcn)&&V!=='wait')")
sub("if(p.vin&&p.vy){const yo=", "if((p.vin||p.rcn)&&p.vy){const yo=")
sub("${p.vin?vinBanner(p):''}<div class=\"card m2-look\"><div class=\"h3\">${p.vin?'Search parts in this bike'",
    "${p.vin||p.rcn?vinBanner(p):''}<div class=\"card m2-look\"><div class=\"h3\">${p.vin||p.rcn?'Search parts in this bike'")
sub("<div class=\"cap\">${p.vin?'Part name, part number or the mechanic’s word",
    "<div class=\"cap\">${p.vin||p.rcn?'Part name, part number or the mechanic’s word")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
