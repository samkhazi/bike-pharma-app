// Product photo cleanup (Sam 2026-10-11 16:59Z, 17:08Z, 17:11Z): the background behind the part becomes white, and the Bike Pharma
// logo (logo only, faint) sits BEHIND the part. The photo as taken is never changed; two new copies are made next to it:
//   <hash>-c.jpg  clean: part on white, logo behind it         <hash>-w.jpg  "Keep original": the photo as taken, logo behind the part
// v2 (Sam 18:13Z "hands show ho rahe hein", 18:15Z "background full clear rehna he yaar sirf poducts pe focus rehna he"): only the part
// stays. A hand holding it goes (skin-coloured areas that run to the photo's edge: hand and arm), loose bits and faint shadows go, and the
// clean copy is cut square round the part.
// v3 (Sam 22:24Z-22:41Z: a remote looked yellow and did not stand out, a tan switch lost a bite with the hand, the logo was too strong,
// "3-5 second", "khud ko improve karte rehna he"): the room light's colour is taken out of the clean copy (white balance from the photo's
// own background), a soft shadow under the part, a fainter logo, and the photo checks itself: the part is found in more than one way
// (WAYS) when the first result looks wrong (a bite out of the part, a hand left on it), the best result is kept, and lib/photoai.mjs
// remembers which way wins for which kind of photo (and learns from staff's "Not right" too), so the right way is tried first next time.
// lib/photoai.mjs makes older copies again (AI_VER).
// Runs as its own process (lib/photoai.mjs starts it when there is work and ends it when idle), so the website keeps its memory.
// The AI model (IS-Net general use, from the rembg project) is downloaded once into data/models/ and checked byte for byte.
//   test on a computer:  node ai/worker.mjs --test <photo> <out folder> [way]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..');
// the same data folder as server.mjs (it passes DATA_DIR; on its own the site's .env decides, like the server)
function dataDir() {
  if (process.env.DATA_DIR) return path.resolve(ROOT, process.env.DATA_DIR);
  try { const m = /^\s*DATA_DIR\s*=\s*"?(.*?)"?\s*$/m.exec(fs.readFileSync(path.join(ROOT, '.env'), 'utf8')); if (m && m[1]) return path.resolve(ROOT, m[1]); } catch (e) { /* no .env */ }
  return path.join(ROOT, 'data');
}
const DATA_DIR = dataDir();
const MODEL = {
  url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx',
  file: path.join(DATA_DIR, 'models', 'isnet-general-use.onnx'),
  sha256: '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a',
  size: 178648008,
  side: 1024,
};
const LOGO_FILE = path.join(HERE, 'logo.png');
const LOGO_C = 0.07;         // the clean copy: very faint, so the eye goes to the part (Sam 22:24Z)
const LOGO_W = 0.11;         // "Keep original": over a busy photo it may show a little more
const LOGO_SIZE = 0.62;      // logo height, as a part of the photo's shorter side
const QUALITY = 95;          // 4:4:4 colour, no visible loss
const AN = 768;              // which pixels are the part is worked out on a copy this big; the edge itself comes from the AI's mask
const KS = AN / 1024;        // sizes below were first set on a 1024 copy
const FILL = 0.8;            // the clean copy: the part takes 4/5 of the square
const MAX_SIDE = 5000;       // the copies keep the photo's full size up to 5000 px (12-16 MP phone photos stay as they are); bigger
                             // photos (50-200 MP modes) are made 5000 px so the AI never runs out of memory. The photo as taken is never changed.
const SHADOW = { op: 0.2, blur: 0.02, dy: 0.012 };   // soft shadow under the part (strength, blur and drop as parts of the square's side)
const CPU = Math.max(1, Math.min(4, os.cpus().length - 1));   // the server runs this at low priority, so the website still comes first
// the ways of finding the part. std: hand and arm out (skin test, then hand-coloured pixels next to it); mend: the same, but a bite the
// hand removal took out of the part's own outline is given back (a tan or brown part looks like skin); none: no hand removal at all
export const WAYS = { std: { hand: 1, flood: 1, mend: 0 }, mend: { hand: 1, flood: 1, mend: 1 }, none: { hand: 0, flood: 0, mend: 0 } };
export const WAY_ORDER = ['std', 'mend', 'none'];

let sharp, ort, session;
const log = (...a) => console.log(new Date().toISOString(), 'photo-ai', ...a);

function get(url, file, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'bikepharma-site' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 6) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, file, hops + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('model download: HTTP ' + res.statusCode)); }
      const out = fs.createWriteStream(file); res.pipe(out); out.on('finish', () => out.close(resolve)); out.on('error', reject); res.on('error', reject);
    }).on('error', reject);
  });
}
function sha256(file) { return new Promise((resolve, reject) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject); }); }
async function modelFile() {
  try { if (fs.statSync(MODEL.file).size === MODEL.size) return MODEL.file; } catch (e) { /* not there yet */ }
  fs.mkdirSync(path.dirname(MODEL.file), { recursive: true });
  const tmp = MODEL.file + '.' + process.pid + '.part';
  log('downloading the AI model (178 MB, once)');
  try {
    await get(MODEL.url, tmp);
    const h = await sha256(tmp);
    if (h !== MODEL.sha256) throw new Error('model download: file is not the expected one (' + h.slice(0, 12) + ')');
    fs.renameSync(tmp, MODEL.file);
  } finally { try { fs.unlinkSync(tmp); } catch (e) { /* renamed or never made */ } }
  log('AI model ready');
  return MODEL.file;
}
async function ready() {
  if (session) return;
  sharp = (await import('sharp')).default;
  ort = (await import('onnxruntime-node')).default;
  sharp.concurrency(CPU); sharp.cache(false);
  const file = await modelFile();
  // no memory arena: about 0.9 GB at the peak instead of 1.8 GB, a little slower
  session = await ort.InferenceSession.create(file, { intraOpNumThreads: CPU, interOpNumThreads: 1, enableCpuMemArena: false, enableMemPattern: false, graphOptimizationLevel: 'all' });
}

// the AI's mask of the part (0..255) at the model's own size
async function maskOf(rgb, W, H) {
  const S = MODEL.side, N = S * S;
  const small = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(S, S, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  const x = new Float32Array(3 * N);
  for (let i = 0, p = 0; i < N; i++, p += 3) { x[i] = small[p] / 255 - 0.5; x[N + i] = small[p + 1] / 255 - 0.5; x[2 * N + i] = small[p + 2] / 255 - 0.5; }
  const out = (await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, S, S]) }, [session.outputNames[0]]))[session.outputNames[0]].data;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < N; i++) { const v = out[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
  const m8 = Buffer.alloc(N), k = mx > mn ? 255 / (mx - mn) : 0;
  for (let i = 0; i < N; i++) m8[i] = Math.round((out[i] - mn) * k);
  return m8;
}

// skin: the usual YCbCr range, plus warm-colour checks so white, cream, grey, red and orange parts never count
function isSkin(R, G, B) {
  const Y = 0.299 * R + 0.587 * G + 0.114 * B, Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B, Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
  return Y > 35 && Cr >= 138 && Cr <= 180 && Cb >= 77 && Cb <= 130 && R - G >= 15 && R - B >= 30;
}
// joined areas (8 neighbours) of a 0/1 map, with their size, box, centre and whether they reach the photo's edge
function areas(m, w, h) {
  const N = w * h, lab = new Int32Array(N), st = [null], stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!m[s] || lab[s]) continue;
    const id = st.length, a = { n: 0, edge: false, x0: w, y0: h, x1: -1, y1: -1, sx: 0, sy: 0 };
    st.push(a); let sp = 0; stack[sp++] = s; lab[s] = id;
    while (sp) {
      const p = stack[--sp], x = p % w, y = (p - x) / w;
      a.n++; a.sx += x; a.sy += y;
      if (x < a.x0) a.x0 = x; if (x > a.x1) a.x1 = x; if (y < a.y0) a.y0 = y; if (y > a.y1) a.y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) a.edge = true;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
        const q = yy * w + xx; if (m[q] && !lab[q]) { lab[q] = id; stack[sp++] = q; }
      }
    }
  }
  return { lab, st };
}
function grow(m, w, h, r) {   // r rounds of a 3x3 grow: a (2r+1) square, done as a row pass and a column pass (big r: round, by distance)
  if (r > 3) return growD(m, w, h, r);
  return sq(m, w, h, r, 1);
}
// any (grow) or all (shrink, outside the photo counts as empty) of the (2r+1) square round each pixel
function sq(m, w, h, r, any) {
  const N = w * h, a = new Uint8Array(N), b = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    const o = y * w; let c = 0;
    for (let x = 0; x < Math.min(r, w); x++) c += m[o + x] ? 1 : 0;
    for (let x = 0; x < w; x++) {
      if (x + r < w) c += m[o + x + r] ? 1 : 0;
      if (x - r - 1 >= 0) c -= m[o + x - r - 1] ? 1 : 0;
      a[o + x] = any ? (c > 0 ? 1 : 0) : (c === 2 * r + 1 ? 1 : 0);
    }
  }
  for (let x = 0; x < w; x++) {
    let c = 0;
    for (let y = 0; y < Math.min(r, h); y++) c += a[y * w + x];
    for (let y = 0; y < h; y++) {
      if (y + r < h) c += a[(y + r) * w + x];
      if (y - r - 1 >= 0) c -= a[(y - r - 1) * w + x];
      b[y * w + x] = any ? (c > 0 ? 1 : 0) : (c === 2 * r + 1 ? 1 : 0);
    }
  }
  return b;
}
function growD(m, w, h, r) {   // every pixel within r of the map
  const N = w * h, inv = new Uint8Array(N); for (let i = 0; i < N; i++) inv[i] = m[i] ? 0 : 1;
  const d = dist(inv, w, h, false), g = new Uint8Array(N), lim = 3 * r + 1;
  for (let i = 0; i < N; i++) g[i] = d[i] <= lim ? 1 : 0;
  return g;
}
function shrinkD(m, w, h, r) {   // the map without its outer r pixels (beyond the photo does not count as outside)
  const N = w * h, d = dist(m, w, h, false), g = new Uint8Array(N), lim = 3 * r + 1;
  for (let i = 0; i < N; i++) g[i] = d[i] > lim ? 1 : 0;
  return g;
}
// a few main colours of the listed pixels (k-means on brightness/4, Cb, Cr: shade counts less than colour)
function colours(img, idx, k) {
  const f = i => { const p = i * 3, R = img[p], G = img[p + 1], B = img[p + 2]; return [(0.299 * R + 0.587 * G + 0.114 * B) / 4, 128 - 0.168736 * R - 0.331264 * G + 0.5 * B, 128 + 0.5 * R - 0.418688 * G - 0.081312 * B]; };
  const step = Math.max(1, Math.floor(idx.length / 20000)), pts = [];
  for (let j = 0; j < idx.length; j += step) pts.push(f(idx[j]));
  if (!pts.length) return [];
  let c = Array.from({ length: Math.min(k, pts.length) }, (_, j) => pts[Math.floor((j + 0.5) * pts.length / Math.min(k, pts.length))].slice());
  for (let it = 0; it < 8; it++) {
    const sum = c.map(() => [0, 0, 0, 0]);
    for (const q of pts) { let b = 0, bd = Infinity; c.forEach((m, j) => { const d = (q[0] - m[0]) ** 2 + (q[1] - m[1]) ** 2 + (q[2] - m[2]) ** 2; if (d < bd) { bd = d; b = j; } }); const t = sum[b]; t[0] += q[0]; t[1] += q[1]; t[2] += q[2]; t[3]++; }
    c = c.map((m, j) => sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : m);
  }
  return { f, c };
}
const nearest = (q, c) => { let bd = Infinity; for (const m of c) { const d = (q[0] - m[0]) ** 2 + (q[1] - m[1]) ** 2 + (q[2] - m[2]) ** 2; if (d < bd) bd = d; } return bd; };
function shrink(m, w, h, r) { return sq(m, w, h, r, 0); }   // r rounds of a 3x3 shrink

// what every way shares, worked out once on a small copy: the AI's mask, skin, whether a hand holds the part, the room light's colour
export async function prep(rgb, W, H, m8) {
  const sc = Math.min(1, AN / Math.max(W, H)), w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc)), N = w * h;
  const img = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(w, h, { fit: 'fill' }).raw().toBuffer();
  const al = await sharp(m8, { raw: { width: MODEL.side, height: MODEL.side, channels: 1 } }).resize(w, h, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  return prepSmall(img, al, w, h, sc);
}
export function prepSmall(img, al, w, h, sc = 1) {
  const N = w * h;
  // the room light's colour cast taken out first (grey world), so warm or cool light does not make everything look like skin
  let sR = 0, sG = 0, sB = 0;
  for (let p = 0; p < N * 3; p += 3) { sR += img[p]; sG += img[p + 1]; sB += img[p + 2]; }
  const gm = (sR + sG + sB) / 3, gain = v => Math.min(1.7, Math.max(0.6, gm / Math.max(1, v))), gR = gain(sR), gG = gain(sG), gB = gain(sB);
  const fg = new Uint8Array(N), out = new Uint8Array(N), skin = new Uint8Array(N); let nFg = 0;
  for (let i = 0, p = 0; i < N; i++, p += 3) {
    if (al[i] >= 128) { fg[i] = 1; nFg++; } else out[i] = 1;
    if (isSkin(img[p] * gR, img[p + 1] * gG, img[p + 2] * gB)) skin[i] = 1;
  }
  const P = { sc, w, h, N, img, al, fg, out, skin, nFg, proof: false, handIn: new Uint8Array(N), skinPart: 0, wb: wbOf(img, al, skin, N) };
  if (nFg < N * 0.001) return P;
  // the hand. Proof that a hand is in the photo: a hand-sized skin area coming in from the photo's edge and touching the part.
  // Then every skin area on the part's outline goes (fingers, thumb); skin colour inside the part (an orange button) stays.
  // The hand (or arm) is mostly outside what the AI took as the part; a brown box or a copper part is mostly inside it.
  const S = areas(skin, w, h), near = grow(fg, w, h, 3), touch = new Uint8Array(S.st.length), inside = new Float64Array(S.st.length);
  for (let i = 0; i < N; i++) { const id = S.lab[i]; if (id) { if (near[i]) touch[id] = 1; if (fg[i]) inside[id]++; } }
  // When the AI took the whole hand as part too: the hand holds something, a thick piece (not skin) that touches the skin area and
  // also the background (a label on a brown box is closed in by the box, so the box is never taken for a hand).
  const ns = new Uint8Array(N); for (let i = 0; i < N; i++) if (fg[i] && !skin[i]) ns[i] = 1;
  const T = areas(ns, w, h), Dt = dist(ns, w, h), tTop = new Int32Array(T.st.length), tOut = new Uint8Array(T.st.length), holds = new Uint8Array(S.st.length);
  const thick = Math.round(24 * KS);
  for (let i = 0; i < N; i++) { const t = T.lab[i]; if (!t) continue; if (Dt[i] > tTop[t]) tTop[t] = Dt[i]; if (!tOut[t]) { const x = i % w, y = (i - x) / w; if ((x > 0 && out[i - 1]) || (x < w - 1 && out[i + 1]) || (y > 0 && out[i - w]) || (y < h - 1 && out[i + w])) tOut[t] = 1; } }
  for (let i = 0; i < N; i++) {
    const id = S.lab[i]; if (!id || holds[id]) continue;
    const x = i % w, y = (i - x) / w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      const t = j >= 0 ? T.lab[j] : 0; if (t && tOut[t] && tTop[t] >= thick && T.st[t].n >= N * 0.005) { holds[id] = 1; break; }
    }
  }
  for (let id = 1; id < S.st.length; id++) { const a = S.st[id]; if (a.edge && touch[id] && a.n >= N * 0.005 && a.n <= N * 0.45 && (inside[id] <= a.n * 0.6 || holds[id])) P.proof = true; }
  if (P.proof) {
    const on = new Uint8Array(N);   // skin the AI took as part
    for (let i = 0; i < N; i++) if (skin[i] && al[i] >= 26) on[i] = 1;
    const O = areas(on, w, h), rim = grow(out, w, h, 2), edgy = new Uint8Array(O.st.length);
    for (let i = 0; i < N; i++) if (O.lab[i] && rim[i]) edgy[O.lab[i]] = 1;
    for (let i = 0; i < N; i++) if (O.lab[i] && edgy[O.lab[i]] && O.st[O.lab[i]].n >= N * 0.0003) P.handIn[i] = 1;
  }
  // how much of the part itself is skin-coloured (a tan, brown or copper part): then the hand cannot be told from it by colour.
  // Counted away from the hand and arm seen outside the part.
  let away = null, nC = 0, nS = 0;
  if (P.proof) { const arm = new Uint8Array(N); for (let i = 0; i < N; i++) if (skin[i] && !fg[i]) arm[i] = 1; away = growD(arm, w, h, Math.round(Math.max(w, h) * 0.06)); }
  for (let i = 0; i < N; i++) if (al[i] >= 200 && !(away && away[i])) { nC++; if (skin[i]) nS++; }
  P.skinPart = nC ? nS / nC : 0;
  return P;
}
// the room light's colour, from the photo's own background: its brightest plain pixels should be white or grey. A strongly coloured
// background (a brown table, a blue cloth) is not taken as white: then it is corrected less, or not at all.
function wbOf(img, al, skin, N) {
  const ys = [], idx = [];
  for (let i = 0, p = 0; i < N; i++, p += 3) {
    if (al[i] >= 40 || skin[i]) continue;
    const R = img[p], G = img[p + 1], B = img[p + 2], mx = Math.max(R, G, B);
    if (mx >= 250 || mx < 60) continue;   // blown-out light is white anyway; dark corners say little
    ys.push(0.299 * R + 0.587 * G + 0.114 * B); idx.push(p);
  }
  const none = { r: 1, g: 1, b: 1, n: ys.length };
  if (ys.length < N * 0.02) return none;
  const hist = new Uint32Array(256); for (const y of ys) hist[Math.min(255, y | 0)]++;
  let lim = 255; for (let v = 255, c = 0; v >= 0; v--) { c += hist[v]; if (c >= ys.length * 0.25) { lim = v; break; } }
  let R = 0, G = 0, B = 0, n = 0;
  for (let j = 0; j < ys.length; j++) if (ys[j] >= lim) { const p = idx[j]; R += img[p]; G += img[p + 1]; B += img[p + 2]; n++; }
  R /= n; G /= n; B /= n;
  const mx = Math.max(R, G, B), mn = Math.max(1, Math.min(R, G, B)), ratio = mx / mn;
  if (ratio < 1.03) return none;
  const s = ratio <= 1.35 ? 1 : ratio >= 1.8 ? 0 : (1.8 - ratio) / 0.45;
  if (!s) return none;
  const Y = (R + G + B) / 3, k = v => Math.min(1.35, Math.max(0.75, 1 + s * (Y / v - 1)));
  return { r: k(R), g: k(G), b: k(B), n };
}
// what to keep, the way `way` finds it: { keep (0/255, small), w, h, box (full size), hand, st, chk } or null when nothing sure was found
export function pick(P, way) {
  const { w, h, N, img, al, fg, out, nFg, sc } = P;
  if (nFg < N * 0.001) return null;
  let hand = new Uint8Array(N), fg2 = fg;
  const hasHand = !!(way.hand && P.proof);
  if (hasHand) {
    hand = grow(P.handIn, w, h, 2);   // and the finger's own edge (it grows below into fingers in shadow)
    fg2 = new Uint8Array(N); for (let i = 0; i < N; i++) if (fg[i] && !hand[i]) fg2[i] = 1;
    if (way.flood) {
      // on the hand's side: finger bits the skin test missed (a finger in shadow). Pixels on the part's outline whose colour is
      // closer to the hand than to any of the part's main colours go, and so do such pixels joined to them.
      const near2 = grow(hand, w, h, 11), wide = grow(hand, w, h, Math.round(Math.max(w, h) * 0.1)), rim = grow(out, w, h, 2), hIdx = [], pIdx = [];
      for (let i = 0; i < N; i++) { if (P.handIn[i]) hIdx.push(i); else if (fg2[i] && !near2[i]) pIdx.push(i); }
      const H2 = colours(img, hIdx, 2), P6 = colours(img, pIdx, 6);
      if (H2.c && P6.c && H2.c.length && P6.c.length) {
        const handish = q => { const v = H2.f(q); return nearest(v, H2.c) < nearest(v, P6.c); }, st = [];
        for (let i = 0; i < N; i++) if (fg2[i] && wide[i] && (hand[i] || rim[i]) && handish(i)) { fg2[i] = 0; hand[i] = 1; st.push(i); }
        for (let i = 0; i < N; i++) if (hand[i]) st.push(i);
        while (st.length) {
          const p = st.pop(), x = p % w, y = (p - x) / w;
          for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
            const q = yy * w + xx; if (fg2[q] && wide[q] && handish(q)) { fg2[q] = 0; hand[q] = 1; st.push(q); }
          }
        }
      }
      // and thin left-overs (nails, finger edges) next to the hand; the part's own outline stays
      const op = grow(shrink(fg2, w, h, 3), w, h, 3), nearAll = grow(hand, w, h, 11);
      for (let i = 0; i < N; i++) if (nearAll[i] && !op[i]) { fg2[i] = 0; hand[i] = 1; }
    }
  }
  let n2 = 0; for (let i = 0; i < N; i++) n2 += fg2[i];
  const useHand = hasHand && n2 >= nFg * 0.25;   // else the "skin" is the part itself (a copper or brown part): it stays
  const base = useHand ? fg2 : fg;
  // things touching each other are split at their narrow joins (Sam 18:32Z "sirf object utna hi rehna he"): every object has a
  // thick core (far from the outside); each pixel goes to the nearest core, so thin bits (a key ring, a cable end) stay with the
  // object they hang from. Then the part: the biggest piece near the middle (and other big pieces); loose bits go.
  const Pc = cores(base, w, h), cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
  let best = 0, bs = 0;
  for (let id = 1; id < Pc.st.length; id++) {
    const a = Pc.st[id], d = Math.hypot(a.sx / a.n - cx, a.sy / a.n - cy) / R;
    a.sc = a.n * (a.edge ? 0.35 : 1) * (1 - 0.5 * Math.min(1, d));
    if (a.sc > bs) { bs = a.sc; best = id; }
  }
  if (!best) return null;
  const B = Pc.st[best], ids = new Uint8Array(Pc.st.length), unsure = new Float64Array(Pc.st.length);
  for (let i = 0; i < N; i++) if (Pc.lab[i] && al[i] < 200) unsure[Pc.lab[i]]++;
  const uB = unsure[best] / B.n;
  for (let id = 1; id < Pc.st.length; id++) {
    const a = Pc.st[id];
    // other big pieces stay too (a pair of brake shoes, a set of bolts) when the AI is about as sure of them as of the part;
    // things behind the part (a phone, a box, a bottle) it is less sure of
    if (id === best || (a.n >= B.n * 0.15 && (!a.edge || a.n >= B.n * 0.5) && unsure[id] / a.n <= Math.max(0.2, uB + 0.1))) ids[id] = 1;
  }
  const kept = new Uint8Array(N), gone = new Uint8Array(N), sure = new Uint8Array(N), notCore = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (ids[Pc.lab[i]]) { kept[i] = 1; if (al[i] >= 200) sure[i] = 1; } else if (base[i]) gone[i] = 1;
    if (!Pc.seed[i]) notCore[i] = 1;
  }
  // thin bits (a strap, a cable) and bits the AI was not sure of that run into something dropped belong to that other thing (the
  // bottom of a bottle standing behind the part, a lanyard going to a phone): they go too. Thick = within the piece's own core reach.
  const toCore = dist(notCore, w, h, false), sureR = grow(sure, w, h, 3), weak = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (kept[i] && (toCore[i] > Pc.th[i] || !sureR[i])) weak[i] = 1;
  const Wk = areas(weak, w, h), byGone = grow(gone, w, h, 1), drop = new Uint8Array(Wk.st.length);
  for (let i = 0; i < N; i++) if (Wk.lab[i] && byGone[i]) drop[Wk.lab[i]] = 1;
  for (let i = 0; i < N; i++) if (drop[Wk.lab[i]]) kept[i] = 0;
  // what is left: the part's own pieces (crumbs cut off by the step above go)
  const K = areas(kept, w, h); let kmax = 0;
  for (let id = 1; id < K.st.length; id++) kmax = Math.max(kmax, K.st[id].n);
  for (let i = 0; i < N; i++) if (K.lab[i] && K.st[K.lab[i]].n < kmax * 0.1) kept[i] = 0;
  // the self-check. A bite: what was taken from inside the part's own outline (its dents filled in) where the AI did see something
  // (the hand removal, or the AI unsure next to the fingers); a gap the AI saw as background (a ring's hole) is not a bite.
  // A hand left: what this way took for hand (or, when it leaves the hand alone, skin joined to the hand) still kept.
  let nKept = 0; for (let i = 0; i < N; i++) nKept += kept[i];
  if (!nKept) return null;
  let bite = 0, mended = 0, handLeft = 0;
  const rr = Math.round(Math.max(w, h) * 0.04), fill = shrinkD(growD(kept, w, h, rr), w, h, rr);
  for (let i = 0; i < N; i++) if (!kept[i] && fill[i] && al[i] >= 26) { bite++; if (way.mend) { kept[i] = 1; mended++; } }
  if (P.proof) { const hm = useHand ? hand : P.handIn; for (let i = 0; i < N; i++) if (kept[i] && hm[i]) handLeft++; }
  let x0 = w, y0 = h, x1 = -1, y1 = -1, onEdge = 0, unsureK = 0; nKept = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!kept[i]) continue;
    nKept++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) onEdge++;
    if (al[i] < 160) unsureK++;
  }
  // a soft edge band round the part, never into the hand
  const zone = grow(kept, w, h, 3), keep = Buffer.alloc(N), handZ = useHand ? grow(hand, w, h, 2) : null;
  for (let i = 0; i < N; i++) keep[i] = kept[i] || (zone[i] && !(handZ && handZ[i])) ? 255 : 0;
  const chk = { bite: (bite - mended) / nKept, mended: mended / nKept, handLeft: handLeft / nKept, edge: onEdge / (2 * (w + h)), part: nKept / N, unsure: unsureK / nKept };
  return { keep, w, h, box: [x0 / sc, y0 / sc, (x1 + 1) / sc, (y1 + 1) / sc], hand: useHand && n2 < nFg, st: { fg: nFg, kept: nKept, proof: P.proof, rest: Math.round(n2 / nFg * 100) / 100 }, chk };
}
// how wrong a result looks (0 = nothing seen) and what the person taking photos could do better. A tan or brown part (skinPart) makes
// the hand test unsure, so a bite counts more and skin left on it less.
export function judge(P, r) {
  if (!r) return { pen: 9, why: ['nopart'] };
  const c = r.chk, skinny = P.proof && P.skinPart >= 0.25, why = [];
  let pen = 0;
  pen += (skinny ? 12 : 6) * Math.max(0, c.bite - (skinny ? 0.004 : 0.02));
  pen += (skinny ? 2 : 6) * Math.max(0, c.handLeft - 0.004);
  if (c.edge > 0.04) why.push('edge');             // the part runs out of the photo
  if (c.part < 0.012) why.push('small');           // the part is a small spot in the photo
  if (c.unsure > 0.35 && c.part > 0.02) why.push('unsure');   // the AI could not tell part from background well
  if (c.bite > 0.03 && !c.mended) why.push('bite'); else if (c.mended > 0.03 || (P.proof && c.handLeft > 0.03)) why.push('hand');
  return { pen: Math.round(pen * 1000) / 1000, why };
}
// the kind of photo, for learning which way works best: a skin-coloured part or not, a hand in the photo or not
export const kindOf = P => (P.skinPart >= 0.25 ? 's' : 'n') + (P.proof ? 'h' : '-');
// the order to try the ways: best win rate first for this kind of photo (stats: { way: [wins, losses] })
export function orderFor(stats, avoid = []) {
  const sc = w => { const s = (stats || {})[w] || [0, 0]; return (s[0] + 1) / (s[0] + s[1] + 2); };
  return WAY_ORDER.filter(w => !avoid.includes(w)).map((w, i) => [w, sc(w) - i * 1e-6]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
// distance to the nearest 0 of a 0/1 map (chamfer: 3 per pixel straight, 4 diagonal); edge0: beyond the photo counts as a 0
function dist(m, w, h, edge0 = true) {
  const N = w * h, d = new Int32Array(N), BIG = 1 << 29, off = edge0 ? 0 : BIG;
  for (let i = 0; i < N; i++) d[i] = m[i] ? BIG : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i]; if (!v) continue;
    const l = x > 0 ? d[i - 1] : off, u = y > 0 ? d[i - w] : off, ul = x > 0 && y > 0 ? d[i - w - 1] : off, ur = x < w - 1 && y > 0 ? d[i - w + 1] : off;
    if (l + 3 < v) v = l + 3; if (u + 3 < v) v = u + 3; if (ul + 4 < v) v = ul + 4; if (ur + 4 < v) v = ur + 4; d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i]; if (!v) continue;
    const r = x < w - 1 ? d[i + 1] : off, dn = y < h - 1 ? d[i + w] : off, dr = x < w - 1 && y < h - 1 ? d[i + w + 1] : off, dl = x > 0 && y < h - 1 ? d[i + w - 1] : off;
    if (r + 3 < v) v = r + 3; if (dn + 3 < v) v = dn + 3; if (dr + 4 < v) v = dr + 4; if (dl + 4 < v) v = dl + 4; d[i] = v;
  }
  return d;
}
// pieces of a 0/1 map split at narrow joins: { lab, st } like areas(), plus the cores (seed) and each pixel's core depth (th).
// Each joined area on its own: its cores are its thickest parts (a thin cable lying next to a big box still gets its own).
function cores(m, w, h) {
  const N = w * h, D = dist(m, w, h), A = areas(m, w, h), top = new Int32Array(A.st.length);
  for (let i = 0; i < N; i++) if (A.lab[i] && D[i] > top[A.lab[i]]) top[A.lab[i]] = D[i];
  const seed = new Uint8Array(N), th = new Int32Array(N);
  for (let i = 0; i < N; i++) { const id = A.lab[i]; if (!id) continue; th[i] = Math.max(Math.min(Math.round(9 * KS), top[id]), Math.round(top[id] * 0.2)); if (D[i] >= th[i]) seed[i] = 1; }
  const C = areas(seed, w, h), lab = new Int32Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (C.lab[i]) { lab[i] = C.lab[i]; q[qt++] = i; }
  while (qh < qt) {
    const p = q[qh++], x = p % w, y = (p - x) / w;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
      const r = yy * w + xx; if (m[r] && !lab[r]) { lab[r] = lab[p]; q[qt++] = r; }
    }
  }
  const st = C.st.map(a => a && { n: 0, edge: false, x0: w, y0: h, x1: -1, y1: -1, sx: 0, sy: 0 });
  for (let i = 0; i < N; i++) {
    if (!lab[i]) continue;
    const a = st[lab[i]], x = i % w, y = (i - x) / w;
    a.n++; a.sx += x; a.sy += y;
    if (x < a.x0) a.x0 = x; if (x > a.x1) a.x1 = x; if (y < a.y0) a.y0 = y; if (y > a.y1) a.y1 = y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) a.edge = true;
  }
  return { lab, st, seed, th };
}
// the logo, faint, centred, as a full-size alpha layer
const LOGOS = new Map();   // logo made to a size, kept for the next photos (photos from one phone have the same size)
async function logoLayer(W, H) {
  const lh = Math.round(Math.min(W, H) * LOGO_SIZE);
  let L = LOGOS.get(lh);
  if (!L) {
    const { data, info } = await sharp(LOGO_FILE).resize({ height: lh, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    L = { data, w: info.width, h: info.height };
    if (LOGOS.size >= 6) LOGOS.delete(LOGOS.keys().next().value);
    LOGOS.set(lh, L);
  }
  return { ...L, x0: Math.round((W - L.w) / 2), y0: Math.round((H - L.h) / 2) };
}
// a firmer edge: the AI's faint haze around the part goes, soft edges stay soft
const FIRM = new Float32Array(256).map((_, v) => { const a = v / 255; return a <= 0.15 ? 0 : a >= 0.85 ? 1 : (a - 0.15) / 0.7; });
// "Keep original": the photo as taken, the faint logo behind the part (outside the logo nothing changes)
function composeW(rgb, A, W, H, L) {
  const out = Buffer.from(rgb);
  for (let ly = 0; ly < L.h; ly++) {
    const y = ly + L.y0; if (y < 0 || y >= H) continue;
    for (let lx = 0; lx < L.w; lx++) {
      const x = lx + L.x0; if (x < 0 || x >= W) continue;
      const q = (ly * L.w + lx) * 4, la = L.data[q + 3] / 255 * LOGO_W; if (!la) continue;
      const i = y * W + x, f = la * (1 - FIRM[A[i]]), p = i * 3; if (!f) continue;
      out[p] = rgb[p] + (L.data[q] - rgb[p]) * f + 0.5; out[p + 1] = rgb[p + 1] + (L.data[q + 1] - rgb[p + 1]) * f + 0.5; out[p + 2] = rgb[p + 2] + (L.data[q + 2] - rgb[p + 2]) * f + 0.5;
    }
  }
  return out;
}
// the clean copy: the square [x0, y0, s] of the photo (outside it: white); the part (room light taken out, gain g) over white with the
// faint logo and the part's soft shadow (sh: s x s, dropped dy pixels)
function composeC(rgb, A, W, H, x0, y0, s, L, sh, dy, g) {
  const out = Buffer.alloc(s * s * 3), gr = g.r, gg = g.g, gb = g.b, so = SHADOW.op / 255;
  // the small shadow read smoothly: for every column its two source columns and weight, the same for each row
  const t = sh ? sh.t : 0, sd = sh ? sh.data : null, xa = new Int32Array(s), xw = new Float32Array(s);
  if (sh) for (let x = 0; x < s; x++) { const f = Math.min(t - 1, Math.max(0, (x + 0.5) * t / s - 0.5)); xa[x] = Math.min(t - 2, f | 0); xw[x] = f - xa[x]; }
  for (let y = 0; y < s; y++) {
    const sy = y + y0, inRow = sy >= 0 && sy < H, ly = y - L.y0, inY = ly >= 0 && ly < L.h, shy = y - dy, inS = !!sh && shy >= 0 && shy < s;
    let r0 = 0, r1 = 0, yw = 0;
    if (inS) { const f = Math.min(t - 1, Math.max(0, (shy + 0.5) * t / s - 0.5)), ya = Math.min(t - 2, f | 0); yw = f - ya; r0 = ya * t; r1 = r0 + t; }
    for (let x = 0; x < s; x++) {
      let br = 255, bg = 255, bb = 255;
      if (inY) { const lx = x - L.x0; if (lx >= 0 && lx < L.w) { const q = (ly * L.w + lx) * 4, la = L.data[q + 3] / 255 * LOGO_C; if (la > 0) { br += (L.data[q] - br) * la; bg += (L.data[q + 1] - bg) * la; bb += (L.data[q + 2] - bb) * la; } } }
      if (inS) {
        const xi = xa[x], wx = xw[x], a0 = sd[r0 + xi] + (sd[r0 + xi + 1] - sd[r0 + xi]) * wx, a1 = sd[r1 + xi] + (sd[r1 + xi + 1] - sd[r1 + xi]) * wx, v = a0 + (a1 - a0) * yw;
        if (v > 0.5) { const f = 1 - v * so; br *= f; bg *= f; bb *= f; }
      }
      const o = (y * s + x) * 3, sx = x + x0;
      let a = 0, p = 0;
      if (inRow && sx >= 0 && sx < W) { const i = sy * W + sx; a = FIRM[A[i]]; p = i * 3; }
      if (a === 0) { out[o] = br + 0.5; out[o + 1] = bg + 0.5; out[o + 2] = bb + 0.5; continue; }
      const r = Math.min(255, rgb[p] * gr), gn = Math.min(255, rgb[p + 1] * gg), b = Math.min(255, rgb[p + 2] * gb), na = 1 - a;
      out[o] = r * a + br * na + 0.5; out[o + 1] = gn * a + bg * na + 0.5; out[o + 2] = b * a + bb * na + 0.5;
    }
  }
  return out;
}
// the part's soft shadow for the square: its alpha, made small, blurred and made big again (by the image library: fast)
async function shadowOf(A, W, H, x0, y0, s) {
  const k = 8, t = Math.max(8, Math.round(s / k)), sq = Buffer.alloc(t * t);
  for (let y = 0; y < t; y++) {
    const sy = Math.floor((y + 0.5) * s / t) + y0; if (sy < 0 || sy >= H) continue;
    for (let x = 0; x < t; x++) { const sx = Math.floor((x + 0.5) * s / t) + x0; if (sx >= 0 && sx < W) sq[y * t + x] = A[sy * W + sx]; }
  }
  const data = await sharp(sq, { raw: { width: t, height: t, channels: 1 } }).blur(Math.max(0.5, SHADOW.blur * t)).extractChannel(0).raw().toBuffer();
  return { data, t };
}
async function save(buf, W, H, file) {
  const tmp = file + '.' + process.pid + '.tmp';
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: QUALITY, chromaSubsampling: '4:4:4' }).toFile(tmp);
  fs.renameSync(tmp, file);
}
// one photo: learn = { kind: { way: [wins, losses] } } (lib/photoai.mjs keeps it), avoid = ways staff said were wrong for this photo,
// way = only this way (a test)
export async function cleanPhoto(src, outC, outW, { learn = {}, avoid = [], way = '' } = {}) {
  await ready();
  const t = Date.now(), steps = {}; let t1 = t;
  const lap = k => { const n = Date.now(); steps[k] = n - t1; t1 = n; };
  // turned the way the phone held it; a see-through PNG goes on white first
  const { data: rgb, info } = await sharp(src, { failOn: 'none' }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; lap('load');
  const m8 = await maskOf(rgb, W, H); lap('ai');
  const P = await prep(rgb, W, H, m8), kind = kindOf(P);
  // the ways in the order that has worked best for this kind of photo; the first one with nothing wrong is kept, else the best of all
  // (no hand in the photo: "none" finds the same as "std")
  const order = (way && WAYS[way] ? [way] : orderFor(learn[kind], avoid)).filter(w => P.proof || w !== 'none' || avoid.includes('std')), tried = [];
  let best = null;
  for (const w of order.length ? order : ['std']) {
    const r = pick(P, WAYS[w]), j = judge(P, r);
    tried.push({ way: w, pen: j.pen, why: j.why });
    if (!best || j.pen < best.j.pen) best = { way: w, r, j };
    // nothing wrong seen, or this way nearly always wins for this kind of photo and nothing badly wrong: no need to try more
    const ws = (learn[kind] || {})[w];
    if (!j.pen || (ws && ws[0] >= 5 && ws[0] >= 4 * ws[1] && j.pen < 0.1)) break;
  }
  lap('find');
  const pm = best.r, sm = P.w * P.h;
  // the final see-through mask at the AI's size: the AI's mask where the part was kept, then made full size once
  let keepAt = null;
  if (pm) keepAt = await sharp(pm.keep, { raw: { width: pm.w, height: pm.h, channels: 1 } }).resize(MODEL.side, MODEL.side, { fit: 'fill', kernel: 'cubic' }).extractChannel(0).raw().toBuffer();
  const a8 = Buffer.alloc(m8.length); for (let i = 0; i < m8.length; i++) a8[i] = keepAt ? (m8[i] * keepAt[i] + 127) / 255 : m8[i];
  const A = await sharp(a8, { raw: { width: MODEL.side, height: MODEL.side, channels: 1 } }).resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer();
  lap('mask');
  // the clean copy: a square round the part (the part 4/5 of it), never bigger than the photo, nothing made smaller or bigger
  let x = 0, y = 0, s = Math.max(W, H);
  if (pm) {
    const [bx0, by0, bx1, by1] = pm.box, big = Math.ceil(Math.max(bx1 - bx0, by1 - by0));
    s = Math.max(big, Math.min(Math.max(Math.round(big / FILL), 600), Math.max(W, H)));
    x = Math.round((bx0 + bx1 - s) / 2); y = Math.round((by0 + by1 - s) / 2);
  } else { x = Math.round((W - s) / 2); y = Math.round((H - s) / 2); }
  // the part a little brighter when the room was dim (its brightest parts should be near white), with the room light's colour out
  const g = { ...P.wb }; let hi = 0;
  if (pm) {
    const hist = new Uint32Array(256); let n = 0;
    for (let i = 0, p = 0; i < sm; i++, p += 3) if (pm.keep[i] && P.al[i] >= 200) { hist[Math.min(255, Math.round(0.299 * P.img[p] * g.r + 0.587 * P.img[p + 1] * g.g + 0.114 * P.img[p + 2] * g.b))]++; n++; }
    for (let v = 255, c = 0; v >= 0; v--) { c += hist[v]; if (c >= n * 0.01) { hi = v; break; } }
    if (hi > 40 && hi < 228) { const e = Math.min(1.15, 236 / hi); g.r *= e; g.g *= e; g.b *= e; }
  }
  const [sh, LC, LW] = await Promise.all([pm ? shadowOf(A, W, H, x, y, s) : null, logoLayer(s, s), logoLayer(W, H)]);
  lap('extra');
  const cC = composeC(rgb, A, W, H, x, y, s, LC, sh, Math.round(SHADOW.dy * s), g), cW = composeW(rgb, A, W, H, LW);
  lap('draw');
  await Promise.all([save(cC, s, s, outC), save(cW, W, H, outW)]);
  lap('save');
  const why = best.j.why;
  return { ms: Date.now() - t, width: s, height: s, part: pm ? 'found' : 'not found', hand: !!(pm && pm.hand), way: best.way, kind, tried, why, steps, wb: [g.r, g.g, g.b].map(v => Math.round(v * 100) / 100), ...(pm ? pm.st : {}) };
}

// ---- as a child process of server.mjs (lib/photoai.mjs): one photo at a time; the server ends it when there is nothing to do ----
const msg = e => String(e && e.message || e).slice(0, 300);
if (process.send) {
  const readyP = ready();
  readyP.then(() => process.send({ type: 'up' }), e => process.send({ type: 'fatal', error: msg(e) }, () => process.exit(1)));
  process.on('message', async m => {
    if (!m || m.type !== 'job') return;
    try { await readyP; const r = await cleanPhoto(m.src, m.outC, m.outW, { learn: m.learn || {}, avoid: m.avoid || [] }); process.send({ type: 'done', h: m.h, ok: true, ...r }); }
    catch (e) { process.send({ type: 'done', h: m.h, ok: false, error: msg(e) }); }
  });
  process.on('disconnect', () => process.exit(0));
} else if (process.argv[2] === '--model') {   // ai/install.sh: download and check the model once, at update time
  modelFile().then(() => console.log('   photo AI model ready (data/models)'), e => { console.error('   photo AI model:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--check') {   // ai/install.sh: the AI loads on this server
  ready().then(() => console.log('   photo AI loads fine (' + CPU + ' thread' + (CPU > 1 ? 's' : '') + ')'), e => { console.error('   photo AI does not load here:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--test') {
  const src = process.argv[3], dir = process.argv[4] || '.', way = process.argv[5] || '';
  fs.mkdirSync(dir, { recursive: true });
  const b = path.basename(src).replace(/\.[^.]+$/, '') + (way ? '-' + way : '');
  cleanPhoto(src, path.join(dir, b + '-c.jpg'), path.join(dir, b + '-w.jpg'), { way }).then(r => console.log(src, JSON.stringify(r)), e => { console.error(e); process.exit(1); });
}
