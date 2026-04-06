class ChannelModel {
  final String id;
  final String ownerId;
  final String name;
  final String? description;
  final String? category;
  final String type;
  final String channelNumber;
  final String? logoUrl;
  final String? bannerUrl;
  final bool isActive;
  final String createdAt;
  final String? ownerName;
  final int followersCount;

  // Module 11 — Premium stream fields
  final bool requiresPayment;
  final String? entryFeeType; // 'vpt' | 'ngn'
  final int entryFeeVptUnits;
  final double entryFeeNgn;
  final int accessDurationMinutes;

  // Module 12 — Retention fields
  final bool isSubscriberOnly;

  ChannelModel({
    required this.id,
    required this.ownerId,
    required this.name,
    this.description,
    this.category,
    required this.type,
    required this.channelNumber,
    this.logoUrl,
    this.bannerUrl,
    required this.isActive,
    required this.createdAt,
    this.ownerName,
    this.followersCount = 0,
    this.requiresPayment = false,
    this.entryFeeType,
    this.entryFeeVptUnits = 0,
    this.entryFeeNgn = 0,
    this.accessDurationMinutes = 120,
    this.isSubscriberOnly = false,
  });

  bool get isPrivate => type == 'private';
  bool get isPublic => type == 'public';
  bool get isPremium => requiresPayment;

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
    return ChannelModel(
      id: json['id'] as String,
      ownerId: json['owner_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String?,
      type: json['type'] as String,
      channelNumber: json['channel_number'] as String,
      logoUrl: json['logo_url'] as String?,
      bannerUrl: json['banner_url'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      createdAt: json['created_at'] as String,
      ownerName: json['owner_name'] as String?,
      followersCount: (json['followers_count'] as num?)?.toInt() ?? 0,
      requiresPayment: json['requires_payment'] as bool? ?? false,
      entryFeeType: json['entry_fee_type'] as String?,
      entryFeeVptUnits: (json['entry_fee_vpt_units'] as num?)?.toInt() ?? 0,
      entryFeeNgn: (json['entry_fee_ngn'] as num?)?.toDouble() ?? 0,
      accessDurationMinutes:
          (json['access_duration_minutes'] as num?)?.toInt() ?? 120,
      isSubscriberOnly: json['is_subscriber_only'] as bool? ?? false,
    );
  }
}
