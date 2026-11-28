// Runs first in a panel opened inside the one screen (/p/<key>/): marks the page so inshell.css hides its own menu, and keeps
// its "/api/..." calls on this panel (the front door also checks the page they come from).
'use strict';
(() => {
  const m = location.pathname.match(/^\/p\/([a-z]+)\//); if (!m) return;
  const key = m[1], pre = '/p/' + key;
  if (window.top !== window) {
    document.documentElement.classList.add('in-shell', 'p-' + key);
    // 28 Nov (Sam: "overall white"): light inside the one screen, also on a phone or computer set to dark mode
    document.documentElement.setAttribute('data-theme', 'light');
  }
  const fix = u => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/p/') && !u.startsWith('/__gate/') ? pre + u : u;
  const f0 = window.fetch.bind(window);
  // the front door's own sign-in ran out: the whole screen goes to sign in (not this panel's phone + PIN page)
  const gone = r => { if (r.status === 401 && window.top !== window) f0('/__gate/me', { cache: 'no-store' }).then(x => { if (x.status === 401) window.top.location.href = '/__gate/login'; }, () => {}); return r; };
  window.fetch = (input, init) => (typeof input === 'string' ? f0(fix(input), init) : f0(input, init)).then(gone);
  const open0 = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { return open0.call(this, method, fix(url), ...rest); };

  // 28 Nov (Sam: "data load hone me bahut time, fetch lag"): the one screen keeps every panel of a login open (11 for the
  // owner), and each panel asked the server every 3-4 seconds and loaded its data again after every change in the billing,
  // also while it was not on screen: many times the work for the server and the phone. Now a panel that is not on screen
  // rests: its quick timers (under 30 s) run once in 30 s; the moment it comes on screen they run at once, then as before.
  // Slow timers (a 2-minute reminder) and everything else work as before.
  let fr = null; try { fr = window.top !== window ? window.frameElement : null; } catch { fr = null; }
  if (!fr || !fr.parentElement || fr.parentElement.id !== 'frames') return;   // only inside the one screen
  const onScreen = () => fr.classList.contains('show');
  const SI = window.setInterval, CI = window.clearInterval, CT = window.clearTimeout, QUICK = 30000, REST = 30000, timers = new Map();
  const run = t => { t.last = Date.now(); t.fn.apply(window, t.args); };
  window.setInterval = function (fn, ms, ...args) {
    if (typeof fn !== 'function' || !(Number(ms) < QUICK)) return SI.call(window, fn, ms, ...args);
    const t = { fn, args, last: 0 };
    const id = SI.call(window, () => { if (onScreen() || Date.now() - t.last >= REST) run(t); }, ms);
    timers.set(id, t);
    return id;
  };
  window.clearInterval = function (id) { timers.delete(id); return CI.call(window, id); };
  window.clearTimeout = function (id) { timers.delete(id); return CT.call(window, id); };
  let was = onScreen();
  try {
    new MutationObserver(() => {
      const now = onScreen();
      if (now && !was) for (const [id, t] of timers) if (Date.now() - t.last > 1000) setTimeout(() => { if (timers.get(id) === t) run(t); }, 0);
      was = now;
    }).observe(fr, { attributes: true, attributeFilter: ['class'] });
  } catch { /* without it the panel still catches up at its next turn (3-4 s) */ }
})();
