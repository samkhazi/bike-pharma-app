// Product photo cleanup (Sam 2026-10-11 16:59Z, 17:08Z, 17:11Z): the background behind the part becomes white, and the Bike Pharma
// logo (logo only, faint) sits BEHIND the part. The photo as taken is never changed; two new copies are made next to it:
//   <hash>-c.jpg  clean: part on white, logo behind it         <hash>-w.jpg  "Keep original": the photo as taken, logo behind the part
// v2 (Sam 18:13Z "hands show ho rahe hein", 18:15Z "background full clear rehna he yaar sirf poducts pe focus rehna he"): only the part
// stays. A hand holding it goes (skin-coloured areas that run to the photo's edge: hand and arm), loose bits and faint shadows go, and the
// clean copy is cut square round the part. lib/photoai.mjs makes older copies again (AI_VER).
// Runs as its own process (lib/photoai.mjs starts it when there is work and ends it when idle), so the website keeps its memory.
// The AI model (IS-Net general use, from the rembg project) is downloaded once into data/models/ and checked byte for byte.
//   test on a computer:  node ai/worker.mjs --test <photo> <out folder>
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
const LOGO_OPACITY = 0.13;   // "halka se"
const LOGO_SIZE = 0.62;      // logo height, as a part of the photo's shorter side
const QUALITY = 95;          // 4:4:4 colour, no visible loss
const AN = 1024;           // the part is worked out on a copy this big; the copies keep the photo's full size
const FILL = 0.8;          // the clean copy: the part takes 4/5 of the square
const MAX_SIDE = 5000;       // the copies keep the photo's full size up to 5000 px (12-16 MP phone photos stay as they are); bigger
                             // photos (50-200 MP modes) are made 5000 px so the AI never runs out of memory. The photo as taken is never changed.

let sharp, ort, session, logo;
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
  sharp.concurrency(1); sharp.cache(false);
  const file = await modelFile();
  // no memory arena: about 0.9 GB at the peak instead of 1.8 GB, a little slower
  session = await ort.InferenceSession.create(file, { intraOpNumThreads: Math.max(1, Math.min(2, os.cpus().length - 1)), interOpNumThreads: 1, enableCpuMemArena: false, enableMemPattern: false, graphOptimizationLevel: 'all' });
}

// the part's mask (0..255), full size, from the AI
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
  const big = await sharp(m8, { raw: { width: S, height: S, channels: 1 } }).resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer();
  return { big, m8 };
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
function grow(m, w, h, r) {   // r rounds of a 3x3 grow
  let a = m;
  for (let k = 0; k < r; k++) {
    const b = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = a[y * w + x];
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1) && !v; yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) if (a[yy * w + xx]) { v = 1; break; }
      b[y * w + x] = v;
    }
    a = b;
  }
  return a;
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
function shrink(m, w, h, r) {   // r rounds of a 3x3 shrink
  let a = m;
  for (let k = 0; k < r; k++) {
    const b = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = a[y * w + x];
      if (v) for (let yy = y - 1; yy <= y + 1 && v; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (yy < 0 || xx < 0 || yy >= h || xx >= w || !a[yy * w + xx]) { v = 0; break; }
      b[y * w + x] = v;
    }
    a = b;
  }
  return a;
}
// what to keep, worked out on a small copy: { keep (0/255, small), w, h, box (full size), hand } or null when nothing sure was found
async function partMap(rgb, W, H, m8) {
  const sc = Math.min(1, AN / Math.max(W, H)), w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc)), N = w * h;
  const img = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(w, h, { fit: 'fill' }).raw().toBuffer();
  const al = await sharp(m8, { raw: { width: MODEL.side, height: MODEL.side, channels: 1 } }).resize(w, h, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  // the room light's colour cast taken out first (grey world), so warm or cool light does not make everything look like skin
  let sR = 0, sG = 0, sB = 0;
  for (let p = 0; p < N * 3; p += 3) { sR += img[p]; sG += img[p + 1]; sB += img[p + 2]; }
  const gm = (sR + sG + sB) / 3, gain = v => Math.min(1.7, Math.max(0.6, gm / Math.max(1, v))), gR = gain(sR), gG = gain(sG), gB = gain(sB);
  const fg = new Uint8Array(N), out = new Uint8Array(N), skin = new Uint8Array(N); let nFg = 0;
  for (let i = 0, p = 0; i < N; i++, p += 3) {
    if (al[i] >= 128) { fg[i] = 1; nFg++; } else out[i] = 1;
    if (isSkin(img[p] * gR, img[p + 1] * gG, img[p + 2] * gB)) skin[i] = 1;
  }
  if (nFg < N * 0.001) return null;
  // 1. the hand. Proof that a hand is in the photo: a hand-sized skin area coming in from the photo's edge and touching the part.
  //    Then every skin area on the part's outline goes (fingers, thumb); skin colour inside the part (an orange button) stays.
  //    The hand (or arm) is mostly outside what the AI took as the part; a brown box or a copper part is mostly inside it.
  const S = areas(skin, w, h), near = grow(fg, w, h, 3), touch = new Uint8Array(S.st.length), inside = new Float64Array(S.st.length);
  for (let i = 0; i < N; i++) { const id = S.lab[i]; if (id) { if (near[i]) touch[id] = 1; if (fg[i]) inside[id]++; } }
  //    When the AI took the whole hand as part too: the hand holds something, a thick piece (not skin) that touches the skin area and
  //    also the background (a label on a brown box is closed in by the box, so the box is never taken for a hand).
  const ns = new Uint8Array(N); for (let i = 0; i < N; i++) if (fg[i] && !skin[i]) ns[i] = 1;
  const T = areas(ns, w, h), Dt = dist(ns, w, h), tTop = new Int32Array(T.st.length), tOut = new Uint8Array(T.st.length), holds = new Uint8Array(S.st.length);
  for (let i = 0; i < N; i++) { const t = T.lab[i]; if (!t) continue; if (Dt[i] > tTop[t]) tTop[t] = Dt[i]; if (!tOut[t]) { const x = i % w, y = (i - x) / w; if ((x > 0 && out[i - 1]) || (x < w - 1 && out[i + 1]) || (y > 0 && out[i - w]) || (y < h - 1 && out[i + w])) tOut[t] = 1; } }
  for (let i = 0; i < N; i++) {
    const id = S.lab[i]; if (!id || holds[id]) continue;
    const x = i % w, y = (i - x) / w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      const t = j >= 0 ? T.lab[j] : 0; if (t && tOut[t] && tTop[t] >= 24 && T.st[t].n >= N * 0.005) { holds[id] = 1; break; }
    }
  }
  let proof = false;
  for (let id = 1; id < S.st.length; id++) { const a = S.st[id]; if (a.edge && touch[id] && a.n >= N * 0.005 && a.n <= N * 0.45 && (inside[id] <= a.n * 0.6 || holds[id])) proof = true; }
  const handIn = new Uint8Array(N);
  if (proof) {
    const on = new Uint8Array(N);   // skin the AI took as part
    for (let i = 0; i < N; i++) if (skin[i] && al[i] >= 26) on[i] = 1;
    const O = areas(on, w, h), rim = grow(out, w, h, 2), edgy = new Uint8Array(O.st.length);
    for (let i = 0; i < N; i++) if (O.lab[i] && rim[i]) edgy[O.lab[i]] = 1;
    for (let i = 0; i < N; i++) if (O.lab[i] && edgy[O.lab[i]] && O.st[O.lab[i]].n >= N * 0.0003) handIn[i] = 1;
  }
  const hand = grow(handIn, w, h, 2);   // and the finger's own edge (it grows below into fingers in shadow)
  let fg2 = new Uint8Array(N), n2 = 0;
  for (let i = 0; i < N; i++) if (fg[i] && !hand[i]) fg2[i] = 1;
  if (proof) {
    // on the hand's side: finger bits the skin test missed (a finger in shadow). Pixels on the part's outline whose colour is
    // closer to the hand than to any of the part's main colours go, and so do such pixels joined to them.
    const near2 = grow(hand, w, h, 14), wide = grow(hand, w, h, Math.round(Math.max(w, h) * 0.1)), rim = grow(out, w, h, 2), hIdx = [], pIdx = [];
    for (let i = 0; i < N; i++) { if (handIn[i]) hIdx.push(i); else if (fg2[i] && !near2[i]) pIdx.push(i); }
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
    const op = grow(shrink(fg2, w, h, 4), w, h, 4), nearAll = grow(hand, w, h, 14);
    for (let i = 0; i < N; i++) if (nearAll[i] && !op[i]) { fg2[i] = 0; hand[i] = 1; }
  }
  for (let i = 0; i < N; i++) n2 += fg2[i];
  const useHand = n2 >= nFg * 0.25;   // else the "skin" is the part itself (a copper or brown part): it stays
  const base = useHand ? fg2 : fg;
  // 2. things touching each other are split at their narrow joins (Sam 18:32Z "sirf object utna hi rehna he"): every object has a
  //    thick core (far from the outside); each pixel goes to the nearest core, so thin bits (a key ring, a cable end) stay with the
  //    object they hang from. Then the part: the biggest piece near the middle (and other big pieces); loose bits go.
  const P = cores(base, w, h), cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
  let best = 0, bs = 0;
  for (let id = 1; id < P.st.length; id++) {
    const a = P.st[id], d = Math.hypot(a.sx / a.n - cx, a.sy / a.n - cy) / R;
    a.sc = a.n * (a.edge ? 0.35 : 1) * (1 - 0.5 * Math.min(1, d));
    if (a.sc > bs) { bs = a.sc; best = id; }
  }
  if (!best) return null;
  const B = P.st[best], ids = new Uint8Array(P.st.length), unsure = new Float64Array(P.st.length);
  for (let i = 0; i < N; i++) if (P.lab[i] && al[i] < 200) unsure[P.lab[i]]++;
  const uB = unsure[best] / B.n;
  for (let id = 1; id < P.st.length; id++) {
    const a = P.st[id];
    // other big pieces stay too (a pair of brake shoes, a set of bolts) when the AI is about as sure of them as of the part;
    // things behind the part (a phone, a box, a bottle) it is less sure of
    if (id === best || (a.n >= B.n * 0.15 && (!a.edge || a.n >= B.n * 0.5) && unsure[id] / a.n <= Math.max(0.2, uB + 0.1))) ids[id] = 1;
  }
  const kept = new Uint8Array(N), gone = new Uint8Array(N), sure = new Uint8Array(N), notCore = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (ids[P.lab[i]]) { kept[i] = 1; if (al[i] >= 200) sure[i] = 1; } else if (base[i]) gone[i] = 1;
    if (!P.seed[i]) notCore[i] = 1;
  }
  // 3. thin bits (a strap, a cable) and bits the AI was not sure of that run into something dropped belong to that other thing (the
  //    bottom of a bottle standing behind the part, a lanyard going to a phone): they go too. Thick = within the piece's own core reach.
  const toCore = dist(notCore, w, h, false), sureR = grow(sure, w, h, 3), weak = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (kept[i] && (toCore[i] > P.th[i] || !sureR[i])) weak[i] = 1;
  const Wk = areas(weak, w, h), byGone = grow(gone, w, h, 1), drop = new Uint8Array(Wk.st.length);
  for (let i = 0; i < N; i++) if (Wk.lab[i] && byGone[i]) drop[Wk.lab[i]] = 1;
  for (let i = 0; i < N; i++) if (drop[Wk.lab[i]]) kept[i] = 0;
  // what is left: the part's own pieces (crumbs cut off by the step above go), and the box round them
  const K = areas(kept, w, h); let kmax = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let id = 1; id < K.st.length; id++) kmax = Math.max(kmax, K.st[id].n);
  for (let id = 1; id < K.st.length; id++) { const a = K.st[id]; if (a.n >= kmax * 0.1) { x0 = Math.min(x0, a.x0); y0 = Math.min(y0, a.y0); x1 = Math.max(x1, a.x1); y1 = Math.max(y1, a.y1); } }
  for (let i = 0; i < N; i++) if (K.lab[i] && K.st[K.lab[i]].n < kmax * 0.1) kept[i] = 0;
  if (x1 < 0) return null;
  // 4. a soft edge band round the part, never into the hand
  const zone = grow(kept, w, h, 4), keep = Buffer.alloc(N), handZ = useHand ? grow(hand, w, h, 2) : null;
  for (let i = 0; i < N; i++) keep[i] = zone[i] && !(handZ && handZ[i] && !kept[i]) ? 255 : 0;
  let nKept = 0; for (let i = 0; i < N; i++) nKept += kept[i];
  return { keep, w, h, box: [x0 / sc, y0 / sc, (x1 + 1) / sc, (y1 + 1) / sc], hand: useHand && n2 < nFg, st: { fg: nFg, kept: nKept, proof } };
}
// distance to the nearest 0 of a 0/1 map (chamfer: 3 per pixel straight, 4 diagonal); edge0: beyond the photo counts as a 0
function dist(m, w, h, edge0 = true) {
  const d = new Int32Array(w * h), BIG = 1 << 29, off = edge0 ? 0 : BIG;
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? BIG : 0;
  const at = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? off : d[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
  return d;
}
// pieces of a 0/1 map split at narrow joins: { lab, st } like areas(), plus the cores (seed) and each pixel's core depth (th).
// Each joined area on its own: its cores are its thickest parts (a thin cable lying next to a big box still gets its own).
function cores(m, w, h) {
  const N = w * h, D = dist(m, w, h), A = areas(m, w, h), top = new Int32Array(A.st.length);
  for (let i = 0; i < N; i++) if (A.lab[i] && D[i] > top[A.lab[i]]) top[A.lab[i]] = D[i];
  const seed = new Uint8Array(N), th = new Int32Array(N);
  for (let i = 0; i < N; i++) { const id = A.lab[i]; if (!id) continue; th[i] = Math.max(Math.min(9, top[id]), Math.round(top[id] * 0.2)); if (D[i] >= th[i]) seed[i] = 1; }
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
// a square piece of a raw image (outside the photo: fill)
function cut(src, W, H, ch, x, y, s, fill) {
  const out = Buffer.alloc(s * s * ch, fill);
  const sx0 = Math.max(0, x), sy0 = Math.max(0, y), sx1 = Math.min(W, x + s), sy1 = Math.min(H, y + s);
  if (sx1 > sx0) for (let yy = sy0; yy < sy1; yy++) src.copy(out, ((yy - y) * s + (sx0 - x)) * ch, (yy * W + sx0) * ch, (yy * W + sx1) * ch);
  return out;
}
// the logo, faint, centred, as a full-size alpha layer
async function logoLayer(W, H) {
  const lh = Math.round(Math.min(W, H) * LOGO_SIZE);
  const { data, info } = await sharp(LOGO_FILE).resize({ height: lh, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, x0: Math.round((W - info.width) / 2), y0: Math.round((H - info.height) / 2) };
}
// out = part over (background with the faint logo); background = white for the clean copy, the photo itself for "Keep original"
function compose(rgb, mask, keep, L, W, H, white) {
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const ly = y - L.y0, inY = ly >= 0 && ly < L.h;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 3;
      let a = mask[i] / 255 * (keep ? keep[i] / 255 : 1);
      // a firmer edge: the AI's faint haze around the part goes, soft edges stay soft
      a = a <= 0.15 ? 0 : a >= 0.85 ? 1 : (a - 0.15) / 0.7;
      let br = white ? 255 : rgb[p], bg = white ? 255 : rgb[p + 1], bb = white ? 255 : rgb[p + 2];
      const lx = x - L.x0;
      if (inY && lx >= 0 && lx < L.w) {
        const q = (ly * L.w + lx) * 4, la = L.data[q + 3] / 255 * LOGO_OPACITY;
        if (la > 0) { br += (L.data[q] - br) * la; bg += (L.data[q + 1] - bg) * la; bb += (L.data[q + 2] - bb) * la; }
      }
      out[p] = Math.round(rgb[p] * a + br * (1 - a)); out[p + 1] = Math.round(rgb[p + 1] * a + bg * (1 - a)); out[p + 2] = Math.round(rgb[p + 2] * a + bb * (1 - a));
    }
  }
  return out;
}
async function save(buf, W, H, file) {
  const tmp = file + '.' + process.pid + '.tmp';
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: QUALITY, chromaSubsampling: '4:4:4' }).toFile(tmp);
  fs.renameSync(tmp, file);
}
export async function cleanPhoto(src, outC, outW) {
  await ready();
  const t = Date.now();
  // turned the way the phone held it; a see-through PNG goes on white first
  const { data: rgb, info } = await sharp(src, { failOn: 'none' }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const { big: mask, m8 } = await maskOf(rgb, W, H), pm = await partMap(rgb, W, H, m8);
  const keep = pm ? await sharp(pm.keep, { raw: { width: pm.w, height: pm.h, channels: 1 } }).resize(W, H, { fit: 'fill', kernel: 'cubic' }).extractChannel(0).raw().toBuffer() : null;
  await save(compose(rgb, mask, keep, await logoLayer(W, H), W, H, false), W, H, outW);
  if (!pm) {   // nothing sure found: the whole photo, cleaned as the AI sees it
    await save(compose(rgb, mask, keep, await logoLayer(W, H), W, H, true), W, H, outC);
    return { ms: Date.now() - t, width: W, height: H, part: 'not found' };
  }
  // clean copy: a square round the part (the part 4/5 of it), never bigger than the photo, nothing made smaller or bigger
  const [bx0, by0, bx1, by1] = pm.box, big = Math.ceil(Math.max(bx1 - bx0, by1 - by0));
  const s = Math.max(big, Math.min(Math.max(Math.round(big / FILL), 600), Math.max(W, H)));
  const x = Math.round((bx0 + bx1 - s) / 2), y = Math.round((by0 + by1 - s) / 2);
  await save(compose(cut(rgb, W, H, 3, x, y, s, 255), cut(mask, W, H, 1, x, y, s, 0), cut(keep, W, H, 1, x, y, s, 0), await logoLayer(s, s), s, s, true), s, s, outC);
  return { ms: Date.now() - t, width: s, height: s, hand: pm.hand, ...pm.st };
}

// ---- as a child process of server.mjs (lib/photoai.mjs): one photo at a time; the server ends it when there is nothing to do ----
const msg = e => String(e && e.message || e).slice(0, 300);
if (process.send) {
  const readyP = ready();
  readyP.then(() => process.send({ type: 'up' }), e => process.send({ type: 'fatal', error: msg(e) }, () => process.exit(1)));
  process.on('message', async m => {
    if (!m || m.type !== 'job') return;
    try { await readyP; const r = await cleanPhoto(m.src, m.outC, m.outW); process.send({ type: 'done', h: m.h, ok: true, ...r }); }
    catch (e) { process.send({ type: 'done', h: m.h, ok: false, error: msg(e) }); }
  });
  process.on('disconnect', () => process.exit(0));
} else if (process.argv[2] === '--model') {   // ai/install.sh: download and check the model once, at update time
  modelFile().then(() => console.log('   photo AI model ready (data/models)'), e => { console.error('   photo AI model:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--check') {   // ai/install.sh: the AI loads on this server
  ready().then(() => console.log('   photo AI loads fine (' + Math.min(2, Math.max(1, os.cpus().length - 1)) + ' thread)'), e => { console.error('   photo AI does not load here:', msg(e)); process.exit(1); });
} else if (process.argv[2] === '--test') {
  const src = process.argv[3], dir = process.argv[4] || '.';
  fs.mkdirSync(dir, { recursive: true });
  const b = path.basename(src).replace(/\.[^.]+$/, '');
  cleanPhoto(src, path.join(dir, b + '-c.jpg'), path.join(dir, b + '-w.jpg')).then(r => console.log(src, r), e => { console.error(e); process.exit(1); });
}
