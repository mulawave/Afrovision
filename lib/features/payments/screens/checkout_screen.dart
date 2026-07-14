import 'dart:async';
import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../../core/services/deep_link_service.dart';
import 'payment_webview_screen.dart';
import '../../../core/theme/app_colors.dart';
import '../services/checkout_recovery_service.dart';
import '../services/payment_service.dart';
import '../services/google_play_billing_service.dart';

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

    // Register deep-link callback so the payment gateway (Paystack/Flutterwave)
    // can redirect back to the app via afrovision://checkout/result?payment_id=xxx
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
    await _restorePendingSessionIfNeeded();
    await _loadProviders();
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
      final isSub = _pendingGooglePlayIsSub ||
          _purpose == 'platform_plan';
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
      // Match to nearest predefined top-up product
      if (amount <= 500) return 'wallet_topup_500';
      if (amount <= 1000) return 'wallet_topup_1000';
      if (amount <= 2000) return 'wallet_topup_2000';
      if (amount <= 5000) return 'wallet_topup_5000';
      if (amount <= 10000) return 'wallet_topup_10000';
      return null; // Amount too large for Google Play top-up products
    }
    if (_purpose == 'platform_plan' && _planId != null) {
      final cycleSuffix = _billingCycle == 'yearly' ? 'yearly' : 'monthly';
      // Map plan IDs to Google Play product IDs
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
        _statusText =
            'Checkout opened. Complete payment and return to AfroVision.';
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

    // WebView intercepted com.afrovision.app://checkout/result?payment_id=xxx
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: _loadingProviders
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.orange),
                )
              : FadeTransition(
                  opacity: _fadeIn,
                  child: SlideTransition(
                    position: _slideUp,
                    child: Column(
                      children: [
                        _buildAppBar(),
                        Expanded(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildHeroCard(),
                                const SizedBox(height: 16),
                                if (_purpose == 'wallet_topup') ...[
                                  _buildAmountField(),
                                  const SizedBox(height: 16),
                                  _buildBalanceTypeSelector(),
                                  const SizedBox(height: 16),
                                ],
                                _buildProviderSelector(),
                                if (_googlePlayAvailable) ...[
                                  const SizedBox(height: 16),
                                  _buildGooglePlaySection(),
                                ],
                                const SizedBox(height: 16),
                                _buildStatusCard(),
                                if (_error != null) ...[
                                  const SizedBox(height: 16),
                                  _buildErrorCard(),
                                ],
                                const SizedBox(height: 22),
                                _buildActions(),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () async {
              if (_launchedCheckout && !_completed) {
                await _openResultScreen(
                  status: _resultCanceled,
                  message: 'You left checkout before verification completed.',
                );
                return;
              }
              if (!mounted) return;
              Navigator.pop(context);
            },
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              _title,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroCard() {
    final amountText = _displayAmount <= 0
        ? 'Choose an amount'
        : '₦${_displayAmount.toStringAsFixed(0)}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(
          colors: [
            AppColors.orange.withValues(alpha: 0.16),
            AppColors.lightOrange.withValues(alpha: 0.06),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _purpose == 'platform_plan'
                ? 'Subscription Checkout'
                : 'Wallet Top-Up',
            style: TextStyle(
              color: AppColors.goldText.withValues(alpha: 0.9),
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            amountText,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 30,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _purpose == 'platform_plan'
                ? '${_planName ?? 'Selected plan'} · ${_billingCycle.toUpperCase()}'
                : _balanceType == 'vpt'
                ? 'Buy vPT units into your gift wallet'
                : 'Top up your NGN gift wallet balance',
            style: const TextStyle(
              color: AppColors.hintText,
              fontSize: 13,
              fontWeight: FontWeight.w500,
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
          'Top-Up Amount (NGN)',
          style: TextStyle(
            color: AppColors.lightOrange,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _amountCtrl,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: AppColors.white),
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.inputFill,
            hintText: 'Minimum 100',
            hintStyle: const TextStyle(color: AppColors.hintText),
            prefixText: '₦ ',
            prefixStyle: const TextStyle(color: AppColors.lightOrange),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: AppColors.inputBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: AppColors.inputBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.orange),
            ),
          ),
          onChanged: (_) => setState(() {}),
        ),
      ],
    );
  }

  Widget _buildBalanceTypeSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Credit Destination',
          style: TextStyle(
            color: AppColors.lightOrange,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _typeCard(
                'ngn',
                'NGN Wallet',
                'For subscriptions and premium access',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _typeCard(
                'vpt',
                'Gift Wallet vPT',
                'For gifts and vPT spend',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _typeCard(String value, String title, String subtitle) {
    final selected = _balanceType == value;
    return GestureDetector(
      onTap: () => setState(() => _balanceType = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.orange.withValues(alpha: 0.12)
              : AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.45)
                : AppColors.inputBorder,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                color: selected ? AppColors.white : AppColors.lightOrange,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 11,
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
          'Payment Provider',
          style: TextStyle(
            color: AppColors.lightOrange,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 8),
        Column(
          children: _providers.map((item) {
            final id = (item['id'] as String?) ?? '';
            final enabled = item['enabled'] == true;
            final selected = _provider == id;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: enabled ? () => setState(() => _provider = id) : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.orange.withValues(alpha: 0.12)
                        : AppColors.inputFill,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected
                          ? AppColors.orange.withValues(alpha: 0.45)
                          : AppColors.inputBorder,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        selected
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_off_rounded,
                        color: selected ? AppColors.orange : AppColors.hintText,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              (item['label'] as String?) ?? id,
                              style: TextStyle(
                                color: enabled
                                    ? AppColors.white
                                    : AppColors.hintText,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              enabled
                                  ? 'Configured in admin settings'
                                  : 'Not configured',
                              style: const TextStyle(
                                color: AppColors.hintText,
                                fontSize: 11,
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

  Widget _buildStatusCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Status',
            style: TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _statusText,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          if (_paymentId != null) ...[
            const SizedBox(height: 8),
            Text(
              'Reference: $_paymentId',
              style: const TextStyle(color: AppColors.hintText, fontSize: 11),
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
        color: AppColors.errorRed.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.35)),
      ),
      child: Text(
        _error!,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 13,
          height: 1.4,
        ),
      ),
    );
  }

  Widget _buildGooglePlaySection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.orange.withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.payments_outlined, color: AppColors.orange, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Google Play',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Text(
                _googlePlayProductIdForCurrentSelection() != null
                    ? 'Available'
                    : 'Select a supported amount',
                style: TextStyle(
                  color: _googlePlayProductIdForCurrentSelection() != null
                      ? AppColors.lightOrange
                      : AppColors.hintText,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _googlePlayLoading || _googlePlayProductIdForCurrentSelection() == null
                  ? null
                  : _startGooglePlayCheckout,
              icon: _googlePlayLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: AppColors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.android, size: 18),
              label: Text(
                _googlePlayLoading ? 'Processing...' : 'Pay with Google Play',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF01875F),
                foregroundColor: AppColors.white,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _starting ? null : _startCheckout,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.orange,
              foregroundColor: AppColors.white,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: Text(
              _starting
                  ? 'Opening Checkout...'
                  : _checkoutUrl != null
                  ? 'Open Checkout Again'
                  : 'Start Secure Checkout',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: _verifying ? null : () => _verifyPayment(),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.lightOrange,
              side: BorderSide(
                color: AppColors.lightOrange.withValues(alpha: 0.4),
              ),
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: Text(
              _verifying ? 'Verifying...' : 'I Completed Payment, Verify Now',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ],
    );
  }
}
