# Bike Pharma mobile app

The app is bikepharma.com's own app page (/app.html: login, billing, Find Part, shop) opened full screen.
Nothing is copied into the app: logins, data and every screen come from the server, so a website update
shows in the app at once. A new store version is needed only for the name, icon, splash or phone settings.

## Android (android/)

- Trusted Web Activity made with Bubblewrap 1.27 (androidbrowserhelper 2.7.4): the site runs in the phone's
  Chrome engine, so voice search, scanner, camera, print, downloads, WhatsApp share and OTP auto-read work
  exactly as on the website. Settings: android/app/build.gradle (twaManifest block) and android/twa-manifest.json.
- Package `com.bikepharma.app` (permanent once on Play). Raise versionCode/versionName in
  android/app/build.gradle for every Play upload.
- Full screen (no address bar) needs https://bikepharma.com/.well-known/assetlinks.json (branch `website`,
  file .well-known/assetlinks.json) to list this app's key fingerprints: the test key below now, and the
  Play App Signing key (Play Console > Test and release > App signing) once the app is on Play.
- Build: GitHub Actions (.github/workflows/android.yml) on every push to this branch. The files land on
  branch `app-builds` (one commit, replaced each build):
  - BikePharma-test.apk: signed with the test key android/app/debug.keystore (NOT secret, password
    `android`). For checking on phones only, never for Play.
    SHA-256: 16:A7:1D:FF:A5:B6:47:D8:35:9E:28:01:C6:39:CB:7A:BD:3E:AE:77:25:A8:14:D5:31:33:D8:7D:F8:66:87:A7
  - BikePharma-play.aab: only when the GitHub secrets BP_UPLOAD_KEYSTORE_B64, BP_UPLOAD_STORE_PASSWORD,
    BP_UPLOAD_KEY_ALIAS and BP_UPLOAD_KEY_PASSWORD exist. The upload key is made once on Sam's Mac and
    kept by him; it is never committed or sent in chat.
- Local build with the Android SDK: `cd android && ./gradlew assembleDebug`

## iPhone (ios/, not made yet)

App Store needs a native shell (WKWebView) built on a Mac with Xcode, plus an Apple Developer account.

## Icons (store/)

icon.png (splash, old phones), maskable.png (launcher icon), monochrome.png (notifications),
play-store-icon-512.png (Play listing). Made from Sam's logo zip (png/Bike Pharma Automobiles-07 and -09).
