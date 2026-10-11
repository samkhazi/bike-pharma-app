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
Abhi site pe **KTM + Husqvarna** ka catalogue hai; baaki brands Find Part me "Catalogue coming soon" dikhate hain aur
aapki files aane pe ek ek karke aayenge.
- Part list (`public/cat/<brand>.json`) GitHub se update ke saath aati hai (private repo). Ye sirf staff login se khulti hai.
- Diagrams brand ki apni PDF files se khulte hain, bilkul original quality me (koi compression nahi). PDFs Admin >
  More > **Catalogue files** se upload hoti hain aur `data/project-files/catalogues/<brand>/` me rehti hain
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
`server.mjs` server · `lib/` store, merge, sms · `admin.mjs` commands · `public/` website (index.html landing,
app.html app) · `install.sh` pehli install · `update.sh` `restart.sh` `check.sh` `setup-github.sh` update ke scripts ·
`tools/` build + tests · `data/` database (sirf server pe) · `.env` settings (sirf server pe).
