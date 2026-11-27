// The one screen (Sam, 5 Nov): after sign in a person never picks a panel. Every panel of their login opens here in a frame
// (/p/<key>/), the panel's own sidebar is hidden (inshell.css) and its menu items are shown together in this one menu.
// A click on an item shows that panel and clicks the same item inside it, so each panel keeps working exactly as before.
'use strict';
(async () => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) });
  const toLogin = () => { location.href = '/__gate/login'; };
  let me;
  try { const r = await fetch('/__gate/me', { cache: 'no-store' }); if (r.status === 401) return toLogin(); me = await r.json(); }
  catch { $('groups').innerHTML = '<p class="wait">Cannot reach the server. Check the internet and reload.</p>'; return; }

  // short names for the menu headings
  const NAMES = { admin: 'Admin', cashier: 'Cashier', floor: 'Service floor', maintainer: 'Service spares', desk: 'Workshop desk', accounts: 'Accounts',
    counter: 'Counter', spares: 'Spares manager', supervisor: 'Supervisor', motolab: 'The Moto Lab', inventory: 'Inventory' };
  // the person's own panel first, the shared Inventory after it
  const list = me.panels.slice().sort((a, b) => (a.key === 'inventory') - (b.key === 'inventory'));
  const G = list.map(p => ({ key: p.key, name: NAMES[p.key] || p.name, items: [], frame: null, state: 'wait', shut: false, obs: null, t: 0 }));
  const byKey = k => G.find(g => g.key === k);
  const LAST = 'bs-last-' + me.email;
  let last = null; try { last = JSON.parse(localStorage.getItem(LAST) || 'null'); } catch { /* private window */ }
  let cur = (last && byKey(last.key) ? last.key : G[0] && G[0].key) || '';
  if (G.length > 3) G.forEach(g => { g.shut = g.key !== cur; });

  $('who').textContent = me.owner ? 'Owner · everything in one place' : 'Your pages';
  $('mename').textContent = me.name; $('memail').textContent = me.email;
  $('av').textContent = (String(me.name || '').match(/[A-Za-z]+/g) || ['?']).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (me.owner) $('logins').hidden = false;

  // ---- the panels in frames ------------------------------------------------------------------------------------------
  let logoDone = false;
  const docOf = g => { try { return g.frame && g.frame.contentDocument; } catch { return null; } };
  function makeFrame(g) {
    if (g.frame) return;
    const f = document.createElement('iframe');
    f.title = g.name; f.src = `/p/${g.key}/`;
    f.addEventListener('load', () => watch(g));
    g.frame = f; $('frames').append(f);
    if (g.key === cur) f.classList.add('show');
  }
  function watch(g) {
    const d = docOf(g);
    if (!d || !d.location || d.location.pathname.startsWith('/__gate/')) return toLogin();
    if (g.obs) g.obs.disconnect();
    g.state = 'load'; read(g);
    g.obs = new MutationObserver(() => { clearTimeout(g.t); g.t = setTimeout(() => read(g), 120); });
    g.obs.observe(d.body || d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // a page without a menu after a while = a problem page (the panel is down or its PIN is wrong)
    setTimeout(() => { if (!g.items.length) { g.state = 'bad'; g.msg = ((docOf(g) || {}).body || {}).innerText || ''; draw(); } }, 12000);
  }
  // the panel's own menu: <aside class="side"> <nav class="navg"> <h4>group</h4> <button class="nav [on]"> icon <span>label</span> <span class="badge">
  function read(g) {
    const d = docOf(g); if (!d) return;
    const items = [];
    d.querySelectorAll('aside.side nav.navg').forEach((nav, ni) => {
      const h = nav.querySelector('h4'); const sub = h ? h.textContent.trim() : '';
      nav.querySelectorAll('.nav').forEach((b, bi) => {
        const label = (b.querySelector('span:not(.badge)') || b).textContent.trim(); if (!label) return;
        const badge = b.querySelector('.badge');
        const svg = b.querySelector('svg');
        items.push({ ni, bi, sub, label, on: b.classList.contains('on'), badge: badge ? badge.textContent.trim() : '', blink: !!(badge && badge.classList.contains('blink')),
          icon: svg ? svg.innerHTML : '' });
      });
    });
    // the panels draw the logo in white for the dark menu: use the same one here
    if (!logoDone) { const svg = d.querySelector('aside.side .brand svg'); if (svg) { logoDone = true; ['lg1', 'lg2'].forEach(id => { $(id).innerHTML = svg.outerHTML; }); $('lg2').firstChild.removeAttribute('class'); } }
    const sig = JSON.stringify(items);
    if (items.length) g.state = 'ok';
    if (sig !== g.sig) { g.sig = sig; g.items = items; draw(); }
  }
  function open(g, it) {
    show(g.key);
    const d = docOf(g);
    if (d && it) {
      const navs = d.querySelectorAll('aside.side nav.navg');
      let b = navs[it.ni] && navs[it.ni].querySelectorAll('.nav')[it.bi];
      const lab = x => (x.querySelector('span:not(.badge)') || x).textContent.trim();
      if (!b || lab(b) !== it.label) b = [...d.querySelectorAll('aside.side nav.navg .nav')].find(x => lab(x) === it.label);
      if (b) b.click();
      try { localStorage.setItem(LAST, JSON.stringify({ key: g.key, label: it.label })); } catch { /* private window */ }
    }
    closeMenu();
    setTimeout(() => read(g), 60);
  }
  function show(key) {
    cur = key;
    G.forEach(g => { if (g.key === key) makeFrame(g); if (g.frame) g.frame.classList.toggle('show', g.key === key); });
    draw();
  }
  // A panel asks for a popup while it is not the one on screen (Inventory: new stock waiting for the manager's price).
  // The popup shows here, over everything; Open shows that panel on the asked page.
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.bsNag) return;
    const g = G.find(x => x.frame && x.frame.contentWindow === e.source); if (!g || g.key === cur) return;
    const n = e.data.bsNag, old = document.getElementById('bsnag'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'bsnag';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,15,15,.5);display:flex;align-items:flex-start;justify-content:center;padding:80px 16px 16px;z-index:9999';
    el.innerHTML = `<div role="alertdialog" aria-labelledby="bsnag-h" style="background:#fff;color:#111;border-radius:20px;width:480px;max-width:100%;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.3);font:15px/1.45 system-ui,sans-serif">
      <h2 id="bsnag-h" style="font-size:18px;margin:0 0 10px">${esc(String(n.title || ''))}</h2><p style="margin:0 0 16px">${esc(String(n.text || ''))}</p>
      <button type="button" id="bsnag-go" style="background:#FFC400;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer">${esc(String(n.button || 'Open'))}</button>
      <button type="button" id="bsnag-x" style="background:#fff;border:1px solid #ccc;border-radius:10px;padding:10px 16px;margin-left:8px;cursor:pointer">Later</button></div>`;
    document.body.appendChild(el);
    el.querySelector('#bsnag-x').onclick = () => el.remove();
    el.querySelector('#bsnag-go').onclick = () => { el.remove(); show(g.key); try { g.frame.contentWindow.postMessage({ bsGo: n.route }, location.origin); } catch { /* frame gone */ } };
  });

  // ---- the menu --------------------------------------------------------------------------------------------------------
  const num = s => { const m = String(s).match(/\d+/); return m && !/\//.test(s) ? Number(m[0]) : 0; };
  function draw() {
    const html = G.map((g, gi) => {
      const sum = g.items.reduce((t, x) => t + num(x.badge), 0);
      let body = '';
      if (g.state === 'bad' && !g.items.length) body = `<p class="wait">${esc(g.msg ? g.msg.slice(0, 160) : 'This part did not open.')}</p><button type="button" class="it" data-re="${gi}">Try again</button>`;
      else if (!g.items.length) body = '<p class="wait">Loading…</p>';
      else {
        let sub = null;
        body = g.items.map((x, ii) => {
          const head = x.sub && x.sub !== sub && !/^(menu|main)$/i.test(x.sub) ? `<div class="sub">${esc(x.sub)}</div>` : ''; sub = x.sub;
          const on = g.key === cur && x.on;
          return `${head}<button type="button" class="it ${on ? 'on' : ''}" data-g="${gi}" data-i="${ii}" ${on ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${x.icon}</svg><span>${esc(x.label)}</span>${x.badge ? `<span class="badge ${x.blink ? 'blink' : ''}">${esc(x.badge)}</span>` : ''}</button>`;
        }).join('');
      }
      const head = G.length > 1 ? `<button type="button" class="gh" data-sh="${gi}" aria-expanded="${!g.shut}"><span>${esc(g.name)}</span>${g.shut && sum ? `<span class="sum">${sum}</span>` : ''}<span class="arr">▾</span></button>` : '';
      return `<section class="grp ${g.shut ? 'shut' : ''}">${head}<div class="items">${body}</div></section>`;
    }).join('');
    const box = $('groups'), top = $('menu').scrollTop;
    box.innerHTML = html; $('menu').scrollTop = top;
    const g = byKey(cur), on = g && g.items.find(x => x.on);
    $('mtitle').textContent = on ? on.label : g ? g.name : 'Bike Surgeon';
    document.title = (on ? on.label + ' · ' : '') + 'Bike Surgeon';
  }
  $('groups').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sh != null) { const g = G[+b.dataset.sh]; g.shut = !g.shut; makeFrame(g); draw(); return; }
    if (b.dataset.re != null) { const g = G[+b.dataset.re]; g.state = 'wait'; g.items = []; g.sig = ''; if (g.frame) g.frame.src = `/p/${g.key}/`; draw(); return; }
    if (b.dataset.g != null) { const g = G[+b.dataset.g]; open(g, g.items[+b.dataset.i]); }
  });

  // phone: the menu slides in
  const sh = document.querySelector('.sh');
  const closeMenu = () => { sh.classList.remove('open'); $('burger').setAttribute('aria-expanded', 'false'); };
  $('burger').addEventListener('click', () => { const o = !sh.classList.contains('open'); sh.classList.toggle('open', o); $('burger').setAttribute('aria-expanded', String(o)); });
  $('shade').addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); $('mepop').hidden = true; } });

  // sign out, password, logins
  $('mebtn').addEventListener('click', () => { const p = $('mepop'); p.hidden = !p.hidden; $('mebtn').setAttribute('aria-expanded', String(!p.hidden)); });
  document.addEventListener('click', e => { if (!e.target.closest('.me')) $('mepop').hidden = true; });
  $('out').addEventListener('click', () => post('/__gate/logout').finally(toLogin));
  $('logins').addEventListener('click', () => { location.href = '/__gate/logins'; });
  $('pw').addEventListener('click', async () => {
    const old = prompt('Your current password'); if (!old) return;
    const pw = prompt('New password (at least 8 letters or numbers)'); if (!pw) return;
    const r = await post('/__gate/password', { old, password: pw }); const d = await r.json().catch(() => ({}));
    alert(r.ok ? 'Password changed.' : d.error || 'Could not change it.');
  });

  // signed out somewhere else (or the login switched off): the whole screen goes to sign in, not a panel's own PIN page
  const still = () => fetch('/__gate/me', { cache: 'no-store' }).then(r => { if (r.status === 401) toLogin(); }, () => {});
  setInterval(still, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) still(); });

  // start: the last page first, the other panels a moment later (their menus fill in as they load)
  draw();
  const first = byKey(cur);
  if (first) {
    makeFrame(first);
    if (last && last.key === cur) first.frame.addEventListener('load', () => {
      let n = 0; const go = () => { const it = first.items.find(x => x.label === last.label);
        if (it) { if (!it.on) open(first, it); } else if (++n < 30) setTimeout(go, 300); };
      setTimeout(go, 300);
    }, { once: true });
  }
  // the other panels one after another, each when the one before has loaded (or after 2.5 s), so they do not slow the open page
  const queue = G.filter(g => g !== first);
  const next = () => { const g = queue.shift(); if (!g) return; if (g.frame) return next();
    makeFrame(g); let done = false; const go = () => { if (!done) { done = true; next(); } };
    g.frame.addEventListener('load', () => setTimeout(go, 150), { once: true }); setTimeout(go, 2500); };
  if (first && first.frame) { let started = false; const begin = () => { if (!started) { started = true; next(); } };
    first.frame.addEventListener('load', () => setTimeout(begin, 300), { once: true }); setTimeout(begin, 3000); }
  else next();
})();
