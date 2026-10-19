"""update 9l (Sam 2026-10-19 "hero catalogues update karna he"): the new Hero data file (tools/brands/hero_update.py) in the app:
- CAT_PNR's Hero entry made again from the new cat/hero.json (as tools/build_public.py makes it)
- an 'Old no. X' remark is searched like 'Alternate no. X': the old number finds the line of the new one
- a diagram that is an SVG (the 2 new Hero editions; Hero's folder has no other picture of them) is drawn here as a PNG, so the
  diagram viewer and the clickable numbers (the server's AI reads the PNG the page sends, as for the PDF books) work the same
usage: python3 tools/hero9l.py public/app.html public/cat/hero.json"""
import base64, collections, hashlib, json, re, sys
app, cat = sys.argv[1], sys.argv[2]
a = open(app, encoding='utf-8').read()
def sub1(old, new):
    global a
    assert a.count(old) == 1, old[:80]
    a = a.replace(old, new)
PN_AL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
pn_pk = lambda v: re.sub(r'[^A-Z0-9]', '', str(v or '').upper())
pn_shape = lambda k: ''.join(('d' if m[0].isdigit() else 'a') + str(len(m)) for m in re.findall(r'[A-Z]+|\d+', k))
ALT = r'(?:Alternate|Old|Probiking\)) no\. ([A-Z0-9][A-Z0-9-]{4,})'
raw = open(cat, 'rb').read(); d = json.loads(raw)
cnt, firsts, bits = collections.Counter(), collections.defaultdict(set), bytearray(162)
for r in d['d']:
    alts = [pn_pk(m.group(1)) for m in re.finditer(ALT, str(r[8] or ''))]
    for j, k in enumerate([pn_pk(r[5]), ''] + alts):
        if not k: continue
        cnt[pn_shape(k)] += 1; firsts[pn_shape(k)].add(k[:2])
        for x, y in zip(k, k[1:]):
            n = PN_AL.index(x) * 36 + PN_AL.index(y); bits[n >> 3] |= 1 << (n & 7)
hero = [' '.join('%s:%d:%s' % (s, n, ''.join(sorted(firsts[s]))) for s, n in cnt.most_common()), base64.b64encode(bytes(bits)).decode()]
i = a.index('\nconst CAT_PNR={') + 1; j = a.index('\n', i)
line = a[i:j]
m = re.search(r"'Hero':\[[^\]]*\]", line); assert m
line = line[:m.start()] + "'Hero':" + json.dumps(hero, separators=(',', ':')).replace('"', "'") + line[m.end():]
a = a[:i] + line + a[j:]
a, n = re.subn(r'hero\.json [0-9a-f]{10}', 'hero.json ' + hashlib.sha1(raw).hexdigest()[:10], a); assert n == 1
sub1("matchAll(/(?:Alternate|Probiking\\)) no\\. ([A-Z0-9][A-Z0-9-]{4,})/g)", "matchAll(/(?:Alternate|Old|Probiking\\)) no\\. ([A-Z0-9][A-Z0-9-]{4,})/g)")
sub1("const catAlt=rem=>{if(!rem||!/no\\. /.test(rem))return null;", "const catAlt=rem=>{if(!rem||!/no\\. /.test(rem))return null;/* 'Old no. X' too (Hero, update 9l) */")
# SVG diagrams: drawn into a PNG at 2x their own size (a vector picture: no quality lost)
sub1("const png=!!b&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47;if(!b||!png&&(b[0]!==0xFF||b[1]!==0xD8))throw{code:'not_found'};",
     "if(b&&b[0]===0x3C&&/<svg[\\s>]/.test(new TextDecoder().decode(b.slice(0,400)))){CAT_PFOK=true;ok(await catSvgPng(b));return;}\n    const png=!!b&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47;if(!b||!png&&(b[0]!==0xFF||b[1]!==0xD8))throw{code:'not_found'};")
sub1("/* ASCII85 text (a picture stream inside a catalogue PDF)",
     "/* an SVG diagram (Hero's newest editions, update 9l) -> a PNG of it at twice its own size, white behind it */\n"
     "const catSvgPng=b=>new Promise((ok,no)=>{const u=URL.createObjectURL(new Blob([b],{type:'image/svg+xml'})),im=new Image();\n"
     " im.onload=()=>{try{const w=(im.naturalWidth||1447)*2,h=(im.naturalHeight||967)*2,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);URL.revokeObjectURL(u);\n"
     "  c.toBlob(p=>p?ok(URL.createObjectURL(p)):no({code:'not_found'}),'image/png');}catch(e){no({code:'not_found'});}};im.onerror=()=>{URL.revokeObjectURL(u);no({code:'not_found'});};im.src=u;});\n"
     "/* ASCII85 text (a picture stream inside a catalogue PDF)")
# clickable numbers: the server asks for the drawn page of an SVG diagram as it does for a PDF page
sub1("  const e=await hsApi(u,'&ocr=1');return {toks:e.toks||[],lo:e.lo||[],ed:e.ed||[],src:'ai',off:e.off,nf:e.nf};})();",
     "  let e=await hsApi(u,'&ocr=1');if(e.need==='img'){const b=await (await fetch(await catPf(u))).blob();e=await hsApi(u,'&ocr=1',{method:'POST',body:b,headers:{'Content-Type':b.type||'image/png'}});}\n"
     "  return {toks:e.toks||[],lo:e.lo||[],ed:e.ed||[],src:'ai',off:e.off,nf:e.nf};})();")
open(app, 'w', encoding='utf-8').write(a)
print('Hero CAT_PNR', len(cnt), 'shapes')
