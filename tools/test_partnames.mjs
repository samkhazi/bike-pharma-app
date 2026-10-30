// 17f: Sam's part-names list (server only): garage / Hindi / other company's names find the part's names in one brand
import { partNames } from '../lib/partnames.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const f = partNames(new URL('../lib/names/part-names.json', import.meta.url).pathname);
ok(f('tanki dhakkan', 'Hero').names.Hero.includes('CAP COMP FUEL FILLER'), 'garage name -> Hero company name');
ok(f('टूल किट', 'Bajaj').groups.length === 1 && !f('टूल किट', 'Bajaj').names.Hero, 'Hindi name, only the asked brand');
ok(f('CAP TANK FUEL', 'Hero').groups[0] === 'Fuel Tank Cap', "another company's name finds the same part");
ok(!f('xyzzy', 'Any').groups.length, 'unknown word: nothing');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
