import '../../../core/api/api_service.dart';

class PremiumStreamService {
  /// Check whether the current user has active access to a premium channel.
  /// Returns the full JSON payload: { has_access, expires_at?, entry_fee_type?, ... }
  static Future<Map<String, dynamic>> checkAccess(String channelId) async {
    return ApiService.get('/channels/$channelId/access');
  }

  /// Pay for access to a premium channel using the user's gift wallet.
  /// Returns: { has_access: true, expires_at, access_id }
  static Future<Map<String, dynamic>> payForAccess(String channelId) async {
    return ApiService.post('/channels/$channelId/pay', {});
  }

  /// All non-expired channel access grants for the current user.
  static Future<List<Map<String, dynamic>>> getMyAccesses() async {
    final data = await ApiService.get('/channels/my-accesses');
    return (data['accesses'] as List<dynamic>).cast<Map<String, dynamic>>();
  }
}
