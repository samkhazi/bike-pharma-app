// Product photo cleanup (Sam 2026-10-11 16:59Z, 17:08Z, 17:11Z): the background behind the part becomes white, and the Bike Pharma
// logo (logo only, faint) sits BEHIND the part. The photo as taken is never changed; two new copies are made next to it:
//   <hash>-c.jpg  clean: part on white, logo behind it         <hash>-w.jpg  "Keep original": the photo as taken, logo behind the part
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
  return big;
}
// the logo, faint, centred, as a full-size alpha layer
async function logoLayer(W, H) {
  const lh = Math.round(Math.min(W, H) * LOGO_SIZE);
  const { data, info } = await sharp(LOGO_FILE).resize({ height: lh, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, x0: Math.round((W - info.width) / 2), y0: Math.round((H - info.height) / 2) };
}
// out = part over (background with the faint logo); background = white for the clean copy, the photo itself for "Keep original"
function compose(rgb, mask, L, W, H, white) {
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const ly = y - L.y0, inY = ly >= 0 && ly < L.h;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 3;
      let a = mask[i] / 255;
      // a firmer edge: the AI's faint haze around the part goes, soft edges stay soft
      a = a <= 0.06 ? 0 : a >= 0.94 ? 1 : (a - 0.06) / 0.88;
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
  const mask = await maskOf(rgb, W, H), L = await logoLayer(W, H);
  await save(compose(rgb, mask, L, W, H, false), W, H, outW);
  await save(compose(rgb, mask, L, W, H, true), W, H, outC);
  return { ms: Date.now() - t, width: W, height: H };
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
