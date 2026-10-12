"""Where Sam's brand package files are in this container (staged from his Mac, read only) and how to read them."""
import csv, io, json, os, sys, zipfile
csv.field_size_limit(1 << 30)
U = '/mnt/user-data/uploads'
IMP = U + '/All Catalogues/BikeSurgeon_Catalog_Import'
IDX = U + '/Bike Pharma Automobile APP UI/website-server/catalogue-index'
DATA = {'hero': ('HERO_Upload_Package_DATA.zip', 'HERO_Upload_Package/'), 're': ('RE_Upload_Package_DATA.zip', 'RE_Upload_Package/'),
        'yamaha': ('YAMAHA_Upload_Package_DATA.zip', 'YAMAHA_Upload_Package/')}

def rows_zip(brand, name='parts.csv'):
    z, pre = DATA[brand]
    zf = zipfile.ZipFile(os.path.join(IDX, z))
    with zf.open(pre + name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig', newline=''))

def rows_csv(rel):
    with open(os.path.join(IMP, rel), encoding='utf-8-sig', newline='') as f:
        yield from csv.DictReader(f)

def zidx(name):
    """{entry name: (method, data offset, stored size, size)} of one of Sam's zips + the zip's own size"""
    d = json.load(open(os.path.join(IDX, name + '.idx.json')))
    return {e[0]: tuple(e[1:5]) for e in d['entries']}, d['size']
