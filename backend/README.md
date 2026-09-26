# Bike Pharma – Firebase backend

This folder is the server side of the Bike Pharma app: database rules, file-storage rules,
and Cloud Functions (vehicle lookup, orders, payments, mechanic ids).
The data layout is described in `../docs/DATA_MODEL.md`.

```
backend/
  firebase.json, .firebaserc      Firebase project settings
  firestore.rules                 who can read/write which data
  firestore.indexes.json          database indexes the app needs
  storage.rules                   who can upload/download images
  functions/                      Cloud Functions (TypeScript)
  seed/seed.mjs                   loads sample products, offers and a mechanic
```

## 1. One-time setup

You need Node.js 22 and the Firebase CLI: `npm install -g firebase-tools`, then `firebase login`.

1. **Create the project.** Go to https://console.firebase.google.com, choose *Add project*,
   and give it a name. If the project id isn't `bike-pharma-app`, put your id in `.firebaserc`.
2. **Upgrade to the Blaze (pay as you go) plan.** Cloud Functions and Secret Manager need it.
   Small shops usually stay inside the free allowance. Set a budget alert under
   *Billing > Budgets*.
3. **Phone login.** Go to *Build > Authentication > Get started > Sign-in method > Phone* and turn it on.
   While testing, add test phone numbers there so no real SMS is sent.
4. **Firestore.** Go to *Build > Firestore Database > Create database*, pick location
   **asia-south1 (Mumbai)** and start in *production mode*. The rules in this folder replace the defaults.
5. **Storage.** Go to *Build > Storage > Get started* and use the same location.
6. **Add the Android and iOS apps** under *Project settings > Your apps*. The Flutter developer
   needs these for `flutterfire configure`.

## 2. Secrets (API keys)

Keys are stored in Google Secret Manager, not in the code. Each command asks you to paste the value:

```bash
cd backend
firebase functions:secrets:set SUREPASS_TOKEN
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

**No key yet? Enter `none`.** The deploy fails if a secret doesn't exist. With `none`:
- the app's "look up my bike by number" shows an error, and the customer types the details by hand
- online payment is turned off, so customers can only choose Cash on Delivery

After you change a secret, deploy the functions again so they pick up the new value.

## 3. Deploy

```bash
cd backend/functions && npm install && cd ..
firebase deploy          # rules, indexes, storage rules and functions
```

Deploy one part at a time with `firebase deploy --only firestore:rules`, `--only functions` and so on.
All functions run in **asia-south1 (Mumbai)**.

## 4. Make yourself an admin

Admins can edit products, offers and mechanics, change order status, and call `createMechanic`.

1. Log in to the app once with your phone number.
2. In the Firebase console, go to *Authentication > Users* and copy your **User UID**.
3. Go to *Firestore*, create the collection **`admins`**, and add a document whose **Document ID
   is your UID**. It can have any field, for example `name: "Sam"`.

To remove an admin, delete their document. Clients can't write to `admins`, so only someone
with console access can add an admin.

## 5. Razorpay (online payments)

1. In the Razorpay Dashboard, go to *Settings > API Keys* and generate keys. Use **Test mode**
   first. Save the Key Id and Key Secret as the two secrets above.
2. After deploying, find the webhook URL in the Firebase console under *Functions*, next to
   `razorpayWebhook`. It looks like
   `https://asia-south1-<project-id>.cloudfunctions.net/razorpayWebhook`.
   (It may be shown as a `...run.app` address; either works.)
3. In the Razorpay Dashboard, go to *Settings > Webhooks > Add new webhook*:
   - URL: the address from step 2
   - Secret: make up a long random text and save the same value as `RAZORPAY_WEBHOOK_SECRET`
   - Active events: **payment.captured**
4. In Razorpay, turn on **automatic capture** for payments (*Settings > Payment capture*).

How a payment works: the app calls `placeOrder`, which creates the order with status `pending_payment`
and a Razorpay order. The customer pays in Razorpay Checkout. The app then calls `verifyPayment`,
and the order becomes paid and `placed`. The webhook marks it paid even if the app closed before
that step. Prices and stock are always read on the server.

Switch to Live keys only when Razorpay has approved your account.

## 6. Vehicle lookup (Surepass)

`lookupVehicle` uses the Surepass RC API (`https://kyc-api.surepass.io/api/v1/rc/rc-full`).
Buy a plan at surepass.io, and save the API token as `SUREPASS_TOKEN`.

**Check this after buying:** the field names used to read Surepass's reply come from their
public sample and have not been checked against a real reply yet. They are all in one function,
`mapSurepassResponse` in `functions/src/lib/vehicle.ts`. Look up one real bike, compare the
reply with that function, and fix any names that differ. The unit tests are in
`functions/test/vehicle.test.ts`.

Each lookup costs money, so each customer is limited to 10 lookups a day. Change
`MAX_LOOKUPS_PER_DAY` in `functions/src/functions/lookupVehicle.ts` to adjust.
Only the chassis number's first 4 and last 4 characters are ever returned. The owner's name
and other personal details are not stored.

## 7. Sample data (seed)

The seed loads 15 sample products (spares for Honda Shine 125, Hero Splendor Plus, Bajaj Pulsar 150,
and universal accessories), 3 offers, and mechanic **BPM-0231 Ravi Kumar / Ravi Auto Garage**.
It also sets the mechanic counter so new mechanics start at BPM-0232.

On the local emulator (safe):
```bash
cd backend
firebase emulators:start                                          # terminal 1
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node seed/seed.mjs         # terminal 2
```

On the real project (this writes live data; delete the sample products before launch):
```bash
# Service account key: Project settings > Service accounts > Generate new private key.
# Keep that file private and never commit it.
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node seed/seed.mjs --project <project-id> --live
```
To make someone an admin while seeding, add `--admin <uid>`.

## 8. For developers

```bash
cd backend/functions
npm run build    # compile TypeScript into lib/
npm run lint     # eslint
npm test         # unit tests (vitest) for the logic in src/lib/
```

To run the functions on the emulator, create `functions/.secret.local`. It is gitignored, so
don't commit it. Use test values:
```
SUREPASS_TOKEN=none
RAZORPAY_KEY_ID=none
RAZORPAY_KEY_SECRET=none
RAZORPAY_WEBHOOK_SECRET=none
```
Then run `firebase emulators:start`. The app must point at the emulators (Flutter:
`useFunctionsEmulator('localhost', 5001)` and so on).

Code layout:
- `src/lib/*`: pure logic with unit tests (reg-number cleanup, chassis masking, Surepass mapping,
  totals and delivery fee, address checks, Razorpay signatures, mechanic ids)
- `src/functions/*`: the Cloud Functions
- `src/config.ts`: region, secrets, admin check

Delivery fee: free when the subtotal is ₹499 or more (49900 paise), otherwise ₹49 (4900 paise).
You can change it in `src/lib/orders.ts`.
