# Sam 2026-10-30: his list of part names (every company's own names + garage / local names) -> lib/names/part-names.json,
# read only by the server (lib/partnames.mjs, /api/fpname); the app never gets the list, only the names one search needs.
#   python3 tools/partnames.py Part_Names_Company_aur_Garage.xlsx
import json, re, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
norm = lambda s: re.sub(r'[^A-Z0-9]+', ' ', str(s or '').upper()).strip()
groups, gi = [], {}
def grp(std, cat):
    if std not in gi: gi[std] = len(groups); groups.append({'s': std, 'c': cat or '', 'g': [], 'n': {}})
    return groups[gi[std]]
for std, cat, garage, *rest in list(wb['Part Groups'].iter_rows(values_only=True))[1:]:
    if not std or std == '(group nahi)': continue
    g = grp(std, cat)
    for x in str(garage or '').split(';'):
        x = x.strip()
        if x and x not in g['g']: g['g'].append(x)
for _, garage, std, cat in [(None, *r) for r in list(wb['Garage Names'].iter_rows(values_only=True))[1:]]:
    if not std or std == '(group nahi)' or not garage: continue
    g = grp(std, cat); garage = str(garage).strip()
    if garage not in g['g']: g['g'].append(garage)
for brand, name, _n, std, cat, *_ in list(wb['Company Names'].iter_rows(values_only=True))[1:]:
    if not std or std == '(group nahi)' or not name: continue
    k = norm(name)
    if not k: continue
    l = grp(std, cat)['n'].setdefault(str(brand), [])
    if k not in l: l.append(k)
for g in groups:
    for l in g['n'].values(): l.sort()
out = {'v': 1, 'src': 'Part_Names_Company_aur_Garage.xlsx (Sam, 2026-10-30)', 'groups': groups}
json.dump(out, open('lib/names/part-names.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(groups), 'groups,', sum(len(g['g']) for g in groups), 'garage names,', sum(len(l) for g in groups for l in g['n'].values()), 'company names')
