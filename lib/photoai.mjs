// Product photo cleanup (Sam 2026-10-11 16:59Z "parts ka image jab kheenchenge tabhi automatically background clear hona he aur halka se
// bike pharma ka water mark aana he", 17:11Z "watermark photo ke back me aana he", "water mark me sirf logo aana he", 17:25Z "Haan AI model
// download karo"). Every product photo stays in data/photos/<hash>.<ext> exactly as taken; ai/worker.mjs adds two copies next to it:
//   <hash>-c.jpg  the part on white, the faint logo behind it (what the app shows)
//   <hash>-w.jpg  "Original": the photo as taken, the faint logo behind the part
// The AI runs in its own process (the website keeps its memory), one photo at a time, at low priority, only while there is work.
// AI_VER: copies made by an older cleanup are made again (version 2: Sam 18:13Z-18:32Z, only the part stays: no hand, nothing else).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fork } from 'node:child_process';

const HX = /^[a-f0-9]{32}$/;
const EXTS = ['jpg', 'png', 'webp'];
export const AI_VER = 2;   // the app asks for the copies with ?v=<this> (tools/invcat.py PH_AI), so phones never keep an older one
const JOB_MS = 180e3, START_MS = 30 * 60e3, IDLE_MS = 60e3, HOLD_MS = 10 * 60e3, LOWMEM_MS = 120e3;

export function photoAi({ root, photoDir, dataDir, env = process.env }) {
  const worker = path.join(root, 'ai', 'worker.mjs');
  const needMb = +env.PHOTO_AI_MIN_MB || 950;   // the AI needs about 0.9 GB while it works on a photo
  const off = /^(0|off|no|false)$/i.test(String(env.PHOTO_AI || '').trim());
  const log = (...a) => console.log(new Date().toISOString(), 'photo-ai', ...a);
  const q = [];
  let child = null, up = false, cur = null, jobTimer = null, idleTimer = null, wakeTimer = null, holdUntil = 0;
  let state = 'ready', error = '', done = 0, crashes = 0;

  const installed = () => fs.existsSync(worker) && ['sharp', 'onnxruntime-node'].every(m => fs.existsSync(path.join(root, 'ai', 'node_modules', m, 'package.json')));
  const out = (h, v) => path.join(photoDir, `${h}-${v}.jpg`);
  const hasOut = h => fs.existsSync(out(h, 'c')) && fs.existsSync(out(h, 'w'));
  const verFile = h => path.join(photoDir, `${h}.ai`);
  const ver = h => { try { return +fs.readFileSync(verFile(h), 'utf8') || 1; } catch (e) { return 1; } };   // copies with no mark: version 1
  const current = h => hasOut(h) && ver(h) >= AI_VER;
  const orig = h => { for (const e of EXTS) { const f = path.join(photoDir, `${h}.${e}`); if (fs.existsSync(f)) return f; } return ''; };
  const failFile = h => path.join(photoDir, `${h}.fail`);
  const fails = h => { try { const j = JSON.parse(fs.readFileSync(failFile(h), 'utf8')); return (j.v || 1) < AI_VER ? 0 : j.n || 0; } catch (e) { return 0; } };
  const clean = s => String(s || '').replace(/(?:\/[\w.@+-]+)+\/([\w.@+-]+)/g, '$1').slice(0, 200);   // no server folders in messages
  const held = () => Date.now() < holdUntil;
  function memMb() { try { const m = /MemAvailable:\s+(\d+)/.exec(fs.readFileSync('/proc/meminfo', 'utf8')); return m ? +m[1] / 1024 : Infinity; } catch (e) { return Infinity; } }
  function fail(h, msg) {
    const n = fails(h) + 1;
    try { fs.writeFileSync(failFile(h), JSON.stringify({ n, v: AI_VER, error: clean(msg), at: new Date().toISOString() })); } catch (e) { /* folder not writable: it is tried again next start */ }
    log('photo', h, 'not cleaned (' + n + '):', clean(msg));
  }
  function later(ms) { clearTimeout(wakeTimer); wakeTimer = setTimeout(() => { wakeTimer = null; kick(); }, Math.max(1000, ms)); wakeTimer.unref(); }

  function enqueue(h) {
    if (off || !HX.test(h) || (cur && cur.h === h) || q.includes(h) || current(h) || fails(h) >= 2 || !orig(h)) return;
    q.push(h); kick();
  }
  function kick() {
    if (off || cur) return;
    if (!q.length) { if (child && !idleTimer) idleTimer = setTimeout(() => { idleTimer = null; if (!cur && child) child.disconnect(); }, IDLE_MS); return; }
    if (held()) return later(holdUntil - Date.now());
    if (!installed()) { state = 'not installed'; return; }
    if (!child) {
      const mb = memMb();
      if (mb < needMb) { state = 'low memory'; error = `${Math.round(mb)} MB free memory, ${needMb} MB needed`; holdUntil = Date.now() + LOWMEM_MS; return later(LOWMEM_MS); }
      start();
    }
    clearTimeout(idleTimer); idleTimer = null;
    const h = q.shift(), src = orig(h);
    if (!src || current(h)) return kick();
    cur = { h, src }; state = 'working';
    if (up) send();
  }
  function send() {
    child.send({ type: 'job', h: cur.h, src: cur.src, outC: out(cur.h, 'c'), outW: out(cur.h, 'w') });
    const c = child; clearTimeout(jobTimer); jobTimer = setTimeout(() => { log('photo', cur && cur.h, 'took too long'); c.kill('SIGKILL'); }, JOB_MS);
  }
  function start() {
    up = false;
    const c = child = fork(worker, [], { cwd: root, env: { ...env, DATA_DIR: dataDir }, execArgv: [], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    try { os.setPriority(c.pid, 10); } catch (e) { /* runs at normal priority */ }
    clearTimeout(jobTimer); jobTimer = setTimeout(() => { log('the AI did not start in time'); c.kill('SIGKILL'); }, START_MS);   // the first start downloads the model
    c.on('message', m => {
      if (c !== child || !m) return;
      if (m.type === 'up') { up = true; clearTimeout(jobTimer); if (cur) send(); return; }
      if (m.type === 'fatal') {   // the AI itself could not load (model download, a missing library): the photos keep their place, tried again later
        error = clean(m.error); state = 'error'; holdUntil = Date.now() + HOLD_MS; log('the AI could not start:', error);
        if (cur) { q.unshift(cur.h); cur = null; }
        return;
      }
      if (m.type === 'done' && cur && m.h === cur.h) {
        clearTimeout(jobTimer);
        if (m.ok) {
          done++; crashes = 0; error = '';
          try { fs.writeFileSync(verFile(m.h), String(AI_VER)); } catch (e) { /* made again next start */ }
          try { fs.unlinkSync(failFile(m.h)); } catch (e) { /* none */ }
          log('photo', m.h, 'cleaned', m.width + 'x' + m.height, m.ms + ' ms');
        } else fail(m.h, m.error);
        cur = null; state = 'ready'; kick();
      }
    });
    const gone = why => {
      if (c !== child) return;
      clearTimeout(jobTimer); clearTimeout(idleTimer); idleTimer = null; child = null; up = false;
      if (cur) { fail(cur.h, `the AI process stopped (${why})`); cur = null; crashes++; }
      if (crashes >= 3) { crashes = 0; state = 'error'; error = 'the AI process keeps stopping (server memory?)'; holdUntil = Date.now() + HOLD_MS; }
      if (state === 'working') state = 'ready';
      kick();
    };
    c.on('exit', (code, sig) => gone(sig || code));
    c.on('error', e => { log('AI process:', clean(e && e.message)); if (!c.pid) gone('could not start'); });
  }

  // one photo: done | working | queued | waiting (the AI is paused: error or low memory) | failed | off | missing
  // (copies from an older version are shown until the new ones are made; if the new ones cannot be made, those stay: done)
  function status(h) {
    if (!HX.test(h)) return 'missing';
    if (current(h)) return 'done';
    if (cur && cur.h === h) return 'working';
    if (!q.includes(h)) {
      if (!orig(h)) return hasOut(h) ? 'done' : 'missing';
      if (off || !installed()) return hasOut(h) ? 'done' : 'off';
      if (fails(h) >= 2) return hasOut(h) ? 'done' : 'failed';
      enqueue(h);
      if (cur && cur.h === h) return 'working';
      if (!q.includes(h)) return 'failed';
    }
    return held() || !installed() ? 'waiting' : 'queued';
  }
  function summary() {
    const s = off ? 'off' : !installed() ? 'not installed' : (state === 'low memory' || state === 'error') && !held() && !cur ? 'ready' : state;
    return { state: s, version: AI_VER, queued: q.length + (cur ? 1 : 0), done, error: s === 'ready' || s === 'working' || s === 'off' ? '' : error };
  }
  // photos saved before the AI was there (or while it was off, or cleaned by an older version) get their copies too
  function backfill() {
    if (off) return;
    const n0 = q.length + (cur ? 1 : 0);
    try { for (const f of fs.readdirSync(photoDir)) { const m = /^([a-f0-9]{32})\.(jpg|png|webp)$/.exec(f); if (m) enqueue(m[1]); } } catch (e) { /* no photos yet */ }
    const n = q.length + (cur ? 1 : 0) - n0; if (n > 0) log(n, 'older photo(s) to clean');
  }
  function stop() { clearTimeout(wakeTimer); clearTimeout(idleTimer); if (child) child.kill(); }
  return { enqueue, status, summary, backfill, stop, current };
}
