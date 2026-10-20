"""Update 9y (Sam 2026-10-20 "haan"): part names in public/cat/<brand>.json that the books left odd, fixed from the same number's other lines.
  royal-enfield: a line whose name is just its part number (e.g. RAC00539/B) takes the name the other lines of that number have.
  yamaha: a line from Yamaha's Spanish / French books (its fig title is '<other language> <English title>', e.g. 'ASIENTO SEAT') takes the
          English name and fig title of the same number's English lines.
Only names change: numbers, MRP, figs, refs and bikes stay. Safe to run again.   usage: python3 -I names_fix.py [cat dir]"""
import collections, json, os, sys
CAT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'cat')
flat = lambda s: s.replace(' ', '').replace('-', '').upper()


class Ix:
    def __init__(self, l):
        self.l, self.i = l, {}
        for n, x in enumerate(l):
            self.i.setdefault(x, n)

    def add(self, x):
        if x not in self.i:
            self.i[x] = len(self.l)
            self.l.append(x)
        return self.i[x]


def load(b):
    return json.load(open(os.path.join(CAT, b + '.json'), encoding='utf-8'))


def save(b, o):
    with open(os.path.join(CAT, b + '.json'), 'w', encoding='utf-8') as f:
        json.dump(o, f, ensure_ascii=False, separators=(',', ':'))


def royal_enfield():
    o = load('royal-enfield')
    D = o['desc']
    isnum = lambda r: flat(D[r[6]]) == flat(r[5])
    best = collections.defaultdict(collections.Counter)
    for r in o['d']:
        if not isnum(r) and D[r[6]].strip():
            best[r[5]][r[6]] += 1
    n = 0
    for r in o['d']:
        if isnum(r) and best[r[5]]:
            r[6] = best[r[5]].most_common(1)[0][0]
            n += 1
    save('royal-enfield', o)
    return n


def yamaha():
    o = load('yamaha')
    D, A = o['desc'], Ix(o['asm'])
    by = collections.defaultdict(list)
    for r in o['d']:
        by[r[5]].append(r)
    n = 0
    for rows in by.values():
        tit = {A.l[r[3]] for r in rows}
        # a foreign line: its fig title ends with ' ' + an English title the same number has
        en_of = {t: max((e for e in tit if e != t and t.endswith(' ' + e)), key=len, default=None) for t in tit}
        eng = [r for r in rows if not en_of[A.l[r[3]]]]
        if len(eng) == len(rows) or not eng:
            continue
        name = collections.Counter(r[6] for r in eng).most_common(1)[0][0]
        for r in rows:
            e = en_of[A.l[r[3]]]
            if e:
                r[3], r[6] = A.add(e), name
                n += 1
    save('yamaha', o)
    return n


if __name__ == '__main__':
    print(json.dumps({'royal-enfield': royal_enfield(), 'yamaha': yamaha()}))
