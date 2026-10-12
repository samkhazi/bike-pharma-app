"""11 Oct 2026: sister bikes (same platform) are suggested only for brands whose catalogue is in."""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
def sub(old, new, n=1):
    global a
    c = a.count(old); assert c == n, (c, old[:100]); a = a.replace(old, new)
sub("""if(vb!==r.vb||!vms.some(m=>re.test(m))||!BRANDS_V[sb])return;""", """if(vb!==r.vb||!vms.some(m=>re.test(m))||!BRANDS_V[sb]||!CAT_ALL.some(e=>e.vb===sb))return;""")
open(P, 'w', encoding='utf-8').write(a)
print('p3_ktm ok')
