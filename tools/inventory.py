"""Sam 2026-10-11 08:01Z: "admin page pe inventory add karne ka option hi nhi he".
Admin gets the whole inventory: an Inventory page (Overview and More) with Add product, Stock in (supplier bill / GRN),
stock count, adjustments, damaged, returned, expiry & batch, cycle count, supplier return, labels and suppliers.
The supplier lists of Stock in, purchase orders and supplier returns are this shop's own suppliers (Admin > Suppliers);
Stock in also takes a new supplier's name and adds it. A shop with no products yet gets "add a product first" instead of a
broken screen, and the scan boxes take a barcode gun / typed code instead of picking a random part."""

INVJS = r"""
/* ---------- Admin inventory (Sam 2026-10-11): one page for adding products and stock ---------- */
const invEmpty=()=>`<div class="scroll"><div class="pad"><div class="empty">No products yet. Add a product first, with its opening stock.</div>${allowed('addproduct')?`<button class="btn" onclick="S.ui.ap=null;S.ui.apErr=null;go('addproduct')">${ic('plus','s18')} Add product</button>`:''}</div></div>`;
function invTab(s){if(S.user&&S.user.role==='admin'){S.stack[S.stack.length-1]={s,p:{}};render('fade');}else tab(s);}
const invBtns=()=>`<div class="grid2"><button class="btn" onclick="S.ui.ap=null;S.ui.apErr=null;go('addproduct')">${ic('plus','s18')} Add product</button><button class="btn line" onclick="go('grn')">${ic('down','s18')} Stock in</button></div>`;
SCREENS.ainv=()=>{const pend=pendingGrns();const acts=[['Products & stock','grid',"go('stocklist')"],['Stock count','clip',"S.ui.mv=null;go('stockmove',{type:'count'})"],['Adjustments','sliders',"S.ui.mv=null;go('stockmove',{type:'adjust'})"],['Damaged','alert',"S.ui.mv=null;go('stockmove',{type:'damaged'})"],['Returned','history',"S.ui.mv=null;go('stockmove',{type:'returned'})"],...(BRANCHES.length>1?[['Transfer','truck',"S.ui.mv=null;go('stockmove',{type:'transfer'})"]]:[]),['Expiry & batch','clock',"go('batches')"],['Cycle count','clipboard',"S.ui.cc={};go('ccount')"],['Supplier return','truck',"S.ui.sr=null;go('sreturn')"],['Print labels','tag',"go('labels')"],['Suppliers','users',"go('asupp')"],['Scan to find','scan',"S.ui.scanHit=null;S.ui.scanMiss=null;go('scanfind')"]];
 return bar('Inventory')+`<div class="scroll"><div class="pad">
 ${invBtns()}
 <p class="cap"><b style="color:var(--ink)">Add product</b>: a new part with its prices and opening stock. <b style="color:var(--ink)">Stock in</b>: parts received on a supplier bill; stock goes up when you post it.</p>
 <div class="grid2">${tileBtn('','Products',String(PRODUCTS.length),PRODUCTS.length?'in the shop':'none added yet',"go('stocklist')")}${tileBtn('b','Stock in',String(pend.length),pend.length?'waiting to be posted':'nothing pending',"go('grn')")}${tileBtn('y','Low stock',String(lowList().length),'below reorder level',"go('invlist',{kind:'low'})")}${tileBtn('r','Out of stock',String(outList().length),'parts',"go('invlist',{kind:'out'})")}</div>
 ${sec('More')}
 <div class="grid3">${acts.map(([l,i,o])=>`<button class="qa2" onclick="${o}"><span class="tile sm">${ic(i,'s20')}</span>${l}</button>`).join('')}</div>
</div></div>`;};
/* Stock in opened by Admin / Manager: a page with a back button (for the Inventory login it is a tab) */
{const g0=SCREENS.grn;SCREENS.grn=p=>S.user&&S.user.role!=='inventory'?bar('Stock in')+g0(p).replace('<h1 class="h1">Stock in</h1>',''):g0(p);}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'inventory.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    # Admin may open every inventory screen
    sub(" admin:['findpart','catup','tyrebat',",
        " admin:['ainv','grn','grnedit','grnview','stockmove','batches','ccount','sreturn','labels','findpart','catup','tyrebat',")
    # where Admin finds it: Overview and More
    sub("\n ${sec('Stock & operations')}\n",
        "\n ${sec('Inventory')}\n <div class=\"grid3\">${[['Add product','plus',\"S.ui.ap=null;S.ui.apErr=null;go('addproduct')\"],['Stock in','down',\"go('grn')\"],['All inventory','package',\"go('ainv')\"]].map(([l,i,o])=>`<button class=\"qa2\" onclick=\"${o}\"><span class=\"tile sm\">${ic(i,'s20')}</span>${l}</button>`).join('')}</div>\n ${sec('Stock & operations')}\n")
    sub("${li('Products & stock','Add products and stock','','package',\"go('stocklist')\")}",
        "${li('Inventory','Add product, stock in, stock count','','package',\"go('ainv')\")}${li('Products & stock','All parts with stock and rack','','grid',\"go('stocklist')\")}")
    # Products & stock: Add product / Stock in buttons for Admin, a real empty state
    sub(" ${asTab?`<div class=\"sec\"><h1 class=\"h1\">Stock</h1>${edit?`<button class=\"btn sm\" onclick=\"S.ui.ap=null;S.ui.apErr=null;go('addproduct')\">+ Add product</button>`:''}</div>`:''}",
        " ${asTab&&S.user.role!=='admin'?`<div class=\"sec\"><h1 class=\"h1\">Stock</h1>${edit?`<button class=\"btn sm\" onclick=\"S.ui.ap=null;S.ui.apErr=null;go('addproduct')\">+ Add product</button>`:''}</div>`:''}${S.user.role==='admin'?invBtns():''}")
    sub(":'<div class=\"empty\">No part matches. Try the part number or a rack like A-3.</div>'}",
        ":PRODUCTS.length?'<div class=\"empty\">No part matches. Try the part number or a rack like A-3.</div>':'<div class=\"empty\">No products yet.'+(edit?' Tap <b>Add product</b> to add your first part with its opening stock.':'')+'</div>'}")
    sub("<button class=\"btn\" onclick=\"closeSheet();tab('stocklist')\">View stock list</button>",
        "<button class=\"btn\" onclick=\"closeSheet();invTab('stocklist')\">View stock list</button>")
    # suppliers = this shop's own list (Admin > Suppliers)
    sub("const SUPPLIERS=[];", "const supN=()=>sups().map(s=>s.n);")
    sub("{id:'new',supplier:SUPPLIERS[0],inv:''", "{id:'new',supplier:'',inv:''")
    sub("<div class=\"field\"><label for=\"ge-sup\">Supplier <span style=\"color:var(--r)\">*</span></label><div class=\"inp\"><select id=\"ge-sup\" style=\"border:0;background:transparent;flex:1;font-weight:600\" onchange=\"S.ui.ge.supplier=this.value\" ${isNew?'':'disabled'}>${SUPPLIERS.map(x=>`<option ${g.supplier===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div></div>",
        "<div class=\"field\"><label for=\"ge-sup\">Supplier <span style=\"color:var(--r)\">*</span></label><div class=\"inp ${e.sup?'err':''}\"><input id=\"ge-sup\" list=\"ge-sups\" autocomplete=\"off\" value=\"${esc(g.supplier||'')}\" placeholder=\"${supN().length?'Pick or type the supplier':'Supplier name, e.g. Sharma Auto Distributors'}\" oninput=\"S.ui.ge.supplier=this.value\" ${isNew?'':'disabled'}><datalist id=\"ge-sups\">${supN().map(x=>`<option value=\"${esc(x)}\"></option>`).join('')}</datalist></div>${e.sup?`<div class=\"errmsg\">${e.sup}</div>`:''}</div>")
    sub("function geSave(post){const g=S.ui.ge;const e={};if(!g.inv.trim())e.inv='Enter the supplier bill number.';",
        "function geSave(post){const g=S.ui.ge;const e={};const sn=String(g.supplier||'').trim();if(!sn)e.sup='Enter the supplier name.';if(!g.inv.trim())e.inv='Enter the supplier bill number.';")
    sub(" if(g.id==='new')g.id='GRN-0'+",
        " {const s0=sups().find(s=>s.n.toLowerCase()===sn.toLowerCase());if(s0)g.supplier=s0.n;else{g.supplier=sn;sups().unshift({n:sn,c:'—',gst:'—',pay:0,days:30,lead:3,fill:100,rate:5,cat:'General'});audit('Supplier added',sn,'—','From stock in');}}\n if(g.id==='new')g.id='GRN-0'+")
    sub("toast(post?`${g.id} posted · ${grnUnits(g)} units added`:`${g.id} saved as draft`);tab('grn');}",
        "toast(post?`${g.id} posted · ${grnUnits(g)} units added`:`${g.id} saved as draft`);if(S.user.role==='inventory')tab('grn');else back();}")
    sub("sup:SUPPLIERS[0],items:{}", "sup:supN()[0]||'',items:{}")
    sub("${SUPPLIERS.map(s=>`<option ${s===r.sup?'selected':''}>${s}</option>`).join('')}",
        "${supN().map(s=>`<option ${s===r.sup?'selected':''}>${esc(s)}</option>`).join('')||'<option value=\"\">Add your suppliers in Admin > Suppliers</option>'}")
    sub("<button class=\"btn\" onclick=\"srSave(${tot})\" ${tot?'':'disabled'}>", "<button class=\"btn\" onclick=\"srSave(${tot})\" ${tot&&r.sup?'':'disabled'}>")
    sub("return SUPPLIERS.find(x=>x.toLowerCase().includes(b))||SUPPLIERS[1];}", "const l=supN();return l.find(x=>x.toLowerCase().includes(b))||l[0]||'';}")
    sub("${SUPPLIERS.map(x=>`<option ${po.supplier===x?'selected':''}>${esc(x)}</option>`).join('')}",
        "${supN().map(x=>`<option ${po.supplier===x?'selected':''}>${esc(x)}</option>`).join('')||'<option value=\"\">Add your suppliers in Admin > Suppliers</option>'}")
    assert 'SUPPLIERS' not in a
    # Stock in: a barcode gun or a typed code adds the part (no random "scan")
    sub("<div class=\"sec\"><h3 class=\"h2\">Items (${g.items.length})</h3><div class=\"row\" style=\"gap:8px\"><button class=\"btn line sm\" onclick=\"geScan()\">${ic('scan','s16')}Scan</button><button class=\"btn sm\" onclick=\"geAddSheet()\">+ Add</button></div></div>",
        "<div class=\"sec\"><h3 class=\"h2\">Items (${g.items.length})</h3><button class=\"btn sm\" onclick=\"geAddSheet()\">+ Add</button></div>\n <form class=\"row\" style=\"gap:8px\" onsubmit=\"event.preventDefault();geCode(this.querySelector('input').value)\"><label class=\"search grow\" for=\"ge-code\">${ic('scan','s20')}<input id=\"ge-code\" autocomplete=\"off\" placeholder=\"Scan barcode or type part no.\"></label><button class=\"btn line sm\" type=\"submit\">Add</button></form>")
    sub("function geScan(){const x=PRODUCTS[Math.floor(Math.random()*PRODUCTS.length)];geAdd(x.id);toast('Scanned '+x.pn+' · +1');}",
        "function geScan(){const i=document.getElementById('ge-code');if(i)i.focus();}\n"
        "function geCode(c){c=String(c||'').trim();if(!c)return;const x=findByCode(c);if(!x){toast('No part with code '+c+'. Add it as a new product first.');return;}S.ui.after=()=>{const i=document.getElementById('ge-code');if(i)i.focus();};geAdd(x.id);toast('Added '+x.pn+' · +1');}")
    # Scan to find: the box takes the barcode gun / typed code
    sub("function simScan(){const pool=PRODUCTS.filter(x=>x.id!==S.ui.scanHit);const x=pool[Math.floor(Math.random()*pool.length)];doScan(barcodeOf(x));}",
        "function simScan(){const i=document.getElementById('sc-code');if(i){i.value='';i.focus();}}")
    sub("Tap the box to scan. In this demo it picks a random part; the real app uses the camera or a barcode gun.",
        "Scan with a barcode gun, or type the barcode or part number below.")
    # a shop with no products yet
    sub("SCREENS.stockmove=(p)=>{const t=p.type;const m=MOVES[t];", "SCREENS.stockmove=(p)=>{const t=p.type;const m=MOVES[t];if(!PRODUCTS.length)return bar(m[0])+invEmpty();")
    sub("SCREENS.labels=()=>{const sel=S.ui.lb||(S.ui.lb={p1:2});",
        "SCREENS.labels=()=>{if(!PRODUCTS.length)return bar('Print labels')+invEmpty();const sel=S.ui.lb||(S.ui.lb={[PRODUCTS[0].id]:1});")
    sub("/* ---------- boot ---------- */\nasync function start(){", INVJS + "/* ---------- boot ---------- */\nasync function start(){")
    return a, n
