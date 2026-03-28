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

  static Future<Map<String, dynamic>> getMySubscription() async {
    return ApiService.get('/subscriptions/me');
  }
}
