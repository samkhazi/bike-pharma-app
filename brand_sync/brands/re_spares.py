"""Royal Enfield spares store (spares.royalenfield.com, public, no login) - weekly, India & SAARC.

The dealer EPC (royal_enfield.py) answers this server 403, so the weekly RE update comes from RE's own public store:
  robots.txt is read first; if it does not allow us, nothing is fetched and the report says so.
  GraphQL categoryList     -> the model categories (same names as the EPC models, e.g. "ALL NEW CLASSIC 350 - CHROME BRONZE")
  products per category    -> part no., name, MRP (regular price) of every part sold for that model
  products of the root, sorted by price both ways -> parts in no model category (a query stops at 10,000)
Our real name is sent (BikePharmaSync), requests are slow and one at a time. Only MRP is kept.
lib/rebuild.mjs reads data/re_spares/state.json: MRP, new parts under their model, new model categories as new models.
"""
import re, logging, urllib.robotparser
from common import Http, env, data_dir, load_json, save_json, today, Report

log = logging.getLogger('brand_sync.re_spares')
BASE = 'https://spares.royalenfield.com'
UA = 'BikePharmaSync/1.0 (bikepharma.com; weekly parts and MRP check)'
FIELDS = 'sku name price_range{minimum_price{regular_price{value}}}'


class RESpares:
    name = 'Royal Enfield spares'
    pdfs = False                 # data only: the Bike Pharma server builds the app catalogue from it

    def __init__(self):
        self.dir = data_dir('re_spares')
        self.state_path = self.dir + '/state.json'
        self.state = load_json(self.state_path, {'cats': {}, 'parts': {}})
        self.http = Http(env('RE_SPARES_BASE', BASE), delay=float(env('RE_SPARES_DELAY', '1')))
        self.http.s.headers['User-Agent'] = UA

    def allowed(self):
        r = self.http.get('/robots.txt')
        rp = urllib.robotparser.RobotFileParser(); rp.parse(r.text.splitlines() if r.status_code == 200 else [])
        return r.status_code in (200, 404) and rp.can_fetch(UA, BASE + '/graphql'), (r.text or '').strip()[:200]

    def gql(self, query, variables=None):
        r = self.http.post('/graphql', json={'query': query, 'variables': variables or {}}, headers={'Content-Type': 'application/json', 'Store': 'default'})
        if r.status_code != 200:
            raise RuntimeError(f'RE spares store: HTTP {r.status_code}')
        j = r.json()
        if j.get('errors'):
            raise RuntimeError('RE spares store: ' + str(j['errors'])[:300])
        return j['data']

    def products(self, uid, out, sort=None):
        for cp in range(1, 21):
            q = ('query($u:String!,$c:Int!' + (',$d:SortEnum!' if sort else '') + '){products(filter:{category_uid:{eq:$u}}'
                 + (',sort:{price:$d}' if sort else '') + f',pageSize:500,currentPage:$c){{page_info{{total_pages}} items{{{FIELDS}}}}}}}')
            p = self.gql(q, {'u': uid, 'c': cp, **({'d': sort} if sort else {})})['products']
            for it in p.get('items') or []:
                if it and it.get('sku'):
                    pr = ((it.get('price_range') or {}).get('minimum_price') or {}).get('regular_price') or {}
                    out[it['sku'].strip().upper()] = {'name': (it.get('name') or '').strip(), 'mrp': pr.get('value')}
            if cp >= min(20, (p.get('page_info') or {}).get('total_pages') or 1):
                break

    def run(self, full=False, report=None):
        rep = report or Report(self.name)
        ok, robots = self.allowed()
        if not ok:
            rep.add('Aaj kuch nahi liya', f'spares.royalenfield.com ki robots.txt abhi allow nahi karti: {robots}')
            return rep, []
        root = self.gql('{categoryList{uid name product_count children{uid name product_count}}}')['categoryList'][0]
        st, cats, parts = self.state, {}, {}
        for c in root.get('children') or []:
            got = {}
            self.products(c['uid'], got)
            cats[c['name'].strip()] = sorted(got)
            parts.update(got)
            log.info('RE spares %s: %d parts', c['name'], len(got))
        for d in ('ASC', 'DESC'):                    # parts in no model category
            self.products(root['uid'], parts, d)
        if len(parts) < 0.9 * (root.get('product_count') or 0) or (st['parts'] and len(parts) < 0.8 * len(st['parts'])):
            raise RuntimeError(f"RE spares store se sirf {len(parts)} parts aaye (store me {root.get('product_count')}, pichli baar {len(st['parts'])}) - kuch nahi badla")
        if st['parts']:
            for n in sorted(set(cats) - set(st['cats'])):
                rep.add('Naya model', f'{n} ({len(cats[n])} parts)')
            for n in sorted(set(st['cats']) - set(cats)):
                rep.add('Store se hata model', n)
            new = sorted(set(parts) - set(st['parts']))
            for pn in new[:500]:
                rep.add('Naya part number', f"{pn} {parts[pn]['name']} MRP {parts[pn]['mrp']}")
            ch = [(pn, st['parts'][pn]['mrp'], v['mrp'], v['name']) for pn, v in sorted(parts.items())
                  if pn in st['parts'] and v['mrp'] and st['parts'][pn].get('mrp') and abs(v['mrp'] - st['parts'][pn]['mrp']) >= 0.5]
            for pn, a, b, nm in ch[:300]:
                rep.add('MRP badla', f'{pn} {nm}: Rs {a:g} -> Rs {b:g}')
            gone = set(st['parts']) - set(parts)
            if gone: rep.add('Store se hata part', f'{len(gone)} parts')
        else:
            rep.add('Pehla run', f'{len(cats)} models, {len(parts)} parts, MRP ke saath (agli baar se sirf badlav)')
        st.update({'cats': cats, 'parts': parts, 'last_run': today()})
        save_json(self.state_path, st)
        return rep, []
