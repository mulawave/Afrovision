import 'dart:io';
import '../../../core/api/api_service.dart';
import '../models/channel_model.dart';
import '../models/category_model.dart';

class FollowStatusModel {
  final bool followed;
  final int followersCount;

  const FollowStatusModel({
    required this.followed,
    required this.followersCount,
  });

  factory FollowStatusModel.fromJson(Map<String, dynamic> json) {
    return FollowStatusModel(
      followed: json['followed'] as bool? ?? false,
      followersCount: (json['followers_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class ExclusiveAccessStatusModel {
  final bool eligibleByKyc;
  final bool hasActiveEntitlement;
  final bool renewalRequired;
  final String? expiresAt;
  final double monthlyFeeNgn;

  const ExclusiveAccessStatusModel({
    required this.eligibleByKyc,
    required this.hasActiveEntitlement,
    required this.renewalRequired,
    required this.expiresAt,
    required this.monthlyFeeNgn,
  });

  factory ExclusiveAccessStatusModel.fromJson(Map<String, dynamic> json) {
    bool parseBool(dynamic v) {
      if (v == null) return false;
      if (v is bool) return v;
      if (v is String) return v.toLowerCase() == 'true';
      if (v is num) return v != 0;
      return false;
    }

    String? parseString(dynamic v) {
      if (v == null) return null;
      return v.toString();
    }

    final eligible =
        json['eligibleByKyc'] ??
        json['eligible_by_kyc'] ??
        json['eligible_byKyc'];
    final hasEnt =
        json['hasActiveEntitlement'] ??
        json['has_active_entitlement'] ??
        json['has_activeEntitlement'];
    final renew =
        json['renewalRequired'] ??
        json['renewal_required'] ??
        json['renewalRequired'];
    final expires =
        json['expiresAt'] ?? json['expires_at'] ?? json['expires_at'];
    final monthly =
        json['monthlyFeeNgn'] ??
        json['monthly_fee_ngn'] ??
        json['monthly_fee_ngn'];

    return ExclusiveAccessStatusModel(
      eligibleByKyc: parseBool(eligible),
      hasActiveEntitlement: parseBool(hasEnt),
      renewalRequired: parseBool(renew),
      expiresAt: parseString(expires),
      monthlyFeeNgn: (monthly is num)
          ? monthly.toDouble()
          : double.tryParse(monthly?.toString() ?? '') ?? 0,
    );
  }
}

class ExclusivePurchaseResultModel {
  final bool hasAccess;
  final String? accessId;
  final String? expiresAt;
  final String? personalIdentifierCode;
  final bool alreadyActive;

  const ExclusivePurchaseResultModel({
    required this.hasAccess,
    required this.accessId,
    required this.expiresAt,
    required this.personalIdentifierCode,
    required this.alreadyActive,
  });

  factory ExclusivePurchaseResultModel.fromJson(Map<String, dynamic> json) {
    return ExclusivePurchaseResultModel(
      hasAccess: json['has_access'] as bool? ?? false,
      accessId: json['access_id'] as String?,
      expiresAt: json['expires_at'] as String?,
      personalIdentifierCode: json['personal_identifier_code'] as String?,
      alreadyActive: json['already_active'] as bool? ?? false,
    );
  }
}

class ExclusivePicVerificationResultModel {
  final bool valid;
  final String? expiresAt;
  final String? accessId;

  const ExclusivePicVerificationResultModel({
    required this.valid,
    required this.expiresAt,
    required this.accessId,
  });

  factory ExclusivePicVerificationResultModel.fromJson(
    Map<String, dynamic> json,
  ) {
    return ExclusivePicVerificationResultModel(
      valid: json['valid'] as bool? ?? false,
      expiresAt: json['expires_at'] as String?,
      accessId: json['access_id'] as String?,
    );
  }
}

class ChannelService {
  static const Duration _publicChannelsCacheTtl = Duration(minutes: 3);
  static List<ChannelModel>? _publicChannelsCache;
  static DateTime? _publicChannelsCachedAt;
  static final Map<String, ChannelModel> _channelByIdCache =
      <String, ChannelModel>{};
  static final Map<String, DateTime> _channelByIdCachedAt =
      <String, DateTime>{};

  static bool _hasFreshPublicChannelCache() {
    final cachedAt = _publicChannelsCachedAt;
    if (cachedAt == null || _publicChannelsCache == null) {
      return false;
    }
    return DateTime.now().difference(cachedAt) < _publicChannelsCacheTtl;
  }

  static void _storePublicChannelCache(List<ChannelModel> channels) {
    _publicChannelsCache = List<ChannelModel>.from(channels);
    _publicChannelsCachedAt = DateTime.now();
    for (final channel in channels) {
      _storeChannelByIdCache(channel);
    }
  }

  static void _storeChannelByIdCache(ChannelModel channel) {
    _channelByIdCache[channel.id] = channel;
    _channelByIdCachedAt[channel.id] = DateTime.now();
  }

  static bool _hasFreshChannelByIdCache(String id) {
    final cachedAt = _channelByIdCachedAt[id];
    if (cachedAt == null || !_channelByIdCache.containsKey(id)) {
      return false;
    }
    return DateTime.now().difference(cachedAt) < _publicChannelsCacheTtl;
  }

  static ChannelModel? getCachedChannelById(String id) {
    if (_hasFreshChannelByIdCache(id)) {
      return _channelByIdCache[id];
    }

    final list = _publicChannelsCache;
    if (_hasFreshPublicChannelCache() && list != null) {
      for (final channel in list) {
        if (channel.id == id) {
          _storeChannelByIdCache(channel);
          return channel;
        }
      }
    }
    return null;
  }

  static void _invalidatePublicChannelCache() {
    _publicChannelsCache = null;
    _publicChannelsCachedAt = null;
  }

  static Future<List<CategoryModel>> getCategories() async {
    final data = await ApiService.get('/categories');
    final list = data['categories'] as List<dynamic>;
    return list
        .map((e) => CategoryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<ChannelModel> createChannel({
    required String name,
    required String description,
    required String category,
    required String type,
  }) async {
    final data = await ApiService.post('/channels', {
      'name': name,
      'description': description,
      'category': category,
      'type': type,
    });
    _invalidatePublicChannelCache();
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<List<ChannelModel>> getPublicChannels({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh && _hasFreshPublicChannelCache()) {
      return List<ChannelModel>.from(_publicChannelsCache!);
    }

    try {
      final data = await ApiService.get('/channels');
      final list = data['channels'] as List<dynamic>;
      final channels = list
          .map((e) => ChannelModel.fromJson(e as Map<String, dynamic>))
          .toList();
      _storePublicChannelCache(channels);
      return channels;
    } catch (_) {
      if (_publicChannelsCache != null) {
        return List<ChannelModel>.from(_publicChannelsCache!);
      }
      rethrow;
    }
  }

  static Future<ChannelModel> getChannelById(String id) async {
    final cached = getCachedChannelById(id);
    if (cached != null) {
      return cached;
    }

    final data = await ApiService.get('/channels/$id');
    final channel = ChannelModel.fromJson(
      data['channel'] as Map<String, dynamic>,
    );
    _storeChannelByIdCache(channel);
    return channel;
  }

  /// Real live-viewer count for the Watch Screen's LIVE badge — `null`
  /// on any failure so callers can hide the count rather than show a
  /// fabricated number.
  static Future<int?> getLiveViewerCount(String channelId) async {
    try {
      final data = await ApiService.get(
        '/channels/$channelId/live-stats',
        noCache: true,
      );
      return (data['current_viewers'] as num?)?.toInt();
    } catch (_) {
      return null;
    }
  }

  static Future<ChannelModel> getChannelByNumber(String number) async {
    final data = await ApiService.get('/channels/number/$number');
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> updateChannel(
    String id, {
    String? name,
    String? description,
    String? category,
  }) async {
    final data = await ApiService.patch('/channels/$id', {
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (category != null) 'category': category,
    });
    _invalidatePublicChannelCache();
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<void> deleteChannel(String id) async {
    await ApiService.delete('/channels/$id');
    _invalidatePublicChannelCache();
  }

  static Future<List<ChannelModel>> getMyChannels() async {
    final data = await ApiService.get('/channels/me');
    final list = data['channels'] as List<dynamic>;
    return list
        .map((e) => ChannelModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<ChannelModel> enableChannel(String id) async {
    final data = await ApiService.patch('/channels/$id/enable', {});
    _invalidatePublicChannelCache();
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> uploadLogo(String id, File file) async {
    final data = await ApiService.uploadFile('/channels/$id/upload/logo', file);
    _invalidatePublicChannelCache();
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> uploadBanner(String id, File file) async {
    final data = await ApiService.uploadFile(
      '/channels/$id/upload/banner',
      file,
    );
    _invalidatePublicChannelCache();
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  /// Returns channels belonging to creators the authenticated user subscribes to.
  static Future<List<ChannelModel>> getSubscriberFeed() async {
    final data = await ApiService.get('/channels/subscriber-feed');
    final list = data['channels'] as List<dynamic>;
    return list
        .map((e) => ChannelModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<FollowStatusModel> getFollowStatus(String creatorId) async {
    final data = await ApiService.get('/users/follows/$creatorId');
    return FollowStatusModel.fromJson(data);
  }

  static Future<FollowStatusModel> followCreator(String creatorId) async {
    final data = await ApiService.post('/users/follows/$creatorId', {});
    return FollowStatusModel.fromJson(data);
  }

  static Future<FollowStatusModel> unfollowCreator(String creatorId) async {
    final data = await ApiService.delete('/users/follows/$creatorId');
    return FollowStatusModel.fromJson(data);
  }

  static Future<FollowStatusModel> getChannelFollowStatus(
    String channelId,
  ) async {
    final data = await ApiService.get('/subscriptions/channel/check/$channelId');
    return FollowStatusModel(
      followed: data['subscribed'] as bool? ?? false,
      followersCount: 0,
    );
  }

  static Future<FollowStatusModel> followChannel(String channelId) async {
    final data = await ApiService.post(
      '/subscriptions/channel/subscribe',
      {'channelId': channelId},
    );
    final sub = data['subscription'] as Map<String, dynamic>?;
    return FollowStatusModel(
      followed: sub != null,
      followersCount: 0,
    );
  }

  static Future<FollowStatusModel> unfollowChannel(String channelId) async {
    // First check to get subscription id, then cancel
    final checkData = await ApiService.get('/subscriptions/channel/check/$channelId');
    final sub = checkData['subscription'] as Map<String, dynamic>?;
    if (sub != null && sub['id'] != null) {
      await ApiService.delete('/subscriptions/channel/${sub['id']}/cancel');
    }
    return const FollowStatusModel(followed: false, followersCount: 0);
  }

  static Future<void> recordView(String channelId) async {
    await ApiService.post('/channels/$channelId/view', {'platform': 'android'});
  }

  /// Reports accumulated watch-time for a channel. Called periodically by
  /// the player screens while a user is actively watching, so the admin
  /// live-viewers dashboard can show real "hours watched" totals.
  static Future<void> recordWatchPing(String channelId, int seconds) async {
    await ApiService.post('/channels/$channelId/watch-ping', {
      'seconds': seconds,
      'platform': 'android',
    });
  }

  /// Updates the external stream source for a channel. The backend automatically
  /// classifies and probes the URL, returning the enriched channel with
  /// resolved_playback_url and stream_status populated.
  static Future<ChannelModel> updateExternalSource(
    String id, {
    required String streamSourceMode,
    String? externalUrl,
    String? externalProvider,
  }) async {
    final data = await ApiService.patch('/channels/$id/external-source', {
      'stream_source_mode': streamSourceMode,
      if (externalUrl != null && externalUrl.isNotEmpty)
        'external_url': externalUrl,
      if (externalProvider != null && externalProvider.isNotEmpty)
        'external_provider': externalProvider,
    });
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  /// Validates a URL against the resolver without persisting anything.
  /// Returns the resolved source contract on success.
  static Future<Map<String, dynamic>> resolveSource(String url) async {
    return await ApiService.post('/channels/resolve-source', {'url': url});
  }

  /// Re-probes the currently configured source URL and persists the refreshed
  /// stream_status and last_checked_at on the channel.
  static Future<ChannelModel> recheckStreamHealth(String id) async {
    final data = await ApiService.post('/channels/$id/recheck-source', {});
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> updateExclusiveSettings(
    String id, {
    required double monthlyFeeNgn,
  }) async {
    final data = await ApiService.patch('/channels/$id/exclusive-settings', {
      'monthly_fee_ngn': monthlyFeeNgn,
    });
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ExclusiveAccessStatusModel> getExclusiveAccessStatus(
    String channelId,
  ) async {
    final data = await ApiService.get(
      '/channels/$channelId/exclusive/access-status',
    );
    return ExclusiveAccessStatusModel.fromJson(data);
  }

  static Future<ExclusivePurchaseResultModel> purchaseExclusiveAccess(
    String channelId,
  ) async {
    final data = await ApiService.post(
      '/channels/$channelId/exclusive/purchase',
      {},
    );
    return ExclusivePurchaseResultModel.fromJson(data);
  }

  static Future<Map<String, dynamic>> getMyExclusiveAccesses() async {
    final data = await ApiService.get('/channels/exclusive/my-accesses');
    return data;
  }

  static Future<ExclusivePurchaseResultModel> renewExclusiveAccess(
    String channelId,
  ) async {
    final data = await ApiService.post(
      '/channels/$channelId/exclusive/renew',
      {},
    );
    return ExclusivePurchaseResultModel.fromJson(data);
  }

  /// POST /channels/:id/exclusive/request — submit a membership request for
  /// an exclusive channel the user is not entitled to. Returns
  /// `{success, message?, request_id?, status?, code?}`. Never throws.
  ///
  /// Backend rules (see Phase 3): one pending request per (user, channel),
  /// requester must be KYC-verified, and the target channel must have an
  /// type of `exclusive`.
  static Future<Map<String, dynamic>> submitExclusiveRequest(
    String channelId, {
    required String note,
    String? referralCode,
  }) async {
    try {
      final data = await ApiService.post(
        '/channels/$channelId/exclusive/request',
        {
          'note': note,
          if (referralCode != null && referralCode.isNotEmpty)
            'referral_code': referralCode,
        },
      );
      final root = (data['data'] as Map<String, dynamic>? ?? data);
      return {
        'success': true,
        'message': root['message'] as String? ?? 'Request submitted.',
        'request_id': root['request_id'] as String?,
        'status': root['status'] as String? ?? 'pending',
      };
    } catch (e) {
      return {
        'success': false,
        'message': e.toString(),
        'code': 'REQUEST_FAILED',
      };
    }
  }

  /// GET /channels/:id/exclusive/requests/:requestId — full record for the
  /// requester's own status screen. Owner/admin also permitted server-side.
  /// Returns `{success, request?}`; never throws.
  static Future<Map<String, dynamic>> fetchExclusiveRequest(
    String channelId,
    String requestId,
  ) async {
    try {
      final data = await ApiService.get(
        '/channels/$channelId/exclusive/requests/$requestId',
      );
      final root = (data['data'] as Map<String, dynamic>? ?? data);
      return {
        'success': true,
        'request': root['request'] as Map<String, dynamic>? ?? root,
      };
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  /// GET /channels/:id/exclusive/requests — owner/admin view of every
  /// membership request for a channel. Optional [status] filter matches
  /// the five backend statuses. Returns
  /// `{success, requests: List<Map>}`; never throws.
  static Future<Map<String, dynamic>> listExclusiveRequests(
    String channelId, {
    String? status,
  }) async {
    try {
      final q = (status != null && status.isNotEmpty) ? '?status=$status' : '';
      final data = await ApiService.get(
        '/channels/$channelId/exclusive/requests$q',
      );
      final root = (data['data'] as Map<String, dynamic>? ?? data);
      final rows = (root['requests'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      return {'success': true, 'requests': rows};
    } catch (e) {
      return {'success': false, 'message': e.toString(), 'requests': const []};
    }
  }

  /// POST /channels/:id/exclusive/requests/:requestId/approve.
  static Future<Map<String, dynamic>> approveExclusiveRequest(
    String channelId,
    String requestId, {
    String? adminMessage,
  }) async {
    return _postRequestAction(
      channelId,
      requestId,
      'approve',
      adminMessage: adminMessage,
    );
  }

  /// POST /channels/:id/exclusive/requests/:requestId/reject.
  /// [adminMessage] is optional but strongly recommended so the applicant
  /// knows why.
  static Future<Map<String, dynamic>> rejectExclusiveRequest(
    String channelId,
    String requestId, {
    String? adminMessage,
  }) async {
    return _postRequestAction(
      channelId,
      requestId,
      'reject',
      adminMessage: adminMessage,
    );
  }

  /// POST /channels/:id/exclusive/requests/:requestId/more-info.
  /// [adminMessage] is REQUIRED (backend rejects empty).
  static Future<Map<String, dynamic>> requestMoreInfoExclusiveRequest(
    String channelId,
    String requestId, {
    required String adminMessage,
  }) async {
    return _postRequestAction(
      channelId,
      requestId,
      'more-info',
      adminMessage: adminMessage,
    );
  }

  static Future<Map<String, dynamic>> _postRequestAction(
    String channelId,
    String requestId,
    String action, {
    String? adminMessage,
  }) async {
    try {
      final data = await ApiService.post(
        '/channels/$channelId/exclusive/requests/$requestId/$action',
        {
          if (adminMessage != null && adminMessage.isNotEmpty)
            'admin_message': adminMessage,
        },
      );
      final root = (data['data'] as Map<String, dynamic>? ?? data);
      return {
        'success': true,
        'request': root['request'] as Map<String, dynamic>?,
      };
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  /// POST /channels/:id/exclusive/requests/:requestId/reply — requester
  /// answering a `more_info` admin question. Backend flips status back to
  /// `pending` and notifies the owner.
  static Future<Map<String, dynamic>> replyToExclusiveRequest(
    String channelId,
    String requestId, {
    required String reply,
  }) async {
    try {
      final data = await ApiService.post(
        '/channels/$channelId/exclusive/requests/$requestId/reply',
        {'reply': reply},
      );
      return {
        'success': true,
        'message': (data['message'] as String?) ?? 'Reply sent.',
      };
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<ExclusivePicVerificationResultModel> verifyExclusivePic(
    String channelId, {
    required String pic,
  }) async {
    final data = await ApiService.post(
      '/channels/$channelId/exclusive/verify-pic',
      {'pic': pic},
    );
    return ExclusivePicVerificationResultModel.fromJson(data);
  }
}
