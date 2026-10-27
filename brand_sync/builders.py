"""Brand-independent outputs: one PDF per variant + an A-Z parts Excel.
A variant is {'brand','family','model','variant','sku','bom','mfg','vertical','plates':[{'title','img','rows':[{sn,pn,desc,qty}]}],'key'}."""
import os, io, re, csv, collections, tempfile, shutil
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle

W, H = A4
BLUE = colors.HexColor('#0B4EA2')
st = ParagraphStyle('s', fontName='Helvetica', fontSize=7, leading=8.4)
stc = ParagraphStyle('c', fontName='Helvetica', fontSize=5.8, leading=7, textColor=colors.HexColor('#333333'))
sth = ParagraphStyle('h', fontName='Helvetica-Bold', fontSize=7, leading=8.4, textColor=colors.white)
MONS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def esc(s): return str(s if s is not None else '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def nkey(s): return [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', str(s or ''))]
def safe(s): return re.sub(r'[\\/:*?"<>|]+', '-', str(s)).strip().rstrip('.')
def mfg(v):
    m = re.match(r'(\d{4})-(\d{2})', v.get('mfg') or '')
    return f'{MONS[int(m.group(2))]}, {m.group(1)}' if m else ''


def load_prices(path):
    pr = {}
    if path and os.path.exists(path):
        for r in csv.reader(open(path, encoding='utf-8-sig')):
            if len(r) >= 2 and r[0].strip():
                try: pr[r[0].strip().upper()] = float(str(r[1]).replace(',', '').replace('₹', ''))
                except ValueError: pass
    return pr


def tstyle(t):
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), BLUE), ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                           ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F3F6FB')]),
                           ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 2.5),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 2.5), ('TOPPADDING', (0, 0), (-1, -1), 1.5),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5)]))
    return t


class Doc:
    def __init__(self, path, source):
        self.c = canvas.Canvas(path, pagesize=A4, pageCompression=1); self.n = 1; self.source = source
    def header(self, title, sub, right):
        c = self.c
        c.setFillColor(BLUE); c.rect(0, H - 44, W, 44, fill=1, stroke=0)
        c.setFillColor(colors.white); c.setFont('Helvetica-Bold', 12); c.drawString(22, H - 20, title[:80])
        c.setFont('Helvetica', 9); c.drawString(22, H - 36, sub[:105]); c.drawRightString(W - 22, H - 20, right)
        c.setFillColor(colors.grey); c.setFont('Helvetica', 6); c.drawString(22, 12, self.source)
        c.setFillColor(colors.black)
    def newpage(self, title, sub, right):
        self.c.showPage(); self.n += 1; self.header(title, sub, right)
    def flow(self, t, y_top, title, sub, right):
        avail = y_top - 24
        while True:
            tw, th = t.wrap(W - 44, H)
            if th <= avail:
                t.drawOn(self.c, 22, y_top - th); return y_top - th
            sp = t.split(W - 44, avail)
            if len(sp) < 2:
                if avail >= H - 76 - 1: raise RuntimeError(f'row taller than a page in {title}')
                self.newpage(title, sub + ' (contd.)', right); y_top = H - 52; avail = y_top - 24; continue
            sp[0].wrap(W - 44, avail); sp[0].drawOn(self.c, 22, y_top - sp[0]._height)
            self.newpage(title, sub + ' (contd.)', right); y_top = H - 52; avail = y_top - 24
            t = sp[1]


def pdf_path(outdir, v, dual=False):
    name = safe(v['variant']) + (f" ({mfg(v)})" if mfg(v) else '') + (f" [{safe(v['sku'])}]" if v['sku'] else '')
    if dual: name += f" BOM {safe(v['bom'])}"
    return os.path.join(outdir, safe(v['model']), name + '.pdf')


def build_pdfs(variants, outdir, prices=None, keys=None, source=''):
    """Build PDFs for all variants (or only those whose 'key' is in keys). Returns list of written paths."""
    prices = prices or {}
    variants = list(variants)
    pmodels = collections.defaultdict(set)
    for v in variants:
        for p in v['plates']:
            for r in p['rows']:
                if r['pn']: pmodels[r['pn']].add(v['model'])
    skucount = collections.Counter(v['sku'] for v in variants)
    out = []
    for v in variants:
        if keys is not None and v['key'] not in keys:
            continue
        path = pdf_path(outdir, v, skucount[v['sku']] > 1)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        _one(v, path, prices, pmodels, source)
        out.append(path)
    return out


def _money(prices, pn):
    x = prices.get(str(pn).upper())
    return f'{x:,.2f}'.rstrip('0').rstrip('.') if x else '-'


def _one(v, out, prices, pmodels, source):
    tmp = tempfile.mkdtemp()
    try:
        title = v['variant']
        def compat(pn):
            ms = sorted(pmodels.get(pn, set()) - {v['model']}, key=nkey)
            if not ms: return 'Only this model'
            return ', '.join(ms[:10]) + (f' +{len(ms) - 10} more' if len(ms) > 10 else '')
        d = Doc(f'{tmp}/body.pdf', source); starts = []; parts = collections.OrderedDict(); nimg = 0
        P = v['plates']
        for i, p in enumerate(P, 1):
            if i > 1: d.c.showPage(); d.n += 1
            starts.append(d.n); right = f'Plate {i}/{len(P)}'
            d.header(title, f"{p['title']}   [SKU {v['sku']}]", right)
            top = H - 54; y = top
            if p['img']:
                try:
                    # embed the original file untouched (no re-compression, original colour and resolution)
                    iw, ih = Image.open(p['img']).size; s = min((W - 44) / iw, H * 0.50 / ih)
                    d.c.drawImage(ImageReader(p['img']), (W - iw * s) / 2, top - ih * s, iw * s, ih * s)
                    y = top - ih * s - 6; nimg += 1
                except Exception as e:
                    d.c.drawString(22, top - 12, f'(diagram could not be read: {e})'); y = top - 20
            else:
                d.c.setFont('Helvetica-Oblique', 8); d.c.drawString(22, top - 12, '(No diagram for this plate in the brand catalogue; parts listed below)'); y = top - 22
            trs = [[Paragraph(x, sth) for x in ['S.No', 'Part No', 'Description', 'Qty', 'Price (Rs)', 'Compatible (other models)']]]
            for r in p['rows']:
                if not r['pn']: continue
                trs.append([Paragraph(esc(r['sn']), st), Paragraph(f"<b>{esc(r['pn'])}</b>", st), Paragraph(esc(r['desc']), st),
                            Paragraph(esc(r['qty']), st), Paragraph(_money(prices, r['pn']), st), Paragraph(esc(compat(r['pn'])), stc)])
                a = parts.setdefault(r['pn'], [r['desc'], 0, []]); a[2].append(i)
                try: a[1] += float(r['qty'])
                except (TypeError, ValueError): pass
            widths = [26, 66, 0, 24, 44, 150]; widths[2] = (W - 44) - sum(widths)
            d.flow(tstyle(Table(trs, colWidths=widths, repeatRows=1)), y, title, p['title'], right)
        az = None
        if parts:
            d.c.showPage(); d.n += 1; az = d.n
            d.header(title, f'All parts of this variant, A-Z ({len(parts)} part numbers)', 'A-Z parts')
            trs = [[Paragraph(x, sth) for x in ['Part No', 'Description', 'Total Qty', 'Price (Rs)', 'Plate(s)']]]
            for pn in sorted(parts, key=str):
                desc, q, pl = parts[pn]
                trs.append([Paragraph(f'<b>{esc(pn)}</b>', st), Paragraph(esc(desc), st), Paragraph(f'{q:g}' if q else '-', st),
                            Paragraph(_money(prices, pn), st), Paragraph(', '.join(str(x) for x in sorted(set(pl))), st)])
            widths = [72, 0, 40, 50, 90]; widths[1] = (W - 44) - sum(widths)
            d.flow(tstyle(Table(trs, colWidths=widths, repeatRows=1)), H - 54, title, 'All parts A-Z', 'A-Z parts')
        d.c.save()
        F = 1
        for _ in range(4):
            fd = Doc(f'{tmp}/front.pdf', source)
            fd.header(title, f"{v['brand']}  ·  {v['model']}  ·  parts catalogue", f"SKU {v['sku']}")
            info = [['Variant', v['variant']], ['SKU', v['sku']], ['BOM', v.get('bom', '')], ['Valid from', mfg(v) or '-'],
                    ['Brand / Model', f"{v['brand']} / {v['model']}"], ['Vertical', v.get('vertical', '')],
                    ['Plates (diagrams)', f'{len(P)} ({nimg} with diagram)'], ['Part numbers', str(len(parts))]]
            it = Table([[Paragraph(f'<b>{esc(a)}</b>', st), Paragraph(esc(b), st)] for a, b in info], colWidths=[110, W - 154])
            it.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.25, colors.grey), ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#E8EEF8'))]))
            y = fd.flow(it, H - 60, title, 'Index', '') - 10
            trs = [[Paragraph(x, sth) for x in ['Plate', 'Assembly', 'Parts', 'Page']]]
            for i, p in enumerate(P, 1):
                trs.append([Paragraph(str(i), st), Paragraph(esc(p['title']), st), Paragraph(str(sum(1 for r in p['rows'] if r['pn'])), st),
                            Paragraph(str(starts[i - 1] + F), st)])
            if az: trs.append([Paragraph('', st), Paragraph('<b>All parts A-Z</b>', st), Paragraph(str(len(parts)), st), Paragraph(str(az + F), st)])
            fd.flow(tstyle(Table(trs, colWidths=[34, W - 158, 40, 40], repeatRows=1)), y, title, 'Index', '')
            fd.c.save()
            if fd.n == F: break
            F = fd.n
        from pypdf import PdfWriter
        w = PdfWriter()
        for f in (f'{tmp}/front.pdf', f'{tmp}/body.pdf'): w.append(f)
        with open(out, 'wb') as fh: w.write(fh)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def build_excel(variants, path, prices=None, brand=''):
    import openpyxl
    from openpyxl.styles import Font, PatternFill
    prices = prices or {}
    info = {}
    for v in variants:
        for p in v['plates']:
            for r in p['rows']:
                if not r['pn']: continue
                a = info.setdefault(r['pn'], {'desc': r['desc'], 'models': set(), 'skus': set(), 'asm': set()})
                a['models'].add(v['model']); a['skus'].add(v['sku']); a['asm'].add(re.sub(r'^\s*\w+\s*-\s*', '', p['title']))
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'All Parts A-Z'
    ws.append(['Part No', 'Description', 'Price (Rs)', 'Models', 'Variants (SKU) count', 'Assemblies'])
    for c in ws[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='0B4EA2')
    for pn in sorted(info, key=str):
        a = info[pn]
        ws.append([pn, a['desc'], prices.get(pn.upper()), ', '.join(sorted(a['models'], key=nkey)), len(a['skus']), ', '.join(sorted(a['asm']))[:500]])
    for col, w in zip('ABCDEF', [14, 40, 10, 60, 10, 60]): ws.column_dimensions[col].width = w
    ws.freeze_panes = 'A2'
    wb.save(path)
    return len(info)
