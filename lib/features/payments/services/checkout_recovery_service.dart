import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class CheckoutRecoveryService {
  static const String _pendingKey = 'checkout_pending_session_v1';

  static Future<void> savePendingSession({
    required String paymentId,
    required String purpose,
    String? checkoutUrl,
    String? title,
    String? planId,
    String? planName,
    String? billingCycle,
    String? balanceType,
    double? amountNgn,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = <String, dynamic>{
      'paymentId': paymentId,
      'purpose': purpose,
      'checkoutUrl': checkoutUrl,
      'title': title,
      'planId': planId,
      'planName': planName,
      'billingCycle': billingCycle,
      'balanceType': balanceType,
      'amountNgn': amountNgn,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    };
    await prefs.setString(_pendingKey, jsonEncode(payload));
  }

  static Future<Map<String, dynamic>?> getPendingSession() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_pendingKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      await prefs.remove(_pendingKey);
      return null;
    }
  }

  static Future<void> clearPendingSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_pendingKey);
  }
}
