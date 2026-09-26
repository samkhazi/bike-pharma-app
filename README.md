# Bike Pharma Automobiles app

Customer app for Bike Pharma Automobiles: bike spare parts, accessories, service booking, bike modification, Bike Doctor, and verified mechanics by QR code.

- `app/` Flutter app (Android + iPhone, web for quick previews). Screens follow the Figma design; reference images are in `docs/design/`.
- `backend/` Firebase backend: Firestore rules, Cloud Functions (vehicle lookup, orders, Razorpay payments, mechanic ids), seed data.
- `docs/DATA_MODEL.md` the data model and API shared by both.

## Try the app without any setup (demo mode)

Demo mode uses sample products, a sample bike and a sample mechanic, and needs no Firebase account. The OTP is `123456`.

```bash
cd app
flutter pub get
flutter run --dart-define=DEMO=true            # phone or emulator
flutter run -d chrome --dart-define=DEMO=true  # in a browser
```

Try mechanic id `BPM-0231` on the QR scan screen.

## Going live

1. Set up Firebase and deploy the backend: see `backend/README.md`.
2. Connect the app to the Firebase project:
   ```bash
   dart pub global activate flutterfire_cli
   cd app && flutterfire configure --project=<your-firebase-project-id>
   ```
   Then call `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)` in `app/lib/main.dart`.
3. Run without `DEMO=true`.

Services that need their own paid accounts:

| What | Service | Used for |
|---|---|---|
| OTP SMS | Firebase Phone Auth | login |
| Online payment | Razorpay | UPI / card payments |
| Vehicle details from registration number | Surepass RC API (or similar Vahan data provider) | auto-filling bike details |

Until the vehicle lookup key is set, customers fill bike details by hand.

## Checks

```bash
cd app && flutter analyze && flutter test
cd backend/functions && npm run lint && npm run build && npm test
```
