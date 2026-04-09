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
  static Future<HomeStats> getStats() async {
    final data = await ApiService.get('/home/stats');
    return HomeStats.fromJson(data);
  }
}
