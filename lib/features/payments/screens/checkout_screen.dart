import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../../core/services/deep_link_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../wallet/services/wallet_service.dart';
import '../../wallet/utils/wallet_format.dart';
import '../../wallet/widgets/assets_header.dart';
import '../services/checkout_recovery_service.dart';
import '../services/google_play_billing_service.dart';
import '../services/payment_service.dart';
import 'payment_webview_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  bool _initialized = false;
  bool _loadingProviders = true;
  bool _starting = false;
  bool _verifying = false;
  bool _launchedCheckout = false;
  bool _completed = false;
  bool _autoVerifyOnLoad = false;

  String _purpose = 'wallet_topup';
  String _title = 'Secure Checkout';
  String? _planId;
  String? _planName;
  String _billingCycle = 'monthly';
  String _provider = 'paystack';
  String _balanceType = 'ngn';
  final TextEditingController _amountCtrl = TextEditingController(text: '2000');
  final List<Map<String, dynamic>> _providers = [];

  Map<String, dynamic> _exchangeRates = {};
  double? _fixedAmount;
  String? _paymentId;
  String? _checkoutUrl;
  String? _error;
  String _statusText = 'Choose a provider and start checkout.';

  bool _googlePlayAvailable = false;
  bool _googlePlayLoading = false;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSub;
  bool _pendingGooglePlayIsSub = false;

  static const String _resultSuccess = 'success';
  static const String _resultFailed = 'failed';
  static const String _resultCanceled = 'canceled';
  static const String _resultPending = 'pending';
  static const String _resultUnknown = 'unknown';

  static const _quickAmounts = [1000, 2000, 5000, 10000];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));

    DeepLinkService.onCheckoutResult = (paymentId) {
      if (!mounted || _completed) return;
      setState(() {
        _paymentId = paymentId;
        _launchedCheckout = true;
      });
      CheckoutRecoveryService.savePendingSession(
        paymentId: paymentId,
        purpose: _purpose,
        checkoutUrl: _checkoutUrl,
        title: _title,
        planId: _planId,
        planName: _planName,
        billingCycle: _billingCycle,
        balanceType: _balanceType,
        amountNgn: _displayAmount > 0 ? _displayAmount : null,
      );
      _verifyPayment();
    };

    _initGooglePlay();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map<String, dynamic>) {
      _purpose = (args['purpose'] as String?) ?? 'wallet_topup';
      _title =
          (args['title'] as String?) ??
          (_purpose == 'platform_plan' ? 'Plan Checkout' : 'Wallet Top-Up');
      _planId = args['planId'] as String?;
      _planName = args['planName'] as String?;
      _billingCycle = (args['billingCycle'] as String?) ?? 'monthly';
      _balanceType = (args['balanceType'] as String?) ?? 'ngn';
      final amount = args['amountNgn'];
      if (amount is num) {
        _fixedAmount = amount.toDouble();
        _amountCtrl.text = _fixedAmount!.toStringAsFixed(0);
      }

      final resumePaymentId = args['resumePaymentId'] as String?;
      final resumeCheckoutUrl = args['resumeCheckoutUrl'] as String?;
      if (resumePaymentId != null && resumePaymentId.isNotEmpty) {
        _paymentId = resumePaymentId;
        _checkoutUrl = resumeCheckoutUrl;
        _launchedCheckout = true;
        _autoVerifyOnLoad = true;
        _statusText = 'Recovered pending checkout. Verifying now...';
      }
    }

    _hydrateRecoveryAndLoadProviders();
  }

  Future<void> _hydrateRecoveryAndLoadProviders() async {
    await _loadExchangeRates();
    await _restorePendingSessionIfNeeded();
    await _loadProviders();
  }

  Future<void> _loadExchangeRates() async {
    try {
      final rates = await WalletService.getExchangeRates();
      if (!mounted) return;
      setState(() => _exchangeRates = rates);
    } catch (_) {
      _exchangeRates = {};
    }
  }

  Future<void> _restorePendingSessionIfNeeded() async {
    if (_paymentId != null && _paymentId!.isNotEmpty) return;
    final pending = await CheckoutRecoveryService.getPendingSession();
    if (!mounted || pending == null) return;

    final pendingPaymentId = pending['paymentId'] as String?;
    if (pendingPaymentId == null || pendingPaymentId.isEmpty) return;

    setState(() {
      _paymentId = pendingPaymentId;
      _checkoutUrl = pending['checkoutUrl'] as String?;
      _purpose = (pending['purpose'] as String?) ?? _purpose;
      _title = (pending['title'] as String?) ?? _title;
      _planId = pending['planId'] as String?;
      _planName = pending['planName'] as String?;
      _billingCycle = (pending['billingCycle'] as String?) ?? _billingCycle;
      _balanceType = (pending['balanceType'] as String?) ?? _balanceType;

      final amount = pending['amountNgn'];
      if (amount is num) {
        _fixedAmount = amount.toDouble();
        _amountCtrl.text = _fixedAmount!.toStringAsFixed(0);
      }

      _launchedCheckout = true;
      _autoVerifyOnLoad = true;
      _statusText = 'Recovered pending checkout. Verifying now...';
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    DeepLinkService.onCheckoutResult = null;
    _purchaseSub?.cancel();
    _amountCtrl.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _launchedCheckout &&
        _paymentId != null &&
        !_completed &&
        !_verifying) {
      _verifyPayment(silent: true);
    }
  }

  Future<void> _loadProviders() async {
    try {
      final providers = await PaymentService.getProviders();
      if (!mounted) return;
      setState(() {
        _providers
          ..clear()
          ..addAll(providers);
        final firstEnabled = _providers.firstWhere(
          (item) => item['enabled'] == true,
          orElse: () => {'id': 'paystack'},
        );
        _provider = (firstEnabled['id'] as String?) ?? 'paystack';
        _loadingProviders = false;
      });
      _animCtrl.forward();

      if (_autoVerifyOnLoad && _paymentId != null && !_completed) {
        _autoVerifyOnLoad = false;
        _verifyPayment();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingProviders = false;
        _error = e.toString();
      });
      _animCtrl.forward();
    }
  }

  Future<void> _initGooglePlay() async {
    try {
      final available = await GooglePlayBillingService.isAvailable();
      if (!mounted) return;
      setState(() => _googlePlayAvailable = available);
      if (available) {
        final stream = InAppPurchase.instance.purchaseStream;
        _purchaseSub = stream.listen(
          _onPurchaseUpdated,
          onError: (e) {
            if (!mounted) return;
            setState(() {
              _googlePlayLoading = false;
              _error = 'Google Play purchase error: $e';
            });
          },
        );
      }
    } catch (_) {
      // Google Play not available (e.g. iOS or no Play Store)
    }
  }

  void _onPurchaseUpdated(List<PurchaseDetails> purchases) {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          _handleGooglePlayPurchase(purchase);
          break;
        case PurchaseStatus.error:
          if (!mounted) return;
          setState(() {
            _googlePlayLoading = false;
            _error = 'Google Play purchase failed: ${purchase.error?.message ?? "unknown"}';
          });
          break;
        case PurchaseStatus.canceled:
          if (!mounted) return;
          setState(() {
            _googlePlayLoading = false;
            _statusText = 'Google Play purchase was canceled.';
          });
          break;
        case PurchaseStatus.pending:
          if (!mounted) return;
          setState(() {
            _statusText = 'Google Play purchase is pending...';
          });
          break;
      }
    }
  }

  Future<void> _handleGooglePlayPurchase(PurchaseDetails purchase) async {
    if (!mounted) return;
    setState(() {
      _googlePlayLoading = true;
      _statusText = 'Verifying Google Play purchase...';
    });

    try {
      final isSub = _pendingGooglePlayIsSub || _purpose == 'platform_plan';
      final result = await GooglePlayBillingService.completeAndVerify(
        purchase: purchase,
        isSubscription: isSub,
      );

      if (!mounted) return;
      setState(() {
        _completed = true;
        _googlePlayLoading = false;
        _statusText = 'Google Play payment verified successfully.';
      });

      await CheckoutRecoveryService.clearPendingSession();

      await _openResultScreen(
        status: _resultSuccess,
        message: 'Your Google Play payment has been verified and applied successfully.',
        payload: result,
      );
    } catch (e) {
      if (!mounted) return;
      final parsed = e.toString().replaceFirst('Exception: ', '');
      setState(() {
        _googlePlayLoading = false;
        _error = parsed;
        _statusText = 'Google Play verification failed.';
      });
      await _openResultScreen(status: _resultFailed, message: parsed);
    }
  }

  String? _googlePlayProductIdForCurrentSelection() {
    if (_purpose == 'wallet_topup') {
      final amount = _displayAmount;
      if (amount <= 500) return 'wallet_topup_500';
      if (amount <= 1000) return 'wallet_topup_1000';
      if (amount <= 2000) return 'wallet_topup_2000';
      if (amount <= 5000) return 'wallet_topup_5000';
      if (amount <= 10000) return 'wallet_topup_10000';
      return null;
    }
    if (_purpose == 'platform_plan' && _planId != null) {
      final cycleSuffix = _billingCycle == 'yearly' ? 'yearly' : 'monthly';
      final planProductMap = {
        'plan_viewer_basic': 'viewer_basic_$cycleSuffix',
        'plan_viewer_pro': 'viewer_pro_$cycleSuffix',
        'plan_viewer_premium': 'viewer_premium_$cycleSuffix',
        'plan_basic': 'creator_basic_monthly',
        'plan_pro': 'creator_pro_monthly',
        'plan_premium': 'creator_premium_monthly',
      };
      return planProductMap[_planId];
    }
    return null;
  }

  Future<void> _startGooglePlayCheckout() async {
    final productId = _googlePlayProductIdForCurrentSelection();
    if (productId == null) {
      setState(() {
        _error = 'This amount is not available as a Google Play product. Use card payment instead.';
      });
      return;
    }

    setState(() {
      _googlePlayLoading = true;
      _error = null;
      _statusText = 'Opening Google Play billing...';
      _pendingGooglePlayIsSub = _purpose == 'platform_plan';
    });

    try {
      await GooglePlayBillingService.initiatePurchase(
        productId: productId,
        isSubscription: _pendingGooglePlayIsSub,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _googlePlayLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
        _statusText = 'Could not start Google Play purchase.';
      });
    }
  }

  Future<void> _startCheckout() async {
    setState(() {
      _starting = true;
      _error = null;
      _statusText = 'Preparing secure checkout...';
    });

    try {
      final amount = double.tryParse(_amountCtrl.text.trim());
      if (_purpose == 'wallet_topup' && (amount == null || amount < 100)) {
        throw Exception('Enter a valid top-up amount of at least ₦100');
      }

      final data = await PaymentService.initializeCheckout(
        purpose: _purpose,
        provider: _provider,
        planId: _planId,
        billingCycle: _purpose == 'platform_plan' ? _billingCycle : null,
        amountNgn: _purpose == 'wallet_topup' ? amount : null,
        balanceType: _purpose == 'wallet_topup' ? _balanceType : null,
      );

      final payment = data['payment'] as Map<String, dynamic>?;
      final paymentId = payment?['id'] as String?;
      final checkoutUrl = payment?['checkout_url'] as String?;
      if (paymentId == null || checkoutUrl == null || checkoutUrl.isEmpty) {
        throw Exception('Checkout URL was not returned by the server');
      }

      setState(() {
        _paymentId = paymentId;
        _checkoutUrl = checkoutUrl;
        _launchedCheckout = true;
        _starting = false;
        _statusText = 'Checkout opened. Complete payment and return to AfroVision.';
      });

      await CheckoutRecoveryService.savePendingSession(
        paymentId: paymentId,
        purpose: _purpose,
        checkoutUrl: checkoutUrl,
        title: _title,
        planId: _planId,
        planName: _planName,
        billingCycle: _billingCycle,
        balanceType: _balanceType,
        amountNgn: _purpose == 'wallet_topup' ? amount : _fixedAmount,
      );

      await _launchCheckoutUrl();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
        _statusText = 'Checkout could not be started.';
      });

      await _openResultScreen(status: _resultUnknown, message: _error);
    }
  }

  Future<void> _launchCheckoutUrl() async {
    final checkoutUrl = _checkoutUrl;
    if (checkoutUrl == null || checkoutUrl.isEmpty) return;

    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (_) => PaymentWebViewScreen(checkoutUrl: checkoutUrl),
      ),
    );

    if (!mounted) return;

    if (result != null && result.isNotEmpty) {
      setState(() {
        _paymentId = result;
        _launchedCheckout = true;
      });
      CheckoutRecoveryService.savePendingSession(
        paymentId: result,
        purpose: _purpose,
        checkoutUrl: _checkoutUrl,
        title: _title,
        planId: _planId,
        planName: _planName,
        billingCycle: _billingCycle,
        balanceType: _balanceType,
        amountNgn: _purpose == 'wallet_topup'
            ? double.tryParse(_amountCtrl.text.trim())
            : _fixedAmount,
      );
      _verifyPayment();
    }
  }

  String _statusFromError(String message) {
    final m = message.toLowerCase();
    if (m.contains('failed at the gateway') || m.contains('payment failed')) {
      return _resultFailed;
    }
    if (m.contains('not completed yet')) {
      return _resultPending;
    }
    if (m.contains('canceled') || m.contains('cancelled')) {
      return _resultCanceled;
    }
    return _resultUnknown;
  }

  Future<void> _openResultScreen({
    required String status,
    String? message,
    Map<String, dynamic>? payload,
  }) async {
    final actionResult = await Navigator.pushNamed(
      context,
      '/checkout/result',
      arguments: {
        'status': status,
        'message': message,
        'paymentId': _paymentId,
        'purpose': _purpose,
      },
    );

    if (!mounted) return;
    final action = actionResult is Map<String, dynamic>
        ? actionResult['action'] as String?
        : null;

    switch (action) {
      case 'done':
        if (payload != null) {
          await CheckoutRecoveryService.clearPendingSession();
          _completed = true;
          if (!mounted) return;
          Navigator.pop(context, payload);
        }
        return;
      case 'retry_verify':
        _verifyPayment();
        return;
      case 'retry_checkout':
        _startCheckout();
        return;
      case 'reopen_checkout':
        await _launchCheckoutUrl();
        return;
      case 'close':
        if (status != _resultPending) {
          await CheckoutRecoveryService.clearPendingSession();
        }
        if (!mounted) return;
        Navigator.pop(context);
        return;
      default:
        return;
    }
  }

  Future<void> _verifyPayment({bool silent = false}) async {
    if (_paymentId == null) {
      if (!silent) {
        setState(() => _error = 'No checkout has been started yet.');
      }
      return;
    }

    setState(() {
      _verifying = true;
      if (!silent) _error = null;
      _statusText = 'Verifying payment with the gateway...';
    });

    try {
      final data = await PaymentService.verifyCheckout(_paymentId!);
      if (!mounted) return;
      setState(() {
        _completed = true;
        _verifying = false;
        _statusText = 'Payment verified successfully.';
      });

      await CheckoutRecoveryService.clearPendingSession();

      await _openResultScreen(
        status: _resultSuccess,
        message: 'Your payment has been verified and applied successfully.',
        payload: data,
      );
    } catch (e) {
      final parsed = e.toString().replaceFirst('Exception: ', '');
      final status = _statusFromError(parsed);
      if (!mounted) return;
      setState(() {
        _verifying = false;
        if (!silent) {
          _error = parsed;
        }
        _statusText = 'Payment not verified yet.';
      });

      if (!silent) {
        await _openResultScreen(status: status, message: parsed);
      }
    }
  }

  double get _displayAmount =>
      _fixedAmount ?? double.tryParse(_amountCtrl.text.trim()) ?? 0;

  double get _vptPrice {
    final price = _exchangeRates['vpt_price_ngn'];
    if (price is num) return price.toDouble();
    return 750;
  }

  String get _topUpDisplay {
    if (_purpose == 'platform_plan') {
      final amount = _fixedAmount;
      if (amount != null && amount > 0) return '₦${walletFormatAmount(amount)}';
      return 'Plan Checkout';
    }
    return '₦${walletFormatAmount(_displayAmount)}';
  }

  String get _topUpHint {
    if (_purpose == 'platform_plan') {
      return '${_planName ?? 'Selected plan'} · ${_billingCycle.toUpperCase()}';
    }
    if (_displayAmount <= 0) {
      return _balanceType == 'vpt'
          ? 'Enter an amount to buy off-chain vPT'
          : 'Enter an amount to top up your NGN cash wallet';
    }
    if (_balanceType == 'vpt') {
      final vpt = _displayAmount / _vptPrice;
      return '≈ ${walletFormatAmount(vpt)} vPT';
    }
    return 'Top up your NGN cash wallet balance';
  }

  void _onBack() {
    if (_launchedCheckout && !_completed) {
      unawaited(_openResultScreen(
        status: _resultCanceled,
        message: 'You left checkout before verification completed.',
      ));
      return;
    }
    if (!mounted) return;
    Navigator.pop(context);
  }

  void _selectAmount(int amount) {
    _amountCtrl.text = amount.toString();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            AssetsHeader(
              title: _purpose == 'platform_plan' ? 'Plan Checkout' : 'Top Up',
              subtitle: _purpose == 'platform_plan'
                  ? '${_planName ?? 'Selected plan'} · ${_billingCycle.toUpperCase()}'
                  : 'Add value to your wallet',
              onBack: _onBack,
            ),
            Expanded(
              child: _loadingProviders
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Nocturne.gold,
                        strokeWidth: 3,
                      ),
                    )
                  : FadeTransition(
                      opacity: _fadeIn,
                      child: SlideTransition(
                        position: _slideUp,
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildHeroCard(),
                              const SizedBox(height: 14),
                              if (_purpose == 'wallet_topup') ...[
                                _buildAmountField(),
                                const SizedBox(height: 9),
                                _buildQuickAmounts(),
                                const SizedBox(height: 14),
                                _buildBalanceTypeSelector(),
                                const SizedBox(height: 14),
                              ],
                              _buildProviderSelector(),
                              if (_googlePlayAvailable) ...[
                                const SizedBox(height: 14),
                                _buildGooglePlaySection(),
                              ],
                              const SizedBox(height: 14),
                              _buildStatusCard(),
                              if (_error != null) ...[
                                const SizedBox(height: 14),
                                _buildErrorCard(),
                              ],
                              const SizedBox(height: 22),
                              _buildActions(),
                            ],
                          ),
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B2A5C), Color(0xFF101C40)],
        ),
        border: Border.all(color: const Color(0xFF2F4483)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _purpose == 'platform_plan' ? 'Subscription Checkout' : 'Wallet top-up',
            style: const TextStyle(
              color: Nocturne.gold,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _topUpDisplay,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 32,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.02,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            _topUpHint,
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 11.5,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Top-up amount (NGN)',
          style: TextStyle(
            color: Nocturne.goldSoft,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 7),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF0E1A3D),
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: Nocturne.borderCard),
          ),
          child: Row(
            children: [
              const Text(
                '₦',
                style: TextStyle(
                  color: Nocturne.goldLight,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _amountCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    border: InputBorder.none,
                    hintText: '2000',
                    hintStyle: TextStyle(
                      color: Nocturne.textHint,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQuickAmounts() {
    return Row(
      children: _quickAmounts.map((amount) {
        final active = _displayAmount == amount.toDouble();
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.only(right: 7),
            child: GestureDetector(
              onTap: () => _selectAmount(amount),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: active ? const Color(0x14F0A52A) : const Color(0x05FFFFFF),
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(
                    color: active ? Nocturne.gold : Nocturne.border,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  '₦${walletFormatAmount(amount)}',
                  style: TextStyle(
                    color: active ? Nocturne.goldLight : Nocturne.textMuted,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildBalanceTypeSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Credit destination',
          style: TextStyle(
            color: Nocturne.goldSoft,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 7),
        Row(
          children: [
            Expanded(
              child: _buildDestinationTile(
                value: 'ngn',
                label: 'Cash Wallet',
                note: 'For subscriptions and premium access',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildDestinationTile(
                value: 'vpt',
                label: 'Off-chain vPT',
                note: 'For gifts and vPT spend',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDestinationTile({
    required String value,
    required String label,
    required String note,
  }) {
    final selected = _balanceType == value;
    return GestureDetector(
      onTap: () => setState(() => _balanceType = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0x05FFFFFF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? Nocturne.gold : Nocturne.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                color: selected ? Nocturne.text : Nocturne.textDim,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              note,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 10.5,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProviderSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Payment provider',
          style: TextStyle(
            color: Nocturne.goldSoft,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 7),
        Column(
          children: _providers.map((item) {
            final id = (item['id'] as String?) ?? '';
            final label = (item['label'] as String?) ?? id;
            final note = (item['note'] as String?) ??
                (item['enabled'] == true ? 'Pay securely with $id' : 'Not configured');
            final enabled = item['enabled'] == true;
            final selected = _provider == id;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: enabled ? () => setState(() => _provider = id) : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: const Color(0x05FFFFFF),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(
                      color: selected ? Nocturne.gold : Nocturne.border,
                    ),
                  ),
                  child: Row(
                    children: [
                      _buildRadioRing(selected: selected && enabled, enabled: enabled),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              label,
                              style: TextStyle(
                                color: enabled ? Nocturne.text : Nocturne.textHint,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              note,
                              style: const TextStyle(
                                color: Nocturne.textFaint,
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildRadioRing({required bool selected, required bool enabled}) {
    final ringColor = enabled
        ? (selected ? Nocturne.gold : Nocturne.textHint)
        : Nocturne.textHint.withValues(alpha: 0.35);
    final dotColor = selected ? Nocturne.goldLight : Colors.transparent;
    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: ringColor, width: 1.5),
      ),
      alignment: Alignment.center,
      child: Container(
        width: 9,
        height: 9,
        decoration: BoxDecoration(
          color: dotColor,
          shape: BoxShape.circle,
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
      decoration: BoxDecoration(
        color: Nocturne.bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Status',
            style: TextStyle(
              color: Nocturne.gold,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _statusText,
            style: const TextStyle(
              color: Nocturne.textDim,
              fontSize: 12.5,
              height: 1.4,
            ),
          ),
          if (_paymentId != null) ...[
            const SizedBox(height: 8),
            Text(
              'Reference: $_paymentId',
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Nocturne.red.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.red.withValues(alpha: 0.35)),
      ),
      child: Text(
        _error!,
        style: const TextStyle(
          color: Nocturne.text,
          fontSize: 13,
          height: 1.4,
        ),
      ),
    );
  }

  Widget _buildGooglePlaySection() {
    final available = _googlePlayProductIdForCurrentSelection() != null;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.play_arrow_rounded, color: Nocturne.goldLight, size: 18),
              const SizedBox(width: 9),
              const Text(
                'Google Play',
                style: TextStyle(
                  color: Nocturne.text,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Text(
                available ? 'Available' : 'Select a supported amount',
                style: TextStyle(
                  color: available ? Nocturne.green : Nocturne.textFaint,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: _googlePlayLoading || !available ? null : () => _startGooglePlayCheckout(),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: const Color(0xFF0F8B5F),
                borderRadius: BorderRadius.circular(11),
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_googlePlayLoading)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: Color(0xFFEAFFF3),
                        strokeWidth: 2,
                      ),
                    )
                  else
                    const Icon(Icons.android, color: Color(0xFFEAFFF3), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    _googlePlayLoading ? 'Processing...' : 'Pay with Google Play',
                    style: const TextStyle(
                      color: Color(0xFFEAFFF3),
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    final canStart = !_starting &&
        (_purpose == 'platform_plan' || _displayAmount >= 100);
    return Column(
      children: [
        GestureDetector(
          onTap: canStart ? () => _startCheckout() : null,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              gradient: Nocturne.goldCta,
              borderRadius: BorderRadius.circular(13),
              boxShadow: [
                BoxShadow(
                  color: const Color(0x33EF9615),
                  blurRadius: 22,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: Text(
              _starting
                  ? 'Opening Checkout...'
                  : _checkoutUrl != null
                      ? 'Open Checkout Again'
                      : 'Start Secure Checkout',
              style: const TextStyle(
                color: Color(0xFF26170A),
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: _verifying ? null : () => _verifyPayment(),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: const Color(0xFF4A3A1A)),
            ),
            alignment: Alignment.center,
            child: Text(
              _verifying ? 'Verifying...' : 'I completed payment, verify now',
              style: const TextStyle(
                color: Nocturne.goldLight,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
