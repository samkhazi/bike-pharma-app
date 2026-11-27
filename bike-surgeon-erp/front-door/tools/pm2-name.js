// Used by the update scripts: which pm2 app runs a folder.  npx pm2 jlist | node tools/pm2-name.js <folder> [pid on its port]
// Prints the pm2 name: the app whose folder is <folder>, else the app whose process is (a parent of) the pid.
'use strict';
const fs = require('node:fs');
const real = p => { try { return fs.realpathSync(p); } catch { return p; } };
const parent = p => { try { return Number(fs.readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' ')[1]); } catch { return 0; } };
let t = '';
process.stdin.on('data', c => { t += c; }).on('end', () => {
  let L = []; try { L = JSON.parse(t.slice(Math.max(0, t.search(/^\[(\{|\s*\])/m)))); } catch { /* no pm2 list */ }
  const dir = real(process.argv[2] || ''), want = new Set();
  for (let p = Number(process.argv[3] || 0), i = 0; p > 1 && i < 6; i++) { want.add(p); p = parent(p); }
  const x = L.find(a => a.pm2_env && a.pm2_env.pm_cwd && real(a.pm2_env.pm_cwd) === dir) || L.find(a => want.has(a.pid));
  console.log(x ? x.name : '');
});
