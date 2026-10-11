// Bill reader, "Apna AI" (Sam 2026-10-11 20:10Z: our own AI on his server, free; "photo bahar nahi jayegi").
// PaddleOCR PP-OCRv4 (Apache-2.0): one model finds the lines of writing on the page, another reads each one. Run with ONNX Runtime on
// the server's CPU, like the photo AI. The phone sends the page it has already cut out, straightened and cleaned (app: ocrPrep); this
// reads it in memory and sends back the text, row by row. The picture is never written to disk and never kept.
// Models: the @gutenye/ocr-models 1.4.2 package on the npm registry (PaddleOCR's models in ONNX form), downloaded once into
// data/models/ppocr/ (~16 MB) and checked byte for byte.
//   on a computer:  node ai/billread.mjs --test <photo>        ai/install.sh: --model (download once), --check (loads here)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..');
function dataDir() {   // the same data folder as server.mjs
  if (process.env.DATA_DIR) return path.resolve(ROOT, process.env.DATA_DIR);
  try { const m = /^\s*DATA_DIR\s*=\s*"?(.*?)"?\s*$/m.exec(fs.readFileSync(path.join(ROOT, '.env'), 'utf8')); if (m && m[1]) return path.resolve(ROOT, m[1]); } catch (e) { /* no .env */ }
  return path.join(ROOT, 'data');
}
const DIR = path.join(dataDir(), 'models', 'ppocr');
const PKG = { url: 'https://registry.npmjs.org/@gutenye/ocr-models/-/ocr-models-1.4.2.tgz', sha1: '06c61c34dcda863a0babe9b033721613b87457c8' };
const FILES = {
  det: { from: 'package/assets/ch_PP-OCRv4_det_infer.onnx', sha256: '30a86f5731181461d08021402766601e4302a9b9b9666be8aff402696339cdff', size: 4745517 },
  rec: { from: 'package/assets/ch_PP-OCRv4_rec_infer.onnx', sha256: '06b3e6af6c59a1ba5d53790ed8c2e4b2de389870b6cf5a97f349f3412cb269c0', size: 10822323 },
  keys: { from: 'package/assets/ppocr_keys_v1.txt', sha256: '28b2362ad4ab2dc38769aa72feb535e3a9ddb3fd2a7585a05920e6393b1dc7f7', size: 26249 },
};
const fileOf = k => path.join(DIR, path.basename(FILES[k].from));
const MAX_SIDE = 3000;   // the page is read up to this size (the phone sends at most 2600 px)
const DET_SIDE = 1600;   // the line finder works on a copy this big (tested: 960 misses commas and points, 1600 reads them)
const REC_H = 48;        // the reader's line height (PP-OCRv4)

let sharp, ort, det, rec, CH;
const log = (...a) => console.log(new Date().toISOString(), 'bill-ai', ...a);
const msg = e => String(e && e.message || e).slice(0, 300);

function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'bikepharma-site' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 6) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, hops + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('model download: HTTP ' + res.statusCode)); }
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c))); res.on('error', reject);
    }).on('error', reject);
  });
}
const hash = (alg, b) => crypto.createHash(alg).update(b).digest('hex');
// the files we need out of the package (a .tgz: gzip round a tar)
export function untar(tgz) {
  const t = zlib.gunzipSync(tgz), out = {};
  for (let o = 0; o + 512 <= t.length;) {
    const h = t.subarray(o, o + 512); if (h.every(x => x === 0)) break;
    const str = (a, b) => h.toString('latin1', a, b).replace(/\0.*$/s, '');
    const name = (str(345, 500) ? str(345, 500) + '/' : '') + str(0, 100), size = parseInt(str(124, 136).trim() || '0', 8) || 0;
    out[name] = t.subarray(o + 512, o + 512 + size); o += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
async function models() {
  const ok = k => { try { return fs.statSync(fileOf(k)).size === FILES[k].size; } catch (e) { return false; } };
  if (Object.keys(FILES).every(ok)) return;
  fs.mkdirSync(DIR, { recursive: true });
  log('downloading the bill reader models (~10 MB, once)');
  const tgz = await get(PKG.url);
  if (hash('sha1', tgz) !== PKG.sha1) throw new Error('model download: the package is not the expected one');
  const files = untar(tgz);
  for (const [k, f] of Object.entries(FILES)) {
    const b = files[f.from]; if (!b || hash('sha256', b) !== f.sha256) throw new Error('model download: ' + path.basename(f.from) + ' is not the expected one');
    const tmp = fileOf(k) + '.' + process.pid + '.part'; fs.writeFileSync(tmp, b); fs.renameSync(tmp, fileOf(k));
  }
  log('bill reader models ready');
}
async function ready() {
  if (rec) return;
  sharp = (await import('sharp')).default;
  ort = (await import('onnxruntime-node')).default;
  sharp.concurrency(1); sharp.cache(false);
  await models();
  const opt = { intraOpNumThreads: Math.max(1, Math.min(2, os.cpus().length - 1)), interOpNumThreads: 1, graphOptimizationLevel: 'all' };
  det = await ort.InferenceSession.create(fileOf('det'), opt);
  rec = await ort.InferenceSession.create(fileOf('rec'), opt);
  const keys = fs.readFileSync(fileOf('keys'), 'utf8').split(/\r?\n/); if (keys[keys.length - 1] === '') keys.pop();
  CH = ['', ...keys, ' '];   // 0 = the "nothing here" mark, then the letters, then the space
}

// 1. where the writing is: the finder marks each line (or table cell) of text; each mark, grown back to the text's size, is a box
async function boxesOf(g, w, h) {
  const s = Math.min(1, DET_SIDE / Math.max(w, h)), W = Math.max(32, Math.round(w * s / 32) * 32), H = Math.max(32, Math.round(h * s / 32) * 32);
  const sx = W / w, sy = H / h;
  const px = await sharp(g, { raw: { width: w, height: h, channels: 1 } }).resize(W, H, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer();
  const N = W * H, t = new Float32Array(3 * N), mean = [0.485, 0.456, 0.406], sd = [0.229, 0.224, 0.225];
  for (let c = 0; c < 3; c++) { const o = c * N; for (let i = 0; i < N; i++) t[o + i] = (px[i] / 255 - mean[c]) / sd[c]; }
  const out = await det.run({ [det.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, H, W]) });
  const map = out[det.outputNames[0]].data, lab = new Uint8Array(N), st = new Int32Array(N), boxes = [];
  for (let i = 0; i < N; i++) {
    if (lab[i] || map[i] <= 0.3) continue;
    let sp = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0, sum = 0; st[sp++] = i; lab[i] = 1;
    while (sp) {
      const j = st[--sp], y = (j / W) | 0, x = j - y * W; n++; sum += map[j];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !lab[j - 1] && map[j - 1] > 0.3) { lab[j - 1] = 1; st[sp++] = j - 1; }
      if (x < W - 1 && !lab[j + 1] && map[j + 1] > 0.3) { lab[j + 1] = 1; st[sp++] = j + 1; }
      if (y > 0 && !lab[j - W] && map[j - W] > 0.3) { lab[j - W] = 1; st[sp++] = j - W; }
      if (y < H - 1 && !lab[j + W] && map[j + W] > 0.3) { lab[j + W] = 1; st[sp++] = j + W; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (Math.min(bw, bh) < 3 || sum / n < 0.6) continue;   // too small, or not sure enough it is writing
    const d = bw * bh * 1.5 / (2 * (bw + bh));               // the mark is a shrunk copy of the text: grow it back (PaddleOCR's 1.5)
    const b = { x0: Math.max(0, (x0 - d) / sx), y0: Math.max(0, (y0 - d) / sy), x1: Math.min(w, (x1 + 1 + d) / sx), y1: Math.min(h, (y1 + 1 + d) / sy) };
    if (b.x1 - b.x0 >= 4 && b.y1 - b.y0 >= 4) boxes.push(b);
  }
  return boxes;
}
// 2. what each box says, one box at a time (reading several together, padded to one length, was no faster and lost spaces)
async function readBoxes(g, w, h, boxes) {
  const items = [];
  for (const b of boxes) {
    const left = Math.floor(b.x0), top = Math.floor(b.y0), bw = Math.min(w - left, Math.ceil(b.x1) - left), bh = Math.min(h - top, Math.ceil(b.y1) - top);
    if (bw < 2 || bh < 2) continue;
    const rw = Math.max(16, Math.min(4800, Math.ceil(REC_H * bw / bh)));   // never squeezed: squeezing loses the spaces
    const px = await sharp(g, { raw: { width: w, height: h, channels: 1 } }).extract({ left, top, width: bw, height: bh }).resize(rw, REC_H, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer();
    items.push({ b, rw, px });
  }
  items.sort((a, b) => a.rw - b.rw);
  const BS = +process.env.BILL_AI_BATCH || 1;
  for (let i = 0; i < items.length; i += BS) {
    const grp = items.slice(i, i + BS), RW = grp[grp.length - 1].rw, n = REC_H * RW, t = new Float32Array(grp.length * 3 * n);   // the rest of a short line stays 0 (PaddleOCR pads the same way)
    grp.forEach((it, k) => { for (let c = 0; c < 3; c++) { const o = (k * 3 + c) * n; for (let y = 0; y < REC_H; y++) for (let x = 0; x < it.rw; x++) t[o + y * RW + x] = it.px[y * it.rw + x] / 127.5 - 1; } });
    const out = (await rec.run({ [rec.inputNames[0]]: new ort.Tensor('float32', t, [grp.length, 3, REC_H, RW]) }))[rec.outputNames[0]];
    const [, T, C] = out.dims, p = out.data;
    grp.forEach((it, k) => {
      const Tk = Math.min(T, Math.ceil(T * it.rw / RW) + 1);   // only the frames over this line's own width
      let s = '', last = 0, conf = 0, nc = 0;
      for (let f = 0; f < Tk; f++) { const o = (k * T + f) * C; let bi = 0, bv = -1; for (let c = 0; c < C; c++) { const v = p[o + c]; if (v > bv) { bv = v; bi = c; } }
        if (bi && bi !== last) { s += CH[bi] || ''; conf += bv; nc++; } last = bi; }
      it.b.t = s.normalize('NFKC').replace(/[⺀-鿿가-힯豈-﫿]/g, '').trim(); it.b.c = nc ? conf / nc : 0;
    });
  }
  return boxes.filter(b => b.t);
}
// 3. boxes on the same level make one row, left to right
function rowsOf(boxes) {
  const rows = [];
  for (const b of boxes.slice().sort((a, c) => (a.y0 + a.y1) - (c.y0 + c.y1))) {
    const cy = (b.y0 + b.y1) / 2, bh = b.y1 - b.y0;
    const r = rows.find(r => Math.abs(r.cy - cy) < Math.min(r.h, bh) * 0.5);
    if (r) { r.b.push(b); r.cy += (cy - r.cy) / r.b.length; } else rows.push({ cy, h: bh, b: [b] });
  }
  return rows.map(r => r.b.sort((a, c) => a.x0 - c.x0).map(b => b.t).join('  '));
}
export async function readBill(buf) {
  const t0 = Date.now();
  await ready();
  const { data: g, info } = await sharp(buf, { limitInputPixels: 80e6 }).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .grayscale().toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  const boxes = await boxesOf(g, info.width, info.height);
  const read = await readBoxes(g, info.width, info.height, boxes);
  const rows = rowsOf(read);
  return { text: rows.join('\n'), rows: rows.length, boxes: read.length, ms: Date.now() - t0, w: info.width, h: info.height };
}

// ---- as a child process of server.mjs (lib/billai.mjs): one page at a time, in memory; the server ends it when idle ----
if (process.send) {
  const readyP = ready();
  readyP.then(() => process.send({ type: 'up' }), e => process.send({ type: 'fatal', error: msg(e) }, () => process.exit(1)));
  process.on('message', async m => {
    if (!m || m.type !== 'read') return;
    try { await readyP; const r = await readBill(Buffer.from(m.img)); process.send({ type: 'done', id: m.id, ok: true, ...r }); }
    catch (e) { process.send({ type: 'done', id: m.id, ok: false, error: msg(e) }); }
  });
  process.on('disconnect', () => process.exit(0));
} else if (process.argv[2] === '--model') {
  models().then(() => console.log('   bill reader (Apna AI) models ready (data/models/ppocr)'), e => { console.error('   bill reader models:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--check') {
  ready().then(() => console.log('   bill reader (Apna AI) loads fine'), e => { console.error('   bill reader does not load here:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--test') {
  readBill(fs.readFileSync(process.argv[3])).then(r => { console.log(r.text); console.log('--', r.rows, 'rows,', r.boxes, 'boxes,', r.ms, 'ms'); }, e => { console.error(e); process.exit(1); });
}
