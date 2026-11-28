// Bike Pharma RC lookup: a small server that works on its own (Node 18 or newer, no packages to install).
// Bike number -> our server -> VR Garage -> RC details back to the page. The VR Garage login stays on this server only.
// Run: copy .env.example to .env, fill the VR Garage login, then `node server.mjs` and open http://localhost:3060
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rcLook, rcClean, rcIsReg, rcOn } from './lib/rclook.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// .env -> process.env (lib/rclook.mjs reads it at each search, so this can come after the import)
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (e) { /* no .env file: the shell's environment is used */ }

const PORT = +process.env.PORT || 3060;
const HOST = process.env.HOST || '127.0.0.1';   // this computer only; put a login in front before opening it to the internet (each search costs a credit)

// Ask once: a number found once is saved here and read from here next time (Bike Pharma keeps the same in its database)
const SAVED = path.join(ROOT, 'data', 'rc-saved.json');
let saved = {};
try { saved = JSON.parse(fs.readFileSync(SAVED, 'utf8')) || {}; } catch (e) { saved = {}; }
const keep = () => { fs.mkdirSync(path.dirname(SAVED), { recursive: true }); fs.writeFileSync(SAVED + '.tmp', JSON.stringify(saved, null, 1)); fs.renameSync(SAVED + '.tmp', SAVED); };

// 40 searches per 10 minutes per caller (Bike Pharma: per staff login)
const hits = new Map();
const limited = who => { const now = Date.now(), l = (hits.get(who) || []).filter(t => now - t < 10 * 60 * 1000); l.push(now); hits.set(who, l); return l.length > 40; };

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/rclook' && req.method === 'GET') {
    if (limited(req.socket.remoteAddress || '')) return send(res, 429, { error: 'Too many registration searches, try again in a few minutes' });
    const reg = rcClean(url.searchParams.get('r'));
    const sv = rcIsReg(reg) ? saved[reg] : null;
    if (sv && sv.r) return send(res, 200, { ...sv.r, saved: sv.at });   // already asked: no VR Garage call, no credit used
    const rr = await rcLook(reg);
    if (rr && rr.found) { saved[reg] = { at: new Date().toISOString(), r: rr }; keep(); }
    return send(res, 200, rr);
  }
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(ROOT, 'public', 'index.html')));
  }
  res.writeHead(404); res.end('Not found');
}).listen(PORT, HOST, () => console.log(`RC lookup on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (VR Garage ${rcOn() ? 'ready' : 'OFF: fill .env'})`));
