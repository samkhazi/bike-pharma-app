// lib/seed.json = the app's demo shop data exactly as the prototype keeps it after its own start-up fixes
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
await p.goto(process.env.SRC || 'http://localhost:8766/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof DB !== 'undefined' && DB && DB.seed10, null, { timeout: 15000 });
const j = await p.evaluate(() => { const d = JSON.parse(JSON.stringify(DB)); d.accounts = {}; return JSON.stringify(d); });
fs.writeFileSync(new URL('../lib/seed.json', import.meta.url), j);
console.log('seed.json', j.length, 'bytes, keys:', Object.keys(JSON.parse(j)).join(','));
await b.close();
