class UserModel {
  final String id;
  final String email;
  final String? name;
  final String role;
  final bool isPremiumCreator;
  final String kycStatus;
  final String? subscriptionPlan;
  final String subscriptionStatus;
  final String? subscriptionExpiry;
  final String preferredCurrency;
  final double vptBalance;
  final String? bscAddress;
  final String? firstSubscriptionAt;
  final String createdAt;

  UserModel({
    required this.id,
    required this.email,
    this.name,
    required this.role,
    required this.isPremiumCreator,
    required this.kycStatus,
    this.subscriptionPlan,
    required this.subscriptionStatus,
    this.subscriptionExpiry,
    required this.preferredCurrency,
    required this.vptBalance,
    this.bscAddress,
    this.firstSubscriptionAt,
    required this.createdAt,
  });

  bool get isViewer => role == 'viewer';
  bool get isCreator => role == 'creator';
  bool get isAdmin => role == 'admin';
  bool get hasActiveSubscription => subscriptionStatus == 'active';

  String get subscriptionPlanDisplay =>
      subscriptionPlan?.toUpperCase() ?? 'NONE';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      role: json['role'] as String,
      isPremiumCreator: json['is_premium_creator'] as bool? ?? false,
      kycStatus: json['kyc_status'] as String? ?? 'none',
      subscriptionPlan: json['subscription_plan'] as String?,
      subscriptionStatus:
          json['subscription_status'] as String? ?? 'inactive',
      subscriptionExpiry: json['subscription_expiry'] as String?,
      preferredCurrency: json['preferred_currency'] as String? ?? 'NGN',
      vptBalance: (json['vpt_balance'] as num?)?.toDouble() ?? 0,
      bscAddress: json['bsc_address'] as String?,
      firstSubscriptionAt: json['first_subscription_at'] as String?,
      createdAt: json['created_at'] as String,
    );
  }
}
