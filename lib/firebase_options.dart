// ─────────────────────────────────────────────────────────────────────────────
//  firebase_options.dart — AfroVision Firebase configuration
//  Generated from google-services.json (project: raven-ai-6ff76)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not configured for this platform.',
        );
    }
  }

  // ── Android ────────────────────────────────────────────────────────────────
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDlx4ozgntanLD6y0Q04aVbLKeYEb_HaRk',
    appId: '1:134538542038:android:bc779e1de9767ee2df4277',
    // Project number (GCP project 134538542038 — already correct)
    messagingSenderId: '134538542038',
    projectId: 'raven-ai-6ff76',
    storageBucket: 'raven-ai-6ff76.firebasestorage.app',
  );

  // ── iOS (deferred — Android-only launch) ────────────────────────────────
  // Replace with real values from GoogleService-Info.plist before iOS release.
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'IOS_NOT_YET_CONFIGURED',
    appId: 'IOS_NOT_YET_CONFIGURED',
    messagingSenderId: '134538542038',
    projectId: 'raven-ai-6ff76',
    storageBucket: 'raven-ai-6ff76.firebasestorage.app',
    iosBundleId: 'com.afrovision.afrovision',
  );
}
