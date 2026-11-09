"""KTM + Husqvarna (India, Bajaj-made): Bajaj's KTM Spare Parts Finder, https://ktmspcatalog.bajajauto.com (dealer login).

Login: KTM_USER / KTM_PASS from .env (Sam's own dealer login). If the login page shows a captcha or OTP the tool stops and says so;
  it never solves one. The browser profile is kept in data/ktm/browser, so while the portal keeps the login alive no new login is needed.
  A wrong password is never retried (no account lock): the run stops with exit message "KTM login failed".
Data (weekly, read only, ~1 request per second, the same pages a dealer opens by hand):
  /index                      menu: every model and model year (search/<model id>/<year id>/1)
  /search/<m>/<y>/1 and /2    the plates (diagrams) of one model year
  /result/...                 one plate: diagram picture (/plates/India/..., saved byte for byte) + Ref | Part No | Description | Qty | Remarks
  /partmaster, /kitmaster, /altmaster, /partcategory: their DOWNLOAD links (get_partmaster, get_partmaster_plate, get_kitmaster, ...)
  /downloadall                the portal's full PDF per model year (printFullPdf): downloaded once for every NEW model year
  /circular                   circular list (new ones reported, attached files saved)
Weekly work: menu + the download lists every week; plates of a model year are read again when the model year is new, when the
  plate-wise part master shows a change for it, or in turn (KTM_RECHECK editions a week, oldest first), so every plate is re-read now and then.
No MRP: the portal's Dealer Price column is empty (checked Oct 2026). KTM MRP comes from the dealer DMS list (ktm_mrp.json on the website).
Nothing is ever ordered: no cart, wishlist, order or remark button is touched.
Website: data/ktm/editions.json (every model year read, with plates, rows and diagram files) feeds lib/ktmbuild.mjs (Find Part).
"""
import os, re, io, csv, json, hashlib, logging, datetime
from common import env, data_dir, load_json, save_json, today, Report

log = logging.getLogger('brand_sync.ktm')
BASE = env('KTM_BASE', 'https://ktmspcatalog.bajajauto.com').rstrip('/')

JS = r"""
window.kDelay = %DELAY%;
window.kSleep = ms => new Promise(r => setTimeout(r, ms));
window.kTxt = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim();
window.kAbs = h => new URL(h, location.origin).href;
window.kGet = async u => {
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch(kAbs(u), {credentials: 'include'});
      await kSleep(kDelay);
      if (r.status === 403) throw 'HTTP 403';
      if (!r.ok) throw 'HTTP ' + r.status;
      const t = await r.text();
      const d = new DOMParser().parseFromString(t, 'text/html');
      if (d.querySelector('input[type=password]') && !d.querySelector('a[href*="logout" i]')) throw 'logged out';
      return d;
    } catch (e) { if (k === 2 || /logged out|403/.test(String(e))) throw String(e); await kSleep(5000); }
  }
};
window.kMenu = async () => {
  const d = await kGet('/index'), menu = [];
  for (const a of d.querySelectorAll('a[href*="/search/"]')) {
    const m = /\/search\/(\d+)\/(\d+)\/(\d+)/.exec(a.getAttribute('href') || ''); if (!m) continue;
    let model = '', el = a;
    for (let i = 0; i < 6 && el && !model; i++) {
      el = el.parentElement; if (!el) break;
      for (const c of el.children) {
        if (c.contains(a) || c.querySelector('a[href*="/search/"]')) continue;
        const t = kTxt(c);
        if (t && t.length < 60 && !/^MY-?\s*\d+/i.test(t)) { model = t; break; }
      }
    }
    menu.push({m: +m[1], y: +m[2], my: kTxt(a), model});
  }
  const links = [...d.querySelectorAll('a[href]')].map(a => [kTxt(a), kAbs(a.getAttribute('href'))]);
  return {menu, links};
};
window.kLinks = async u => { const d = await kGet(u);
  return [...d.querySelectorAll('a[href]')].map(a => [kTxt(a) || kTxt(a.closest('tr')), kAbs(a.getAttribute('href')), kTxt(a.closest('tr'))]); };
window.kPlates = async (m, y) => {
  const out = [], seen = new Set();
  for (const flag of [1, 2]) {
    let d; try { d = await kGet(`/search/${m}/${y}/${flag}`); } catch (e) { if (flag === 2) break; throw e; }
    for (const a of d.querySelectorAll('a[href*="/result/"]')) {
      const href = kAbs(a.getAttribute('href')); if (seen.has(href)) continue; seen.add(href);
      let kind = '';
      for (let e = a; e && !kind; e = e.parentElement) { const s = (e.id || '') + ' ' + (typeof e.className === 'string' ? e.className : '');
        if (/engine/i.test(s)) kind = 'Engine'; else if (/frame|chassis/i.test(s)) kind = 'Frame'; }
      const row = kTxt(a.closest('tr')) || kTxt(a.parentElement);
      if (!kind) { const k = /\b(ENGINE|FRAME)\b/i.exec(row + ' ' + kTxt(a)); if (k) kind = k[1][0].toUpperCase() + k[1].slice(1).toLowerCase(); }
      out.push({href, text: kTxt(a), row, kind, flag});
    }
  }
  return out;
};
window.kPlate = async u => {
  const d = await kGet(u);
  let best = null;
  for (const t of d.querySelectorAll('table')) {
    const head = [...(t.querySelector('thead tr') || t.querySelector('tr') || {children: []}).children].map(kTxt);
    if (head.some(h => /part/i.test(h)) && (!best || t.querySelectorAll('tr').length > best[1].length)) best = [head, [...t.querySelectorAll('tbody tr')]];
  }
  const rows = best ? best[1].map(r => [...r.children].map(kTxt)).filter(r => r.some(Boolean)) : [];
  const imgs = [...d.querySelectorAll('img')].map(i => i.getAttribute('src') || i.getAttribute('data-src') || '').filter(s => /plates?\//i.test(s)).map(kAbs);
  const title = [...d.querySelectorAll('h1,h2,h3,h4,h5,.breadcrumb')].map(kTxt).filter(t => t && !/SPARE PARTS FINDER|Part Updations/i.test(t)).slice(0, 4);
  return {head: best ? best[0] : [], rows, imgs: [...new Set(imgs)], title};
};
0;
"""

PN_RE = re.compile(r'^[0-9A-Z]{6,12}$')


def norm(s): return re.sub(r'[^A-Z0-9]', '', str(s or '').upper())
def safe(s): return re.sub(r'\s+', ' ', re.sub(r'[\\/:*?"<>|\x00-\x1f]+', '-', str(s or ''))).strip().rstrip('.')[:120]


def col(head, *pats, skip=()):
    for i, h in enumerate(head):
        h2 = h.lower()
        if any(re.search(p, h2) for p in pats) and not any(re.search(s, h2) for s in skip):
            return i
    return None


def table_rows(blob, name=''):
    """a downloaded master file (xlsx, xls, csv or an html table) -> list of rows (lists of strings)"""
    name = name.lower()
    if blob[:2] == b'PK':
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(blob), read_only=True, data_only=True)
        out = []
        for ws in wb.worksheets:
            out += [['' if v is None else (str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)).strip() for v in r] for r in ws.iter_rows(values_only=True)]
        return out
    if blob[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1':
        import xlrd
        wb = xlrd.open_workbook(file_contents=blob)
        return [[str(c.value).strip() for c in sh.row(i)] for sh in wb.sheets() for i in range(sh.nrows)]
    text = blob.decode('utf-8-sig', 'replace')
    if re.search(r'<t[dh][\s>]', text, re.I):
        from html.parser import HTMLParser
        rows = []
        class P(HTMLParser):
            cell = None
            def handle_starttag(self, t, a):
                if t == 'tr': rows.append([])
                elif t in ('td', 'th'): self.cell = []
            def handle_endtag(self, t):
                if t in ('td', 'th') and self.cell is not None and rows:
                    rows[-1].append(re.sub(r'\s+', ' ', ''.join(self.cell)).strip()); self.cell = None
            def handle_data(self, d):
                if self.cell is not None: self.cell.append(d)
        P().feed(text)
        return [r for r in rows if r]
    return [[c.strip() for c in r] for r in csv.reader(io.StringIO(text))]


def with_header(rows):
    """-> (header, data rows): the header is the first row that names a part number column"""
    for i, r in enumerate(rows[:30]):
        if any(re.search(r'part\s*(no|num|#|code)|kit\s*(no|num)', c, re.I) for c in r):
            return [c.strip() for c in r], [x for x in rows[i + 1:] if any(x)]
    return [], rows


class KTM:
    name = 'KTM'
    pdfs = False                 # the portal has its own full PDF per model year: saved as it is, nothing is drawn
    price_label = 'KTM portal me MRP nahi hota'

    def __init__(self):
        self.dir = data_dir('ktm')
        self.ed_dir = data_dir('ktm', 'editions')
        self.img_dir = data_dir('ktm', 'img')
        self.state_path = os.path.join(self.dir, 'state.json')
        self.state = load_json(self.state_path, {'editions': {}, 'masters': {}, 'circulars': {}, 'pdfs': {}})
        self.delay = float(env('KTM_DELAY', '1.0'))

    # ---------- login ----------
    def shot(self, page, name):
        p = os.path.join(data_dir('logs'), f'ktm_{name}_{today()}.png')
        try: page.screenshot(path=p, full_page=True)
        except Exception: pass
        return p

    def logged_in(self, page):
        try:
            page.evaluate(JS.replace('%DELAY%', str(int(self.delay * 1000))))
            page.evaluate("() => kGet('/partmaster')")
            return True
        except Exception as e:
            if '403' in str(e):
                raise SystemExit(f'KTM: portal ne is server ko 403 diya (Azure gateway). Server ka IP portal pe allowed nahi hai; '
                                 f'Bajaj/KTM se server IP allow karwana hoga. ({self.shot(page, "403")})')
            return False

    def login(self, page):
        r = page.goto(BASE + '/index', wait_until='load')
        if r is not None and r.status == 403:
            raise SystemExit(f'KTM: portal ne is server ko 403 diya (Azure gateway). Server ka IP portal pe allowed nahi hai. ({self.shot(page, "403")})')
        if page.url.startswith(BASE) and self.logged_in(page):
            log.info('KTM: still logged in (saved browser profile)'); return
        pw = page.locator('input[type=password]:visible')
        if not pw.count():
            page.goto(BASE + '/', wait_until='load')
            pw = page.locator('input[type=password]:visible')
        if not pw.count():
            raise SystemExit(f'KTM: login page nahi pehchana ({page.url}, {self.shot(page, "login_unknown")})')
        if page.locator('img[src*="captcha" i], input[name*="captcha" i], .g-recaptcha, iframe[src*="recaptcha"], input[name*="otp" i]').count():
            raise SystemExit(f'KTM: login page pe captcha/OTP hai. Tool captcha khud nahi bharta; sync nahi chala. ({self.shot(page, "captcha")})')
        user, pwd = env('KTM_USER', required=True), env('KTM_PASS', required=True)
        form = pw.first.locator('xpath=ancestor::form[1]')
        scope = form if form.count() else page
        scope.locator('input:visible:not([type=password]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])').first.fill(user)
        pw.first.fill(pwd)
        btn = scope.locator('button[type=submit]:visible, input[type=submit]:visible, button:visible').first
        if btn.count(): btn.click()
        else: pw.first.press('Enter')
        page.wait_for_load_state('load'); page.wait_for_timeout(3000)
        if not self.logged_in(page):
            msg = ''
            try: msg = ' '.join(t.strip() for t in page.locator('.alert:visible, .text-danger:visible, .invalid-feedback:visible').all_inner_texts())[:200]
            except Exception: pass
            # never retried: a wrong password tried again and again can lock the dealer ID
            raise SystemExit(f'KTM login failed: {msg or "portal ne login nahi liya"}. KTM_USER / KTM_PASS check karo. ({self.shot(page, "login_failed")})')
        log.info('KTM login ok')

    # ---------- helpers ----------
    def get_file(self, page, url):
        r = page.request.get(url, timeout=600000)
        page.wait_for_timeout(int(self.delay * 1000))
        if r.status == 403:
            raise SystemExit('KTM: portal ne 403 diya (Azure gateway)')
        if not r.ok:
            raise RuntimeError(f'HTTP {r.status} {url}')
        cd = r.headers.get('content-disposition', '')
        m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', cd)
        return r.body(), (m.group(1) if m else url.rstrip('/').split('/')[-1]), r.headers.get('content-type', '')

    def save_img(self, page, url):
        ext = (os.path.splitext(url.split('?')[0])[1].lower() or '.jpg')[:5]
        f = hashlib.sha1(url.encode()).hexdigest()[:16] + ext
        p = os.path.join(self.img_dir, f)
        if not os.path.exists(p) or os.path.getsize(p) == 0:
            try:
                b, _, ct = self.get_file(page, url)
                if b and not ct.startswith('text/'):
                    open(p + '.tmp', 'wb').write(b); os.replace(p + '.tmp', p)
            except RuntimeError as e:
                log.warning('KTM diagram %s: %s', url, e); return ''
        return f if os.path.exists(p) else ''

    # ---------- one model year ----------
    def read_edition(self, page, key, e):
        plates = page.evaluate('([m, y]) => kPlates(m, y)', [e['m'], e['y']])
        out, kinds = [], {}
        for pl in plates:
            d = page.evaluate('u => kPlate(u)', pl['href'])
            head = d['head']
            ci = {'ref': col(head, r'^ref', r'^sr', r'^s\.?\s*no', r'^no\.?$', r'^#$'), 'pn': col(head, r'part\s*(no|num|#|code)', skip=(r'old', r'alt')),
                  'desc': col(head, r'desc', r'name'), 'qty': col(head, r'qty', r'quan'), 'rem': col(head, r'remark')}
            rows = []
            for r in d['rows']:
                g = lambda k: (r[ci[k]] if ci[k] is not None and ci[k] < len(r) else '').strip()
                pn = norm(g('pn')) if PN_RE.match(norm(g('pn'))) else g('pn').upper()
                if not pn and not g('desc'): continue
                rows.append([g('ref'), pn, g('desc'), g('qty'), g('rem')])
            if ci['pn'] is None or (d['rows'] and not rows):
                p = os.path.join(data_dir('logs'), f'ktm_plate_unread_{today()}.json')
                save_json(p, {'url': pl['href'], 'head': head, 'rows': d['rows'][:5]})
                log.warning('KTM: plate table not understood (%s), sample in %s', pl['href'], p)
            kind = pl['kind'] or ('Engine' if re.search(r'\bENGINE\b', ' '.join(d['title']), re.I) else 'Frame' if re.search(r'\bFRAME\b', ' '.join(d['title']), re.I) else 'Plate')
            kinds[kind] = kinds.get(kind, 0) + 1
            num = re.match(r'^\s*(\d+)\b', pl['text'])
            name = re.sub(r'^\s*\d+\s*[-.)]?\s*', '', pl['text']).strip() or (d['title'][-1] if d['title'] else '')
            name = re.sub(r'^(ENGINE|FRAME)\s+', '', name, flags=re.I)
            img = self.save_img(page, d['imgs'][0]) if d['imgs'] else ''
            out.append({'kind': kind, 'n': int(num.group(1)) if num else kinds[kind], 'name': name, 'url': pl['href'], 'img': img, 'rows': rows})
        return out

    # ---------- sync ----------
    def run(self, full=False, report=None):
        rep = report or Report(self.name)
        st = self.state
        first = not st['editions']
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(data_dir('ktm', 'browser'), args=['--disable-dev-shm-usage'],
                                                       headless=env('KTM_HEADFUL', '') == '', viewport={'width': 1400, 'height': 900},
                                                       **({'executable_path': env('KTM_CHROME')} if env('KTM_CHROME') else {}))
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.set_default_timeout(300000)
            try:
                self.login(page)
                menu = page.evaluate('() => kMenu()')
                eds = {}
                for x in menu['menu']:
                    k = f"{x['m']}_{x['y']}"
                    if k not in eds or (not eds[k]['model'] and x['model']):
                        eds[k] = {'m': x['m'], 'y': x['y'], 'my': x['my'], 'model': x['model']}
                if len(eds) < 0.8 * len(st['editions']) or not eds:
                    raise RuntimeError(f'KTM menu me sirf {len(eds)} model-years aaye (pichli baar {len(st["editions"])}): kuch nahi badla')
                log.info('KTM: %d model-years in the menu', len(eds))
                changed_eds = self.masters(page, rep, menu['links'], eds, first)
                self.circulars(page, rep, first)
                # which model years to read now
                todo = []
                for k, e in eds.items():
                    old = st['editions'].get(k)
                    if not old:
                        todo.append((k, 'new'))
                        if not first: rep.add('Naya model-year', f"{e['model']} {e['my']}")
                    elif full or k in changed_eds:
                        todo.append((k, 'changed'))
                for k in sorted(set(st['editions']) - set(eds)):
                    o = st['editions'][k]; rep.add('Menu se hata', f"{o.get('model')} {o.get('my')} (data rakha hai)")
                have = {k for k, _ in todo}
                turn = sorted((v.get('read', ''), k) for k, v in st['editions'].items() if k in eds and k not in have)
                todo += [(k, 'turn') for _, k in turn[:int(env('KTM_RECHECK', '8'))]]
                log.info('KTM: reading %d model-years (%s)', len(todo), ', '.join(f'{k}:{w}' for k, w in todo[:40]))
                for i, (k, why) in enumerate(todo):
                    e = eds[k]
                    plates = self.read_edition(page, k, e)
                    if not plates and st['editions'].get(k, {}).get('plates'):
                        log.warning('KTM %s %s: no plates this time, old data kept', e['model'], e['my']); continue
                    self.diff_edition(rep, k, e, plates, first or why == 'new')
                    save_json(os.path.join(self.ed_dir, k + '.json'), {**e, 'read': today(), 'plates': plates})
                    st['editions'][k] = {**e, 'read': today(), 'plates': len(plates), 'parts': sum(len(p['rows']) for p in plates)}
                    save_json(self.state_path, st)
                    log.info('KTM %d/%d %s %s: %d plates', i + 1, len(todo), e['model'], e['my'], len(plates))
                for k, e in eds.items():                      # menu names can change; keep the newest
                    st['editions'].setdefault(k, {}).update({x: e[x] for x in ('model', 'my') if e[x]})
                self.pdfs_new(page, rep, eds, first)
            finally:
                ctx.close()
        st['last_run'] = today()
        save_json(self.state_path, st)
        self.write_files(rep, first)
        return rep, []

    def diff_edition(self, rep, k, e, plates, quiet):
        if quiet: return
        old = load_json(os.path.join(self.ed_dir, k + '.json'), {}).get('plates') or []
        lines = lambda P: {(p['kind'], p['name'], r[1]): r for p in P for r in p['rows'] if r[1]}
        a, b = lines(old), lines(plates)
        label = f"{e['model']} {e['my']}"
        for x in sorted(set(b) - set(a))[:200]:
            rep.add('Naya part (model-year me)', f"{label}, {x[0]} {x[1]}: {x[2]} {b[x][2]}")
        for x in sorted(set(a) - set(b))[:200]:
            rep.add('Part hata (model-year se)', f"{label}, {x[0]} {x[1]}: {x[2]} {a[x][2]}")
        on = {(p['kind'], p['name']) for p in old}
        for p in plates:
            if (p['kind'], p['name']) not in on:
                rep.add('Naya diagram', f"{label}, {p['kind']} {p['n']} {p['name']}")

    def masters(self, page, rep, menu_links, eds, first):
        """part master / plate-wise part master / kit master / alternate master / part category: their download files, compared to last week"""
        links = {}
        for path in ('/partmaster', '/kitmaster', '/altmaster', '/partcategory'):
            try:
                for t, h, _ in page.evaluate('u => kLinks(u)', path):
                    if re.search(r'/get_|download|export', h, re.I) and h.startswith(BASE) and not re.search(r'downloadall|printFullPdf', h, re.I):
                        links[h] = t
            except Exception as ex:
                log.warning('KTM %s: %s', path, ex)
        for t, h in menu_links:
            if re.search(r'/get_', h) and h.startswith(BASE): links.setdefault(h, t)
        changed = set()
        mdir = data_dir('ktm', 'masters')
        for h, t in sorted(links.items()):
            key = h.rstrip('/').split('/')[-1]
            try:
                blob, fname, ct = self.get_file(page, h)
            except Exception as ex:
                log.warning('KTM download %s: %s', h, ex); continue
            if ct.startswith('text/html') and b'type="password"' in blob[:20000]:
                raise RuntimeError('KTM login beech me khatam ho gaya')
            md5 = hashlib.md5(blob).hexdigest()
            old = self.state['masters'].get(key, {})
            ext = os.path.splitext(fname)[1] or '.bin'
            try:
                rows = table_rows(blob, fname)
            except Exception as ex:
                log.warning('KTM %s not readable: %s', fname, ex); rows = []
            head, data = with_header(rows)
            cur = os.path.join(mdir, key + ext)
            if old.get('md5') != md5:
                prev = old.get('file') and os.path.join(mdir, old['file'])
                prev_rows = []
                if prev and os.path.exists(prev):
                    try: prev_rows = with_header(table_rows(open(prev, 'rb').read(), prev))[1]
                    except Exception: pass
                if prev and os.path.exists(prev):
                    os.replace(prev, os.path.join(mdir, f'{key}_{old.get("date", "old")}{os.path.splitext(prev)[1]}'))
                open(cur, 'wb').write(blob)
                self.state['masters'][key] = {'md5': md5, 'file': os.path.basename(cur), 'date': today(), 'title': t, 'rows': len(data), 'head': head}
                if old and not first:
                    changed |= self.diff_master(rep, key, t, head, prev_rows, data, eds)
            log.info('KTM %s (%s): %d rows', key, t, len(data))
        return changed

    def diff_master(self, rep, key, title, head, a, b, eds):
        sr = col(head, r'^sr', r's\.?\s*no')
        strip = lambda r: tuple(c for i, c in enumerate(r) if i != sr)
        A, B = {strip(r) for r in a}, {strip(r) for r in b}
        h2 = [h for i, h in enumerate(head) if i != sr]
        pn = col(h2, r'part\s*(no|num|code)|kit\s*(no|num)', skip=(r'old', r'alt', r'new'))
        sec = 'Badlav: ' + (title or key)
        if pn is not None:
            pa, pb = {r[pn] for r in A if pn < len(r)}, {r[pn] for r in B if pn < len(r)}
            for x in sorted(pb - pa)[:300]: rep.add(sec + ' (naya number)', x + '  ' + ' | '.join(c for c in next(r for r in B if len(r) > pn and r[pn] == x) if c != x)[:160])
            for x in sorted(pa - pb)[:300]: rep.add(sec + ' (number hata)', x)
        else:
            for r in sorted(B - A)[:300]: rep.add(sec + ' (nayi line)', ' | '.join(r)[:200])
        # plate-wise part master: the model years whose lines changed are read again
        out = set()
        mi, yi = col(h2, r'model', skip=(r'year', r'my\b')), col(h2, r'^my\b', r'model\s*year', r'year')
        if mi is not None and yi is not None:
            by = {(norm(e['model']), norm(e['my'])): k for k, e in eds.items()}
            for r in A ^ B:
                if max(mi, yi) < len(r):
                    k = by.get((norm(r[mi]), norm(r[yi])))
                    if k: out.add(k)
        return out

    def circulars(self, page, rep, first):
        try:
            links = page.evaluate("u => kLinks(u)", '/circular')
        except Exception as ex:
            log.warning('KTM circulars: %s', ex); return
        cdir = data_dir('ktm', 'circulars')
        for t, h, row in links:
            if not h.startswith(BASE) or not re.search(r'\.(pdf|xlsx?|docx?|jpe?g|png)(\?|$)|circular.*/\d+|download', h, re.I):
                continue
            if h in self.state['circulars']: continue
            try:
                blob, fname, ct = self.get_file(page, h)
            except Exception as ex:
                log.warning('KTM circular %s: %s', h, ex); continue
            if ct.startswith('text/html'): continue
            f = safe(os.path.splitext(fname)[0]) + '_' + hashlib.md5(blob).hexdigest()[:6] + (os.path.splitext(fname)[1] or '.pdf')
            open(os.path.join(cdir, f), 'wb').write(blob)
            self.state['circulars'][h] = {'file': f, 'text': (row or t)[:300], 'date': today()}
            if not first: rep.add('Naya circular', f'{(row or t)[:160]} -> ktm/circulars/{f}')

    def pdfs_new(self, page, rep, eds, first):
        """the portal's own full PDF of a model year, for model years that are new since the first run (the first run's 97 Sam has)"""
        if first and env('KTM_ALL_PDFS', '') != '1':
            for k in eds: self.state['pdfs'].setdefault(k, 'had')
            return
        try:
            links = page.evaluate("u => kLinks(u)", '/downloadall')
        except Exception as ex:
            log.warning('KTM downloads page: %s', ex); return
        for t, h, row in links:
            m = re.search(r'printFullPdf/(\d+)/(\d+)/', h)
            if not m: continue
            k = f'{m.group(1)}_{m.group(2)}'
            if k in self.state['pdfs'] or k not in eds: continue
            e = eds[k]
            try:
                blob, fname, ct = self.get_file(page, h)
            except Exception as ex:
                log.warning('KTM PDF %s: %s', h, ex); continue
            if not blob.startswith(b'%PDF'):
                log.warning('KTM PDF %s: not a PDF (%s)', h, ct); continue
            d = data_dir('output', 'KTM', 'PDF', safe(e['model'] or k))
            f = os.path.join(d, f"{safe(e['model'] or k)} {safe(e['my'])}.pdf")
            open(f + '.tmp', 'wb').write(blob); os.replace(f + '.tmp', f)
            self.state['pdfs'][k] = today()
            rep.add('Nayi PDF (portal ki apni)', f"output/KTM/PDF/{os.path.basename(d)}/{os.path.basename(f)}")

    # ---------- files ----------
    def write_files(self, rep, first):
        """editions.json for the website (lib/ktmbuild.mjs) and Excel KTM_Portal_Parts.xlsx (every line, A-Z sheet)"""
        eds = {}
        for k in sorted(self.state['editions']):
            d = load_json(os.path.join(self.ed_dir, k + '.json'), None)
            if d and d.get('plates'):
                eds[k] = {'model': d['model'], 'my': d['my'], 'read': d.get('read'),
                          'plates': [[p['kind'], p['n'], p['name'], p['img'], p['rows']] for p in d['plates']]}
        save_json(os.path.join(self.dir, 'editions.json'), {'date': today(), 'source': BASE, 'editions': eds})
        try:
            import openpyxl
            wb = openpyxl.Workbook(write_only=True)
            ws = wb.create_sheet('All lines')
            ws.append(['Model', 'Model year', 'Engine/Frame', 'Plate no', 'Plate', 'Ref', 'Part No', 'Description', 'Qty', 'Remarks'])
            az = {}
            for e in eds.values():
                for kind, n, name, _, rows in e['plates']:
                    for ref, pn, desc, qty, rem in rows:
                        ws.append([e['model'], e['my'], kind, n, name, ref, pn, desc, qty, rem])
                        if pn: az.setdefault(pn, [desc, set()])[1].add(f"{e['model']} {e['my']}")
            ws2 = wb.create_sheet('Part numbers A-Z')
            ws2.append(['Part No', 'Description', 'Model years'])
            for pn in sorted(az):
                ws2.append([pn, az[pn][0], ', '.join(sorted(az[pn][1]))[:3000]])
            out = data_dir('output', 'KTM')
            p = os.path.join(out, 'KTM_Portal_Parts.xlsx')
            wb.save(p + '.tmp'); os.replace(p + '.tmp', p)
            n = sum(len(r) for e in eds.values() for *_, r in e['plates'])
            if first: rep.add('Pehli baar poora data', f'{len(eds)} model-years, {n} lines, {len(az)} part numbers (aage se sirf badlav report hoga)')
            log.info('KTM: Excel %d lines, %d part numbers', n, len(az))
        except Exception as ex:
            log.warning('KTM Excel: %s', ex)
