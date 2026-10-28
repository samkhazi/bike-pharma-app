"""Hero Connect DMS (Siebel, connect.heromotocorp.biz) - weekly, Saturday 9 pm.

Login: HERO_DMS_USER / HERO_DMS_PASS from .env (Sam's dealer ID). One login per ID: running this logs out
       anyone using the same ID in a browser, so run it at night.
What it pulls (export to CSV from the DMS screens, in chunks so no export is too big):
  Master > Product          every part: name, HSN, group, active flag, "Superceeded By"
  Master > Price Lists > MRP Master Parts Price List
                            MRP lines with Effective From >= last run (first run: everything)
  Product > Model list      models of each NEW part (base model names, e.g. "SPLENDOR +")
Never clicks: Delete, New Effective Date, Refresh Product Cache, Update External System, Release, Update Commerce App.
Outputs in DATA_DIR/hero_dms and DATA_DIR/output/Hero DMS:
  parts.json / Hero_DMS_Parts.csv     every part with latest MRP
  Hero_DMS_Report_<date>.xlsx         naye parts, MRP badle, superseded naye, band hue, naye models,
                                      purana -> naya and naya -> purane (full lists)
  mrp_changes_<date>.csv              part_no, old_mrp, new_mrp, effective_from (for the server update)
Server update: if HERO_MRP_WEBHOOK is set, the MRP changes are POSTed there as JSON
  {"source":"hero_dms","date":..., "changes":[{"part_no","old_mrp","new_mrp","effective_from","name"}]}
  with header Authorization: Bearer <HERO_MRP_WEBHOOK_TOKEN> (if set).
"""
import os, io, re, csv, json, datetime, logging
from common import env, data_dir, load_json, save_json, today, Report

log = logging.getLogger('brand_sync.hero_dms')
BASE = 'https://connect.heromotocorp.biz/siebel/app/edealerpd/enu/'
PRODUCT_VIEW = 'HHML All ISS Product Administration View'
PRICE_VIEW = 'HHML TNT SHM All Price List View-eDealer'
PL = 'HHML SIS Product List Admin Applet'
MODEL_APPLET = 'HHML Product Model List Applet'
PRICE_APPLET = 'Price List Item Applet (new)'
# chunks that each stay under ~20k rows (bigger exports hang the DMS)
PRODUCT_CHUNKS = [f'{d}*' for d in '01234567'] + [f'8{d}*' for d in '0123456789'] + \
                 ['9*', 'A*', 'B*', 'C*', 'D*', '>="E" AND <"I"', 'I*', '>="J"', '<"0"']
MRP_CHUNKS = [f'{a}{b}*' for a in '0123456789' for b in '0123456789' if a + b != '77'] + [f'77{c}*' for c in '0123456789'] + \
             ['A*', 'B*', 'C*', 'D*', '>="E" AND <"I"', 'I*', '>="J"', '<"0"']
MENU = {'Products List': 'Products List: Menu', 'Price List Line Items': 'Price List Line Items Menu'}

JS = r"""
window.vis=e=>e&&e.offsetParent;
window.btn=l=>[...document.querySelectorAll('button')].find(e=>vis(e)&&(e.getAttribute('aria-label')||'')===l);
window.sl=ms=>new Promise(r=>setTimeout(r,ms));
window.view=()=>{try{return SiebelApp.S_App.GetActiveView().GetName()}catch(e){return ''}};
window.rs=a=>{try{return SiebelApp.S_App.GetActiveView().GetAppletMap()[a].GetPModel().Get('GetRawRecordSet')}catch(e){return null}};
window.sQuery=async(prefix,field,value)=>{            // prefix = applet title, e.g. 'Products List'
  const q=btn(prefix+':Query'); if(q){q.click(); await sl(2500)}
  let inp=null; for(let t=0;t<8&&!(inp&&vis(inp));t++){const td=document.querySelector('td[id$="_l_'+field+'"]'); if(td) td.click(); await sl(800); inp=document.getElementById('1_'+field)}
  if(!inp) return 'no input';
  inp.focus(); inp.value=value; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true}));
  await sl(300); btn(prefix+':Go').click();
  for(let k=0;k<300;k++){await sl(1000); if(!btn(prefix+':Cancel')) break}
  await sl(2500);
  const rc=[...document.querySelectorAll('[id$="_rc"]')].filter(vis).map(e=>e.textContent).join(' ');
  return rc||'ok';
};
window.sExportStart=async(menu)=>{
  btn(menu).click(); await sl(1200);
  const ex=[...document.querySelectorAll('a')].filter(vis).find(a=>a.textContent.trim()==='Export...'); if(!ex) return false; ex.click();
  for(let i=0;i<25;i++){await sl(1000); if([...document.querySelectorAll('input[type=radio]')].some(x=>vis(x)&&x.value==='All')) break}
  for(const v of ['All Rows In Current Query','All','Comma Separated Text File']){const e=[...document.querySelectorAll('input[type=radio]')].find(x=>vis(x)&&x.value===v); if(e) e.click()}
  return true;
};
window.sExportNext=()=>{btn('Export Form:Next').click()};
window.sExportClose=()=>{const c=[...document.querySelectorAll('button')].find(e=>vis(e)&&/Export Form:Close/.test(e.getAttribute('aria-label')||'')); if(c) c.click()};
window.sExportMsg=()=>{const t=[...document.querySelectorAll('*')].find(e=>vis(e)&&/Export completed successfully/.test(e.textContent)&&e.children.length<3); return t?t.textContent.trim():''};
window.sModels=async(parts)=>{         // models of each part (clicks each row, pages the 10-row model list)
  const out={}; const v=SiebelApp.S_App.GetActiveView();
  const cur=()=>{const p=v.GetAppletMap()['""" + MODEL_APPLET + r"""'].GetPModel(); return p.Get('GetRawRecordSet').map(m=>m.Model)};
  async function stable(){let last=null,same=0;for(let k=0;k<30;k++){await sl(300);const s=cur().join('|');if(s===last)same++;else{same=0;last=s}if(same>=2)break}return last?last.split('|').filter(Boolean):[]}
  for(let b=0;b<parts.length;b+=10){
    const batch=parts.slice(b,b+10);
    await sQuery('Products List','Part__',batch.map(p=>'="'+p+'"').join(' OR '));
    const r=rs('""" + PL + r"""')||[]; const trs=[...document.querySelectorAll('tr.jqgrow')].filter(tr=>tr.closest('[id^="s_"][id$="_l"]')&&tr.querySelector('td[id$="_Part__"]'));
    for(let i=0;i<trs.length&&i<r.length;i++){
      const tds=trs[i].querySelectorAll('td'); (tds[2]||tds[1]).click(); await sl(400);
      let s=await stable(); const set=new Set(s); let pg=0;
      while(s.length>=10&&pg<30){const pm=v.GetAppletMap()['""" + MODEL_APPLET + r"""'].GetPModel(); if(!pm.ExecuteMethod('CanInvokeMethod','GotoNextSet'))break;
        pm.ExecuteMethod('InvokeMethod','GotoNextSet',null,{async:false}); const prev=s.join('|'); await sl(400); s=await stable(); if(s.join('|')===prev)break; s.forEach(x=>set.add(x)); pg++}
      out[r[i]['Part #']]=[...set];
    }
  }
  return out;
};
0;   // end on a value: Playwright calls a script whose last value is a function
"""


def money(s):
    s = str(s or '').replace('Rs.', '').replace(',', '').strip()
    try: return float(s)
    except ValueError: return None


def ddate(s):
    try: return datetime.datetime.strptime(str(s or '').strip()[:10], '%d/%m/%Y')
    except ValueError: return datetime.datetime(1900, 1, 1)


class HeroDMS:
    name = 'Hero DMS'
    pdfs = False

    def __init__(self):
        self.dir = data_dir('hero_dms')
        self.out = data_dir('output', 'Hero DMS')
        self.state_path = os.path.join(self.dir, 'state.json')
        self.state = load_json(self.state_path, {'last_run': '', 'models_seen': []})
        self.parts_path = os.path.join(self.dir, 'parts.json')
        seed = env('HERO_DMS_SEED') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'seed', 'hero_dms')
        if not os.path.exists(self.parts_path) and os.path.exists(os.path.join(seed, 'parts.json')):
            import shutil   # start from the 27 Oct 2026 full export, so the first run only fetches what changed after it
            shutil.copy(os.path.join(seed, 'parts.json'), self.parts_path)
            shutil.copy(os.path.join(seed, 'state.json'), self.state_path)
            self.state = load_json(self.state_path, self.state)
        self.parts = load_json(self.parts_path, {})     # part -> {name,hsn,group,active,sup,mrp,eff_from,models}

    # ---------- browser ----------
    def login(self, page):
        user = env('HERO_DMS_USER', required=True); pw = env('HERO_DMS_PASS', required=True)
        page.goto(env('HERO_DMS_URL', BASE), wait_until='domcontentloaded')
        page.wait_for_timeout(3000)
        page.locator('input[name="SWEUserName"], input[type="text"]:visible').first.fill(user)
        page.locator('input[name="SWEPassword"], input[type="password"]:visible').first.fill(pw)
        page.locator('a:has-text("Login"):visible, button:has-text("Login"):visible, input[type="submit"]:visible, '
                     'a:has-text("Sign In"):visible, button:has-text("Sign In"):visible').first.click()
        try:
            page.wait_for_function('() => window.SiebelApp && SiebelApp.S_App && SiebelApp.S_App.GetActiveView && SiebelApp.S_App.GetActiveView()', timeout=120000)
        except Exception:
            shot = os.path.join(data_dir('logs'), f'hero_dms_login_{today()}.png')
            page.screenshot(path=shot)
            raise SystemExit(f'Hero DMS login failed (screenshot: {shot}). Check HERO_DMS_USER / HERO_DMS_PASS, or OTP/captcha aa gaya?')
        page.wait_for_timeout(3000)
        page.evaluate(JS)
        log.info('Hero DMS login ok')

    def goto(self, page, view):
        page.evaluate('v => SiebelApp.S_App.GotoView(v)', view)
        page.wait_for_function('v => window.view && view()===v', arg=view, timeout=120000)
        page.wait_for_timeout(3000)
        page.evaluate(JS)

    def open_mrp(self, page):
        self.goto(page, PRICE_VIEW)
        page.wait_for_function("() => [...document.querySelectorAll('a')].some(a=>/MRP Master/.test(a.innerText))", timeout=90000)
        page.evaluate("[...document.querySelectorAll('a')].find(a=>/MRP Master/.test(a.innerText)).click()")
        page.wait_for_function("() => view()==='HHML Admin Price List Item-eDealer'", timeout=120000)
        page.wait_for_timeout(3000)
        page.evaluate(JS)

    def known(self, value, prefix):
        """How many parts last time's data has for a simple 'AB*' chunk (0 when the chunk is not a plain prefix)."""
        m = re.fullmatch(r'([0-9A-Z]+)\*', value)
        if not m: return 0
        key = 'active' if prefix == 'Products List' else 'mrp'
        return sum(1 for pn, d in self.parts.items() if pn.startswith(m.group(1)) and d.get(key) not in (None, ''))

    def reload(self, page, prefix):
        page.wait_for_timeout(15000)
        if prefix == 'Products List': self.goto(page, PRODUCT_VIEW)
        else: self.open_mrp(page)

    def export(self, page, prefix, field, value, tries=3):
        """Query, then export all rows to CSV. Returns list of dict rows ([] when no records)."""
        for t in range(tries):
            rc = page.evaluate('([p,f,v]) => sQuery(p,f,v)', [prefix, field, value])
            if 'No Records' in rc:
                # the DMS sometimes answers "No Records" for a chunk that has parts: trust it only if last time had none too
                if t < tries - 1 and self.known(value, prefix):
                    log.warning('export %s %s: DMS said no records, last time %d - reload and retry', prefix, value, self.known(value, prefix))
                    self.reload(page, prefix); continue
                return []
            if not page.evaluate('m => sExportStart(m)', MENU[prefix]):
                page.evaluate('sExportClose()'); page.wait_for_timeout(4000); continue
            try:
                with page.expect_download(timeout=45 * 60 * 1000) as dl:
                    page.evaluate('sExportNext()')
                raw = open(dl.value.path(), 'rb').read()
            except Exception as e:
                log.warning('export %s %s failed (%s), retry', prefix, value, e)
                page.evaluate('sExportClose()'); page.wait_for_timeout(10000); continue
            msg = page.evaluate('sExportMsg()')
            page.evaluate('sExportClose()')
            enc = 'utf-16' if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else 'utf-8-sig'
            rows = list(csv.DictReader(io.StringIO(raw.decode(enc))))
            m = re.search(r'(\d+) rows', msg or '')
            if m and int(m.group(1)) != len(rows):
                log.warning('export %s: DMS said %s rows, file has %d - retry', value, m.group(1), len(rows))
                page.wait_for_timeout(30000); continue
            # Siebel deletes the previous export file when the next starts; give it time
            page.wait_for_timeout(45000 if len(rows) > 8000 else 15000)
            return rows
        m = re.fullmatch(r'([0-9A-Z]+)\*', value)
        if m:   # too big / kept failing: split into 10 smaller chunks + the rest
            log.warning('splitting %s', value)
            out = []
            for q in [f'{m.group(1)}{d}*' for d in '0123456789'] + [f'>="{m.group(1)}9~" AND <"{m.group(1)}~"', f'>="{m.group(1)}" AND <"{m.group(1)}0"']:
                out += self.export(page, prefix, field, q, tries=2)
            return out
        raise RuntimeError(f'export failed: {prefix} {value}')

    # ---------- sync ----------
    def run(self, full=False, report=None):
        rep = report or Report(self.name)
        first = not self.parts or full
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            br = p.chromium.launch(headless=env('HERO_DMS_HEADFUL', '') == '')
            page = br.new_context(accept_downloads=True, viewport={'width': 1500, 'height': 900}).new_page()
            page.set_default_timeout(120000)
            try:
                self.login(page)
                # 1) all products
                self.goto(page, PRODUCT_VIEW)
                prod = {}
                for q in PRODUCT_CHUNKS:
                    rows = self.export(page, 'Products List', 'Part__', q)
                    log.info('products %s: %d', q, len(rows))
                    for r in rows:
                        pn = (r.get('Part Number') or '').strip()
                        if pn:
                            prod[pn] = {'name': (r.get('Part Description') or r.get('Name') or '').strip(), 'hsn': (r.get('HSN') or '').strip(),
                                        'group': (r.get(' Part Group') or r.get('Part Group') or '').strip(),
                                        'active': (r.get('Active Flag') or '').strip(), 'sup': (r.get('Superceeded By') or '').strip()}
                had = sum(1 for d in self.parts.values() if d.get('active')) or len(self.parts)   # parts that came from the product list
                if len(prod) < 0.9 * had:
                    raise RuntimeError(f'only {len(prod)} products exported (last time {had}) - stopping, nothing changed')
                # 2) every MRP line (the DMS list can't be filtered by date, so all of it, in chunks)
                self.open_mrp(page)
                mrp_rows = []
                for q in MRP_CHUNKS:
                    rows = self.export(page, 'Price List Line Items', 'Part__', q)
                    log.info('mrp %s: %d', q, len(rows)); mrp_rows += rows
                if len({(r.get('Part #') or '').strip() for r in mrp_rows}) < 0.9 * sum(1 for d in self.parts.values() if d.get('mrp') is not None):
                    raise RuntimeError(f'MRP export looks incomplete ({len(mrp_rows)} rows) - stopping, nothing changed')
                # 3) models of new parts
                new_parts = [pn for pn in prod if pn not in self.parts] if self.parts else []
                fit = {}
                if new_parts:
                    self.goto(page, PRODUCT_VIEW)
                    for i in range(0, len(new_parts), 200):
                        fit.update(page.evaluate('ps => sModels(ps)', new_parts[i:i + 200]))
            finally:
                br.close()
        return self.merge(rep, prod, mrp_rows, fit, new_parts, first)

    def merge(self, rep, prod, mrp_rows, fit, new_parts, first):
        old = self.parts
        latest = {}
        for r in mrp_rows:
            pn = (r.get('Part #') or '').strip()
            if not pn or (r.get('Effective To') or '').strip():
                continue
            ef = (r.get('Effective From') or '').strip()
            if pn not in latest or ddate(ef) >= ddate(latest[pn][1]):
                latest[pn] = (money(r.get('MRP')), ef)
        changes, sup_new, closed = [], [], []
        parts = {}
        for pn, d in prod.items():
            o = old.get(pn, {})
            rec = {**d, 'mrp': o.get('mrp'), 'eff_from': o.get('eff_from', ''), 'models': o.get('models', [])}
            if pn in latest:
                m, ef = latest[pn]
                if rec['mrp'] != m and m is not None:
                    changes.append({'part_no': pn, 'old_mrp': rec['mrp'], 'new_mrp': m, 'effective_from': ef, 'name': d['name']})
                rec['mrp'], rec['eff_from'] = m, ef
            if pn in fit: rec['models'] = fit[pn]
            if o and d['sup'] and d['sup'] != o.get('sup'):
                sup_new.append((pn, o.get('sup', ''), d['sup']))
            if o and o.get('active') == 'Y' and d['active'] != 'Y':
                closed.append(pn)
            parts[pn] = rec
        for pn in set(latest) - set(prod):          # priced but missing in product master
            m, ef = latest[pn]
            o = old.get(pn, {})
            if o.get('mrp') != m:
                changes.append({'part_no': pn, 'old_mrp': o.get('mrp'), 'new_mrp': m, 'effective_from': ef, 'name': o.get('name', '')})
            parts[pn] = {**o, 'mrp': m, 'eff_from': ef}
        seen = set(self.state.get('models_seen') or [])
        new_models = {}
        for pn in new_parts:
            for m in parts.get(pn, {}).get('models', []):
                if m not in seen: new_models.setdefault(m, []).append(pn)
        if not first:
            for pn in new_parts: rep.add('Naye part number', f"{pn}  {parts[pn]['name']}  MRP {parts[pn].get('mrp')}  {', '.join(parts[pn].get('models', [])[:6])}")
            for c in changes: rep.add('MRP badla', f"{c['part_no']}: {c['old_mrp']} -> {c['new_mrp']} ({c['effective_from']})")
            for a, b, c in sup_new: rep.add('Naya superseded', f'{a} -> {c}' + (f' (pehle {b})' if b else ''))
            for pn in closed: rep.add('Band hua (inactive)', pn)
            for m, ps in new_models.items(): rep.add('Naya model (DMS)', f'{m}: {len(ps)} naye parts')
        self.parts = parts
        save_json(self.parts_path, parts)
        self.state['models_seen'] = sorted(seen | {m for d in parts.values() for m in d.get('models', [])})
        self.state['last_run'] = today()
        save_json(self.state_path, self.state)
        self.write_files(changes, new_parts, sup_new, closed, new_models)
        self.push(changes)
        return rep, []

    def check_part(self, pn):
        """Live MRP of one part straight from the DMS (logs in, about 1 minute). Updates parts.json."""
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            br = p.chromium.launch(headless=env('HERO_DMS_HEADFUL', '') == '')
            page = br.new_context(viewport={'width': 1500, 'height': 900}).new_page()
            try:
                self.login(page); self.open_mrp(page)
                page.evaluate('([p,f,v]) => sQuery(p,f,v)', ['Price List Line Items', 'Part__', pn])
                rows = page.evaluate("""() => (rs('Price List Item Applet (new)')||[]).map(x=>({part:x['Part #'],mrp:x['MSRP Price'],
                    start:x['Start Date'],end:x['End Date'],hsn:x['HMCL HSN'],name:x['Product Name']}))""")
            finally:
                br.close()
        live = [r for r in rows if r['part'] == pn and not r['end']]
        if not live:
            return None
        r = live[0]
        ef = datetime.datetime.strptime(r['start'][:10], '%m/%d/%Y').strftime('%d/%m/%Y')   # grid shows mm/dd/yyyy
        rec = self.parts.setdefault(pn, {'name': r['name'].rsplit('-' + pn, 1)[0], 'hsn': r['hsn'], 'group': '', 'active': '', 'sup': '', 'models': []})
        rec['mrp'], rec['eff_from'] = money(r['mrp']), ef
        save_json(self.parts_path, self.parts)
        return {'part_no': pn, 'mrp': rec['mrp'], 'effective_from': ef, 'name': rec['name']}

    # ---------- outputs ----------
    def write_files(self, changes, new_parts, sup_new, closed, new_models):
        import openpyxl
        from openpyxl.styles import Font, PatternFill
        P = self.parts
        def nd(p): return re.sub('[^A-Z0-9]', '', p.upper())
        with open(os.path.join(self.out, 'Hero_DMS_Parts.csv'), 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f); w.writerow(['part_no', 'name', 'mrp', 'mrp_from', 'hsn', 'group', 'active', 'superseded_by', 'models'])
            for pn in sorted(P):
                d = P[pn]; w.writerow([pn, d.get('name', ''), d.get('mrp'), d.get('eff_from', ''), d.get('hsn', ''), d.get('group', ''),
                                       d.get('active', ''), d.get('sup', ''), ' | '.join(d.get('models', []))])
        with open(os.path.join(self.out, f'mrp_changes_{today()}.csv'), 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f); w.writerow(['part_no', 'old_mrp', 'new_mrp', 'effective_from', 'name'])
            for c in changes: w.writerow([c['part_no'], c['old_mrp'], c['new_mrp'], c['effective_from'], c['name']])
        wb = openpyxl.Workbook()
        def sheet(title, cols, rows, first=False):
            ws = wb.active if first else wb.create_sheet(title); ws.title = title; ws.append(cols)
            for c in ws[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='C00000')
            for r in rows: ws.append(list(r))
            ws.freeze_panes = 'A2'
            for i in range(len(cols)): ws.column_dimensions[chr(65 + i)].width = 18 if i != 1 else 36
        g = lambda pn, k, d='': P.get(pn, {}).get(k, d)
        sheet('Naye Parts', ['Part No', 'Naam', 'MRP', 'Models', 'HSN', 'Group'],
              [(pn, g(pn, 'name'), g(pn, 'mrp'), ' | '.join(g(pn, 'models', [])), g(pn, 'hsn'), g(pn, 'group')) for pn in sorted(new_parts)], True)
        sheet('MRP Badla', ['Part No', 'Naam', 'Purana MRP', 'Naya MRP', 'Kab se'],
              [(c['part_no'], c['name'], c['old_mrp'], c['new_mrp'], c['effective_from']) for c in changes])
        sheet('Naye Superseded', ['Purana Part No', 'Pehle kis pe tha', 'Ab naya Part No', 'Naya MRP'], [(a, b, c, g(c, 'mrp')) for a, b, c in sup_new])
        sheet('Band Hue', ['Part No', 'Naam'], [(pn, g(pn, 'name')) for pn in closed])
        sheet('Naye Models', ['Model', 'Naye parts', 'Part numbers'], [(m, len(ps), ', '.join(ps)) for m, ps in sorted(new_models.items())])
        sup = {pn: d['sup'] for pn, d in P.items() if d.get('sup')}
        def final(p):
            seen = set()
            while p in sup and p not in seen: seen.add(p); p = sup[p]
            return p
        sheet('Purana -> Naya (sab)', ['Purana Part No', 'Bina dash', 'Purana Naam', 'Purana MRP', 'Naya Part No', 'Naya Naam', 'Naya MRP', 'Final Part No', 'Final MRP'],
              [(o, nd(o), g(o, 'name'), g(o, 'mrp'), n, g(n, 'name'), g(n, 'mrp'), final(o), g(final(o), 'mrp')) for o, n in sorted(sup.items())])
        rev = {}
        for o, n in sup.items(): rev.setdefault(n, []).append(o)
        sheet('Naya -> Purane (sab)', ['Naya Part No', 'Naam', 'MRP', 'Kitne purane', 'Saare purane numbers'],
              [(n, g(n, 'name'), g(n, 'mrp'), len(os_), ', '.join(sorted(os_))) for n, os_ in sorted(rev.items())])
        wb.save(os.path.join(self.out, f'Hero_DMS_Report_{today()}.xlsx'))

    def push(self, changes):
        url = env('HERO_MRP_WEBHOOK')
        if not url or not changes:
            return
        import requests
        h = {'Content-Type': 'application/json'}
        if env('HERO_MRP_WEBHOOK_TOKEN'): h['Authorization'] = 'Bearer ' + env('HERO_MRP_WEBHOOK_TOKEN')
        for i in range(0, len(changes), 2000):
            r = requests.post(url, headers=h, timeout=120, data=json.dumps({'source': 'hero_dms', 'date': today(), 'changes': changes[i:i + 2000]}))
            log.info('webhook %s: HTTP %s', url, r.status_code)
