"""A part number no catalogue has fills from its other number (update 8l). Sam 2026-10-12 08:38Z sent Add product with 36JG0016
saying "Not in the catalogues" ("phir se waise hi aa raha he"): the oemship list gives its old number 36JU0138, which the KTM
catalogue has, but the page only told him to type the old number.

For staff, a number with no catalogue row now looks up its other numbers (the numbers Admin approved, then the alternate lists'
numbers our catalogues have). Name, brand, MRP and bikes fill in from that row in Add product, Stock in and Paste supplier bill;
the part keeps the number that was typed (the one on the box), and the card says which number filled it.
"""

AFJS = r"""
/* ---------- a number no catalogue has fills from its other number (update 8l, staff only; the part keeps the typed number) ---------- */
(()=>{if(typeof invLook!=='function')return;const f=invLook;let d=0;
 invLook=function(pn,defer){const o=f(pn,defer);if(d||o.st!=='done'||o.hits.length||typeof SRV==='undefined'||!altStaff())return o;
  altListLoad();altLoad();if(ALTL.st===1)return Object.assign({},o,{st:'wait',need:[],pend:['alternate number']});
  d=1;try{const pk=catPk(pn),P=String(pn).trim().toUpperCase();
   for(const al of altAll(pn)){const p=f(al.alt,defer);
    if(p.st==='wait')return Object.assign({},o,{st:'wait',need:p.need,pend:p.pend});
    if(p.st==='done'&&p.hits.length)return Object.assign({},o,{hits:p.hits.map(h=>{INV_RK.set(h.vb+'|'+pk,h.pk);return Object.assign({},h,{pn:P,pk,via:al});})});}
   return o;}finally{d=0;}};})();
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        c = a.count(old)
        assert c == count, (c, old[:90])
        a = a.replace(old, new); n += 1

    assert '123456' not in AFJS and '</script' not in AFJS
    sub("/* ---------- Waiting for photos ---------- */", AFJS.strip() + "\n/* ---------- Waiting for photos ---------- */")
    # the catalogue row (photo) of a hit that came through another number
    sub("const invRowOf=(vb,pk)=>{", "const INV_RK=new Map();\nconst invRowOf=(vb,pk)=>{")
    sub("const rs=catPkRows(vb,pk);return rs.find(x=>x.ph)||rs[0]||null;};",
        "const rs=catPkRows(vb,INV_RK.get(vb+'|'+pk)||pk);return rs.find(x=>x.ph)||rs[0]||null;};")
    # Add product: say which number filled it
    sub("Other brand</button>`:''}</div>", "Other brand</button>`:''}</div>${h.via?altVia(a.pn,h.via):''}")
    # Stock in: the new-part line keeps it and says so
    sub("mrpCat:!!h.mrp,fits:h.fits,photos:[],bin:'',q:1,rate:''};}", "mrpCat:!!h.mrp,fits:h.fits,photos:[],bin:'',q:1,rate:'',via:h.via||null};}")
    sub("<div class=\"cap num\">${esc(n.pn)}</div><div class=\"cap\">${esc([n.vb,n.sec,n.qty?n.qty+' per bike':''].filter(Boolean).join(' · '))}</div>",
        "<div class=\"cap num\">${esc(n.pn)}</div><div class=\"cap\">${esc([n.vb,n.sec,n.qty?n.qty+' per bike':''].filter(Boolean).join(' · '))}</div>${n.via?altVia(n.pn,n.via):''}")
    # Paste supplier bill (its first screen and the bill reader's one that replaced it)
    sub("<b>${esc(h.name)}${r.kind==='new'?' · '+esc(h.vb)+' catalogue':''}</b>",
        "<b>${esc(h.name)}${r.kind==='new'?' · '+esc(h.vb)+' catalogue':''}${h.via?' · same part as '+esc(h.via.alt):''}</b>", 2)
    # the lists arrive after the page drew: draw the inventory pages again too
    sub("ALTL.m=m;ALTL.st=2;try{const s=cur().s;if(s==='altno'||(s==='findpart'&&(cur().p||{}).v==='res'))refresh();}catch(e){}})",
        "ALTL.m=m;ALTL.st=2;try{const s=cur().s;if(s==='altno'||(s==='findpart'&&(cur().p||{}).v==='res'))refresh();else if(['addproduct','grnedit','invpaste'].includes(s))invRefresh();}catch(e){}})")
    return a, n
