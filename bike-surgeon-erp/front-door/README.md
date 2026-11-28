# Front door: one link, mobile number or email login

panel.bikesurgeon.online opens this app. People sign in with their mobile number (or email) + password; their login lists the panels they
may open (first one opens after sign in) and who they are inside each panel (phone + PIN of that panel, kept
encrypted with GATE_KEY). The front door signs in to the panel for them, keeps that panel's cookie on the server and
passes every page and API call through. The owner can switch panels and add or change logins at /__gate/logins.

- Start: `npm start` (no packages needed, Node 22.9+). Test: `npm test`.
- .env: PORT, GATE_KEY (long random, never change it), COOKIE_SECURE=1 on https, START_PIN, PIN_<PANEL> (e.g.
  PIN_ADMIN), PORT_<PANEL> to move a panel, GATE_OWNER_EMAIL / GATE_OWNER_PASSWORD for the first run (else a random
  password is printed in the log once).
- Panel list, ports and people: `server/portals.js`. Data: `data/front.db` (SQLite), or DB_FILE.
- Wrong password 5 times = 10 minutes wait. A panel's own Sign out button signs out of the front door too.

## One screen (Sam, 5 Nov 2026)
After sign in nobody picks a panel. `/` is the one screen (public/shell.html + shell.js): one menu on the left with the
pages of every panel of this login, grouped by panel (Inventory last; the owner's groups fold, the open one is unfolded).
Each panel runs in a frame at `/p/<key>/`; the front door adds `/__gate/inshell.css` + `inshell.js` to it, which hide the
panel's own sidebar and phone bar and keep its `/api/...` calls on that panel. The front door also finds the panel of a
request from the `x-gate-p` header or the page it came from (Referer `/p/<key>/...`: links, pictures, CSV downloads).
A click in the menu shows that panel and clicks the same item in its own (hidden) menu, so every panel works as before.
Each panel at its own `/p/<key>/` path also means the browser never mixes up two panels' app.js. Sign in and sign out send
`Clear-Site-Data: "cache"` so old copies kept by the browser (Cloudflare's 4-hour browser cache) go away.
The old one-panel way (`/__gate/switch`, the bottom-right button) still works for any page outside the one screen.

## Name-wise logins (Sam, 26 Nov 2026)
Every staff member has their own login (mobile number + password) and is their own person, with their own PIN, inside
every panel of their role: the names and roles of Saddam sir's panels (`tools/name-logins.js`, list at its top). The
mobile numbers come from the attendance app (`tools/att-people.php`, only reads). The server takes it from GitHub with
`bike-surgeon-erp/update.sh` (as root, see ../README.md): it backs up every database to /root first, writes the new
passwords and PINs only to /root/bikesurgeon-staff-logins.txt, and keeps the older email logins working (as the real
person) until `bash /root/bs-erp-update.sh old-off`. `bash /root/bs-erp-update.sh undo` puts the logins back, one update
at a time. A staff member's own PIN is the one a screen asks for (the cashier's evening closing takes the cashier's and
the accountant's own PINs).

## Vehicle number page (Sam, 27 Nov 2026: "VR Garage in job card + billing counter")
`/__gate/gaadi` (public/gaadi.html + gaadi.js, server/vehicles.js) is at the top of every login's menu in the one screen. A
registration number gives the chassis, model, engine number and owner from VR Garage; staff can change the customer name and
the model. Each number is asked ONLY ONCE: VR Garage's answer is kept in `data/front.db` (table vehicles, every search in
vr_calls) for ever. The front door reads the billing's `job_card` table (read only, the admin panel's OLD_DB_* lines copied
into .env by update.sh) every 5 seconds: a number shows its job cards at once, and the vehicle of every job card made after
the first read is asked by itself, once (last 3 days only). The Cashier shows the model, chassis and engine under a ready
vehicle (`/__gate/api/vehicle/many`, saved data only, never a new search).
- .env: VRGARAGE_EMAIL (the login: a mobile number or an email, sent as VR Garage's web app sends it) + VRGARAGE_PASS64 (typed
  on the server: `bash /root/bs-erp-update.sh vrgarage`, the login is tried first), VRGARAGE_URL, VR_MAX_DAY (300 searches a day), VR_MAX_PERSON_DAY (60), GAADI_SECONDS (5), GAADI_LIVE=0 (no billing read).
- API (any signed-in login): GET /__gate/api/vehicle?no=…[&look=1], POST /__gate/api/vehicle {no, name, model},
  GET /__gate/api/vehicle/recent, GET /__gate/api/vehicle/many?nos=…; owner: POST /__gate/api/vehicle/again {no}.
