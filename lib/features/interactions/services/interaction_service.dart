import '../../../core/api/api_service.dart';
import '../models/interaction_models.dart';

class InteractionService {
  // ─── Gift Catalog ──────────────────────────────────────

  static Future<List<GiftModel>> getGifts() async {
    final data = await ApiService.get('/interactions/gifts');
    final list = data['gifts'] as List<dynamic>;
    return list
        .map((e) => GiftModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ─── Gift Wallet ───────────────────────────────────────

  static Future<GiftWalletModel> getMyGiftWallet() async {
    final data = await ApiService.get('/interactions/wallet');
    return GiftWalletModel.fromJson(data['wallet'] as Map<String, dynamic>);
  }

  // ─── Send Reaction (free) ──────────────────────────────

  static Future<void> sendReaction({
    required String channelId,
    required String emoji,
  }) async {
    await ApiService.post('/interactions/reactions', {
      'channel_id': channelId,
      'emoji': emoji,
    });
  }

  // ─── Send Gift ─────────────────────────────────────────

  static Future<Map<String, dynamic>> sendGift({
    required String channelId,
    required String giftId,
  }) async {
    return ApiService.post('/interactions/gifts/send', {
      'channel_id': channelId,
      'gift_id': giftId,
    });
  }

  // ─── Combo ─────────────────────────────────────────────

  static Future<int> getCombo({
    required String channelId,
    required String giftId,
  }) async {
    final data = await ApiService.get(
      '/interactions/combo?channel_id=$channelId&gift_id=$giftId',
    );
    return data['combo'] as int? ?? 0;
  }

  // ─── Leaderboard ───────────────────────────────────────

  static Future<List<LeaderboardEntry>> getLeaderboard(String channelId) async {
    final data = await ApiService.get('/interactions/leaderboard/$channelId');
    final list = data['leaderboard'] as List<dynamic>;
    return list
        .map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ─── Channel Events ────────────────────────────────────

  static Future<List<ChannelEventModel>> getChannelEvents(
    String channelId, [
    int? after,
  ]) async {
    final suffix = after != null ? '?after=$after' : '';
    final data = await ApiService.get('/interactions/events/$channelId$suffix');
    final list = data['events'] as List<dynamic>;
    return list
        .map((e) => ChannelEventModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<List<LiveChatMessageModel>> getChatMessages(
    String channelId, {
    int limit = 75,
  }) async {
    final data = await ApiService.get(
      '/interactions/chat/$channelId/messages?limit=$limit',
    );
    final list = data['messages'] as List<dynamic>? ?? [];
    return list
        .map((e) => LiveChatMessageModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
