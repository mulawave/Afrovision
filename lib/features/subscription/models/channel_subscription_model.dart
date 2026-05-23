class ChannelSubscriptionModel {
  final String id;
  final String subscriberUid;
  final String channelId;
  final String channelName;
  final String? channelLogoUrl;
  final String? channelBannerUrl;
  final String? channelCategory;
  final String? channelDescription;
  final String? currency; // null for free
  final double amount;
  final double vptEquivalent;
  final String status; // 'active' | 'cancelled'
  final bool isPremium;
  final int intervalCount;
  final String intervalUnit;
  final int? nextBilling; // null for free
  final int subscribedAt;
  final int? lastRenewedAt;
  final int? cancelledAt;
  final String? cancelReason;
  final int renewalCount;

  ChannelSubscriptionModel({
    required this.id,
    required this.subscriberUid,
    required this.channelId,
    required this.channelName,
    this.channelLogoUrl,
    this.channelBannerUrl,
    this.channelCategory,
    this.channelDescription,
    this.currency,
    required this.amount,
    required this.vptEquivalent,
    required this.status,
    required this.isPremium,
    required this.intervalCount,
    required this.intervalUnit,
    this.nextBilling,
    required this.subscribedAt,
    this.lastRenewedAt,
    this.cancelledAt,
    this.cancelReason,
    this.renewalCount = 0,
  });

  bool get isActive => status == 'active';

  factory ChannelSubscriptionModel.fromJson(Map<String, dynamic> json) {
    return ChannelSubscriptionModel(
      id: json['id'] as String,
      subscriberUid: json['subscriber_uid'] as String,
      channelId: json['channel_id'] as String,
      channelName: json['channel_name'] as String? ?? 'Unknown Channel',
      channelLogoUrl: json['channel_logo_url'] as String?,
      channelBannerUrl: json['channel_banner_url'] as String?,
      channelCategory: json['channel_category'] as String?,
      channelDescription: json['channel_description'] as String?,
      currency: json['currency'] as String?,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      vptEquivalent: (json['vpt_equivalent'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String,
      isPremium: json['is_premium'] as bool? ?? false,
      intervalCount: (json['interval_count'] as num?)?.toInt() ?? 1,
      intervalUnit: json['interval_unit'] as String? ?? 'month',
      nextBilling: (json['next_billing'] as num?)?.toInt(),
      subscribedAt: (json['subscribed_at'] as num).toInt(),
      lastRenewedAt: (json['last_renewed_at'] as num?)?.toInt(),
      cancelledAt: (json['cancelled_at'] as num?)?.toInt(),
      cancelReason: json['cancel_reason'] as String?,
      renewalCount: (json['renewal_count'] as num?)?.toInt() ?? 0,
    );
  }
}
