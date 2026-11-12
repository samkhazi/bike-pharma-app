// 20y: the Android app's link file. Chrome opens the Bike Pharma app (com.bikepharma.app) full screen only when
// https://bikepharma.com/.well-known/assetlinks.json lists the app's key fingerprint: plain JSON, no redirect, no login.
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let ok = true; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const r = await fetch(BASE + '/.well-known/assetlinks.json', { redirect: 'manual' });
const t = await r.text();
check(r.status === 200, 'status 200 (' + r.status + ')');
check(/^application\/json/.test(r.headers.get('content-type') || ''), 'served as JSON (' + r.headers.get('content-type') + ')');
let j = null; try { j = JSON.parse(t); } catch (e) { }
const st = Array.isArray(j) ? j.find(s => s && s.target && s.target.package_name === 'com.bikepharma.app') : null;
check(!!st, 'lists the app com.bikepharma.app');
check(!!st && st.target.namespace === 'android_app' && (st.relation || []).includes('delegate_permission/common.handle_all_urls'), 'right relation and namespace');
check(!!st && st.target.sha256_cert_fingerprints.length > 0 && st.target.sha256_cert_fingerprints.every(f => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)), 'key fingerprints look right');
const h = await fetch(BASE + '/.well-known/other.json'); check(h.status === 404, 'other .well-known files are not served (' + h.status + ')');
console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
