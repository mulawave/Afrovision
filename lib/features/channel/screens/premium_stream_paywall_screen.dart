import 'package:flutter/material.dart';
import '../../../core/api/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../models/channel_model.dart';
import '../services/premium_stream_service.dart';

/// Route: /premium-stream
/// Arguments: ChannelModel (a channel with requires_payment = true)
///
/// Flow:
///  1. Arrive with channel argument.
///  2. Server-check user's access (loading state).
///  3. If already granted → Navigator.pop(true) immediately.
///  4. If not → show paywall with fee + Pay button.
///  5. On pay success → Navigator.pop(true).
///  6. Caller (ChannelViewScreen / ChannelPlayerScreen) proceeds to stream.
class PremiumStreamPaywallScreen extends StatefulWidget {
  const PremiumStreamPaywallScreen({super.key});

  @override
  State<PremiumStreamPaywallScreen> createState() =>
      _PremiumStreamPaywallScreenState();
}

class _PremiumStreamPaywallScreenState extends State<PremiumStreamPaywallScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  ChannelModel? _channel;
  bool _loading = true;
  bool _paying = false;
  String? _error;

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
    if (_channel == null) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is ChannelModel) {
        _channel = args;
        _checkAccess();
      }
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkAccess() async {
    setState(() => _loading = true);
    try {
      final result = await PremiumStreamService.checkAccess(_channel!.id);
      if (!mounted) return;
      if (result['has_access'] == true) {
        // Already has access → pop with true so the caller opens the stream
        Navigator.of(context).pop(true);
        return;
      }
    } catch (_) {
      // Show paywall even if check fails — pay endpoint will re-validate
    }
    setState(() => _loading = false);
    _animCtrl.forward();
  }

  Future<void> _refresh() async {
    await _checkAccess();
  }

  Future<void> _pay() async {
    setState(() {
      _paying = true;
      _error = null;
    });
    try {
      await PremiumStreamService.payForAccess(_channel!.id);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      final code = e.message;
      String msg;
      if (code.contains('INSUFFICIENT_VPT')) {
        msg = 'Not enough vPT. Top up your wallet to continue.';
      } else if (code.contains('INSUFFICIENT_NGN')) {
        msg = 'Not enough ₦ balance. Top up your gift wallet to continue.';
      } else {
        msg = code;
      }
      setState(() {
        _error = msg;
        _paying = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Payment failed. Please try again.';
        _paying = false;
      });
    }
  }

  String get _feeLabel {
    final ch = _channel!;
    if (ch.entryFeeType == 'vpt') {
      final vpt = ch.entryFeeVptUnits;
      final ngn = (vpt * 750).toStringAsFixed(0);
      return '$vpt vPT  ≈ ₦$ngn';
    } else {
      final ngn = ch.entryFeeNgn.toStringAsFixed(0);
      return '₦$ngn';
    }
  }

  String get _durationLabel {
    final minutes = _channel!.accessDurationMinutes;
    if (minutes >= 60) {
      final h = minutes ~/ 60;
      final m = minutes % 60;
      return m == 0 ? '${h}h access' : '${h}h ${m}m access';
    }
    return '${minutes}min access';
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
              : _channel == null
              ? const Center(
                  child: Text(
                    'Channel not found.',
                    style: TextStyle(color: AppColors.white),
                  ),
                )
              : FadeTransition(
                  opacity: _fadeIn,
                  child: SlideTransition(
                    position: _slideUp,
                    child: _buildPaywall(),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildPaywall() {
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
                onPressed: () => Navigator.of(context).pop(false),
              ),
              const Expanded(
                child: Text(
                  'Premium Stream',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(width: 48), // balance back button
            ],
          ),
        ),

        Expanded(
          child: RefreshIndicator(
            onRefresh: _refresh,
            color: AppColors.orange,
            backgroundColor: AppColors.inputFill,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 24),

                  // Lock icon with glow ring
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.orange.withAlpha(25),
                      border: Border.all(
                        color: AppColors.orange.withAlpha(80),
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.orange.withAlpha(60),
                          blurRadius: 30,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.lock_rounded,
                      color: AppColors.orange,
                      size: 46,
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Channel name
                  Text(
                    _channel!.name,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 8),

                  // Premium badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      '✦ PREMIUM STREAM',
                      style: TextStyle(
                        color: AppColors.darkBlue,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),

                  const SizedBox(height: 36),

                  // Info card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.cardBg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppColors.orange.withAlpha(60),
                        width: 1,
                      ),
                    ),
                    child: Column(
                      children: [
                        _InfoRow(
                          icon: Icons.monetization_on_rounded,
                          label: 'Entry fee',
                          value: _feeLabel,
                          valueColor: AppColors.lightOrange,
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Divider(
                            color: AppColors.inputBorder,
                            height: 1,
                          ),
                        ),
                        _InfoRow(
                          icon: Icons.timer_rounded,
                          label: 'Access duration',
                          value: _durationLabel,
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Divider(
                            color: AppColors.inputBorder,
                            height: 1,
                          ),
                        ),
                        _InfoRow(
                          icon: Icons.account_balance_wallet_rounded,
                          label: 'Payment source',
                          value: 'Gift wallet',
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // What you get
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.inputBorder),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'What you get',
                          style: TextStyle(
                            color: AppColors.lightOrange,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                        SizedBox(height: 12),
                        _BenefitRow(
                          icon: Icons.hd_rounded,
                          text: 'Full HD stream access',
                        ),
                        SizedBox(height: 8),
                        _BenefitRow(
                          icon: Icons.chat_bubble_rounded,
                          text: 'Live chat participation',
                        ),
                        SizedBox(height: 8),
                        _BenefitRow(
                          icon: Icons.star_rounded,
                          text: 'Subscriber badge in chat',
                        ),
                      ],
                    ),
                  ),

                  // Error message
                  if (_error != null) ...[
                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.errorRed.withAlpha(25),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.errorRed.withAlpha(100),
                        ),
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
                              _error!,
                              style: const TextStyle(
                                color: AppColors.errorRed,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 36),

                  // Pay button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: _paying
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
                              onPressed: _pay,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              icon: const Icon(
                                Icons.play_arrow_rounded,
                                color: AppColors.darkBlue,
                                size: 22,
                              ),
                              label: Text(
                                'Pay ${_feeLabel.split(' ').first} — Unlock Stream',
                                style: const TextStyle(
                                  color: AppColors.darkBlue,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ),
                          ),
                  ),

                  const SizedBox(height: 16),

                  // Top-up shortcut if error mentions insufficient balance
                  if (_error != null)
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
                        style: TextStyle(color: AppColors.orange, fontSize: 14),
                      ),
                    ),

                  const SizedBox(height: 24),

                  Text(
                    'Payments are charged from your AfroVision gift wallet.\nNo recurring charges — pay-per-view only.',
                    style: const TextStyle(
                      color: AppColors.hintText,
                      fontSize: 12,
                      height: 1.6,
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor = AppColors.white,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.orange, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: AppColors.hintText, fontSize: 13),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _BenefitRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _BenefitRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.orange, size: 16),
        const SizedBox(width: 10),
        Text(
          text,
          style: const TextStyle(color: AppColors.white, fontSize: 13),
        ),
      ],
    );
  }
}
