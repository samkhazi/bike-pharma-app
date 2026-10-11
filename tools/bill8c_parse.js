/* ---- update 8c (Sam 2026-10-11 19:53Z-20:24Z): reading a supplier bill ----
   A page's text (Apna AI on our server, the phone's own reader, or a PDF's own text) -> the bill's header (supplier GSTIN with its check
   digit, bill no., date, name), totals (taxable, GST, round off, grand total, amount in words) and item lines (part no., qty, rate,
   discount, MRP, HSN, GST %, amount), read by the table's own column titles. Every line is checked: qty x rate (less discount) = amount. */
const BP_UNIT=/^(nos?\.?|no\.|pcs?\.?|pc|sets?|kits?|prs?|pairs?|ltrs?\.?|l|ml|mtrs?|kgs?|gms?|box(es)?|pkts?|ea|each|units?|rolls?|btls?|bottles?|cans?|tins?|doz|dzn|jars?|pouch|nr)$/i;
const GST_CH='0123'+'456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function gstSum(g){let s=0;for(let i=0;i<14;i++){const p=GST_CH.indexOf(g[i])*(i%2?2:1);s+=Math.floor(p/36)+p%36;}return GST_CH[(36-s%36)%36];}
const gstOk=g=>/^(0[1-9]|[12]\d|3[0-8]|97|99)[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)&&gstSum(g)===g[14];
const GST_D={O:'0',D:'0',Q:'0',U:'0',I:'1',L:'1',J:'1',T:'7',Z:'2',S:'5',B:'8',G:'6',A:'4'},GST_A={'0':'O','1':'I','2':'Z','5':'S','8':'B','6':'G','4':'A','7':'T'};
/* a GSTIN as read: letters and digits put back in their places (O/0, I/1, S/5 ...), then the check digit decides. A wrong one stays
   marked (bad) unless it is one letter away from a supplier we already know. */
function gstFix(raw,known){const r=catPk(raw).slice(0,15);if(r.length!==15)return null;const a=r.split('');
 [0,1,7,8,9,10].forEach(i=>{if(GST_D[a[i]])a[i]=GST_D[a[i]];});[2,3,4,5,6,11].forEach(i=>{if(GST_A[a[i]])a[i]=GST_A[a[i]];});if(a[13]==='2')a[13]='Z';
 let g=a.join('');if(!/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(g))return null;
 if(gstOk(g))return {g,fixed:g!==r};
 const c=gstSum(g),eq=(x,y)=>x===y||OCR_EQ.includes(x+y)||OCR_EQ.includes(y+x);
 if(eq(c,g[14])&&gstOk(g.slice(0,14)+c))return {g:g.slice(0,14)+c,fixed:true};
 const near=(known||[]).filter(k=>k.length===15&&[...k].reduce((n,ch,i)=>n+(ch===g[i]?0:eq(ch,g[i])?1:9),0)===1);
 if(near.length===1)return {g:near[0],fixed:true};
 return {g,bad:true};}
/* money and counts as printed: 1,180.00 / 1,18,000 / 118,00 (point read as a comma) / l18.0O (letters read for digits) */
function bpNum(s){let t=String(s==null?'':s).trim().replace(/^(₹|rs\.?|inr)\s*/i,'').replace(/\/-?$/,'').replace(/^\((.*)\)$/,'-$1');
 if(/^-?[\d.,OoIlSBZ|]+$/.test(t)&&/\d/.test(t)){const dg=(t.match(/\d/g)||[]).length,al=(t.match(/[OoIlSBZ|]/g)||[]).length;if(al&&al*3<=dg)t=t.replace(/[Oo]/g,'0').replace(/[Il|]/g,'1').replace(/S/g,'5').replace(/B/g,'8').replace(/Z/g,'2');}
 if(!/^-?[\d.,]+$/.test(t)||!/\d/.test(t))return NaN;const neg=t[0]==='-';if(neg)t=t.slice(1);
 if(/,\d{2}$/.test(t)&&!/\./.test(t))t=t.replace(/,(\d{2})$/,'.$1');
 const dots=(t.match(/\./g)||[]).length;if(dots>1){const i=t.lastIndexOf('.');t=t.slice(0,i).replace(/\./g,'')+t.slice(i);}
 t=t.replace(/,/g,'');if(!/^(\d+\.?\d*|\.\d+)$/.test(t))return NaN;const v=parseFloat(t);return neg?-v:v;}
const bpIsN=w=>isFinite(bpNum(w));
const bpPct=w=>{const m=/^(\d+(?:\.\d+)?)\s*%$/.exec(String(w).trim());return m?+m[1]:null;};
/* a part number, not a size, oil grade, HSN, GSTIN, phone or money */
const bpPnLike=w=>{w=String(w||'').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,'');return ocrPnLike(w)&&!/^\d{1,2}W-?\d{2}$/i.test(w)&&!/^\d+(\.\d+)?(ML|LTR|LT|GMS?|KGS?|MM|CM|V|W|AH|CC|HP)$/i.test(w);};
/* a row of the page -> its cells (2+ spaces, tabs or | between columns); numbers stuck to a name are taken off it */
function bpCells(row){const raw=String(row).replace(/[|¦]/g,'  ').replace(/\t/g,'  ').split(/\s{2,}/).map(c=>c.trim()).filter(Boolean),out=[];
 const N=w=>bpIsN(w)||bpPct(w)!=null||BP_UNIT.test(w);
 for(const c of raw){const t=c.split(/\s+/);if(t.length===1){out.push(c);continue;}
  if(t.every(N)){out.push(...t);continue;}
  let a=0,b=t.length;const L=[],R=[];
  while(a<b-1&&/^\d{1,3}\.?$/.test(t[a])&&a===0)L.push(t[a++]);                                  // a serial no. stuck to the name
  while(b>a+1&&N(t[b-1])&&(/[.,%]/.test(t[b-1])&&bpIsN(t[b-1].replace(/%$/,''))||BP_UNIT.test(t[b-1])&&b-2>a&&bpIsN(t[b-2])||/^\d{6}(\d{2})?$/.test(t[b-1])||R.length&&!BP_UNIT.test(t[b-1])))R.unshift(t[--b]);
  out.push(...L,t.slice(a,b).join(' '),...R);}
 const m=[];for(const c of out){const p=m[m.length-1],tx=x=>/^[A-Za-z][A-Za-z ,&.\/()'-]*$/.test(x)&&!BP_UNIT.test(x);if(p!=null&&tx(c)&&tx(p))m[m.length-1]=p+' '+c;else m.push(c);}
 return m;}
/* the table's column titles, in order */
const BP_HRE=/(s\.?\s?no\b\.?|sr\.?\s?no\b\.?|sl\.?\s?no\b\.?)|(part\s*(?:no\b\.?|number|#|code)|item\s*code|cat(?:alogue)?\.?\s*no\b\.?|\bp\s*\/\s*n\b)|(hsn(?:\s*\/\s*sac)?(?:\s*code)?|\bsac\b)|(unit\s*(?:price|rate)|\brate\b|\bprice\b)|(\bm\.?\s?r\.?\s?p\b\.?)|(\bqty\b\.?|quantity|\bqnty\b)|(\bunit\b|\buom\b)|(disc(?:ount)?\.?\s*(?:%|amt\.?|amount)?|\bdis\.?\s*%)|((?:c|s|i|ut)?gst\s*(?:%|rate|amt\.?|amount)?|\btax\s*(?:%|rate)?(?![a-z]))|(taxable(?:\s*(?:value|amt\.?|amount))?)|(description|particulars?|item\s*(?:name|description)|product(?:\s*name)?|\bitem\b|\bgoods\b)|(\bamount\b|\bamt\b\.?|\btotal\b|\bvalue\b)/gi;
const BP_HK=['sl','pn','hsn','rate','mrp','qty','unit','disc','gst','taxable','desc','amt'];
function bpHeadKinds(s){const k=[];let m;BP_HRE.lastIndex=0;
 while((m=BP_HRE.exec(s))){for(let g=1;g<=12;g++)if(m[g]){let kd=BP_HK[g-1];if(kd==='disc'&&/amt|amount/i.test(m[g]))kd='disca';k.push(kd);break;}if(!m[0])BP_HRE.lastIndex++;}
 const has=x=>k.includes(x);
 return k.length>=3&&(has('qty')||has('rate'))&&(has('amt')||has('rate')||has('taxable'))&&(has('pn')||has('desc'))?k:null;}
/* how well a cell fits a column */
function bpFit(c,k){const v=bpNum(c),num=isFinite(v),pc=bpPct(c),txt=/[A-Za-z]{2,}/.test(c),unit=BP_UNIT.test(c);
 switch(k){
  case 'sl':return /^\d{1,3}\.?$/.test(c)?0:3;
  case 'pn':return c.split(/\s+/).some(bpPnLike)?0:txt&&!num?1.6:3;
  case 'desc':return txt&&!unit?0:/[A-Za-z]/.test(c)?.8:2.5;
  case 'hsn':return /^\d{4}(\d{2}){0,2}$/.test(c)?0:3;
  case 'qty':return num&&v>0&&v<1e5?(/^\d+$/.test(c)?0:.4):/^\d+(\.\d+)?\s*[A-Za-z]{1,5}$/.test(c)&&BP_UNIT.test(c.replace(/^[\d.]+\s*/,''))?.3:3;
  case 'unit':return unit?0:2.2;
  case 'disc':case 'disca':case 'gst':return pc!=null||num||/^-+$/.test(c)?0:3;
  default:return num?0:3;}}
const BP_SKIPC={sl:.8,pn:1,desc:1,hsn:1,unit:.6,disc:.6,disca:.6,gst:.6,mrp:1,taxable:1,qty:2,rate:2,amt:2};
/* cells -> columns: the cheapest way to line them up (a missing cell or an extra one costs a little) */
function bpAlign(cells,cols){const n=cells.length,m=cols.length,D=[],B=[];
 for(let i=0;i<=n;i++){D.push(new Array(m+1).fill(1e9));B.push(new Array(m+1).fill(0));}D[0][0]=0;
 for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){const d=D[i][j];if(d>=1e9)continue;
  if(i<n&&j<m){const v=d+bpFit(cells[i],cols[j]);if(v<D[i+1][j+1]){D[i+1][j+1]=v;B[i+1][j+1]=1;}}
  if(j<m){const v=d+(BP_SKIPC[cols[j]]||1);if(v<D[i][j+1]){D[i][j+1]=v;B[i][j+1]=2;}}
  if(i<n){const v=d+1.5;if(v<D[i+1][j]){D[i+1][j]=v;B[i+1][j]=3;}}}
 const map=new Array(m).fill(-1);let i=n,j=m;while(i>0||j>0){const b=B[i][j];if(b===1){map[j-1]=i-1;i--;j--;}else if(b===2)j--;else if(b===3)i--;else break;}
 return map;}
const BP_GST=[0,.25,3,5,12,18,28];
function bpFromCols(cells,cols,map){const o={},gs=[];
 cols.forEach((k,j)=>{const ci=map[j];if(ci<0)return;const c=cells[ci];
  if(k==='pn'){const t=c.split(/\s+/),i=t.findIndex(bpPnLike);if(i>-1){o.pn=t[i];const rest=t.filter((_,x)=>x!==i).join(' ');if(/[A-Za-z]{2}/.test(rest))o.name=rest;}else o.name=c;}
  else if(k==='desc')o.name=(o.name?o.name+' ':'')+c;
  else if(k==='hsn')o.hsn=c;
  else if(k==='qty')o.q=bpNum(c.replace(/\s*[A-Za-z]+\.?$/,''));
  else if(k==='rate')o.r=bpNum(c);else if(k==='mrp')o.mrp=bpNum(c);else if(k==='amt')o.amt=bpNum(c);else if(k==='taxable')o.tx=bpNum(c);
  else if(k==='disc'){const p=bpPct(c);if(p!=null)o.dp=p;else{const v=bpNum(c);if(isFinite(v))o.dv=v;}}
  else if(k==='disca'){const v=bpNum(c);if(isFinite(v))o.da=v;}
  else if(k==='gst'){const p=bpPct(c),v=p!=null?p:bpNum(c);if(isFinite(v))gs.push({v,p:p!=null});}});
 const rates=gs.filter(g=>g.p||[2.5,6,9,14].concat(BP_GST).includes(g.v)).map(g=>g.v);
 if(rates.length){const s=rates.length>=2&&rates[0]===rates[1]&&[2.5,6,9,14].includes(rates[0])?rates[0]*2:rates[0];if(BP_GST.includes(s))o.gst=s;}
 if(!o.pn&&o.name){const t=o.name.split(/\s+/),i=t.findIndex(bpPnLike);if(i>-1){o.pn=t[i];o.name=t.filter((_,x)=>x!==i).join(' ');}}
 return o;}
/* qty x rate (less a discount) = amount (or the line's taxable value) */
function bpCheck(o){const q=o.q,r=o.r;if(!(q>0&&r>0))return false;const g=q*r,tol=t=>Math.max(.6,t*.012),T=[o.tx,o.amt].filter(t=>t>0);
 if(!T.length)return null;
 for(const t of T){
  if(o.dp>0&&Math.abs(g*(1-o.dp/100)-t)<=tol(t))return true;
  if(o.da>0&&Math.abs(g-o.da-t)<=tol(t)){o.dp=Math.round(o.da/g*1e4)/100;return true;}
  if(o.dv>0&&Math.abs(g-o.dv-t)<=tol(t)){o.dp=Math.round(o.dv/g*1e4)/100;return true;}
  if(o.dv>0&&o.dv<100&&Math.abs(g*(1-o.dv/100)-t)<=tol(t)){o.dp=o.dv;return true;}
  if(Math.abs(g-t)<=tol(t)){if(o.dp>0||o.dv>0){o.dg=1;if(!(o.dp>0))o.dp=o.dv<100?o.dv:0;}return true;}
  if(o.gst>0&&Math.abs(g*(1-(o.dp>0?o.dp:0)/100)*(1+o.gst/100)-t)<=tol(t)){o.incl=1;return true;}}
 return false;}
/* no column titles (or they did not fit): the numbers after the part no. that make qty x rate = amount */
function bpMath(nums,order,pcts){
 const alt=n=>{const v=bpNum(n),a=[[v,0]];if(!/[.,]/.test(n)){if(n.length>=3)a.push([v/100,.6]);if(n.length>=2)a.push([Math.floor(v/10),1.5]);}return a;};
 let best=null;
 for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)for(let k=j+1;k<nums.length;k++)
  for(const [a,pa] of alt(nums[i]))for(const [b,pb] of alt(nums[j]))for(const [c,pc] of alt(nums[k])){
   const q=order==='rq'?b:a,r=order==='rq'?a:b;if(!(q>0&&q<=99999&&r>0&&c>0))continue;
   for(const d of [0,...pcts]){if(Math.abs(q*r*(1-d/100)-c)>Math.max(.6,c*.012))continue;
    const sc=pa+pb+pc+(Number.isInteger(q)?0:.8)+(k-j-1)*.3+(j-i-1)*.3+(d?.2:0);if(!best||sc<best.sc)best={q,r,amt:c,dp:d,sc,ix:[i,j,k]};}}
 return best;}
const BP_HSNC=/^(27|34|38|39|40|48|49|56|59|68|70|73|74|76|83|84|85|87|90|94|96)\d{2}(\d{2}){0,2}$/;
function bpRow(cells0,cols,order){const cells=bpCells(cells0.join('  '));
 let o=null;
 if(cols&&cells.length>=3){o=bpFromCols(cells,cols,bpAlign(cells,cols));o.ok=bpCheck(o);}
 if(!o||o.ok!==true){
  const toks=cells.join('  ').split(/\s+/).map(w=>w.replace(/^[^\w₹(.-]+|[^\w.%)]+$/g,'')).filter(Boolean);
  let s0=/^\d{1,3}\.?$/.test(toks[0])?1:0,pi=-1;for(let i=s0;i<toks.length;i++)if(bpPnLike(toks[i])){pi=i;break;}
  const rest=toks.slice(pi>-1?pi+1:s0),nums=[],pcts=[],pos=[];
  rest.forEach((w,i)=>{const p=bpPct(w);if(p!=null){pcts.push(p);return;}const m=/^(\d[\d.,]*)(?:[A-Za-z]{1,5})?$/.exec(w);if(m&&bpIsN(m[1])&&!(/[A-Za-z]$/.test(w)&&!BP_UNIT.test(w.replace(/^[\d.,]+/,'')))){nums.push(m[1]);pos.push(i);}});
  const M=bpMath(nums,order,pcts);
  if(M){const was=o||{};o={pn:pi>-1?toks[pi]:was.pn,name:was.name,q:M.q,r:M.r,amt:M.amt,dp:M.dp||was.dp,ok:true};
   if(!o.name){const nm=rest.slice(0,pos.length?pos[0]:rest.length).filter(w=>/[A-Za-z]{2}/.test(w)&&!BP_UNIT.test(w));const pre=pi>-1?[]:toks.slice(s0,s0+(pos[0]||0)).filter(w=>/[A-Za-z]/.test(w));o.name=(pi>-1?nm:pre).join(' ')||'';}
   const used=new Set(M.ix),ri=M.ix[order==='rq'?0:1];
   if(was.hsn)o.hsn=was.hsn;if(was.gst!=null)o.gst=was.gst;if(was.mrp>0)o.mrp=was.mrp;
   nums.forEach((n,i)=>{if(used.has(i))return;const v=bpNum(n);
    if(!o.hsn&&/^\d{4}(\d{2}){0,2}$/.test(n)&&BP_HSNC.test(n))o.hsn=n;
    else if(!(o.mrp>0)&&/[.,]/.test(n)&&v>=o.r*.3&&v<=o.r*6&&(i===ri-1||i===ri+1||i<ri))o.mrp=v;});
   if(o.gst==null){const g=pcts.filter(p=>p!==o.dp);const s=g.length>=2&&g[0]===g[1]&&[2.5,6,9,14].includes(g[0])?g[0]*2:g[0];if(BP_GST.includes(s))o.gst=s;}}
  else if(o&&o.q>0&&o.r>0)o.bad=1;
  else return null;}
 if(!(o.q>0&&o.r>0))return null;
 o.pn=o.pn?String(o.pn).replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,'').toUpperCase():'';
 if(o.hsn&&!/^\d{4}(\d{2}){0,2}$/.test(o.hsn))o.hsn='';
 o.name=String(o.name||'').replace(/\s+/g,' ').trim().slice(0,80);
 if(!o.pn&&(!o.name||o.ok!==true))return null;   // a row without a part no. counts only when its numbers add up
 return o;}
/* ---- the header ---- */
const BP_MON={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
function bpIso(d,m,y){d=+d;m=+m;y=+y;if(y<100)y+=2000;if(!(y>=2015&&y<=2099&&m>=1&&m<=12&&d>=1&&d<=31))return '';const t=new Date(y,m-1,d);if(t.getMonth()!==m-1)return '';return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function bpDateIn(s){const out=[];let m;
 const A=/(?<!\d)(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})(?!\d)/g,Bm=/(?<!\d)(\d{1,2})[\s\-\/.]*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s\-\/.,']*(\d{4}|\d{2})(?!\d)/gi,C=/(?<!\d)(20\d{2})[\-\/.](\d{1,2})[\-\/.](\d{1,2})(?!\d)/g;
 while((m=A.exec(s))){const v=bpIso(m[1],m[2],m[3]);if(v)out.push([m.index,v]);}
 while((m=Bm.exec(s))){const v=bpIso(m[1],BP_MON[m[2].toUpperCase().slice(0,3)],m[3]);if(v)out.push([m.index,v]);}
 while((m=C.exec(s))){const v=bpIso(m[3],m[2],m[1]);if(v)out.push([m.index,v]);}
 out.sort((a,b)=>a[0]-b[0]);return out.length?out[0][1]:'';}
const BP_BUY=/bill(ed)?\s*to|buyer|consignee|ship(ped)?\s*to|sold\s*to|customer|party\s*(name|details)|recipient|\bm\/s\b/i;
function bpHead(rows,upto,known){const H={gsts:[]};upto=Math.max(1,upto);
 // GSTINs: after a GSTIN label, or a word shaped like one; the buyer's (ours) is the one under Bill to / Buyer
 rows.forEach((r,i)=>{const up=r.toUpperCase(),cand=[];let m;const re=/G\s*S\s*T\s*(?:I\s*N|N\s*O|N)?\s*(?:N\s*O\.?|#|NUMBER)?\s*[:.\-]?\s*/g;
  while((m=re.exec(up))){const rest=up.slice(m.index+m[0].length).replace(/[^A-Z0-9]/g,'');if(rest.length>=15)cand.push(rest.slice(0,15));if(m[0]==='')re.lastIndex++;}
  up.split(/[^A-Z0-9]+/).forEach(w=>{if(w.length===15&&/^[0-9OISZBDQ]{2}[A-Z0-9]{5}/.test(w))cand.push(w);});
  cand.forEach(c=>{const f=gstFix(c,known);if(f&&!H.gsts.some(x=>x.g===f.g)){const ctx=rows.slice(Math.max(0,i-2),i+1).join(' '),near=up.slice(0,up.indexOf(c.slice(0,4))>-1?up.indexOf(c.slice(0,4)):up.length);
   H.gsts.push({...f,i,buy:BP_BUY.test(near)||BP_BUY.test(ctx)&&!/GSTIN/i.test(rows[Math.max(0,i-1)]||'')&&i>0&&BP_BUY.test(rows.slice(Math.max(0,i-2),i).join(' '))});}});});
 // bill no.
 const IV=/(?:[il1|]nv[o0][il1|]ce|\binv|b[il1|]ll|voucher|vch|memo)\.?\s*(?:n[o0]\b\.?|number|num\b|#)\s*[:\-.#]?\s*([A-Z0-9][A-Z0-9\/\-_.]{0,30})?/i;
 for(let i=0;i<Math.min(rows.length,upto+3)&&!H.inv;i++){const m=IV.exec(rows[i]);if(!m)continue;let v=m[1]||'';
  if(!v){const w=/^[A-Z0-9][A-Z0-9\/\-_.]{1,30}/i.exec(((rows[i+1]||'').split(/\s{2,}/)[0]||'').trim());v=w?w[0]:'';}
  v=v.replace(/(?<=[0-9\/\-.])(date|dated|dt|bill|inv|invoice|to)[a-z]*$/i,'').replace(/[.\-\/:_]+$/,'');
  if(v.length>=2&&/\d/.test(v)&&!/^(date|dated)$/i.test(v))H.inv=v.toUpperCase();}
 // date: after a Date label first, else the first date on the top of the page
 for(let i=0;i<Math.min(rows.length,upto+3)&&!H.date;i++){const m=/dat(?:e|ed)\b|\bdt\b/i.exec(rows[i]);if(m)H.date=bpDateIn(rows[i].slice(m.index));}
 for(let i=0;i<Math.min(rows.length,upto+1)&&!H.date;i++)H.date=bpDateIn(rows[i]);
 // the supplier's name: the first line of the page that reads like a business name (not ours, not an address)
 const own=catPk(typeof SHOP!=='undefined'&&SHOP.n||'');
 for(let i=0;i<Math.min(rows.length,upto,8)&&!H.name;i++){let s=rows[i].replace(/\s{2,}/g,' ').trim();const up=s.toUpperCase(),core=up.replace(/[^A-Z0-9]/g,'');
  if(/TAX\s*INVOICE|^INVOICE$|ORIGINAL|DUPLICATE|TRIPLICATE|GSTIN|PHONE|\bPH\b|MOBILE|E-?MAIL|@|BILL\s*TO|ESTIMATE|QUOTATION|CREDIT\s*NOTE|DEBIT\s*NOTE|CASH\s*MEMO/.test(up))continue;
  if(core.length<5||(core.match(/[A-Z]/g)||[]).length<core.length*.75||/\d{6}/.test(up))continue;
  if(own&&core.includes(own))continue;
  if(!/\s/.test(s)&&s.length>12)s=s.replace(/(AUTOMOBILES|AUTO|MOTORS|AGENCIES|AGENCY|ENTERPRISES|TRADERS|TRADING|DISTRIBUTORS|SPARES|PARTS|SALES|INDUSTRIES|PVT|LTD|LLP|COMPANY|STORES|CORPORATION)/g,' $1').trim();
  H.name=s.replace(/\s+/g,' ').replace(/[,.:;\-]+$/,'').slice(0,60);}
 return H;}
/* ---- totals ---- */
const BP_W={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fourty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
function bpWordsNum(t){let total=0,cur=0,any=0;for(const w of String(t).toLowerCase().replace(/-/g,' ').split(/[^a-z]+/)){if(!w||w==='and')continue;
  if(w in BP_W){cur+=BP_W[w];any=1;}else if(w==='hundred'){cur=(cur||1)*100;any=1;}else if(w==='thousand'){total+=(cur||1)*1e3;cur=0;any=1;}
  else if(/^(lakhs?|lacs?)$/.test(w)){total+=(cur||1)*1e5;cur=0;any=1;}else if(/^crores?$/.test(w)){total+=(cur||1)*1e7;cur=0;any=1;}else return NaN;}
 return any?total+cur:NaN;}
function bpWords(s){const m=/(?:rupees|\brs\b\.?|\binr\b)\s*:?\s*([a-z][a-z\s,\-]*?)\s*(?:only\b|\.|$)/i.exec(s);if(!m)return NaN;let t=m[1].replace(/,/g,' '),p=0;
 const pm=/\b(?:and\s+)?((?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety)[\s\-]*)+)paise\b/i.exec(t);if(pm){p=bpWordsNum(pm[1]);t=t.slice(0,pm.index);}
 const r=bpWordsNum(t.replace(/\band\s*$/i,''));return isFinite(r)?Math.round((r+(isFinite(p)?p/100:0))*100)/100:NaN;}
const BP_TOT=/\b(sub\s*total|grand\s*total|total|round(?:ed)?\s*off|r\/off|cgst|sgst|igst|utgst|cess|taxable\s*(?:value|amount)|net\s*(?:amount|payable|amt)|amount\s*(?:in\s*words|payable|chargeable)|rupees|bank\s*details|ifsc|declaration|terms\s*(?:&|and)\s*conditions)\b/i;
function bpTotals(rows,from){const T={};
 T.nums=[];
 for(let i=Math.max(0,from);i<rows.length;i++){const s=rows[i].replace(/\(\s*-\s*\)\s*/g,'-'),l=s.toLowerCase();
  const toks=s.replace(/₹/g,' ').split(/\s+/).map(w=>w.replace(/^[^\d(-]+|[^\d)%]+$/g,'')).filter(Boolean),money=[],pc=[];
  toks.forEach(w=>{const p=bpPct(w);if(p!=null)pc.push(p);else if(/[\d]/.test(w)&&bpIsN(w))money.push(bpNum(w));});
  (s.match(/(\d+(?:\.\d+)?)\s*%/g)||[]).forEach(x=>{const v=parseFloat(x);if(!pc.includes(v))pc.push(v);});
  const last=money.length?money[money.length-1]:NaN,ok=isFinite(last);if(/total|taxable|amount|value/.test(l))money.forEach(v=>{if(v>0&&!T.nums.includes(v)&&T.nums.length<24)T.nums.push(v);});
  if(/amount\s*in\s*words|rupees|\binr\b/.test(l)){const w=bpWords(s);if(w>0)T.words=w;continue;}
  if(/taxable/.test(l)&&ok)T.taxable=last;
  else if(/\bcgst\b/.test(l)&&ok){T.cgst=last;if(pc.length)T.cr=pc[0];}
  else if(/\b(sgst|utgst)\b/.test(l)&&ok){T.sgst=last;if(pc.length)T.sr=pc[0];}
  else if(/\bigst\b/.test(l)&&ok){T.igst=last;if(pc.length)T.ir=pc[0];}
  else if(/\bcess\b/.test(l)&&ok)T.cess=last;
  else if(/round(?:ed)?\s*off|r\/off/.test(l)&&ok)T.round=/less|-\s*\d/.test(l)&&last>0?-last:last;
  else if(/grand\s*total|net\s*(amount|payable|total|amt|bill)|invoice\s*(total|value|amount)|total\s*(amount|payable|invoice\s*value|invoice|value)|amount\s*payable|bill\s*amount/.test(l)&&ok)T.grand=last;
  else if(/disc(ount)?\b|\bless\b/.test(l)&&ok&&!/%\s*$/.test(s.trim()))T.disc=Math.abs(last);
  else if(/^\s*(sub\s*)?total\b/.test(l)&&ok)T.sub=Math.max(T.sub||0,last);}
 T.tax=Math.round(((T.cgst||0)+(T.sgst||0)+(T.igst||0)+(T.cess||0))*100)/100;
 T.rate=(T.cr||0)+(T.sr||0)+(T.ir||0);if(!BP_GST.includes(T.rate))T.rate=T.taxable>0&&T.tax>0?BP_GST.find(g=>Math.abs(T.taxable*g/100-T.tax)<=Math.max(1,T.tax*.01))||0:0;
 if(!T.grand&&T.words)T.grand=T.words;
 if(!T.grand&&T.taxable&&T.tax)T.grand=Math.round((T.taxable+T.tax+(T.round||0))*100)/100;
 return T;}
/* ---- a whole page ---- */
const BP_HEADY=/gstin|invoice|bill\s*(no|to)|date|phone|mobile|e-?mail|address|state\s*code|pin\s*code|place\s*of\s*supply|vehicle|transport|e-?way|irn|ack/i;
function bpParse(text,ctx){ctx=ctx||{};
 const rows=String(text||'').split(/\r?\n/).map(r=>r.replace(/[“”"`~»«]/g,' ').replace(/[–—]/g,'-').replace(/\s+$/,'')).filter(r=>r.trim());
 let h=-1,cols=null;for(let i=0;i<rows.length;i++){const k=bpHeadKinds(rows[i]);if(k){h=i;cols=k;break;}}
 const use=cols||ctx.cols||null,order=use&&use.indexOf('rate')>-1&&use.indexOf('qty')>-1&&use.indexOf('rate')<use.indexOf('qty')?'rq':ctx.order||'qr';
 const lines=[],np=[];let first=-1,last=-1;
 for(let i=h+1;i<rows.length;i++){const s=rows[i];
  if(BP_TOT.test(s)){if(first>-1)break;continue;}
  if(first<0&&BP_HEADY.test(s))continue;
  if(OCR_SKIP.test(s))continue;
  const r=bpRow(bpCells(s),use,order);if(!r)continue;if(first<0)first=i;last=i;(r.pn?lines:np).push(r);}
 const H=bpHead(rows,h>-1?h:first>-1?first:Math.min(rows.length,15),ctx.known),T=bpTotals(rows,last>-1?last+1:h>-1?h+1:0);
 // a discount printed but not taken off the amounts: the bill's taxable value says whether it is taken off later or the rate is net already
 const dg=lines.concat(np).filter(o=>o.dg&&o.dp>0);
 if(dg.length&&T.taxable>0){const all=lines.concat(np),gross=all.reduce((a,o)=>a+(o.amt||o.q*o.r),0),net=all.reduce((a,o)=>a+(o.dg&&o.dp>0?o.q*o.r*(1-o.dp/100):(o.amt||o.q*o.r)),0);
  if(Math.abs(gross-T.taxable)<Math.abs(net-T.taxable))dg.forEach(o=>{o.dp=0;});}
 return {hdr:H,tot:T,cols,order,lines,np};}
/* a line for the Pasted box: part no., qty, rate, then what else the bill says */
function bpLineTxt(o){const f=v=>String(Math.round(v*100)/100),net=o.q*o.r*(1-(o.dp>0?o.dp:0)/100),amt=o.tx>0?o.tx:o.incl&&o.gst>0?Math.round(net*100)/100:o.amt;
 return [String(o.pn).toUpperCase(),f(o.q),(+o.r).toFixed(2),o.mrp>0?'MRP '+(+o.mrp).toFixed(2):'',o.hsn?'HSN '+o.hsn:'',o.gst!=null&&o.gst!==''?'GST '+o.gst+'%':'',o.dp>0?'DISC '+f(o.dp)+'%':'',amt>0?'AMT '+(+amt).toFixed(2):''].filter(Boolean).join('  ');}
