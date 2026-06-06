import '../../../core/api/api_service.dart';

/// Result returned by [AuditionPaymentService.initiate].
class AuditionInitiateResult {
  final String signupId;
  final String paymentId;
  final String paymentReference;
  final String checkoutUrl;
  final double feeNgn;
  final double vptPriceAtSignup;
  final double vptAllocated;
  final double communityPoolAllocated;
  final double opsPoolAllocated;

  const AuditionInitiateResult({
    required this.signupId,
    required this.paymentId,
    required this.paymentReference,
    required this.checkoutUrl,
    required this.feeNgn,
    required this.vptPriceAtSignup,
    required this.vptAllocated,
    required this.communityPoolAllocated,
    required this.opsPoolAllocated,
  });

  factory AuditionInitiateResult.fromJson(Map<String, dynamic> json) {
    final alloc = (json['allocations'] as Map<String, dynamic>?) ?? {};
    return AuditionInitiateResult(
      signupId: json['signup_id'] as String,
      paymentId: json['payment_id'] as String,
      paymentReference: json['payment_reference'] as String? ?? '',
      checkoutUrl: json['checkout_url'] as String,
      feeNgn: (json['fee_ngn'] as num?)?.toDouble() ?? 2500,
      vptPriceAtSignup: (alloc['vpt_price_at_signup'] as num?)?.toDouble() ?? 0,
      vptAllocated: (alloc['vpt_allocated'] as num?)?.toDouble() ?? 0,
      communityPoolAllocated:
          (alloc['community_pool_allocated'] as num?)?.toDouble() ?? 0,
      opsPoolAllocated: (alloc['ops_pool_allocated'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Summarises the participant's current audition status.
class AuditionSignupStatus {
  final String signupStatus; // pending_payment | enrolled | cancelled
  final String paymentStatus; // pending | paid | failed
  final bool vptCredited;
  final String? enrolledAt;
  final String? journeyStep; // signup_received | shortlisted | audition_submitted | final_selected

  const AuditionSignupStatus({
    required this.signupStatus,
    required this.paymentStatus,
    required this.vptCredited,
    this.enrolledAt,
    this.journeyStep,
  });

  factory AuditionSignupStatus.fromJson(Map<String, dynamic> json) {
    final signup = (json['signup'] as Map<String, dynamic>?) ?? json;
    return AuditionSignupStatus(
      signupStatus: signup['signup_status'] as String? ?? 'pending_payment',
      paymentStatus: signup['payment_status'] as String? ?? 'pending',
      vptCredited: signup['vpt_credited'] as bool? ?? false,
      enrolledAt: signup['enrolled_at'] as String?,
      journeyStep: signup['journey_step'] as String?,
    );
  }

  bool get isEnrolled => signupStatus == 'enrolled';
}

/// Pricing preview from the public endpoint (no auth required).
class AuditionPricing {
  final double feeNgn;
  final double vptPriceAtSignup;
  final double vptAllocated;
  final double communityPoolAllocated;
  final double opsPoolAllocated;

  const AuditionPricing({
    required this.feeNgn,
    required this.vptPriceAtSignup,
    required this.vptAllocated,
    required this.communityPoolAllocated,
    required this.opsPoolAllocated,
  });

  factory AuditionPricing.fromJson(Map<String, dynamic> json) {
    final alloc = (json['allocations'] as Map<String, dynamic>?) ?? {};
    return AuditionPricing(
      feeNgn: (json['fee_ngn'] as num?)?.toDouble() ?? 2500,
      vptPriceAtSignup: (alloc['vpt_price_at_signup'] as num?)?.toDouble() ?? 0,
      vptAllocated: (alloc['vpt_allocated'] as num?)?.toDouble() ?? 0,
      communityPoolAllocated:
          (alloc['community_pool_allocated'] as num?)?.toDouble() ?? 0,
      opsPoolAllocated: (alloc['ops_pool_allocated'] as num?)?.toDouble() ?? 0,
    );
  }
}

class AuditionPaymentService {
  /// Fetch the live fee and vPT allocation preview (no auth required).
  static Future<AuditionPricing> getPricing() async {
    final dynamic raw = await ApiService.getPublic(
      '/challenge/audition/payment/pricing',
    );
    final data = raw as Map<String, dynamic>;
    return AuditionPricing.fromJson(data);
  }

  /// Initiate an audition signup payment for [challengeId].
  /// [provider] defaults to 'paystack'.
  /// Returns the checkout URL to open in the browser.
  static Future<AuditionInitiateResult> initiate({
    required String challengeId,
    String provider = 'paystack',
  }) async {
    final data = await ApiService.post(
      '/challenge/audition/payment/initialize',
      {'challenge_id': challengeId, 'provider': provider},
    );
    return AuditionInitiateResult.fromJson(data);
  }

  /// Verify and apply a payment after the user returns from the gateway.
  /// Returns the updated signup status.
  static Future<AuditionSignupStatus> verify(String paymentId) async {
    final data = await ApiService.post(
      '/challenge/audition/payment/$paymentId/verify',
      {},
    );
    return AuditionSignupStatus.fromJson(data);
  }

  /// Fetch the current user's audition signup status for [challengeId].
  /// Returns null if no signup exists.
  static Future<AuditionSignupStatus?> getMyStatus(String challengeId) async {
    try {
      final data = await ApiService.get(
        '/challenge/audition/status?challenge_id=$challengeId',
      );
      if (data['signup'] == null) return null;
      return AuditionSignupStatus.fromJson(data);
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }
}
