import 'package:flutter/material.dart';
import '../../../core/api/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../models/creator_subscription_model.dart';
import '../services/creator_subscription_service.dart';

/// Route: /creator-subscription
/// Arguments: Map with keys:
///   creatorUid   (String, required)
///   creatorName  (String, optional)
///   creatorRole  (String, optional)
///
/// Flow:
///   1. Load: check existing subscription status.
///   2. Not subscribed → show subscribe card with currency selector + Subscribe button.
///   3. Subscribed → show active status, next billing, cancel option.
///   4. All mutations use the gift wallet (NGN or vPT).
class CreatorSubscriptionScreen extends StatefulWidget {
  const CreatorSubscriptionScreen({super.key});

  @override
  State<CreatorSubscriptionScreen> createState() =>
      _CreatorSubscriptionScreenState();
}

class _CreatorSubscriptionScreenState extends State<CreatorSubscriptionScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  String? _creatorUid;
  String _creatorName = 'Creator';

  bool _loading = true;
  bool _acting = false;
  String? _error;

  CreatorSubscriptionModel? _subscription;
  String _selectedCurrency = 'ngn';

  static const double _ngnPrice = 2000;
  static const int _vptPrice = 500;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_creatorUid == null) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map<String, dynamic>) {
        _creatorUid = args['creatorUid'] as String?;
        _creatorName = (args['creatorName'] as String?) ?? 'Creator';
      }
      if (_creatorUid != null) _checkSubscription();
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkSubscription() async {
    setState(() => _loading = true);
    try {
      final result = await CreatorSubscriptionService.checkSubscription(
        _creatorUid!,
      );
      if (!mounted) return;
      final subJson = result['subscription'] as Map<String, dynamic>?;
      setState(() {
        _subscription = subJson != null
            ? CreatorSubscriptionModel.fromJson(subJson)
            : null;
        _loading = false;
      });
      _animCtrl.forward();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      _animCtrl.forward();
    }
  }

  Future<void> _refresh() async {
    await _checkSubscription();
  }

  Future<void> _subscribe() async {
    setState(() {
      _acting = true;
      _error = null;
    });
    try {
      final sub = await CreatorSubscriptionService.subscribe(
        creatorUid: _creatorUid!,
        currency: _selectedCurrency,
      );
      if (!mounted) return;
      setState(() {
        _subscription = sub;
        _acting = false;
      });
      _showSnack('Subscribed to $_creatorName!', success: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      String msg;
      if (e.message.contains('INSUFFICIENT_VPT')) {
        msg = 'Not enough vPT. Top up your wallet.';
      } else if (e.message.contains('INSUFFICIENT_NGN')) {
        msg = 'Not enough ₦ balance. Top up your gift wallet.';
      } else if (e.message.contains('Already subscribed')) {
        msg = 'You are already subscribed to $_creatorName.';
      } else {
        msg = e.message;
      }
      setState(() {
        _error = msg;
        _acting = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Something went wrong. Please try again.';
        _acting = false;
      });
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Cancel subscription?',
          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'You will lose access to $_creatorName\'s exclusive content at the end of this billing period.',
          style: const TextStyle(color: AppColors.hintText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Keep',
              style: TextStyle(color: AppColors.orange),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Cancel subscription',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _acting = true;
      _error = null;
    });
    try {
      final cancelled = await CreatorSubscriptionService.cancel(
        _subscription!.id,
      );
      if (!mounted) return;
      setState(() {
        _subscription = cancelled;
        _acting = false;
      });
      _showSnack('Subscription cancelled.', success: false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to cancel. Please try again.';
        _acting = false;
      });
    }
  }

  void _showSnack(String msg, {required bool success}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(color: AppColors.white)),
        backgroundColor: success
            ? const Color(0xFF4CAF50).withValues(alpha: 0.9)
            : AppColors.errorRed.withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  String _formatDate(int timestamp) {
    final dt = DateTime.fromMillisecondsSinceEpoch(timestamp);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: _loading
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
        // App bar
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
                onPressed: () => Navigator.of(context).pop(),
              ),
              const Expanded(
                child: Text(
                  'Join Creator',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
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
            onRefresh: _refresh,
            color: AppColors.orange,
            backgroundColor: AppColors.inputFill,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 16),

                  // Creator avatar placeholder
                  Container(
                    width: 86,
                    height: 86,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AppColors.buttonGradient,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.orange.withAlpha(80),
                          blurRadius: 24,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        _creatorName.isNotEmpty
                            ? _creatorName[0].toUpperCase()
                            : '?',
                        style: const TextStyle(
                          color: AppColors.darkBlue,
                          fontSize: 34,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  Text(
                    _creatorName,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 6),

                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4CAF50).withAlpha(30),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF4CAF50).withAlpha(80),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.verified_rounded,
                          color: Color(0xFF4CAF50),
                          size: 14,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'CREATOR',
                          style: TextStyle(
                            color: Color(0xFF4CAF50),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),

                  // ── Active subscription card ──────────────────────────────
                  if (_subscription != null && _subscription!.isActive)
                    _buildActiveCard()
                  // ── Cancelled subscription card ───────────────────────────
                  else if (_subscription != null && !_subscription!.isActive)
                    _buildCancelledCard()
                  // ── Subscribe card ────────────────────────────────────────
                  else
                    _buildSubscribeCard(),

                  // Error
                  if (_error != null) ...[
                    const SizedBox(height: 20),
                    _ErrorBanner(message: _error!),
                  ],

                  if (_error != null &&
                      (_error!.contains('Top up') ||
                          _error!.contains('wallet'))) ...[
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: () =>
                          Navigator.pushNamed(context, '/gift-wallet'),
                      icon: const Icon(
                        Icons.add_circle_outline,
                        color: AppColors.orange,
                        size: 18,
                      ),
                      label: const Text(
                        'Top up wallet',
                        style: TextStyle(color: AppColors.orange),
                      ),
                    ),
                  ],

                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActiveCard() {
    final sub = _subscription!;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF4CAF50).withAlpha(80),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4CAF50).withAlpha(20),
            blurRadius: 20,
          ),
        ],
      ),
      child: Column(
        children: [
          // Status row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFF4CAF50),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'ACTIVE SUBSCRIPTION',
                style: TextStyle(
                  color: Color(0xFF4CAF50),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Stats
          _SubStatRow(
            label: 'Monthly fee',
            value: sub.currency == 'vpt'
                ? '${sub.amount.toInt()} vPT'
                : '₦${sub.amount.toInt()}',
          ),
          const _Divider(),
          _SubStatRow(
            label: 'Next billing',
            value: _formatDate(sub.nextBilling),
          ),
          const _Divider(),
          _SubStatRow(label: 'Renewals', value: '${sub.renewalCount}×'),
          const _Divider(),
          _SubStatRow(
            label: 'Subscribed',
            value: _formatDate(sub.subscribedAt),
          ),

          const SizedBox(height: 28),

          // Subscriber benefits
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your benefits',
                  style: TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
                SizedBox(height: 10),
                _BenefitItem(
                  icon: Icons.lock_open_rounded,
                  text: 'Subscriber-only streams',
                ),
                SizedBox(height: 6),
                _BenefitItem(
                  icon: Icons.star_rounded,
                  text: 'Subscriber badge in chat',
                ),
                SizedBox(height: 6),
                _BenefitItem(
                  icon: Icons.priority_high_rounded,
                  text: 'Priority chat visibility',
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Cancel button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              onPressed: _acting ? null : _cancel,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppColors.errorRed.withAlpha(150)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _acting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: AppColors.errorRed,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      'Cancel subscription',
                      style: TextStyle(
                        color: AppColors.errorRed,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCancelledCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.cancel_outlined,
            color: AppColors.hintText,
            size: 40,
          ),
          const SizedBox(height: 12),
          const Text(
            'Subscription cancelled',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _subscription?.cancelReason == 'payment_failed'
                ? 'Auto-cancelled due to insufficient balance.'
                : 'You cancelled this subscription.',
            style: const TextStyle(color: AppColors.hintText, fontSize: 13),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          // Re-subscribe
          _buildSubscribeCard(),
        ],
      ),
    );
  }

  Widget _buildSubscribeCard() {
    return Column(
      children: [
        // Currency selector
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Subscription plan',
                style: TextStyle(
                  color: AppColors.lightOrange,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 16),

              // Monthly price display
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _selectedCurrency == 'ngn'
                        ? '₦${_ngnPrice.toInt()}'
                        : '$_vptPrice vPT',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -1,
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 6, left: 4),
                    child: Text(
                      '/ month',
                      style: TextStyle(color: AppColors.hintText, fontSize: 14),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 6),

              Center(
                child: Text(
                  _selectedCurrency == 'ngn'
                      ? '≈ $_vptPrice vPT / month'
                      : '≈ ₦${_ngnPrice.toInt()} / month',
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 12,
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Currency toggle
              Container(
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.inputBorder),
                ),
                child: Row(
                  children: [
                    _CurrencyTab(
                      label: '₦ Naira',
                      selected: _selectedCurrency == 'ngn',
                      onTap: () => setState(() => _selectedCurrency = 'ngn'),
                    ),
                    _CurrencyTab(
                      label: 'vPT Token',
                      selected: _selectedCurrency == 'vpt',
                      onTap: () => setState(() => _selectedCurrency = 'vpt'),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Benefits list
              const _BenefitItem(
                icon: Icons.lock_open_rounded,
                text: 'Access subscriber-only streams',
              ),
              const SizedBox(height: 8),
              const _BenefitItem(
                icon: Icons.star_rounded,
                text: 'Subscriber badge in chat',
              ),
              const SizedBox(height: 8),
              const _BenefitItem(
                icon: Icons.priority_high_rounded,
                text: 'Priority chat visibility',
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Subscribe button
        SizedBox(
          width: double.infinity,
          height: 56,
          child: _acting
              ? Container(
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: AppColors.darkBlue,
                        strokeWidth: 2.5,
                      ),
                    ),
                  ),
                )
              : DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.orange.withAlpha(80),
                        blurRadius: 18,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ElevatedButton.icon(
                    onPressed: _subscribe,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    icon: const Icon(
                      Icons.favorite_rounded,
                      color: AppColors.darkBlue,
                      size: 20,
                    ),
                    label: const Text(
                      'Subscribe Now',
                      style: TextStyle(
                        color: AppColors.darkBlue,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
        ),

        const SizedBox(height: 14),

        const Text(
          'Billed monthly from your gift wallet.\nCancel anytime — no long-term commitment.',
          style: TextStyle(
            color: AppColors.hintText,
            fontSize: 12,
            height: 1.6,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

// ── Helper widgets ────────────────────────────────────────────────────────────

class _SubStatRow extends StatelessWidget {
  final String label;
  final String value;

  const _SubStatRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.hintText, fontSize: 13),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return const Divider(color: AppColors.inputBorder, height: 1);
  }
}

class _BenefitItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _BenefitItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.orange, size: 16),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(color: AppColors.white, fontSize: 13),
          ),
        ),
      ],
    );
  }
}

class _CurrencyTab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CurrencyTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.all(4),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            gradient: selected ? AppColors.buttonGradient : null,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? AppColors.darkBlue : AppColors.hintText,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;

  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.errorRed.withAlpha(25),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.errorRed.withAlpha(100)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.errorRed,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.errorRed, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
