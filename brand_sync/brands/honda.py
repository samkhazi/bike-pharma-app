"""Honda dealer e-catalogue (honda2wheelerparts.com).

Login: HONDA_USER, HONDA_PASS from .env, plus the verification code (captcha) shown on the Honda login page.
  The code is never read or solved by this tool: the server takes a picture of the code image exactly as the
  login page shows it and puts it on a small page on this server (http://<server>:HONDA_CODE_PORT/honda-code/<code>,
  the link is logged and emailed). Sam looks at the picture and types the code there himself.
  "Remember me" is ticked and the browser profile is kept in data/honda/browser, so while Honda keeps the login
  alive no code is needed.
Data (weekly, all inside the logged-in page, using the page's own encryptAES/decryptAES):
  Service.svc/GetModelSearchData        all model codes (MODELID, MODELNAME, SERIES)
  Service.svc/GetPartseacrhjqgriddata   catPartType 2: every part with where-used (model, assembly), MRP, NS
                                        catPartType 1: accessories / service kits / oil / tools / merchandise with MRP
  For new models and changed assemblies only:
    GetAggrigateData -> ViewFillCategory -> GetIllustrationPartsJQ (ref no, qty, MRP, history flag)
    ImageHandler.ashx Factor=3.00       the diagram, 3x sharp (about 2,500 px), saved exactly as Honda serves it
    PartHistory.aspx                    old part numbers of parts marked 'H'
  BindAccKitPartList                    what is inside each kit
Only reads: no basket, order or save buttons are ever clicked.
Server update: HONDA_MRP_WEBHOOK (+ HONDA_MRP_WEBHOOK_TOKEN) gets MRP changes as JSON, like HERO_MRP_WEBHOOK.
"""
import os, re, csv, json, gzip, time, html, hashlib, secrets, logging, threading, datetime, collections
from common import env, data_dir, load_json, save_json, today, Report

log = logging.getLogger('brand_sync.honda')
BASE = 'https://honda2wheelerparts.com'
SEED = env('HONDA_SEED') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'seed', 'honda', 'seed.json.gz')
MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

JS = r"""
window.hE = v => encryptAES(String(v), secretkye, ivkey);
window.hPost = async (m, body) => {
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch('/Service.svc/' + m, {method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json; charset=utf-8'}, body: JSON.stringify(body)});
      if (!r.ok) throw 'HTTP ' + r.status;
      const j = await r.json();
      let d = j.d;
      if (typeof d === 'string') { try { d = decryptAES(d, secretkye, ivkey); } catch (e) {} try { d = JSON.parse(d); } catch (e) {} }
      return d;
    } catch (e) { if (k === 2) throw String(e); await new Promise(r => setTimeout(r, 3000)); }
  }
};
window.hC = (m, p) => { const b = {}; for (const k in p) b[k] = p[k] === null ? null : hE(p[k]); return hPost(m, b); };
window.hList = (d, key) => Array.isArray(d) ? d : (d && d[key]) || (d && typeof d === 'object' ? d[Object.keys(d)[0]] : null) || [];
window.hModels = async () => hList(await hC('GetModelSearchData', {SerchType: '1', SearchStr: '', PageID: 2}), 'Model');
window.hSearch = async (type) => {           // slim rows so the 289k-row answer stays small
  const d = await hC('GetPartseacrhjqgriddata', {partno: '', catPartType: type});
  const rows = hList(d, 'tbl_PartSearch');
  if (type === '2') return rows.map(r => [r.MODEL, r.MODELID, r.AGGREGATE, r.GROUPNO, r.ASSEMBLYNAME, r.ASSEMBLYID,
                                         r.PARTNO, r.DESCRIPTION, r.PRICE1, r.NS, r.QTY, r.CATEGORY, r.VEHICLE]);
  return rows.map(r => [r.ID, r.PARTNO, r.DESCRIPTION, r.PRICE1, r.VEHICLE, r.ACCTYPENAME, r.ACCTYPEID, r.NS]);
};
window.hAggs = async mid => hList(await hC('GetAggrigateData', {ModelId: mid}), 'Aggrigate');
window.hAsms = async aid => { const d = await hC('ViewFillCategory', {index: aid, Count: 4, inactive: 0, pagetype: 2});
  return (d && d.TBL_ASSEMBLY) || []; };
window.hParts = async (asm, mid) => {
  const n = {_search: false, nd: Date.now(), rows: -1, page: 1, sidx: 'Priority', sord: 'asc', Id: hE(asm), ModelId: hE(mid),
             SelDate: hE(''), svinno: hE(''), isSbom: hE(''), sbomId: hE(''), SessionDate: hE('')};
  const d = await hPost('GetIllustrationPartsJQ', n);
  return (d && d.rows || []).map(r => ({ref: r.RefNo || r.LabelText || '', pn: r.PartNo, desc: r.Description, qty: r.Qty,
    mrp: r.Price1, hist: r.History, apid: r.AssemblyPartId, apmid: r.AssPartModId, pid: r.PartId, start: r.StartDate,
    end: r.EndDate, color: r.ColorCode, ns: r.NS, remark: r.Remark}));
};
window.hKit = async id => { const d = await hC('BindAccKitPartList', {iPartID: id});
  return (d && d.BindControlData || []).map(k => [k.PARTNO, k.DESCRIPTION, k.QUANTITY]); };
0;   // end on a value: Playwright calls a script whose last value is a function (same fix as Hero 15b)
"""

HIST_JS = r"""
async () => {
  for (let i = 0; i < 60; i++) {
    if (window.$ && $('#orderList').length && $.fn.jqGrid) {
      const d = $('#orderList').jqGrid('getRowData');
      if (d.length) return d.map(r => ({pn: r.PartNo, desc: r.Description, mrp: r.PRICE1, start: r.STARTDATE, end: r.ENDDATE,
                                        both: /Left_Right_Arrow/.test(r.InterImage || '')}));
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return [];
}
"""


def jdate(s):
    """'/Date(1459621800000+0530)/' -> datetime.date (India time)"""
    m = re.search(r'Date\((-?\d+)', str(s or ''))
    if not m: return None
    return (datetime.datetime.utcfromtimestamp(int(m.group(1)) / 1000) + datetime.timedelta(hours=5, minutes=30)).date()


def num(v):
    try: return float(str(v).replace(',', '').strip())
    except (TypeError, ValueError): return None


def ccof(code):
    code = code or ''
    if re.match(r'CRF1[01]00', code): return code[3:7] + 'cc'
    m = re.search(r'(\d{2,})', code)
    if code.startswith('EFS') or not m: return 'Electric'
    d = m.group(1)
    return (d[:3] if len(d) >= 4 else d) + 'cc'


def figkey(f): return [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', str(f or ''))]


class CodePage:
    """Small page on the server that shows Sam the Honda login code picture; Sam types the code himself."""
    def __init__(self, port):
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        from urllib.parse import parse_qs
        self.code = secrets.token_urlsafe(12)
        self.img, self.msg, self.answer, self.fresh = b'', 'Login page pe ye code dikh raha hai. Dekh ke type karo.', None, False
        me = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def page(self):
                b = (f'<html><head><meta name="viewport" content="width=device-width"></head>'
                     f'<body style="font-family:sans-serif;padding:24px"><h3>Honda login code</h3><p>{html.escape(me.msg)}</p>'
                     f'<img src="/honda-code/{me.code}/img.png?t={time.time()}" style="border:1px solid #999;min-width:180px;image-rendering:pixelated"><br><br>'
                     f'<form method="post"><input name="code" autocomplete="off" autofocus style="font-size:24px;width:180px"> '
                     f'<button style="font-size:20px">Bhejo</button></form><br>'
                     f'<form method="post"><input type="hidden" name="fresh" value="1"><button>Code samajh nahi aaya, naya code dikhao</button></form>'
                     f'</body></html>').encode()
                self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(b)
            def do_GET(self):
                p = self.path.split('?')[0].rstrip('/')
                if p == f'/honda-code/{me.code}/img.png':
                    self.send_response(200); self.send_header('Content-Type', 'image/png'); self.send_header('Cache-Control', 'no-store')
                    self.end_headers(); self.wfile.write(me.img); return
                if p != f'/honda-code/{me.code}':
                    self.send_response(404); self.end_headers(); return
                self.page()
            def do_POST(self):
                if self.path.split('?')[0].rstrip('/') != f'/honda-code/{me.code}':
                    self.send_response(404); self.end_headers(); return
                q = parse_qs(self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode())
                if q.get('fresh'):
                    me.fresh = True; me.msg = 'Naya code aa raha hai, 10 second baad page refresh karo.'
                else:
                    me.answer = (q.get('code') or [''])[0].strip() or None
                    me.msg = 'Code mil gaya, login ho raha hai. 30 second baad page refresh karke dekho.' if me.answer else 'Code khali tha, dobara daalo.'
                self.page()
        self.srv = ThreadingHTTPServer((env('CODE_BIND', '0.0.0.0'), port), H)   # Bike Pharma server: 127.0.0.1, the website passes /honda-code/ on
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def close(self):
        self.srv.shutdown()


class Honda:
    name = 'Honda'
    pdfs = False                 # run() builds its own PDFs (only new/changed models) and Excel
    price_label = 'MRP from Honda e-catalogue'

    def __init__(self):
        self.dir = data_dir('honda')
        self.state_path = os.path.join(self.dir, 'state.json')
        self.state = load_json(self.state_path, None)
        self.seed = None
        if self.state is None:
            self.state = {'models': {}, 'asm': {}, 'mrp': {}, 'acc': {}, 'kits': {}, 'hist': {}, 'crawled': {}, 'todo': []}
            if os.path.exists(SEED):
                # 23 Oct 2026 full download (264 models, 33,509 parts, 2,686 accessories, 202 kits, old numbers):
                # the first run reports only what changed on the site after 23 Oct
                self.seed = json.load(gzip.open(SEED, 'rt', encoding='utf-8'))
                for k in ('models', 'mrp', 'acc', 'kits', 'hist'):
                    self.state[k] = self.seed[k]

    # ---------- login ----------
    def shot(self, page, name):
        p = os.path.join(data_dir('logs'), f'honda_{name}_{today()}.png')
        try: page.screenshot(path=p)
        except Exception: pass
        return p

    @staticmethod
    def logged_in(page):
        if 'login' in page.url.lower() or page.locator('#txtloginName').count():
            log.info('Honda: login form still on the page (%s)', page.url)
            return False
        try:
            page.wait_for_function("() => typeof encryptAES === 'function' && typeof secretkye !== 'undefined'", timeout=20000)
        except Exception:
            log.info('Honda: page has no encryptAES (%s)', page.url); return False
        try:
            page.evaluate(JS)
            return len(page.evaluate('() => hModels()')) > 0
        except Exception as e:
            log.warning('Honda: logged-in check failed: %s', str(e).split('\n')[0][:200])
            return False

    def open_login(self, page):
        # on the server the code picture is drawn without a real src (src = Login.aspx#), so wait for the box
        # to be on screen instead of naturalWidth; the screenshot below takes it exactly as the page shows it
        ok = "() => { const i = document.querySelector('#imgCode'); return i && i.getBoundingClientRect().width > 0 && document.readyState === 'complete' }"
        if getattr(self, '_errs_page', None) is not page:     # listen once per page (open_login runs again after each try)
            self._errs_page, self.errs = page, []
            page.on('pageerror', lambda e: self.errs.append(str(e)[:150]))
            page.on('console', lambda m: m.type == 'error' and self.errs.append(m.text[:150]))
        errs = self.errs
        for t in range(3):
            try:
                page.goto(BASE + '/Login.aspx', wait_until='domcontentloaded', timeout=90000)
                page.wait_for_function(ok, timeout=60000)
                # the page draws the code with its own imageShow() (the same as its refresh); if the picture is
                # still empty, ask the page to draw it, then wait for a real picture
                drawn = "() => { const i = document.querySelector('#imgCode'); return i && i.complete && i.naturalWidth > 0 }"
                try:
                    page.wait_for_function(drawn, timeout=10000)
                except Exception:
                    page.evaluate("() => { if (typeof imageShow === 'function') imageShow(); 0; }")
                    try:
                        page.wait_for_function(drawn, timeout=20000)
                    except Exception:
                        src = page.evaluate("() => (document.querySelector('#imgCode').getAttribute('src') || '').slice(0, 60)")
                        raise RuntimeError(f'code picture empty (src {src!r}, page errors: {"; ".join(errs[-3:]) or "none"})')
                page.wait_for_timeout(1000)
                break
            except Exception as e:
                # the code picture did not load: keep a screenshot + what the page was, then try again
                shot = self.shot(page, f'login_page_{t + 1}')
                try: where = f'{page.url} | {page.title()}'
                except Exception: where = '?'
                log.warning('Honda login page: code picture did not load (try %d/3, %s). Page: %s. Screenshot: %s',
                            t + 1, str(e).split('\n')[0], where, shot)
                if t == 2:
                    raise SystemExit(f'Honda login page ka code picture nahi khula (3 baar). Page: {where}. Screenshot: {shot}')
                page.wait_for_timeout(20000)
        page.fill('#txtloginName', env('HONDA_USER', required=True))
        page.fill('#txtPassword', env('HONDA_PASS', required=True))
        if page.locator('#chkRemember').count() and not page.is_checked('#chkRemember'):
            page.check('#chkRemember')
        return page.locator('#imgCode').screenshot()      # the picture exactly as the login page shows it

    def login(self, page):
        page.goto(BASE + '/Home.aspx', wait_until='domcontentloaded')
        page.wait_for_timeout(3000)
        if self.logged_in(page):
            log.info('Honda: still logged in (saved browser profile)'); return
        said = []
        page.on('dialog', lambda d: (said.append(d.message), d.dismiss()))
        port = int(env('HONDA_CODE_PORT', '8766'))
        cp = CodePage(port)
        cp.img = self.open_login(page)
        link = f"{env('HONDA_CODE_LINK_BASE', f'http://SERVER-IP:{port}').rstrip('/')}/honda-code/{cp.code}"
        wait = int(env('HONDA_CODE_WAIT', '180'))
        msg = (f'Honda login ke liye code chahiye. Ye link kholo, jo code dikhe wo type karo:\n{link}\n\n'
               f'{wait} minute tak wait karega.')
        log.warning(msg)
        from notify import send
        send(msg, subject='Honda login code chahiye')
        end = time.time() + 60 * wait
        try:
            while time.time() < end:
                if cp.fresh:
                    cp.fresh = False
                    cp.img = self.open_login(page); cp.msg = 'Naya code. Dekh ke type karo.'
                if cp.answer:
                    code, cp.answer = cp.answer, None
                    said.clear()
                    log.info('Honda: code mila (%d akshar), login kar raha hai', len(code))
                    page.fill('#txtVerification', code)
                    net = []
                    def seen(r):
                        try:
                            if r.request.method == 'POST' or r.status >= 300:
                                net.append(f'{r.request.method} {r.url.split("?")[0][-60:]} {r.status}')
                        except Exception: pass
                    page.on('response', seen)
                    try:   # what the page's own checks say before Enter (CheckLoginText decides if SubmitLogin runs)
                        pre = page.evaluate("() => { let c; try { c = typeof CheckLoginText === 'function' ? CheckLoginText() : 'none'; } catch (e) { c = 'error: ' + e; }"
                                            " return 'CheckLoginText=' + c + ', SubmitLogin=' + typeof SubmitLogin + ', user filled=' + !!document.querySelector('#txtloginName').value"
                                            " + ', pass filled=' + !!document.querySelector('#txtPassword').value }")
                    except Exception as e:
                        pre = f'check failed: {e}'
                    log.info('Honda: before Enter: %s', pre)
                    page.click('#btnEnter')
                    try: page.wait_for_load_state('networkidle', timeout=60000)
                    except Exception: pass
                    page.wait_for_timeout(4000)
                    page.remove_listener('response', seen)
                    try:
                        lbl = page.evaluate("() => { const e = document.querySelector('#lblmessage'); return e ? e.innerText.trim() : '' }")
                    except Exception:
                        lbl = ''
                    log.info('Honda: after Enter: %s | requests: %s | message: %s | page errors: %s', page.url,
                             ' ; '.join(net[:8]) or 'none', lbl or 'none', ' ; '.join(self.errs[-3:]) or 'none')
                    if 'home' not in page.url.lower():
                        page.goto(BASE + '/Home.aspx', wait_until='domcontentloaded'); page.wait_for_timeout(3000)
                    if self.logged_in(page):
                        cp.msg = 'Login ho gaya. Ye page band kar sakte ho.'
                        log.info('Honda login ok'); return
                    why = ' / '.join(said)
                    if not why:
                        # no alert: say what the page shows (its own message label, address, title)
                        try:
                            lbl = page.evaluate("() => [...document.querySelectorAll('#lblmessage, .error, .alert, [id*=lblMsg], [id*=lblError]')].map(e => e.innerText.trim()).filter(Boolean).join(' / ')")
                            why = f"{lbl or 'koi message nahi'} | page: {page.url} | {page.title()}"
                        except Exception as e:
                            why = f'login nahi hua ({e})'
                    self.shot(page, 'login_try')
                    if re.search(r'password|user|email|invalid user|not exist|blocked|lock', why, re.I) and not re.search(r'code|verification|captcha', why, re.I):
                        cp.msg = f'Honda ne bola: {why}. .env me HONDA_USER / HONDA_PASS check karo.'
                        raise SystemExit(f'Honda login failed: {why}. HONDA_USER / HONDA_PASS check karo.')
                    log.warning('Honda: login nahi hua (%s). Naya code link pe hai.', why)
                    cp.img = self.open_login(page)
                    cp.msg = f'Code sahi nahi laga ({why}). Naya code dekh ke dobara type karo.'
                time.sleep(2)
        finally:
            cp.close()
        raise SystemExit(f'Honda: {wait} minute me code nahi mila, sync nahi chala.')

    # ---------- reading ----------
    def ensure_session(self, page):
        if 'home.aspx' not in page.url.lower():
            page.goto(BASE + '/Home.aspx', wait_until='domcontentloaded'); page.wait_for_timeout(2000)
        page.evaluate(JS)

    def img_path(self, h):
        return os.path.join(data_dir('honda', 'img'), h + '.jpg')

    def asm_path(self, mid, aid):
        return os.path.join(data_dir('honda', 'asm'), f'{mid}_{aid}.json')

    def history(self, ctx, rows):
        """old part numbers for parts marked 'H' that we don't know yet (PartHistory.aspx, read only)"""
        need = [r for r in rows if r.get('hist') == 'H' and r['pn'] not in self.state['hist']]
        if not need:
            return
        hp = ctx.new_page()
        try:
            for r in need:
                d = jdate(r.get('start'))
                url = (f"{BASE}/PartHistory.aspx?ID={r['apid']}&ModelID={r['mid']}&STARTDATE={d.strftime('%d-%b-%Y') if d else ''}"
                       f"&AssemblyPartMODID={r.get('apmid') or 0}&pId={r['pid']}&Type=Part&HType=Multi")
                try:
                    hp.goto(url, wait_until='domcontentloaded')
                    h = hp.evaluate(HIST_JS)
                except Exception as e:
                    log.warning('history %s: %s', r['pn'], e); continue
                olds = [x for x in h if x['pn'] and x['pn'] != r['pn']]
                self.state['hist'][r['pn']] = [[x['pn'], x['desc'], num(x['mrp']), x['start'], (x['end'] or '').strip(), x['both']] for x in olds]
                time.sleep(0.3)
        finally:
            hp.close()

    def crawl_model(self, page, ctx, code, mid, meta):
        """all assemblies of one model: parts with ref no + 3x diagram, saved under data/honda/asm and img"""
        self.ensure_session(page)
        aggs = page.evaluate('m => hAggs(m)', mid)
        asms = []
        for a in aggs:
            lst = page.evaluate('a => hAsms(a)', a['ID'])
            if not lst:                                        # session lost its place (e.g. after accessories) - reopen once
                page.goto(BASE + '/Home.aspx', wait_until='domcontentloaded'); page.wait_for_timeout(2000); page.evaluate(JS)
                page.evaluate('m => hAggs(m)', mid)
                lst = page.evaluate('a => hAsms(a)', a['ID'])
            for s in lst:
                if not s.get('INACTIVE'):
                    asms.append([a.get('CATEGORYNAME') or '', s.get('FIGNO') or '', (s.get('CATEGORYNAME') or '').strip(), s['ID']])
        if aggs and not asms:
            raise RuntimeError(f'Honda {code}: assemblies list empty (session issue) - will retry next run')
        out, allrows = [], []
        for agg, fig, name, aid in asms:
            rows = page.evaluate('([a, m]) => hParts(a, m)', [aid, mid])      # also tells the server which diagram to serve
            r = page.request.get(f'{BASE}/ImageHandler.ashx?Type=Part&PartId=-1,&Factor=3.00&time={aid}_{int(time.time() * 1000)}', timeout=120000)
            h = ''
            if r.ok and len(r.body()) > 3000 and (r.headers.get('content-type') or '').startswith('image'):
                b = r.body(); h = hashlib.sha1(b).hexdigest()[:20]
                p = self.img_path(h)
                if not os.path.exists(p): open(p, 'wb').write(b)          # bytes exactly as Honda serves them
            for x in rows: x['mid'] = mid
            save_json(self.asm_path(mid, aid), {'rows': rows, 'fetched': today()})
            out.append([agg, fig, name, aid, h])
            allrows += rows
            time.sleep(float(env('HONDA_DELAY', '0.2')))
        self.history(ctx, allrows)
        self.state['crawled'][code] = {**meta, 'mid': mid, 'asms': out, 'date': today()}

    # ---------- sync ----------
    def run(self, full=False, report=None):
        rep = report or Report(self.name)
        from playwright.sync_api import sync_playwright
        built = []
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(data_dir('honda', 'browser'), headless=env('HONDA_HEADFUL', '') == '',
                                                       viewport={'width': 1500, 'height': 900})
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.set_default_timeout(120000)
            try:
                self.login(page)
                self.ensure_session(page)
                models = page.evaluate('() => hModels()')
                log.info('Honda: %d models, reading full part list (takes ~6 min)', len(models))
                search = page.evaluate("() => hSearch('2')")
                acc = page.evaluate("() => hSearch('1')")
                if len({r[6] for r in search}) < 0.9 * len(self.state['mrp'] or {}):
                    raise RuntimeError(f'Honda part list gave only {len(search)} rows - stopping, nothing changed')
                todo = self.merge_search(rep, models, search, full)
                for i, code in enumerate(todo):
                    m = self.state['models'][code]
                    log.info('Honda: downloading %s (%d/%d)', code, i + 1, len(todo))
                    self.crawl_model(page, ctx, code, m['mid'], m)
                    self.state['todo'] = [c for c in self.state['todo'] if c != code]
                    save_json(self.state_path, self.state)                 # resume here if the run stops
                    built.append(code)
                kits = self.read_kits(page, acc)
            finally:
                ctx.close()
        self.merge_acc(rep, acc, kits)
        self.state['last_run'] = today()
        save_json(self.state_path, self.state)
        self.write_files(rep, built)
        return rep, built

    def merge_search(self, rep, models, search, full):
        st = self.state
        first = not st['asm']
        newm = {}
        for m in models:
            c = (m.get('MODELNAME') or '').strip()
            if c and c not in newm:
                newm[c] = {'mid': m['MODELID'], 'series': (m.get('SERIES') or '').strip(), 'type': (m.get('TYPENAME') or '').strip()}
        if len(newm) < 0.8 * max(1, len(st['models'])):
            raise RuntimeError(f'Honda gave only {len(newm)} models (last time {len(st["models"])}) - stopping')
        todo = set(st.get('todo') or [])
        for c in sorted(set(newm) - set(st['models'])):
            rep.add('Naya model', f"{newm[c]['series']} {ccof(c)} [{c}]"); todo.add(c)
        for c in sorted(set(st['models']) - set(newm)):
            rep.add('Site se hata model', f"{st['models'][c].get('series')} [{c}]")
        # where-used: assembly -> parts
        asm, mrp, pm = {}, {}, collections.defaultdict(set)
        for code, mid, agg, fig, name, aid, pn, desc, price, ns, qty, cat, veh in search:
            pn = (pn or '').strip().upper()
            if not pn: continue
            k = f'{code}|{agg}|{fig}|{(name or "").strip()}'
            a = asm.setdefault(k, {'aid': aid, 'mid': mid, 'parts': set()})
            a['parts'].add(pn)
            pm[code].add(pn)
            o = mrp.get(pn)
            if not o or (o['mrp'] in (None, 0) and price):
                mrp[pn] = {'desc': (desc or '').strip(), 'mrp': num(price), 'ns': ns or ''}
        known_all = set(st['mrp'])
        if first and self.seed:
            sm = self.seed['model_parts']
            for c, ps in sorted(pm.items()):
                if c in sm and set(sm[c]) != ps:
                    add, gone = sorted(ps - set(sm[c])), sorted(set(sm[c]) - ps)
                    rep.add('Parts badle', f"{c}: +{len(add)} naye, -{len(gone)} hataye" + (f" (naye: {', '.join(add[:8])})" if add else ''))
                    todo.add(c)
        elif not first:
            for k, a in sorted(asm.items()):
                o = st['asm'].get(k)
                code = k.split('|')[0]
                if o is None:
                    if code in st['models']:
                        rep.add('Naya diagram', k.replace('|', ' - ')); todo.add(code)
                elif set(o['parts']) != a['parts']:
                    add, gone = sorted(a['parts'] - set(o['parts'])), sorted(set(o['parts']) - a['parts'])
                    rep.add('Parts badle', f"{k.replace('|', ' - ')}: +{len(add)} naye, -{len(gone)} hataye"
                            + (f" (naye: {', '.join(add[:8])})" if add else ''))
                    todo.add(code)
        if known_all:
            for pn in sorted(set(mrp) - known_all)[:500]:
                rep.add('Naya part number', f"{pn} {mrp[pn]['desc']} MRP {mrp[pn]['mrp']}")
        self.changes = []
        for pn, v in sorted(mrp.items()):
            o = st['mrp'].get(pn)
            if o and v['mrp'] is not None and o.get('mrp') is not None and abs(v['mrp'] - o['mrp']) >= 0.5:
                self.changes.append({'part_no': pn, 'old_mrp': o['mrp'], 'new_mrp': v['mrp'], 'name': v['desc']})
        for c in self.changes[:300]:
            rep.add('MRP badla', f"{c['part_no']} {c['name']}: Rs {c['old_mrp']:g} -> Rs {c['new_mrp']:g}")
        self.gone = sorted(set(st['mrp']) - set(mrp)) if known_all else []
        if self.gone:
            rep.add('Part list se hata', f'{len(self.gone)} parts (list Excel me)')
        if full:
            todo |= set(newm)
        st['models'] = newm
        st['asm'] = {k: {'aid': a['aid'], 'mid': a['mid'], 'parts': sorted(a['parts'])} for k, a in asm.items()}
        st['mrp'] = mrp
        st['model_parts'] = {c: len(v) for c, v in pm.items()}
        self.where = pm
        self.search = search
        st['todo'] = sorted(c for c in todo if c in newm)
        return st['todo']

    def read_kits(self, page, acc):
        """kit contents; opening the accessories page first is what makes Honda answer BindAccKitPartList"""
        page.request.get(BASE + '/AccessoriesListing.aspx?Type=Figure&Id=1224', timeout=120000)   # same login session
        self.ensure_session(page)
        ids = sorted({r[0] for r in acc if r[0]})
        out = {}
        for i in range(0, len(ids), 50):
            part = page.evaluate('async ids => { const o = {}; for (const id of ids) { try { const k = await hKit(id); if (k.length) o[id] = k; } catch (e) {} } return o; }',
                                 ids[i:i + 50])
            out.update({str(k): v for k, v in part.items()})
        log.info('Honda: %d accessories, %d kits', len(ids), len(out))
        return out

    def merge_acc(self, rep, acc, kits):
        st = self.state
        new = {}
        for aid, pn, desc, price, sec, title, tid, ns in acc:
            pn = (pn or '').strip().upper()
            if not pn: continue
            a = new.setdefault(str(aid), {'pn': pn, 'desc': (desc or '').strip(), 'mrp': num(price), 'sec': sec or '', 'models': []})
            if title and title not in a['models']: a['models'].append(title)
        if st['acc']:
            for k, a in sorted(new.items(), key=lambda kv: kv[1]['pn']):
                o = st['acc'].get(k)
                if not o:
                    rep.add('Naya accessory / kit', f"{a['pn']} {a['desc']} ({a['sec']}: {', '.join(a['models'][:4])}) MRP {a['mrp']}")
                elif a['mrp'] is not None and o.get('mrp') is not None and abs(a['mrp'] - o['mrp']) >= 0.5:
                    self.changes.append({'part_no': a['pn'], 'old_mrp': o['mrp'], 'new_mrp': a['mrp'], 'name': a['desc']})
                    rep.add('MRP badla (accessory)', f"{a['pn']} {a['desc']}: Rs {o['mrp']:g} -> Rs {a['mrp']:g}")
        if st['kits']:
            for k, v in sorted(kits.items()):
                o = st['kits'].get(k)
                if o is not None and sorted(map(tuple, o)) != sorted(map(tuple, v)):
                    rep.add('Kit ke andar badla', f"{new.get(k, {}).get('pn', k)} {new.get(k, {}).get('desc', '')}")
                elif o is None and k in st['acc']:
                    rep.add('Kit ke andar badla', f"{new.get(k, {}).get('pn', k)} {new.get(k, {}).get('desc', '')} (ab kit hai)")
        st['acc'], st['kits'] = new, kits
        self.push(self.changes)

    # ---------- files ----------
    def write_files(self, rep, built):
        import builders, openpyxl
        out = data_dir('output', 'Honda')
        src = f'Source: Honda e-catalogue (honda2wheelerparts.com), synced {today()}. Price column: MRP from Honda e-catalogue.'
        prices = self.prices()
        if built and env('SKIP_PDFS') != '1':     # the Bike Pharma server builds its own catalogue, no PDFs
            vs = [v for v in self.variants() if v['key'] in set(built)]
            paths = builders.build_pdfs(vs, os.path.join(out, 'PDF', 'Models'), prices, None, src)
            rep.add('Files update hui', f'{len(paths)} model PDFs (naye / badle hue models)')
        st = self.state
        where = getattr(self, 'where', None)
        if where is None:
            return
        with open(os.path.join(out, f'mrp_changes_{today()}.csv'), 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f); w.writerow(['part_no', 'old_mrp', 'new_mrp', 'name'])
            for c in self.changes: w.writerow([c['part_no'], c['old_mrp'], c['new_mrp'], c['name']])
        used = collections.defaultdict(set); asmn = collections.defaultdict(set)
        for code, mid, agg, fig, name, aid, pn, *_ in self.search:
            pn = (pn or '').strip().upper()
            used[pn].add(code); asmn[pn].add(f'{fig} {name}'.strip())
        ser = {c: f"{m['series']} {ccof(c)}" for c, m in st['models'].items()}
        wb = openpyxl.Workbook(); wb.remove(wb.active)
        def sheet(title, head, rows, widths):
            ws = wb.create_sheet(title); ws.append(head)
            for r in rows: ws.append(r)
            for i, wd in enumerate(widths): ws.column_dimensions[openpyxl.utils.get_column_letter(i + 1)].width = wd
            ws.freeze_panes = 'A2'
        sheet('All Parts A-Z', ['Part No', 'Description', 'MRP (Rs)', 'NS', 'Models', 'Model codes', 'No. of model codes', 'Assemblies', 'Purana part no.'],
              [[pn, v['desc'], v['mrp'], v['ns'], ', '.join(sorted({ser.get(c, c) for c in used[pn]}, key=figkey))[:800],
                ', '.join(sorted(used[pn])), len(used[pn]), ', '.join(sorted(asmn[pn]))[:500],
                ', '.join(h[0] for h in st['hist'].get(pn, []))] for pn, v in sorted(st['mrp'].items())],
              [16, 36, 10, 5, 50, 40, 8, 50, 18])
        sheet('Accessories & Kits', ['Part No', 'Description', 'MRP (Rs)', 'Section', 'Models', 'Kit ke andar (Part No · Naam · Qty)'],
              [[a['pn'], a['desc'], a['mrp'], a['sec'], ', '.join(a['models']), ' | '.join(f'{k[0]} · {k[1]} · {k[2]}' for k in st['kits'].get(k, []))]
               for k, a in sorted(st['acc'].items(), key=lambda kv: (kv[1]['sec'], kv[1]['pn']))],
              [18, 36, 10, 16, 40, 80])
        sheet('MRP Badla', ['Part No', 'Naam', 'Purana MRP', 'Naya MRP'],
              [[c['part_no'], c['name'], c['old_mrp'], c['new_mrp']] for c in self.changes], [16, 36, 11, 11])
        sheet('List se Hata', ['Part No'], [[pn] for pn in self.gone], [16])
        wb.save(os.path.join(out, 'Honda_All_Parts.xlsx'))
        # old <-> new, both ways
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Purana -> Naya'
        ws.append(['Purana Part No', 'Purana Naam', 'Purana MRP', 'Kab tak', 'Naya Part No', 'Naya Naam', 'Naya MRP', 'Dono chalte hain'])
        back = collections.defaultdict(list)
        for new, olds in sorted(st['hist'].items()):
            for o in olds:
                back[new].append(o[0])
                ws.append([o[0], o[1], o[2], o[4], new, (st['mrp'].get(new) or {}).get('desc', ''), (st['mrp'].get(new) or {}).get('mrp'), 'Haan' if o[5] else ''])
        ws2 = wb.create_sheet('Naya -> Purane')
        ws2.append(['Naya Part No', 'Naam', 'MRP', 'Purane Part No'])
        for new, olds in sorted(back.items()):
            ws2.append([new, (st['mrp'].get(new) or {}).get('desc', ''), (st['mrp'].get(new) or {}).get('mrp'), ', '.join(olds)])
        for w_ in (ws, ws2):
            w_.freeze_panes = 'A2'
            for col in 'ABCDEFGH': w_.column_dimensions[col].width = 18
        wb.save(os.path.join(out, 'Honda_Purana_Naya.xlsx'))

    def push(self, changes):
        url = env('HONDA_MRP_WEBHOOK')
        if not url or not changes:
            return
        import requests
        h = {'Content-Type': 'application/json'}
        if env('HONDA_MRP_WEBHOOK_TOKEN'): h['Authorization'] = 'Bearer ' + env('HONDA_MRP_WEBHOOK_TOKEN')
        for i in range(0, len(changes), 2000):
            r = requests.post(url, headers=h, timeout=120, data=json.dumps({'source': 'honda_ecat', 'date': today(), 'changes': changes[i:i + 2000]}))
            log.info('webhook %s: HTTP %s', url, r.status_code)

    def rebuild(self):
        """python sync.py honda --rebuild: rebuild PDFs of every downloaded model from saved data, no login"""
        import builders
        rep = Report(self.name)
        out = data_dir('output', 'Honda')
        src = f'Source: Honda e-catalogue (honda2wheelerparts.com), synced {self.state.get("last_run", "")}. Price column: MRP from Honda e-catalogue.'
        paths = builders.build_pdfs(list(self.variants()), os.path.join(out, 'PDF', 'Models'), self.prices(), None, src)
        rep.add('Files update hui', f'{len(paths)} model PDFs dobara bane')
        return rep

    # ---------- data for the PDF builder ----------
    def prices(self):
        p = {pn: v['mrp'] for pn, v in self.state['mrp'].items() if v.get('mrp')}
        p.update({a['pn']: a['mrp'] for a in self.state['acc'].values() if a.get('mrp')})
        return p

    def variants(self):
        for code, m in sorted(self.state['crawled'].items()):
            plates, starts = [], []
            for agg, fig, name, aid, h in sorted(m['asms'], key=lambda x: (0 if x[0] == 'ENGINE' else 1, figkey(x[1]))):
                d = load_json(self.asm_path(m['mid'], aid), None)
                if not d or not d['rows']:
                    continue
                rows = []
                for r in d['rows']:
                    pn = (r.get('pn') or '').strip().upper()
                    dt = jdate(r.get('start'))
                    if dt: starts.append(dt)
                    note = []
                    if self.state['hist'].get(pn): note.append('Purana: ' + ', '.join(o[0] for o in self.state['hist'][pn]))
                    if r.get('color'): note.append('Colour ' + r['color'])
                    if r.get('ns') == 'NS': note.append('NS')
                    rows.append({'sn': str(r.get('ref') or ''), 'pn': pn, 'desc': (r.get('desc') or '') + (f" ({'; '.join(note)})" if note else ''),
                                 'qty': r.get('qty')})
                img = self.img_path(h) if h else ''
                plates.append({'title': f'{fig} {name.title()}'.strip(), 'img': img if img and os.path.exists(img) else '', 'rows': rows})
            if not plates:
                continue
            d0 = min(starts) if starts else None
            series = m.get('series') or code
            yield {'brand': 'Honda', 'family': m.get('type') or 'Honda', 'model': series, 'variant': f'{series} {ccof(code)}',
                   'sku': code, 'bom': '', 'mfg': d0.strftime('%Y-%m') if d0 else '', 'vertical': (m.get('type') or '').upper(),
                   'plates': plates, 'key': code}
