# Server steps (KL VPS, next to billing + Inventory)

Run as root on the server where `bikesurgeonoff` (MySQL) and the Inventory (port 3021) already run.

## 1. Postgres for the app (one time)
```bash
apt-get update && apt-get install -y postgresql
sudo -u postgres psql -c "CREATE USER bikesurgeon WITH PASSWORD 'PUT-A-NEW-PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE bikesurgeon OWNER bikesurgeon;"
```

## 2. Read-only MySQL user for the bridge (one time)
```bash
mysql -u root -p -e "CREATE USER 'bs_read'@'127.0.0.1' IDENTIFIED BY 'PUT-A-NEW-PASSWORD'; GRANT SELECT ON bikesurgeonoff.* TO 'bs_read'@'127.0.0.1';"
```
The app never writes to the old billing DB while `OLD_DB_WRITE=off`.

## 3. API
```bash
mkdir -p /opt/bike-surgeon && cd /opt/bike-surgeon
unzip /root/bike-surgeon-*.zip
cd app-backend && cp .env.example .env && nano .env
```
Change these lines in `.env`:
```
NODE_ENV=production
PUBLIC_BASE_URL=https://api.bikesurgeon.online
CORS_ORIGINS=capacitor://localhost,https://localhost,https://app.bikesurgeon.online
DATABASE_URL=postgres://bikesurgeon:PASSWORD@127.0.0.1:5432/bikesurgeon
JWT_SECRET=<openssl rand -hex 32>
INTEGRATION_API_KEYS=<openssl rand -hex 24>
OTP_PROVIDER=http            # SMS gateway URL + token in OTP_HTTP_URL / OTP_HTTP_TOKEN
OTP_DEV_CODE=                # must be empty in production
BRIDGE=on
OLD_DB_USER=bs_read
OLD_DB_PASS=PASSWORD
INVENTORY_URL=http://127.0.0.1:3021
INVENTORY_FEED_KEY=<same key as the Inventory .env>
```
Then:
```bash
npm ci && npm run build
npm run db:migrate && npm run db:seed
npm i -g pm2
pm2 start "node --env-file=.env dist/src/index.js" --name bs-api && pm2 save
```
Nginx: `api.bikesurgeon.online` -> `127.0.0.1:8080` (HTTPS with certbot).

## 4. Bay cameras
In Postgres, set each bay's camera link (RTSP cameras need an HLS/MP4 restream first):
```bash
sudo -u postgres psql bikesurgeon -c "UPDATE bays SET camera_stream_url='https://cam.bikesurgeon.online/bay3/index.m3u8' WHERE code='BAY-03';"
```
The app plays it only through the API, only to the bike owner, only while the bike is in that bay.

## 5. App (Android / iOS)
On a computer with Android Studio / Xcode:
```bash
cd app-frontend
echo "VITE_API_URL=https://api.bikesurgeon.online" > .env
npm ci && npm run build
npm run android:sync && npm run android:open
```

## Check
- `pm2 logs bs-api` shows `[bridge] on: old billing linked, Inventory linked, every 20s`.
- Log in on the app with a customer number from billing: their bikes, job cards and bills show up.
