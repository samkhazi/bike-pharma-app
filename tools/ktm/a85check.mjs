import fs from 'node:fs'; import crypto from 'node:crypto';
const src = fs.readFileSync(process.argv[2], 'utf8'); const i = src.indexOf('function ascii85('); const j = src.indexOf('\nfunction drain(');
const ascii85 = new Function(src.slice(i, j) + '\nreturn ascii85;')();
const dg = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); const D = process.argv[4]; let n = 0, bad = 0;
for (const u of dg.f) { const [, p, off, len] = /^pa:(.+):(\d+):(\d+)$/.exec(u); const fd = fs.openSync(D + '/' + p.split('/').pop(), 'r'); const b = Buffer.alloc(+len); fs.readSync(fd, b, 0, +len, +off); fs.closeSync(fd);
  const img = ascii85(b); n++; if (!img || img[0] !== 0xFF || img[1] !== 0xD8 || img[img.length - 2] !== 0xFF || img[img.length - 1] !== 0xD9) bad++; }
console.log('decoded', n, 'bad', bad);
