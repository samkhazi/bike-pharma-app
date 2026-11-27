// Signs in (phone + 4-digit PIN), loads the data from the server and starts the inventory.
(function () {
  const root = document.getElementById('root');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function start() {
    let r;
    try { r = await fetch('/api/state'); } catch (e) { return fail('Cannot reach the server. Check the internet and reload.'); }
    if (r.status === 401) return login();
    if (!r.ok) return fail('The server had a problem loading the data. Reload the page.');
    const d = await r.json();
    window.startInv(d);
  }

  function fail(msg) {
    root.innerHTML = `<div class="login"><div class="box"><section class="card" style="padding:28px;gap:12px"><b>${esc(msg)}</b><button class="btn pri" id="again">Reload</button></section></div></div>`;
    document.getElementById('again').onclick = () => location.reload();
  }

  function login(err, phone) {
    root.innerHTML = `<div class="login"><div class="box"><div class="logo"><img src="logo.svg" alt="Bike Surgeon" style="width:100%;max-width:260px"></div>
 <form class="card" id="lf" style="width:100%;padding:28px;gap:18px" novalidate><div class="cell2" style="gap:4px"><h1 style="font-size:20px;font-weight:800">Inventory sign in</h1><span class="muted">Bike Surgeon · The Moto Lab</span></div>
 <label class="field" for="lp">Phone number<input class="inp" id="lp" inputmode="tel" autocomplete="username" value="${esc(phone || '')}" placeholder="98450 12233"></label>
 <div class="field">4-digit PIN<div class="pins">${[0, 1, 2, 3].map(i => `<input id="pin${i}" maxlength="1" inputmode="numeric" type="password" aria-label="PIN digit ${i + 1}" autocomplete="off">`).join('')}</div></div>
 <div id="loginErr" class="muted" ${err ? '' : 'hidden'} style="color:var(--redT);font-weight:700">${esc(err || '')}</div>
 <button class="btn pri" type="submit" data-act="login" style="padding:12px">Sign in</button></form></div></div>`;
    const pins = [0, 1, 2, 3].map(i => document.getElementById('pin' + i));
    const form = document.getElementById('lf');
    pins.forEach((p, i) => {
      p.addEventListener('input', () => { p.value = p.value.replace(/\D/g, '').slice(0, 1); if (p.value && i < 3) pins[i + 1].focus(); if (p.value && i === 3) form.requestSubmit(); });
      p.addEventListener('keydown', e => { if (e.key === 'Backspace' && !p.value && i > 0) pins[i - 1].focus(); });
    });
    (phone ? pins[0] : document.getElementById('lp')).focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const ph = document.getElementById('lp').value, pin = pins.map(p => p.value).join('');
      if (ph.replace(/\D/g, '').length < 10) return login('Enter your 10-digit phone number.', ph);
      if (pin.length < 4) return login('Enter all 4 digits of the PIN.', ph);
      try {
        const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: ph, pin }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return login(d.error || 'Could not sign in.', ph);
        start();
      } catch (x) { login('Cannot reach the server. Check the internet.', ph); }
    });
  }

  start();
})();
