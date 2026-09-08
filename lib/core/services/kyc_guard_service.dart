import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../features/auth/models/user_model.dart';
import '../../features/auth/services/auth_service.dart';
import '../../features/kyc/services/kyc_service.dart';
import '../widgets/kyc_required_sheet.dart';

/// Central KYC gating helper.
///
/// Use [ensureKycVerified] before any action that requires an adult-verified
/// account (playback, purchase, comment, upload, withdraw, etc.).
///
/// If the user is not KYC-verified, it shows the standard [KycRequiredSheet]
/// and optionally retries the guarded action via [onComplete] when the user
/// returns from the KYC flow.
class KycGuard {
  static Future<bool> ensureKycVerified(
    BuildContext context, {
    VoidCallback? onComplete,
  }) async {
    if (!context.mounted) return false;

    final user = await _fetchUser();
    if (user != null && user.kycVerified) {
      onComplete?.call();
      return true;
    }

    final confirmed = await _showSheet(context);
    if (!confirmed) return false;

    // Refresh both KYC and user records after the user has returned from KYC.
    await KycService.getMe(forceRefresh: true);
    final refreshed = await AuthService.getCurrentUser(forceRefresh: true);

    if (refreshed.kycVerified) {
      onComplete?.call();
      return true;
    }

    return false;
  }

  /// Quick helper for widgets that already know they need to show the gate
  /// but want the same user experience.
  static Future<bool> mayProceed(BuildContext context) async {
    return ensureKycVerified(context);
  }

  /// Runs an action only if the current user is KYC-verified. If not, the
  /// KYC sheet is shown and the action is retried after successful KYC.
  static Future<bool> run(
    BuildContext context,
    Future<void> Function() action, {
    String? feature,
  }) async {
    return ensureKycVerified(
      context,
      onComplete: () async {
        try {
          await action();
        } catch (_) {}
      },
    );
  }

  static Future<UserModel?> _fetchUser() async {
    try {
      return await AuthService.getCurrentUser();
    } catch (_) {
      return null;
    }
  }

  static Future<bool> _showSheet(BuildContext context) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      isDismissible: true,
      enableDrag: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0xA8040814),
      builder: (ctx) => const KycRequiredSheet(),
    );

    if (result == true) {
      if (!context.mounted) return false;
      final completed = await Navigator.pushNamed(context, '/kyc');
      // `completed` may be null (pop) or a bool. Any non-false return is
      // treated as having finished the KYC screen.
      return completed != false;
    }

    return false;
  }

  /// Screen-entry guard. Call from `initState` of any screen that performs
  /// only KYC-gated actions (uploads, creator studio, etc.). Shows the
  /// standard [KycRequiredSheet] on next frame and pops the route if the
  /// user does not complete verification. Safe to call multiple times.
  static void enforceOnEntry(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!context.mounted) return;
      final ok = await ensureKycVerified(context);
      if (!context.mounted) return;
      if (!ok) Navigator.of(context).maybePop();
    });
  }

  /// Opens the free public website for non-KYC users.
  static Future<void> openFreeWebsite() async {
    final uri = Uri.parse('https://afrovision-website-zoeqld5lsa-uc.a.run.app');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
