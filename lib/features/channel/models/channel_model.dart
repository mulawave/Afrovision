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

  // Module 13 — Premium channel subscription fields
  final bool isPremiumChannel;
  final double subscriptionPriceNgn;
  final int subscriptionIntervalCount;
  final String subscriptionIntervalUnit;
  final String premiumElevationStatus;
  final double exclusiveMonthlyFeeNgn;
  final String exclusiveFeeCurrency;
  final String? exclusiveFeeLastUpdatedAt;
  final String? exclusiveFeeLastUpdatedBy;

  // External stream source fields (AV-STR-002)
  // stream_source_mode: 'native' | 'external_youtube' | 'external_hls' | 'external_dash'
  final String streamSourceMode;
  final String? externalProvider;
  final String? externalUrl;
  final String? resolvedPlaybackUrl;
  // stream_status: 'unknown' | 'valid' | 'live' | 'scheduled' | 'offline' | 'invalid' | 'access_denied'
  final String streamStatus;
  final String? lastCheckedAt;
  final Map<String, dynamic>? providerMetadata;

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
    this.isPremiumChannel = false,
    this.subscriptionPriceNgn = 0,
    this.subscriptionIntervalCount = 1,
    this.subscriptionIntervalUnit = 'month',
    this.premiumElevationStatus = 'none',
    this.exclusiveMonthlyFeeNgn = 0,
    this.exclusiveFeeCurrency = 'NGN',
    this.exclusiveFeeLastUpdatedAt,
    this.exclusiveFeeLastUpdatedBy,
    this.streamSourceMode = 'native',
    this.externalProvider,
    this.externalUrl,
    this.resolvedPlaybackUrl,
    this.streamStatus = 'unknown',
    this.lastCheckedAt,
    this.providerMetadata,
  });

  bool get isPrivate => type == 'private';
  bool get isPublic => type == 'public';
  bool get isExclusive => type == 'exclusive';
  bool get isPremium => requiresPayment;
  bool get hasExternalSource => streamSourceMode != 'native';
  bool get isExternalYouTube => streamSourceMode == 'external_youtube';
  bool get isExternalHls => streamSourceMode == 'external_hls';
  bool get isExternalDash => streamSourceMode == 'external_dash';
  bool get isStreamLive => streamStatus == 'live';
  bool get isStreamScheduled => streamStatus == 'scheduled';

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
      isPremiumChannel: json['is_premium_channel'] as bool? ?? false,
      subscriptionPriceNgn:
          (json['subscription_price_ngn'] as num?)?.toDouble() ?? 0,
      subscriptionIntervalCount:
          (json['subscription_interval_count'] as num?)?.toInt() ?? 1,
      subscriptionIntervalUnit:
          json['subscription_interval_unit'] as String? ?? 'month',
      premiumElevationStatus:
          json['premium_elevation_status'] as String? ?? 'none',
      exclusiveMonthlyFeeNgn:
          (json['exclusive_monthly_fee_ngn'] as num?)?.toDouble() ?? 0,
      exclusiveFeeCurrency: json['exclusive_fee_currency'] as String? ?? 'NGN',
      exclusiveFeeLastUpdatedAt:
          json['exclusive_fee_last_updated_at'] as String?,
      exclusiveFeeLastUpdatedBy:
          json['exclusive_fee_last_updated_by'] as String?,
      streamSourceMode: json['stream_source_mode'] as String? ?? 'native',
      externalProvider: json['external_provider'] as String?,
      externalUrl: json['external_url'] as String?,
      resolvedPlaybackUrl: json['resolved_playback_url'] as String?,
      streamStatus: json['stream_status'] as String? ?? 'unknown',
      lastCheckedAt: json['last_checked_at'] as String?,
      providerMetadata: (json['provider_metadata'] as Map?)
          ?.cast<String, dynamic>(),
    );
  }
}
