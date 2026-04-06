import '../../../core/api/api_service.dart';

class ReferralInfo {
  final String referralCode;
  final int invitedCount;
  final String? referredBy;
  final double totalEarningsNgn;
  final double totalEarningsVptUnits;

  const ReferralInfo({
    required this.referralCode,
    required this.invitedCount,
    this.referredBy,
    required this.totalEarningsNgn,
    required this.totalEarningsVptUnits,
  });

  factory ReferralInfo.fromJson(Map<String, dynamic> json) {
    return ReferralInfo(
      referralCode: json['referral_code'] as String? ?? '',
      invitedCount: (json['invited_count'] as num?)?.toInt() ?? 0,
      referredBy: json['referred_by'] as String?,
      totalEarningsNgn: (json['total_earnings_ngn'] as num?)?.toDouble() ?? 0,
      totalEarningsVptUnits:
          (json['total_earnings_vpt_units'] as num?)?.toDouble() ?? 0,
    );
  }
}

class ReferralEarning {
  final String id;
  final int level;
  final double amountNgn;
  final double amountVptUnits;
  final String? sourceEmail;
  final String? sourceName;
  final int createdAt;

  const ReferralEarning({
    required this.id,
    required this.level,
    required this.amountNgn,
    required this.amountVptUnits,
    this.sourceEmail,
    this.sourceName,
    required this.createdAt,
  });

  factory ReferralEarning.fromJson(Map<String, dynamic> json) {
    return ReferralEarning(
      id: json['id'] as String? ?? '',
      level: (json['level'] as num?)?.toInt() ?? 1,
      amountNgn: (json['amount_ngn'] as num?)?.toDouble() ?? 0,
      amountVptUnits: (json['amount_vpt_units'] as num?)?.toDouble() ?? 0,
      sourceEmail: json['source_email'] as String?,
      sourceName: json['source_name'] as String?,
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
    );
  }
}

class ReferralPerson {
  final String uid;
  final String? name;
  final String? email;
  final int? joinedAt;
  final int? level;

  const ReferralPerson({
    required this.uid,
    this.name,
    this.email,
    this.joinedAt,
    this.level,
  });

  factory ReferralPerson.fromJson(Map<String, dynamic> json) {
    return ReferralPerson(
      uid: json['uid'] as String? ?? '',
      name: json['name'] as String?,
      email: json['email'] as String?,
      joinedAt: (json['joined_at'] as num?)?.toInt(),
      level: (json['level'] as num?)?.toInt(),
    );
  }
}

class LevelDistribution {
  final int level;
  final int percentage;

  const LevelDistribution({required this.level, required this.percentage});

  factory LevelDistribution.fromJson(Map<String, dynamic> json) {
    return LevelDistribution(
      level: (json['level'] as num?)?.toInt() ?? 1,
      percentage: (json['percentage'] as num?)?.toInt() ?? 0,
    );
  }
}

class ReferralDashboard {
  final String referralCode;
  final int invitedCount;
  final double totalEarningsNgn;
  final double totalEarningsVptUnits;
  final List<ReferralEarning> earnings;
  final List<ReferralPerson> upline;
  final List<ReferralPerson> directReferrals;
  final List<LevelDistribution> levelDistribution;

  const ReferralDashboard({
    required this.referralCode,
    required this.invitedCount,
    required this.totalEarningsNgn,
    required this.totalEarningsVptUnits,
    required this.earnings,
    required this.upline,
    required this.directReferrals,
    required this.levelDistribution,
  });

  factory ReferralDashboard.fromJson(Map<String, dynamic> json) {
    return ReferralDashboard(
      referralCode: json['referral_code'] as String? ?? '',
      invitedCount: (json['invited_count'] as num?)?.toInt() ?? 0,
      totalEarningsNgn: (json['total_earnings_ngn'] as num?)?.toDouble() ?? 0,
      totalEarningsVptUnits:
          (json['total_earnings_vpt_units'] as num?)?.toDouble() ?? 0,
      earnings:
          (json['earnings'] as List<dynamic>?)
              ?.map((e) => ReferralEarning.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      upline:
          (json['upline'] as List<dynamic>?)
              ?.map((e) => ReferralPerson.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      directReferrals:
          (json['direct_referrals'] as List<dynamic>?)
              ?.map((e) => ReferralPerson.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      levelDistribution:
          (json['level_distribution'] as List<dynamic>?)
              ?.map(
                (e) => LevelDistribution.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          [],
    );
  }
}

class ReferralService {
  /// Fetches (or creates) the authenticated user's referral code + stats.
  static Future<ReferralInfo> getMyCode() async {
    final data = await ApiService.get('/referrals/my-code');
    return ReferralInfo.fromJson(data);
  }

  /// Fetches the full referral dashboard (earnings, tree, upline, etc.).
  static Future<ReferralDashboard> getDashboard() async {
    final data = await ApiService.get('/referrals/dashboard');
    return ReferralDashboard.fromJson(data);
  }

  /// Applies a referral code — call after registration if the user had one.
  static Future<Map<String, dynamic>> applyCode(String referralCode) async {
    return ApiService.post('/referrals/apply', {'referral_code': referralCode});
  }
}
