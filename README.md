# Bike Pharma RC lookup (VR Garage)

Type a bike number (KA17HC3942) and get the RC details: owner, maker, model, year, registration date, fuel, colour, cc, chassis number, engine number, insurance, PUC and RC status.
This is the code behind Bike Pharma's Find Part > "Check parts with bike or chassis number".

## How it works

1. The page sends the number to our own server: `GET /api/rclook?r=KA17HC3942`.
2. The server first looks in its saved answers. A number found before is answered from there: no VR Garage call, no credit used.
3. For a new number the server logs in to VR Garage itself: `POST https://vr-api.vecrep.com/garageLogin` with `VRGARAGE_EMAIL` and `VRGARAGE_PASSWORD` from `.env`. VR Garage gives a token; the server keeps it in memory.
4. It asks for the vehicle: `POST https://vr-api.vecrep.com/fetch-vehicle` with `{"vehicleNumber":"KA17HC3942"}` and `Authorization: Bearer <token>`, the same way VR Garage's own website does.
5. If VR Garage refuses the token (expired), the server logs in again and asks once more.
6. From the answer it picks the RC fields (`rcMap` in `lib/rclook.mjs` finds each field at any depth and in any spelling), saves the answer and sends it to the page.

The VR Garage login stays on the server. The phone or browser never sees it.

## Files

| File | What it is |
|---|---|
| `lib/rclook.mjs` | The RC module, exactly as in Bike Pharma. `rcLook(number)` does steps 3-6. |
| `server.mjs` | A small server that works on its own: the page, `/api/rclook`, saved answers in `data/rc-saved.json`, 40 searches per 10 minutes per caller. |
| `public/index.html` | The search page (number box, Search button, RC card). |
| `.env.example` | The settings. Copy it to `.env`. |
| `bike-pharma-original/` | The exact pieces from the Bike Pharma app (server route and Find Part screen code), for reference. They need the rest of the Bike Pharma app to run. |

## Run it

Needs Node 18 or newer. Nothing to install.

1. Copy `.env.example` to `.env`. Fill `VRGARAGE_EMAIL` (what you type in VR Garage's email box: email or mobile number) and `VRGARAGE_PASSWORD`.
2. Start it: `node server.mjs`
3. Open http://localhost:3060, type a bike number, press Search.

Each new number uses one VR Garage credit. The same number again comes from the saved answers, free.

## Use it in another Node app

```js
import { rcLook } from './lib/rclook.mjs';   // reads RC_API, VRGARAGE_EMAIL, VRGARAGE_PASSWORD from process.env

const r = await rcLook('KA17HC3942');
// found:      { found: true, reg, owner, maker, model, mfg, year, regDate, fuel, colour, chassis, engine, cc, category, insurer, insUpto, pucUpto, status }
// no record:  { found: false }
// a problem:  { error: 'VR Garage did not let us in: ...' }   (login, credits or network)
// not set up: { off: true }                                     (.env not filled)
```

Rules Bike Pharma follows, keep them in any app:

- Call VR Garage only from your server, never from the phone or browser, so the login is never exposed.
- Save every found answer and reuse it: each search costs a credit.
- Let only logged-in staff search, with a limit per person (Bike Pharma: 40 per 10 minutes).
- Do not open `server.mjs` to the internet as it is (it has no login); it listens on this computer only unless `HOST` is changed.

## In the Bike Pharma app

After the RC card, Bike Pharma opens the bike in its catalogue: by the 17-letter chassis number when the RC has it, otherwise by the maker and model on the RC; when neither matches, staff pick the brand and model. That part needs Bike Pharma's catalogues, so it is only in `bike-pharma-original/app-rc-client.js`.
