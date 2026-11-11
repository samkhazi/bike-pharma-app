#!/usr/bin/env python3
import json, os, re, subprocess, sys, time

API   = "https://catapiprd.lgbportal.co.in/"
OUT   = os.path.expanduser("~/rolon_dump")
STATE = os.path.join(OUT, "_state.json")
os.makedirs(OUT, exist_ok=True)

S = {"tok": None, "lid": None}

def _post(body):
    cmd = ["curl","-sS","--noproxy","*","-X","POST",API,
           "-H","Content-Type: application/json",
           "-H","X-Requested-With: XMLHttpRequest","-d",json.dumps(body)]
    if S["tok"]: cmd += ["-H","authorization: "+S["tok"]]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    raw = (p.stdout or "").strip()
    if not raw: return {"_empty": True}
    try: v = json.loads(raw)
    except Exception: return {"_raw": raw[:200]}
    return v if isinstance(v, dict) else {"_val": v}

def refresh():
    r = _post({"apitype":"accesstoken","loginid":"test","mobileno":"9999999999"})
    if "access_token" not in r:
        print("TOKEN FAIL:", r, file=sys.stderr); sys.exit(1)
    S["tok"], S["lid"] = r["access_token"], r["loginid"]

def call(ap, tries=4, **kw):
    for i in range(tries):
        r = _post({"apitype": ap, "loginid": S["lid"], **kw})
        if r.get("message") == "Token Not Valid":
            refresh(); time.sleep(0.6); continue
        if r.get("_empty") or "_raw" in r:
            time.sleep(0.8 * (i+1)); continue
        return r
    return r

def safe(s): return re.sub(r"[^A-Za-z0-9._-]+", "_", str(s))[:40]

# ---------- resume ----------
if os.path.exists(STATE):
    st = json.load(open(STATE))
    print("resuming:", len(st.get("master",{})), "brands already done", file=sys.stderr)
else:
    st = {"types": None, "brands": {}, "master": {}}

refresh()

# ---------- 1. types ----------
if not st["types"]:
    st["types"] = call("producttype")
    json.dump(st, open(STATE,"w"), indent=1, ensure_ascii=False)
types = st["types"].get("producttype", [])
print(f"types: {len(types)}", file=sys.stderr)

# ---------- 2. brands ----------
for t in types:
    tid = t["id"]
    if str(tid) in st["brands"]: continue
    r = call("productsubtype", producttype=tid)
    st["brands"][str(tid)] = r.get("productsubtype") or []
    json.dump(st, open(STATE,"w"), indent=1, ensure_ascii=False)
    print(f"brands {tid:>3} {t['type'][:20]:20} {len(st['brands'][str(tid)])}", file=sys.stderr)
    time.sleep(0.3)

# ---------- 3. productmaster: type x brand ----------
total = sum(len(st["brands"].get(str(t["id"]), [])) for t in types)
done  = 0
for t in types:
    tid = t["id"]
    for b in st["brands"].get(str(t["id"]), []):
        brand = b["type"]
        key = f"{tid}|{brand}"
        done += 1
        if key in st["master"]: continue
        r = call("productmaster", producttypeid=tid, productbrand=brand)
        rows = r.get("productmaster") or []
        st["master"][key] = rows
        json.dump(st, open(STATE,"w"), indent=1, ensure_ascii=False)
        want = b.get("brandcount")
        flag = "" if (want is None or len(rows) == want) else f"  !! expected {want}"
        print(f"[{done:>3}/{total}] {t['type'][:16]:16} {brand[:20]:20} rows={len(rows):>4}{flag}", file=sys.stderr)
        time.sleep(0.35)

# ---------- 4. CSV ----------
import csv
rows_all = []
tname = {t["id"]: t["type"] for t in types}
for key, rows in st["master"].items():
    tid, brand = key.split("|", 1)
    for r in rows:
        d = dict(r); d["_type"] = tname.get(int(tid), tid); d["_typeid"] = tid
        rows_all.append(d)
if rows_all:
    cols = []
    for d in rows_all:
        for k in d:
            if k not in cols: cols.append(k)
    csv_path = os.path.join(OUT, "rolon_catalogue.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows_all)
    print(f"\nCSV: {csv_path}  ({len(rows_all)} rows, {len(cols)} cols)", file=sys.stderr)
    print("cols:", cols, file=sys.stderr)
