class CreatorSubscriptionModel {
  final String id;
  final String subscriberUid;
  final String creatorUid;
  final String plan;
  final String currency; // 'ngn' | 'vpt'
  final double amount;
  final String status; // 'active' | 'cancelled'
  final int nextBilling;
  final int subscribedAt;
  final int? lastRenewedAt;
  final int? cancelledAt;
  final String? cancelReason;
  final int renewalCount;

  CreatorSubscriptionModel({
    required this.id,
    required this.subscriberUid,
    required this.creatorUid,
    required this.plan,
    required this.currency,
    required this.amount,
    required this.status,
    required this.nextBilling,
    required this.subscribedAt,
    this.lastRenewedAt,
    this.cancelledAt,
    this.cancelReason,
    this.renewalCount = 0,
  });

  bool get isActive => status == 'active';

  factory CreatorSubscriptionModel.fromJson(Map<String, dynamic> json) {
    return CreatorSubscriptionModel(
      id: json['id'] as String,
      subscriberUid: json['subscriber_uid'] as String,
      creatorUid: json['creator_uid'] as String,
      plan: json['plan'] as String? ?? 'monthly',
      currency: json['currency'] as String,
      amount: (json['amount'] as num).toDouble(),
      status: json['status'] as String,
      nextBilling: (json['next_billing'] as num).toInt(),
      subscribedAt: (json['subscribed_at'] as num).toInt(),
      lastRenewedAt: (json['last_renewed_at'] as num?)?.toInt(),
      cancelledAt: (json['cancelled_at'] as num?)?.toInt(),
      cancelReason: json['cancel_reason'] as String?,
      renewalCount: (json['renewal_count'] as num?)?.toInt() ?? 0,
    );
  }
}
