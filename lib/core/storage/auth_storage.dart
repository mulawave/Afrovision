import 'dart:developer';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  static const _tokenKey = 'auth_token';
  static const _storage = FlutterSecureStorage();

  static Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    // Some devices' hardware Keystore is intermittently flaky (confirmed:
    // "unwrap key failed" / IllegalBlockSizeException on at least one real
    // test device — a transient failure of the *operation*, not evidence the
    // token is missing). Retrying beats returning null on the first failure:
    // every authenticated API call depends on this, so treating one blip as
    // "logged out" silently blanks the whole app (every content section
    // null-guards on the user profile it can no longer fetch) even though
    // the encrypted value is untouched on disk and a retry moments later
    // succeeds. Never delete the token here — deleting on a transient
    // failure would turn a one-off hiccup into a permanent logout.
    const maxAttempts = 3;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await _storage.read(key: _tokenKey);
      } catch (error) {
        log('[AuthStorage] Secure storage read failed (attempt $attempt/$maxAttempts): $error');
        if (attempt == maxAttempts) return null;
        await Future.delayed(Duration(milliseconds: 150 * attempt));
      }
    }
    return null;
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
  }
}
