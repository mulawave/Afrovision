import 'dart:async';
import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../../../core/theme/app_colors.dart';
import '../../payments/services/google_play_billing_service.dart';
import '../models/channel_subscription_model.dart';
import '../services/channel_subscription_service.dart';

class ChannelSubscriptionScreen extends StatefulWidget {
  const ChannelSubscriptionScreen({super.key});
  @override
  State<ChannelSubscriptionScreen> createState() => _ChannelSubscriptionScreenState();
}

class _ChannelSubscriptionScreenState extends State<ChannelSubscriptionScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;

  String? _channelId;
  String _channelName = 'Channel';
  bool _isPremium = false;
  double? _priceNgn;
  String? _intervalUnit;

  bool _loading = true;
  bool _acting = false;
  String? _error;
  ChannelSubscriptionModel? _subscription;

  bool _googlePlayAvailable = false;
  bool _googlePlayLoading = false;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSub;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _fadeIn = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _initGooglePlay();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_channelId == null) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map<String, dynamic>) {
        _channelId = args['channelId'] as String?;
        _channelName = (args['channelName'] as String?) ?? 'Channel';
        _isPremium = args['isPremium'] as bool? ?? false;
        _priceNgn = (args['priceNgn'] as num?)?.toDouble();
        _intervalUnit = args['intervalUnit'] as String?;
      }
      if (_channelId != null) _checkSubscription();
    }
  }

  @override
  void dispose() {
    _purchaseSub?.cancel();
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkSubscription() async {
    setState(() => _loading = true);
    try {
      final result = await ChannelSubscriptionService.check(_channelId!);
      if (!mounted) return;
      final subJson = result['subscription'] as Map<String, dynamic>?;
      setState(() {
        _subscription = subJson != null
            ? ChannelSubscriptionModel.fromJson(subJson) : null;
        _loading = false;
      });
      _animCtrl.forward();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      _animCtrl.forward();
    }
  }

  Future<void> _subscribe() async {
    setState(() { _acting = true; _error = null; });
    try {
      final result = await ChannelSubscriptionService.subscribe(_channelId!);
      if (!mounted) return;
      if (result['success'] == true) {
        setState(() {
          _subscription = result['subscription'] as ChannelSubscriptionModel?;
          _acting = false;
        });
        _showSnack('Subscribed to $_channelName!', success: true);
      } else {
        setState(() {
          _error = result['error'] as String? ?? 'Subscription failed';
          _acting = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Something went wrong. Please try again.'; _acting = false; });
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Cancel subscription?',
          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w700)),
        content: Text('You will lose access to $_channelName.',
          style: const TextStyle(color: AppColors.hintText)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep', style: TextStyle(color: AppColors.orange))),
          TextButton(onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel subscription', style: TextStyle(color: AppColors.errorRed))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() { _acting = true; _error = null; });
    try {
      final result = await ChannelSubscriptionService.cancel(_subscription!.id);
      if (!mounted) return;
      if (result['success'] == true) {
        setState(() { _subscription = null; _acting = false; });
        _showSnack('Subscription cancelled.', success: false);
      } else {
        setState(() { _error = result['error'] as String? ?? 'Cancellation failed'; _acting = false; });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Failed to cancel. Please try again.'; _acting = false; });
    }
  }

  Future<void> _initGooglePlay() async {
    try {
      final available = await GooglePlayBillingService.isAvailable();
      if (!mounted) return;
      setState(() => _googlePlayAvailable = available);
      if (available) {
        _purchaseSub = InAppPurchase.instance.purchaseStream.listen(
          (purchases) {
            for (final purchase in purchases) {
              if (purchase.status == PurchaseStatus.purchased ||
                  purchase.status == PurchaseStatus.restored) {
                _handleGooglePlayPurchase(purchase);
              } else if (purchase.status == PurchaseStatus.error) {
                if (!mounted) return;
                setState(() {
                  _googlePlayLoading = false;
                  _error = 'Google Play purchase failed: ${purchase.error?.message ?? "unknown"}';
                });
              } else if (purchase.status == PurchaseStatus.canceled) {
                if (!mounted) return;
                setState(() => _googlePlayLoading = false);
              }
            }
          },
          onError: (e) {
            if (!mounted) return;
            setState(() {
              _googlePlayLoading = false;
              _error = 'Google Play error: $e';
            });
          },
        );
      }
    } catch (_) {}
  }

  Future<void> _handleGooglePlayPurchase(PurchaseDetails purchase) async {
    if (!mounted) return;
    setState(() {
      _googlePlayLoading = true;
      _error = null;
    });

    try {
      await GooglePlayBillingService.completeAndVerify(
        purchase: purchase,
        isSubscription: true,
        channelId: _channelId,
      );

      if (!mounted) return;
      setState(() => _googlePlayLoading = false);
      _showSnack('Subscribed to $_channelName via Google Play!', success: true);
      _checkSubscription();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _googlePlayLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _subscribeWithGooglePlay() async {
    if (_channelId == null) return;
    setState(() {
      _googlePlayLoading = true;
      _error = null;
    });
    try {
      await GooglePlayBillingService.initiateChannelSubscription(
        channelId: _channelId!,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _googlePlayLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _showSnack(String msg, {required bool success}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(color: AppColors.white)),
      backgroundColor: success ? const Color(0xFF4CAF50).withValues(alpha: 0.9)
          : AppColors.errorRed.withValues(alpha: 0.9),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  String _fmtDate(int? ts) {
    if (ts == null) return 'N/A';
    final d = DateTime.fromMillisecondsSinceEpoch(ts);
    return '${d.day}/${d.month}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.orange))
              : FadeTransition(opacity: _fadeIn,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(28),
                    child: Column(children: [
                      const SizedBox(height: 16),
                      Container(
                        width: 86, height: 86,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: _isPremium
                            ? const LinearGradient(colors: [Color(0xFFFFD700), Color(0xFFB8860B)])
                            : AppColors.buttonGradient,
                        ),
                        child: Center(child: Text(
                          _channelName.isNotEmpty ? _channelName[0].toUpperCase() : '?',
                          style: const TextStyle(color: AppColors.darkBlue, fontSize: 34, fontWeight: FontWeight.w900))),
                      ),
                      const SizedBox(height: 16),
                      Text(_channelName,
                        style: const TextStyle(color: AppColors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                      if (_isPremium)
                        Container(
                          margin: const EdgeInsets.only(top: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFD700).withAlpha(30),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFFFD700).withAlpha(80)),
                          ),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.workspace_premium, color: Color(0xFFFFD700), size: 14),
                            SizedBox(width: 4),
                            Text('PREMIUM', style: TextStyle(color: Color(0xFFFFD700), fontSize: 11, fontWeight: FontWeight.w800)),
                          ]),
                        ),
                      const SizedBox(height: 32),
                      if (_subscription != null && _subscription!.isActive)
                        _activeCard()
                      else if (_subscription != null)
                        _cancelledCard()
                      else
                        _subscribeCard(),
                      if (_error != null) ...[
                        const SizedBox(height: 20),
                        Container(
                          width: double.infinity, padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.errorRed.withAlpha(25),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.errorRed.withAlpha(100)),
                          ),
                          child: Row(children: [
                            const Icon(Icons.error_outline, color: AppColors.errorRed, size: 18),
                            const SizedBox(width: 10),
                            Expanded(child: Text(_error!,
                              style: const TextStyle(color: AppColors.errorRed, fontSize: 13))),
                          ]),
                        ),
                      ],
                    ]),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _activeCard() {
    final sub = _subscription!;
    return Container(
      width: double.infinity, padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg, borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF4CAF50).withAlpha(80), width: 1.5),
      ),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(width: 10, height: 10,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF4CAF50))),
          const SizedBox(width: 8),
          const Text('ACTIVE SUBSCRIPTION',
            style: TextStyle(color: Color(0xFF4CAF50), fontSize: 12, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 24),
        if (sub.isPremium) ...[
          _row('Price', '₦${sub.amount.toInt()} / ${sub.intervalUnit}'),
          const Divider(color: AppColors.inputBorder, height: 1),
        ],
        _row('Subscribed', _fmtDate(sub.subscribedAt)),
        const SizedBox(height: 28),
        SizedBox(width: double.infinity, height: 48,
          child: OutlinedButton(
            onPressed: _acting ? null : _cancel,
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: AppColors.errorRed.withAlpha(150)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            child: _acting
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(color: AppColors.errorRed, strokeWidth: 2))
              : const Text('Cancel subscription',
                  style: TextStyle(color: AppColors.errorRed, fontWeight: FontWeight.w600)),
          ),
        ),
      ]),
    );
  }

  Widget _cancelledCard() {
    return Container(
      width: double.infinity, padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg, borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder)),
      child: Column(children: [
        const Icon(Icons.cancel_outlined, color: AppColors.hintText, size: 40),
        const SizedBox(height: 12),
        const Text('Subscription cancelled',
          style: TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(_subscription?.cancelReason == 'payment_failed'
            ? 'Auto-cancelled due to insufficient balance.'
            : 'You cancelled this subscription.',
          style: const TextStyle(color: AppColors.hintText, fontSize: 13)),
        const SizedBox(height: 24),
        _subscribeCard(),
      ]),
    );
  }

  Widget _subscribeCard() {
    return Column(children: [
      Container(
        width: double.infinity, padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.cardBg, borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.inputBorder)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(_isPremium ? 'Premium Subscription' : 'Channel Subscription',
            style: const TextStyle(color: AppColors.lightOrange, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          if (_isPremium && _priceNgn != null) ...[
            Row(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('₦${_priceNgn!.toInt()}',
                style: const TextStyle(color: AppColors.white, fontSize: 36, fontWeight: FontWeight.w900)),
              const Padding(
                padding: EdgeInsets.only(bottom: 6, left: 4),
                child: Text('per', style: TextStyle(color: AppColors.hintText, fontSize: 14))),
            ]),
            Text(_intervalUnit ?? 'month', style: const TextStyle(color: AppColors.hintText, fontSize: 14)),
            const SizedBox(height: 20),
          ],
          if (!_isPremium) ...[
            const Center(child: Text('Free',
              style: TextStyle(color: Color(0xFF4CAF50), fontSize: 36, fontWeight: FontWeight.w900))),
            const SizedBox(height: 20),
          ],
          const _Benefit(icon: Icons.lock_open_rounded, text: 'Subscriber-only streams'),
          const SizedBox(height: 8),
          const _Benefit(icon: Icons.star_rounded, text: 'Subscriber badge in chat'),
          const SizedBox(height: 8),
          const _Benefit(icon: Icons.priority_high_rounded, text: 'Priority chat visibility'),
        ]),
      ),
      const SizedBox(height: 20),
      SizedBox(width: double.infinity, height: 56,
        child: ElevatedButton.icon(
          onPressed: _acting ? null : _subscribe,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent, shadowColor: Colors.transparent,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          icon: const Icon(Icons.favorite_rounded, color: AppColors.darkBlue, size: 20),
          label: Text(_isPremium ? 'Subscribe Premium' : 'Subscribe Free',
            style: const TextStyle(color: AppColors.darkBlue, fontSize: 16, fontWeight: FontWeight.w800)),
        ),
      ),
      const SizedBox(height: 14),
      Text(_isPremium
          ? 'Billed every period from your gift wallet.\nCancel anytime.'
          : 'Subscribe free to this channel and get access to exclusive content.',
        style: const TextStyle(color: AppColors.hintText, fontSize: 12, height: 1.6),
        textAlign: TextAlign.center),
      if (_isPremium && _googlePlayAvailable) ...[
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, height: 52,
          child: ElevatedButton.icon(
            onPressed: _googlePlayLoading ? null : _subscribeWithGooglePlay,
            icon: _googlePlayLoading
              ? const SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2))
              : const Icon(Icons.android, size: 20),
            label: Text(_googlePlayLoading ? 'Processing...' : 'Pay with Google Play',
              style: const TextStyle(fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF01875F),
              foregroundColor: AppColors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          ),
        ),
        const SizedBox(height: 8),
        const Text('or use Google Play billing for this subscription',
          style: TextStyle(color: AppColors.hintText, fontSize: 11),
          textAlign: TextAlign.center),
      ],
    ]);
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(color: AppColors.hintText, fontSize: 13)),
        Text(value, style: const TextStyle(color: AppColors.white, fontSize: 14, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _Benefit extends StatelessWidget {
  final IconData icon; final String text;
  const _Benefit({required this.icon, required this.text});
  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Icon(icon, color: AppColors.orange, size: 16),
      const SizedBox(width: 10),
      Expanded(child: Text(text, style: const TextStyle(color: AppColors.white, fontSize: 13))),
    ]);
  }
}
