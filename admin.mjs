#!/usr/bin/env node
// Bike Pharma admin commands (run in the site folder):
//   node admin.mjs add-admin <email-or-mobile> "<name>" [--password <pw>]   first admin login (asks for the password)
//   node admin.mjs set-password <login> [--password <pw>]                   new password for any staff login
//   node admin.mjs list                                                      all logins
//   node admin.mjs has-admin                                                 exit 0 when an admin exists
//   node admin.mjs clear-demo                                                remove the demo orders/bills/stock moves (keeps logins, settings, products)
//   node admin.mjs reset-demo                                                put the demo data back (keeps logins)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openStore } from './lib/store.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
try { for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const args = process.argv.slice(2); const cmd = args[0];
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const pos = args.filter((a, i) => i > 0 && !a.startsWith('--') && args[i - 1] !== '--password');
const normId = v => { v = String(v || '').trim().toLowerCase(); if (v.includes('@')) return v; const d = v.replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };
const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
function hashPw(pw) { const salt = crypto.randomBytes(16); const h = crypto.scryptSync(String(pw), salt, 32); return salt.toString('hex') + ':' + h.toString('hex'); }
function askHidden(q) {
  return new Promise(ok => {
    if (!process.stdin.isTTY) { let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => s += d); process.stdin.on('end', () => ok(s.trim())); return; }
    process.stdout.write(q); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8'); let s = '';
    const on = c => { if (c === '\u0003') process.exit(1); if (c === '\r' || c === '\n') { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', on); process.stdout.write('\n'); ok(s); } else if (c === '\u007f' || c === '\b') s = s.slice(0, -1); else s += c; };
    process.stdin.on('data', on);
  });
}
const store = openStore(DATA_DIR);
const state = k => { const r = store.stateGet(k); return r ? JSON.parse(r.json) : undefined; };
const accounts = () => state('accounts') || {};
const seed = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'seed.json'), 'utf8'));

async function main() {
  if (cmd === 'has-admin') { const ok = Object.values(accounts()).some(a => a.role === 'admin'); console.log(ok ? 'admin exists' : 'no admin yet'); process.exit(ok ? 0 : 1); }
  if (cmd === 'list') {
    const a = accounts(); const pw = new Set(store.kvAll('pw').map(([k]) => k));
    for (const [id, x] of Object.entries(a)) console.log(`${id.padEnd(28)} ${String(x.role).padEnd(10)} ${String(x.name).padEnd(24)} ${x.status || ''}${pw.has(id) ? '  [password set]' : ''}`);
    if (!Object.keys(a).length) console.log('(no logins yet)');
    return;
  }
  if (cmd === 'add-admin' || cmd === 'add-staff') {
    const id = normId(pos[0]); const name = (pos[1] || '').trim();
    if (!id || !name) { console.error('usage: node admin.mjs add-admin <email-or-mobile> "<name>" [--password <pw>]'); process.exit(2); }
    const a = accounts();
    if (a[id] && a[id].role !== 'admin') { console.error(`${id} already exists as ${a[id].role}`); process.exit(2); }
    let pw = opt('--password'); if (!pw) { pw = await askHidden('Password for ' + id + ' (min 6 chars): '); }
    if (!pw || pw.length < 6) { console.error('password must be at least 6 characters'); process.exit(2); }
    if (store.rev() === 0) { const s = seed(); s.accounts = {}; const w = {}; for (const [k, v] of Object.entries(s)) w[k] = JSON.stringify(v); store.write(w); }
    const n = Object.values(a).filter(x => x.role === 'admin').length + 1; const sid = 'BP-HQ-ADM-' + String(n).padStart(3, '0');
    a[id] = a[id] || { role: 'admin', name, label: 'Admin', sub: 'Staff ID ' + sid, sid, status: 'active', joined: today() };
    a[id].name = name;
    store.write({ accounts: JSON.stringify(a) });
    store.kvSet('pw', id, hashPw(pw));
    console.log(`admin login ready: ${id}`);
    return;
  }
  if (cmd === 'set-password') {
    const id = normId(pos[0]); if (!id) { console.error('usage: node admin.mjs set-password <login> [--password <pw>]'); process.exit(2); }
    if (!accounts()[id]) { console.error(`${id} is not a login (create it in the app first: Admin > Users > New staff login)`); process.exit(2); }
    let pw = opt('--password'); if (!pw) pw = await askHidden('New password for ' + id + ': ');
    if (!pw || pw.length < 6) { console.error('password must be at least 6 characters'); process.exit(2); }
    store.kvSet('pw', id, hashPw(pw));
    for (const [t, s] of store.kvAll('sess')) if (s.uid === id) store.kvDel('sess', t);
    console.log('password updated for ' + id);
    return;
  }
  if (cmd === 'clear-demo') {
    const keep = accounts(); const w = {};
    const empty = { orders: [], wl: [], cl: [], minv: [], pos: [], tasks: [], sorders: [], omech: {}, approvals: [], audit: [], bills: [], moves: [], grns: [], warranties: [], cu: {}, cwl: {}, chats: {}, reviews: [], returns: [], jobs: [], ests: [], kyc: [], mcust: [], held: [], campaigns: [], closings: [], exp: [], fcol: [], orec: [], sret: [], retSt: {}, visits: {}, nprefs: {}, discReq: {}, damaged: {}, batches: [], sups: [], secDone: [], schemes: [], seedOT: 1, seed10: 1, cwlFix: 1, noSeed: 1, notifs: 0 };
    for (const [k, v] of Object.entries(empty)) w[k] = JSON.stringify(v);
    for (const k of ['docs']) if (state(k) !== undefined) w[k] = null;
    w.accounts = JSON.stringify(keep);
    store.write(w);
    console.log('demo rows removed (logins, settings, products and stock kept)');
    return;
  }
  if (cmd === 'reset-demo') {
    const keep = accounts(); const s = seed(); const w = {};
    for (const [k, v] of Object.entries(s)) w[k] = JSON.stringify(v);
    w.accounts = JSON.stringify(keep); w.noSeed = JSON.stringify(0);
    store.write(w);
    console.log('demo data restored (logins kept)');
    return;
  }
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(cmd ? 2 : 0);
}
main().then(() => { store.close(); }).catch(e => { console.error(e.message); process.exit(1); });
