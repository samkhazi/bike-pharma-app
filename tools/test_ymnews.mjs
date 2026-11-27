// 24r: lib/ymnews.mjs reads kits from a Parts News page (word boxes as pdftotext -bbox gives them). usage: node tools/test_ymnews.mjs
import { parseNews, bboxPages, ymKey } from '../lib/ymnews.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const W = []; const w = (x, y, t) => W.push({ x0: x, y0: y, x1: x + t.length * 4.2, y1: y + 5, t });
// summary table (kit numbers only), then two kit tables side by side, two kits each, with Qty / Section columns
w(40, 100, 'Model'); w(120, 100, 'B9X3'); w(150, 100, 'BVB1');
w(130, 130, 'B97WF6619000'); w(330, 130, 'BK7WF6619000');
w(235, 160, 'Qty.'); w(250, 160, 'Section'); w(445, 160, 'Qty.'); w(460, 160, 'Section');
const L = (x, y, pn, q, kitpn) => { w(x + 40, y, pn); w(x + 120, y, 'NAME'); w(x + 200, y, String(q)); w(x + 213, y, '230'); if (kitpn) w(x - 40, y, kitpn); };
L(90, 170, '21CF34110000', 1); L(90, 178, '21CF34120000', 1); L(90, 186, '4LSF341E1000', 1, 'B97WF6619000'); L(90, 194, '5YYF34620000', 2);
L(90, 220, '1S4113111100', 1); L(90, 228, '904681206900', 2, 'B97WE6611200'); L(90, 236, 'B9XE16330000', 1);
L(300, 170, 'BK7F34110000', 1); L(300, 178, '21CF34120000', 1); L(300, 186, '2FBF38730000', 1, 'BK7WF6619000');
w(340, 220, 'BCWE131100'); w(345, 226, '00'); w(420, 220, 'CYLINDER'); w(500, 220, '1'); w(513, 220, '111'); L(300, 236, '934501611500', 2, 'BCFWE6610000');
w(40, 300, 'Component'); w(90, 300, 'parts'); w(120, 300, 'will'); w(140, 300, 'not'); w(155, 300, 'be'); w(165, 300, 'service.');
const known = new Set(['B97WF6619000', 'BK7WF6619000', 'B97WE6611200', 'BCFWE6610000', '21CF34110000', '21CF34120000', '4LSF341E1000', '5YYF34620000', '1S4113111100', '904681206900', 'B9XE16330000', 'BK7F34110000', '2FBF38730000', 'BCWE13110000', '934501611500']);
const r = parseNews([{ w: 612, h: 792, words: W }], k => known.has(k), k => /^[A-Z0-9]{3}W/.test(k));
const ks = r.kits, has = (k, ps) => JSON.stringify((ks[k] || []).map(p => p[0]).sort()) === JSON.stringify(ps.slice().sort());
ok(Object.keys(ks).length === 4, 'four kits: ' + Object.keys(ks).join(', '));
ok(has('B97WF6619000', ['21CF34110000', '21CF34120000', '4LSF341E1000', '5YYF34620000']), 'left race kit: its 4 parts, not the cylinder kit ones');
ok(has('B97WE6611200', ['1S4113111100', '904681206900', 'B9XE16330000']), 'left cylinder kit: the last row of the block stays with it');
ok(has('BK7WF6619000', ['BK7F34110000', '21CF34120000', '2FBF38730000']), 'right column goes to the right column kit (shared part in both)');
ok(has('BCFWE6610000', ['BCWE13110000', '934501611500']), 'a number wrapped onto the next line (BCWE131100 / 00) is joined');
ok((ks['B97WF6619000'] || []).find(p => p[0] === '5YYF34620000')[1] === '2', 'quantity read next to the section number');
ok(r.only === true, 'note "will not be service" seen');
ok(r.codes.includes('B9X3') && r.codes.includes('BVB1'), 'model codes named in the news');
ok(ymKey('B97-WF661-90') === 'B97WF6619000' && ymKey('BCWE131100') === 'BCWE13110000', 'Yamaha keys');
ok(bboxPages('<page width="612.0" height="792.0"><word xMin="1" yMin="2" xMax="3" yMax="4">A&amp;B</word></page>')[0].words[0].t === 'A&B', 'bbox html read');
ok(Object.keys(parseNews([{ w: 612, h: 792, words: [{ x0: 10, y0: 10, x1: 60, y1: 15, t: 'Subject' }] }], () => false, () => false).kits).length === 0, 'a news with no kit table gives no kits');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
