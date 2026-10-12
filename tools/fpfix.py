"""Find Part fixes found by the 4-round test (Sam 2026-10-12 07:47Z "find part option ko tu khud 3-4 baar test kar sabhi"), update 8j.

"piston ring" in KTM 200 Duke found nothing: KTM and Bajaj call it "Kit Ring Set Ktm 200" (36JU0001, section "Cylinder Piston"),
without the word piston. "Kit ring set" now counts as a piston ring set, like "Ring set" already did.
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'fpfix.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    sub("'PISTON RING':['^RING SET','PISTON RING']", "'PISTON RING':['^RING SET','^KIT RING SET','PISTON RING']")
    return a, n
