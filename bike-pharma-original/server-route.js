// Bike Pharma original, for reference: server.mjs (GitHub samkhazi/bike-pharma-app, branch website, commit 49c9099)
// Line 17 (import) and lines 317-327 (the /api/rclook route). It runs inside Bike Pharma's server and uses its helpers:
// drain(req), roleClass(user) (staff only), limited(key, max, ms) (40 searches per 10 min per staff), store.kvGet/kvSet (the 'rc' saved answers), json(res, code, obj).
// The demo server.mjs in this zip does the same job with no Bike Pharma parts.

import { rcLook, rcClean, rcIsReg } from './lib/rclook.mjs';
// ...
  if (p === '/api/rclook') {   // update 10d: registration number -> RC details from the paid RC API (staff only; the key stays here)
    drain(req);
    if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: user ? 'Staff login needed' : 'Please log in again' });
    if (limited('rc:' + user.id, 40, 10 * 60 * 1000)) return json(res, 429, { error: 'Too many registration searches, try again in a few minutes' });
    // Sam 2026-10-30: a number searched once is kept in our database for good; the same number again is read from there, not from VR Garage (saves credits)
    const reg = rcClean(url.searchParams.get('r')), sv = rcIsReg(reg) ? store.kvGet('rc', reg) : null;
    if (sv && sv.r) return json(res, 200, { ...sv.r, saved: sv.at });
    const rr = await rcLook(reg);
    if (rr && rr.found) store.kvSet('rc', reg, { at: new Date().toISOString(), by: user.id, r: rr });
    return json(res, 200, rr);
  }
