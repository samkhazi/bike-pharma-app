"""Update 10t: real OTP by SMS (Sam 2026-10-22 "real OTP ... renflair ... auto fill").
- The OTP boxes take a whole code at once: the phone keyboard's OTP suggestion (iPhone, Android Gboard), paste, or Chrome on
  Android reading the SMS itself (WebOTP, only when the SMS ends with "@bikepharma.com #123456").
- 3 wrong tries (was 5), then Resend OTP. The fake "Try WhatsApp" link is gone (nothing was sent on WhatsApp).
usage: python3 otp10t.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function otpPut' in a: raise SystemExit('already done')

def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:80]}')
    a = a.replace(old, new)

sub("""${[0,1,2,3,4,5].map(i=>`<input id="otp${i}" inputmode="numeric" maxlength="1" aria-label="Digit ${i+1}" oninput="otpIn(this,${i})" onkeydown="otpKey(event,${i})">`).join('')}</div>""",
    """${[0,1,2,3,4,5].map(i=>`<input id="otp${i}" inputmode="numeric" ${i?'maxlength="1" autocomplete="off"':'maxlength="6" autocomplete="one-time-code"'} aria-label="Digit ${i+1}" oninput="otpIn(this,${i})" onkeydown="otpKey(event,${i})">`).join('')}</div>${otpWebSoon()}""")
sub("""(S.ui.otpTries||0)>=5?`<div class="row cap" style="background:var(--r-soft);color:var(--r);border-radius:12px;padding:10px;gap:8px">${ic('lock','s16')}<span class="grow">Too many wrong tries. For your safety this login is paused for 15 minutes.</span></div>`:''}
 <button class="btn" onclick="verify()" ${(S.ui.otpTries||0)>=5?'disabled':''}>""",
    """(S.ui.otpTries||0)>=3?`<div class="row cap" style="background:var(--r-soft);color:var(--r);border-radius:12px;padding:10px;gap:8px">${ic('lock','s16')}<span class="grow">Too many wrong tries. Tap Resend OTP to get a new one.</span></div>`:''}
 <button class="btn" onclick="verify()" ${(S.ui.otpTries||0)>=3?'disabled':''}>""")
sub("""function otpIn(el,i){el.value=el.value.replace(/\\D/g,'').slice(0,1);if(el.value&&i<5)document.getElementById('otp'+(i+1)).focus();if(i===5&&el.value)verify();}""",
    """function otpIn(el,i){const v=el.value.replace(/\\D/g,'');if(v.length>1)return otpPut(v.slice(0,6),i);el.value=v;if(el.value&&i<5)document.getElementById('otp'+(i+1)).focus();if(i===5&&el.value)verify();}
// a whole code at once (phone keyboard OTP suggestion, paste, Android reading the SMS): spread it over the boxes and verify
function otpPut(v,i){if(v.length===6)i=0;v.split('').slice(0,6-i).forEach((d,k)=>{const e=document.getElementById('otp'+(i+k));if(e)e.value=d;});
 const last=document.getElementById('otp'+Math.min(5,i+v.length-1));if(last)last.focus();
 if([0,1,2,3,4,5].every(k=>(document.getElementById('otp'+k)||{}).value)){clearTimeout(window._otpT);window._otpT=setTimeout(verify,150);}}
// Chrome on Android reads the OTP from the SMS by itself when the SMS ends with "@bikepharma.com #123456" (WebOTP)
function otpWebSoon(){if(!SRV.cfg.otpHint&&'OTPCredential' in window&&window._woFor!==S.ui.pending){window._woFor=S.ui.pending;setTimeout(otpWeb,0);}return '';}
function otpWeb(){try{if(window._woAc)window._woAc.abort();const ac=window._woAc=new AbortController();setTimeout(()=>ac.abort(),5*60e3);
 navigator.credentials.get({otp:{transport:['sms']},signal:ac.signal}).then(c=>{if(c&&/^\\d{6}$/.test(c.code||'')&&cur().s==='otp'&&document.getElementById('otp0'))otpPut(c.code,0);}).catch(()=>{});}catch(e){}}""")
sub("""`Didn’t get it? <button class="link" onclick="resendOtp()">Resend OTP</button> · <button class="link" onclick="S.ui.otpCh=(S.ui.otpCh==='WhatsApp'?'SMS':'WhatsApp');S.ui.otpSent=Date.now();toast('OTP sent on '+S.ui.otpCh);refresh()">Try ${S.ui.otpCh==='WhatsApp'?'SMS':'WhatsApp'}</button>`""",
    """`Didn’t get it? <button class="link" onclick="resendOtp()">Resend OTP</button>`""")
sub("""if((S.ui.otpTries||0)>=5)return;""", """if((S.ui.otpTries||0)>=3)return;""")
# a new OTP (Resend) also lets Android read the new SMS
sub("""S.ui.otpSent=Date.now();S.ui.otpTries=0;S.ui.otpErr=null;toast('New OTP sent');refresh();""",
    """S.ui.otpSent=Date.now();S.ui.otpTries=0;S.ui.otpErr=null;window._woFor=null;[0,1,2,3,4,5].forEach(k=>{const e=document.getElementById('otp'+k);if(e)e.value='';});toast('New OTP sent');refresh();""")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
