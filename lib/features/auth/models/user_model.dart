class UserModel {
  final String id;
  final String email;
  final String? name;
  final String? firstName;
  final String? lastName;
  final String? country;
  final String? state;
  final String? city;
  final String? address;
  final String? phoneNumber;
  final String? referralSource;
  final String? referralSourceDetail;
  final bool profileSetupComplete;
  final String role;
  final bool isPremiumCreator;
  final String kycStatus;
  final String? dateOfBirth;
  final bool isMinor;
  final String? guardianId;
  final String? kycGracePeriodEnd;
  final int kycReminderCount;
  final String? subscriptionPlan;
  final String? subscriptionPlanType;
  final String subscriptionStatus;
  final String? subscriptionExpiry;
  final String preferredCurrency;
  final double vptBalance;
  final double vpt;
  final double cash;
  final double coins;
  final String? bscAddress;
  final String? avatarUrl;
  final String? firstSubscriptionAt;
  final String createdAt;
  final int reputationLevel;
  final double totalReps;

  UserModel({
    required this.id,
    required this.email,
    this.name,
    this.firstName,
    this.lastName,
    this.country,
    this.state,
    this.city,
    this.address,
    this.phoneNumber,
    this.referralSource,
    this.referralSourceDetail,
    this.profileSetupComplete = false,
    required this.role,
    required this.isPremiumCreator,
    required this.kycStatus,
    this.dateOfBirth,
    this.isMinor = false,
    this.guardianId,
    this.kycGracePeriodEnd,
    this.kycReminderCount = 0,
    this.subscriptionPlan,
    this.subscriptionPlanType,
    required this.subscriptionStatus,
    this.subscriptionExpiry,
    required this.preferredCurrency,
    required this.vptBalance,
    required this.vpt,
    required this.cash,
    required this.coins,
    this.bscAddress,
    this.avatarUrl,
    this.firstSubscriptionAt,
    required this.createdAt,
    this.reputationLevel = 0,
    this.totalReps = 0,
  });

  bool get isViewer => role == 'viewer';
  bool get isCreator => role == 'creator';
  bool get isAdmin => role == 'admin';
  bool get isCreatorAccount => isCreator || isAdmin;
  bool get hasActiveSubscription {
    if (subscriptionStatus != 'active') return false;
    if (subscriptionExpiry == null || subscriptionExpiry!.isEmpty) return false;
    final expiry = DateTime.tryParse(subscriptionExpiry!);
    if (expiry == null) return false;
    return expiry.isAfter(DateTime.now());
  }
  bool get hasCreatorPlan =>
      hasActiveSubscription && subscriptionPlanType == 'creator';
  bool get hasViewerPlan =>
      hasActiveSubscription && subscriptionPlanType == 'viewer';
  bool get kycVerified => kycStatus == 'verified';

  bool get kycRequired =>
      kycStatus == 'none' ||
      kycStatus == 'rejected' ||
      kycStatus == 'minor_pending';

  bool get kycComplete =>
      kycStatus == 'verified' ||
      kycStatus == 'pending' ||
      kycStatus == 'under_review';

  bool get isMinorRestricted => isMinor;

  bool get gracePeriodActive =>
      kycGracePeriodEnd != null &&
      kycGracePeriodEnd!.isNotEmpty &&
      (DateTime.tryParse(kycGracePeriodEnd!)?.isAfter(DateTime.now()) ?? false);

  bool get gracePeriodExpired =>
      kycGracePeriodEnd != null &&
      kycGracePeriodEnd!.isNotEmpty &&
      (DateTime.tryParse(kycGracePeriodEnd!)?.isBefore(DateTime.now()) ?? false);

  bool get isProfileComplete => profileSetupComplete;

  String get subscriptionPlanDisplay =>
      subscriptionPlan?.toUpperCase() ?? 'NONE';

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: (json['id'] ?? '') as String,
      email: (json['email'] ?? '') as String,
      name: json['name'] as String?,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      country: json['country'] as String?,
      state: json['state'] as String?,
      city: json['city'] as String?,
      address: json['address'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      referralSource: json['referralSource'] as String?,
      referralSourceDetail: json['referralSourceDetail'] as String?,
      profileSetupComplete: json['profile_setup_complete'] as bool? ?? false,
      role: (json['role'] ?? 'viewer') as String,
      isPremiumCreator: json['is_premium_creator'] as bool? ?? false,
      kycStatus: json['kyc_status'] as String? ?? 'none',
      dateOfBirth: json['date_of_birth'] as String?,
      isMinor: json['is_minor'] as bool? ?? false,
      guardianId: json['guardian_id'] as String?,
      kycGracePeriodEnd: json['kyc_grace_period_end'] as String?,
      kycReminderCount: (json['kyc_reminder_count'] as num?)?.toInt() ?? 0,
      subscriptionPlan: json['subscription_plan'] as String?,
      subscriptionPlanType: json['subscription_plan_type'] as String?,
      subscriptionStatus: json['subscription_status'] as String? ?? 'inactive',
      subscriptionExpiry: json['subscription_expiry'] as String?,
      preferredCurrency: json['preferred_currency'] as String? ?? 'NGN',
      vptBalance: _toDouble(json['vpt_balance'] ?? json['vpt']),
      vpt: _toDouble(json['vpt']),
      cash: _toDouble(json['cash']),
      coins: _toDouble(json['coins']),
      bscAddress: json['bsc_address'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      firstSubscriptionAt: json['first_subscription_at'] as String?,
      createdAt: (json['created_at'] ?? '') as String,
      reputationLevel: (json['reputation_level'] as num?)?.toInt() ?? 0,
      totalReps: _toDouble(json['total_reps']),
    );
  }
}
