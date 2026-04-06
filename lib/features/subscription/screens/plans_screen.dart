import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/plan_model.dart';
import '../services/subscription_service.dart';
import '../../currency/models/currency_model.dart';
import '../../currency/currency_service.dart';
import '../../auth/services/profile_service.dart';

class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen>
    with SingleTickerProviderStateMixin {
  List<PlanModel> _plans = [];
  bool _loading = true;
  String? _subscribingPlanId;
  List<CurrencyModel> _currencies = [];
  String _selectedCurrency = 'NGN';
  String _currencySymbol = '₦';
  Map<String, double> _displayPrices = {};
  bool _isRenewal = false;
  double _vptBalance = 0;
  String _paymentMethod = 'fiat';
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _loadData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      // Load user's preferred currency
      final profile = await ProfileService.getProfile();
      _selectedCurrency = profile.preferredCurrency;
      _isRenewal = profile.firstSubscriptionAt != null;
      _vptBalance = profile.vptBalance;

      // Load currencies and plans in parallel
      final results = await Future.wait([
        CurrencyService.getCurrencies(),
        SubscriptionService.getPlans(),
      ]);
      final currencies = results[0] as List<CurrencyModel>;
      final plans = results[1] as List<PlanModel>;

      if (!mounted) return;
      setState(() {
        _currencies = currencies;
        _plans = plans;
        _loading = false;
      });
      _animController.forward();
      _loadConvertedPrices();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _loadConvertedPrices() async {
    try {
      final data = await CurrencyService.getConvertedPlans(_selectedCurrency);
      if (!mounted) return;
      final plansData = data['plans'] as List;
      final prices = <String, double>{};
      for (final p in plansData) {
        prices[p['id'] as String] = (p['display_price'] as num).toDouble();
      }
      setState(() {
        _currencySymbol = data['symbol'] as String? ?? '₦';
        _displayPrices = prices;
      });
    } catch (e) {
      debugPrint('[Plans] price conversion error: $e');
    }
  }

  void _onCurrencyChanged(String? code) {
    if (code == null || code == _selectedCurrency) return;
    setState(() => _selectedCurrency = code);
    _loadConvertedPrices();
  }

  Future<void> _subscribe(PlanModel plan) async {
    setState(() => _subscribingPlanId = plan.id);
    try {
      await SubscriptionService.subscribe(plan.id, paymentMethod: _paymentMethod);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Subscribed to ${plan.name.toUpperCase()} plan!'),
          backgroundColor: const Color(0xFF4CAF50).withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _subscribingPlanId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor:
                              AlwaysStoppedAnimation<Color>(AppColors.orange),
                        ),
                      )
                    : _plans.isEmpty
                        ? const Center(
                            child: Text('No plans available',
                                style: TextStyle(color: AppColors.white)))
                        : _buildContent(),
              ),
            ],
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
              child: const Icon(Icons.arrow_back_ios_new_rounded,
                  color: AppColors.white, size: 18),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Choose a Plan',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return FadeTransition(
      opacity: _fadeAnim,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          children: [
            const SizedBox(height: 8),
            Text(
              'Unlock creator features',
              style: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.8),
                fontSize: 14,
              ),
            ),
            if (_currencies.length > 1) ...[
              const SizedBox(height: 16),
              _buildCurrencyPicker(),
            ],
            if (_isRenewal) ...[
              const SizedBox(height: 12),
              _buildPaymentToggle(),
            ],
            const SizedBox(height: 24),
            ..._plans.map((plan) => _buildPlanCard(plan)),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrencyPicker() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedCurrency,
          dropdownColor: AppColors.lightBlue,
          icon: const Icon(Icons.keyboard_arrow_down_rounded,
              color: AppColors.orange, size: 20),
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
          items: _currencies.map((c) {
            return DropdownMenuItem(
              value: c.code,
              child: Text('${c.symbol}  ${c.code} — ${c.name}'),
            );
          }).toList(),
          onChanged: _onCurrencyChanged,
        ),
      ),
    );
  }

  Widget _buildPaymentToggle() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.payment_rounded,
              color: AppColors.orange, size: 18),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Pay with',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          GestureDetector(
            onTap: () {
              setState(() {
                _paymentMethod =
                    _paymentMethod == 'fiat' ? 'vpt' : 'fiat';
              });
            },
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _paymentMethod == 'vpt'
                    ? AppColors.orange.withValues(alpha: 0.15)
                    : AppColors.lightBlue.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _paymentMethod == 'vpt'
                      ? AppColors.orange.withValues(alpha: 0.4)
                      : AppColors.inputBorder,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _paymentMethod == 'vpt'
                        ? Icons.account_balance_wallet_rounded
                        : Icons.credit_card_rounded,
                    color: _paymentMethod == 'vpt'
                        ? AppColors.orange
                        : AppColors.hintText,
                    size: 14,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _paymentMethod == 'vpt'
                        ? 'vPT (₦${_formatPrice(_vptBalance)})'
                        : 'Fiat',
                    style: TextStyle(
                      color: _paymentMethod == 'vpt'
                          ? AppColors.orange
                          : AppColors.white,
                      fontSize: 12,
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

  Widget _buildPlanCard(PlanModel plan) {
    final isPremium = plan.name == 'premium';
    final isPro = plan.name == 'pro';
    final isHighlighted = isPremium || isPro;
    final isSubscribing = _subscribingPlanId == plan.id;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isPremium
              ? AppColors.orange.withValues(alpha: 0.6)
              : isPro
                  ? const Color(0xFF4CAF50).withValues(alpha: 0.5)
                  : AppColors.inputBorder,
          width: isHighlighted ? 1.5 : 1,
        ),
        boxShadow: isPremium
            ? [
                BoxShadow(
                  color: AppColors.orange.withValues(alpha: 0.15),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isPremium
                      ? AppColors.orange.withValues(alpha: 0.15)
                      : AppColors.lightOrange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  plan.name.toUpperCase(),
                  style: TextStyle(
                    color: isPremium ? AppColors.orange : AppColors.lightOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ),
              if (isPremium) ...[
                const SizedBox(width: 8),
                Icon(Icons.workspace_premium_rounded,
                    color: AppColors.orange.withValues(alpha: 0.8), size: 18),
              ],
            ],
          ),
          const SizedBox(height: 14),

          // Price
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$_currencySymbol${_formatPrice(_displayPrices[plan.id] ?? plan.price)}',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(width: 4),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '/month',
                  style: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.7),
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Features
          ...plan.features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.check_circle_rounded,
                      color: isPremium
                          ? AppColors.orange
                          : const Color(0xFF4CAF50),
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        plan.featureLabel(f),
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              )),
          const SizedBox(height: 16),

          // Subscribe button
          GestureDetector(
            onTap: isSubscribing ? null : () => _subscribe(plan),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                gradient: isSubscribing
                    ? AppColors.buttonDisabledGradient
                    : isHighlighted
                        ? AppColors.buttonGradient
                        : null,
                color: isHighlighted ? null : AppColors.lightBlue,
                borderRadius: BorderRadius.circular(12),
                border: isHighlighted
                    ? null
                    : Border.all(
                        color: AppColors.lightOrange.withValues(alpha: 0.3)),
              ),
              child: Center(
                child: isSubscribing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                              AppColors.white),
                        ),
                      )
                    : Text(
                        isPremium
                            ? 'Go Premium'
                            : isPro
                                ? 'Go Pro'
                                : 'Subscribe',
                        style: TextStyle(
                          color: isPremium || isPro
                              ? AppColors.white
                              : AppColors.lightOrange,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatPrice(double price) {
    if (price >= 1000) {
      final str = price.toInt().toString();
      final buffer = StringBuffer();
      for (int i = 0; i < str.length; i++) {
        if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
        buffer.write(str[i]);
      }
      return buffer.toString();
    }
    return price.toStringAsFixed(0);
  }
}
