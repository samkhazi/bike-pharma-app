"""Update 9d: Kannada and Hindi for the texts every screen still showed in English (Sam 2026-10-16: "by default english
rehna he lkn kannada aur hindi option denge hum"). English stays the default on every open.
TRX = text templates found by rendering every screen of Admin, customer and mechanic in KN and HI (tools/i18n/trx.json):
numbers, amounts, dates, times and codes in a text become {0}, {1}...; a text joined with " · " is translated part by part.
usage: python3 i18n9d.py public/app.html tools/i18n/trx.json"""
import sys, json
P, J = sys.argv[1], sys.argv[2]
a = open(P, encoding='utf-8').read()
if 'const TRX=' in a: raise SystemExit('already done')
trx = {k: v for k, v in json.load(open(J, encoding='utf-8')).items() if v[0] != k or v[1] != k}
def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:90]}')
    a = a.replace(old, new)
JS = ("const TRX=" + json.dumps(trx, ensure_ascii=False, separators=(',', ':')) + ";\n"
 "const TRX_TOK=/(₹[\\d,]+(?:\\.\\d+)?|\\b\\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?: \\d{4})?\\b|\\b\\d{1,2}:\\d\\d(?: ?[ap]m)?|\\b[A-Z][A-Z0-9]*-[A-Z0-9][A-Z0-9-]*\\b|\\+?\\b\\d[\\d,]*(?:\\.\\d+)?%?)/g;\n"
 "function trSeg(s,k){const t=s.trim();if(!t)return null;if(TR[t])return s.replace(t,()=>TR[t][k]);const v=[];const T=t.replace(TRX_TOK,m=>{v.push(m);return '{'+(v.length-1)+'}';});const x=TRX[T];if(!x)return trRe(t,k)==null?null:s.replace(t,()=>trRe(t,k));return s.replace(t,()=>x[k].replace(/\\{(\\d+)\\}/g,(_,i)=>v[+i]??''));}\n"
 "const TRX_RE=[[/^(.+) \\(aftermarket\\)$/,'$1 (ಆಫ್ಟರ್‌ಮಾರ್ಕೆಟ್)','$1 (आफ्टरमार्केट)'],[/^(.+): (\\d+) of (\\d+) files on the server(\\.?)(.*)$/,'$1: ಸರ್ವರ್‌ನಲ್ಲಿ $3 ರಲ್ಲಿ $2 ಫೈಲ್‌ಗಳು$4$5','$1: सर्वर पर $3 में से $2 फ़ाइलें$4$5'],[/^Choose the (.+) folder$/,'$1 ಫೋಲ್ಡರ್ ಆಯ್ಕೆಮಾಡಿ','$1 फ़ोल्डर चुनें'],[/^Welcome, (.+)$/,'ಸ್ವಾಗತ, $1','स्वागत है, $1'],[/^Your role \\((.+)\\) doesn’t include it\\. Ask your Admin if you need access\\.$/,'ನಿಮ್ಮ ಪಾತ್ರದಲ್ಲಿ ($1) ಇದು ಇಲ್ಲ. ಬೇಕಿದ್ದರೆ ನಿಮ್ಮ ಅಡ್ಮಿನ್ ಅನ್ನು ಕೇಳಿ.','आपके रोल ($1) में यह शामिल नहीं है। ज़रूरत हो तो अपने एडमिन से पूछें।'],[/^Open (.+) app$/,'$1 ಆಪ್ ತೆರೆಯಿರಿ','$1 ऐप खोलें'],[/^(.+) account$/,'$1 ಖಾತೆ','$1 अकाउंट']];\n"
 "function trRe(t,k){for(const [r,a,b] of TRX_RE){const m=t.match(r);if(m)return (k?b:a).replace(/\\$(\\d)/g,(_,i)=>{const x=m[+i]||'';if(+i!==1)return trSeg(x.trim(),k)!=null&&x.trim()?' '+trSeg(x.trim(),k):x;const y=trSeg(x,k);return y==null?x:y;});}return null;}\n"
 "function trAny(t,k){const r=trSeg(t,k);if(r!=null)return r;if(t.includes(' · ')){const j=t.split(' · ').map(x=>{const y=trSeg(x,k);return y==null?x:y;}).join(' · ');return j!==t?j:null;}return null;}\n")
sub("function translateVp(){", JS + "function translateVp(){")
sub("/[A-Za-z]{2}/.test(t)&&!(pe&&pe.closest('svg,style,script'))?trPat(t,k):null;",
    "/[A-Za-z]{2}/.test(t)&&!(pe&&pe.closest('svg,style,script'))?(trPat(t,k)||trAny(t,k)):null;")
sub("const t=e.getAttribute('placeholder');if(TR[t])e.setAttribute('placeholder',TR[t][k]);",
    "const t=e.getAttribute('placeholder');const v=TR[t]?TR[t][k]:trAny(t,k);if(v)e.setAttribute('placeholder',v);")
open(P, 'w', encoding='utf-8').write(a)
print('ok', len(trx))
