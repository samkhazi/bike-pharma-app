// New job card (Sam, 28 Nov 2026: "new job card service.bikesurgeon.online pe nahi jana chahiye ... naye steps, nayi UI"): the
// three steps of server/newjc.js, drawn inside the Service floor's own frame (live.js: the menu and the top bar).
//   1 the customer and the vehicle: VR Garage and the billing fill in what they know (the last customer of the vehicle, the
//     name of a known mobile number, the make, the model, the CC)
//   2 the services: CC, labour at the rate card's price, the general service checklist, the 23-point bike check, the
//     customer's issues, the delivery time (the free service of the vehicle is worked out by the server)
//   3 the odometer, the fuel and the 5 photos; then the customer's WhatsApp goes by itself
// Everything is saved in the billing like the service app's own steps, so the mechanic portal and the cashier see it at once.
'use strict';
(() => {
const B = window.BSF;
if (!B) return;
const { esc, ic, pill, inr, toast } = B;
const IC = {
  cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  spin: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
};
const ico = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
const pad = n => String(n).padStart(2, '0');
const regKey = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
const mobile10 = v => { const d = String(v || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d.slice(0, 10); };
const title = s => String(s || '').toLowerCase().replace(/(^|[\s.(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\s+/g, ' ').trim();
const num = v => { const n = Number(String(v ?? '').replace(/[₹,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const BRANDS = [['HERO', 'Hero'], ['HONDA', 'Honda'], ['BAJAJ', 'Bajaj'], ['TVS', 'TVS'], ['YAMAHA', 'Yamaha'], ['SUZUKI', 'Suzuki'], ['ROYAL ENFIELD', 'Royal Enfield'],
  ['EICHER', 'Royal Enfield'], ['KTM', 'KTM'], ['MAHINDRA', 'Mahindra'], ['PIAGGIO', 'Piaggio'], ['VESPA', 'Vespa'], ['APRILIA', 'Aprilia'], ['KAWASAKI', 'Kawasaki'],
  ['CLASSIC LEGENDS', 'Jawa'], ['JAWA', 'Jawa'], ['YEZDI', 'Yezdi'], ['BENELLI', 'Benelli'], ['HARLEY', 'Harley-Davidson'], ['TRIUMPH', 'Triumph'], ['OLA ', 'Ola'],
  ['ATHER', 'Ather'], ['REVOLT', 'Revolt'], ['OKINAWA', 'Okinawa'], ['AMPERE', 'Ampere'], ['BMW', 'BMW'], ['DUCATI', 'Ducati'], ['HUSQVARNA', 'Husqvarna'], ['KINETIC', 'Kinetic']];
const brand = m => { const u = String(m || '').toUpperCase() + ' '; const b = BRANDS.find(([k]) => u.includes(k)); return b ? b[1] : title(u.trim().split(/\s+/)[0] || ''); };
const CCK = ['110cc', '125cc', '150cc', '200cc', '300cc', '650cc'];
const ccGuess = v => { const n = parseFloat(String(v || '').replace(/[^\d.]/g, '')); return !(n > 40) ? '' : n <= 112 ? '110cc' : n <= 140 ? '125cc' : n <= 155 ? '150cc' : n <= 215 ? '200cc' : n <= 300 ? '300cc' : '650cc'; };
const fuelLabel = v => v <= 5 ? 'Empty' : v <= 30 ? '1/4' : v <= 60 ? 'Half' : v <= 85 ? '3/4' : 'Full';
const isGs = n => /^\s*general\s+servic/i.test(String(n || ''));
const localDT = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const showDT = s => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s || ''); if (!m) return ''; const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]), h = d.getHours();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}, ${((h + 11) % 12) + 1}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`; };
const nonce = () => { try { return crypto.randomUUID(); } catch { return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); } };
const STEPS = ['Customer and vehicle', 'Services', 'Photos and WhatsApp'];
const PST = { done: ['Done', 'green', '✓'], in_service: ['Work now', 'orange', '🔧'], scheduled: ['Later', 'blue', '📅'], not_approved: ['Next service', 'red', '⏭'] };

// ---------------- state ---------------------------------------------------------------------------------------------------------
let BOOT = null, BOOTP = null;   // the lists of the server (labour rate card, CC, checks), again after 10 minutes
const fresh = () => ({ key: '', id: 0, step: 1, max: 1, editable: true, loading: false, err: '', busy: '', nonce: nonce(),
  f: { reg: '', phone: '', name: '', make: '', model: '' }, auto: {}, look: null, cust: null,
  cc: '', ccFrom: '', lab: [], labQ: '', labCat: '', cu: { n: '', p: '' }, gsc: {}, points: {}, pt: -1, ptStep: '', ptDate: '', showPts: false,
  issues: [], issueIn: '', remOpen: -1, delivery: '', free: null, prev: [], showPrev: false,
  odo: '', km: '', fuel: 50, photos: {}, done: null });
let S = fresh();
const R = () => B.render();
function ensureBoot() {
  if (BOOT && Date.now() - BOOT.at < 600000) return Promise.resolve(BOOT);
  if (!BOOTP) BOOTP = B.api('GET', '/newjc/boot').then(d => { BOOT = { ...d, at: Date.now() }; BOOTP = null; R(); return BOOT; },
    e => { BOOTP = null; S.err = e.message; R(); throw e; });
  return BOOTP;
}
// '#new' = a new job card (a half-typed one is kept), '#new-<number>' = go on with that job card
B.onNew = param => {
  const id = Math.floor(+param) || 0;
  if (id ? S.id === id : !S.id && !S.done) { ensureBoot().catch(() => {}); R(); return; }
  S = fresh(); S.key = id ? String(id) : '';
  ensureBoot().catch(() => {});
  if (id) loadCard(id);
  R();
};
async function loadCard(id) {
  S.loading = true; R();
  try {
    const [d] = await Promise.all([B.api('GET', '/newjc/' + id), ensureBoot()]);
    if (S.key === String(id)) fromState(d);
  } catch (e) { if (S.key === String(id)) S.err = e.message; }
  finally { if (S.key === String(id)) { S.loading = false; R(); } }
}
function fromState(d) {
  const c = d.card;
  S.id = d.id; S.editable = d.editable; S.step = d.step; S.max = d.step;
  S.f = { reg: c.p, phone: c.phone, name: c.name, make: c.mk, model: c.mo };
  if (CCK.includes(c.cc)) { S.cc = c.cc; S.ccFrom = ''; }
  // a labour line of the rate card goes back to its rate card row (its price follows the CC), else it stays as a custom line
  S.lab = d.labour.map(l => { const r = !l.custom && BOOT && BOOT.labour.find(x => x.n === l.n); return r ? { id: r.id } : { custom: true, n: l.n, p: l.p }; });
  S.gsc = d.gsc && typeof d.gsc === 'object' ? d.gsc : {};
  S.points = {};
  for (const [k, v] of Object.entries(d.points || {})) S.points[k] = v && typeof v === 'object' ? { status: v.status || 'not_checked', date: v.date || null } : { status: v === 'done' ? 'done' : 'not_checked', date: null };
  // the issue list as it was typed: "1. text — Remark: remark" (the app's own form), else the saved checklist lines
  const lines = String(d.issueText || '').split(/\r?\n/).map(t => /^\d+\.\s(.*?)(?: — Remark: (.*))?$/.exec(t.trim())).filter(Boolean);
  S.issues = (lines.length ? lines.map(m => ({ t: m[1].trim(), r: (m[2] || '').trim() })) : d.issues.filter(x => x.s === 'pending').map(x => ({ t: x.t, r: '' }))).filter(x => x.t);
  for (const it of S.issues) if (S.points[it.t] && S.points[it.t].status === 'in_service') it.auto = true;
  S.delivery = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(c.dl) ? c.dl : '';
  S.free = d.free; S.prev = d.prev || [];
  S.odo = c.km || ''; S.km = c.dk || ''; S.fuel = /^\d+$/.test(c.fu) ? Math.min(100, +c.fu) : ({ Empty: 0, '1/4': 25, Half: 50, '3/4': 75, Full: 100 }[c.fu] ?? 50);
  S.photos = {};
  for (const [k, at] of Object.entries(d.photos || {})) if (at) S.photos[k] = { state: 'ok', old: true };
  if (d.step === 4) { S.done = { id: d.id, sent: d.note && d.note.sent, card: c }; if (S.done.sent && S.done.sent.state === 'sending') watchSent(); }
}

// ---------------- step 1: the customer and the vehicle ----------------------------------------------------------------------
const setAuto = (k, v) => { v = String(v || '').trim(); if (!v) return; if (!S.f[k] || S.f[k] === S.auto[k]) { S.f[k] = v; S.auto[k] = v; } };
function prefill() {
  const L = S.look || {}, bill = L.bill && !L.bill.err ? L.bill : null, vr = L.vr && !L.vr.err ? L.vr : null;
  const last = bill && bill.cards[0], bike = bill && bill.bikes[0], sv = vr && vr.saved, d = sv && sv.found === 1 ? sv.d || {} : {};
  if (!S.id) setAuto('phone', (last && last.ph) || (bike && bike.ph));
  setAuto('name', (last && last.n) || (bike && bike.n) || (sv && sv.name) || title(d.owner));
  setAuto('make', (last && last.mk) || (bike && bike.mk) || (d.maker ? brand(d.maker) : ''));
  setAuto('model', (last && last.mo) || (bike && bike.mo) || (sv && sv.model) || d.model);
  if (!S.cc || S.ccFrom) {
    const lp = last && CCK.includes(last.pkg) ? last.pkg : '', g = lp || ccGuess(d.cc);
    if (g) { S.cc = g; S.ccFrom = lp ? 'the last visit' : 'VR Garage'; }
  }
  if (/^\d{10}$/.test(S.f.phone)) lookPhone();
}
function lookVehicle() {
  const reg = regKey(S.f.reg);
  if (reg.length < 6 || (S.look && S.look.reg === reg)) return;
  const L = S.look = { reg, bill: null, vr: null, billBusy: true, vrBusy: true };
  R();
  B.api('GET', '/newjc/find?reg=' + encodeURIComponent(reg)).then(d => { L.bill = d.vehicle || null; }, e => { L.bill = { err: e.message }; })
    .finally(() => { if (S.look !== L) return; L.billBusy = false; prefill(); R(); });
  // VR Garage through the front door (asked only once for a number, like the Vehicle number page)
  fetch('/__gate/api/vehicle?no=' + encodeURIComponent(reg) + '&look=1', { credentials: 'same-origin', cache: 'no-store' })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 404 ? '' : j.error || 'VR Garage did not answer.'); return j; })
    .then(j => { L.vr = j; }, e => { L.vr = { err: e.message }; })
    .finally(() => { if (S.look !== L) return; L.vrBusy = false; prefill(); R(); });
}
function lookPhone() {
  const ph = S.f.phone;
  if (!/^\d{10}$/.test(ph) || (S.cust && S.cust.phone === ph)) return;
  const C0 = S.cust = { phone: ph, busy: true };
  B.api('GET', '/newjc/find?phone=' + ph).then(d => { Object.assign(C0, d.customer || { found: false }); if (C0.found) setAuto('name', C0.name); },
    e => { C0.err = e.message; }).finally(() => { C0.busy = false; if (S.cust === C0) R(); });
}
async function save1() {
  const f = S.f;
  f.reg = regKey(f.reg); f.phone = mobile10(f.phone);
  const bad = !/^\d{10}$/.test(f.phone) ? "Type the customer's 10-digit mobile number." : !f.name.trim() ? "Type the customer's name."
    : f.reg.length < 4 ? 'Type the vehicle number.' : !f.make.trim() || !f.model.trim() ? 'Type the make and the model.' : '';
  if (bad) { S.err = bad; R(); return; }
  await busy('save', async () => {
    const body = { nonce: S.nonce, phone: f.phone, name: f.name, reg: f.reg, make: f.make, model: f.model };
    const r = S.id ? await B.api('POST', `/newjc/${S.id}/vehicle`, body) : await B.api('POST', '/newjc/start', body);
    if (!S.id) {
      S.id = r.id; S.key = String(r.id); B.ui.param = String(r.id);
      try { history.replaceState(null, '', '#new-' + r.id); } catch { /* sandboxed */ }
      toast(`Job card #${r.id} made`);
    }
    const d = await B.api('GET', '/newjc/' + S.id).catch(() => null);
    if (d) { S.free = d.free; S.prev = d.prev || []; S.editable = d.editable; }
    to(2);
  });
}

// ---------------- step 2: the services ------------------------------------------------------------------------------------------
const labRow = id => BOOT && BOOT.labour.find(x => x.id === id);
const linePrice = l => l.custom ? num(l.p) : (labRow(l.id) ? labRow(l.id).p[S.cc] || 0 : 0);
const lineName = l => l.custom ? l.n : (labRow(l.id) ? labRow(l.id).n : '');
// the free service the server will give: only the General Servicing line is Rs. 0 (when the vehicle still has one and the
// checklist or that line is chosen)
const freeOn = () => !!(S.free && S.free.eligible) && (Object.values(S.gsc).some(v => v && v.checked) || S.lab.some(l => isGs(lineName(l))));
const total = () => S.lab.reduce((a, l) => a + (freeOn() && isGs(lineName(l)) ? 0 : linePrice(l)), 0);
function nextPoint() { const P = (BOOT && BOOT.points) || []; return P.findIndex(p => !S.points[p] || S.points[p].status === 'not_checked'); }
function setPoint(i, status, date) {
  const P = BOOT.points, label = P[i];
  S.points[label] = { status, date: status === 'scheduled' ? date : null };
  // "work now" puts the point on the customer's issue list (it leaves only when the point is marked done), as in the app
  if (status === 'in_service' && !S.issues.some(x => x.auto && x.t === label)) S.issues.push({ t: label, r: '', auto: true });
  if (status === 'done') S.issues = S.issues.filter(x => !(x.auto && x.t === label));
  const n = nextPoint(); S.pt = n; S.ptStep = ''; S.ptDate = '';
}
async function save2() {
  if (!S.cc) { S.err = 'Choose the engine CC.'; R(); return; }
  if (!S.lab.length) { S.err = 'Choose at least one service.'; R(); return; }
  if (!S.delivery) { S.err = 'Set the expected delivery time.'; R(); return; }
  await busy('save', async () => {
    const P = BOOT.points, points = {};
    for (const p of P) points[p] = S.points[p] || { status: 'not_checked', date: null };
    const gsc = {};
    for (const g of BOOT.gsc) { const v = S.gsc[g]; gsc[g] = v && v.checked ? { checked: true, answer: v.answer || 'yes' } : { checked: false, answer: null }; }
    const r = await B.api('POST', `/newjc/${S.id}/services`, { cc: S.cc, delivery: S.delivery, gsc, points,
      labour: S.lab.map(l => l.custom ? { custom: true, n: l.n, p: num(l.p) } : { id: l.id }), issues: S.issues.map(x => ({ t: x.t, r: x.r })) });
    if (r.free) toast(`Free service: General Servicing labour ₹0 (${['', '1st', '2nd', '3rd'][r.free.slot] || ''} of 3)`);
    to(3);
  });
}

// ---------------- step 3: the photos, then WhatsApp ---------------------------------------------------------------------------------
// the app's own way: the longer side 800 px, JPEG 0.55 (about 60-120 kB), sent as it is taken
function shrink(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('The photo could not be read.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This photo cannot be opened. Take it with the camera.'));
      img.onload = () => {
        let w = img.width, h = img.height; const M = 800;
        if (w > h) { if (w > M) { h = Math.round(h * M / w); w = M; } } else if (h > M) { w = Math.round(w * M / h); h = M; }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.55));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function takePhoto(k, file) {
  if (!file || !S.id) return;
  const id = S.id, P = S.photos[k] = { state: 'up', thumb: '' };
  R();
  try {
    P.thumb = await shrink(file); R();
    await B.api('POST', `/newjc/${id}/photo/${k}`, { data: P.thumb });
    P.state = 'ok';
  } catch (e) { P.state = 'err'; P.err = e.message; toast(e.message); }
  if (S.id === id) R();
}
// one camera input for all 5 photos, outside the page that is drawn again: a photo still arrives when the page was drawn again
// while the camera was open (an earlier photo finished sending meanwhile)
let FILE = null;
function picker() {
  if (FILE && FILE.isConnected) return FILE;
  FILE = document.createElement('input');
  FILE.type = 'file'; FILE.accept = 'image/*'; FILE.setAttribute('capture', 'environment'); FILE.className = 'nj-file'; FILE.id = 'nj-picker'; FILE.tabIndex = -1;
  FILE.setAttribute('aria-hidden', 'true');
  FILE.addEventListener('change', () => { const f = FILE.files && FILE.files[0], k = FILE.dataset.k; FILE.value = ''; if (f && k && here()) takePhoto(k, f); });
  document.body.appendChild(FILE);
  return FILE;
}
async function save3() {
  const miss = ((BOOT && BOOT.photos) || []).filter(p => !S.photos[p.k] || S.photos[p.k].state !== 'ok');
  if (!num(S.odo)) { S.err = 'Type the odometer reading.'; R(); return; }
  if (Object.values(S.photos).some(p => p.state === 'up')) { S.err = 'A photo is still being sent. One moment.'; R(); return; }
  if (miss.length) { S.err = miss[0].k === 'odo' ? 'Take the odometer photo.' : `Take all 4 photos of the bike (${4 - miss.length}/4 done).`; R(); return; }
  await busy('save', async () => {
    await B.api('POST', `/newjc/${S.id}/inspect`, { odo: S.odo, km: S.km, fuel: S.fuel });
    S.done = { id: S.id, sent: { state: 'sending' }, card: { name: S.f.name, p: S.f.reg, mk: S.f.make, mo: S.f.model } };
    S.step = 4; S.max = 4; window.scrollTo(0, 0);
    watchSent();
  });
}
let sentT = 0;
function watchSent() {
  clearTimeout(sentT);
  const id = S.id, t0 = Date.now();
  const tick = async () => {
    if (S.id !== id || !S.done) return;
    try { const d = await B.api('GET', '/newjc/' + id); if (S.id === id && S.done) { S.done.sent = d.note && d.note.sent; R(); } } catch { /* again */ }
    if (S.id === id && S.done && (!S.done.sent || S.done.sent.state === 'sending') && Date.now() - t0 < 120000) sentT = setTimeout(tick, 2000);
  };
  sentT = setTimeout(tick, 1500);
}

// ---------------- common ---------------------------------------------------------------------------------------------------------
async function busy(what, fn) {
  if (S.busy) return;
  S.busy = what; S.err = ''; R();
  try { await fn(); } catch (e) { S.err = e.message; }
  finally { S.busy = ''; R(); }
}
function to(n) { S.step = n; S.max = Math.max(S.max, n); S.err = ''; R(); window.scrollTo(0, 0); }

// ---------------- drawing ----------------------------------------------------------------------------------------------------------
const field = (id, label, input, hint = '') => `<label class="nj-f" for="${id}"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
const inp = (id, v, extra = '') => `<input id="${id}" value="${esc(v)}" autocomplete="off" ${extra}>`;
function stepper() {
  return `<div class="nj-steps">${STEPS.map((l, i) => {
    const n = i + 1, cls = S.step === n ? 'on' : n < S.step || n <= S.max ? 'ok' : '', can = S.id && S.editable && n < S.step && S.step !== 4;
    return `<button class="nj-st ${cls}" ${can ? `data-nj="step" data-s="${n}"` : 'disabled'}><i>${n < S.max || (S.step === 4) ? '✓' : n}</i><b>${l}</b></button>`;
  }).join('')}</div>`;
}
const errBox = () => S.err ? `<div class="errbox" role="alert">${esc(S.err)}</div>` : '';
// the bar at the bottom of the screen: what is chosen, the buttons, and what is missing (where the button is that was pressed)
function bar(sum, btn) {
  return `<div class="nj-bar">${S.err ? `<div class="nj-err" role="alert">${esc(S.err)}</div>` : ''}<div class="nj-row"><div class="nj-sum">${sum}</div><div class="nj-btns">${btn}</div></div></div>`;
}
const saveBtn = (act, label) => `<button class="btn pri nj-go" data-nj="${act}" ${S.busy ? 'disabled' : ''}>${S.busy === 'save' ? `${ico('spin', 'i nj-spin')}Saving…` : label}</button>`;

function vehicleInfo() {
  const L = S.look;
  if (!L) return '';
  const bill = L.bill && !L.bill.err ? L.bill : null, vr = L.vr && !L.vr.err ? L.vr : null, sv = vr && vr.saved, d = sv && sv.found === 1 ? sv.d || {} : {};
  const out = [];
  // VR Garage
  if (L.vrBusy) out.push(`<div class="nj-info">${ico('spin', 'i nj-spin')}<span>Asking VR Garage for <b class="mono">${esc(L.reg)}</b>…</span></div>`);
  else if (vr && sv && sv.found === 1) {
    const bits = [[brand(d.maker), d.model].filter(Boolean).join(' '), d.mfg || d.year, d.fuel, d.colour, d.cc ? `${d.cc} cc` : ''].filter(Boolean);
    out.push(`<div class="nj-info ok"><span class="nj-tag">VR Garage</span><span><b>${esc(bits.join(' · '))}</b>${d.owner ? `<br><small>RC owner: ${esc(title(d.owner))}</small>` : ''}</span></div>`);
  } else if (vr && vr.look && vr.look.msg) out.push(`<div class="nj-info"><span class="nj-tag">VR Garage</span><span>${esc(vr.look.msg)}</span></div>`);
  else if (vr && sv && sv.found === 0) out.push('<div class="nj-info"><span class="nj-tag">VR Garage</span><span>This number is not in the RC records. Type the make and the model.</span></div>');
  else if (L.vr && L.vr.err) out.push(`<div class="nj-info"><span class="nj-tag">VR Garage</span><span>${esc(L.vr.err)}</span></div>`);
  // the billing: earlier job cards of this vehicle
  if (L.billBusy) out.push(`<div class="nj-info">${ico('spin', 'i nj-spin')}<span>Looking in the billing…</span></div>`);
  else if (bill && bill.cards.length) {
    const l = bill.cards[0];
    out.push(`<div class="nj-info ok"><span class="nj-tag">Billing</span><span><b>${bill.cards.length >= 8 ? '8+' : bill.cards.length} earlier job card${bill.cards.length === 1 ? '' : 's'}</b> · last #${l.id}${l.at ? ' · ' + esc(String(l.at).slice(0, 10)) : ''}${l.km ? ` · ${esc(l.km)} km` : ''}<br><small>${esc([l.n, l.ph ? '••••' + l.ph.slice(-4) : '', [l.mk, l.mo].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</small></span></div>`);
  } else if (bill) out.push('<div class="nj-info"><span class="nj-tag">Billing</span><span>First visit of this vehicle.</span></div>');
  if (bill && bill.open && bill.open.length) out.push(`<div class="warnbox nj-open">Job card ${bill.open.map(id => `<b>#${id}</b>`).join(', ')} of this vehicle is still being made. ${bill.open.map(id => `<button class="link" data-nj="cont" data-id="${id}">Go on with #${id}</button>`).join(' ')}</div>`);
  if (bill && bill.free) out.push(freeLine(bill.free));
  return `<div class="nj-infos">${out.join('')}</div>`;
}
function freeLine(f) {
  if (!f) return '';
  if (f.eligible) return `<div class="nj-info free">${ico('gift')}<span><b>Free service ${f.slot} of 3</b> for this vehicle: the General Servicing labour is ₹0 when it is chosen.</span></div>`;
  const why = f.reason === 'all_used' ? 'all 3 free General Servicing visits are used' : f.reason === 'first_visit_not_gs' ? 'its first visit was not a General Servicing' : 'it came before the free service offer';
  return `<div class="nj-info"><span class="nj-tag">Free service</span><span>Not for this vehicle: ${why}.</span></div>`;
}
function p1() {
  const f = S.f, c = S.cust, ro = S.id ? 'readonly' : '';
  const custNote = !c || c.phone !== f.phone ? '' : c.busy ? 'Looking for this number…' : c.err ? esc(c.err) : c.found ? `In the billing: <b>${esc(c.name || 'no name')}</b>` : 'A new customer (not in the billing yet).';
  const bikes = c && c.found && c.bikes && c.bikes.length ? `<div class="chips nj-bikes">${c.bikes.map((b, i) => `<button class="chip ${regKey(f.reg) === b.p ? 'on' : ''}" data-nj="bike" data-i="${i}">${esc(b.p)} <i>${esc([b.mk, b.mo].filter(Boolean).join(' '))}</i></button>`).join('')}</div>` : '';
  const open = c && c.found && c.open && c.open.length && !S.id ? `<div class="warnbox nj-open">This customer has a job card that is still being made: ${c.open.map(o => `<button class="link" data-nj="cont" data-id="${o.id}">#${o.id} ${esc(o.p)}</button>`).join(' ')}</div>` : '';
  return `${stepper()}
  <section class="card nj-card"><div class="card-h"><h2>Vehicle</h2></div>
   <div class="nj-reg">${inp('nj-reg', f.reg, 'class="mono" placeholder="KA17AB1234" maxlength="16" autocapitalize="characters" spellcheck="false" enterkeyhint="search" aria-label="Vehicle number"')}<button class="btn" data-nj="find">${ic('search')}Find</button></div>
   ${vehicleInfo()}
   <div class="nj-two">${field('nj-make', 'Make', inp('nj-make', f.make, 'placeholder="Hero, Honda, Bajaj…" maxlength="40"'))}${field('nj-model', 'Model', inp('nj-model', f.model, 'placeholder="Splendor, Activa…" maxlength="60"'))}</div>
  </section>
  <section class="card nj-card"><div class="card-h"><h2>Customer</h2></div>
   ${field('nj-phone', 'Mobile number', inp('nj-phone', f.phone, `type="tel" inputmode="numeric" maxlength="14" placeholder="10 digits" ${ro}`), S.id ? 'The mobile number of a job card stays as it is made.' : custNote)}
   ${bikes}${open}
   ${field('nj-name', 'Name', inp('nj-name', f.name, 'placeholder="Customer name" maxlength="80" autocapitalize="words"'))}
  </section>
  ${bar(S.id ? `Job card <b>#${S.id}</b>` : (BOOT && BOOT.slot ? `Slot <b>${esc(BOOT.slot.label)}</b> · ${BOOT.slot.free} of 14 free` : ''), saveBtn('save1', S.id ? 'Save and next' : 'Make the job card'))}`;
}
function p2() {
  const b = BOOT, q = S.labQ.trim().toLowerCase(), cats = [...new Set(b.labour.map(x => x.c))];
  const chosen = new Set(S.lab.filter(l => !l.custom).map(l => l.id));
  const list = b.labour.filter(x => (!S.labCat || x.c === S.labCat) && (!q || x.n.toLowerCase().includes(q)));
  const cc = `<div class="nj-cc">${b.cc.map(c => `<button class="${S.cc === c.k ? 'on' : ''}" data-nj="cc" data-v="${c.k}">${esc(c.l)}</button>`).join('')}</div>${S.cc && S.ccFrom ? `<small class="note">Chosen from ${esc(S.ccFrom)}: change it if it is not right.</small>` : ''}`;
  const sel = S.lab.length ? `<div class="nj-sel">${S.lab.map((l, i) => {
    const nm = lineName(l), free = freeOn() && isGs(nm);
    return `<div class="nj-line"><span class="nj-ln">${esc(nm)}${l.custom ? ' ' + pill('Custom', 'gray') : ''}${free ? ' ' + pill('Free service', 'teal') : ''}</span><b>${free ? '<s>' + inr(linePrice(l)) + '</s> ₹0' : S.cc || l.custom ? inr(linePrice(l)) : '—'}</b><button class="nj-x" data-nj="rm" data-i="${i}" aria-label="Remove">${ico('x')}</button></div>`;
  }).join('')}<div class="nj-line tot"><span>Total labour</span><b>${inr(total())}</b><span></span></div></div>` : '<div class="empty nj-empty">No service chosen yet. Add from the list below.</div>';
  const rows = list.length ? list.map(x => `<button class="nj-lab ${chosen.has(x.id) ? 'on' : ''}" data-nj="${chosen.has(x.id) ? 'rmid' : 'add'}" data-id="${x.id}"><span>${esc(x.n)}</span><b>${S.cc ? inr(x.p[S.cc]) : '—'}</b><i>${chosen.has(x.id) ? '✓' : '+'}</i></button>`).join('') : '<div class="empty">No labour like that.</div>';
  const gAll = b.gsc.every(g => S.gsc[g] && S.gsc[g].checked);
  const gsc = b.gsc.map((g, i) => { const v = S.gsc[g] || {}, on = !!v.checked, a = on ? v.answer || 'yes' : '';
    return `<div class="nj-gs ${on ? 'on' : ''}"><button class="nj-tick" data-nj="gsc" data-i="${i}" aria-pressed="${on}"><i>${on ? '✓' : ''}</i><span>${esc(g)}</span></button><span class="nj-ynm">${[['yes', 'Yes'], ['maybe', 'Maybe'], ['not', 'No']].map(([k, l]) => `<button class="${a === k ? 'on ' + k : ''}" data-nj="gsa" data-i="${i}" data-a="${k}">${l}</button>`).join('')}</span></div>`; }).join('');
  const P = b.points, nxt = nextPoint(), doneN = P.filter(p => S.points[p] && S.points[p].status !== 'not_checked').length;
  const pts = P.map((p, i) => {
    const v = S.points[p] || { status: 'not_checked' }, st = PST[v.status], locked = v.status === 'not_checked' && i > nxt && nxt !== -1, open = S.pt === i;
    const acts = !open ? '' : S.ptStep === 'later' ? `<div class="nj-pacts"><input id="nj-ptdate" type="date" value="${esc(S.ptDate)}" min="${b.today}"><button class="btn pri" data-nj="ptdate">Set the date</button><button class="btn" data-nj="pstep" data-s="">Back</button></div>`
      : `<div class="nj-pacts"><button class="btn pri" data-nj="pst" data-s="done">✓ Done</button><button class="btn" data-nj="pst" data-s="in_service">🔧 Work now</button><button class="btn" data-nj="pstep" data-s="later">📅 Later</button><button class="btn" data-nj="pst" data-s="not_approved">⏭ Next service</button></div>`;
    return `<div class="nj-pt ${open ? 'open' : ''} ${locked ? 'lock' : ''} ${i === nxt ? 'next' : ''}"><button class="nj-ph" data-nj="pt" data-i="${i}" ${locked ? 'aria-disabled="true"' : ''}><i class="${st ? 'p-' + st[1] : ''}">${st ? st[2] : i + 1}</i><span>${esc(p)}</span>${st ? pill(st[0] + (v.status === 'scheduled' && v.date ? ' ' + v.date.slice(8, 10) + '/' + v.date.slice(5, 7) : ''), st[1]) : i === nxt ? '<small>Next</small>' : ''}</button>${acts}</div>`;
  }).join('');
  const issues = S.issues.length ? S.issues.map((x, i) => `<div class="nj-is"><span class="nj-n">${i + 1}.</span><div class="nj-it"><b>${esc(x.t)}</b>${x.auto ? ' ' + pill('Work started', 'orange') : ''}${x.r && S.remOpen !== i ? `<small>Remark: ${esc(x.r)}</small>` : ''}${S.remOpen === i ? `<input id="nj-rem-${i}" value="${esc(x.r)}" placeholder="Remark" maxlength="300">` : ''}</div><button class="nj-x" data-nj="remark" data-i="${i}" aria-label="Remark">${ico('note')}</button>${x.auto ? '' : `<button class="nj-x" data-nj="rmis" data-i="${i}" aria-label="Remove">${ico('x')}</button>`}</div>`).join('') : '<div class="empty nj-empty">No issue written yet.</div>';
  const prev = S.prev.length ? `<button class="link" data-nj="prev">${ico('hist')} ${S.showPrev ? 'Hide' : 'See'} the last visits' issues (${S.prev.reduce((a, p) => a + p.items.length, 0)})</button>${S.showPrev ? S.prev.map(p => `<div class="vr"><b>Job card #${p.id} · ${esc(String(p.at).slice(0, 10))}</b>${p.items.map(it => `<div class="chk ${it.s === 'done' ? 'done' : it.s === 'not_done' ? 'nd' : ''}"><span class="c">${it.s === 'done' ? '✓' : it.s === 'not_done' ? '✕' : ''}</span><span class="grow">${esc(it.t)}${it.r ? `<br><small class="muted">${esc(it.r)}</small>` : ''}</span><button class="link" data-nj="readd" data-t="${esc(it.t)}">Add</button></div>`).join('')}</div>`).join('') : ''}` : '';
  const now = new Date(), dl = [['+2', 'In 2 hours'], ['+4', 'In 4 hours'], now.getHours() < 18 ? ['t1830', 'Today 6:30 pm'] : null, ['m12', 'Tomorrow 12 pm'], ['m18', 'Tomorrow 6 pm']].filter(Boolean);
  return `${stepper()}
  <section class="card nj-card"><div class="card-h"><h2>Engine CC</h2></div>${cc}</section>
  <section class="card nj-card"><div class="card-h"><h2>Services<span class="sub">${S.lab.length ? S.lab.length + ' chosen' : ''}</span></h2></div>
   ${freeLine(S.free)}${sel}
   <div class="nj-labtools"><label class="sbox">${ic('search')}<input id="nj-labq" value="${esc(S.labQ)}" placeholder="Search labour" autocomplete="off"></label>
   <div class="chips">${['', ...cats].map(c => `<button class="chip ${S.labCat === c ? 'on' : ''}" data-nj="cat" data-v="${esc(c)}">${esc(c ? title(c) : 'All')}</button>`).join('')}</div></div>
   <div class="nj-labs">${rows}</div>
   <div class="nj-cu"><input id="nj-cun" value="${esc(S.cu.n)}" placeholder="Custom labour" maxlength="300"><input id="nj-cup" value="${esc(S.cu.p)}" type="number" inputmode="decimal" placeholder="₹" min="1"><button class="btn" data-nj="addcu">${ic('plus')}Add</button></div>
  </section>
  <section class="card nj-card"><div class="card-h"><h2>General service checklist</h2><button class="link" data-nj="gscall">${gAll ? 'Clear all' : 'Select all'}</button></div><div class="nj-gsl">${gsc}</div></section>
  <section class="card nj-card"><div class="card-h"><h2>What the customer says</h2></div>
   <div class="nj-isl">${issues}</div>
   <div class="nj-cu"><input id="nj-issue" value="${esc(S.issueIn)}" placeholder="Type an issue, then Add" maxlength="300" enterkeyhint="done"><button class="btn" data-nj="addis">${ic('plus')}Add</button></div>
   ${prev}
  </section>
  <section class="card nj-card"><button class="card-h nj-fold" data-nj="pts"><h2>Bike check<span class="sub">${doneN} / ${P.length}</span></h2><span class="nj-pbar"><i style="width:${Math.round(doneN / P.length * 100)}%"></i></span>${S.showPts ? '▴' : '▾'}</button>
   ${S.showPts ? `<p class="note">Walk round the bike in this order, from the front tyre to the rear tyre.</p><div class="nj-pts">${pts}</div>` : ''}
  </section>
  <section class="card nj-card"><div class="card-h"><h2>Expected delivery</h2></div>
   <div class="nj-dl"><input id="nj-dl" type="datetime-local" value="${esc(S.delivery)}">${S.delivery ? `<b>${esc(showDT(S.delivery))}</b>` : ''}</div>
   <div class="chips">${dl.map(([k, l]) => `<button class="chip" data-nj="dl" data-v="${k}">${l}</button>`).join('')}</div>
  </section>
  ${bar(`<span>Labour</span> <b>${inr(total())}</b> · ${S.lab.length} line${S.lab.length === 1 ? '' : 's'}`, `<button class="btn" data-nj="step" data-s="1">${ico('back')}Back</button>${saveBtn('save2', 'Save and next')}`)}`;
}
function p3() {
  const b = BOOT, ph = b.photos.map(p => {
    const v = S.photos[p.k] || {}, cls = v.state || '';
    const face = v.thumb ? `<img src="${v.thumb}" alt="">` : v.state === 'ok' ? '<em>✓ Saved</em>' : `${ico('cam')}`;
    const st = v.state === 'up' ? `${ico('spin', 'i nj-spin')} Sending` : v.state === 'ok' ? '✓ Saved' : v.state === 'err' ? 'Not sent: take again' : 'Tap to take';
    return `<button type="button" class="nj-photo ${cls}" data-nj="photo" data-k="${p.k}"><span class="nj-pf">${face}</span><b>${esc(p.l)}</b><small>${st}</small></button>`;
  }).join('');
  const nOk = b.photos.filter(p => S.photos[p.k] && S.photos[p.k].state === 'ok').length;
  return `${stepper()}
  <section class="card nj-card"><div class="card-h"><h2>Odometer and fuel</h2></div>
   <div class="nj-two">${field('nj-odo', 'Odometer (km)', inp('nj-odo', S.odo, 'type="number" inputmode="numeric" min="1" placeholder="For example 23450"'))}
   ${field('nj-km', 'Daily running (km, about)', inp('nj-km', S.km, 'type="number" inputmode="numeric" min="0" placeholder="For example 30"'), "The next service reminder call is timed by it.")}</div>
   <div class="nj-fuel"><div class="between"><b>Fuel</b><span id="nj-fuelv" class="mono">${S.fuel}% · ${fuelLabel(S.fuel)}</span></div>
    <input id="nj-fuel" type="range" min="0" max="100" step="5" value="${S.fuel}" aria-label="Fuel">
    <div class="nj-fp">${b.fuel.map(f => `<button class="${S.fuel === f.v ? 'on' : ''}" data-nj="fuel" data-v="${f.v}">${esc(f.l === 'Half' ? '1/2' : f.l)}</button>`).join('')}</div></div>
  </section>
  <section class="card nj-card"><div class="card-h"><h2>Photos<span class="sub">${nOk} / ${b.photos.length}</span></h2></div>
   <p class="note">The odometer first, then the bike from the front, the back, the left and the right. They go to the customer on WhatsApp.</p>
   <div class="nj-photos">${ph}</div>
  </section>
  ${!b.wa ? '<div class="warnbox">WhatsApp is not connected on the server yet, so the job card is saved but nothing is sent. (Owner: once, <span class="mono">bash /root/bs-erp-update.sh jobcard</span>.)</div>' : ''}
  ${!b.photoDir ? '<div class="errbox">The photos cannot be saved on the server yet. (Owner: once, <span class="mono">bash /root/bs-erp-update.sh jobcard</span>.)</div>' : ''}
  ${bar(`Photos <b>${nOk} / ${b.photos.length}</b>`, `<button class="btn" data-nj="step" data-s="2">${ico('back')}Back</button>${saveBtn('save3', `${ico('send')}Finish and send WhatsApp`)}`)}`;
}
function pDone() {
  const d = S.done, s = d.sent || null, c = d.card || {};
  const wa = !s || s.state === 'sending' ? `<div class="nj-info">${ico('spin', 'i nj-spin')}<span>Sending the WhatsApp to the customer…</span></div>`
    : s.details && s.details.ok ? `<div class="nj-info ok"><span class="nj-tag">WhatsApp</span><span><b>Sent to the customer</b>: the job card details${s.photos && s.photos.of ? ` and ${s.photos.ok} of ${s.photos.of} photos` : ''}.${s.photos && s.photos.err ? `<br><small>A photo did not go: ${esc(s.photos.err)}</small>` : ''}</span></div>`
    : `<div class="errbox"><b>The WhatsApp did not go.</b> ${esc((s.details && s.details.err) || '')}<div style="margin-top:8px"><button class="btn" data-nj="resend">${ico('send')}Send again</button></div></div>`;
  const sms = s && s.state !== 'sending' && s.sms !== 'off' ? `<div class="nj-info ${s.sms ? 'ok' : ''}"><span class="nj-tag">SMS</span><span>${s.sms ? 'Sent' : 'Did not go'}</span></div>` : '';
  return `<section class="card nj-donec"><div class="nj-big">✓</div><h2>Job card #${d.id} is made</h2>
   <p class="muted"><span class="mono">${esc(c.p || '')}</span>${[c.mk, c.mo].filter(Boolean).length ? ' · ' + esc([c.mk, c.mo].filter(Boolean).join(' ')) : ''}${c.name ? ' · ' + esc(c.name) : ''}</p>
   <div class="nj-infos">${wa}${sms}</div>
   <p class="note">It waits for its mechanic and bay in the mechanic portal, like every job card. The cashier and the billing have it already.</p>
   <div class="nj-acts"><button class="btn pri" data-go="jc" data-param="${d.id}">Open job card #${d.id}</button><button class="btn" data-nj="another">${ic('plus')}Another new job card</button></div></section>`;
}
function page() {
  const head = (sub) => B.top(S.id ? `New job card <span class="mono">#${S.id}</span>` : 'New job card', sub, ['today', 'Today']);
  if (!B.jcOn()) return head('') + `<div class="warnbox">New job card is not switched on on this server yet. <a href="https://service.bikesurgeon.online/app/service-book.php" target="_blank" rel="noopener">Make it in the service app</a>.</div>`;
  if (!BOOT || S.loading) return head('') + (S.err && !BOOT ? errBox() : '<div class="card"><div class="empty">Opening…</div></div>');
  if (S.done) return head('Done') + pDone();
  if (S.id && !S.editable) return head('') + `<div class="warnbox">Job card #${S.id} is already with the mechanic (or closed), so it is not changed here.</div><div><button class="btn pri" data-go="jc" data-param="${S.id}">Open job card #${S.id}</button></div>`;
  const sub = `Step ${S.step} of 3 · ${STEPS[S.step - 1]}`;
  return head(sub) + (S.step === 1 ? p1() : S.step === 2 ? p2() : p3());
}
B.routes.new = () => `<div class="nj">${page()}</div>`;

// ---------------- events ---------------------------------------------------------------------------------------------------------
const here = () => B.ui.route === 'new';
document.addEventListener('click', e => {
  const t = e.target.closest('[data-nj]');
  if (!t || !here() || t.disabled) return;
  const a = t.dataset.nj, i = +t.dataset.i;
  switch (a) {
    case 'find': S.look = null; lookVehicle(); break;
    case 'bike': { const bk = S.cust && S.cust.bikes && S.cust.bikes[i]; if (bk) { S.f.reg = bk.p; S.f.make = bk.mk || S.f.make; S.f.model = bk.mo || S.f.model; S.auto.make = S.f.make; S.auto.model = S.f.model; S.look = null; lookVehicle(); R(); } break; }
    case 'cont': B.go('new', t.dataset.id); break;
    case 'save1': save1(); break;
    case 'save2': save2(); break;
    case 'save3': save3(); break;
    case 'step': { const n = +t.dataset.s; if (n >= 1 && n < S.step && S.id) to(n); break; }
    case 'cc': S.cc = t.dataset.v; S.ccFrom = ''; R(); break;
    case 'cat': S.labCat = t.dataset.v; R(); break;
    case 'add': { const id = +t.dataset.id; if (!S.cc) { S.err = 'Choose the engine CC first.'; R(); break; } if (!S.lab.some(l => !l.custom && l.id === id)) S.lab.push({ id }); S.err = ''; R(); break; }
    case 'rmid': S.lab = S.lab.filter(l => l.custom || l.id !== +t.dataset.id); R(); break;
    case 'rm': S.lab.splice(i, 1); R(); break;
    case 'addcu': { const n = S.cu.n.trim(), p = num(S.cu.p); if (!n) { S.err = 'Type the name of the custom labour.'; R(); break; } if (!(p > 0)) { S.err = 'Type the amount of the custom labour.'; R(); break; }
      S.lab.push({ custom: true, n, p }); S.cu = { n: '', p: '' }; S.err = ''; R(); break; }
    case 'gsc': { const g = BOOT.gsc[i], v = S.gsc[g] || {}; S.gsc[g] = v.checked ? { checked: false, answer: null } : { checked: true, answer: 'yes' }; R(); break; }
    case 'gsa': { const g = BOOT.gsc[i]; S.gsc[g] = { checked: true, answer: t.dataset.a }; R(); break; }
    case 'gscall': { const all = BOOT.gsc.every(g => S.gsc[g] && S.gsc[g].checked); for (const g of BOOT.gsc) S.gsc[g] = all ? { checked: false, answer: null } : { checked: true, answer: (S.gsc[g] && S.gsc[g].answer) || 'yes' }; R(); break; }
    case 'addis': addIssue(); break;
    case 'rmis': S.issues.splice(i, 1); S.remOpen = -1; R(); break;
    case 'remark': S.remOpen = S.remOpen === i ? -1 : i; R(); { const el = document.getElementById('nj-rem-' + i); if (el) el.focus(); } break;
    case 'readd': { const tx = t.dataset.t; if (tx && !S.issues.some(x => x.t === tx)) S.issues.push({ t: tx, r: '' }); R(); break; }
    case 'prev': S.showPrev = !S.showPrev; R(); break;
    case 'pts': S.showPts = !S.showPts; if (S.showPts && S.pt < 0) S.pt = nextPoint(); R(); break;
    case 'pt': { const nx = nextPoint(), v = S.points[BOOT.points[i]]; if ((!v || v.status === 'not_checked') && nx !== -1 && i > nx) { toast(`First: ${BOOT.points[nx]}`); break; } S.pt = S.pt === i ? -1 : i; S.ptStep = ''; R(); break; }
    case 'pst': if (S.pt >= 0) { setPoint(S.pt, t.dataset.s); R(); } break;
    case 'pstep': S.ptStep = t.dataset.s; S.ptDate = S.ptDate || BOOT.today; R(); break;
    case 'ptdate': if (S.pt >= 0) { if (!/^\d{4}-\d{2}-\d{2}$/.test(S.ptDate)) { toast('Choose a date'); break; } setPoint(S.pt, 'scheduled', S.ptDate); R(); } break;
    case 'dl': { const d = new Date(), k = t.dataset.v;
      if (k[0] === '+') { d.setHours(d.getHours() + +k.slice(1)); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); }
      else if (k === 't1830') d.setHours(18, 30, 0, 0);
      else { d.setDate(d.getDate() + 1); d.setHours(k === 'm12' ? 12 : 18, 0, 0, 0); }
      S.delivery = localDT(d); R(); break; }
    case 'fuel': S.fuel = +t.dataset.v; R(); break;
    case 'photo': { const f = picker(); f.dataset.k = t.dataset.k; f.click(); break; }
    case 'resend': if (S.done) B.api('POST', `/newjc/${S.done.id}/resend`).then(() => { S.done.sent = { state: 'sending' }; R(); watchSent(); }, x => toast(x.message)); break;
    case 'another': S = fresh(); B.ui.param = ''; try { history.replaceState(null, '', '#new'); } catch { /* sandboxed */ } ensureBoot().catch(() => {}); R(); window.scrollTo(0, 0); break;
  }
});
function addIssue() {
  const tx = S.issueIn.replace(/\s+/g, ' ').trim();
  if (!tx) { const el = document.getElementById('nj-issue'); if (el) el.focus(); return; }
  S.issues.push({ t: tx.slice(0, 300), r: '' }); S.issueIn = ''; R();
  const el = document.getElementById('nj-issue'); if (el) el.focus();
}
let labT = 0;
document.addEventListener('input', e => {
  const t = e.target, id = t.id || '';
  if (!here() || !id.startsWith('nj-')) return;
  const v = t.value;
  if (id === 'nj-reg') { const up = v.toUpperCase(); S.f.reg = up; if (up !== v) { const p = t.selectionStart; t.value = up; try { t.setSelectionRange(p, p); } catch { /* not a text box */ } } }
  else if (id === 'nj-phone') { S.f.phone = mobile10(v); if (/^\d{10}$/.test(S.f.phone)) lookPhone(); }
  else if (id === 'nj-name') S.f.name = v.slice(0, 80);
  else if (id === 'nj-make') S.f.make = v.slice(0, 40);
  else if (id === 'nj-model') S.f.model = v.slice(0, 60);
  else if (id === 'nj-labq') { S.labQ = v.slice(0, 40); clearTimeout(labT); labT = setTimeout(R, 120); }
  else if (id === 'nj-cun') S.cu.n = v;
  else if (id === 'nj-cup') S.cu.p = v;
  else if (id === 'nj-issue') S.issueIn = v;
  else if (id.startsWith('nj-rem-')) { const it = S.issues[+id.slice(7)]; if (it) it.r = v.replace(/\s+/g, ' ').slice(0, 300); }
  else if (id === 'nj-ptdate') S.ptDate = v;
  else if (id === 'nj-dl') S.delivery = v;
  else if (id === 'nj-odo') S.odo = v.replace(/\D/g, '').slice(0, 7);
  else if (id === 'nj-km') S.km = v.replace(/\D/g, '').slice(0, 5);
  else if (id === 'nj-fuel') { S.fuel = +v; const el = document.getElementById('nj-fuelv'); if (el) el.textContent = `${S.fuel}% · ${fuelLabel(S.fuel)}`; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (!here()) return;
  if (t.id === 'nj-fuel' || t.id === 'nj-dl') R();
  else if (t.id === 'nj-reg') lookVehicle();
});
document.addEventListener('keydown', e => {
  if (!here() || e.key !== 'Enter') return;
  const id = e.target.id || '';
  if (id === 'nj-reg') { e.preventDefault(); S.look = null; lookVehicle(); }
  else if (id === 'nj-issue') { e.preventDefault(); addIssue(); }
  else if (id === 'nj-cun' || id === 'nj-cup') { e.preventDefault(); document.querySelector('[data-nj="addcu"]').click(); }
  else if (id.startsWith('nj-rem-')) { e.preventDefault(); S.remOpen = -1; R(); }
});
document.addEventListener('focusout', e => { if (here() && e.target.id === 'nj-reg') lookVehicle(); });
// opened straight at #new (a reload): live.js drew the page before this file was there
if (B.ui.route === 'new' && B.ui.authed) B.onNew(B.ui.param);
})();
