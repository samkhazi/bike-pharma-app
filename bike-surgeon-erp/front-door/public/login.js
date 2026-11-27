'use strict';
document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault();
  const go = document.getElementById('go'), out = document.getElementById('err');
  go.disabled = true; out.textContent = '';
  try {
    const r = await fetch('/__gate/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: document.getElementById('email').value, password: document.getElementById('password').value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Could not sign in.');
    location.href = '/';
  } catch (x) { out.textContent = x.message; go.disabled = false; }
});
