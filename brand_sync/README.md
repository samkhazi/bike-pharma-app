# brand_sync

Brand ke parts catalogue ko apne aap check karta hai aur sirf jo naya ya badla hai wahi uthata hai.
Har run ke baad ek report banti hai (aur chaho to email aati hai).

Abhi ready: **Hero DMS (har Saturday raat 9 baje)**, **Hero e-catalogue (har Sunday)**, **Bajaj**.

## Bike Pharma server pe (bikepharma.com)

1. Admin > More > Catalogue files > "Hero sync start data": Mac ke Downloads se `brand_sync.zip` upload karo.
2. Root se: `bash /home/bikepharma/htdocs/bikepharma.com/brand_sync/setup.sh`
3. `nano /home/bikepharma/htdocs/bikepharma.com/brand_sync/.env` me HERO_DMS_USER / HERO_DMS_PASS bharo.
4. setup.sh jo 2 cron lines dikhata hai, `crontab -u bikepharma -e` me daalo.

Sync ka data `data/project-files/catalogues/hero-sync` me jata hai. Website ka server har ghante dekhta hai: naya data aaya to
Hero catalogue khud dobara banta hai (naye models, diagrams, photos, MRP, purana -> naya). Jo diagram/photo Raw Data me pehle se hai
wo dobara download nahi hota (hero_have.json). Shop ke parts ka MRP sirf Admin > Catalogue files > Hero MRP check se badalta hai.

**Honda + TVS (15d):** Honda e-catalogue har Sunday subah 10 baje, TVS dealer DMS har Sunday dopahar 2 baje (server time).
Honda login pe code (captcha) aur TVS login pe OTP aap khud daalte ho: samkhazi25@gmail.com pe email aata hai ek link ke saath
(`https://bikepharma.com/honda-code/...` / `https://bikepharma.com/tvs-otp/...`), link kholo, code/OTP type karo. Tool code kabhi khud
nahi padhta. Code/OTP page sirf server ke andar chalta hai (CODE_BIND=127.0.0.1), website use https pe aage deti hai, koi port nahi kholna.
Email website ke apne SMTP (.env ka SMTP_*) se jata hai. Honda/TVS ka naya data (MRP, naye model, diagram, kits, purana -> naya) bhi
har ghante wale check se Honda/TVS catalogue me aa jata hai. TVS ka NDP kabhi app me nahi jata, sirf MRP.

## Setup (server pe ek baar)

```bash
cd brand_sync
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps chromium     # Hero DMS ke liye browser
cp .env.example .env                         # phir .env me HERO_DMS_USER / HERO_DMS_PASS bharo

# check: server se Hero e-catalogue khulta hai? "authToken" dikhna chahiye
curl -s -X POST https://ecatalogue.heromotocorp.biz:8080/HeroeCat/getGeneralUserDetails | head -c 200; echo

python sync.py hero        # pehli baar poora e-catalogue aata hai (442 models, 1-2 ghante)
python sync.py hero_dms    # pehli baar bhi sirf 27 Oct 2026 ke baad ka badlav (seed/ me us din ka poora data hai)
```

## Har Sunday apne aap (cron)

```cron
# Har Sunday raat 1 baje: Hero e-catalogue
0 1 * * 0  cd /path/to/brand_sync && .venv/bin/python sync.py hero >> data/logs/cron.log 2>&1
# Har Saturday raat 9 baje: Hero DMS (3-5 ghante, Sunday subah tak khatam)
0 21 * * 6  cd /path/to/brand_sync && .venv/bin/python sync.py hero_dms >> data/logs/cron.log 2>&1
```

DMS ek ID se ek hi login chalta hai. Saturday raat 9 baje ke baad us ID se browser me DMS mat kholna, warna sync beech me ruk jayega (aur aapka login bhi logout hoga).

## Hero e-catalogue (`python sync.py hero`) kya deta hai

- **Naye model:** list me aaye naye model + purane/hidden models (202). Naye model ki poori PDF banti hai.
- **PDF:** `output/Hero/PDF/Models/<Model>/<Variant> [CODE].pdf` : index, har diagram (original quality), parts table (Part No, Qty, MRP, aur kis model me lagta hai), A-Z list.
- **Naye part number, MRP badla, parts badle** (kis model ke kis diagram me) : report me.
- **Purana ↔ naya:** `output/Hero/Hero_Purana_Naya.xlsx` : sheet "Purana -> Naya" (final number tak) aur "Naya -> Purane" (ek naye part ke saare purane numbers).
- `output/Hero/Hero_All_Parts.xlsx` : saare part numbers A-Z, kis model me.
- `hero/hero_ecat_mrp.csv` : har part ka MRP (dash wala aur bina dash).
- `hero/diagrams/`, `hero/photos/` : diagram aur part photo, Hero jaisa deta hai waisa hi (koi compression nahi).

## Hero DMS (`python sync.py hero_dms`) kya deta hai

DMS se har Saturday raat: saare part numbers (~55k), unka MRP (poori MRP list), superseded, active/band, aur naye parts ke models.

- `output/Hero DMS/Hero_DMS_Report_<date>.xlsx` : Naye Parts (models ke saath), MRP Badla, Naye Superseded, Band Hue, Naye Models, Purana -> Naya (sab), Naya -> Purane (sab)
- `output/Hero DMS/Hero_DMS_Parts.csv` : har part: naam, MRP, kab se, HSN, group, active, superseded by, models
- `output/Hero DMS/mrp_changes_<date>.csv` : part_no, old_mrp, new_mrp, effective_from, name

DMS me diagram, photo, variant, year aur cc nahi hote. Wo e-catalogue sync se aate hain.

### Server pe MRP update

Do tarike:
1. `mrp_changes_<date>.csv` ko apne server ke DB me import karo (Bike Pharma wala agent ye jod sakta hai).
2. `.env` me `HERO_MRP_WEBHOOK=https://aapka-server/api/hero-mrp` do. Har run ke baad badle MRP is URL pe POST hote hain:
   ```json
   {"source": "hero_dms", "date": "2026-11-01",
    "changes": [{"part_no": "12310AAM000S", "old_mrp": 740, "new_mrp": 755, "effective_from": "27/06/2026 05:30:00 AM", "name": "COVER COMP"}]}
   ```
   `HERO_MRP_WEBHOOK_TOKEN` diya ho to header `Authorization: Bearer <token>` jata hai.

### Ek part ka live MRP

```bash
python sync.py hero_dms --part 12310AAM000S
```
DMS me login karke us part ka abhi ka MRP deta hai (lagbhag 1 minute).

## Commands

```bash
python sync.py hero             # e-catalogue: check + sirf badle model ki PDF
python sync.py hero --full      # sab dobara
python sync.py hero --rebuild   # download nahi, saved data se saari PDF/Excel dobara
python sync.py hero_dms         # DMS monthly
python sync.py bajaj            # Bajaj
```

## Dhyan rahe

- Login sirf `.env` me. File kisi ke saath share mat karna.
- Hero e-catalogue sirf India ke IP se chalta hai.
- DMS sync kabhi galti se kuch delete ya change nahi karta. Sirf query aur Export use karta hai.
- DMS login me kabhi OTP ya captcha aa gaya to sync ruk jayega. `data/logs/` me screenshot milega.
- Agar export adhoora aaye (90% se kam parts) to sync kuch bhi update nahi karta aur report me error aata hai.
- 3-wheeler, KTM aur Husqvarna Bajaj me skip hote hain.

## Royal Enfield (16n)

Do sync, dono har Sunday, Mac ki zaroorat nahi:
- `python sync.py re_spares` (subah 4 baje): spares.royalenfield.com se saare parts, MRP aur kaun se model me. Login nahi.
  robots.txt allow na kare to kuch nahi leta aur report me likhta he.
- `python sync.py royal_enfield` (subah 5 baje): dealer EPC (login `.env` me RE_EPC_USER / RE_EPC_PASS): naye model, variant,
  diagram (SVG), parts lists.

**EPC is server se seedha nahi khulta**: RE ka Akamai firewall data-centre IP ko 0.04 sec me "Access Denied" deta he
(IPv4/IPv6, browser header ke saath bhi). Isliye sirf EPC wala browser `RE_EPC_PROXY` se jata he, baaki server apne IP se.

Phone wala tarika (free):
1. Dukaan pe ek purana Android, Jio/Airtel SIM ke saath (WiFi nahi, mobile data), hamesha charging pe.
2. Phone pe **Tailscale** app (same account) aur **Every Proxy** app: HTTP proxy ON, port 8080.
3. Server pe Tailscale (sirf jodne ke liye, exit node NAHI):
   `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up`
4. `tailscale status` me phone ka 100.x.y.z IP dekho. `brand_sync/.env` me: `RE_EPC_PROXY=http://100.x.y.z:8080`
5. Check: `curl -x http://100.x.y.z:8080 -s -o /dev/null -w "%{http_code}\n" https://epc.royalenfield.com/ACD/delivery` -> 200

Paid proxy (koi device nahi): Indian residential proxy lo aur `RE_EPC_PROXY=http://user:pass@host:port`.

Proxy band ho ya block ho to RE EPC sync ruk jata he aur report me saaf likha aata he; re_spares phir bhi chalta he.

