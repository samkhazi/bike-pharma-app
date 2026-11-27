// The front door's small button on every panel (bottom right): who is signed in, switch panel, password, logins, sign out.
// Styles are set through element.style so the panels' Content-Security-Policy allows them.
'use strict';
(async () => {
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) });
  const out = () => post('/__gate/logout').finally(() => { window.top.location.href = '/__gate/login'; });
  const own = document.getElementById('out'); if (own) own.addEventListener('click', out);
  if (window.top !== window) return;                       // inside the one screen the shell has its own sign out etc.
  let me; try { const r = await fetch('/__gate/me'); if (!r.ok) return; me = await r.json(); } catch { return; }
  const css = (el, s) => { el.style.cssText = s; return el; };
  const el = (tag, s, txt) => { const e = css(document.createElement(tag), s); if (txt != null) e.textContent = txt; return e; };
  const font = 'font:600 13px "Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;';
  const box = el('div', 'position:fixed;right:12px;bottom:12px;z-index:2147483000;' + font);
  const btn = el('button', font + 'display:flex;gap:8px;align-items:center;padding:8px 12px;border-radius:99px;border:1px solid #F8C018;background:#262626;color:#fff;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)');
  btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
  btn.append(el('span', 'width:8px;height:8px;border-radius:50%;background:#F8C018'), el('span', '', `${me.name} · ${me.portalName || ''}`));
  const menu = el('div', 'display:none;position:absolute;right:0;bottom:44px;min-width:240px;max-height:70vh;overflow:auto;background:#fff;color:#1F1F1F;border:1px solid #E7E7E4;border-radius:12px;padding:6px;box-shadow:0 8px 28px rgba(0,0,0,.2)');
  const item = (txt, fn, on) => { const b = el('button', font + `display:block;width:100%;text-align:left;padding:9px 10px;border:0;border-radius:8px;cursor:pointer;background:${on ? '#FDF3D0' : 'transparent'};color:#1F1F1F`, txt);
    b.type = 'button'; b.addEventListener('click', fn); menu.append(b); };
  menu.append(el('div', 'padding:8px 10px;color:#6B6B6B;font-weight:500', me.email));
  if (me.panels.length > 1) {
    menu.append(el('div', 'padding:6px 10px 2px;font-size:11px;color:#6B6B6B;text-transform:uppercase;letter-spacing:.05em', 'Open panel'));
    for (const p of me.panels) item((p.key === me.portal ? '✓ ' : '') + p.name, () => post('/__gate/switch', { portal: p.key }).then(() => { location.href = '/'; }), p.key === me.portal);
    menu.append(el('hr', 'border:0;border-top:1px solid #E7E7E4;margin:6px 0'));
  }
  if (me.owner) item('Logins (who opens which panel)', () => { location.href = '/__gate/logins'; });
  item('Change my password', async () => {
    const old = prompt('Your current password'); if (!old) return;
    const pw = prompt('New password (at least 8 letters or numbers)'); if (!pw) return;
    const r = await post('/__gate/password', { old, password: pw }); const d = await r.json().catch(() => ({}));
    alert(r.ok ? 'Password changed.' : d.error || 'Could not change it.');
  });
  item('Sign out', out);
  btn.addEventListener('click', () => { const open = menu.style.display === 'none'; menu.style.display = open ? 'block' : 'none'; btn.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', e => { if (!box.contains(e.target)) { menu.style.display = 'none'; btn.setAttribute('aria-expanded', 'false'); } });
  box.append(menu, btn);
  document.body.append(box);
})();
