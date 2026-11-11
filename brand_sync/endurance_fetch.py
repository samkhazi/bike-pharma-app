#!/usr/bin/env python3
# 20l: Endurance's public e-catalogue (endurancegenuine.com:8443/ecatalogue, the part search that opens without a login) read into a file.
# Sam 2026-11-11: "endurance ka catalogue nikallo ... images ke saath". Runs on the site's server (the catalogue answers Indian networks only).
# One request a second, an honest name, stops on repeated errors, picks up where it stopped (every answer is kept in raw.json).
# Prices are NOT taken: the catalogue itself hides them from visitors (isShowPrice false).
#   python3 endurance_fetch.py [DIR]      DIR default ~/endurance_dump  -> raw.json, log.txt
import json, os, sys, time, urllib.request
D = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/endurance_dump'); os.makedirs(D, exist_ok=True)
B = 'https://endurancegenuine.com:8443/endurance-ecat/api/search/'
RAW = os.path.join(D, 'raw.json'); raw = json.load(open(RAW)) if os.path.exists(RAW) else {}
VT = {'id': 1, 'name': 'Vehicle Type', 'filterCheckList': [{'id': 4, 'name': '2 WHEELER', 'isChecked': True}]}
errs = 0; n = 0
def log(*a):
    s = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a); print(s, flush=True); open(os.path.join(D, 'log.txt'), 'a').write(s + '\n')
def save():
    t = RAW + '.tmp'; json.dump(raw, open(t, 'w')); os.replace(t, RAW)
def call(p, body):
    global errs, n
    k = p + ' ' + json.dumps(body, sort_keys=True)
    if k in raw: return raw[k]
    time.sleep(1)
    r = urllib.request.Request(B + p, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'BikePharmaCatalogue/1.0'})
    try:
        t = urllib.request.urlopen(r, timeout=60).read().decode('utf8', 'replace'); v = json.loads(t) if t.strip() else None; errs = 0
    except Exception as e:
        code = getattr(e, 'code', 0)
        if code == 417: v = None; errs = 0                      # the catalogue's own "not found"
        else:
            errs += 1; log('ERR', p, body, e)
            if errs >= 5: save(); log('STOPPED: 5 errors in a row'); sys.exit(1)
            return None
    raw[k] = v; n += 1
    if n % 40 == 0: save()
    return v
log('START, answers already kept:', len(raw))
aggs = call('searchAggregateList', {'_vehicleType': VT}) or []
parts = {}
for a in aggs:
    for c in call('searchCategoryList', {'_aggregateId': a['id'], '_vehicleType': VT}) or []:
        for s in call('searchSubCategoryList', {'_aggregateId': a['id'], '_categoryId': c['id'], '_vehicleType': VT}) or []:
            L = call('searchPartList', {'_aggregateId': a['id'], '_categoryId': c['id'], '_subCategoryId': s['id'], '_vehicleType': VT}) or []
            log(a['desc'], '>', c['desc'], '>', s['desc'], len(L))
            for p in L: parts[p['partId']] = (a, c, s, p)
log('PART LISTS DONE, parts:', len(parts)); save()
for i, (pid, (a, c, s, p)) in enumerate(sorted(parts.items())):
    call('partDTL', {'_aggregateId': a['id'], '_categoryId': c['id'], '_subCategoryId': s['id'], '_partId': pid})
    if i % 200 == 0: log('details', i, 'of', len(parts))
save()
dt = [v for k, v in raw.items() if k.startswith('partDTL ') and v]
inter = [v for v in dt if v.get('partInterChangeableList')]; used = [v for v in dt if v.get('partWhereUsedList')]
img = [v for v in dt if any('default' not in (x.get('medium') or 'default').lower() and 'noimage' not in (x.get('medium') or '').lower() for x in v.get('partImageList') or [])]
log('DONE parts', len(parts), '| details', len(dt), '| with bikes', len(used), '| with interchangeable numbers', len(inter), '| with a photo', len(img), '| price shown', sum(1 for v in dt if v.get('isShowPrice')))
for v in inter[:6]: log('INTER', v['partNumber'], json.dumps(v['partInterChangeableList'])[:400])
for v in img[:3]: log('IMG', v['partNumber'], json.dumps(v['partImageList'])[:400])
oem = {}
for v in used:
    for u in v['partWhereUsedList']: oem[(u.get('vehicleType'), u.get('oem'))] = oem.get((u.get('vehicleType'), u.get('oem')), 0) + 1
log('MAKERS', sorted(oem.items(), key=lambda x: -x[1])[:40])
