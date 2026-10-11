"""Sam 2026-10-11: "sample data jo kuch bhi he sabhi delete karde". The server build has no demo shop data at all:
no demo products, mechanics, customers, staff, bills, orders, offers, suppliers or made-up dashboard numbers.
Real data comes only from what people enter in the app (bills, products added in Inventory, staff logins, ...)."""
import re
from jslit import const_span

EMPTY = {
    # shop demo data
    'PRODUCTS': '[]', 'MECHS': '[]', 'SEED_BILLS': '[]', 'CPNS': '[]', 'SEED_BIKES': '[]', "DEMO_CUST": "''", 'SAVED_ADDR': '[]',
    'MECH_GEO': '{}', 'VEH': '[]', 'docsSeed': '()=>({})', 'CUST_HIST': '{}', 'SEED_ORDER_ITEMS': '{}', 'SEED_ORDER_X': '{}',
    'cwSeed': '()=>({})', 'BIKE_KM': '{}', 'MCUST_SEED': '[]', 'BEAT': '[]', 'BATCH_SEED': '()=>[]', 'STAFF_PERF': '[]',
    'expSeed': '()=>[]', 'SUP_SEED': '()=>[]', 'schSeed': '()=>[]', 'CUST_ADDR': '[]', 'SUPPLIERS': '[]', 'SEED_BARCODES': '{}',
    'SEED_FITS': '{}', 'SOLD30': '{}', 'LAST_SOLD': '{}', 'MECH_EXTRA': '[]', 'MECH_LAST': '{}', 'NEW_TODAY': '[]', 'OLD_MOBS': '[]',
    'MB': '{}', 'MB_ITEMS': '{}', 'PAYDAYS': '{}', 'MECH_INFO': '{}', 'PAY_OLD': '{}', 'PAY_CUR': '{}', 'CTR_MODES': '{}',
    'VERIFIED': '{}', 'NOT_VER': '{}', 'TGT_HIST': '[]', 'MG_BRANCHES': '[]', 'BRANCHES': '[]', 'SEC_ALERTS': '[]', 'RETURNS': '[]',
}

def apply(a):
    n = 0
    def rep(old, new, cnt=1, regex=False):
        nonlocal a, n
        if regex:
            a, c = re.subn(old, new, a, flags=re.S)
        else:
            c = a.count(old); a = a.replace(old, new)
        assert c == cnt, f'nosample: matched {c}x (wanted {cnt}): {old[:80]!r}'
        n += 1
    for name, val in EMPTY.items():
        s, e = const_span(a, name); a = a[:s] + val + a[e:]; n += 1
    # the database starts empty (same keys); flags of old start-up fixes stay set so they never add demo rows
    rep(r"function seed\(\)\{return\{\n cart:.*?\n notifs:0\};\}",
        "function seed(){return{orders:[],wl:[],cl:[],minv:[],pos:[],tasks:[],seedOT:1,sorders:[],omech:{},approvals:[],audit:[],bills:[],stock:{},accounts:{},moves:[],grns:[],warranties:[],bins:{},notifs:0,seed10:1,noSeed:1,cwlFix:1};}", regex=True)
    rep(r"function load\(\)\{DB=window\.BOOT_DB\|\|seed\(\);.*?\}\}\n",
        "function load(){DB=window.BOOT_DB||seed();window.BOOT_DB=null;{const sd=seed();for(const k in sd)if(!(k in DB))DB[k]=sd[k];}if(!DB.accounts)DB.accounts={};"
        "DB.bills.forEach(b=>{if(!b.items)b.items=[];if(!b.iso)b.iso=isoToday();});"
        "(DB.newProducts||[]).forEach(p=>{if(!P(p.id))PRODUCTS.push(p);});Object.entries(DB.prices||{}).forEach(([id,v])=>{const x=P(id);if(x)Object.assign(x,v);});}\n", regex=True)
    # a customer's own cart, bikes, addresses: empty to start; nobody shares a "demo customer" slot
    rep(r"function cuSeed\(k,u\)\{.*?\}\n", "function cuSeed(k,u){return clone({cart:[],wish:[],coupon:null,bikes:[],primary:null,addrs:[]}[k]);}\n", regex=True)
    rep(r"function perCust\(\)\{.*?\n CU_KEYS\.forEach\(k=>Object\.defineProperty\(DB,k,\{configurable:true,enumerable:false,get\(\)\{const u=S\.uid\|\|DEMO_CUST;.*?\}\}\)\);\}\n",
        "function perCust(){DB.cu=DB.cu||{};CU_KEYS.forEach(k=>{delete DB[k];});const T=perCust.t||(perCust.t={});\n"
        " CU_KEYS.forEach(k=>Object.defineProperty(DB,k,{configurable:true,enumerable:false,get(){const u=S.uid;const c=u?(DB.cu[u]||(DB.cu[u]={})):T;if(!(k in c))c[k]=cuSeed(k,u);return c[k];},set(v){const u=S.uid;(u?(DB.cu[u]||(DB.cu[u]={})):T)[k]=v;}}));}\n", regex=True)
    rep("DB.backup||(DB.backup={auto:1,last:'28 Sept · 2:00 AM'})", "DB.backup||(DB.backup={auto:0,last:''})")
    return a, n
