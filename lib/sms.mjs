// OTP delivery. OTP_MODE=fixed (test OTP for everyone, shown in the app), log (printed in the server log),
// renflair (real SMS through Renflair: RENFLAIR_API_KEY in .env; RENFLAIR_URL only if Renflair gives a different link),
// msg91 (real SMS through MSG91: MSG91_AUTHKEY + MSG91_TEMPLATE_ID in .env).
// A RENFLAIR_API_KEY in .env turns real SMS on by itself (unless OTP_MODE=log or msg91).
export const RENFLAIR_URL = 'https://sms.renflair.in/V1.php?API={key}&PHONE={phone}&OTP={otp}';
export function otpConfig(env) {
  let mode = (env.OTP_MODE || 'fixed').toLowerCase();
  const rfKey = (env.RENFLAIR_API_KEY || '').trim();
  if (rfKey && mode !== 'log' && mode !== 'msg91') mode = 'renflair';
  return { mode, real: mode === 'renflair' || mode === 'msg91', fixed: env.OTP_FIXED || '123456', authkey: env.MSG91_AUTHKEY || '', template: env.MSG91_TEMPLATE_ID || '', sender: env.MSG91_SENDER || '',
    rfKey, rfUrl: (env.RENFLAIR_URL || '').trim() || RENFLAIR_URL };
}
// the Renflair link with the key, number and OTP filled in ({key} {phone} {otp}; {phone91} = 91 + number)
export function renflairUrl(cfg, mobile, code) {
  const e = encodeURIComponent;
  return cfg.rfUrl.replace(/\{key\}/g, e(cfg.rfKey)).replace(/\{phone91\}/g, '91' + mobile).replace(/\{phone\}/g, mobile).replace(/\{otp\}/g, code);
}
export function makeOtp(cfg) {
  if (cfg.mode === 'fixed') return cfg.fixed;
  return String(Math.floor(100000 + Math.random() * 900000));
}
export async function deliverOtp(cfg, mobile, code) {
  if (cfg.mode === 'fixed') return { ok: true };
  if (cfg.mode === 'log') { console.log(`[otp] ${mobile} -> ${code}`); return { ok: true }; }
  if (cfg.mode === 'msg91') {
    if (!cfg.authkey || !cfg.template) return { ok: false, error: 'MSG91 is not configured' };
    const u = new URL('https://control.msg91.com/api/v5/otp');
    u.searchParams.set('template_id', cfg.template); u.searchParams.set('mobile', '91' + mobile); u.searchParams.set('otp', code); u.searchParams.set('otp_expiry', '10');
    try {
      const r = await fetch(u, { method: 'POST', headers: { authkey: cfg.authkey, 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.type === 'success') return { ok: true };
      console.error('[otp] msg91 failed', r.status, j);
      return { ok: false, error: 'SMS could not be sent' };
    } catch (e) { console.error('[otp] msg91 error', e.message); return { ok: false, error: 'SMS could not be sent' }; }
  }
  if (cfg.mode === 'renflair') {
    if (!cfg.rfKey) return { ok: false, error: 'SMS is not set up yet' };
    try {
      const r = await fetch(renflairUrl(cfg, mobile, code), { signal: AbortSignal.timeout(15e3) });
      const t = (await r.text().catch(() => '')).slice(0, 300);
      if (r.ok && !/fail|error|invalid|insufficient|unauthori[sz]ed|denied/i.test(t)) return { ok: true };
      console.error('[otp] renflair failed', r.status, t.replace(cfg.rfKey, '***'));
      return { ok: false, error: 'SMS could not be sent. Please try again in a minute.' };
    } catch (e) { console.error('[otp] renflair error', e.message); return { ok: false, error: 'SMS could not be sent. Please try again in a minute.' }; }
  }
  return { ok: false, error: 'Unknown OTP_MODE ' + cfg.mode };
}
