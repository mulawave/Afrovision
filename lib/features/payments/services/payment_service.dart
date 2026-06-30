import '../../../core/api/api_service.dart';

class PaymentService {
  static Future<List<Map<String, dynamic>>> getProviders() async {
    final data = await ApiService.get('/payments/providers');
    final list = data['providers'] as List<dynamic>? ?? [];
    return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  static Future<Map<String, dynamic>> initializeCheckout({
    required String purpose,
    required String provider,
    String? planId,
    String? billingCycle,
    double? amountNgn,
    String? balanceType,
  }) async {
    final payload = <String, dynamic>{
      'purpose': purpose,
      'provider': provider,
      // Tell the backend to redirect back into the app after gateway payment,
      // instead of the default website checkout/result page.
      'return_url': 'com.afrovision.app://checkout/result',
    };
    if (planId != null) payload['planId'] = planId;
    if (billingCycle != null) payload['billingCycle'] = billingCycle;
    if (amountNgn != null) payload['amount_ngn'] = amountNgn;
    if (balanceType != null) payload['balanceType'] = balanceType;

    return ApiService.post('/payments/checkout/initialize', payload);
  }

  static Future<Map<String, dynamic>> verifyCheckout(String paymentId) async {
    return ApiService.post('/payments/checkout/$paymentId/verify', {});
  }
}
