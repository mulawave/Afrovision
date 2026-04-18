import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/deep_link_service.dart';
import '../../../core/theme/app_colors.dart';
import '../services/payment_service.dart';

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
      _verifyPayment();
    };
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
    }

    _loadProviders();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    DeepLinkService.onCheckoutResult = null;
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
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingProviders = false;
        _error = e.toString();
      });
      _animCtrl.forward();
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

      // Use Chrome Custom Tabs (inAppBrowserView) instead of an external browser.
      // Custom Tabs automatically close and return to the app when the payment
      // gateway redirects to our custom scheme (afrovision://checkout/result),
      // so the user never needs to manually switch back.
      final launched = await launchUrl(
        Uri.parse(checkoutUrl),
        mode: LaunchMode.inAppBrowserView,
      );
      if (!launched && mounted) {
        // Fallback to external browser if Custom Tabs are unavailable.
        await launchUrl(
          Uri.parse(checkoutUrl),
          mode: LaunchMode.externalApplication,
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
        _statusText = 'Checkout could not be started.';
      });
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
      Navigator.pop(context, data);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        if (!silent) {
          _error = e.toString().replaceFirst('Exception: ', '');
        }
        _statusText = 'Payment not verified yet.';
      });
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
            onTap: () => Navigator.pop(context),
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
