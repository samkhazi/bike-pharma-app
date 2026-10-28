"""brand_sync - weekly check of brand parts catalogues; downloads only what changed.

usage:  python sync.py hero             # Hero e-catalogue (weekly): new models -> PDF, new parts, MRP changes, old<->new
        python sync.py hero_dms         # Hero Connect DMS (monthly): all part numbers, MRP changes, superseded, models
        python sync.py hero_dms --part 12310AAM000S   # live MRP of one part from the DMS
        python sync.py bajaj            # check Bajaj (incl. KTM/Husqvarna), update PDFs/Excel for changed BOMs
        python sync.py tvs              # TVS dealer DMS (weekly, OTP typed by Sam): NDP-MRP list, kits, e-catalogue
        python sync.py yamaha           # Yamaha pymidol (weekly, login from .env, OTP only if pymidol asks): MRP, old<->new, kits, new PDFs
        python sync.py honda            # Honda e-catalogue (weekly, login code typed by Sam): new/changed models, MRP, kits, old<->new
        python sync.py royal_enfield    # Royal Enfield EPC, India & SAARC (weekly, login from .env): new models/variants/diagrams/parts, MRP list
        python sync.py all              # every brand enabled in .env (BRANDS=bajaj,...)
        python sync.py bajaj --full     # re-download everything (first run does this anyway)
        python sync.py bajaj --rebuild  # rebuild all PDFs/Excel from saved data, no download
"""
import os, sys, logging, argparse, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import load_env, env, data_dir
import builders

BRANDS = {}
def brand_cls(name):
    if name == 'bajaj':
        from brands.bajaj import Bajaj; return Bajaj
    if name == 'tvs':
        from brands.tvs import TVS; return TVS
    if name == 'honda':
        from brands.honda import Honda; return Honda
    if name == 'yamaha':
        from brands.yamaha import Yamaha; return Yamaha
    if name == 'royal_enfield':
        from brands.royal_enfield import RoyalEnfield; return RoyalEnfield
    if name == 'hero':
        from brands.hero import Hero; return Hero
    if name == 'hero_dms':
        from brands.hero_dms import HeroDMS; return HeroDMS
    raise SystemExit(f'unknown brand: {name}')


def run_brand(name, full=False, rebuild=False):
    b = brand_cls(name)()
    out = data_dir('output', b.name)
    prices = builders.load_prices(env(f'{name.upper()}_PRICES_CSV'))
    if getattr(b, 'pdfs', True) is False and rebuild and hasattr(b, 'rebuild'):   # Honda makes its own PDFs
        return b.rebuild()
    if getattr(b, 'pdfs', True) is False or (env('SKIP_PDFS') == '1' and not rebuild):   # data-only (Hero DMS), or the Bike Pharma server, which builds its own catalogue
        return b.run(full=full)[0]
    if rebuild:
        keys, rep = None, None
    else:
        rep, changed = b.run(full=full)
        first = not os.path.exists(os.path.join(out, f'{b.name}_All_Parts.xlsx'))
        keys = None if (first or full) else set(changed)
    if hasattr(b, 'prices'):
        prices = {**b.prices(), **prices}
    variants = list(b.variants())
    src = f'Source: {b.name} parts catalogue, synced {datetime.date.today()}. Price column: {getattr(b, 'price_label', None) or env(f"{name.upper()}_PRICES_CSV") or "not set"}.'
    if keys is None or keys:
        paths = builders.build_pdfs(variants, os.path.join(out, 'PDF', 'Models'), prices, keys, src)
        n = builders.build_excel(variants, os.path.join(out, f'{b.name}_All_Parts.xlsx'), prices, b.name)
        logging.info('%s: %d PDFs written, %d part numbers in Excel', b.name, len(paths), n)
        if rep: rep.add('Files update hui', f'{len(paths)} PDFs, Excel me {n} part numbers')
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('brand')
    ap.add_argument('--full', action='store_true')
    ap.add_argument('--rebuild', action='store_true')
    ap.add_argument('--compare-old', action='store_true', help='tvs only: compare the saved NDP-MRP list with the old MRP on the server')
    ap.add_argument('--part', help='hero_dms only: live MRP of one part, e.g. 12310AAM000S')
    a = ap.parse_args()
    load_env()
    if a.compare_old:                                   # TVS: this NDP-MRP list vs the MRP of the catalogue on the server
        from brands.tvs import TVS
        from common import Report
        r = Report('TVS MRP vs purani list'); TVS().compare_old(r)
        md = r.markdown(); print(md)
        from notify import send
        send(md); return
    if a.part:
        import json
        from brands.hero_dms import HeroDMS
        print(json.dumps(HeroDMS().check_part(a.part.strip().upper()), ensure_ascii=False)); return
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(message)s',
                        handlers=[logging.StreamHandler(), logging.FileHandler(os.path.join(data_dir('logs'), 'sync.log'))])
    names = [x.strip() for x in env('BRANDS', 'bajaj').split(',')] if a.brand == 'all' else [a.brand]
    md = []
    for n in names:
        try:
            r = run_brand(n, a.full, a.rebuild)
            if r: md.append(r.markdown())
        except SystemExit as e:
            md.append(f'## {n}\n\nERROR: {e}\n')
        except Exception as e:
            logging.exception('%s failed', n)
            md.append(f'## {n}\n\nERROR: {e}\n')
    if md:
        p = os.path.join(data_dir('reports'), f'report_{datetime.date.today()}_{a.brand}.md')   # one file per run: the DMS and e-catalogue reports of one night both stay
        open(p, 'w', encoding='utf-8').write('\n'.join(md))
        print(open(p, encoding='utf-8').read())
        from notify import send
        send('\n'.join(md))


if __name__ == '__main__':
    main()
