"""Every staff search bar finds catalogue part numbers (update 8k). Sam 2026-10-12 08:05Z "har search bar me search hona he koi bhi part
number daalun agar o hamre server pe he toh show hona he", 08:15Z "haan banade customer ko sirf ohi show hona he jo hamare paas stock he
matlab inventory jo add hote hein ohi show hona he na ki poora catalogues".

A part number typed in Universal search, Stock & racks, Warranty check, Scan to find or the bill's item box also looks in the brand
catalogues (and the alternate lists) and shows what it finds in a "Brand catalogues" card under the bar's own results. Customers and
mechanics never get the card: their search stays our stock only. The bill's item box takes a part number as well as a barcode.
"""

FPJS = r"""
/* a part number in a staff search bar: what the brand catalogues have (update 8k; never for customers or mechanics, they see our stock only) */
function fpHit(q,words){q=String(q||'').trim();if(!q||!altStaff())return '';
 /* a part name (Stock & racks): one tap searches every brand catalogue for it (Sam 08:18Z "mere staff ko poore cataogues show hone hein") */
 if(!fpIsPn(q))return words&&/[a-z]{3}/i.test(q)?`<button class="card row us-fp" data-q="${esc(q)}" onclick="go('findpart',{v:'res',q:this.dataset.q,sort:'best',n:30})">${ic('search','s20')}<span><b>Find Part</b><span class="cap">Search “${esc(q)}” in all brand catalogues</span></span></button>`:'';
 altListLoad();
 const R=m2Res({v:'res',q,vb:'Any',vm:'Any',yr:'Any',bs:'Any',sort:'best',n:30}),L=R.list||[];
 const head=`<div class="row fp-hit-h">${ic('search','s18')}<b class="grow">Brand catalogues</b><button class="btn line sm" data-q="${esc(q)}" onclick="go('findpart',{v:'res',q:this.dataset.q,sort:'best',n:30})">Open in Find Part</button></div>`;
 if(R.loading)return `<div class="card fp-hit" data-wait="1">${head}<div class="cap">Looking for “${esc(q)}” in the brand catalogues…</div></div>`;
 if(!L.length)return `<div class="card fp-hit">${head}<div class="cap">${altListLine(q)||`“${esc(q)}” is not in our brand catalogues either.`}</div></div>`;
 return `<div class="card fp-hit">${head}${R.alt?altVia(q,R.alt):''}<div class="stack g8">${L.slice(0,3).map(catCard).join('')}</div>${L.length>3?`<div class="cap">${L.length} parts: Open in Find Part shows them all.</div>`:''}</div>`;}
"""
FPCSS = r"""
.fp-hit{gap:10px}
.fp-hit-h{gap:8px;align-items:center}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'fphit.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    assert '123456' not in FPJS + FPCSS and '</script' not in FPJS
    sub("/* ---------- Waiting for photos ---------- */", FPJS.strip() + "\n/* ---------- Waiting for photos ---------- */")
    sub("/* ---- inventory (update 8): phone stacks, website two columns ---- */", FPCSS.strip() + "\n/* ---- inventory (update 8): phone stacks, website two columns ---- */")
    # a card still waiting for a catalogue file is redrawn when the file is in (the cursor stays in the search bar)
    sub("function catRefresh(){try{if(!['findpart','addproduct','grnedit','invpaste','invwait'].includes(cur().s))return;}catch(x){return;}",
        "function catRefresh(){try{if(!['findpart','addproduct','grnedit','invpaste','invwait'].includes(cur().s)&&!document.querySelector('.fp-hit[data-wait]'))return;}catch(x){return;}")
    # Universal search: the card for a part number, the Find Part button for words
    sub("return q&&altStaff()?`<button class=\"card row us-fp\"", "return q&&altStaff()&&!fpIsPn(q)?`<button class=\"card row us-fp\"")
    sub("${role==='admin'?'':''}</div></div>`;};", "${fpHit(S.ui.sq)}${role==='admin'?'':''}</div></div>`;};")
    # Stock & racks
    sub("\n</div></div>`;}\nSCREENS.racks=", "\n ${fpHit(S.ui.rq,1)}\n</div></div>`;}\nSCREENS.racks=")
    # Warranty check
    sub("${list.length?list.map(w=>warCard(w,1)).join(''):'<div class=\"empty\">No warranties match.</div>'}</div></div>`;};",
        "${list.length?list.map(w=>warCard(w,1)).join(''):'<div class=\"empty\">No warranties match.</div>'}${fpHit(S.ui.wq)}</div></div>`;};")
    # Scan to find: a code our stock does not have
    sub("+ Add as new product</button>`:''}</div>`:''}\n ${x?`<div class=\"card\" style=\"border:1.5px solid var(--y)\">",
        "+ Add as new product</button>`:''}</div>`:''}${S.ui.scanMiss?fpHit(S.ui.scanMiss):''}\n ${x?`<div class=\"card\" style=\"border:1.5px solid var(--y)\">")
    # the bill's item box: a barcode or a part number of our stock; a number we do not stock shows what the catalogues say about it
    sub("const x=PRODUCTS.find(p=>barcodeOf(p)===c);if(!x){inv.bcErr='No product with barcode '+esc(c)+'. Check the number on the pack.';return refresh();}invAdd(x);}",
        "const x=PRODUCTS.find(p=>barcodeOf(p)===c)||PRODUCTS.find(p=>p.pn&&catPk(p.pn)===catPk(c));inv.bcMiss=x?'':c;"
        "if(!x){inv.bcErr='No product in our stock with barcode or part number '+esc(c)+'. Check the number on the pack.';return refresh();}invAdd(x);}")
    sub("<label for=\"inv-bc\">Or type barcode number</label>", "<label for=\"inv-bc\">Or type barcode or part number</label>")
    sub("<input id=\"inv-bc\" inputmode=\"numeric\" placeholder=\"13-digit barcode\"", "<input id=\"inv-bc\" autocomplete=\"off\" autocapitalize=\"characters\" placeholder=\"Barcode or part number\"")
    sub("${inv.bcErr?`<div class=\"errmsg\">${inv.bcErr}</div>`:''}</div>", "${inv.bcErr?`<div class=\"errmsg\">${inv.bcErr}</div>`:''}${inv.bcMiss?fpHit(inv.bcMiss):''}</div>")
    return a, n
