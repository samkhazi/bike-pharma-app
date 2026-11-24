# Server steps (Bike Surgeon CloudPanel server, KL VPS 72.62.246.246)

The app runs on the same server as the billing, the admin panel and the Inventory. Setting it up is one command.
After that the server takes new code from GitHub by itself every 5 minutes.

## 1. Domain (one time)
In Cloudflare, add a DNS record: type `A`, name `app`, value `72.62.246.246`, Proxy **off** (DNS only).
The https certificate needs this record.

## 2. One command, as root on the server
```bash
curl -fsSL https://raw.githubusercontent.com/samkhazi/bike-pharma-app/refs/heads/claude/project-thread-vczbd1/scripts/server/setup.sh -o /root/bs-app-setup.sh && bash /root/bs-app-setup.sh
```
The first time it asks two things:
- the test phone numbers that may log in (10 digits, comma between numbers)
- the workshop phone number that customers call and WhatsApp

Then it:
- makes the site `app.bikesurgeon.online` in CloudPanel (Node 22, port 3050, site user `bikesurgeon-app`)
- makes a PostgreSQL database for the app (installs PostgreSQL if it is missing)
- writes the settings file `/home/bikesurgeon-app/shared/.env`. The old billing login and the Inventory key are
  copied from the admin panel's `.env` and never printed. The old billing database is only read (`OLD_DB_WRITE=off`).
- builds the app, starts it with pm2 (name `bs-app`) and adds the 5-minute update and the restart after a reboot to cron
- asks Let's Encrypt for the https certificate

It ends with `All done`, the app address and the test login code. It takes about 5 to 10 minutes the first time.
It is safe to run again: if it stops with a message, fix that and run the same command.

## 3. Test
- In a phone browser: https://app.bikesurgeon.online
- Android app: https://app.bikesurgeon.online/download/bike-surgeon.apk
- Log in with a test number and the code that the setup printed. No SMS is sent. Other numbers see that the app is
  being tested.

## Later
- Updates: every 5 minutes the server checks the branch on GitHub. A new version is built next to the running one and
  switched to only when it starts; otherwise the running version stays. Log: `/home/bikesurgeon-app/logs/update.log`
- App log: `su - bikesurgeon-app -c 'pm2 logs bs-app --lines 50'`
- Change the test numbers (the app restarts by itself):
  `TEST_PHONES=9876543210,9123456780 bash /root/bs-app-setup.sh`
- Opening for all customers (only on the owner's word): remove `LOGIN_ALLOWLIST` and `TEST_LOGIN_CODE` from the
  `.env`, set the SMS gateway (the old app uses Renflair), then `su - bikesurgeon-app -c 'pm2 restart bs-app'`.
