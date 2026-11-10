"""Bajaj EPC (epc.gladminds.co). KTM, Husqvarna and 3-wheelers are in this EPC too but are skipped (Sam takes KTM from pymidol).

Login: plain form POST to / with username + password (no OTP/captcha as of Oct 2026).
Data:  Tastypie JSON API under /v1/ (only after login):
  sku-details-custom  every SKU (sku_code, sku_description, brand.brand_name, brand.brand_vertical.name)
  bom-headers         BOM per SKU (id, sku_code, bom_number, valid_from, modified_date, revision_number)
  bom-plate-parts     ?bom=<id>  every part line of a BOM with its plate (diagram) and image links
Change check: a BOM is re-downloaded when it is new, its header changed, or its part-line count changed.
Also: hidden BOMs (BOM without a SKU in the site tree) are included. EPC has no MRP, so no price column.
old <-> new part numbers -> output/Bajaj/Bajaj_Purana_Naya.xlsx (EPC: same diagram, old line ends the day the new one starts).
"""
import os, re, hashlib, logging, datetime
from common import Http, env, data_dir, load_json, save_json, today, Report

log = logging.getLogger('brand_sync.bajaj')
BASE = 'https://epc.gladminds.co'
SKIP_VERTICALS = {'Commercial Vehicle', 'KTM', 'Husqvarna'}   # no 3-wheelers; KTM/Husqvarna come from another source
# BOM-only SKUs (not in sku-details) with these prefixes are KTM or 3-wheeler BOMs (checked 23 Oct 2026)
SKIP_SKU_PREFIX = ('00JG', '00JP', '00JU', '00JY', '00A', '00B', '00RA')


class Bajaj:
    name = 'Bajaj'
    price_label = 'Bajaj EPC me MRP nahi hota'

    def __init__(self):
        self.dir = data_dir('bajaj')
        self.http = Http(env('BAJAJ_EPC_URL', BASE))
        self.state_path = os.path.join(self.dir, 'state.json')
        self.state = load_json(self.state_path, {'skus': {}, 'boms': {}})
        self.seed_cur, self.seed_all = {}, set()
        seed = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'seed', 'bajaj', 'seed.json.gz')
        if not os.path.exists(self.state_path) and os.path.exists(seed):
            # 23 Oct 2026 full EPC download: the first run downloads everything again (for PDFs and diagrams)
            # but reports only what changed after 23 Oct
            import gzip, json
            sd = json.load(gzip.open(seed, 'rt', encoding='utf-8'))
            self.state, self.seed_cur, self.seed_all = sd['state'], sd['cur'], set(sd['all'])

    # ---------- login + API ----------
    def login(self):
        user = env('BAJAJ_EPC_USER', required=True)
        pw = env('BAJAJ_EPC_PASS', required=True)
        self.http.get('/')
        self.http.post('/', data={'username': user, 'password': pw, 'signIn': ''},
                       headers={'Referer': self.http.url('/')}, allow_redirects=True)
        # logged out, the catalogue pages redirect to /?next=... (the login form); logged in they open
        r = self.http.get('/verticals/1/models/', allow_redirects=True)
        if 'next=' in r.url or 'name="password"' in r.text:
            raise SystemExit('Bajaj EPC login failed: check BAJAJ_EPC_USER / BAJAJ_EPC_PASS in .env')
        log.info('Bajaj EPC login ok')

    def api_all(self, resource, params='', page=200):
        out, off, total = [], 0, None
        while total is None or off < total:
            r = self.http.get(f'/v1/{resource}/?format=json&limit={page}&offset={off}{params}')
            r.raise_for_status()
            j = r.json()
            total = j['meta']['total_count']
            out += j['objects']
            off += page
        return out

    def count(self, resource, params=''):
        r = self.http.get(f'/v1/{resource}/?format=json&limit=1{params}')
        r.raise_for_status()
        return r.json()['meta']['total_count']

    # ---------- sync ----------
    def skus(self):
        out = {}
        for s in self.api_all('sku-details-custom'):
            b = s.get('brand') or {}
            if not isinstance(b, dict): b = {'brand_name': str(b)}
            v = b.get('brand_vertical') or {}
            code = str(s.get('sku_code') or '').strip()
            if not code: continue                          # 17w: the EPC sometimes sends a SKU with no code or empty fields
            out[code] = {
                'desc': str(s.get('sku_description') or '').strip(),
                'brand': str(b.get('brand_name') or '').strip(),
                'vertical': str((v.get('name') if isinstance(v, dict) else v) or '').strip(),
                'image': s.get('image_url') or ''}
        return out

    def bom_parts(self, bom_id):
        rows = []
        for o in self.api_all('bom-plate-parts', f'&bom={bom_id}'):
            p, pt = o.get('plate') or {}, o.get('part') or {}
            rows.append({'plate_id': str(p.get('plate_id') or '0'), 'plate': (p.get('plate_txt') or '').strip(),
                         'img': p.get('plate_image_with_part') or p.get('plate_image') or '',
                         'item': o.get('item') or '', 'pn': (pt.get('part_number') or '').strip(),
                         'desc': (pt.get('description') or o.get('material_description') or '').strip(),
                         'qty': str(o.get('quantity') or '').strip(), 'valid_from': o.get('valid_from') or '',
                         'valid_to': o.get('valid_to') or '9999-12-31', 'status': o.get('status') or '',
                         'kit': bool(pt.get('kit_part_tag'))})
        return rows

    # ---------- diagram numbers (18u) ----------
    # The API has no diagram number (item = line no., serial_number empty). The site shows it on each diagram's page /plates/<page id>/sbom:
    # S.No. | (hidden id) | Part No | Description | Qty, S.No. = the number printed on the diagram (Sam 10 Nov: page 21224, 2 = KADD0622).
    # The page id is the site's own (not the API plate id); each page says its BOM and plate in hidden fields bom_id / plate_id.
    # Pages are found from the model pages /sub-models/<id>/plates/ (ids from the API lists sub-brand-models + list-models).
    @staticmethod
    def parse_sbom(html):
        """(bom_id, plate_id, [(sno, pn)], bom_number) of one diagram page, or None when it is not one."""
        def hid(name):
            for tag in re.findall(r'<input\b[^>]*>', html, re.I):
                if re.search(r'\b(?:id|name)=["\']' + name + r'["\']', tag):
                    m = re.search(r'\bvalue=["\']([^"\']*)["\']', tag)
                    if m and m.group(1).strip():
                        return m.group(1).strip()
            return None
        bid, pid = hid('bom_id'), hid('plate_id')
        i = html.find('S.No')
        if not bid or not pid or i < 0:
            return None
        j = html.find('</table>', i)
        out = []
        for tr in re.findall(r'<tr\b.*?</tr>', html[i:j if j > 0 else None], re.S | re.I):
            cells = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', c)).strip() for c in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>', tr, re.S | re.I)]
            if len(cells) >= 3 and re.fullmatch(r'\d{1,3}[A-Z]?', cells[0], re.I) and cells[2]:
                out.append((cells[0].upper(), cells[2].upper()))
        return bid, pid, out, hid('bom_number') or ''

    def sn_scan(self, refresh_boms=()):
        """Reads the diagram pages into sbom.json {page id: [bom_id, plate_id, [[sno, pn]]]}: new pages, and again those of BOMs in refresh_boms."""
        path = os.path.join(self.dir, 'sbom.json')
        pages = load_json(path, {})
        if not isinstance(next(iter(pages.values()), []), list):
            pages = {}   # 18u first try kept another shape
        refresh = {str(x) for x in refresh_boms}
        sms = set()
        for res in ('sub-brand-models', 'list-models'):
            try:
                sms |= {str(o['id']) for o in self.api_all(res) if o.get('id') is not None}
            except Exception as e:
                log.warning('%s: %s', res, e)
        links = set()
        for k, sm in enumerate(sorted(sms, key=lambda x: int(x) if x.isdigit() else 0), 1):
            try:
                h = self.http.get(f'/sub-models/{sm}/plates/').text
            except Exception as e:
                log.warning('model page %s: %s', sm, e); continue
            links |= set(re.findall(r'/plates/(\d+)/sbom', h))
            if k % 50 == 0:
                log.info('model pages %d/%d, %d diagram pages', k, len(sms), len(links))
        # newest pages first (current models), and every 1000 pages the numbers go into the BOMs so the app shows them while the rest is read
        todo = [p for p in sorted(links, key=int, reverse=True) if p not in pages or pages[p][0] in refresh]
        log.info('%d model pages, %d diagram pages, %d to read', len(sms), len(links), len(todo))
        for k, pg in enumerate(todo, 1):
            try:
                r = self.http.get(f'/plates/{pg}/sbom')
            except Exception as e:
                log.warning('diagram page %s: %s', pg, e); continue
            x = self.parse_sbom(r.text) if r.status_code == 200 else None
            if x and x[2]:
                pages[pg] = [x[0], x[1], [list(t) for t in x[2]], x[3]]
            if k % 200 == 0 or k == len(todo):
                save_json(path, pages); log.info('diagram pages %d/%d', k, len(todo))
            if k % 1000 == 0 and k < len(todo) and self.sn_apply(pages)[0]:
                self.state['sn_run'] = today(); save_json(self.state_path, self.state)   # the server rebuilds the Bajaj catalogue
        save_json(path, pages)
        return pages

    def sn_apply(self, pages=None):
        """Every saved BOM line gets sn = its diagram number ('' when the site has none). Returns (BOMs changed, lines with a number)."""
        pages = pages if pages is not None else load_json(os.path.join(self.dir, 'sbom.json'), {})
        idx, num = {}, {}
        for b, p, sn, *bn in pages.values():
            idx.setdefault((str(b), str(p)), []).extend(sn)
            if bn and bn[0]:
                num.setdefault((bn[0].strip().lstrip('0'), str(p)), []).extend(sn)
        nb = nl = 0
        for bid, st, d in self.saved_boms():
            by, ch = {}, False
            bnum = str((d.get('header') or {}).get('bom_number') or '').strip().lstrip('0')
            for r in d['rows']:
                by.setdefault(r['plate_id'], []).append(r)
            for pl, rs in by.items():
                left = {}
                for sno, pn in idx.get((bid, pl)) or num.get((bnum, pl), []):   # the page's bom_id is the API's BOM id; its BOM number as a second way
                    left.setdefault(pn, []).append(sno)
                last = {}
                for r in sorted(rs, key=lambda r: (int(r['item']) if str(r['item']).isdigit() else 10 ** 9, str(r['item']))):
                    pn = (r['pn'] or '').upper()
                    q = left.get(pn)
                    if q:
                        last[pn] = q.pop(0)
                    v = last.get(pn, '')
                    nl += bool(v)
                    if r.get('sn', None) != v:
                        r['sn'] = v; ch = True
            if ch:
                save_json(self.bom_path(bid), d); nb += 1
        log.info('diagram numbers: %d BOMs changed, %d lines have one', nb, nl)
        return nb, nl

    def fill_sn(self):
        """sync.py bajaj --sn: read all diagram pages once (resumable: pages already read are kept) and put the numbers in the saved BOMs."""
        self.login()
        nb, nl = self.sn_apply(self.sn_scan())
        if nb:   # the server rebuilds the Bajaj catalogue when state.json changes
            self.state['sn_run'] = today(); save_json(self.state_path, self.state)
        return nl

    @staticmethod
    def skip(sku_code, s):
        if s:
            return s['vertical'] in SKIP_VERTICALS
        return sku_code.startswith(SKIP_SKU_PREFIX)

    def run(self, full=False, report=None):
        rep = report or Report(self.name)
        self.login()
        skus = self.skus()
        old_skus = self.state['skus']
        for code, s in skus.items():
            if s['vertical'] in SKIP_VERTICALS:
                continue
            if code not in old_skus and old_skus:
                rep.add('Naye SKU / model', f"{s['brand']} - {s['desc'] or '(EPC me naam nahi)'} [{code}]")
            elif old_skus and old_skus[code].get('desc') != s['desc']:
                rep.add('Naam badla', f"[{code}] {old_skus[code].get('desc')} -> {s['desc']}")
        for code in set(old_skus) - set(skus):
            rep.add('EPC se hata', f"{old_skus[code].get('desc')} [{code}]")

        headers = self.api_all('bom-headers')
        changed = []
        for h in headers:
            s = skus.get(h['sku_code'].strip())
            if self.skip(h['sku_code'].strip(), s):
                continue
            bid = str(h['id'])
            sig = f"{h.get('modified_date')}|{h.get('revision_number')}|{h.get('valid_to')}"
            n = self.count('bom-plate-parts', f'&bom={bid}')
            old = self.state['boms'].get(bid)
            if full or not old or old['sig'] != sig or old['n'] != n or not os.path.exists(self.bom_path(bid)):
                changed.append((h, sig, n, old))
        log.info('%d BOMs to download', len(changed))
        known = self.all_part_numbers() or self.seed_all

        for k, (h, sig, n, old) in enumerate(changed, 1):
            bid = str(h['id'])
            if k == 1 or k % 20 == 0 or k == len(changed):
                log.info('BOM %d/%d', k, len(changed))   # 17x: show progress on long first runs
            rows = self.bom_parts(bid)
            prev = load_json(self.bom_path(bid), {}).get('rows', [])
            save_json(self.bom_path(bid), {'header': h, 'rows': rows, 'fetched': today()})
            self.state['boms'][bid] = {'sig': sig, 'n': n, 'sku': h['sku_code'].strip()}
            label = self.label(skus.get(h['sku_code'].strip()), h)
            if not old:
                if self.state['skus']:
                    rep.add('Naye BOM', f'{label}: {len(rows)} part lines')
            else:
                a = self.current_set(prev) if prev else set(self.seed_cur.get(bid, []))
                b = self.current_set(rows)
                added, gone = sorted(b - a), sorted(a - b)
                if added or gone:
                    rep.add('Parts badle', f"{label}: +{len(added)} naye, -{len(gone)} hataye"
                            + (f" (naye: {', '.join(added[:8])}{'...' if len(added) > 8 else ''})" if added else ''))
            self.download_images(rows)
        try:   # 18u: diagram numbers for new diagram pages and changed BOMs
            self.sn_apply(self.sn_scan([h['id'] for h, *_ in changed]))
        except Exception as e:
            log.warning('diagram numbers: %s', e)
        if known:
            for pn in sorted(self.all_part_numbers() - known)[:500]:
                rep.add('Naye part number (EPC)', pn)
        pairs = self.oldnew()
        seen = set(map(tuple, self.state.get('pairs', [])))
        if self.state.get('pairs') is not None:
            for o, n, how in pairs:
                if (o, n) not in seen:
                    rep.add('Naya purana -> naya', f'{o} -> {n} ({how})')
        self.state['pairs'] = [[o, n] for o, n, _ in pairs]
        desc = {}
        for _, _, d in self.saved_boms():
            for r in d['rows']:
                if r['pn'] and r['desc']:
                    desc[r['pn']] = r['desc']
        n = self.write_oldnew_xlsx(os.path.join(data_dir('output', 'Bajaj'), 'Bajaj_Purana_Naya.xlsx'), desc)
        log.info('old <-> new pairs: %d', n)
        self.state['skus'] = {k: {'desc': v['desc'], 'brand': v['brand'], 'vertical': v['vertical']} for k, v in skus.items()}
        self.state['last_run'] = today()
        save_json(self.state_path, self.state)
        save_json(os.path.join(self.dir, 'skus.json'), skus)
        return rep, [str(h['id']) for h, *_ in changed]

    # ---------- helpers ----------
    def bom_path(self, bid):
        return os.path.join(data_dir('bajaj', 'boms'), f'{bid}.json')

    @staticmethod
    def current(rows):
        """Lines valid today; one line per (plate, item, part no), newest wins."""
        t = today(); best = {}
        for r in rows:
            if r['valid_to'] < t or r['status'] == 'DELETED':
                continue
            k = (r['plate_id'], r['item'], r['pn'])
            if k not in best or r['valid_from'] > best[k]['valid_from']:
                best[k] = r
        return list(best.values())

    def current_set(self, rows):
        return {r['pn'] for r in self.current(rows) if r['pn']}

    @staticmethod
    def label(s, h):
        return f"{(s or {}).get('desc') or 'SKU'} [{h['sku_code'].strip()}]"

    def img_path(self, url):
        return os.path.join(data_dir('bajaj', 'img'), hashlib.sha1(url.encode()).hexdigest()[:16] + os.path.splitext(url.split('?')[0])[1].lower()[:5])

    def download_images(self, rows):
        for url in {r['img'] for r in rows if r['img']}:
            f = self.img_path(url)
            if os.path.exists(f) or os.path.exists(f + '.missing'):
                continue
            try:
                r = self.http.s.get(url, timeout=60)
                if r.status_code == 200 and r.content:
                    open(f, 'wb').write(r.content)
                else:
                    open(f + '.missing', 'w').write(str(r.status_code))   # e.g. 403 = file not on Bajaj's server
            except Exception as e:
                log.warning('image %s: %s', url, e)

    # ---------- old <-> new ----------
    def saved_boms(self):
        for bid, st in self.state['boms'].items():
            d = load_json(self.bom_path(bid), None)
            if d:
                yield bid, st, d

    def all_part_numbers(self):
        skus = load_json(os.path.join(self.dir, 'skus.json'), {})
        return {r['pn'] for bid, st, d in self.saved_boms() if not self.skip(st['sku'], skus.get(st['sku']))
                for r in d['rows'] if r['pn']}

    def oldnew(self):
        """[(old, new, how)]: same BOM + diagram, the old line ends the day the new line starts and the
        names share a word. EPC has no official supersession list, so check before relying on it."""
        skus = load_json(os.path.join(self.dir, 'skus.json'), {})
        out = {}
        def nxt(x):
            try: return (datetime.date.fromisoformat(x[:10]) + datetime.timedelta(days=1)).isoformat()
            except ValueError: return None
        def words(t): return set(re.findall(r'[A-Z]{3,}', (t or '').upper()))
        t = today()
        for bid, st, d in self.saved_boms():
            if self.skip(st['sku'], skus.get(st['sku'])):
                continue
            by_plate = {}
            for r in d['rows']:
                by_plate.setdefault(r['plate_id'], []).append(r)
            for rows in by_plate.values():
                for r in rows:
                    vt = (r['valid_to'] or '')[:10]
                    if not r['pn'] or vt >= t or vt < '1990':
                        continue
                    for r2 in rows:
                        if r2['pn'] and r2['pn'] != r['pn'] and (r2['valid_from'] or '')[:10] in (vt, nxt(vt)) \
                                and words(r['desc']) & words(r2['desc']):
                            out.setdefault((r['pn'], r2['pn']), 'Achha (EPC: same diagram, same din)')
        return sorted((o, n, how) for (o, n), how in out.items())

    def write_oldnew_xlsx(self, path, desc):
        import openpyxl
        pairs = self.oldnew()
        new_of = {}
        for o, n, how in pairs:
            new_of.setdefault(o, []).append(n)
        def final(p, seen=()):
            nx = new_of.get(p)
            if not nx or p in seen or len(seen) > 10:
                return p
            return final(sorted(nx)[0], seen + (p,))
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Purana -> Naya'
        ws.append(['Purana Part No', 'Naam', 'Naya Part No', 'Naam', 'Final (aakhri) Part No', 'Kaise pata chala'])
        for o, n, how in pairs:
            ws.append([o, desc.get(o, ''), n, desc.get(n, ''), final(n), how])
        ws2 = wb.create_sheet('Naya -> Purane')
        ws2.append(['Naya Part No', 'Naam', 'Purane Part Nos'])
        old_of = {}
        for o, n, _ in pairs:
            old_of.setdefault(n, set()).add(o)
        for n in sorted(old_of):
            ws2.append([n, desc.get(n, ''), ', '.join(sorted(old_of[n]))])
        for w in (ws, ws2):
            w.freeze_panes = 'A2'
            for col, wd in zip('ABCDEF', (14, 34, 14, 34, 16, 34)):
                w.column_dimensions[col].width = wd
        wb.save(path)
        return len(pairs)

    # ---------- data for the PDF / Excel builders ----------
    def variants(self):
        """Yield one dict per BOM in the generic shape used by builders.py."""
        skus = load_json(os.path.join(self.dir, 'skus.json'), {})
        for bid, st in sorted(self.state['boms'].items(), key=lambda kv: int(kv[0])):
            d = load_json(self.bom_path(bid), None)
            if not d:
                continue
            h, s = d['header'], skus.get(st['sku'], {})
            if self.skip(st['sku'], s or None):
                continue
            rows = self.current(d['rows'])
            if not rows:
                continue
            plates = {}
            for r in sorted(rows, key=lambda r: r['item']):
                p = plates.setdefault(r['plate_id'], {'title': r['plate'], 'img': r['img'], 'rows': []})
                p['rows'].append({'sn': r['item'].lstrip('0') or '0', 'pn': r['pn'], 'desc': r['desc'], 'qty': r['qty'].strip()})
            def pkey(k):
                return [(0, int(t)) if t.isdigit() else (1, t) for t in re.split(r'(\d+)', k) if t]
            pl = []
            for pid in sorted(plates, key=pkey):
                p = plates[pid]
                img = self.img_path(p['img']) if p['img'] else ''
                pl.append({'title': f"{pid} - {p['title']}" if p['title'] else 'All parts (EPC me diagram nahi)',
                           'img': img if img and os.path.exists(img) else '', 'rows': p['rows']})
            vf = h.get('valid_from') or ''
            yield {'brand': 'Bajaj', 'family': s.get('brand') or 'Unnamed SKU',
                   'model': s.get('brand') or 'Unnamed SKU', 'variant': s.get('desc') or f"SKU {st['sku']}",
                   'sku': st['sku'], 'bom': h.get('bom_number', ''), 'mfg': vf[:7], 'vertical': s.get('vertical', ''),
                   'plates': pl, 'key': bid}
