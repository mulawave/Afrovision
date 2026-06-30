import '../../../core/api/api_service.dart';
import '../models/channel_subscription_model.dart';

class ChannelSubscriptionService {
  static const String _basePath = '/subscriptions/channel';

  /// Subscribe to a channel (free or premium based on channel config)
  static Future<Map<String, dynamic>> subscribe(String channelId) async {
    try {
      final response = await ApiService.post(
        '$_basePath/subscribe',
        {'channelId': channelId},
      );
      return {
        'success': true,
        'subscription': ChannelSubscriptionModel.fromJson(
            response['subscription'] as Map<String, dynamic>),
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Cancel a channel subscription
  static Future<Map<String, dynamic>> cancel(String subscriptionId) async {
    try {
      final response = await ApiService.delete(
        '$_basePath/$subscriptionId/cancel',
      );
      return {
        'success': true,
        'subscription': response['subscription'] != null
            ? ChannelSubscriptionModel.fromJson(
                response['subscription'] as Map<String, dynamic>)
            : null,
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Check if current user is subscribed to a channel
  static Future<Map<String, dynamic>> check(String channelId) async {
    try {
      final response = await ApiService.get(
        '$_basePath/check/$channelId',
      );
      return {
        'success': true,
        'subscribed': response['subscribed'] as bool,
        'subscription': response['subscription'] != null
            ? ChannelSubscriptionModel.fromJson(
                response['subscription'] as Map<String, dynamic>)
            : null,
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Get all current user's channel subscriptions
  static Future<Map<String, dynamic>> getMine() async {
    try {
      final response = await ApiService.get(
        '$_basePath/mine',
      );
      final List<dynamic> rawSubs = response['subscriptions'] as List<dynamic>;
      return {
        'success': true,
        'subscriptions': rawSubs
            .map((s) =>
                ChannelSubscriptionModel.fromJson(s as Map<String, dynamic>))
            .toList(),
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Request premium elevation for a channel (creator only)
  static Future<Map<String, dynamic>> requestPremiumElevation(String channelId) async {
    try {
      final response = await ApiService.post(
        '/channels/$channelId/request-premium',
        {},
      );
      return {'success': true, 'message': response['message'] ?? 'Request submitted'};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Check if user has an active subscription to a channel
  static Future<bool> hasActiveSubscription(String channelId) async {
    try {
      final response = await ApiService.get(
        '$_basePath/check/$channelId',
      );
      final subscribed = response['subscribed'] as bool? ?? false;
      if (!subscribed) return false;
      
      final subscription = response['subscription'] as Map<String, dynamic>?;
      if (subscription == null) return false;
      
      final status = subscription['status'] as String? ?? 'inactive';
      return status == 'active';
    } catch (e) {
      return false;
    }
  }
}
