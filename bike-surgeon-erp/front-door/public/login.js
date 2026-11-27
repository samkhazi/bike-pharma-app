'use strict';
// Sign-in page (Sam, 27 Nov 2026): the shop in 3D, like the old billing page but alive.
// The photo is cut into layers at different depths (login.html, data-z). A camera moves over them:
//   open:     the camera swings round from the side and settles in front of the shop (about 2.5 s);
//   waiting:  it keeps moving a little (slow drift, and with the mouse on a computer), so the shop reads as 3D;
//   signed in: a tick with the person's name, then the camera flies in through the gate and the panels open.
// Reduced motion (phone setting): no camera moves at all.
(() => {
  const W = 1440, H = 1080, F = { x: 702, y: 716 };   // photo size; the middle of the gate (the camera looks at it)
  const D = 950;                                       // camera distance in photo pixels: how strong the 3D is
  const $ = id => document.getElementById(id);
  const stage = $('stage'), world = $('world'), shade = $('shade'), side = document.querySelector('.side'), card = $('card');
  const layers = [...world.querySelectorAll('.L')].map(el => ({ el, z: Number(el.dataset.z) || 0, cls: el.classList[1] }));
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = { io: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, out: p => 1 - Math.pow(1 - p, 3) };
  const lerp = (a, b, p) => a + (b - a) * p;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // ---- where the shop sits on the screen, and how big ------------------------------------------------------------------
  let vw = 0, vh = 0, k = 1, Sx = 0, Sy = 0, tall = false;
  function size(force) {
    const w = document.documentElement.clientWidth, h = window.innerHeight;
    if (!force && w === vw && Math.abs(h - vh) < 180) return;   // a phone keyboard opening is not a new layout
    vw = w; vh = h;
    tall = vw / vh < 1.05 || vw < 760;
    if (tall) {
      // phone: the whole shop front across the top, the card below it
      const A = vh * 0.36;
      k = Math.min(vw / 1150, A / 600);
      Sx = vw / 2; Sy = A - 6 - (880 - F.y) * k;
    } else {
      // computer: the gate a little left of the middle, the card on the right; the photo always covers the screen
      Sx = vw * (vw >= 1200 ? 0.47 : 0.4); Sy = vh * 0.6;
      k = Math.max(Sx / F.x, (vw - Sx) / (W - F.x), Sy / F.y, (vh - Sy) / (H - F.y)) * 1.1;
    }
    stage.style.perspective = (D * k).toFixed(1) + 'px';
    // sky above the roof (the same colour as the photo's top row, so a phone never shows a line there when the photo moves down),
    // then smoothly white, so the photo's bottom edge fades into the white page and nothing hard shows while the camera moves
    const roof = Sy + (398 - F.y) * k, white = Sy + (990 - F.y) * k;
    stage.style.background = `linear-gradient(180deg,#99abc9 0px,#99abc9 ${Math.max(0, roof - 40).toFixed(0)}px,#c6d9ee ${roof.toFixed(0)}px,#ffffff ${white.toFixed(0)}px)`;
    for (const l of layers) {
      // every layer is made bigger by how far back it is, so from the starting point they line up as the one photo
      l.el.style.transformOrigin = `${F.x}px ${F.y}px`;
      l.el.style.transform = `translateZ(${l.z}px) scale(${((D - l.z) / D).toFixed(5)})`;
    }
    world.style.transformOrigin = `${F.x}px ${F.y}px 0`;
    // the soft light and the dark edges sit around the gate (set once: changing them while moving would repaint the screen)
    shade.style.setProperty('--gx', (Sx / vw * 100).toFixed(1) + '%');
    shade.style.setProperty('--gy', (Sy / vh * 100).toFixed(1) + '%');
  }

  // ---- the camera -------------------------------------------------------------------------------------------------------
  function put(c) {
    world.style.transform = `translate3d(${(c.x - F.x).toFixed(2)}px,${(c.y - F.y).toFixed(2)}px,${(c.z * k).toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) scale3d(${k},${k},${k})`;
    stage.style.perspectiveOrigin = `${c.x.toFixed(1)}px ${c.y.toFixed(1)}px`;
  }
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mouse.tx = clamp(e.clientX / vw * 2 - 1, -1, 1); mouse.ty = clamp(e.clientY / vh * 2 - 1, -1, 1);
  }, { passive: true });

  const INTRO = 2600;
  let t0 = 0, fly = null, raf = 0;
  function pose(now) {
    const t = (now - t0) / 1000;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    const drift = { ry: 1.4 * Math.sin(t * 0.42) + 2.6 * mouse.x, rx: 0.6 * Math.sin(t * 0.31 + 1) - 1.4 * mouse.y, z: 16 * Math.sin(t * 0.27), x: -10 * mouse.x * k };
    const p = clamp((now - t0) / INTRO), q = ease.io(p);
    // start: closer, from the left and a little high, then the camera settles in front of the shop
    return { x: Sx + drift.x * q + lerp(-0.05 * vw, 0, q), y: Sy, z: lerp(300, 0, q) + drift.z * q,
      ry: lerp(-9, 0, q) + drift.ry * q, rx: lerp(4, 0, q) + drift.rx * q };
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!fly) return put(pose(now));
    // signed in: fly in through the gate
    const u = clamp((now - fly.at) / fly.ms), a = ease.io(clamp(u / 0.6)), z = 1240 * Math.pow(u, 2.2);
    const s = fly.from;
    put({ x: lerp(s.x, vw / 2, a), y: lerp(s.y, tall ? vh * 0.42 : vh / 2, a), z: s.z * (1 - a) + z, ry: s.ry * (1 - a), rx: s.rx * (1 - a) });
    for (const l of layers) {
      const o = l.cls === 'yard' ? 1 - clamp((z - 100) / 260) : l.cls === 'front' ? 1 - clamp((z - 780) / 120)
        : l.cls === 'hall' ? 1 - clamp((z - 1150) / 90) : l.cls === 'sky' ? 1 - clamp((z - 500) / 300) : 1;
      l.el.style.opacity = o.toFixed(3);
    }
    side.style.opacity = (1 - clamp(u / 0.35)).toFixed(3);   // the white on the card's side goes with the card, so the gate is seen whole
    $('flash').style.opacity = (0.4 * Math.max(0, 1 - Math.abs(z - 880) / 160)).toFixed(3);
    $('fade').style.opacity = clamp((u - 0.8) / 0.2).toFixed(3);
    if (u >= 1 && !fly.gone) { fly.gone = true; location.href = '/'; }
  }

  // ---- start ------------------------------------------------------------------------------------------------------------
  size(true);
  window.addEventListener('resize', () => size(false));
  window.addEventListener('orientationchange', () => setTimeout(() => size(true), 250));
  const img = layers[0] && layers[0].el;
  const ready = img && img.decode ? Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 1800))]) : Promise.resolve();
  setTimeout(() => card.classList.add('in'), still ? 0 : 700);
  ready.then(() => {
    if (still) { put({ x: Sx, y: Sy, z: 0, rx: 0, ry: 0 }); return; }
    t0 = performance.now(); raf = requestAnimationFrame(frame);
  });
  if (!still) {
    // gold dust, like the old page (two golds, so it shows on the white and on the dark shop front)
    const box = $('dust');
    for (let i = 0; i < 22; i++) {
      const d = document.createElement('i'), sz = Math.random() < 0.25 ? 3 : Math.random() < 0.5 ? 2 : 1, deep = Math.random() > 0.5;
      Object.assign(d.style, { width: sz + 'px', height: sz + 'px', left: (Math.random() * 100).toFixed(1) + '%',
        background: deep ? `rgba(214,150,0,${(0.45 + Math.random() * 0.35).toFixed(2)})` : `rgba(248,192,24,${(0.55 + Math.random() * 0.35).toFixed(2)})`,
        boxShadow: `0 0 ${sz * 4}px rgba(248,192,24,.55)`, animationDuration: (12 + Math.random() * 18).toFixed(1) + 's',
        animationDelay: (-Math.random() * 28).toFixed(1) + 's' });
      box.appendChild(d);
    }
  }

  // ---- the form ---------------------------------------------------------------------------------------------------------
  const f = $('f'), go = $('go'), err = $('err'), pw = $('password'), eye = $('eye');
  let busy = false;
  eye.addEventListener('click', () => {
    const show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); pw.focus();
  });
  for (const i of f.querySelectorAll('input')) {
    i.addEventListener('focus', () => card.classList.add('lit'));
    i.addEventListener('blur', () => card.classList.remove('lit'));
  }
  function say(m) { err.textContent = m; card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
  const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const login = $('email').value.trim(), password = pw.value;
    if (!login || !password) return say('Type your mobile number (or email) and password.');
    busy = true; go.disabled = true; go.classList.add('wait'); err.textContent = '';
    try {
      const r = await fetch('/__gate/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login, password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not sign in.');
      const me = await within(fetch('/__gate/me').then(x => (x.ok ? x.json() : null)).catch(() => null), 1200);
      enter(me && me.name);
    } catch (x) {
      busy = false; go.disabled = false; go.classList.remove('wait');
      say(x.message || 'Could not sign in.'); pw.select();
    }
  });
  function enter(name) {
    $('hello').textContent = name ? `Welcome, ${name}` : 'Welcome';
    card.classList.add('ok');
    if (still || !raf) { setTimeout(() => { location.href = '/'; }, 700); return; }
    setTimeout(() => {
      card.classList.add('out');
      fly = { at: performance.now(), ms: 1700, from: pose(performance.now()) };
      setTimeout(() => { location.href = '/'; }, 2600);   // in case the screen stops drawing (tab in the background)
    }, 650);
  }
})();
