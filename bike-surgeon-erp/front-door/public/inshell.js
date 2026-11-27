// Runs first in a panel opened inside the one screen (/p/<key>/): marks the page so inshell.css hides its own menu, and keeps
// its "/api/..." calls on this panel (the front door also checks the page they come from).
'use strict';
(() => {
  const m = location.pathname.match(/^\/p\/([a-z]+)\//); if (!m) return;
  const key = m[1], pre = '/p/' + key;
  if (window.top !== window) document.documentElement.classList.add('in-shell');
  const fix = u => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/p/') && !u.startsWith('/__gate/') ? pre + u : u;
  const f0 = window.fetch.bind(window);
  // the front door's own sign-in ran out: the whole screen goes to sign in (not this panel's phone + PIN page)
  const gone = r => { if (r.status === 401 && window.top !== window) f0('/__gate/me', { cache: 'no-store' }).then(x => { if (x.status === 401) window.top.location.href = '/__gate/login'; }, () => {}); return r; };
  window.fetch = (input, init) => (typeof input === 'string' ? f0(fix(input), init) : f0(input, init)).then(gone);
  const open0 = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { return open0.call(this, method, fix(url), ...rest); };
})();
