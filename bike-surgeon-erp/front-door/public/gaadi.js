// Vehicle number page (Sam 27 Nov, "VR Garage in job card + billing counter"): a number gives VR Garage's chassis, model,
// engine number and owner (asked once, kept for ever), the job cards of that vehicle in the billing, and the latest job
// cards with their vehicle. The customer name and the model can be changed here.
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isReg = s => s.length >= 6 && (/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(s) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(s));
  const show = r => { const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(r); return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : r; };
  const fmtPh = p => (p && p.length === 10 ? p.slice(0, 5) + ' ' + p.slice(5) : p || '');
  const when = iso => { const d = new Date(iso || ''); return isNaN(d) ? '' : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const toLogin = () => { try { window.top.location.href = '/__gate/login'; } catch { location.href = '/__gate/login'; } };
  async function call(u, opt) {
    const r = await fetch(u, { cache: 'no-store', ...opt });
    if (r.status === 401) { toLogin(); throw new Error('Please sign in again.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
    return d;
  }
  const post = (u, b) => call(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) });

  let me = { owner: false }, cur = null, vr = null, link = null, busy = false;

  // ---- the note at the top: VR Garage not connected, not answering, the billing not read ------------------------------
  function notes() {
    const n = [];
    if (vr && !vr.on) n.push(me.owner ? 'VR Garage is not connected yet. Once, on the server as root: <code>bash /root/bs-erp-update.sh vrgarage</code> (it asks the VR Garage login and password there; never send them in a chat). The job cards of each vehicle show already.'
      : 'VR Garage is not connected yet: the job cards of each vehicle show already. The owner connects VR Garage.');
    else if (vr && vr.err) n.push(me.owner ? `VR Garage: ${esc(vr.err)}` : 'VR Garage is not answering just now. Try again in a minute.');
    if (link && link.on && !link.ok && link.at) n.push(me.owner ? `The billing's job cards could not be read just now: ${esc(link.err)}` : 'The job cards could not be read just now.');
    else if (link && !link.on) n.push(me.owner ? 'The billing\'s job cards are not connected here yet: run the update on the server.' : 'The job cards are not connected yet.');
    $('vrnote').hidden = !n.length; $('vrnote').innerHTML = n.join('<br>');
    if (me.owner && vr && vr.on && vr.today != null) { $('stat').hidden = false; $('stat').textContent = `VR Garage searches: ${vr.today} today · ${vr.month} this month · ${vr.saved} vehicles kept`; }
  }

  // ---- one vehicle -------------------------------------------------------------------------------------------------------
  const F = (label, v, mono, copy) => (v ? `<div class="f"><small>${label}</small>${copy ? `<div class="cp"><span class="mono">${esc(v)}</span><button type="button" class="btn sm" data-copy="${esc(v)}">Copy</button></div>` : `<span class="${mono ? 'mono' : ''}">${esc(v)}</span>`}</div>` : '');
  function vehicle(v) {
    const s = v.saved, d = (s && s.d) || {}, h = v.history || [], last = h[0], look = v.look || {};
    const found = !!s && s.found === 1, asked = !!s && s.found != null;
    const vrModel = d.model || '', jcModel = last ? last.model : '';
    const model = (s && s.model) || vrModel || jcModel, name = (s && s.name) || d.owner || (last ? last.cust : '');
    let src;
    if (found) src = `<span class="pill g">From VR Garage</span><span class="src">asked ${esc(when(s.at))}${s.by ? ' for ' + esc(s.by) : ''}; kept here, never asked again</span>`;
    else if (s && s.found === 0) src = `<span class="pill">Not in VR Garage</span><span class="src">VR Garage has no record of this number (asked ${esc(when(s.at))}). Check the number on the RC.</span>`;
    else if (s && s.found === 2) src = `<span class="pill o">VR Garage answered</span><span class="src">${me.owner ? `but its answer could not be read here. Send a screenshot of this: it is fixed without a new search.${s.fields && s.fields.length ? ' Fields: ' + esc(s.fields.join(', ')) : ''}` : 'The details show after a small fix (no new search).'}</span>`;
    else if (look.state === 'error') src = `<span class="pill r">VR Garage problem</span><span class="src">${esc(look.msg)}. Try again in a minute.</span>`;
    else if (look.state === 'cap') src = `<span class="pill o">Limit</span><span class="src">${esc(look.msg)}</span>`;
    else if (!v.vr.on) src = `<span class="pill">VR Garage not connected</span><span class="src">${me.owner ? 'Connect it once on the server (see above).' : 'The owner connects VR Garage.'}</span>`;
    else src = `<span class="pill">Not asked yet</span><button type="button" class="btn sm pri" data-ask="${esc(v.no)}">Ask VR Garage</button><span class="src">one search for this vehicle, then it is kept</span>`;
    const again = me.owner && s && (s.found === 0 || s.found === 2) ? `<button type="button" class="btn sm" data-again="${esc(v.no)}">Ask VR Garage again</button>` : '';
    const hint = (a, b, what) => (a && b && a.toUpperCase() !== b.toUpperCase() ? `<span class="hint">${what}: ${esc(b)}</span>` : '');
    const ins = [d.insurer, d.insUpto && 'up to ' + d.insUpto].filter(Boolean).join(', ');
    const grid = [F('Maker', d.maker), F('Chassis no.', d.chassis, true, true), F('Engine no.', d.engine, true, true), F('Year', d.year || d.mfg), F('Registered on', d.regDate),
      F('Fuel', d.fuel), F('Colour', d.colour), F('CC', d.cc), F('Class', d.category), F('Insurance', ins), F('PUC up to', d.pucUpto), F('RC status', d.status), F('Owner (RC)', d.owner)].join('');
    const hist = h.length ? `<div class="list hist">${h.map(j => `<div class="li"><span class="c"><b>${esc(j.date || '—')}</b><small>Job card ${esc(j.jc)}${j.st ? ' · ' + esc(j.st.toLowerCase()) : ''}</small></span>
        <span class="c"><b>${esc(j.cust || '—')}</b><small>${esc(fmtPh(j.ph))}</small></span><span class="c"><span>${esc(j.model || '—')}</span></span></div>`).join('')}</div>`
      : '<p class="muted">No job card of this vehicle in the billing yet.</p>';
    return `<section class="card">
      <div class="head"><span class="plate lg">${esc(v.show)}</span><div class="what"><b>${esc(model || 'Model not known yet')}</b><span class="muted">${esc(name || '')}</span></div></div>
      <div class="head" style="gap:8px">${src}${again}</div>
      <form class="edit" id="ed" data-no="${esc(v.no)}">
        <label>Model<input id="emodel" maxlength="80" value="${esc(model)}" placeholder="e.g. Honda CB Shine">${hint(model, vrModel, 'VR Garage')}${hint(model, jcModel, 'Last job card')}</label>
        <label>Customer name<input id="ename" maxlength="80" value="${esc(name)}" placeholder="Name">${hint(name, d.owner, 'RC owner')}${hint(name, last && last.cust, 'Last job card')}</label>
        <button type="submit" class="btn pri" id="esave">Save</button>
      </form>
      <small class="muted" id="emsg">${s && s.editedBy ? `Name and model saved by ${esc(s.editedBy)}, ${esc(when(s.editedAt))}` : found ? 'Change the name or the model if the customer says so: it is kept for this vehicle.' : ''}</small>
      ${grid ? `<div class="grid">${grid}</div>` : ''}
      <div class="card-h"><h2>Job cards of this vehicle</h2><small class="muted">${h.length ? `${v.visits} in the billing${v.visits > h.length ? `, newest ${h.length}` : ''}` : ''}</small></div>
      ${hist}
    </section>`;
  }
  function draw() { $('out').innerHTML = cur ? vehicle(cur) : ''; notes(); }

  async function open(no, look) {
    const r = clean(no);
    if (!isReg(r)) { $('out').innerHTML = '<section class="card"><p class="err">Type the full vehicle number, like KA17AB1234.</p></section>'; return; }
    if (busy) return; busy = true; $('go').disabled = true;
    $('out').innerHTML = `<section class="card"><div class="wait"><span class="spin"></span><span>${look ? `Looking for <b>${esc(show(r))}</b>… (VR Garage can take up to 20 seconds)` : 'Loading…'}</span></div></section>`;
    try {
      const v = await call(`/__gate/api/vehicle?no=${encodeURIComponent(r)}${look ? '&look=1' : ''}`);
      cur = v; vr = v.vr; link = v.link; draw();
      if (location.hash.slice(1) !== r) history.replaceState(null, '', '#' + r);
      if (look) refresh();
    } catch (e) { $('out').innerHTML = `<section class="card"><p class="err">${esc(e.message)}</p></section>`; }
    finally { busy = false; $('go').disabled = false; }
  }

  // ---- the latest job cards ------------------------------------------------------------------------------------------------
  function vrCell(c) {
    const x = c.vr || {};
    if (x.st === 'found') return `<b>${esc(x.model || '—')}</b><span class="mono">${x.chassis ? 'Chassis ' + esc(x.chassis) : ''}${x.chassis && x.engine ? ' · ' : ''}${x.engine ? 'Engine ' + esc(x.engine) : ''}</span>`;
    if (x.st === 'wait') return '<span><span class="pill o">Asking VR Garage</span></span>';
    if (x.st === 'notfound') return '<span><span class="pill">Not in VR Garage</span></span>';
    if (x.st === 'unread') return '<span><span class="pill o">VR Garage answered</span></span>';
    if (x.st === 'off') return '<span><span class="pill">VR Garage not connected</span></span>';
    if (x.st === 'bad') return '<span><span class="pill r">Number not complete</span></span>';
    return '<span class="muted">Older job card: tap to see</span>';
  }
  let lastSig = '';
  async function refresh() {
    try {
      const d = await call('/__gate/api/vehicle/recent');
      vr = d.vr; link = d.link; notes();
      const sig = JSON.stringify(d.cards);
      if (sig === lastSig) return; lastSig = sig;
      $('rlist').innerHTML = d.cards.length ? d.cards.map(c => `<button type="button" class="li" data-no="${esc(c.valid ? c.plate : '')}" ${c.valid ? '' : 'disabled'}>
          <span class="c"><span><span class="plate">${esc(c.valid ? show(c.plate) : c.plate || '—')}</span></span><small>Job card ${esc(c.jc)} · ${esc(c.date)}</small></span>
          <span class="c"><b>${esc(c.cust || '—')}</b><small>${esc(c.model)}${c.ph ? ' · ' + esc(fmtPh(c.ph)) : ''}</small></span>
          <span class="vr">${vrCell(c)}</span></button>`).join('')
        : `<p class="muted">${d.link && d.link.ok ? 'No job card in the billing yet.' : 'The job cards show here once the billing is read.'}</p>`;
    } catch (e) { if (!lastSig) $('rlist').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  // ---- events ----------------------------------------------------------------------------------------------------------------
  $('no').addEventListener('input', e => { const t = e.target, v = t.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''); if (v !== t.value) t.value = v; });
  $('f').addEventListener('submit', e => { e.preventDefault(); open($('no').value, true); });
  $('rlist').addEventListener('click', e => { const b = e.target.closest('button[data-no]'); if (b && b.dataset.no) { $('no').value = show(b.dataset.no); open(b.dataset.no, false); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  $('out').addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      const t = c.dataset.copy;
      try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch { /* not allowed */ } a.remove(); }
      c.textContent = 'Copied'; setTimeout(() => { c.textContent = 'Copy'; }, 1500); return;
    }
    const k = e.target.closest('[data-ask]'); if (k) return open(k.dataset.ask, true);
    const g = e.target.closest('[data-again]');
    if (g) {
      if (!confirm('Ask VR Garage again for this number? It is one more search.')) return;
      g.disabled = true;
      try { cur = await post('/__gate/api/vehicle/again', { no: g.dataset.again }); vr = cur.vr; draw(); refresh(); }
      catch (x) { g.disabled = false; alert(x.message); }
    }
  });
  $('out').addEventListener('submit', async e => {
    if (e.target.id !== 'ed') return; e.preventDefault();
    const b = $('esave'); b.disabled = true;
    try {
      cur = await post('/__gate/api/vehicle', { no: e.target.dataset.no, name: $('ename').value, model: $('emodel').value });
      draw(); $('emsg').innerHTML = '<span class="okt">Saved. It shows like this every time this vehicle comes.</span>'; refresh();
    } catch (x) { b.disabled = false; $('emsg').innerHTML = `<span class="err">${esc(x.message)}</span>`; }
  });

  (async () => {
    try { me = await call('/__gate/me'); } catch { /* signed out: call() went to the sign-in page */ }
    await refresh();
    const h = clean(decodeURIComponent(location.hash.slice(1)));
    if (isReg(h)) { $('no').value = show(h); open(h, false); }
    setInterval(() => { if (!document.hidden) refresh(); }, 8000);
  })();
  // another page (the Cashier) opens a vehicle here: the one screen sets this page's #number
  addEventListener('hashchange', () => { const h = clean(decodeURIComponent(location.hash.slice(1))); if (isReg(h) && (!cur || cur.no !== h)) { $('no').value = show(h); open(h, false); } });
})();
