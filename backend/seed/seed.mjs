#!/usr/bin/env node
/**
 * Seeds sample data for Bike Pharma: products, offers and one mechanic (BPM-0231).
 *
 * Emulator (safe, default):
 *   firebase emulators:start            (in backend/, another terminal)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node seed/seed.mjs
 *
 * Real project (careful, writes live data):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     node seed/seed.mjs --project bike-pharma-automobile --live
 *
 * Re-running is safe: documents use fixed ids and are overwritten.
 * Optional: --admin <uid> also creates admins/<uid>.
 */
import { createRequire } from "node:module";

// firebase-admin is installed in ../functions (run `npm install` there first).
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const projectId = argValue("--project") ?? process.env.GCLOUD_PROJECT ?? "bike-pharma-automobile";
const adminUid = argValue("--admin");
const live = args.includes("--live");

if (!process.env.FIRESTORE_EMULATOR_HOST && !live) {
  console.error(
    "Refusing to run: FIRESTORE_EMULATOR_HOST is not set.\n" +
      "For the emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node seed/seed.mjs\n" +
      "For a real project add --live (and GOOGLE_APPLICATION_CREDENTIALS).",
  );
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();

const rs = (rupees) => Math.round(rupees * 100); // rupees -> paise

const HONDA_SHINE = "honda|shine 125";
const HERO_SPLENDOR = "hero|splendor plus";
const BAJAJ_PULSAR = "bajaj|pulsar 150";
const HONDA_ACTIVA = "honda|activa 6g";
const TVS_JUPITER = "tvs|jupiter";

const product = (p) => ({ images: [], rating: 4.3, active: true, fitsAll: false, fits: [], ...p });

const products = {
  "brake-shoe-shine": product({
    name: "Rear Brake Shoe Set", category: "spares", subCategory: "Brakes", brand: "Honda Genuine",
    price: rs(349), mrp: rs(420), stock: 25, fits: [HONDA_SHINE, HONDA_ACTIVA], rating: 4.5,
  }),
  "brake-shoe-splendor": product({
    name: "Brake Shoe Pair (Front + Rear)", category: "spares", subCategory: "Brakes", brand: "Hero Genuine Parts",
    price: rs(299), mrp: rs(360), stock: 30, fits: [HERO_SPLENDOR],
  }),
  "disc-pad-pulsar": product({
    name: "Front Disc Brake Pad", category: "spares", subCategory: "Brakes", brand: "Bajaj Genuine",
    price: rs(399), mrp: rs(480), stock: 18, fits: [BAJAJ_PULSAR], rating: 4.6,
  }),
  "chain-kit-pulsar": product({
    name: "Chain Sprocket Kit", category: "spares", subCategory: "Chain & sprocket", brand: "Rolon",
    price: rs(1450), mrp: rs(1750), stock: 8, fits: [BAJAJ_PULSAR],
  }),
  "chain-kit-splendor": product({
    name: "Chain Sprocket Kit", category: "spares", subCategory: "Chain & sprocket", brand: "Rolon",
    price: rs(1050), mrp: rs(1300), stock: 12, fits: [HERO_SPLENDOR],
  }),
  "air-filter-shine": product({
    name: "Air Filter Element", category: "spares", subCategory: "Filters", brand: "Honda Genuine",
    price: rs(215), mrp: rs(260), stock: 40, fits: [HONDA_SHINE],
  }),
  "spark-plug-universal-2w": product({
    name: "Spark Plug U22FS-U", category: "spares", subCategory: "Engine", brand: "Denso",
    price: rs(149), mrp: rs(180), stock: 60, fits: [HONDA_SHINE, HERO_SPLENDOR, HONDA_ACTIVA, TVS_JUPITER],
  }),
  "clutch-plate-pulsar": product({
    name: "Clutch Plate Set", category: "spares", subCategory: "Clutch", brand: "Bajaj Genuine",
    price: rs(890), mrp: rs(1050), stock: 0, fits: [BAJAJ_PULSAR], // out of stock on purpose
  }),
  "engine-oil-10w30-1l": product({
    name: "4T Engine Oil 10W-30 (1 L)", category: "spares", subCategory: "Engine oil", brand: "Castrol Activ",
    price: rs(410), mrp: rs(455), stock: 50, fits: [HONDA_SHINE, HERO_SPLENDOR, BAJAJ_PULSAR], rating: 4.7,
  }),
  "helmet-full-face": product({
    name: "Full Face Helmet ISI (M)", category: "accessories", subCategory: "Helmets", brand: "Steelbird",
    price: rs(1299), mrp: rs(1799), stock: 15, fitsAll: true, rating: 4.4,
  }),
  "riding-gloves": product({
    name: "Riding Gloves (L)", category: "accessories", subCategory: "Gloves", brand: "Rynox",
    price: rs(699), mrp: rs(899), stock: 20, fitsAll: true,
  }),
  "mobile-holder": product({
    name: "Handlebar Mobile Holder", category: "accessories", subCategory: "Mobile holders", brand: "Bobo",
    price: rs(449), mrp: rs(599), stock: 35, fitsAll: true,
  }),
  "bike-cover": product({
    name: "Waterproof Bike Cover", category: "accessories", subCategory: "Covers", brand: "Autofy",
    price: rs(399), mrp: rs(549), stock: 22, fitsAll: true,
  }),
  "seat-cover-splendor": product({
    name: "Seat Cover (Black)", category: "accessories", subCategory: "Seat covers", brand: "Bike Pharma",
    price: rs(349), mrp: rs(450), stock: 14, fits: [HERO_SPLENDOR],
  }),
  "inactive-sample": product({
    name: "Old Stock Mirror (hidden)", category: "accessories", subCategory: "Mirrors", brand: "Generic",
    price: rs(199), mrp: rs(250), stock: 5, fitsAll: true, active: false,
  }),
};

const offers = {
  "free-pickup": {
    tag: "SERVICE", title: "Free pickup & drop", subtitle: "On general service this month",
    cta: "Book service", target: "service", order: 1, active: true,
  },
  "free-delivery": {
    tag: "SHOP", title: "Free delivery above ₹499", subtitle: "Genuine spares at your door",
    cta: "Shop spares", target: "shop", order: 2, active: true,
  },
  "helmet-sale": {
    tag: "ACCESSORIES", title: "Helmets from ₹1,299", subtitle: "ISI marked, all sizes",
    cta: "View helmets", target: "accessories", order: 3, active: true,
  },
};

const mechanics = {
  "BPM-0231": {
    name: "Ravi Kumar",
    garageName: "Ravi Auto Garage",
    photos: [],
    specialistBrands: ["Honda", "Hero", "Bajaj"],
    vehicleTypes: ["bike", "scooter"],
    services: ["General service", "Engine repair", "Brake work", "Chain & clutch", "Electricals"],
    rating: 4.7,
    experienceYears: 14,
    spareBuyerSince: 2019,
    address: "Shop 4, Sai Complex, Station Road, Pune 411001",
    geo: { lat: 18.5286, lng: 73.8743 },
    phone: "+919800000231",
    openHours: "9 AM - 8 PM (Sunday closed)",
    verified: true,
    active: true,
  },
};

async function main() {
  const batch = db.batch();
  for (const [id, p] of Object.entries(products)) batch.set(db.doc(`products/${id}`), p);
  for (const [id, o] of Object.entries(offers)) batch.set(db.doc(`offers/${id}`), o);
  for (const [id, m] of Object.entries(mechanics)) {
    batch.set(db.doc(`mechanics/${id}`), { ...m, createdAt: FieldValue.serverTimestamp() });
  }
  if (adminUid) batch.set(db.doc(`admins/${adminUid}`), { addedAt: FieldValue.serverTimestamp(), note: "added by seed" });
  await batch.commit();

  // Make sure createMechanic continues after BPM-0231 (never moves the counter backwards).
  await db.runTransaction(async (tx) => {
    const ref = db.doc("counters/mechanics");
    const snap = await tx.get(ref);
    const next = Number(snap.get("next") ?? 1);
    if (!(next > 231)) tx.set(ref, { next: 232 }, { merge: true });
  });

  console.log(
    `Seeded ${Object.keys(products).length} products, ${Object.keys(offers).length} offers, ` +
      `${Object.keys(mechanics).length} mechanic(s)${adminUid ? `, admin ${adminUid}` : ""} into ${projectId}` +
      (process.env.FIRESTORE_EMULATOR_HOST ? ` (emulator ${process.env.FIRESTORE_EMULATOR_HOST})` : " (LIVE)"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
