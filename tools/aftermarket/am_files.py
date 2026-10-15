"""cat/am-files.json: the files of Sam's aftermarket folders (All Catalogues > After Market Brands), one set per brand folder,
for Admin > More > Catalogue files (update 8z). Input: a listing {folder: [[file name, size], ...]} made on his Mac
(names without the folder path; *_previous.* copies and hidden files left out). A file already listed for another
brand with the same name and size is not listed again (Sam: "double double upload nahi hona he").
usage: python3 am_files.py <listing.json> <out am-files.json>"""
import sys, json, re
L = json.load(open(sys.argv[1]))
EXT = {'pdf', 'jpg', 'jpeg', 'png', 'webp', 'zip', 'json', 'csv', 'xlsx', 'xls', 'txt'}   # what the server takes (server.mjs CAT_EXTS)
seen, sets = set(), []
for d in sorted(L):
    fs = [[n, z] for n, z in L[d] if (n, z) not in seen and n.rsplit('.', 1)[-1].lower() in EXT]
    seen.update((n, z) for n, z in fs)
    if not fs: continue
    slug = re.sub(r'[^a-z0-9]+', '-', d.strip().lower()).strip('-')
    sets.append({'dir': 'catalogues/aftermarket/' + slug, 'name': d.strip(), 'pick': 'All Catalogues > After Market Brands > ' + d.strip(), 'files': fs})
json.dump({'sets': sets}, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(sets), 'folders', sum(len(s['files']) for s in sets), 'files', round(sum(z for s in sets for _, z in s['files']) / 1e6), 'MB')
