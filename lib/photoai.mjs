// Product photo cleanup (Sam 2026-10-11 16:59Z "parts ka image jab kheenchenge tabhi automatically background clear hona he aur halka se
// bike pharma ka water mark aana he", 17:11Z "watermark photo ke back me aana he", "water mark me sirf logo aana he", 17:25Z "Haan AI model
// download karo"). Every product photo stays in data/photos/<hash>.<ext> exactly as taken; ai/worker.mjs adds two copies next to it:
//   <hash>-c.jpg  the part on white, the faint logo behind it (what the app shows)
//   <hash>-w.jpg  "Original": the photo as taken, the faint logo behind the part
// The AI runs in its own process (the website keeps its memory), one photo at a time, at low priority, only while there is work.
// AI_VER: copies made by an older cleanup are made again (version 2: Sam 18:13Z-18:32Z, only the part stays: no hand, nothing else;
// version 3: Sam 22:24Z-22:41Z, room light colour out, soft shadow, fainter logo, and the cleanup checks and improves itself;
// version 4: 2026-10-22 green screen photos (update 10w: phones had the old black 'Original' kept; 'Not right' taps from before start fresh).
// Learning (Sam 22:35Z "o khud ko improve karte rehna he"): ai/worker.mjs can find the part in a few ways (WAYS there). Each photo
// tells which way won for its kind of photo; data/photos/ai-learn.json keeps the count, and the next photo of that kind tries the
// winner first. When staff tap "Not right" on a photo, that way loses a point and the photo is made again another way.
// <hash>.ai keeps what was done to each photo: { v, way, kind, why, bad } (bad = the ways staff said were wrong for it).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fork } from 'node:child_process';

const HX = /^[a-f0-9]{32}$/;
const WAYS = ['std', 'mend', 'none', 'green'];   // the same names as WAYS in ai/worker.mjs (+ green: a green screen photo, update 10v)
const EXTS = ['jpg', 'png', 'webp'];
export const AI_VER = 4;   // the app asks for the copies with ?v=<this> (tools/invcat.py PH_AI), so phones never keep an older one
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
  // what was done to a photo (older copies only had the version number in it; none: version 1)
  const info = h => { try { const t = fs.readFileSync(verFile(h), 'utf8').trim(); if (t[0] === '{') { const j = JSON.parse(t); return j && typeof j === 'object' ? j : { v: 1 }; } return { v: +t || 1 }; } catch (e) { return { v: 1 }; } };
  const badOf = h => { const i = info(h); return (i.v || 1) >= AI_VER && Array.isArray(i.bad) ? i.bad : []; };   // 'Not right' taps count only for this version's cleanup
  const ver = h => +info(h).v || 1;
  const current = h => hasOut(h) && ver(h) >= AI_VER && !info(h).redo;
  // which way wins for which kind of photo: { kind: { way: [wins, losses] } }
  const learnFile = path.join(photoDir, 'ai-learn.json');
  let learn = {}; try { const j = JSON.parse(fs.readFileSync(learnFile, 'utf8')); if (j && typeof j.k === 'object') learn = j.k; } catch (e) { /* none yet */ }
  let learnT = null;
  function score(kind, way, win) {
    if (!/^[a-z-]{1,4}$/.test(kind || '') || !WAYS.includes(way)) return;
    const k = learn[kind] || (learn[kind] = {}), s = k[way] || (k[way] = [0, 0]);
    s[win ? 0 : 1]++;
    // old counts weigh less over time, so a better way can still take over
    if (s[0] + s[1] > 200) { s[0] = Math.round(s[0] / 2); s[1] = Math.round(s[1] / 2); }
    clearTimeout(learnT); learnT = setTimeout(() => { learnT = null; try { const tmp = learnFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ v: 1, k: learn })); fs.renameSync(tmp, learnFile); } catch (e) { /* tried again with the next photo */ } }, 2000);
    learnT.unref();
  }
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
    child.send({ type: 'job', h: cur.h, src: cur.src, outC: out(cur.h, 'c'), outW: out(cur.h, 'w'), learn, avoid: badOf(cur.h).filter(w => WAYS.includes(w)) });
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
          const was = info(m.h), tried = Array.isArray(m.tried) ? m.tried : [];
          // the way kept wins; a way tried first that looked wrong loses
          if (m.way) score(m.kind, m.way, true);
          if (tried.length > 1 && tried[0].way !== m.way && tried[0].pen > 0) score(m.kind, tried[0].way, false);
          const rec = { v: AI_VER, way: m.way || '', kind: m.kind || '', why: Array.isArray(m.why) ? m.why.slice(0, 5) : [], bad: badOf(m.h), at: new Date().toISOString() };
          try { fs.writeFileSync(verFile(m.h), JSON.stringify(rec)); } catch (e) { /* made again next start */ }
          try { fs.unlinkSync(failFile(m.h)); } catch (e) { /* none */ }
          log('photo', m.h, 'cleaned', m.width + 'x' + m.height, m.ms + ' ms', m.way || '', (m.why || []).join(',') || 'ok');
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
  // staff: "Not right" on a photo. That way loses a point and the photo is made again the next best way it has not had yet.
  // { ok, left } (left = ways still to try; 0: every way was tried, the photo needs taking again)
  function wrong(h) {
    if (!HX.test(h) || !orig(h)) return { ok: false, error: 'Photo not found' };
    const was = info(h);
    if (!hasOut(h) || ver(h) < AI_VER || !was.way) return { ok: false, error: 'This photo is still being cleaned' };
    if (was.redo) return { ok: true, left: WAYS.filter(w => !(was.bad || []).includes(w)).length };
    const bad = [...new Set([...(was.bad || []), was.way])].filter(w => WAYS.includes(w)), left = WAYS.filter(w => !bad.includes(w));
    score(was.kind, was.way, false);
    if (!left.length) {
      try { fs.writeFileSync(verFile(h), JSON.stringify({ ...was, bad, why: [...new Set([...(was.why || []), 'tried'])] })); } catch (e) { /* stays as it is */ }
      return { ok: true, left: 0 };
    }
    try { fs.writeFileSync(verFile(h), JSON.stringify({ ...was, bad, redo: 1 })); } catch (e) { return { ok: false, error: 'Could not save this' }; }
    try { fs.unlinkSync(failFile(h)); } catch (e) { /* none */ }
    enqueue(h);
    return { ok: true, left: left.length };
  }
  // what the check found on a photo: why = things to do better when taking it (edge, small, unsure, bite, hand, nopart, tried)
  const check = h => { const i = info(h); return i.v >= AI_VER ? { why: i.why || [], way: i.way || '', tries: (i.bad || []).length } : null; };
  function stop() { clearTimeout(wakeTimer); clearTimeout(idleTimer); if (child) child.kill(); }
  return { enqueue, status, summary, backfill, stop, current, wrong, check };
}
