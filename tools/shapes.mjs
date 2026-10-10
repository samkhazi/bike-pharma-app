import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({viewport:{width:1200,height:900}});
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://localhost:8766/app.html', {waitUntil:'load'}); await p.waitForTimeout(1500);
const seed = await p.evaluate(() => JSON.stringify(seed()));
fs.writeFileSync('../lib/seed.json', seed);
const info = await p.evaluate(() => {
  const out = {}; const d = JSON.parse(JSON.stringify(DB));
  const desc = v => { if (Array.isArray(v)) { const f = v[0]; return {t:'arr', n:v.length, el: f && typeof f==='object' ? Object.keys(f).slice(0,14) : typeof f}; }
    if (v && typeof v==='object') { const ks=Object.keys(v); const f=v[ks[0]]; return {t:'obj', n:ks.length, keys:ks.slice(0,6), val: f && typeof f==='object' ? (Array.isArray(f)?'arr['+f.length+']:'+(f[0]&&typeof f[0]==='object'?Object.keys(f[0]).slice(0,8).join(','):typeof f[0]):'obj:'+Object.keys(f).slice(0,8).join(',')) : typeof f}; }
    return {t:typeof v, v: String(v).slice(0,40)}; };
  for (const k of Object.keys(d)) out[k] = desc(d[k]);
  // also non-enumerable (CU_KEYS getters)
  out.__cu_keys = CU_KEYS; out.__demo = DEMO_CUST; out.__label=LABEL; out.__accounts=Object.keys(ACCOUNTS);
  return out; });
console.log(JSON.stringify(info, null, 0).replace(/\},"/g, '},\n"'));
console.log('seed bytes', seed.length);
await b.close();
