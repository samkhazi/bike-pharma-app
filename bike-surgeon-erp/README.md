# Bike Surgeon ERP 2.0 (panel.bikesurgeon.online)

The panels of Saddam sir's zip, live on the Bike Surgeon server (one link: panel.bikesurgeon.online). The server takes
the code from this folder with one root command; nothing is uploaded by hand.

```bash
curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/bike-surgeon-erp/update.sh -o /root/bs-erp-update.sh && bash /root/bs-erp-update.sh
```

After the first time: `bash /root/bs-erp-update.sh` (it takes the newest code from GitHub by itself and renews itself).
`bash /root/bs-erp-update.sh undo` puts the logins back as before the last update; `bash /root/bs-erp-update.sh old-off`
switches off the older role-email staff logins once everyone signs in with their own mobile number.

- `front-door/`: the sign-in and the one screen (mobile number or email + password), name-wise logins
  (`tools/name-logins.js`: the staff list, their panels and roles; mobile numbers come from the attendance app).
- `portals/`: changed files of the panels (the whole panels are on the server). `11-moto-lab/` (27 Nov): Mehek's
  Moto Lab panel on the real Moto Lab billing: `server/mldb.js` reads the billing's database itself (read only, a
  checksum check every 3 seconds, the bills worked out exactly like the billing); without the database lines in its
  .env it uses the admin panel's `GET /api/feed/motolab` once a minute (`01-admin-panel/server/oldbill.js`).
  `01-admin-panel/` (27 Nov): `server/oldbill.js` checks the Bike Surgeon billing's database every 3 seconds
  (`CHECKSUM TABLE`; only a changed table is read again, everything at least every 10 minutes; no checksums = every
  minute as before; a slow database makes it wait longer). `03-cashier/`: `server/oldlink.js` asks the admin panel's
  `GET /api/feed/cashier?v=` every 3 seconds (a tiny answer when nothing changed). Both screens look for changes every
  3 seconds. Every Bike Surgeon bill is worked out exactly like the billing's own calculation (includes/bs-invoice-calc.php
  of 28 Oct; checked against that PHP on all 5,513 bills of 24 Nov, equal to the paisa). `base-26nov.sha256`, `base-27nov.sha256`: the server's copies of each file before; update.sh replaces only
  those (or stops).
- New passwords and PINs are written only on the server, to `/root/bikesurgeon-staff-logins.txt`. No secrets, phone
  numbers or customer data are kept in this repository (it is public).
