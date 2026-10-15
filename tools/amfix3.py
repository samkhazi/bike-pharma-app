"""Update 8z: aftermarket brands in Admin > More > Catalogue files (Sam 2026-10-15 18:07Z "catalogues file me after markets ke brands
ke bhi catalogues dikhna he"), and their photos (Endurance, Lumax) in Find Part and Add product once uploaded.
cat/am-files.json (tools/aftermarket/am_files.py) = one card per folder of All Catalogues > After Market Brands.
usage: python3 amfix3.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function amFilesLoad' in a: raise SystemExit('already done')
def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:80]}')
    a = a.replace(old, new)
# Catalogue files: the aftermarket folders after the brands
sub("  for(const o of Object.values(sets)){o.files.forEach((z,n)=>o.spare.delete(n));try{",
    "  const af=await amFilesLoad();(af&&af.sets||[]).forEach(x=>{sets[x.dir]={dir:x.dir,brands:[x.name+' (aftermarket)'],files:new Map(x.files),spare:new Map(),have:new Map(),pick:x.pick,am:1};});\n  for(const o of Object.values(sets)){o.files.forEach((z,n)=>o.spare.delete(n));try{")
sub("`<p class=\"cap\" style=\"margin:0\">Every ${esc(o.brands.join(' and '))} diagram opens from your server now, in its original quality.</p>`",
    "`<p class=\"cap\" style=\"margin:0\">${o.am?'All '+esc(o.brands[0])+' files are on your server, in their original quality.':'Every '+esc(o.brands.join(' and '))+' diagram opens from your server now, in its original quality.'}</p>`")
# photos
sub("const amP=i=>{const p=AM.p[i];return {", "const amP=i=>{const p=AM.p[i];return {img:p[11]||'',")
sub("const amFits=p=>", """let AM_F=null,AM_FP=null;
function amFilesLoad(){if(!AM_FP)AM_FP=fetch('cat/am-files.json',{credentials:'same-origin'}).then(r=>r.ok?r.json():null,()=>null).then(d=>{AM_F=new Map();(d&&d.sets||[]).forEach(x=>x.files.forEach(([n,z])=>{if(!AM_F.has(n))AM_F.set(n,[x.dir,z]);}));if(d)refresh();return d;});return AM_FP;}
/* the part's own photo in its aftermarket catalogue (Endurance, Lumax), read from the server once Admin has uploaded the folder */
function amPic(p,cls){if(!p||!p.img)return '';if(!AM_F){amFilesLoad();return '';}const n=p.img.split('/').pop(),f=AM_F.get(n);if(!f)return '';
 return `<div class="${cls||'m2-th'}" role="img" aria-label="Photo" data-bg="${esc('pf:'+f[0]+'/'+n+':0:'+f[1])}" style="background-size:contain;background-position:center;background-repeat:no-repeat"></div>`;}
const amFits=p=>""")
sub("""function amRow(p,ok){return `<button class="m2-row" onclick="amGo('${m2Q(p.pn)}')"><div class="tile sm ${ok?'y':'n'}">${ic(ok?'check':'package','s18')}</div>""",
    """function amRow(p,ok){return `<button class="m2-row" onclick="amGo('${m2Q(p.pn)}')">${amPic(p)||`<div class="tile sm ${ok?'y':'n'}">${ic(ok?'check':'package','s18')}</div>`}""")
sub("""<div class="row wrap" style="gap:6px"><span class="pill n">Aftermarket</span><span class="pill g">${esc(p.b)} catalogue</span></div><div class="h3">""",
    """<div class="row wrap" style="gap:6px"><span class="pill n">Aftermarket</span><span class="pill g">${esc(p.b)} catalogue</span></div>${amPic(p,'fpc-pic m3-ph')}<div class="h3">""")
sub("const r=invRowOf(h.vb,h.pk),pic=invPic(r),all=!!S.ui.apAll,nf=h.fits.length;",
    "const r=invRowOf(h.vb,h.pk),pic=h.am?amPic(amByPn(h.pk)[0],'m2-th'):invPic(r),all=!!S.ui.apAll,nf=h.fits.length;")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
