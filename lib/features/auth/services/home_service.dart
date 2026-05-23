import '../../../core/api/api_service.dart';

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
    final pool = json['community_pool'] as Map<String, dynamic>;
    final stats = json['stats'] as Map<String, dynamic>;
    final recent = (json['recent_channels'] as List<dynamic>?) ?? [];
    final promoted = (json['promoted_channels'] as List<dynamic>?) ?? [];
    return HomeStats(
      totalVpt: (pool['total_vpt'] as num).toDouble(),
      totalNgn: (pool['total_ngn'] as num).toDouble(),
      vptRate: (pool['vpt_rate'] as num).toInt(),
      nairaEquivalent: (pool['naira_equivalent'] as num).toDouble(),
      totalDistributedVpt:
          (pool['total_distributed_vpt'] as num?)?.toDouble() ?? 0,
      totalDistributedNgn:
          (pool['total_distributed_ngn'] as num?)?.toDouble() ?? 0,
      totalBeneficiaries: (pool['total_beneficiaries'] as num?)?.toInt() ?? 0,
      recentChannels: recent
          .map((e) => RecentChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      promotedChannels: promoted
          .map((e) => PromotedChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalChannels: (stats['total_channels'] as num).toInt(),
      totalMembers: (stats['total_members'] as num).toInt(),
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
    final pool = json['community_pool'] as Map<String, dynamic>;
    return HomeCommunityPoolStats(
      totalVpt: (pool['total_vpt'] as num).toDouble(),
      totalNgn: (pool['total_ngn'] as num).toDouble(),
      vptRate: (pool['vpt_rate'] as num).toInt(),
      nairaEquivalent: (pool['naira_equivalent'] as num).toDouble(),
      totalDistributedVpt:
          (pool['total_distributed_vpt'] as num?)?.toDouble() ?? 0,
      totalDistributedNgn:
          (pool['total_distributed_ngn'] as num?)?.toDouble() ?? 0,
      totalBeneficiaries: (pool['total_beneficiaries'] as num?)?.toInt() ?? 0,
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

  factory _HomeChannelHighlights.fromJson(Map<String, dynamic> json) {
    final stats = json['stats'] as Map<String, dynamic>;
    final recent = (json['recent_channels'] as List<dynamic>?) ?? [];
    final promoted = (json['promoted_channels'] as List<dynamic>?) ?? [];
    return _HomeChannelHighlights(
      recentChannels: recent
          .map((e) => RecentChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      promotedChannels: promoted
          .map((e) => PromotedChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalChannels: (stats['total_channels'] as num).toInt(),
      totalMembers: (stats['total_members'] as num).toInt(),
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

  factory RecentChannel.fromJson(Map<String, dynamic> json) {
    return RecentChannel(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String?,
      channelNumber: json['channel_number'] as String,
      logoUrl: json['logo_url'] as String?,
      bannerUrl: json['banner_url'] as String?,
      createdAt: json['created_at'] as String,
      ownerName: json['owner_name'] as String? ?? 'Unknown',
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

  factory PromotedChannel.fromJson(Map<String, dynamic> json) {
    return PromotedChannel(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String?,
      channelNumber: json['channel_number'] as String,
      logoUrl: json['logo_url'] as String?,
      bannerUrl: json['banner_url'] as String?,
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
      final results = await Future.wait([
        getCommunityPoolStats(forceRefresh: forceRefresh),
        _getChannelHighlights(forceRefresh: forceRefresh),
      ]);
      final stats = HomeStats._fromParts(
        pool: results[0] as HomeCommunityPoolStats,
        highlights: results[1] as _HomeChannelHighlights,
      );
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
