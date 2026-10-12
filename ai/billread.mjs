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
  return (await marks(px, W, H)).map(m => ({ x0: Math.max(0, m.x0 / sx), y0: Math.max(0, m.y0 / sy), x1: Math.min(w, m.x1 / sx), y1: Math.min(h, m.y1 / sy) }))
    .filter(b => b.x1 - b.x0 >= 4 && b.y1 - b.y0 >= 4);
}
// the finder on a grey picture W x H (both multiples of 32): boxes in its own pixels. sure = how sure a mark must be on average,
// grow = how far a mark is grown back (PaddleOCR's 1.5; a diagram's lone digits need 2)
async function marks(px, W, H, sure = 0.6, grow = 1.5, bin = 0.3) {
  const N = W * H, t = new Float32Array(3 * N), mean = [0.485, 0.456, 0.406], sd = [0.229, 0.224, 0.225];
  for (let c = 0; c < 3; c++) { const o = c * N; for (let i = 0; i < N; i++) t[o + i] = (px[i] / 255 - mean[c]) / sd[c]; }
  const out = await det.run({ [det.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, H, W]) });
  const map = out[det.outputNames[0]].data, lab = new Uint8Array(N), st = new Int32Array(N), boxes = [];
  for (let i = 0; i < N; i++) {
    if (lab[i] || map[i] <= bin) continue;
    let sp = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0, sum = 0; st[sp++] = i; lab[i] = 1;
    while (sp) {
      const j = st[--sp], y = (j / W) | 0, x = j - y * W; n++; sum += map[j];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !lab[j - 1] && map[j - 1] > bin) { lab[j - 1] = 1; st[sp++] = j - 1; }
      if (x < W - 1 && !lab[j + 1] && map[j + 1] > bin) { lab[j + 1] = 1; st[sp++] = j + 1; }
      if (y > 0 && !lab[j - W] && map[j - W] > bin) { lab[j - W] = 1; st[sp++] = j - W; }
      if (y < H - 1 && !lab[j + W] && map[j + W] > bin) { lab[j + W] = 1; st[sp++] = j + W; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (Math.min(bw, bh) < 3 || sum / n < sure) continue;   // too small, or not sure enough it is writing
    const d = bw * bh * grow / (2 * (bw + bh));               // the mark is a shrunk copy of the text: grow it back
    boxes.push({ x0: x0 - d, y0: y0 - d, x1: x1 + 1 + d, y1: y1 + 1 + d });
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
      let s = '', last = 0, conf = 0, nc = 0; const cx = [], bw = it.b.x1 - it.b.x0;
      for (let f = 0; f < Tk; f++) { const o = (k * T + f) * C; let bi = 0, bv = -1; for (let c = 0; c < C; c++) { const v = p[o + c]; if (v > bv) { bv = v; bi = c; } }
        if (bi && bi !== last) { s += CH[bi] || ''; conf += bv; nc++; cx.push([CH[bi] || '', it.b.x0 + Math.min(1, (f + 0.5) * RW / T / it.rw) * bw]); } last = bi; }
      it.b.t = s.normalize('NFKC').replace(/[⺀-鿿가-힯豈-﫿]/g, '').trim(); it.b.c = nc ? conf / nc : 0; it.b.cx = cx;
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

// ---- diagram numbers (update 8m, Sam 2026-10-12 10:06Z "diagram pe jo numbers he 1,2,3,4,5,6,7, sabhi number clickable"):
// where each ref number sits on a catalogue diagram. The numbers are small, so the picture is read up to 3 times bigger (about 3000 px on
// its longer side) in tiles of 1280 px, with a lower bar for lone digits. Only short pieces with a digit are kept (1, 12, 12A, A5, 10-1);
// each comes back as [text, x0, y0, x1, y1, sure] in fractions of the picture. The picture is read in memory only.
const NUM_SIDE = +process.env.NUMS_SIDE || 3000, TILE = 1280, OVER = 160, NUM_SURE = +process.env.NUMS_SURE || 0.45, NUM_BIN = +process.env.NUMS_BIN || 0.3, NUM_GROW = +process.env.NUMS_GROW || 2;
const NUM_RE = /^[A-Z]?\d{1,3}[A-Z]?(?:-\d{1,2})?$/;
// what the reader confuses in a number: I, l, | and ! are 1, O and o are 0, S is 5, B is 8, Z is 2, G is 6
const numFix = s => /\d/.test(s) && s.length <= 6 ? s.replace(/^([A-Z]?)(.*?)([A-Z]?)$/, (m, a, mid, z) => a + mid.replace(/[Il|!]/g, '1').replace(/[Oo]/g, '0').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2').replace(/G/g, '6') + z) : s;
// one reading at one size (s = how many times bigger than the picture): the numbers as [text, x0, y0, x1, y1, sure] in fractions
async function numsAt(buf, W0, H0, s, line = 0, sure = NUM_SURE) {
  const w = Math.max(32, Math.round(W0 * s)), h = Math.max(32, Math.round(H0 * s));
  const g = await sharp(buf, { limitInputPixels: 80e6 }).flatten({ background: '#ffffff' }).grayscale().resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
    .toColourspace('b-w').raw().toBuffer();
  if (line) unline(g, w, h, Math.round(line * s), line * s / 1.25);
  // the finder, tile by tile (white round the edges so every tile is a multiple of 32)
  const found = [], step = TILE - OVER;
  for (let ty = 0; ty < h; ty += step) {
    for (let tx = 0; tx < w; tx += step) {
      const tw = Math.min(TILE, w - tx), th = Math.min(TILE, h - ty), TW = Math.ceil(tw / 32) * 32, TH = Math.ceil(th / 32) * 32;
      const px = new Uint8Array(TW * TH).fill(255);
      for (let y = 0; y < th; y++) px.set(g.subarray((ty + y) * w + tx, (ty + y) * w + tx + tw), y * TW);
      for (const b of await marks(px, TW, TH, sure, NUM_GROW, NUM_BIN)) found.push({ x0: Math.max(0, tx + b.x0), y0: Math.max(0, ty + b.y0), x1: Math.min(w, tx + b.x1), y1: Math.min(h, ty + b.y1) });
      if (tx + tw >= w) break;
    }
    if (ty + Math.min(TILE, h - ty) >= h) break;
  }
  // a number cut by a tile's edge is whole in the next tile: keep the bigger of two boxes that mostly overlap
  found.sort((a, b) => area(b) - area(a));
  const keep = [];
  for (const b of found) if (b.x1 - b.x0 >= 4 && b.y1 - b.y0 >= 4 && !keep.some(k => inter(k, b) > 0.5 * area(b))) keep.push(b);
  const read = await readBoxes(g, w, h, keep.filter(b => (b.x1 - b.x0) < w * 0.25));
  if (process.env.NUMS_DEBUG) console.log(s.toFixed(2), JSON.stringify(read.map(b => [b.t, Math.round(b.x0), Math.round(b.y0), Math.round(b.x1 - b.x0), Math.round(b.y1 - b.y0)])));
  // a number in a table (its row has a part number or a name next to it) is not a callout of the drawing
  const words = read.filter(b => /[A-Za-z]{2}|\d{4}/.test(b.t) && !numsOf(b, w, h).length);
  const toks = [];
  for (const b of read) {
    const bh = b.y1 - b.y0, cy = (b.y0 + b.y1) / 2;
    if (words.some(o => Math.abs((o.y0 + o.y1) / 2 - cy) < 0.45 * bh && (o.x0 - b.x1 < 7 * bh && b.x0 - o.x1 < 7 * bh))) continue;
    toks.push(...numsOf(b, w, h));
  }
  return toks;
}
// a number touching its leader line is not seen as writing: straight lines (across or down) longer than a number are painted white.
// Only the line's own thin pixels go: a digit's stroke is thicker than a leader line, so a "1" at the end of a line down stays.
function unline(g, w, h, L, hd) {
  const n = w * h, dk = new Uint8Array(n), ht = new Uint16Array(n), vt = new Uint16Array(n);
  for (let i = 0; i < n; i++) dk[i] = g[i] < 170 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w;) { const i = y * w + x; if (!dk[i]) { x++; continue; } let e = x; while (e < w && dk[y * w + e]) e++; ht.fill(Math.min(65535, e - x), i, y * w + e); x = e; }
  for (let x = 0; x < w; x++) for (let y = 0; y < h;) { if (!dk[y * w + x]) { y++; continue; } let e = y; while (e < h && dk[e * w + x]) e++; const r = Math.min(65535, e - y); for (let k = y; k < e; k++) vt[k * w + x] = r; y = e; }
  // how thick the lines are: the usual thickness across the long runs (plus 1 for soft edges), never as thick as a digit's stroke
  let T = 65535;
  if (process.env.NUMS_THIN !== '0') {
    const c = new Uint32Array(64);
    for (let i = 0; i < n; i++) if (dk[i]) { if (ht[i] >= L && vt[i] < 64) c[vt[i]]++; else if (vt[i] >= L && ht[i] < 64) c[ht[i]]++; }
    let m = 1; for (let k = 2; k < 64; k++) if (c[k] > c[m]) m = k;
    T = Math.min(m + 1, Math.max(1, Math.floor(hd * 0.09)));
  }
  for (let i = 0; i < n; i++) if (dk[i] && ((ht[i] >= L && vt[i] <= T) || (vt[i] >= L && ht[i] <= T))) g[i] = 255;
}
const area = b => (b.x1 - b.x0) * (b.y1 - b.y0), inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const r4 = v => Math.round(v * 1e4) / 1e4;
// the numbers in what one box says: short runs of letters and digits ("4 5", "2/57", "6—" are 4 and 5, 2 and 57, 6), each placed
// where the reader saw its letters
function numsOf(b, w, h) {
  const cs = (b.cx || []).map(([c, x]) => [c.normalize('NFKC'), x]).filter(([c]) => c && !/[⺀-鿿가-힯豈-﫿]/.test(c));
  const runs = []; let cur = [];
  const gap = (b.y1 - b.y0) * 0.45 * 1.6;   // two numbers close together read as one ("7  8" as 78): a gap of over 1.6 letters splits them
  cs.forEach(([c, x], k) => {
    const keep = /[A-Za-z0-9|!]/.test(c) || (c === '-' && cur.length && /\d/.test(cur[cur.length - 1][0]) && cs[k + 1] && /\d/.test(cs[k + 1][0]));
    if (keep && cur.length && x - cur[cur.length - 1][1] > gap) { runs.push(cur); cur = []; }
    if (keep) cur.push([c, x]); else { if (cur.length) runs.push(cur); cur = []; }
  });
  if (cur.length) runs.push(cur);
  const out = [], bh = b.y1 - b.y0, cw = bh * 0.45;   // the box is grown round the letters: a letter is about 0.45 of its height wide
  // only a box that is all numbers ("4 5", "2/57") is callouts: "DE 1510 15" or "Plate No. 33" are not
  const ts = runs.map(run => numFix(run.map(r => r[0]).join('').toUpperCase()));
  if (!ts.length || ts.some(t => !NUM_RE.test(t))) return out;
  for (const [k, run] of runs.entries()) {
    const t = ts[k];
    const x0 = Math.max(b.x0, run[0][1] - cw * 0.6), x1 = Math.min(b.x1, run[run.length - 1][1] + cw * 0.6);
    out.push([t, r4(x0 / w), r4(b.y0 / h), r4(x1 / w), r4(b.y1 / h), Math.round(b.c * 100) / 100]);
  }
  return out;
}
export async function readNums(buf) {
  const t0 = Date.now();
  await ready();
  const m = await sharp(buf, { limitInputPixels: 80e6 }).metadata(), W0 = m.width, H0 = m.height;
  if (!W0 || !H0) throw new Error('not a picture');
  // two sizes: what one size misses (a number touching its line) the other often finds; then once more with the straight lines
  // painted out (a line touching a number hides it), lines longer than about 2 numbers' height
  const sizes = (process.env.NUMS_SIZES || '3000:3,4500:4.5').split(',').map(x => x.split(':').map(Number));
  const all = [], low = [];
  for (const [side, cap] of sizes) for (const t of await numsAt(buf, W0, H0, Math.min(cap, side / Math.max(W0, H0)))) (t[5] >= 0.7 ? all : low).push(t);
  const hs = all.map(t => (t[4] - t[2]) * H0).sort((a, b) => a - b), hm = hs.length ? hs[hs.length >> 1] : Math.max(W0, H0) * 0.02;
  if (process.env.NUMS_LINE !== '0') {
    const [side, cap] = sizes[0];
    for (const t of await numsAt(buf, W0, H0, Math.min(cap, side / Math.max(W0, H0)), hm * 1.25, Math.min(NUM_SURE, 0.3))) {
      const th = (t[4] - t[2]) * H0;
      (t[5] >= 0.85 && th > hm * 0.6 && th < hm * 1.6 ? all : low).push(t);
    }
  }
  // the same number read at two sizes is one; two readings of one place: the surer one
  const bx = t => ({ x0: t[1], y0: t[2], x1: t[3], y1: t[4] }), near = (L, t) => { const b = bx(t); return L.some(k => { const kb = bx(k); return inter(kb, b) > 0.4 * Math.min(area(kb), area(b)); }); };
  all.sort((a, b) => b[5] - a[5]);
  let toks = [];
  for (const t of all) if (!near(toks, t)) toks.push(t.slice(0, 6));
  // a table's quantity column (6 or more numbers one under another, mostly the same few values) is not callouts
  const drop = new Set();
  for (const a of toks) {
    if (drop.has(a)) continue;
    const ax = (a[1] + a[3]) / 2 * W0, ah = (a[4] - a[2]) * H0;
    const col = toks.filter(b => Math.abs((b[1] + b[3]) / 2 * W0 - ax) < 0.5 * ah && Math.abs((b[4] - b[2]) * H0 - ah) < 0.3 * ah);
    if (col.length >= 6 && new Set(col.map(b => b[0])).size * 2 <= col.length) col.forEach(b => drop.add(b));
  }
  toks = toks.filter(t => !drop.has(t));
  // the unsure readings come back too ("lo"): the page takes one only for a number of this diagram's list that is not found yet
  low.sort((a, b) => b[5] - a[5]);
  const lo = [];
  for (const t of low) { const th = (t[4] - t[2]) * H0; if (t[5] >= 0.3 && th > hm * 0.5 && th < hm * 2 && !near(toks, t) && !near(lo, t)) lo.push(t.slice(0, 6)); }
  return { toks, lo, w: W0, h: H0, boxes: all.length, ms: Date.now() - t0 };
}

// ---- as a child process of server.mjs (lib/billai.mjs): one page at a time, in memory; the server ends it when idle ----
if (process.send) {
  const readyP = ready();
  readyP.then(() => process.send({ type: 'up' }), e => process.send({ type: 'fatal', error: msg(e) }, () => process.exit(1)));
  process.on('message', async m => {
    if (!m || (m.type !== 'read' && m.type !== 'nums')) return;
    try { await readyP; const r = await (m.type === 'nums' ? readNums : readBill)(Buffer.from(m.img)); process.send({ type: 'done', id: m.id, ok: true, ...r }); }
    catch (e) { process.send({ type: 'done', id: m.id, ok: false, error: msg(e) }); }
  });
  process.on('disconnect', () => process.exit(0));
} else if (process.argv[2] === '--model') {
  models().then(() => console.log('   bill reader (Apna AI) models ready (data/models/ppocr)'), e => { console.error('   bill reader models:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--check') {
  ready().then(() => console.log('   bill reader (Apna AI) loads fine'), e => { console.error('   bill reader does not load here:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--nums') {
  readNums(fs.readFileSync(process.argv[3])).then(r => { console.log(JSON.stringify(r.toks)); console.log('--', r.toks.length, 'numbers,', r.boxes, 'boxes,', r.w + 'x' + r.h, r.ms, 'ms'); }, e => { console.error(e); process.exit(1); });
} else if (process.argv[2] === '--test') {
  readBill(fs.readFileSync(process.argv[3])).then(r => { console.log(r.text); console.log('--', r.rows, 'rows,', r.boxes, 'boxes,', r.ms, 'ms'); }, e => { console.error(e); process.exit(1); });
}
