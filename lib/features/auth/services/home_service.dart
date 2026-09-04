import 'dart:convert';

import '../../../core/api/api_service.dart';
import '../../../core/services/section_cache.dart';

// Helpers to safely parse backend values which may be numbers or strings.
double _toDouble(dynamic v, {double fallback = 0}) {
  if (v == null) return fallback;
  if (v is double) return v;
  if (v is int) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? fallback;
  if (v is num) return v.toDouble();
  return fallback;
}

int _toInt(dynamic v, {int fallback = 0}) {
  if (v == null) return fallback;
  if (v is int) return v;
  if (v is double) return v.toInt();
  if (v is String) return int.tryParse(v) ?? fallback;
  if (v is num) return v.toInt();
  return fallback;
}

class HomeStats {
  final double totalVpt;
  final double totalNgn;
  final int vptRate;
  final double nairaEquivalent;
  final double totalDistributedVpt;
  final double totalDistributedNgn;
  final int totalBeneficiaries;
  final List<RecentChannel> recentChannels;
  final List<PromotedChannel> promotedChannels;
  final int totalChannels;
  final int totalMembers;

  HomeStats({
    required this.totalVpt,
    required this.totalNgn,
    required this.vptRate,
    required this.nairaEquivalent,
    required this.totalDistributedVpt,
    required this.totalDistributedNgn,
    required this.totalBeneficiaries,
    required this.recentChannels,
    required this.promotedChannels,
    required this.totalChannels,
    required this.totalMembers,
  });

  factory HomeStats._fromParts({
    required HomeCommunityPoolStats pool,
    required _HomeChannelHighlights highlights,
  }) {
    return HomeStats(
      totalVpt: pool.totalVpt,
      totalNgn: pool.totalNgn,
      vptRate: pool.vptRate,
      nairaEquivalent: pool.nairaEquivalent,
      totalDistributedVpt: pool.totalDistributedVpt,
      totalDistributedNgn: pool.totalDistributedNgn,
      totalBeneficiaries: pool.totalBeneficiaries,
      recentChannels: highlights.recentChannels,
      promotedChannels: highlights.promotedChannels,
      totalChannels: highlights.totalChannels,
      totalMembers: highlights.totalMembers,
    );
  }

  factory HomeStats.fromJson(Map<String, dynamic> json) {
    final pool =
        (json['community_pool'] as Map<String, dynamic>?) ??
        (json['data'] as Map<String, dynamic>?) ??
        <String, dynamic>{};
    final stats =
        (json['stats'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final recent = (json['recent_channels'] as List<dynamic>?) ?? [];
    final promoted = (json['promoted_channels'] as List<dynamic>?) ?? [];
    return HomeStats(
      totalVpt: _toDouble(pool['total_vpt']),
      totalNgn: _toDouble(pool['total_ngn']),
      vptRate: _toInt(pool['vpt_rate'], fallback: 750),
      nairaEquivalent: _toDouble(pool['naira_equivalent']),
      totalDistributedVpt: _toDouble(pool['total_distributed_vpt']),
      totalDistributedNgn: _toDouble(pool['total_distributed_ngn']),
      totalBeneficiaries: _toInt(pool['total_beneficiaries']),
      recentChannels: recent
          .map((e) => RecentChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      promotedChannels: promoted
          .map((e) => PromotedChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalChannels: _toInt(stats['total_channels']),
      totalMembers: _toInt(stats['total_members']),
    );
  }
}

class HomeCommunityPoolStats {
  final double totalVpt;
  final double totalNgn;
  final int vptRate;
  final double nairaEquivalent;
  final double totalDistributedVpt;
  final double totalDistributedNgn;
  final int totalBeneficiaries;

  HomeCommunityPoolStats({
    required this.totalVpt,
    required this.totalNgn,
    required this.vptRate,
    required this.nairaEquivalent,
    required this.totalDistributedVpt,
    required this.totalDistributedNgn,
    required this.totalBeneficiaries,
  });

  factory HomeCommunityPoolStats.fromJson(Map<String, dynamic> json) {
    // Accept both wrapped ({ "community_pool": { ... } }) and unwrapped
    // responses returned by different endpoints (/home/content vs
    // /home/community-pool). Be resilient to numbers-as-strings.
    final pool =
        (json['community_pool'] as Map<String, dynamic>?) ??
        (json['data'] as Map<String, dynamic>?) ??
        json;
    return HomeCommunityPoolStats(
      // Prefer canonical backend fields `balance_vpt` / `balance_ngn` when present
      totalVpt: _toDouble(pool['balance_vpt'] ?? pool['total_vpt']),
      totalNgn: _toDouble(pool['balance_ngn'] ?? pool['total_ngn']),
      vptRate: _toInt(pool['vpt_price_ngn'] ?? pool['vpt_rate'], fallback: 750),
      nairaEquivalent: _toDouble(
        pool['balance_ngn'] ?? pool['naira_equivalent'],
      ),
      totalDistributedVpt: _toDouble(
        pool['total_distributed_vpt'] ?? pool['total_distributed_vpt'],
      ),
      totalDistributedNgn: _toDouble(
        pool['total_distributed_ngn'] ?? pool['total_distributed_ngn'],
      ),
      totalBeneficiaries: _toInt(pool['total_beneficiaries']),
    );
  }
}

class _HomeChannelHighlights {
  final List<RecentChannel> recentChannels;
  final List<PromotedChannel> promotedChannels;
  final int totalChannels;
  final int totalMembers;

  _HomeChannelHighlights({
    required this.recentChannels,
    required this.promotedChannels,
    required this.totalChannels,
    required this.totalMembers,
  });

  factory _HomeChannelHighlights.empty() => _HomeChannelHighlights(
        recentChannels: const [],
        promotedChannels: const [],
        totalChannels: 0,
        totalMembers: 0,
      );

  factory _HomeChannelHighlights.fromJson(Map<String, dynamic> json) {
    final stats = (json['stats'] as Map<String, dynamic>?) ?? const {};
    final recent = (json['recent_channels'] as List<dynamic>?) ?? [];
    final promoted = (json['promoted_channels'] as List<dynamic>?) ?? [];
    return _HomeChannelHighlights(
      recentChannels: recent
          .map((e) => RecentChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      promotedChannels: promoted
          .map((e) => PromotedChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalChannels: (stats['total_channels'] as num?)?.toInt() ?? 0,
      totalMembers: (stats['total_members'] as num?)?.toInt() ?? 0,
    );
  }
}

class RecentChannel {
  final String id;
  final String name;
  final String? category;
  final String channelNumber;
  final String? logoUrl;
  final String? bannerUrl;
  final String createdAt;
  final String ownerName;

  RecentChannel({
    required this.id,
    required this.name,
    this.category,
    required this.channelNumber,
    this.logoUrl,
    this.bannerUrl,
    required this.createdAt,
    required this.ownerName,
  });

  static String _s(dynamic v, {String fallback = ''}) =>
      v == null ? fallback : v.toString();

  factory RecentChannel.fromJson(Map<String, dynamic> json) {
    return RecentChannel(
      id: _s(json['id']),
      name: _s(json['name']),
      category: json['category']?.toString(),
      channelNumber: _s(json['channel_number']),
      logoUrl: json['logo_url']?.toString(),
      bannerUrl: json['banner_url']?.toString(),
      createdAt: _s(json['created_at']),
      ownerName: _s(json['owner_name'], fallback: 'Unknown'),
    );
  }
}

class PromotedChannel {
  final String id;
  final String name;
  final String? category;
  final String channelNumber;
  final String? logoUrl;
  final String? bannerUrl;

  PromotedChannel({
    required this.id,
    required this.name,
    this.category,
    required this.channelNumber,
    this.logoUrl,
    this.bannerUrl,
  });

  static String _s(dynamic v, {String fallback = ''}) =>
      v == null ? fallback : v.toString();

  factory PromotedChannel.fromJson(Map<String, dynamic> json) {
    return PromotedChannel(
      id: _s(json['id']),
      name: _s(json['name']),
      category: json['category']?.toString(),
      channelNumber: _s(json['channel_number']),
      logoUrl: json['logo_url']?.toString(),
      bannerUrl: json['banner_url']?.toString(),
    );
  }
}

class HomeService {
  static const Duration _statsCacheTtl = Duration(minutes: 5);
  static const Duration _communityPoolCacheTtl = Duration(minutes: 1);
  static const Duration _channelHighlightsCacheTtl = Duration(minutes: 5);
  static const Duration _marqueeCacheTtl = Duration(minutes: 5);
  static HomeStats? _statsCache;
  static DateTime? _statsCacheUpdatedAt;
  static Future<HomeStats>? _statsRequestInFlight;
  static HomeCommunityPoolStats? _communityPoolCache;
  static DateTime? _communityPoolCacheUpdatedAt;
  static Future<HomeCommunityPoolStats>? _communityPoolRequestInFlight;
  static _HomeChannelHighlights? _channelHighlightsCache;
  static DateTime? _channelHighlightsCacheUpdatedAt;
  static Future<_HomeChannelHighlights>? _channelHighlightsRequestInFlight;
  static List<String>? _marqueeCache;
  static DateTime? _marqueeCacheUpdatedAt;
  static Future<List<String>>? _marqueeRequestInFlight;

  static Future<HomeCommunityPoolStats> getCommunityPoolStats({
    bool forceRefresh = false,
  }) async {
    final now = DateTime.now();
    final cacheAge = _communityPoolCacheUpdatedAt == null
        ? null
        : now.difference(_communityPoolCacheUpdatedAt!);

    if (!forceRefresh &&
        _communityPoolCache != null &&
        cacheAge != null &&
        cacheAge < _communityPoolCacheTtl) {
      return _communityPoolCache!;
    }

    if (_communityPoolRequestInFlight != null) {
      return _communityPoolRequestInFlight!;
    }

    _communityPoolRequestInFlight = () async {
      final data = await ApiService.get('/home/community-pool');
      final stats = HomeCommunityPoolStats.fromJson(data);
      _communityPoolCache = stats;
      _communityPoolCacheUpdatedAt = DateTime.now();
      return stats;
    }();

    try {
      return await _communityPoolRequestInFlight!;
    } finally {
      _communityPoolRequestInFlight = null;
    }
  }

  static Future<_HomeChannelHighlights> _getChannelHighlights({
    bool forceRefresh = false,
  }) async {
    final now = DateTime.now();
    final cacheAge = _channelHighlightsCacheUpdatedAt == null
        ? null
        : now.difference(_channelHighlightsCacheUpdatedAt!);

    if (!forceRefresh &&
        _channelHighlightsCache != null &&
        cacheAge != null &&
        cacheAge < _channelHighlightsCacheTtl) {
      return _channelHighlightsCache!;
    }

    if (_channelHighlightsRequestInFlight != null) {
      return _channelHighlightsRequestInFlight!;
    }

    _channelHighlightsRequestInFlight = () async {
      final data = await ApiService.get('/home/channel-highlights');
      final highlights = _HomeChannelHighlights.fromJson(data);
      _channelHighlightsCache = highlights;
      _channelHighlightsCacheUpdatedAt = DateTime.now();
      return highlights;
    }();

    try {
      return await _channelHighlightsRequestInFlight!;
    } finally {
      _channelHighlightsRequestInFlight = null;
    }
  }

  static Future<HomeStats> getStats({bool forceRefresh = false}) async {
    final now = DateTime.now();
    final cacheAge = _statsCacheUpdatedAt == null
        ? null
        : now.difference(_statsCacheUpdatedAt!);

    if (!forceRefresh &&
        _statsCache != null &&
        cacheAge != null &&
        cacheAge < _statsCacheTtl) {
      return _statsCache!;
    }

    if (_statsRequestInFlight != null) {
      return _statsRequestInFlight!;
    }

    _statsRequestInFlight = () async {
      // Fetch both in parallel, but isolate failures so a channel-highlights
      // error never zeroes out the community-pool data (and vice-versa).
      final poolFuture = getCommunityPoolStats(forceRefresh: forceRefresh);
      final highlightsFuture = _getChannelHighlights(forceRefresh: forceRefresh)
          .catchError((_) => _HomeChannelHighlights.empty());

      final pool = await poolFuture;
      final highlights = await highlightsFuture;

      final stats = HomeStats._fromParts(pool: pool, highlights: highlights);
      _statsCache = stats;
      _statsCacheUpdatedAt = DateTime.now();
      return stats;
    }();

    try {
      return await _statsRequestInFlight!;
    } finally {
      _statsRequestInFlight = null;
    }
  }

  // ── /home/content — Nocturne home body payload ─────────────────────────
  static const String _homeContentKey = 'home_content_v1';

  /// GET /home/content — raw payload used by the Nocturne home body
  /// (updates section, featured channels). Also cached on-disk so the home
  /// screen paints its updates/featured strip on cold-start before the
  /// network responds.
  static Future<Map<String, dynamic>> getHomeContent() async {
    final data = await ApiService.get('/home/content');
    await SectionCache.write(_homeContentKey, jsonEncode(data));
    return data;
  }

  /// Stale-while-revalidate wrapper for [getHomeContent].
  static Future<Map<String, dynamic>> getHomeContentCached({
    void Function(Map<String, dynamic> cached)? onCached,
  }) async {
    if (onCached != null) {
      final raw = await SectionCache.readStale(_homeContentKey);
      if (raw != null) {
        try {
          final decoded = jsonDecode(raw);
          if (decoded is Map<String, dynamic>) onCached(decoded);
        } catch (_) {}
      }
    }
    return getHomeContent();
  }

  static Future<List<String>> getMarqueeTopics({
    bool forceRefresh = false,
  }) async {
    final now = DateTime.now();
    final cacheAge = _marqueeCacheUpdatedAt == null
        ? null
        : now.difference(_marqueeCacheUpdatedAt!);

    if (!forceRefresh &&
        _marqueeCache != null &&
        cacheAge != null &&
        cacheAge < _marqueeCacheTtl) {
      return _marqueeCache!;
    }

    if (_marqueeRequestInFlight != null) {
      return _marqueeRequestInFlight!;
    }

    _marqueeRequestInFlight = () async {
      final data = await ApiService.getPublic('/home/marquee');
      final topics = data is List
          ? data
                .where((topic) => topic['active'] == true)
                .map<String>((topic) => topic['text'] as String)
                .toList()
          : <String>[];
      _marqueeCache = topics;
      _marqueeCacheUpdatedAt = DateTime.now();
      return topics;
    }();

    try {
      return await _marqueeRequestInFlight!;
    } finally {
      _marqueeRequestInFlight = null;
    }
  }
}
