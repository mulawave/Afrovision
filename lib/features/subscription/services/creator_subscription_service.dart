import '../../../core/api/api_service.dart';
import '../models/creator_subscription_model.dart';

class CreatorSubscriptionService {
  /// Subscribe to a creator. [currency] is 'ngn' or 'vpt'.
  static Future<CreatorSubscriptionModel> subscribe({
    required String creatorUid,
    String currency = 'ngn',
  }) async {
    final data = await ApiService.post('/subscriptions/creator/subscribe', {
      'creatorUid': creatorUid,
      'currency': currency,
    });
    return CreatorSubscriptionModel.fromJson(
      data['subscription'] as Map<String, dynamic>,
    );
  }

  /// Cancel a subscription by its ID.
  static Future<CreatorSubscriptionModel> cancel(String subscriptionId) async {
    final data = await ApiService.delete(
      '/subscriptions/creator/$subscriptionId/cancel',
    );
    return CreatorSubscriptionModel.fromJson(
      data['subscription'] as Map<String, dynamic>,
    );
  }

  /// All subscriptions (active + cancelled) where the current user is subscriber.
  static Future<List<CreatorSubscriptionModel>> getMySubscriptions() async {
    final data = await ApiService.get('/subscriptions/creator/mine');
    final list = data['subscriptions'] as List<dynamic>;
    return list
        .map(
          (e) => CreatorSubscriptionModel.fromJson(e as Map<String, dynamic>),
        )
        .toList();
  }

  /// Active subscribers for the current creator.
  static Future<List<CreatorSubscriptionModel>> getMySubscribers() async {
    final data = await ApiService.get('/subscriptions/creator/subscribers');
    final list = data['subscriptions'] as List<dynamic>;
    return list
        .map(
          (e) => CreatorSubscriptionModel.fromJson(e as Map<String, dynamic>),
        )
        .toList();
  }

  /// Returns { subscribed: bool, subscription: CreatorSubscriptionModel? }
  static Future<Map<String, dynamic>> checkSubscription(
    String creatorUid,
  ) async {
    return ApiService.get('/subscriptions/creator/check/$creatorUid');
  }
}
