import pymupdf as fitz, os, re, sys, json, collections
from multiprocessing import Pool
D='/mnt/user-data/uploads/KTM/KTM_PDF_HD_All_Years'
def one(n):
    doc=fitz.open(os.path.join(D,n)); out={'n':n,'pages':doc.page_count,'cover':doc[0].get_text().strip().split('\n')[:4],'imgs':collections.Counter(),'hdr':[], 'multi':0,'cols':set(),'rem':collections.Counter(),'noimg_hdr':[]}
    for i,pg in enumerate(doc):
        if i<1: continue
        ims=pg.get_images(full=True); out['imgs'][len(ims)]+=1
        t=pg.get_text('dict')
        spans=[(round(s['bbox'][1],1),round(s['bbox'][0],1),s['text'],round(s['size'],1),s['font']) for b in t['blocks'] if b.get('type')==0 for l in b['lines'] for s in l['spans'] if s['text'].strip()]
        h=[s for s in spans if re.match(r'^(ENGINE|FRAME)\s+\d+\s',s[2])]
        if h:
            out['hdr'].append((i+1,h[0][2],h[0][3],h[0][4],len(ims)))
            if not ims: out['noimg_hdr'].append((i+1,h[0][2]))
        hd=[s for s in spans if s[2] in('Ref','Part No','Description','Qty','Remarks')]
        if hd: out['cols'].add(tuple((s[2],s[1]) for s in sorted(hd,key=lambda s:s[1])))
    return out
if __name__=='__main__':
    ns=sorted(os.listdir(D))
    with Pool(8) as p: R=p.map(one,ns)
    tot=collections.Counter()
    for r in R:
        tot.update(r['imgs'])
    print('img per page dist',tot)
    print('covers'); [print(' ',r['n'],r['pages'],r['cover'][1:3]) for r in R]
    print('cols variants',collections.Counter(c for r in R for c in r['cols']).most_common(5))
    print('hdr fonts',collections.Counter((h[2],h[3]) for r in R for h in r['hdr']))
    print('hdr imgs',collections.Counter(h[4] for r in R for h in r['hdr']))
    print('noimg hdr',[(r['n'],r['noimg_hdr']) for r in R if r['noimg_hdr']][:20])
    print('total asm pages',sum(len(r['hdr']) for r in R))
