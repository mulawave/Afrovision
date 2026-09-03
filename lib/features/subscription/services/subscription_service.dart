import '../../../core/api/api_service.dart';
import '../../auth/models/user_model.dart';
import '../models/plan_model.dart';

class SubscriptionService {
  static Future<List<PlanModel>> getPlans() async {
    final data = await ApiService.get('/subscriptions/plans');
    final list = data['plans'] as List<dynamic>;
    return list
        .map((e) => PlanModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<UserModel> subscribe(String planId, {String paymentMethod = 'fiat'}) async {
    final data = await ApiService.post('/subscriptions/subscribe', {
      'planId': planId,
      'paymentMethod': paymentMethod,
    });
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> subscribeWithWallet(String planId, {String billingCycle = 'monthly'}) async {
    final data = await ApiService.post('/subscriptions/subscribe', {
      'planId': planId,
      'paymentMethod': 'wallet',
      'billingCycle': billingCycle,
    });
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<WalletPaymentPreview> previewWalletPayment(double amountNgn) async {
    final data = await ApiService.get('/subscriptions/wallet-preview?amount=$amountNgn');
    return WalletPaymentPreview.fromJson(data['preview'] as Map<String, dynamic>);
  }

  static Future<Map<String, dynamic>> getMySubscription() async {
    return ApiService.get('/subscriptions/me');
  }
}

class WalletPaymentPreview {
  final bool sufficient;
  final double cashBalance;
  final double vptBalance;
  final double vptPriceNgn;
  final double vptEquivalent;
  final double cashToDeduct;
  final double vptToDeduct;

  WalletPaymentPreview({
    required this.sufficient,
    required this.cashBalance,
    required this.vptBalance,
    required this.vptPriceNgn,
    required this.vptEquivalent,
    required this.cashToDeduct,
    required this.vptToDeduct,
  });

  factory WalletPaymentPreview.fromJson(Map<String, dynamic> json) {
    return WalletPaymentPreview(
      sufficient: json['sufficient'] as bool? ?? false,
      cashBalance: (json['cashBalance'] as num?)?.toDouble() ?? 0,
      vptBalance: (json['vptBalance'] as num?)?.toDouble() ?? 0,
      vptPriceNgn: (json['vptPriceNgn'] as num?)?.toDouble() ?? 750,
      vptEquivalent: (json['vptEquivalent'] as num?)?.toDouble() ?? 0,
      cashToDeduct: (json['cashToDeduct'] as num?)?.toDouble() ?? 0,
      vptToDeduct: (json['vptToDeduct'] as num?)?.toDouble() ?? 0,
    );
  }
}
