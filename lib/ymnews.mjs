// 24r (Sam 2026-11-27: YPEC's News column, e.g. Parts News IYM:531 'Race Bearing / Cylinder Piston / Chain Sprocket Kit'): reads which parts
// make up which kit from a Yamaha Parts News PDF (kept by lib/ypecsync.mjs in <hero-sync>/yamaha/ypec/news/). The tables differ from news to
// news, so nothing is read by column names: the words' places on the page are read (poppler's pdftotext -bbox) and
//   - a part number is a word (or a word and the piece of it wrapped onto the next line) that Yamaha's lists know (known(key))
//   - a kit is such a number that isKit(key) says is a kit; a kit "anchors" a table row when a known part stands to its right on its line
//   - each other part belongs to the nearest anchoring kit to its left (the nearest column, then the nearest line)
//   - its quantity is the number under the Qty heading on its line, when there is one
// codes: the 4-character model codes the news names (the builder keeps those it knows). A kit with fewer than 2 parts found is left out; parse() says which news gave nothing, so nothing is dropped without a word.
import { execFileSync } from 'node:child_process';

const ent = s => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
export const ymKey = pn => { const c = String(pn ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.length === 10 ? c + '00' : c; };

// pdftotext -bbox output -> pages [{ w, h, words: [{ x0, y0, x1, y1, t }] }]
export function bboxPages(html) {
  const pages = [];
  for (const pm of String(html).matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)) {
    const words = [...pm[3].matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map(m => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: ent(m[5]) }));
    pages.push({ w: +pm[1], h: +pm[2], words });
  }
  return pages;
}

export function parseNews(pages, known, isKit) {
  const kits = new Map(), text = pages.map(p => p.words.map(w => w.t).join(' ')).join('\n');
  for (const pg of pages) {
    const W = pg.words, used = new Set(), hits = [];
    W.forEach((w, i) => {
      if (used.has(i)) return;
      const n = w.t.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (n.length < 8 || n.length > 13 || !/\d/.test(n) || !/^[A-Z0-9]+$/.test(n)) return;
      let k = ymKey(n), box = { ...w };
      if (!known(k)) {   // wrapped onto the next line: "BCWE131100" / "00"
        const h = w.y1 - w.y0; let j = -1;
        W.forEach((v, vi) => { if (j >= 0 || vi === i || used.has(vi)) return; const vn = v.t.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (vn.length >= 1 && vn.length <= 4 && v.y0 > w.y0 && v.y0 - w.y1 < 1.6 * h && Math.abs((v.x0 + v.x1) / 2 - (w.x0 + w.x1) / 2) < 40 && known(ymKey(n + vn))) j = vi; });
        if (j < 0) return;
        k = ymKey(n + W[j].t.toUpperCase().replace(/[^A-Z0-9]/g, '')); used.add(j); box = { x0: Math.min(w.x0, W[j].x0), y0: w.y0, x1: Math.max(w.x1, W[j].x1), y1: W[j].y1 };
      }
      used.add(i); hits.push({ k, ...box, yc: (box.y0 + box.y1) / 2, kit: !!isKit(k) });
    });
    if (!hits.length) continue;
    const hs = hits.map(h => h.y1 - h.y0).sort((a, b) => a - b), lh = Math.max(4, hs[hs.length >> 1]);
    const comps = hits.filter(h => !h.kit), anchors = hits.filter(h => h.kit && comps.some(c => c.x0 > h.x1 && c.x0 - h.x1 < 0.4 * pg.w && Math.abs(c.yc - h.yc) <= 0.9 * lh));
    const qtyHeads = W.filter(w => /^Q'?\.?\s*TY\.?$/i.test(w.t.replace(/[’`]/g, "'")));
    // each part's kit column: the nearest anchoring kits to its left; in that column the parts fall into blocks (a gap of more than ~1.7 lines
    // between them), and a block with exactly one kit beside it goes to that kit; otherwise the nearest kit by line
    const byCol = new Map();
    for (const c of comps) {
      const left = anchors.filter(a => a.x1 < c.x0); if (!left.length) continue;
      const mx = Math.max(...left.map(a => a.x0)), col = left.filter(a => a.x0 >= mx - 25), ck = Math.round(mx);
      (byCol.get(ck) || byCol.set(ck, { col, cs: [] }).get(ck)).cs.push(c);
    }
    const lineOf = c => W.filter(w => Math.abs((w.y0 + w.y1) / 2 - c.yc) <= 0.6 * lh && w.x0 > c.x1);
    const qtyOf = c => {
      const ln = lineOf(c).sort((p, q) => p.x0 - q.x0), sec = ln.find(w => /^\d{3}$/.test(w.t));
      if (sec) { const q = ln.filter(w => /^\d{1,2}$/.test(w.t) && w.x1 <= sec.x0 + 1 && sec.x0 - w.x1 < 20).pop(); if (q) return q.t; }
      const hd = qtyHeads.filter(h => h.x0 > c.x1).sort((p, r) => p.x0 - r.x0)[0];
      if (hd) { const hc = (hd.x0 + hd.x1) / 2, q = ln.find(w => /^\d{1,2}$/.test(w.t) && Math.abs((w.x0 + w.x1) / 2 - hc) < 12); if (q) return q.t; }
      return '';
    };
    const put = (a, c) => { const g = kits.get(a.k) || new Map(); kits.set(a.k, g); if (!g.has(c.k)) g.set(c.k, qtyOf(c)); };
    for (const { col, cs } of byCol.values()) {
      cs.sort((p, q) => p.yc - q.yc);
      const gaps = cs.slice(1).map((c, i) => c.yc - cs[i].yc).filter(g => g > 0.3 * lh).sort((p, q) => p - q), md = gaps.length ? gaps[gaps.length >> 1] : lh;
      const blocks = []; for (const c of cs) { const b = blocks[blocks.length - 1]; if (b && c.yc - b[b.length - 1].yc <= 1.7 * md) b.push(c); else blocks.push([c]); }
      for (const b of blocks) {
        const lo = b[0].yc - lh, hi = b[b.length - 1].yc + lh, inb = col.filter(a => a.yc >= lo && a.yc <= hi);
        for (const c of b) { const a = inb.length === 1 ? inb[0] : col.slice().sort((p, q) => Math.abs(p.yc - c.yc) - Math.abs(q.yc - c.yc))[0]; if (a && Math.abs(a.yc - c.yc) <= 12 * lh) put(a, c); }
      }
    }
  }
  const out = {}; for (const [k, g] of kits) if (g.size >= 2) out[k] = [...g].map(([p, q]) => [p, q]);
  const codes = [...new Set((text.toUpperCase().match(/\b[A-Z0-9]{4}\b/g) || []).filter(c => /\d/.test(c) && /[A-Z]/.test(c)))];   // model codes named in it (B9X3, B0Y2, BVB1)
  return { codes, kits: out, only: /not\s+be\s+servic|will\s+not\s+be\s+(?:supplied|sold)|not\s+(?:available|supplied)\s+(?:as\s+)?(?:individual|separate)/i.test(text) };
}

// one PDF file -> parseNews(...), or { error } (no poppler, a broken file)
export function readNews(file, known, isKit) {
  let html; try { html = execFileSync('pdftotext', ['-bbox', '-q', file, '-'], { maxBuffer: 64 << 20, timeout: 60000 }).toString('utf8'); } catch (e) { return { error: String(e.message || e).slice(0, 120), kits: {} }; }
  return parseNews(bboxPages(html), known, isKit);
}
