// "Apna AI" bill reader (Sam 2026-10-11 20:10Z): ai/billread.mjs reads a bill page in its own process, so the website keeps its memory.
// It starts when a page comes in, reads one page at a time, and ends after a few idle minutes. The page is passed in memory only:
// nothing is written to disk, nothing is kept.
import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';

const START_MS = 5 * 60e3, JOB_MS = 120e3, IDLE_MS = 3 * 60e3, HOLD_MS = 5 * 60e3;

export function billAi({ root, dataDir, env = process.env }) {
  const worker = path.join(root, 'ai', 'billread.mjs');
  const off = /^(0|off|no|false)$/i.test(String(env.BILL_AI || '').trim());
  const needMb = +env.BILL_AI_MIN_MB || 400;   // about 0.3 GB while it reads
  const log = (...a) => console.log(new Date().toISOString(), 'bill-ai', ...a);
  const clean = s => String(s || '').replace(/(?:\/[\w.@+-]+)+\/([\w.@+-]+)/g, '$1').slice(0, 200);
  const q = [];
  let child = null, up = false, cur = null, seq = 0, jobTimer = null, idleTimer = null, holdUntil = 0, state = 'ready', error = '', done = 0;

  const installed = () => fs.existsSync(worker) && ['sharp', 'onnxruntime-node'].every(m => fs.existsSync(path.join(root, 'ai', 'node_modules', m, 'package.json')));
  function memMb() { try { const m = /MemAvailable:\s+(\d+)/.exec(fs.readFileSync('/proc/meminfo', 'utf8')); return m ? +m[1] / 1024 : Infinity; } catch (e) { return Infinity; } }
  const fail = (j, why) => { const e = new Error(why); e.code = 'unavailable'; j.reject(e); };

  // type 'read' = a bill page; 'nums' = where the ref numbers sit on a catalogue diagram (update 8m). A bill goes before the diagrams
  // waiting (someone is looking at the bill screen); at most 12 diagrams wait.
  function job(type, buf) {
    return new Promise((resolve, reject) => {
      const j = { id: ++seq, type, buf, resolve, reject };
      if (off) return fail(j, 'The bill reader is turned off on this server.');
      if (!installed()) return fail(j, 'The bill reader is not installed on this server yet.');
      if (Date.now() < holdUntil) return fail(j, 'The bill reader could not start: ' + (error || 'try again in a few minutes'));
      if (q.length >= 30) return fail(j, 'Too many pages waiting. Try again in a minute.');
      if (type === 'nums' && q.filter(x => x.type === 'nums').length >= 12) return fail(j, 'busy');
      if (type === 'read') { const k = q.findIndex(x => x.type === 'nums'); if (k >= 0) q.splice(k, 0, j); else q.push(j); } else q.push(j);
      kick();
    });
  }
  const read = buf => job('read', buf), nums = buf => job('nums', buf);
  function kick() {
    if (cur) return;
    if (!q.length) { if (child && !idleTimer) idleTimer = setTimeout(() => { idleTimer = null; if (!cur && child) child.disconnect(); }, IDLE_MS); return; }
    if (!child) {
      const mb = memMb();
      if (mb < needMb) { state = 'low memory'; error = `${Math.round(mb)} MB free memory, ${needMb} MB needed`; while (q.length) fail(q.shift(), 'The server is short of memory right now (' + error + ').'); return; }
      start();
    }
    clearTimeout(idleTimer); idleTimer = null;
    cur = q.shift(); state = 'reading';
    if (up) send();
  }
  function send() {
    child.send({ type: cur.type, id: cur.id, img: cur.buf });
    const c = child; clearTimeout(jobTimer); jobTimer = setTimeout(() => { log('a page took too long'); c.kill('SIGKILL'); }, JOB_MS);
  }
  function start() {
    up = false;
    const c = child = fork(worker, [], { cwd: root, env: { ...env, DATA_DIR: dataDir }, execArgv: [], serialization: 'advanced', stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    clearTimeout(jobTimer); jobTimer = setTimeout(() => { log('the bill reader did not start in time'); c.kill('SIGKILL'); }, START_MS);   // the first start downloads the models
    c.on('message', m => {
      if (c !== child || !m) return;
      if (m.type === 'up') { up = true; clearTimeout(jobTimer); if (cur) send(); return; }
      if (m.type === 'fatal') {
        error = clean(m.error); state = 'error'; holdUntil = Date.now() + HOLD_MS; log('the bill reader could not start:', error);
        if (cur) { fail(cur, 'The bill reader could not start: ' + error); cur = null; }
        while (q.length) fail(q.shift(), 'The bill reader could not start: ' + error);
        return;
      }
      if (m.type === 'done' && cur && m.id === cur.id) {
        clearTimeout(jobTimer); const j = cur; cur = null; state = 'ready';
        if (m.ok) { done++; j.resolve(j.type === 'nums' ? { toks: m.toks, lo: m.lo, w: m.w, h: m.h, ms: m.ms } : { text: m.text, rows: m.rows, boxes: m.boxes, ms: m.ms }); } else j.reject(new Error(clean(m.error) || 'could not read this page'));
        kick();
      }
    });
    c.on('exit', (code, sig) => {
      if (c !== child) return;
      child = null; up = false; clearTimeout(jobTimer);
      if (cur) { log('the bill reader stopped while reading (' + (sig || code) + ')'); fail(cur, 'The bill reader stopped while reading this page. Please try again.'); cur = null; }
      if (state !== 'error') state = 'ready';
      kick();
    });
  }
  return {
    read,
    nums,
    summary: () => ({ state: off ? 'off' : !installed() ? 'not installed' : state, model: fs.existsSync(path.join(dataDir, 'models', 'ppocr', 'ch_PP-OCRv4_rec_infer.onnx')), error, done, up: !!child }),
  };
}
