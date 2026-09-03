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
  final int subscriberCount;
  final int viewerCount;

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
    this.subscriberCount = 0,
    this.viewerCount = 0,
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
  bool get isExclusive => exclusiveMonthlyFeeNgn > 0;
  bool get isPremium => requiresPayment;
  bool get hasExternalSource => streamSourceMode != 'native';
  bool get isExternalYouTube => streamSourceMode == 'external_youtube';
  bool get isExternalHls => streamSourceMode == 'external_hls';
  bool get isExternalDash => streamSourceMode == 'external_dash';
  bool get isStreamLive => streamStatus == 'live';
  bool get isStreamScheduled => streamStatus == 'scheduled';

  static String _asString(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    return value.toString();
  }

  static String? _asNullableString(dynamic value) {
    if (value == null) return null;
    final parsed = value.toString();
    return parsed.isEmpty ? null : parsed;
  }

  static bool _asBool(dynamic value, {bool fallback = false}) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final normalized = value.trim().toLowerCase();
      if (normalized == 'true' || normalized == '1') return true;
      if (normalized == 'false' || normalized == '0') return false;
    }
    return fallback;
  }

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
    return ChannelModel(
      id: _asString(json['id']),
      ownerId: _asString(json['owner_id']),
      name: _asString(json['name']),
      description: _asNullableString(json['description']),
      category: _asNullableString(json['category']),
      type: _asString(json['type'], fallback: 'public'),
      channelNumber: _asString(json['channel_number']),
      logoUrl: _asNullableString(json['logo_url']),
      bannerUrl: _asNullableString(json['banner_url']),
      isActive: _asBool(json['is_active'], fallback: true),
      createdAt: _asString(json['created_at']),
      ownerName: _asNullableString(json['owner_name']),
      followersCount: (json['followers_count'] as num?)?.toInt() ?? 0,
      subscriberCount: (json['subscriber_count'] as num?)?.toInt() ??
          (json['followers_count'] as num?)?.toInt() ?? 0,
      viewerCount: (json['viewer_count'] as num?)?.toInt() ?? 0,
      requiresPayment: _asBool(json['requires_payment']),
      entryFeeType: _asNullableString(json['entry_fee_type']),
      entryFeeVptUnits: (json['entry_fee_vpt_units'] as num?)?.toInt() ?? 0,
      entryFeeNgn: (json['entry_fee_ngn'] as num?)?.toDouble() ?? 0,
      accessDurationMinutes:
          (json['access_duration_minutes'] as num?)?.toInt() ?? 120,
      isSubscriberOnly: _asBool(json['is_subscriber_only']),
      isPremiumChannel: _asBool(json['is_premium_channel']),
      subscriptionPriceNgn:
          (json['subscription_price_ngn'] as num?)?.toDouble() ?? 0,
      subscriptionIntervalCount:
          (json['subscription_interval_count'] as num?)?.toInt() ?? 1,
      subscriptionIntervalUnit: _asString(
        json['subscription_interval_unit'],
        fallback: 'month',
      ),
      premiumElevationStatus: _asString(
        json['premium_elevation_status'],
        fallback: 'none',
      ),
      exclusiveMonthlyFeeNgn:
          (json['exclusive_monthly_fee_ngn'] as num?)?.toDouble() ?? 0,
      exclusiveFeeCurrency: _asString(
        json['exclusive_fee_currency'],
        fallback: 'NGN',
      ),
      exclusiveFeeLastUpdatedAt: _asNullableString(
        json['exclusive_fee_last_updated_at'],
      ),
      exclusiveFeeLastUpdatedBy: _asNullableString(
        json['exclusive_fee_last_updated_by'],
      ),
      streamSourceMode: _asString(
        json['stream_source_mode'],
        fallback: 'native',
      ),
      externalProvider: _asNullableString(json['external_provider']),
      externalUrl: _asNullableString(json['external_url']),
      resolvedPlaybackUrl: _asNullableString(json['resolved_playback_url']),
      streamStatus: _asString(json['stream_status'], fallback: 'unknown'),
      lastCheckedAt: _asNullableString(json['last_checked_at']),
      providerMetadata: (json['provider_metadata'] as Map?)
          ?.cast<String, dynamic>(),
    );
  }
}
