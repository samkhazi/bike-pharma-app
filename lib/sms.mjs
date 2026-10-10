// OTP delivery. OTP_MODE=fixed (test OTP for everyone, shown in the app), log (printed in the server log),
// msg91 (real SMS through MSG91: MSG91_AUTHKEY + MSG91_TEMPLATE_ID in .env).
export function otpConfig(env) {
  const mode = (env.OTP_MODE || 'fixed').toLowerCase();
  return { mode, fixed: env.OTP_FIXED || '123456', authkey: env.MSG91_AUTHKEY || '', template: env.MSG91_TEMPLATE_ID || '', sender: env.MSG91_SENDER || '' };
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
  return { ok: false, error: 'Unknown OTP_MODE ' + cfg.mode };
}
