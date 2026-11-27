'use strict';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let D = { logins: [], portals: [] }, editing = null;
const pName = k => (D.portals.find(p => p.key === k) || {}).name || k;
const who = (k, ph, w) => { if (w) return w; const p = D.portals.find(x => x.key === k); const m = p && p.people.find(x => x[1] === ph); return m ? m[0] : ph.replace(/(\d{5})(\d{5})/, '$1 $2'); };
const ids = l => [l.phone && l.phone.replace(/(\d{5})(\d{5})/, '$1 $2'), l.email].filter(Boolean).map(esc).join('<br>');

async function load() {
  const r = await fetch('/__gate/api/logins');
  if (r.status === 401) { location.href = '/__gate/login'; return; }
  D = await r.json();
  $('list').innerHTML = D.logins.map(l => `<tr><td><b>${esc(l.name)}</b>${l.owner ? ' <span class="pill">Owner</span>' : ''}${l.staff ? ' <span class="pill">Staff</span>' : ''}</td><td>${ids(l)}</td>
    <td>${l.panels.map((p, i) => `${i ? '' : '<b>'}${esc(pName(p.portal))}${i ? '' : '</b>'} <span class="muted">(${esc(who(p.portal, p.phone, p.who))})</span>`).join('<br>')}</td>
    <td>${l.active ? '<span class="ok">Can sign in</span>' : '<span class="err">Off</span>'}</td><td><button type="button" data-edit="${l.id}">Change</button></td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">No logins yet.</td></tr>';
}

function panelRow(p = {}) {
  const row = document.createElement('div'); row.className = 'pl';
  row.innerHTML = `<select class="portal" aria-label="Panel">${D.portals.map(x => `<option value="${x.key}">${esc(x.name)}</option>`).join('')}</select>
    <select class="person" aria-label="Person in that panel"></select><input class="phone" inputmode="numeric" placeholder="Phone (10 digits)" aria-label="Phone">
    <input class="pin" inputmode="numeric" maxlength="4" placeholder="PIN" aria-label="PIN in that panel"><button type="button" class="rm">Remove</button>`;
  const portal = row.querySelector('.portal'), person = row.querySelector('.person'), phone = row.querySelector('.phone');
  const fill = () => { const pp = D.portals.find(x => x.key === portal.value);
    person.innerHTML = pp.people.map(x => `<option value="${x[1]}">${esc(x[0])}</option>`).join('') + '<option value="">Other phone…</option>';
    person.value = pp.people.some(x => x[1] === phone.value) ? phone.value : phone.value ? '' : pp.people[0][1];
    if (person.value) phone.value = person.value; };
  if (p.portal) portal.value = p.portal;
  phone.value = p.phone || '';
  fill();
  portal.addEventListener('change', () => { phone.value = ''; fill(); });
  person.addEventListener('change', () => { phone.value = person.value; if (!person.value) phone.focus(); });
  row.querySelector('.rm').addEventListener('click', () => row.remove());
  $('panels').append(row);
}

function openForm(l) {
  editing = l ? l.id : null;
  $('ftitle').textContent = l ? `Change ${l.name}` : 'New login';
  $('name').value = l ? l.name : ''; $('email').value = l ? l.email : ''; $('phone').value = l ? l.phone : ''; $('password').value = '';
  $('password').required = !l; $('pwhint').textContent = l ? '(leave empty to keep)' : '(at least 8)';
  $('owner').checked = !!(l && l.owner); $('active').checked = l ? l.active : true;
  $('panels').innerHTML = ''; (l ? l.panels : [{}]).forEach(panelRow);
  $('err').textContent = ''; $('form').hidden = false; $('name').focus();
}

document.addEventListener('click', e => { const id = e.target.dataset && e.target.dataset.edit; if (id) openForm(D.logins.find(l => String(l.id) === id)); });
$('add').addEventListener('click', () => openForm(null));
$('addp').addEventListener('click', () => panelRow());
$('cancel').addEventListener('click', () => { $('form').hidden = true; });
$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const panels = [...$('panels').children].map(r => ({ portal: r.querySelector('.portal').value, phone: r.querySelector('.phone').value, pin: r.querySelector('.pin').value }));
  const b = { name: $('name').value, email: $('email').value, phone: $('phone').value, owner: $('owner').checked, active: $('active').checked, panels };
  if ($('password').value) b.password = $('password').value;
  const r = await fetch(editing ? `/__gate/api/logins/${editing}` : '/__gate/api/logins', { method: editing ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { $('err').textContent = d.error || 'Could not save.'; return; }
  $('form').hidden = true; load();
});
load();
