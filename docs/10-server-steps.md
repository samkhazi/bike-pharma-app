# Server steps (Bike Surgeon CloudPanel server, KL VPS 72.62.246.246)

The app runs on the same server as the billing, the admin panel and the Inventory. Setting it up is one command.
After that the server takes new code from GitHub by itself every 5 minutes.

## 1. Domain (one time)
In Cloudflare, add a DNS record: type `A`, name `api`, value `72.62.246.246`, Proxy **off** (DNS only).
The https certificate needs this record. Do not touch the `app` record: app.bikesurgeon.online is the live old app.

## 2. One command, as root on the server
```bash
curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/scripts/server/setup.sh -o /root/bs-app-setup.sh && bash /root/bs-app-setup.sh
```
The first time it asks two things:
- the test phone numbers that may log in (10 digits, comma between numbers)
- the workshop phone number that customers call and WhatsApp

Then it:
- makes the site `api.bikesurgeon.online` in CloudPanel (Node 22, port 3050, its own site user `bikesurgeon-api`). It is
  only for the app: no web pages. It stops without changing anything if another site already uses that address or
  that site user (`bikesurgeon-app` is the user of the live app.bikesurgeon.online).
- makes a PostgreSQL database for the app (installs PostgreSQL if it is missing)
- writes the settings file `/home/bikesurgeon-api/shared/.env`. The old billing login and the Inventory key are
  copied from the admin panel's `.env` and never printed. The old billing database is only read (`OLD_DB_WRITE=off`).
- builds the app, starts it with pm2 (name `bs-app`) and adds the 5-minute update and the restart after a reboot to cron
- asks Let's Encrypt for the https certificate

It ends with `All done`, the server address and the test login code. It takes about 5 to 10 minutes the first time.
It is safe to run again: if it stops with a message, fix that and run the same command.

**Ran it on 25 Nov 2026?** That first version put the app into `bikesurgeon-app`, the site user of the live
app.bikesurgeon.online, and made no `api` site (so the certificate failed). Run the same command again. It:
- asks the test numbers again (type your own numbers, or press Enter to keep them)
- stops the app there (only its own pm2 process and its own 2 cron lines), makes the `api` site with the user
  `bikesurgeon-api` and moves the app there with the same settings and test code
- parks the app's old files from `/home/bikesurgeon-app` in `/root/bs-app-moved-from-bikesurgeon-app-<date>`. The
  live app's files are not touched.

## 3. Test
- Install the Android app: https://api.bikesurgeon.online/download/bike-surgeon.apk
- Log in with a test number and the code that the setup printed. No SMS is sent. Other numbers see that the app is
  being tested.

## Later
- Updates: every 5 minutes the server checks the branch on GitHub. A new version is built next to the running one and
  switched to only when it starts; otherwise the running version stays. Log: `/home/bikesurgeon-api/logs/update.log`
- App log: `su - bikesurgeon-api -c 'pm2 logs bs-app --lines 50'`
- Change the test numbers (the app restarts by itself), with your own 10-digit numbers in place of `NUMBER1,NUMBER2`:
  `TEST_PHONES=NUMBER1,NUMBER2 bash /root/bs-app-setup.sh`
- Opening for all customers (only on the owner's word): remove `LOGIN_ALLOWLIST` and `TEST_LOGIN_CODE` from the
  `.env`, set the SMS gateway (the old app uses Renflair), then `su - bikesurgeon-api -c 'pm2 restart bs-app'`.
