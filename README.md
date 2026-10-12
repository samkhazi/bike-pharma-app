# Bike Pharma website + app (bikepharma.com)

Ye branch (`website`) = poori website (landing page + app, har profile) + Node.js server + database ka code.
Server khud logins sambhalta hai (customer/mechanic: mobile + OTP, staff: email + password) aur shop ka data
(orders, bills, stock, warranties, staff...) sab devices me share rakhta hai.

Server: CloudPanel Node.js site, domain `bikepharma.com`, Node 22, port 3010, site user `bikepharma`,
folder `/home/bikepharma/htdocs/bikepharma.com`.

## 1. GitHub se jodna (sirf ek baar)
Mac terminal se script server pe bhejo, phir server pe root se chalao:
```bash
scp "$HOME/Bike Pharma Automobile APP UI/website-server/setup-github.sh" root@72.62.246.246:/home/bikepharma/htdocs/bikepharma.com/
ssh root@72.62.246.246
bash /home/bikepharma/htdocs/bikepharma.com/setup-github.sh
```
Script ek key dikhayega. Use https://github.com/samkhazi/bike-pharma-app/settings/keys/new pe daalo
(Title: `bikepharma.com server`, "Allow write access" OFF), phir terminal me Enter dabao.
Database (`data/`), `.env` aur `node_modules/` ko script haath nahi lagata.

## 2. Har update (ek command)
```bash
ssh root@72.62.246.246
bash /home/bikepharma/htdocs/bikepharma.com/update.sh
```
Ye GitHub se latest code leta hai, server restart karta hai aur `check.sh` se site check karta hai.
`!!` wali line aaye to wo line Claude ko bhejo.

## 3. Logins (customer, mechanic, staff)
- **Customer**: login page pe khud register / login karta hai (mobile + OTP + naam). Login page pe sirf yahi hai.
- **Mechanic**: khud signup nahi kar sakta. Jab Bike Pharma use pehla bill banata hai tab login banta hai:
  Billing login me Invoice > **Mechanic** > "+ New mechanic (first bill)" > mobile, naam, garage, area, GSTIN (agar hai).
  Bill bante hi wo number mechanic portal me OTP se login karta hai aur sirf apne bills, credit aur invoices dekhta hai.
  Admin > Users > Mechanics me login band / chalu kar sakte ho.
- **Staff**: Admin > Users > **New staff login**: naam + email/mobile + role (Billing / Sales / Manager / Inventory).
  Staff ko ek password milta hai (sirf ek baar dikhta hai; "Set a new password" se naya bana sakte ho).
- Terminal se: `node admin.mjs set-password staff@email.com`

## 4. OTP (SMS) — public site ke liye zaroori
Abhi `.env` me `OTP_MODE=fixed` hai: sabka OTP `123456`, matlab koi bhi kisi ka number daal ke login kar sakta hai.
Asli SMS ke liye MSG91 account banao (msg91.com, OTP template approve karao), phir `.env` me:
```
OTP_MODE=msg91
MSG91_AUTHKEY=...
MSG91_TEMPLATE_ID=...
```
aur `bash update.sh` (ya `npx pm2 restart bikepharma`).

## 5. Shop ki details (phone, UPI, GSTIN, address)
App me Admin > More > **Business settings** > "Shop details on invoice". Jab tak ye nahi bharte, app me
"To be added" dikhta hai aur Call/WhatsApp button "number will be added soon" bolte hain.

## 6. Catalogue (brand by brand)
Abhi site pe **KTM, Husqvarna, Hero, Royal Enfield, Yamaha, Honda, TVS** ka catalogue hai; baaki brands Find Part me
"Catalogue coming soon" dikhate hain aur aapki files aane pe ek ek karke aayenge.
- Kaunsa folder chunna hai (aapke Mac pe All Catalogues > BikeSurgeon_Catalog_Import ke andar), kitna bada:
  Hero 2 zip 1.63 GB · Royal_Enfield 2 zip 1.05 GB · Yamaha 6 zip 5.35 GB · Honda 1 zip 8.09 GB · TVS 1 zip 0.28 GB.
  TVS ki PDF books: folder All Catalogues > **TVS ALL** (49 PDF me se sirf 17 jaati hain, 0.13 GB).
  Zips jaise hain waise hi jati hain (unzip mat karna). Upload page server ki khali jagah (free space) bhi dikhata hai.
- Part list (`public/cat/<brand>.json`) GitHub se update ke saath aati hai (private repo). Ye sirf staff login se khulti hai.
- Diagrams aur part photos brand ki apni PDF / zip files se khulte hain, bilkul original quality me (koi compression nahi).
  Files Admin > More > **Catalogue files** se upload hoti hain aur `data/project-files/catalogues/<brand>/` me rehti hain
  (update me kabhi delete nahi hoti, backup me `data/` aata hai).
- Upload page sirf wahi files bhejta hai jo catalogue ko chahiye. Jo file server pe pehle se hai (same size) wo dobara
  nahi jati. Connection toot jaye to wahi folder dobara chuno: file wahi se aage chalti hai.

## 7. Kaam ke commands (site folder me, site user se)
```bash
npx pm2 status                 # chal raha hai?
npx pm2 logs bikepharma        # logs
bash restart.sh                # restart
bash check.sh                  # site ki jaanch
node admin.mjs list            # saare logins
node admin.mjs clear-demo      # purana demo data dobara hatao (server ye ek baar khud karta hai)
curl http://127.0.0.1:3010/api/health
```
Backup = `data/` folder copy kar lo. Update me `data/` kabhi delete mat karo.

## Badlav
**Update 8j (12 Oct 2026)**
- Website ka upar wala search bar: part number likh kar Enter dabao. Dukaan ke records (bill, customer, stock) me nahi hai to
  seedha Find Part khulta hai aur catalogue ka part dikhata hai (jaise 36JG0016 = 36JU0138 ka naya number).
  Universal search me bhi ab "Find Part" button hai: wahi shabd sabhi brand catalogues me dhoondta hai.
- Find Part: "piston ring" ab KTM 200 Duke / RC 200 me bhi milta hai (KTM aur Bajaj use "Kit Ring Set" likhte hain).
- Find Part ka 4 round test: `node tools/test_fp_all.mjs` (part number, naam, galat spelling, brand > model > year > section,
  alternate list, Search by vehicle; computer aur phone).

**Update 8i (12 Oct 2026)**
- oemship.com ki "Spares alternate items list" (KTM, Bajaj, Triumph) server me jud gayi: 3,701 purane/naye number ke jode.
  Find Part, Add product aur Stock in me purana ya naya number likho to dusra number aur uske parts dikhte hain
  (line: "From the oemship.com alternate list"). Ye list Sam ne di hai, isliye Admin approval nahi chahiye.
- Galat lage to Admin > More > Alternate numbers me "Not right" dabao, wo jawab band ho jaata hai.
- Web agent ab is order me dhoondta hai: pehle Scribd, phir oemship.com, phir baaki internet.
- Nayi list aaye to `tools/altlist_build.py` ke SOURCES me jodo, `python3 tools/altlist_build.py` chalao, phir build.

**Update 8h (12 Oct 2026)**
- Naya: Admin > More > Alternate numbers = web agent. Jo part number kisi catalogue me nahi milta (Find Part, Add product,
  Stock in ki "Not in a catalogue" line), wo is list me jaata hai. Agent har number pehle Scribd par, phir baaki internet par
  dhoondta hai (Claude web search; Google ka Gemini nahi) aur batata hai: part ka naam, brand, aur dusra number jo hamare
  catalogue me hai, saath me wo page jahan se mila.
- Catalogue files kabhi nahi badalti. Agent ka jawab alag list me rehta hai; Admin "This is it" dabaye tabhi Find Part
  us number par dusre number ke parts dikhata hai (upar line: "Found by the web agent, approved by Admin").
- Chalu karna: console.anthropic.com > API keys se key banao (thoda credit daalo), phir Admin > More > Alternate numbers me
  paste karo (key sirf server me rehti hai, app me kabhi wapas nahi aati). Ya `.env` me `ANTHROPIC_API_KEY=` likho.
- Default 10 number roz (Admin badal sakta hai, 0-200). Kharcha page par dikhta hai (aaj / is mahine, lagbhag ₹).
  Jo number nahi mila, wo 7 din baad dobara (3 baar tak).

**Update 8g (12 Oct 2026)**
- Find Part > Search by vehicle: model chunte hi Engine (cc) me sirf usi model ka CC aata hai (khud chuna hua), aur Year me sirf usi
  model ke saal. Ek hi saal ho to wo khud chuna jaata hai, aur "Search parts" seedha sections kholta hai.
- Jis model ka CC catalogue me nahi hai (jaise Scooty, iQube), wahan "Not listed" dikhta hai.
- CC pehle chuno to Model list me sirf usi CC ke models aate hain ("Any cc" se hata sakte ho). Model chunne ke baad list chhoti nahi hoti.

**Update 8f (12 Oct 2026)**
- TVS catalogue me aapke folder "All Catalogues > TVS ALL" ki 17 PDF books jud gayi: 14,401 nayi lines, 1,780 naye part number,
  2 naye models (Scooty, Scooty Teenz) aur 30 nayi editions (Flame 125, Scooty Streak, Jive, RR 310 BSVI, Pep / Pep+, Star City /
  Sport / Star City Plus, Apache 160 4V Ride Mode, Raider 125, Wego, Apache 200 4V, Ntorq 125, iQube, Apache colour parts).
  Diagram = book ka apna page, original quality.
- Baaki 32 PDF ke parts pehle se catalogue me hain (ya wo dusri book ki copy hain): wo upload nahi hoti.
- Naye part numbers ka MRP abhi nahi hai (in books me MRP nahi chhapa). Purane numbers ka MRP waise hi dikhta hai.
- Upload: Admin > More > Catalogue files > TVS > folder "All Catalogues > TVS ALL" chuno. Sirf 17 books (130 MB) jaati hain.

**Update 8e (11 Oct 2026)**
- Product photo ki safai (v3): kamre ki peeli/neeli roshni ka rang hat jaata hai (photo ke apne background se), part ke neeche halki
  parchhai (safed part bhi safed background pe dikhta hai), Bike Pharma logo aur halka. 12 MP photo ab ~3.5 second (pehle 6-7).
- Photo khud apna kaam check karti hai: part kata to nahi, haath to nahi bacha. Gadbad lage to 2-3 tareeke se dobara banti hai aur
  sabse achhi rakhi jaati hai. Kaunsa tareeka kis tarah ki photo pe jeeta, server yaad rakhta hai (data/photos/ai-learn.json) aur
  agli baar pehle wahi lagata hai. Claude ke tokens nahi lagte: sab aapke server pe chalta hai.
- Photo ke neeche "Not right?": dabane pe wo photo dusre tareeke se dobara banti hai, aur us tareeke ka ek point kat jaata hai
  (isse bhi seekhta hai). Photo me dikkat ho to neeche likha aata hai, jaise "Retake: hand on the part".
- Purani saari photos ek baar naye tareeke se dobara banengi (khud, peeche-peeche).
- Catalogue file ke naam me do dot (jaise "APACHE 160 4V PC ,..pdf") ab upload aur open hote hain.

**Update 8d (11 Oct 2026)**
- Supplier bill jisme "Rate" column asal me MRP hai aur Amount discount ke baad (jaise TVS distributor ka bill): ab rate = amount ÷ qty
  aata hai (taxable, GST ke bina), aur bill ka rate MRP me jaata hai. Har line pe GST 18% aur "Disc 23% (calculated from MRP)".
- Phone photo me peeche ke page ki printing beech me aa jaye (jaise "088" qty ke aage, "0038838" amount ke baad) ya decimal chhoot jaye
  (56445 = 564.45): line dobara bill ke apne hisaab se padhi jaati hai. Sl. No. naam me nahi aata.
- Bill no. jisme saal ho (jaise ABC 1234/26-27), aur bina naam ke totals (Taxable, CGST = SGST, Total) ab padhe jaate hain. Peeche ki
  printing ke ulte shabd supplier ka naam nahi bante.

**Update 8c (11 Oct 2026)**
- Supplier bill "Apna AI" se padha jata hai: aapke apne server pe (free, koi paid service nahi). Bill ka page memory me padha jata
  hai, kahin save nahi hota. Server ka reader na chale to phone khud padhta hai. App aur website dono me.
- Paste supplier bill: phone pe "Take a photo" + "Photos or PDF" (ek bill ke 10-12 page ek saath), computer pe "Upload a photo or
  PDF". PDF ka text seedha padha jata hai. Do page pe aayi same line ek hi baar gini jaati hai.
- Bill se aata hai: supplier (GSTIN se pehchana), GSTIN (check digit jaancha), bill no., bill date, har line ka MRP, HSN, GST %,
  discount aur amount. Lines ka total bill ke Taxable / Total se milaya jata hai. Same bill dobara aaye to chetavni.
- Rate alert: pichle bill se rate badha/ghata, rate MRP se upar. Bill ka MRP list/catalogue se alag ho to dikhata hai.
- Jo part no. galat padha gaya: line pe tap karo, sahi number likho, turant dobara check. Ye fix us supplier ke agle bills pe khud
  lagta hai (supplier ka bill layout bhi yaad rehta hai).
- Post karne pe: bill ka MRP list me jata hai (customer/mechanic price % rule se), catalogue me bhi wahi MRP dikhta hai; HSN aur
  GST % bhi list me. Naye part bill ke HSN ke saath bante hain.
- Suppliers: har supplier ke bills (date, no., amount, Pending/Paid), part payment (date, Cash/UPI/Bank/Cheque), Outstanding,
  payment days. Admin ko due date se 3 din pehle, us din, aur late hone pe bell + home pe card. Bill no. ke aage "View": kya
  aaya, qty, rate, discount (bill pe na ho to MRP se nikala), HSN, GST, paid, balance.
- Phone ka neeche wala menu ab andar ke pages pe bhi rehta hai (jahan page ke apne neeche buttons hain wahan nahi), bubble
  ek tab se doosre tab pe slide karta hai.

**Update 8b (11 Oct 2026)**
- Product photo: ab sirf part rehta hai. Haath, ungliyan, peeche padi cheezein aur chhote tukde hat jaate hain, photo part pe
  square katti hai. Ye har nayi photo pe chalta hai. Purani photos ki copy bhi apne aap dobara banti hai (naya version, `.ai` file).
- Phone pe poora page zoom nahi hota (do ungli se, ya box tap karne pe bhi nahi). Diagram ya photo poori screen pe kholo to
  sirf wahi zoom hota hai: do ungli se, ya tap se (dobara tap = wapas poori screen).
- Inventory > Paste supplier bill: "Photo of the bill" button. Chhape hue bill ki photo kheencho, phone khud padhta hai: har line
  ka part no., qty aur rate box me aata hai aur neeche har line ka hisaab (list me hai / catalogue me mila / Not found). Jis line
  me part no. nahi mila wo alag dikhti hai (haath se daalo). Galat padha number catalogue se theek hota hai. Photo kahin upload
  ya save nahi hoti, sab phone pe hota hai (`public/vendor/ocr`, ~15 MB, pehli baar phone pe aata hai). Haath se likha bill theek
  se nahi padha jata.

**Update 8 (11 Oct 2026)**
- Inventory catalogue se: Add product, Stock in aur "Paste supplier bill" me part number daalo, brand, naam, MRP aur kaunsi
  bikes me lagta hai catalogue se khud aata hai. Customer aur mechanic price Admin ke % rule se (MRP − 5 % / − 15 %, badal sakte ho).
- Photo ke bina koi part stock me nahi jata: kam se kam 1 photo, zyada se zyada 4. Bina photo wala naya part "Waiting for photos" me rukta hai.
- Find Part: jo catalogue part stock me nahi hai, Inventory staff aur Admin ko uspe "Add to stock".
- Product photo: background khud white ho jata hai aur Bike Pharma ka logo halka sa part ke peeche. Kheenchi hui asli photo
  waisi hi rehti hai (sirf staff khol sakta hai); kisi photo pe "Original" tick karo to wo jaisi kheenchi waisi dikhti hai (logo peeche).
  Ye kaam server pe AI karta hai (`ai/` folder, apne process me, ek photo ek baar me). Pehle update me AI ka model (178 MB) ek baar
  download hota hai, isliye kuch minute lagte hain. Purani photos ki clean copy bhi apne aap banti hai. AI ko kaam ke waqt ~1 GB
  khali memory chahiye; kam ho to photo waisi hi dikhti hai aur AI thodi der baad phir try karta hai (`check.sh` batata hai).

**Update 7 (11 Oct 2026)**
- Hero, Royal Enfield, Yamaha, Honda, TVS ka catalogue aapke package se (All Catalogues > BikeSurgeon_Catalog_Import):
  Hero 49 models, Royal Enfield 28, Yamaha 96, Honda 44, TVS 27. Har section ka diagram aur Hero / Royal Enfield ke part
  photos aapki zip ke andar se byte-to-byte original.
- MRP: jin brands ka MRP hai (Hero, Royal Enfield, Yamaha, Honda, TVS) wo search ke har card, section ki table aur part page
  pe dikhta hai ("MRP ₹…"). KTM / Husqvarna ki files me MRP nahi hai.
- Compatible: ek hi part number doosre brand ki book me bhi ho to part page pe "Same part number in other brands" dikhta hai.
- Catalogue files page: har brand ka card, kaunsa folder chunna hai, aur server pe kitni khali jagah hai.

**Update 6c (11 Oct 2026)**: website ke andar khule app me bhi diagram khulte hain (pehle sirf seedha app.html me khulte the).

**Update 6 (11 Oct 2026)**
- Saara sample (demo) data hataya: demo products, demo mechanics (Ravi Kumar BP-MECH-1025 wagaira), unke bills, orders,
  suppliers, kharche, targets. Update ke baad server pehli baar chalte hi ye khud karta hai. Aapke logins, staff, settings,
  Inventory me daale products aur unke bills waise hi rehte hain. Jo hataya uski copy `data/removed-sample-data-<date>.json` me.
- Nayi shop ab bilkul khali shuru hoti hai. Invoice number saal ke hisaab se 1 se chalta hai (INV-2026-00001).
- Mac trackpad swipe / browser Back ab app ki pichhli screen pe jata hai, website pe nahi.
- Login ke baad logout karne tak landing page nahi aata: Back se bhi nahi, aur bikepharma.com dobara kholo to seedha app khulta hai.

**Update 5 (11 Oct 2026)**
- KTM + Husqvarna catalogue aapki 97 HD PDF se: KTM 32 models (87 model years, 6,559 part numbers), Husqvarna 3 models
  (10 model years, 1,891 part numbers). Har line ke saath usi model year ka apna diagram, PDF ke andar wali original
  photo byte-to-byte same.
- Admin > More > **Catalogue files**: KTM folder chuno, 78 PDF (1.30 GB) server pe jati hain. Baaki 19 PDF ke saare
  diagrams in 78 me same hain, wo nahi jati. Jab tak koi PDF nahi aayi, us diagram ki jagah "not on the server yet" likha aata hai.
- Find Part me sirf wahi brands chalte hain jinka catalogue aa gaya; baaki "Catalogue coming soon".
- Ek hi part number KTM aur Husqvarna dono me ho to part page pe "Same part number in other brands" dikhta hai.

**Update 4 (10 Oct 2026)**
- Login page pe ab sirf customer login / register. "Join as Customer" aur "Mechanic or staff?" hata diye.
- Mechanic login sirf uske pehle bill se banta hai (point 3). Bill pe mechanic ka naam, garage, area, GSTIN aata hai.
- Har mechanic ab sirf apna data dekhta hai (apne bills, credit, invoices); doosre mechanics ka kuch nahi.
- Mechanic app se khud bill ya payment nahi bana sakta: order WhatsApp / counter pe jata hai, payment shop leta hai.
- Staff login me ab Mechanic role nahi. Billing staff apna role badal ke admin nahi ban sakta.

**Update 3 (10 Oct 2026)**
- Landing page: "Back to website" button hata (browser Back se website pe aate ho), footer se UPI/Cash/Card hata.
- Phone (360px) aur 1024px screens pe header ke icons ab screen ke andar; 1100px se chhoti screen pe menu button.
- Right side pe dikhne wali grey chhaaya (band cart drawer ki) hata di. WhatsApp button ka text ab saaf padhta hai.
- Dark mode me app bar ka logo ab safed text wala. Browser tab me Bike Pharma ka icon.
- Dark mode me Estimate ki likhawat aur mechanic profile ke WhatsApp/Task button ab saaf padhte hain. Logo har page pe light + dark dono me check kiya.
- Security: customer/mechanic apna role (jaise admin) khud nahi badal sakte; naam/text me HTML ab chalta nahi.
- App se "Reset demo data" button aur demo wali likhawat hatayi. Nakli phone/UPI/GSTIN/address hataye (point 5).
- Update ab GitHub se ek command me (point 1 aur 2).

**Update 2 (10 Oct 2026)**
- Website seedha landing page pe khulti hai; Log in button (ya /#login) app kholta hai.
- Computer pe login page me sirf login/register form. Catalogue ka data site se hataya (point 6).

## Files
`server.mjs` server · `lib/` store, merge, sms, altagent (web agent) · `admin.mjs` commands · `public/` website (index.html landing,
app.html app) · `install.sh` pehli install · `update.sh` `restart.sh` `check.sh` `setup-github.sh` update ke scripts ·
`tools/` build + tests · `data/` database (sirf server pe) · `.env` settings (sirf server pe).
