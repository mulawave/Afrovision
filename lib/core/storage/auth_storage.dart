import 'dart:developer';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  static const _tokenKey = 'auth_token';
  static const _storage = FlutterSecureStorage();

  static Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    try {
      return await _storage.read(key: _tokenKey);
    } catch (error) {
      // Secure storage can fail when the underlying encryption key is no longer valid
      // or when data has become corrupted. Treat this as a missing token so the
      // app recovers by routing back to login rather than crashing.
      log('[AuthStorage] Secure storage read failed: $error');
      await deleteToken();
      return null;
    }
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
  }
}
