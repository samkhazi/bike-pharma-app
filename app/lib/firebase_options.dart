import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase config for project `bike-pharma-automobile`.
/// These values are public identifiers (they ship inside every app), not secrets.
/// Android and iOS apps are not registered yet; add their options here (or run
/// `flutterfire configure`) once they are.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
      default:
        throw UnsupportedError('Firebase is not configured for $defaultTargetPlatform yet.');
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDvquT0sGoiUsugQFr29XJ7dQL1uJAOPSw',
    appId: '1:945571361258:web:c797a80bf2bb743a8f8293',
    messagingSenderId: '945571361258',
    projectId: 'bike-pharma-automobile',
    authDomain: 'bike-pharma-automobile.firebaseapp.com',
    storageBucket: 'bike-pharma-automobile.firebasestorage.app',
    measurementId: 'G-XYWR78270P',
  );
}
