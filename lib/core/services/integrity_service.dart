import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import '../config/app_config.dart';

/// Wraps the Google Play Integrity API for Android via a native MethodChannel.
///
/// Used to prove that a login or registration request originated from the genuine,
/// unmodified AfroVision app on a real Android device — without any user-facing challenge.
///
/// The website uses reCAPTCHA Enterprise; the Android app uses Play Integrity.
/// Both paths are verified on the backend. The admin panel uses neither.
class IntegrityService {
  static const _channel = MethodChannel('com.afrovision.afrovision/integrity');

  /// Derives a time-keyed nonce bound to [email].
  ///
  /// Formula: base64url(sha256(lowercaseTrimmedEmail + minuteFloor))
  /// Changes every minute — prevents token replay attacks.
  /// The backend uses the identical formula with a +-1 minute window for clock skew.
  static String _deriveNonce(String email) {
    final minute = DateTime.now().millisecondsSinceEpoch ~/ 60000;
    final input = '${email.trim().toLowerCase()}$minute';
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return base64Url.encode(digest.bytes);
  }

  /// Returns a Play Integrity token for the given [email].
  ///
  /// The token is sent to the backend as `integrityToken` in the request body.
  /// Throws [IntegrityException] if Play Integrity is unavailable.
  static Future<String> getToken(String email) async {
    try {
      final nonce = _deriveNonce(email);
      final token = await _channel.invokeMethod<String>(
        'requestIntegrityToken',
        {'nonce': nonce, 'cloudProjectNumber': AppConfig.gcpProjectNumber},
      );
      if (token == null) {
        throw Exception('Play Integrity returned a null token');
      }
      return token;
    } on PlatformException catch (e) {
      throw IntegrityException('Device integrity check failed: ${e.message}');
    } catch (e) {
      throw IntegrityException('Device integrity check failed: $e');
    }
  }
}

class IntegrityException implements Exception {
  final String message;
  const IntegrityException(this.message);

  @override
  String toString() => 'IntegrityException: $message';
}
