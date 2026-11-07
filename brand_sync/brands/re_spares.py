"""Royal Enfield spares (spares.royalenfield.com, Magento GraphQL) - public, no login.

Reads per model: every part (SKU, name, MRP, stock, model + variant mapping, photos).
PDF per model + Excel of everything. Only reads, never touches cart/order.
"""
import os, re, json, time, collections, logging, threading
from concurrent.futures import ThreadPoolExecutor
import requests
from common import env, data_dir, load_json, save_json, today, Report

log = logging.getLogger('brand_sync.re_spares')
GQL = 'https://spares.royalenfield.com/graphql'
ASSET2 = 'https://spares-assets.royalenfield.com/assets/REProduction/'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36')
PAGE = 200
WORKERS = 16

QLIST = ('query GetCategories($id:Int!$pageSize:Int!$currentPage:Int!$filters:ProductAttributeFilterInput!$sort:ProductAttributeSortInput)'
         '{category(id:$id){id}products(pageSize:$pageSize currentPage:$currentPage filter:$filters sort:$sort){'
         'items{sku name url_key stock_status price_range{maximum_price{regular_price{value}}}}'
         'page_info{total_pages}total_count}}')
QDET = ('query getProductDetailForProductPage($urlKey:String!){products(filter:{url_key:{eq:$urlKey}}){items{'
        'sku name url_key stock_status description{html} how_to_use '
        'price{regularPrice{amount{value currency}}} product_images eps_images{imagePath} '
        'compatibility{parent child}}}}')


def safe(s):
    return re.sub(r'\s+', ' ', re.sub(r'[\\/:*?"<>|\x00-\x1f]+', '-', str(s or ''))).strip().rstrip('.')[:150]


def split_rev(pn):
    m = re.match(r'^(.+?)/([A-Z]{1,2})$', pn or '')
    return (m.group(1), m.group(2)) if m else (pn, '')


def revkey(r):
    return (len(r), r)


class Spares:
    name = 'Royal Enfield Spares'
    pdfs = False
    price_label = 'MRP (site)'

    def __init__(self):
        self.dir = data_dir('re_spares')
        self.state_path = os.path.join(self.dir, 'state.json')
        self.state = load_json(self.state_path, None) or {'parts': {}, 'mrp_log': [], 'gone': {}, 'new': {}}
        self.lock = threading.Lock()
        self.s = requests.Session()
        self.s.headers.update({'User-Agent': UA, 'Accept': 'application/json'})
        px = env('RE_SPARES_PROXY') or env('RE_EPC_PROXY') or ''
        if px:
            self.s.proxies = {'http': px, 'https': px}
        ad = requests.adapters.HTTPAdapter(pool_connections=WORKERS + 4,
                                            pool_maxsize=WORKERS + 4, max_retries=0)
        self.s.mount('https://', ad)
        self.s.mount('http://', ad)

    def gql(self, query, variables, op=None, tries=4):
        p = {'query': query, 'variables': json.dumps(variables)}
        if op:
            p['operationName'] = op
        for i in range(tries):
            try:
                r = self.s.get(GQL, params=p, timeout=120)
                if r.status_code == 200:
                    d = r.json()
                    if 'errors' not in d:
                        return d.get('data') or {}
                log.warning('gql %s HTTP %s %s', op, r.status_code, str(r.text)[:100])
            except Exception as e:
                log.warning('gql %s retry %s: %s', op, i + 1, str(e)[:100])
            time.sleep(3 * (i + 1))
        raise RuntimeError('graphql fail: ' + str(op))

    def models(self):
        f = os.path.join(self.dir, 'models.json')
        if not os.path.exists(f):
            raise SystemExit('data/re_spares/models.json nahi hai (gqlsetup.py chalao)')
        return json.load(open(f, encoding='utf-8'))

    def skus_for_model(self, cid):
        out, page = [], 1
        while True:
            d = self.gql(QLIST, {'id': int(cid), 'pageSize': PAGE, 'currentPage': page,
                                 'filters': {'category_id': {'eq': str(cid)}}, 'sort': {}}, 'GetCategories')
            pr = d.get('products') or {}
            for it in pr.get('items') or []:
                out.append((it['sku'], it.get('url_key') or ''))
            if page >= ((pr.get('page_info') or {}).get('total_pages') or 1):
                break
            page += 1
        return out

    def detail(self, url_key):
        d = self.gql(QDET, {'urlKey': url_key}, 'getProductDetailForProductPage')
        items = (d.get('products') or {}).get('items') or []
        return items[0] if items else None

    def img_urls(self, it):
        urls = []
        for e in it.get('eps_images') or []:
            p = e.get('imagePath') or ''
            if p:
                urls.append(p if p.startswith('http') else ASSET2 + p.lstrip('/'))
        raw = it.get('product_images')
        if isinstance(raw, str) and raw.startswith('{'):
            try:
                for v in json.loads(raw).values():
                    if v:
                        urls.append(v if v.startswith('http') else ASSET2 + v.lstrip('/'))
            except Exception:
                pass
        return list(dict.fromkeys(urls))

    def img_dir(self, sku):
        d = os.path.join(self.dir, 'img', safe(sku))
        os.makedirs(d, exist_ok=True)
        return d

    def fetch_img(self, sku, url, idx):
        f = os.path.join(self.img_dir(sku), str(idx) + '.png')
        if os.path.exists(f) and os.path.getsize(f) > 1000:
            return f
        try:
            r = self.s.get(url, timeout=120, stream=True)
            if r.status_code != 200:
                return None
            n = 0
            with open(f, 'wb') as fh:
                for ch in r.iter_content(65536):
                    n += len(ch)
                    if n > 12 * 1024 * 1024:
                        break
                    fh.write(ch)
            r.close()
            if n > 1000:
                try:
                    from PIL import Image as _I
                    im = _I.open(f)
                    im.thumbnail((110, 110))
                    im.convert('RGB').save(f[:-4] + '_t.jpg', 'JPEG', quality=70)
                    im.close()
                except Exception:
                    pass
                return f
        except Exception as e:
            log.warning('img %s: %s', url[:80], str(e)[:80])
        return None

    def run(self, full=False, report=None):
        rep = report or Report(self.name)
        st = self.state
        old = dict(st['parts'])
        models = self.models()
        log.info('RE spares: %d models', len(models))
        sku_models = collections.defaultdict(set)
        sku_variants = collections.defaultdict(set)
        urlkeys = {}
        for i, (cid, mname) in enumerate(models):
            try:
                rows = self.skus_for_model(cid)
            except Exception as e:
                log.warning('model %s fail: %s', mname, e)
                continue
            for sku, uk in rows:
                sku_models[sku].add(mname)
                if uk:
                    urlkeys.setdefault(sku, uk)
            log.info('RE spares %d/%d %s: %d parts', i + 1, len(models), mname, len(rows))
        skus = sorted(sku_models)
        log.info('RE spares: %d unique parts', len(skus))

        parts, affected = {}, set()
        CH = 100
        for c0 in range(0, len(skus), CH):
            chunk = skus[c0:c0 + CH]

            def work(sku):
                uk = urlkeys.get(sku)
                if not uk:
                    return sku, None
                try:
                    it = self.detail(uk)
                except Exception as e:
                    log.warning('detail %s: %s', sku, str(e)[:80])
                    return sku, None
                if it:
                    for c in it.get('compatibility') or []:
                        if c.get('parent'):
                            sku_models[sku].add(c['parent'])
                        if c.get('child'):
                            sku_variants[sku].add(c['child'])
                    it['compatibility'] = None
                return sku, it

            got = []
            with ThreadPoolExecutor(WORKERS) as ex:
                for sku, it in ex.map(work, chunk):
                    if it:
                        got.append((sku, it))
            for sku, it in got:
                price = (((it.get('price') or {}).get('regularPrice') or {}).get('amount') or {}).get('value')
                rec = {'name': it.get('name') or '', 'mrp': price, 'stock': it.get('stock_status') or '',
                       'models': sorted(sku_models[sku]), 'variants': sorted(sku_variants[sku]),
                       'imgs': [], 'how_to_use': (it.get('how_to_use') or '')[:800],
                       'desc': re.sub('<[^>]+>', ' ', (it.get('description') or {}).get('html') or '')[:800].strip()}
                o = old.get(sku)
                if o is None:
                    if old:
                        st.setdefault('new', {})[sku] = today()
                        rep.add('Naya part', sku + ' ' + rec['name'] + ' (Rs ' + str(price) + ')')
                        affected.update(rec['models'])
                else:
                    if o.get('mrp') is not None and price is not None and abs(price - o['mrp']) >= 0.5:
                        st.setdefault('mrp_log', []).insert(0, {'part_no': sku, 'name': rec['name'],
                                                                'old_mrp': o['mrp'], 'new_mrp': price, 'date': today()})
                        rep.add('MRP badla', '%s %s: Rs %g -> Rs %g' % (sku, rec['name'], o['mrp'], price))
                        affected.update(rec['models'])
                    if o.get('stock') and rec['stock'] and o['stock'] != rec['stock']:
                        st.setdefault('stock_log', []).insert(0, {'part_no': sku, 'name': rec['name'],
                                                                  'old': o['stock'], 'new': rec['stock'], 'date': today()})
                        rep.add('Stock badla', '%s %s: %s -> %s' % (sku, rec['name'], o['stock'], rec['stock']))
                        affected.update(rec['models'])
                parts[sku] = rec

            jobs = []
            for sku, it in got:
                for n, u in enumerate(self.img_urls(it)[:2]):
                    jobs.append((sku, u, n))
            if jobs:
                with ThreadPoolExecutor(WORKERS) as ex:
                    list(ex.map(lambda j: self.fetch_img(*j), jobs))
            for sku, it in got:
                parts[sku]['imgs'] = sorted(f for f in os.listdir(self.img_dir(sku)) if f.endswith('.png'))
            got, it = None, None
            log.info('RE spares chunk %d-%d done', c0 + 1, c0 + len(chunk))

        groups = collections.defaultdict(list)
        for sku, rec in parts.items():
            groups[(tuple(rec['models']), tuple(rec['variants']))].append(sku)
        for g in groups.values():
            if 1 < len(g) <= 40:
                for sku in g:
                    parts[sku]['alt'] = [x for x in g if x != sku][:6]
        for rec in parts.values():
            rec.setdefault('alt', [])
        groups = None
        for sku in sorted(set(old) - set(parts)):
            st.setdefault('gone', {})[sku] = [today(), old[sku].get('name', '')]
            rep.add('Site se hata part', sku + ' ' + old[sku].get('name', ''))
        for sku in parts:
            st.get('gone', {}).pop(sku, None)
        st['mrp_log'] = st.get('mrp_log', [])[:20000]
        st['stock_log'] = st.get('stock_log', [])[:20000]
        old = None
        sku_models = sku_variants = None
        st['parts'] = parts
        st['last_run'] = today()
        save_json(self.state_path, st)
        if not old:
            affected = {m for _, m in models}
        self.write_files(rep, parts)
        if os.getenv('RE_SPARES_PDF', '0') == '1':
            self.build_pdfs(rep, models, parts, affected)
        else:
            log.info('RE spares: PDF off (RE_SPARES_PDF=1 se on)')
        return rep, []


    def build_pdfs(self, rep, models, parts, affected=None):
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        styles = getSampleStyleSheet()
        small = ParagraphStyle('small', parent=styles['Normal'], fontSize=6.5, leading=8)
        outdir = data_dir('output', 'Royal Enfield Spares', 'PDF')
        by_model = collections.defaultdict(list)
        for sku, rec in parts.items():
            for m in rec['models']:
                by_model[m].append(sku)
        made = 0
        for cid, mname in models:
            if affected is not None and mname not in affected:
                continue
            skus = sorted(set(by_model.get(mname, [])))
            if not skus:
                continue
            path = os.path.join(outdir, safe(mname) + '.pdf')
            doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=8 * mm, rightMargin=8 * mm,
                                    topMargin=10 * mm, bottomMargin=10 * mm, title=mname)
            story = [Paragraph('ROYAL ENFIELD SPARES', styles['Title']), Spacer(1, 3 * mm),
                     Paragraph(mname, styles['Heading2']), Spacer(1, 2 * mm),
                     Paragraph(str(len(skus)) + ' parts | synced ' + today(), styles['Normal']), Spacer(1, 4 * mm)]
            data = [['Photo', 'Part No', 'Name', 'MRP', 'Stock', 'Variant codes']]
            for sku in skus:
                rec = parts[sku]
                img = ''
                d = self.img_dir(sku)
                files = sorted(f for f in os.listdir(d) if f.endswith('_t.jpg'))
                if files:
                    try:
                        img = Image(os.path.join(d, files[0]), 20 * mm, 20 * mm, kind='proportional')
                    except Exception:
                        img = ''
                data.append([img, Paragraph(sku, styles['Normal']), Paragraph(rec['name'][:90], styles['Normal']),
                             ('Rs %g' % rec['mrp']) if rec['mrp'] is not None else '-',
                             rec['stock'], Paragraph(', '.join(rec['variants'])[:80], small)])
            t = Table(data, colWidths=[24 * mm, 26 * mm, 62 * mm, 18 * mm, 20 * mm, 34 * mm], repeatRows=1)
            t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
                                   ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b0000')),
                                   ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                                   ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                   ('FONTSIZE', (0, 0), (-1, -1), 7)]))
            story.append(t)
            doc.build(story)
            made += 1
        if made:
            rep.add('Files update hui', str(made) + ' model PDF (output/Royal Enfield Spares/PDF)')

    def write_files(self, rep, parts):
        import openpyxl
        from openpyxl.utils import get_column_letter
        out = data_dir('output', 'Royal Enfield Spares')
        os.makedirs(out, exist_ok=True)
        st = self.state
        wb = openpyxl.Workbook(write_only=True)          # streaming: cells memory me nahi rukte
        ws = wb.create_sheet('All Parts')
        ws.append(['Part No', 'Name', 'MRP (Rs)', 'Stock', 'Models', 'Variant codes', 'Alternate',
                   'Photos', 'Photo folder', 'Naya kab', 'How to use'])
        newmap = st.get('new', {})
        for sku, rec in sorted(parts.items()):
            ws.append([sku, rec['name'], rec['mrp'], rec['stock'], ', '.join(rec['models'])[:1200],
                       ', '.join(rec['variants'])[:600], ', '.join(rec.get('alt') or [])[:200],
                       len(rec['imgs']), self.img_dir(sku), newmap.get(sku, ''),
                       rec['how_to_use'][:300]])
        for i, w in enumerate([16, 40, 10, 14, 60, 40, 30, 8, 40, 11, 60]):
            ws.column_dimensions[get_column_letter(i + 1)].width = w
        ws.freeze_panes = 'A2'

        def sheet(title, head, rows, widths):
            s = wb.create_sheet(title)
            s.append(head)
            for r in rows:
                s.append(r)
            for i, w in enumerate(widths):
                s.column_dimensions[get_column_letter(i + 1)].width = w
            s.freeze_panes = 'A2'

        sheet('MRP Badla', ['Part No', 'Name', 'Purana MRP', 'Naya MRP', 'Kab'],
              ([c['part_no'], c['name'], c['old_mrp'], c['new_mrp'], c['date']]
               for c in st.get('mrp_log', [])), [16, 40, 12, 12, 11])
        sheet('Stock Badla', ['Part No', 'Name', 'Purana', 'Naya', 'Kab'],
              ([c['part_no'], c['name'], c['old'], c['new'], c['date']]
               for c in st.get('stock_log', [])), [16, 40, 12, 12, 11])
        sheet('Naye Parts', ['Part No', 'Name', 'MRP', 'Models', 'Kab'],
              ([s, parts[s]['name'], parts[s]['mrp'], ', '.join(parts[s]['models'])[:400], d]
               for s, d in sorted(st.get('new', {}).items(), key=lambda x: x[1], reverse=True) if s in parts),
              [16, 40, 12, 40, 11])
        sheet('Site se Hata', ['Part No', 'Name', 'Kab'],
              ([s, v[1], v[0]] for s, v in sorted(st.get('gone', {}).items(),
                                                  key=lambda x: x[1][0], reverse=True)), [16, 40, 11])
        sheet('Bina Photo', ['Part No', 'Name', 'Models'],
              ([s, r['name'], ', '.join(r['models'])[:400]] for s, r in sorted(parts.items()) if not r['imgs']),
              [16, 40, 60])

        revs = collections.defaultdict(set)
        for sku in parts:
            base, r = split_rev(sku)
            if r:
                revs[base].add(r)
        rows = []
        for base, rs in sorted(revs.items()):
            if len(rs) < 2:
                continue
            rs = sorted(rs, key=revkey)
            newest = base + '/' + rs[-1]
            for r in rs[:-1]:
                rows.append([base + '/' + r, newest, parts.get(newest, {}).get('name', ''),
                             parts.get(newest, {}).get('mrp')])
        sheet('Purana -> Naya (revision)', ['Purana Part No', 'Naya Part No', 'Name', 'MRP'], rows,
              [18, 18, 40, 10])

        wb.save(os.path.join(out, 'RE_Spares_All_Parts.xlsx'))

    def prices(self):
        return {s: r['mrp'] for s, r in self.state.get('parts', {}).items() if r.get('mrp')}
