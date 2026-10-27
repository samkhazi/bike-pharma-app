"""Bajaj EPC (epc.gladminds.co). KTM and Husqvarna are in this EPC too but are skipped (Sam takes KTM from pymidol).

Login: plain form POST to / with username + password (no OTP/captcha as of Oct 2026).
Data:  Tastypie JSON API under /v1/ (only after login):
  sku-details-custom  every SKU (sku_code, sku_description, brand.brand_name, brand.brand_vertical.name)
  bom-headers         BOM per SKU (id, sku_code, bom_number, valid_from, modified_date, revision_number)
  bom-plate-parts     ?bom=<id>  every part line of a BOM with its plate (diagram) and image links
Change check: a BOM is re-downloaded when it is new, its header changed, or its part-line count changed.
"""
import os, re, hashlib, logging
from common import Http, env, data_dir, load_json, save_json, today, Report

log = logging.getLogger('brand_sync.bajaj')
BASE = 'https://epc.gladminds.co'
SKIP_VERTICALS = {'Commercial Vehicle', 'KTM', 'Husqvarna'}   # no 3-wheelers; KTM/Husqvarna come from another source


class Bajaj:
    name = 'Bajaj'

    def __init__(self):
        self.dir = data_dir('bajaj')
        self.http = Http(env('BAJAJ_EPC_URL', BASE))
        self.state_path = os.path.join(self.dir, 'state.json')
        self.state = load_json(self.state_path, {'skus': {}, 'boms': {}})

    # ---------- login + API ----------
    def login(self):
        user = env('BAJAJ_EPC_USER', required=True)
        pw = env('BAJAJ_EPC_PASS', required=True)
        self.http.get('/')
        self.http.post('/', data={'username': user, 'password': pw, 'signIn': ''},
                       headers={'Referer': self.http.url('/')}, allow_redirects=True)
        r = self.http.get('/v1/sku-details-custom/?limit=1&format=json')
        if r.status_code != 200 or not r.headers.get('content-type', '').startswith('application/json'):
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
            v = b.get('brand_vertical') or {}
            out[s['sku_code'].strip()] = {
                'desc': (s.get('sku_description') or '').strip(),
                'brand': (b.get('brand_name') or '').strip(),
                'vertical': (v.get('name') if isinstance(v, dict) else str(v or '')).strip(),
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
            if s and s['vertical'] in SKIP_VERTICALS:
                continue
            bid = str(h['id'])
            sig = f"{h.get('modified_date')}|{h.get('revision_number')}|{h.get('valid_to')}"
            n = self.count('bom-plate-parts', f'&bom={bid}')
            old = self.state['boms'].get(bid)
            if full or not old or old['sig'] != sig or old['n'] != n or not os.path.exists(self.bom_path(bid)):
                changed.append((h, sig, n, old))
        log.info('%d BOMs to download', len(changed))

        for h, sig, n, old in changed:
            bid = str(h['id'])
            rows = self.bom_parts(bid)
            prev = load_json(self.bom_path(bid), {}).get('rows', [])
            save_json(self.bom_path(bid), {'header': h, 'rows': rows, 'fetched': today()})
            self.state['boms'][bid] = {'sig': sig, 'n': n, 'sku': h['sku_code'].strip()}
            label = self.label(skus.get(h['sku_code'].strip()), h)
            if not old:
                if self.state['skus']:
                    rep.add('Naye BOM', f'{label}: {len(rows)} part lines')
            else:
                a, b = self.current_set(prev), self.current_set(rows)
                added, gone = sorted(b - a), sorted(a - b)
                if added or gone:
                    rep.add('Parts badle', f"{label}: +{len(added)} naye, -{len(gone)} hataye"
                            + (f" (naye: {', '.join(added[:8])}{'...' if len(added) > 8 else ''})" if added else ''))
            self.download_images(rows)
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

    # ---------- data for the PDF / Excel builders ----------
    def variants(self):
        """Yield one dict per BOM in the generic shape used by builders.py."""
        skus = load_json(os.path.join(self.dir, 'skus.json'), {})
        for bid, st in sorted(self.state['boms'].items(), key=lambda kv: int(kv[0])):
            d = load_json(self.bom_path(bid), None)
            if not d:
                continue
            h, s = d['header'], skus.get(st['sku'], {})
            if s.get('vertical') in SKIP_VERTICALS:
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
