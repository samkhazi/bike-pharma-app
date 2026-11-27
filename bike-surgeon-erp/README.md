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
  Moto Lab panel on the real Moto Lab billing (`server/oldlink.js` reads the admin panel's `GET /api/feed/motolab`
  every minute); `01-admin-panel/` gives that feed (`server/oldbill.js` works the Moto Lab bills out exactly like the
  billing). `base-26nov.sha256`: the server's copy of each file before; update.sh replaces only those (or stops).
- New passwords and PINs are written only on the server, to `/root/bikesurgeon-staff-logins.txt`. No secrets, phone
  numbers or customer data are kept in this repository (it is public).
