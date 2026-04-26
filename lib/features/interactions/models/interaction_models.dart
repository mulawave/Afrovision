class GiftModel {
  final String id;
  final String name;
  final String icon;
  final String? animation;
  final String currency; // 'vpt' | 'ngn'
  final int vptUnits;
  final double nairaValue;
  final bool isActive;
  final int sortOrder;

  GiftModel({
    required this.id,
    required this.name,
    required this.icon,
    this.animation,
    required this.currency,
    required this.vptUnits,
    required this.nairaValue,
    required this.isActive,
    required this.sortOrder,
  });

  factory GiftModel.fromJson(Map<String, dynamic> json) {
    return GiftModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      icon: json['icon'] as String? ?? '🎁',
      animation: json['animation'] as String?,
      currency: json['currency'] as String? ?? 'vpt',
      vptUnits: (json['vpt_units'] as num?)?.toInt() ?? 0,
      nairaValue: (json['naira_value'] as num?)?.toDouble() ?? 0,
      isActive: json['is_active'] as bool? ?? true,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
    );
  }

  String get priceLabel {
    if (currency == 'ngn') return '₦${nairaValue.toStringAsFixed(0)}';
    final vpt = vptUnits / 1000000;
    if (vpt >= 1) return '${vpt.toStringAsFixed(1)} vPT';
    return '${(vptUnits / 1000).toStringAsFixed(0)}K units';
  }
}

class GiftWalletModel {
  final double vpt;
  final double cash;
  final double coins;

  GiftWalletModel({required this.vpt, required this.cash, required this.coins});

  static double _safe(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  factory GiftWalletModel.fromJson(Map<String, dynamic> json) {
    return GiftWalletModel(
      vpt: _safe(json['vpt']),
      cash: _safe(json['cash']),
      coins: _safe(json['coins']),
    );
  }

  /// Legacy convenience — vpt expressed in "units" (vpt × 1 000 000).
  int get vptUnits => (vpt * 1000000).round();
  double get ngnBalance => cash;

  String get vptLabel {
    if (vpt >= 1) return '${vpt.toStringAsFixed(2)} vPT';
    return '${(vptUnits / 1000).toStringAsFixed(0)}K units';
  }
}

class ChannelEventModel {
  final String id;
  final String type; // 'reaction' | 'gift'
  final String senderName;
  final int senderRepLevel;
  final String? emoji;
  final String? giftName;
  final String? giftIcon;
  final String? animation;
  final int createdAt;

  ChannelEventModel({
    required this.id,
    required this.type,
    required this.senderName,
    this.senderRepLevel = 0,
    this.emoji,
    this.giftName,
    this.giftIcon,
    this.animation,
    required this.createdAt,
  });

  factory ChannelEventModel.fromJson(Map<String, dynamic> json) {
    return ChannelEventModel(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      senderName: json['sender_name'] as String? ?? '',
      senderRepLevel: (json['sender_rep_level'] as num?)?.toInt() ?? 0,
      emoji: json['emoji'] as String?,
      giftName: json['gift_name'] as String?,
      giftIcon: json['gift_icon'] as String?,
      animation: json['animation'] as String?,
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
    );
  }
}

class LiveChatMessageModel {
  final String id;
  final String channelId;
  final String senderName;
  final int senderRepLevel;
  final String? badge;
  final String text;
  final int createdAt;
  final bool isOwn;

  LiveChatMessageModel({
    required this.id,
    required this.channelId,
    required this.senderName,
    this.senderRepLevel = 0,
    this.badge,
    required this.text,
    required this.createdAt,
    required this.isOwn,
  });

  factory LiveChatMessageModel.fromJson(Map<String, dynamic> json) {
    return LiveChatMessageModel(
      id: json['id'] as String? ?? '',
      channelId: json['channel_id'] as String? ?? '',
      senderName: json['sender_name'] as String? ?? 'Anonymous',
      senderRepLevel: (json['sender_rep_level'] as num?)?.toInt() ?? 0,
      badge: json['badge'] as String?,
      text: json['text'] as String? ?? '',
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      isOwn: json['is_own'] as bool? ?? false,
    );
  }
}

class LeaderboardEntry {
  final int rank;
  final String uid;
  final String displayName;
  final num total;

  LeaderboardEntry({
    required this.rank,
    required this.uid,
    required this.displayName,
    required this.total,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      uid: json['uid'] as String? ?? '',
      displayName: json['display_name'] as String? ?? '',
      total: json['total'] as num? ?? 0,
    );
  }
}
