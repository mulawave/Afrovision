import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/api/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';
import '../services/pic_storage_service.dart';
import '../../auth/services/auth_service.dart';
import '../../kyc/services/kyc_service.dart';
import '../../subscription/widgets/exclusive_membership_sheets.dart';

class ExclusiveAccessPaywallScreen extends StatefulWidget {
  const ExclusiveAccessPaywallScreen({super.key});

  @override
  State<ExclusiveAccessPaywallScreen> createState() =>
      _ExclusiveAccessPaywallScreenState();
}

enum _ExclusiveState {
  loading,
  requiresLogin,
  requiresKyc,
  noEntitlement,
  hasEntitlement,
  purchaseInProgress,
  purchaseSuccess,
  purchaseFailure,
}

class _ExclusiveAccessPaywallScreenState
    extends State<ExclusiveAccessPaywallScreen>
    with SingleTickerProviderStateMixin {
  ChannelModel? _channel;
  String? _channelId;
  ExclusiveAccessStatusModel? _status;

  final _picController = TextEditingController();

  bool _verifyingPic = false;
  bool _picVerified = false;
  String? _error;
  String? _info;

  /// Case-insensitive referral used to pick between direct purchase (Xlounge)
  /// and the request/approval flow (everyone else). Loaded alongside the
  /// entitlement status so the noEntitlement card can branch immediately.
  String? _referralSource;
  double _walletNgn = 0;

  static const String _xloungeReferral = 'xlounge-extreme';

  bool get _isXlounge =>
      (_referralSource ?? '').trim().toLowerCase() == _xloungeReferral;

  _ExclusiveState _state = _ExclusiveState.loading;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _fadeIn = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_channelId != null) return;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is ChannelModel) {
      _channel = args;
      _channelId = args.id;
    } else if (args is String) {
      _channelId = args;
    }

    if (_channelId == null) {
      setState(() {
        _state = _ExclusiveState.purchaseFailure;
        _error = 'Channel data is missing for exclusive access.';
      });
      return;
    }

    _loadAccessState();
  }

  @override
  void dispose() {
    _picController.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAccessState() async {
    setState(() {
      _state = _ExclusiveState.loading;
      _error = null;
      _info = null;
      _picVerified = false;
    });

    try {
      var status = await ChannelService.getExclusiveAccessStatus(_channelId!);
      final currentUser = await AuthService.getCurrentUser();
      _referralSource = currentUser.referralSource;
      _walletNgn = currentUser.cash.toDouble();
      if (!status.eligibleByKyc && currentUser.kycStatus == 'verified') {
        try {
          await KycService.getMe(forceRefresh: true);
          status = await ChannelService.getExclusiveAccessStatus(_channelId!);
        } catch (_) {
          // ignore and fall through to existing blocking behaviour
        }
      }
      if (!mounted) return;

      setState(() {
        _status = status;
        if (!status.eligibleByKyc) {
          _state = _ExclusiveState.requiresKyc;
        } else if (status.hasActiveEntitlement) {
          _state = _ExclusiveState.hasEntitlement;
        } else {
          _state = _ExclusiveState.noEntitlement;
        }
      });
      _animCtrl.forward(from: 0);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 401) {
        setState(() => _state = _ExclusiveState.requiresLogin);
      } else if (e.statusCode == 403 &&
          e.message.toLowerCase().contains('kyc')) {
        setState(() => _state = _ExclusiveState.requiresKyc);
      } else {
        setState(() {
          _state = _ExclusiveState.purchaseFailure;
          _error = e.message;
        });
      }
      _animCtrl.forward(from: 0);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _state = _ExclusiveState.purchaseFailure;
        _error = 'Unable to load access state. Please try again.';
      });
      _animCtrl.forward(from: 0);
    }
  }

  Future<void> _purchaseOrRenew() async {
    final shouldRenew = _status?.renewalRequired == true;
    setState(() {
      _state = _ExclusiveState.purchaseInProgress;
      _error = null;
      _info = null;
    });

    try {
      final result = shouldRenew
          ? await ChannelService.renewExclusiveAccess(_channelId!)
          : await ChannelService.purchaseExclusiveAccess(_channelId!);
      if (!mounted) return;

      setState(() {
        _state = _ExclusiveState.purchaseSuccess;
        _status = ExclusiveAccessStatusModel(
          eligibleByKyc: true,
          hasActiveEntitlement: true,
          renewalRequired: false,
          expiresAt: result.expiresAt,
          monthlyFeeNgn: _status?.monthlyFeeNgn ?? 0,
        );
      });

      if ((result.personalIdentifierCode ?? '').isNotEmpty) {
        _picController.text = result.personalIdentifierCode!;
        // Save PIC locally for later viewing
        await PicStorageService.savePic(_channelId!, result.personalIdentifierCode!);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      String message = e.message;
      if (message.contains('INSUFFICIENT_NGN')) {
        message = 'Insufficient NGN wallet balance for this purchase.';
      }
      if (message.toLowerCase().contains('kyc')) {
        setState(() {
          _state = _ExclusiveState.requiresKyc;
          _error = null;
        });
        return;
      }
      // Safety net: the backend may have granted access despite returning
      // an error (e.g. post-processing failure after access was granted,
      // or a network timeout after a successful request). Re-check access
      // status before showing a failure to the user.
      final accessActuallyGranted = await _recheckAccessAfterError();
      if (accessActuallyGranted) return;
      if (!mounted) return;
      setState(() {
        _state = _ExclusiveState.purchaseFailure;
        _error = message;
      });
    } catch (_) {
      if (!mounted) return;
      // Same safety net for generic errors (network timeout, etc.)
      final accessActuallyGranted = await _recheckAccessAfterError();
      if (accessActuallyGranted) return;
      if (!mounted) return;
      setState(() {
        _state = _ExclusiveState.purchaseFailure;
        _error = 'Payment failed. Please try again.';
      });
    }
  }

  /// Re-checks exclusive access status after a purchase error.
  /// Returns true if access was actually granted despite the error,
  /// in which case the UI is updated to show the success state.
  Future<bool> _recheckAccessAfterError() async {
    try {
      final status = await ChannelService.getExclusiveAccessStatus(_channelId!);
      if (!mounted) return false;
      if (status.hasActiveEntitlement) {
        setState(() {
          _status = status;
          _state = _ExclusiveState.purchaseSuccess;
          _error = null;
          _info = 'Your access is active. Payment was processed successfully.';
        });
        return true;
      }
    } catch (_) {
      // If re-check also fails, fall through to show original error
    }
    return false;
  }

  Future<void> _verifyPic() async {
    final pic = _picController.text.trim();
    if (pic.isEmpty) {
      setState(() => _error = 'Enter your personal identifier code to verify.');
      return;
    }

    setState(() {
      _verifyingPic = true;
      _error = null;
      _info = null;
    });

    try {
      await ChannelService.verifyExclusivePic(_channelId!, pic: pic);
      if (!mounted) return;
      setState(() {
        _verifyingPic = false;
        _picVerified = true;
        _info = 'PIC verified successfully. Access is ready.';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _verifyingPic = false;
        _picVerified = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _verifyingPic = false;
        _picVerified = false;
        _error = 'PIC verification failed. Please try again.';
      });
    }
  }

  void _copyPic() {
    final pic = _picController.text.trim();
    if (pic.isEmpty) return;
    Clipboard.setData(ClipboardData(text: pic));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text(
          'PIC copied',
          style: TextStyle(color: AppColors.white),
        ),
        backgroundColor: AppColors.successGreen.withValues(alpha: 0.92),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _continueToChannel() {
    Navigator.of(context).pop(true);
  }

  String _channelTitle() => _channel?.name ?? 'Exclusive Channel';

  String _expiryLabel() {
    final exp = _status?.expiresAt;
    if (exp == null || exp.isEmpty) return '30-day access period';
    // Try ISO 8601 format first
    DateTime? parsed = DateTime.tryParse(exp)?.toLocal();
    // If that fails, try parsing as a millisecond timestamp (backend stores it as a number)
    if (parsed == null) {
      final ms = int.tryParse(exp);
      if (ms != null && ms > 0) {
        parsed = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).toLocal();
      }
    }
    if (parsed == null) return exp;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: _state == _ExclusiveState.loading
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.orange),
                )
              : FadeTransition(
                  opacity: _fadeIn,
                  child: SlideTransition(
                    position: _slideUp,
                    child: _buildBody(),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(
                  Icons.arrow_back_ios_new,
                  color: AppColors.white,
                  size: 20,
                ),
                onPressed: () => Navigator.of(context).pop(false),
              ),
              const Expanded(
                child: Text(
                  'Exclusive Access',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(width: 48),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadAccessState,
            color: AppColors.orange,
            backgroundColor: AppColors.inputFill,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHeader(),
                  const SizedBox(height: 20),
                  _buildStateCard(),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    _buildNotice(_error!, AppColors.errorRed),
                  ],
                  if (_info != null) ...[
                    const SizedBox(height: 14),
                    _buildNotice(_info!, AppColors.successGreen),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.verified_user_rounded,
                  color: AppColors.orange,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  _channelTitle(),
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Monthly fee: NGN ${(_status?.monthlyFeeNgn ?? _channel?.exclusiveMonthlyFeeNgn ?? 0).toStringAsFixed(0)}',
            style: const TextStyle(
              color: AppColors.lightOrange,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Access expires every 30 days and renewal uses the current channel fee.',
            style: TextStyle(
              color: AppColors.goldText.withValues(alpha: 0.9),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStateCard() {
    switch (_state) {
      case _ExclusiveState.requiresLogin:
        return _buildActionCard(
          title: 'Login Required',
          body:
              'Sign in to check your exclusive channel eligibility and purchase access.',
          icon: Icons.login_rounded,
          actionLabel: 'Go to Login',
          onAction: () => Navigator.pushNamed(context, '/login'),
        );
      case _ExclusiveState.requiresKyc:
        return _buildActionCard(
          title: 'Adult KYC Required',
          body:
              'Complete approved adult KYC verification before entering exclusive channels.',
          icon: Icons.verified_user_rounded,
          actionLabel: 'Complete KYC',
          onAction: () => Navigator.pushNamed(context, '/kyc'),
        );
      case _ExclusiveState.noEntitlement:
        return _buildNoEntitlementCard();
      case _ExclusiveState.purchaseInProgress:
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: const Column(
            children: [
              CircularProgressIndicator(color: AppColors.orange),
              SizedBox(height: 16),
              Text(
                'Processing payment...',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: 6),
              Text(
                'Please do not close this screen while we complete access setup.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.goldText, fontSize: 12),
              ),
            ],
          ),
        );
      case _ExclusiveState.purchaseSuccess:
        return _buildSuccessCard();
      case _ExclusiveState.purchaseFailure:
        return _buildActionCard(
          title: 'Access Setup Failed',
          body: 'We could not complete exclusive access at this moment.',
          icon: Icons.error_outline_rounded,
          actionLabel: 'Try Again',
          onAction: _loadAccessState,
        );
      case _ExclusiveState.hasEntitlement:
        return _buildEntitledCard();
      case _ExclusiveState.loading:
        return const SizedBox.shrink();
    }
  }

  /// noEntitlement branch. Xlounge-Extreme referrals get a direct-purchase
  /// summary sheet; everyone else gets About + Request-membership buttons
  /// wired to the disclaimer-gated request flow.
  Widget _buildNoEntitlementCard() {
    final isRenewal = _status?.renewalRequired == true;
    if (isRenewal) {
      return _buildActionCard(
        title: 'Renew Access',
        body: 'Your previous entitlement has expired. Renew now to continue.',
        icon: Icons.autorenew_rounded,
        actionLabel: 'Renew Now',
        onAction: _purchaseOrRenew,
      );
    }

    if (_isXlounge) {
      return _buildActionCard(
        title: 'Purchase membership',
        body:
            'Xlounge referrals unlock this channel instantly from your AfroVision wallet.',
        icon: Icons.diamond_rounded,
        actionLabel: 'Purchase membership',
        onAction: _openXloungePurchaseSummary,
      );
    }

    return _buildRequestOrLearnMoreCard();
  }

  Widget _buildRequestOrLearnMoreCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.lock_rounded, color: AppColors.orange, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Private membership',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'This is an Exclusive Channel with Private Membership. Only Exclusive Channel members can access its content.',
            style: TextStyle(color: AppColors.goldText, fontSize: 13),
          ),
          const SizedBox(height: 16),
          AppButton(
            label: 'Request membership',
            onPressed: _openRequestMembershipFlow,
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: _openAboutChannel,
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.inputBorder),
              minimumSize: const Size.fromHeight(48),
              foregroundColor: AppColors.white,
            ),
            child: const Text('Learn more'),
          ),
        ],
      ),
    );
  }

  Future<void> _openXloungePurchaseSummary() async {
    final fee = _status?.monthlyFeeNgn ?? 0;
    if (fee <= 0) {
      // Fee unknown — fall back to the existing direct purchase path.
      return _purchaseOrRenew();
    }
    final name = _channel?.name ?? 'Exclusive channel';
    final tag = _shortTag(name);
    final result = await showXloungePurchaseSummarySheet(
      context,
      channelId: _channelId!,
      channelName: name,
      channelTag: tag,
      monthlyFeeNgn: fee,
      walletBalanceNgn: _walletNgn,
    );
    if (!mounted || result == null) return;
    setState(() {
      _state = _ExclusiveState.purchaseSuccess;
      _status = ExclusiveAccessStatusModel(
        eligibleByKyc: true,
        hasActiveEntitlement: true,
        renewalRequired: false,
        expiresAt: result.expiresAt,
        monthlyFeeNgn: fee,
      );
      if ((result.personalIdentifierCode ?? '').isNotEmpty) {
        _picController.text = result.personalIdentifierCode!;
      }
    });
    if ((result.personalIdentifierCode ?? '').isNotEmpty) {
      await PicStorageService.savePic(
        _channelId!, result.personalIdentifierCode!);
    }
  }

  Future<void> _openRequestMembershipFlow() async {
    final name = _channel?.name ?? 'Exclusive channel';
    final requestId = await submitExclusiveMembershipRequestFlow(
      context,
      channelId: _channelId!,
      channelName: name,
    );
    if (!mounted || requestId == null) return;
    // Take the user to their request status right after submit.
    Navigator.of(context).pushNamed(
      '/exclusive-request-status',
      arguments: {
        'channelId': _channelId,
        'requestId': requestId,
        'channelName': name,
      },
    );
  }

  void _openAboutChannel() {
    final name = _channel?.name ?? 'Exclusive channel';
    showAboutChannelSheet(
      context,
      channelName: name,
      channelNumber: _channel?.channelNumber ?? '—',
      description: _channel?.description,
    );
  }

  String _shortTag(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '★';
    if (parts.length == 1) {
      return parts.first.substring(0, parts.first.length.clamp(0, 3)).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  Widget _buildActionCard({
    required String title,
    required String body,
    required IconData icon,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.orange, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            body,
            style: const TextStyle(color: AppColors.goldText, fontSize: 13),
          ),
          const SizedBox(height: 16),
          AppButton(label: actionLabel, onPressed: onAction),
        ],
      ),
    );
  }

  Widget _buildSuccessCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.successGreen.withValues(alpha: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.check_circle_rounded,
                color: AppColors.successGreen,
                size: 24,
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Purchase Successful',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Your exclusive access is active until ${_expiryLabel()}.',
            style: const TextStyle(color: AppColors.goldText, fontSize: 13),
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: _picController,
            label: 'PERSONAL IDENTIFIER CODE (PIC)',
            hint: 'Generated after purchase',
            prefixIcon: Icons.pin_rounded,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Verify PIC',
                  onPressed: _verifyPic,
                  loading: _verifyingPic,
                  enabled: !_verifyingPic,
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: _copyPic,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: const Icon(
                    Icons.copy_rounded,
                    color: AppColors.lightOrange,
                    size: 18,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_picVerified)
            AppButton(
              label: 'Continue to Channel',
              onPressed: _continueToChannel,
            ),
        ],
      ),
    );
  }

  Widget _buildEntitledCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.successGreen.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.verified_rounded, color: AppColors.successGreen),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Active Entitlement Found',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Access valid until ${_expiryLabel()}.',
            style: const TextStyle(color: AppColors.goldText, fontSize: 13),
          ),
          const SizedBox(height: 14),
          AppButton(
            label: 'Continue to Channel',
            onPressed: _continueToChannel,
          ),
        ],
      ),
    );
  }

  Widget _buildNotice(String message, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
