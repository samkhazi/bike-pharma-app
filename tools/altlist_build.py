"""Alternate number lists (update 8i): Sam 2026-10-12 07:20Z sent oemship.com's "SPARES ALTERNATE ITEMS LIST FOR KTM TRIUMPH AND BAJAJ"
(as text), 07:33Z "oemship.com isme aise hi sabhi brands ke alternate numbers honge sabhi lelo aur server pe update kardena".

Reads each list in SOURCES and writes tools/altlists/lists.json; build_public.py copies it to public/cat/alt/lists.json (staff only).
Find Part, Add product and the web agent use the pairs as they are (Sam gave the list, so no Admin approval).
    python3 tools/altlist_build.py            (run again when a list is added to SOURCES)

lists.json: {"lists": [{"id", "name", "n"}], "p": [[old number, old description, new number, new description, list index], ...]}
"""
import collections, glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'altlists', 'lists.json')
CAT = os.path.join(HERE, '..', 'public', 'cat')
SOURCES = [
    {'id': 'oemship-ktm-bajaj-triumph', 'name': 'oemship.com alternate list (KTM, Bajaj, Triumph)', 'fmt': 'oemship',
     'file': '/mnt/project-files/uploads/hearth/c82fb559-9999-47fc-923f-5baaa18b9961'},
]
pk = lambda s: re.sub(r'[^A-Z0-9]', '', str(s).upper())
clip = lambda s: re.sub(r'\s+', ' ', s).strip()[:70]


def catalogue_numbers():
    ks = set()
    for f in sorted(glob.glob(os.path.join(CAT, '*.json'))):
        if f.endswith('-dg.json') or os.path.basename(f) == 'xref.json': continue
        for r in json.load(open(f, encoding='utf-8')).get('d', []): ks.add(pk(r[5]))
    ks.discard(''); return ks


# a number-like word: 6-14 letters/digits (a Triumph "-EN" ending allowed) with 4 digits, or 8+ characters with 3 digits ("56GLBED5")
def pnlike(t):
    if not re.fullmatch(r'[A-Z0-9]{6,14}(-[A-Z]{2})?', t): return False
    d = sum(c.isdigit() for c in t); return d >= 4 or (len(t) >= 8 and d >= 3)


shape = lambda t: ''.join('D' if c.isdigit() else 'L' if c.isalpha() else c for c in t)


def oemship(path, incat):
    """Rows "Sr.No Old-number old description New-number new description", one per line; page footers and headers between pages.
    Two rows can share a line (2181 ... DTS\\x022182 DJ201040 ...). Descriptions often hold other numbers (base numbers, GC1000), and the
    old description can be empty, so the new number is the number-like word that looks most like the old one."""
    L = [re.sub(r'[\x00-\x1f]', ' ', ln).strip() for ln in open(path, encoding='utf-8')]
    L = [ln for ln in L if re.match(r'^\d+ \S', ln)]
    recs, exp = [], 1
    for j, ln in enumerate(L):
        if not ln.startswith(str(exp) + ' '): continue
        nxt = L[j + 1] if j + 1 < len(L) else ''
        while nxt and not nxt.startswith(str(exp + 1) + ' '):
            m = re.search(r'(?<=[A-Za-z\s.\-)])' + str(exp + 1) + r' (?=[A-Z0-9]{5,})', ln[len(str(exp)) + 1:])
            if not m: break
            cut = len(str(exp)) + 1 + m.start(); recs.append(ln[:cut].strip()); ln = ln[cut:]; exp += 1
        recs.append(ln); exp += 1
    rows, bad = [], []
    for ln in recs:
        m = re.match(r'^(\d+) (\S+)(?: (.*))?$', ln)
        old, toks = m.group(2), (m.group(3) or '').split(' ')
        cand = [i for i, t in enumerate(toks) if pnlike(t)]

        def score(i):
            t = toks[i]; v = -0.01 * i
            if pk(t) == pk(old): v -= 10            # the old number repeated in the new description
            if shape(t) == shape(old): v += 2
            if t[:2] == old[:2]: v += 1
            if pk(t) in incat: v += 1.5
            if i == len(toks) - 1: v -= 3           # a new number has its own description after it
            return v
        if not cand: bad.append(ln); continue
        i = max(cand, key=score)
        rows.append((old, clip(' '.join(toks[:i])), toks[i], clip(' '.join(toks[i + 1:]))))
    return rows, exp - 1, bad


def main():
    incat = catalogue_numbers()
    lists, pairs, seen = [], [], set()
    for li, s in enumerate(SOURCES):
        rows, last, bad = {'oemship': oemship}[s['fmt']](s['file'], incat)
        n = 0
        for o, od, nw, nd in rows:
            key = (pk(o), pk(nw))
            if not key[0] or not key[1] or key[0] == key[1] or key in seen: continue
            seen.add(key); pairs.append([o, od, nw, nd, li]); n += 1
        lists.append({'id': s['id'], 'name': s['name'], 'n': n})
        st = collections.Counter((pk(o) in incat, pk(nw) in incat) for o, od, nw, nd in rows)
        print(f"{s['name']}: {len(rows)} rows (last row {last}), {n} pairs kept, {len(bad)} unread;",
              f"old not in a catalogue / new is: {st[(False, True)]}, the other way: {st[(True, False)]}, both: {st[(True, True)]}, neither: {st[(False, False)]}")
        for b in bad[:5]: print('   unread:', b[:100])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'lists': lists, 'p': pairs}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
