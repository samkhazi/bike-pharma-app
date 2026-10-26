// Update 12z (Sam 2026-10-26: "proper clean format ... in one PDF"): the nightly products report as a designed email (HTML) and the
// same report as a PDF attachment. No packages: the PDF is written by hand (A4, Helvetica, tables), text only in Latin-1.
const Y = '#F5C400', K = '#111111', G = '#6B6B6B', L = '#E6E6E6', SOFT = '#FFF8D6';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* D: { date, old, added: [{name, pn, by, t, ph}], byStaff: [[name, n]], photos, photoProducts, photoBy: [[name, n]], noPhoto: [{name, pn}],
   total, reportAt } */
export function reportHtml(D) {
  const card = (n, label, hi) => `<td style="padding:6px" width="33%"><div style="background:${hi ? Y : '#fff'};border:1px solid ${hi ? Y : L};border-radius:12px;padding:16px">
    <div style="font-size:28px;font-weight:800;color:${K}">${esc(n)}</div><div style="font-size:12px;color:${hi ? K : G};margin-top:2px">${esc(label)}</div></div></td>`;
  const th = s => `<th align="left" style="padding:9px 10px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:${G};border-bottom:2px solid ${K}">${s}</th>`;
  const td = (s, x = '') => `<td style="padding:9px 10px;font-size:13px;color:${K};border-bottom:1px solid ${L};${x}">${s}</td>`;
  const h2 = s => `<h2 style="font-size:16px;margin:28px 0 8px;color:${K}">${esc(s)}</h2>`;
  const table = (head, rows) => `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fff">${'<tr>' + head.map(th).join('') + '</tr>'}${rows.join('')}</table>`;
  const ph = n => n ? `<span style="background:#E8F6EC;color:#1B7A3A;border-radius:99px;padding:2px 8px;font-size:12px;font-weight:700">${n}</span>` : `<span style="background:#FDECEC;color:#B42318;border-radius:99px;padding:2px 8px;font-size:12px;font-weight:700">No photo</span>`;
  return `<!doctype html><html><body style="margin:0;background:#F4F4F2;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px 10px">
<table width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:${K};padding:22px 24px"><div style="color:${Y};font-size:20px;font-weight:800;letter-spacing:.06em">BIKE PHARMA</div>
<div style="color:#fff;font-size:14px;margin-top:4px">Daily products report &middot; ${esc(D.date)}</div></td></tr>
<tr><td style="padding:18px 18px 24px">
<table width="100%" cellspacing="0" cellpadding="0"><tr>${card(D.added.length, D.old ? 'Products added that day' : 'Products added today', true)}${card(D.old ? '-' : D.photos, 'Photos uploaded')}${card(D.noPhoto.length, 'Without photo (of ' + D.total + ')')}</tr></table>
${D.byStaff.length ? h2('Added by') + table(['Staff', 'Products'], D.byStaff.map(([n, c]) => '<tr>' + td(esc(n)) + td('<b>' + c + '</b>') + '</tr>')) : ''}
${h2(D.old ? 'Products added that day' : 'Products added today')}
${D.added.length ? table(['#', 'Product', 'Part no.', 'Added by', 'Time', 'Photos'], D.added.map((x, i) => '<tr>' + td(i + 1, 'color:' + G) + td('<b>' + esc(x.name) + '</b>') + td(esc(x.pn || '-'), 'font-family:monospace') + td(esc(x.by)) + td(esc(x.t)) + td(ph(x.ph)) + '</tr>'))
    : `<div style="padding:14px;background:${SOFT};border-radius:10px;font-size:13px">No products were added ${D.old ? 'that day' : 'today'}.</div>`}
${D.photoBy.length ? h2('Photos uploaded by') + table(['Staff', 'Photos'], D.photoBy.map(([n, c]) => '<tr>' + td(esc(n)) + td('<b>' + c + '</b>') + '</tr>')) : ''}
${D.noPhoto.length ? h2('Without a photo' + (D.noPhoto.length > 50 ? ' (first 50 of ' + D.noPhoto.length + ')' : '')) + table(['Product', 'Part no.'], D.noPhoto.slice(0, 50).map(p => '<tr>' + td(esc(p.name)) + td(esc(p.pn || '-'), 'font-family:monospace') + '</tr>')) : ''}
<p style="font-size:12px;color:${G};margin-top:24px">The same report is attached as a PDF. Inventory &gt; Photos missing lists the products without a photo.<br>Sent by the Bike Pharma server every night at ${esc(+D.reportAt > 12 ? D.reportAt - 12 + " pm" : D.reportAt + " am")} (India time).</p>
</td></tr></table></td></tr></table></body></html>`;
}

// ---------- PDF ----------
const lat = s => String(s ?? '').replace(/₹/g, 'Rs ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
const pstr = s => '(' + lat(s).replace(/[\\()]/g, '\\$&') + ')';
const rgb = h => [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
const wOf = (s, size, bold) => lat(s).length * size * (bold ? 0.56 : 0.52);   // Helvetica, close enough to cut long names
const fit = (s, w, size, bold) => { s = lat(s); if (wOf(s, size, bold) <= w) return s; while (s.length > 1 && wOf(s + '...', size, bold) > w) s = s.slice(0, -1); return s + '...'; };

export function reportPdf(D) {
  const W = 595, H = 842, M = 36, pages = []; let ops = [], y = 0;
  const T = (x, yy, s, size = 10, bold = false, col = K) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(col)} rg ${x.toFixed(1)} ${yy.toFixed(1)} Td ${pstr(s)} Tj ET`);
  const R = (x, yy, w, h, col) => ops.push(`${rgb(col)} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  const Ln = (x1, y1, x2, col = L, wd = 0.6) => ops.push(`${rgb(col)} RG ${wd} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y1.toFixed(1)} l S`);
  const newPage = () => { if (ops.length) pages.push(ops); ops = []; R(0, H - 64, W, 64, K); T(M, H - 34, 'BIKE PHARMA', 16, true, Y); T(M, H - 52, 'Daily products report  ·  ' + D.date, 10, false, '#FFFFFF'); y = H - 92; };
  const need = h => { if (y - h < 50) newPage(); };
  const h2 = s => { need(50); y -= 22; T(M, y, s, 13, true); y -= 12; };
  const table = (cols, rows) => {   // cols: [[title, width, mono]]
    const head = () => { let x = M; R(M, y - 18, W - 2 * M, 20, '#F4F4F2'); for (const [t, w] of cols) { T(x + 5, y - 12, t.toUpperCase(), 7.5, true, G); x += w; } Ln(M, y - 18, W - M, K, 1); y -= 20; };
    need(44); head();
    for (const r of rows) {
      if (y - 18 < 50) { newPage(); head(); }
      let x = M; cols.forEach(([, w, mono], i) => { const c = r[i]; const bold = i === 1 && cols.length > 4;
        if (c && typeof c === 'object') { R(x + 4, y - 14, Math.min(w - 8, wOf(c.t, 7.5, true) + 10), 12, c.bg); T(x + 9, y - 11, c.t, 7.5, true, c.fg); }
        else T(x + 5, y - 12, fit(c, w - 10, 9, bold || mono), 9, bold, i === 0 && cols.length > 4 ? G : K); x += w; });
      Ln(M, y - 18, W - M); y -= 18;
    }
    y -= 6;
  };
  newPage();
  // the three numbers
  const cw = (W - 2 * M - 16) / 3, cards = [[D.added.length, D.old ? 'Products added that day' : 'Products added today', true], [D.old ? '-' : D.photos, 'Photos uploaded'], [D.noPhoto.length, 'Without photo (of ' + D.total + ')']];
  cards.forEach(([n, l, hi], i) => { const x = M + i * (cw + 8); R(x, y - 62, cw, 62, hi ? Y : '#F4F4F2'); T(x + 12, y - 32, String(n), 22, true); T(x + 12, y - 50, l, 9, false, hi ? K : G); });
  y -= 78;
  if (D.byStaff.length) { h2('Added by'); table([['Staff', 300], ['Products', W - 2 * M - 300]], D.byStaff.map(([n, c]) => [n, String(c)])); }
  h2(D.old ? 'Products added that day' : 'Products added today');
  if (D.added.length) table([['#', 26], ['Product', 200], ['Part no.', 100, 1], ['Added by', 85], ['Time', 52], ['Photos', W - 2 * M - 463]],
    D.added.map((x, i) => [String(i + 1), x.name, x.pn || '-', x.by, x.t, x.ph ? { t: x.ph + ' photo' + (x.ph > 1 ? 's' : ''), bg: '#E8F6EC', fg: '#1B7A3A' } : { t: 'No photo', bg: '#FDECEC', fg: '#B42318' }]));
  else { need(30); R(M, y - 26, W - 2 * M, 26, SOFT); T(M + 10, y - 17, 'No products were added ' + (D.old ? 'that day.' : 'today.'), 10); y -= 36; }
  if (D.photoBy.length) { h2('Photos uploaded by'); table([['Staff', 300], ['Photos', W - 2 * M - 300]], D.photoBy.map(([n, c]) => [n, String(c)])); }
  if (D.noPhoto.length) { h2('Without a photo' + (D.noPhoto.length > 50 ? ' (first 50 of ' + D.noPhoto.length + ')' : '')); table([['Product', 360], ['Part no.', W - 2 * M - 360, 1]], D.noPhoto.slice(0, 50).map(p => [p.name, p.pn || '-'])); }
  pages.push(ops);
  // page numbers, then the file
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const kids = [];
  pages.forEach((p, i) => {
    p.push(`BT /F1 8 Tf ${rgb(G)} rg ${M} 24 Td ${pstr('Bike Pharma  ·  products report ' + D.date)} Tj ET`, `BT /F1 8 Tf ${rgb(G)} rg ${W - M - 50} 24 Td ${pstr('Page ' + (i + 1) + ' of ' + pages.length)} Tj ET`);
    const s = Buffer.from(p.join('\n'), 'latin1');
    objs.push(`<< /Length ${s.length} >>\nstream\n` + s.toString('latin1') + '\nendstream');
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objs.length} 0 R >>`);
    kids.push(objs.length + ' 0 R');
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const off = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
