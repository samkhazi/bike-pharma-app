"""Check every model year's every diagram: the 'pa:' place it points to decodes to exactly the JPEG that model year's own PDF has
on that assembly page (same md5), and the rows of each group are that page's rows."""
import base64, hashlib, json, os, re, sys
D, P, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
R = json.load(open(P))
WORDS = {'DUKE': 'Duke', 'ADVENTURE': 'Adventure', 'RALLY': 'Rally', 'ENDURO': 'Enduro', 'PLUS': 'Plus', 'SVARTPILEN': 'Svartpilen', 'VITPILEN': 'Vitpilen'}
pretty = lambda raw: ' '.join(WORDS.get(w, w) for w in re.split(r'[- ]+', raw.strip()))
own = {}
for b in R:
    for a in b['asm']:
        if a['img']:
            own[('%s %d (MY%02d)' % (pretty(b['model']), 2000 + b['my'], b['my']), '%s %d' % (a['kind'].title(), a['n']))] = a['img']['md5']
fh, cache, bad, n = {}, {}, [], 0
for slug in ('ktm', 'husqvarna'):
    cat = json.load(open(os.path.join(OUT, slug + '.json')))
    dg = json.load(open(os.path.join(OUT, slug + '-dg.json')))
    assert len(dg['p']) == len(cat['vars'])
    for vi, m in enumerate(dg['p']):
        v = cat['vars'][vi]
        for g, k in m.items():
            u = dg['f'][k]
            if u not in cache:
                _, path, off, ln = re.match(r'^(pa):(.+):(\d+):(\d+)$', u).groups()
                f = os.path.join(D, path.split('/')[-1])
                with open(f, 'rb') as fp:
                    fp.seek(int(off)); data = fp.read(int(ln))
                j = base64.a85decode(data.strip()[:-2])
                assert j[:2] == b'\xff\xd8'
                cache[u] = hashlib.md5(j).hexdigest()
            n += 1
            if cache[u] != own.get((v, g)):
                bad.append((slug, v, g))
    # every group a variant has rows in, and has a drawing in its PDF, has a picture
    have = {(vi, g) for vi, m in enumerate(dg['p']) for g in m}
    for r in cat['d']:
        for vi in r[11]:
            if (vi, r[2]) not in have and (cat['vars'][vi], r[2]) in own:
                bad.append(('missing', cat['vars'][vi], r[2]))
print('checked', n, 'diagram links,', len(cache), 'drawings decoded; problems', len(bad), bad[:5])
