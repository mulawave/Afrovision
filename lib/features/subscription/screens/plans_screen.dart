import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/plan_model.dart';
import '../services/subscription_service.dart';
import '../../currency/models/currency_model.dart';
import '../../currency/currency_service.dart';
import '../../auth/services/profile_service.dart';
import '../../reputation/models/reputation_model.dart';
import '../../reputation/services/reputation_service.dart';

class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen>
    with TickerProviderStateMixin {
  List<PlanModel> _plans = [];
  bool _loading = true;
  String? _subscribingPlanId;
  List<CurrencyModel> _currencies = [];
  String _selectedCurrency = 'NGN';
  String _currencySymbol = '₦';
  Map<String, double> _displayPrices = {};
  bool _isRenewal = false;
  double _vptBalance = 0;
  String _accountRole = 'viewer';
  String _paymentMethod = 'fiat';
  bool _yearlyBilling = false;
  ReputationModel? _reputation;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late TabController _tabController;
  bool _tabSelectionApplied = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_tabSelectionApplied) return;
    final args = ModalRoute.of(context)?.settings.arguments;
    int? targetIndex;
    if (args is Map) {
      final tab = args['tab']?.toString().toLowerCase();
      if (tab == 'creator') {
        targetIndex = 0;
      } else if (tab == 'viewer') {
        targetIndex = 1;
      }
    } else if (args is String) {
      final tab = args.toLowerCase();
      if (tab == 'creator') {
        targetIndex = 0;
      } else if (tab == 'viewer') {
        targetIndex = 1;
      }
    }
    if (targetIndex != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _tabController.animateTo(targetIndex!);
      });
      _tabSelectionApplied = true;
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  List<PlanModel> get _creatorPlans =>
      _plans.where((p) => p.isCreator).toList();
  List<PlanModel> get _viewerPlans => _plans.where((p) => p.isViewer).toList();
  bool get _isCreatorAccount =>
      _accountRole == 'creator' || _accountRole == 'admin';

  int get _userRepLevel => _reputation?.level ?? 0;

  static const Map<String, int> _planLevelGate = {
    'plan_viewer_free': 0,
    'plan_viewer_basic': 1,
    'plan_viewer_pro': 2,
    'plan_viewer_premium': 3,
  };

  Future<void> _loadData() async {
    try {
      final profile = await ProfileService.getProfile();
      _selectedCurrency = profile.preferredCurrency;
      _isRenewal = profile.firstSubscriptionAt != null;
      _vptBalance = profile.vpt;
      _accountRole = profile.role;

      final results = await Future.wait([
        CurrencyService.getCurrencies(),
        SubscriptionService.getPlans(),
        ReputationService.getMyReputation()
            .then<ReputationModel?>((v) => v)
            .catchError((_) => null),
      ]);
      final currencies = results[0] as List<CurrencyModel>;
      final plans = results[1] as List<PlanModel>;

      if (!mounted) return;
      setState(() {
        _currencies = currencies;
        _plans = plans;
        _reputation = results[2] as ReputationModel?;
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
    if (plan.price == 0) return; // Free plan
    if (plan.isViewer && _isCreatorAccount) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Creator accounts do not use viewer plans. You can still access public and private channels without one, while exclusive premium channels stay pay-per-access.',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      return;
    }

    setState(() => _subscribingPlanId = plan.id);
    try {
      if (_paymentMethod == 'vpt') {
        await SubscriptionService.subscribe(
          plan.id,
          paymentMethod: _paymentMethod,
        );
      } else {
        final billingCycle = _yearlyBilling && plan.isViewer
            ? 'yearly'
            : 'monthly';
        final checkoutResult = await Navigator.pushNamed(
          context,
          '/checkout',
          arguments: {
            'purpose': 'platform_plan',
            'title': 'Plan Checkout',
            'planId': plan.id,
            'planName': plan.name.toUpperCase(),
            'billingCycle': billingCycle,
            'amountNgn': billingCycle == 'yearly'
                ? (plan.yearlyPrice ?? plan.price)
                : plan.price,
          },
        );

        if (checkoutResult == null) {
          if (!mounted) return;
          setState(() => _subscribingPlanId = null);
          return;
        }
      }

      if (!mounted) return;
      setState(() => _subscribingPlanId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Subscribed to ${plan.name.toUpperCase()} plan!',
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: const Color(0xFF4CAF50).withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _subscribingPlanId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString(),
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
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
              _buildTabBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _plans.isEmpty
                    ? const Center(
                        child: Text(
                          'No plans available',
                          style: TextStyle(color: AppColors.white),
                        ),
                      )
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _buildCreatorContent(),
                          _buildViewerContent(),
                        ],
                      ),
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
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
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

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          gradient: AppColors.buttonGradient,
          borderRadius: BorderRadius.circular(10),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        labelColor: AppColors.white,
        unselectedLabelColor: AppColors.hintText,
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        unselectedLabelStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        padding: const EdgeInsets.all(3),
        tabs: const [
          Tab(text: 'Creator Plans'),
          Tab(text: 'Viewer Plans'),
        ],
      ),
    );
  }

  Widget _buildCreatorContent() {
    final plans = _creatorPlans;
    return FadeTransition(
      opacity: _fadeAnim,
      child: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.orange,
        backgroundColor: AppColors.cardBg,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const SizedBox(height: 16),
              if (!_isCreatorAccount)
                _buildInfoBanner(
                  title: 'Viewer to Creator Upgrade',
                  message:
                      'Switching to a creator plan replaces viewer-plan perks. After upgrading, you can still access public and private channels without buying a viewer plan again. Only exclusive premium channels remain pay-per-access.',
                  color: AppColors.lightOrange,
                ),
              if (!_isCreatorAccount) const SizedBox(height: 16),
              Text(
                'Unlock creator features & start broadcasting',
                style: TextStyle(color: AppColors.goldText, fontSize: 14),
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
              ...plans.map((plan) => _buildPlanCard(plan)),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildViewerContent() {
    final plans = _viewerPlans;
    return FadeTransition(
      opacity: _fadeAnim,
      child: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.orange,
        backgroundColor: AppColors.cardBg,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const SizedBox(height: 16),
              if (_isCreatorAccount)
                _buildInfoBanner(
                  title: 'Viewer Plans Disabled',
                  message:
                      'Your account is already operating as a creator. Viewer plans are no longer needed for standard channel access on creator accounts.',
                  color: AppColors.orange,
                ),
              if (_isCreatorAccount) const SizedBox(height: 16),
              Text(
                'Watch more, earn more vPT rewards',
                style: TextStyle(color: AppColors.goldText, fontSize: 14),
              ),
              const SizedBox(height: 10),
              if (!_isCreatorAccount) ...[
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.shield_rounded,
                        color: _reputation == null
                            ? AppColors.hintText
                            : _userRepLevel == 0
                            ? AppColors.hintText
                            : _userRepLevel == 1
                            ? AppColors.reputationBlue
                            : _userRepLevel == 2
                            ? AppColors.reputationPurple
                            : AppColors.orange,
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _reputation == null
                            ? 'Your level: Loading…'
                            : 'Your level: ${_reputation!.levelName}',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              _buildBillingToggle(),
              if (_currencies.length > 1) ...[
                const SizedBox(height: 12),
                _buildCurrencyPicker(),
              ],
              if (_isRenewal && !_isCreatorAccount) ...[
                const SizedBox(height: 12),
                _buildPaymentToggle(),
              ],
              const SizedBox(height: 24),
              ...plans.map((plan) => _buildViewerPlanCard(plan)),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBillingToggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _yearlyBilling = false),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  gradient: !_yearlyBilling ? AppColors.buttonGradient : null,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    'Monthly',
                    style: TextStyle(
                      color: !_yearlyBilling
                          ? AppColors.white
                          : AppColors.hintText,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _yearlyBilling = true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  gradient: _yearlyBilling ? AppColors.buttonGradient : null,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Yearly',
                        style: TextStyle(
                          color: _yearlyBilling
                              ? AppColors.white
                              : AppColors.hintText,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4CAF50).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'SAVE',
                          style: TextStyle(
                            color: Color(0xFF4CAF50),
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
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
          icon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: AppColors.orange,
            size: 20,
          ),
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
          const Icon(Icons.payment_rounded, color: AppColors.orange, size: 18),
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
                _paymentMethod = _paymentMethod == 'fiat' ? 'vpt' : 'fiat';
              });
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
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
                Icon(
                  Icons.workspace_premium_rounded,
                  color: AppColors.orange.withValues(alpha: 0.8),
                  size: 18,
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
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
                  style: TextStyle(color: AppColors.goldText, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...plan.features.map(
            (f) => Padding(
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
            ),
          ),
          const SizedBox(height: 16),
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
                        color: AppColors.lightOrange.withValues(alpha: 0.3),
                      ),
              ),
              child: Center(
                child: isSubscribing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.white,
                          ),
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

  Widget _buildViewerPlanCard(PlanModel plan) {
    final isFree = plan.price == 0;
    final isPremium = plan.name == 'premium_viewer';
    final isPro = plan.name == 'pro_viewer';
    final isBasic = plan.name == 'basic_viewer';
    final isHighlighted = isPremium;
    final isSubscribing = _subscribingPlanId == plan.id;
    final price = _yearlyBilling && plan.yearlyPrice != null
        ? plan.yearlyPrice!
        : plan.price;
    final period = _yearlyBilling ? '/year' : '/month';
    final multiplier = plan.rewardMultiplier;
    final isLockedForCreator = _isCreatorAccount && !isFree;
    final requiredRepLevel = _planLevelGate[plan.id] ?? 0;
    final isRepLocked = !isFree && _userRepLevel < requiredRepLevel;

    // Plan display name
    final displayName = isFree
        ? 'FREE'
        : plan.name.replaceAll('_', ' ').toUpperCase();

    // Badge color per tier
    final Color tierColor = isPremium
        ? AppColors.orange
        : isPro
        ? const Color(0xFF9C27B0) // Royal Purple
        : isBasic
        ? const Color(0xFF5C6BC0) // Dull Blue
        : AppColors.hintText;

    // Savings badge for yearly
    String? savingsText;
    if (_yearlyBilling && plan.yearlyPrice != null && plan.price > 0) {
      final monthlyCost = plan.price * 12;
      final savings = ((monthlyCost - plan.yearlyPrice!) / monthlyCost * 100)
          .round();
      if (savings > 0) savingsText = 'Save $savings%';
    }

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
              ? const Color(0xFF9C27B0).withValues(alpha: 0.5)
              : isBasic
              ? const Color(0xFF5C6BC0).withValues(alpha: 0.4)
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: isPremium
                      ? AppColors.orange.withValues(alpha: 0.15)
                      : isFree
                      ? AppColors.lightBlue.withValues(alpha: 0.3)
                      : tierColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  displayName,
                  style: TextStyle(
                    color: isPremium
                        ? AppColors.orange
                        : isFree
                        ? AppColors.hintText
                        : tierColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ),
              if (isPremium) ...[
                const SizedBox(width: 8),
                Icon(
                  Icons.workspace_premium_rounded,
                  color: AppColors.orange.withValues(alpha: 0.8),
                  size: 18,
                ),
              ],
              if (multiplier != null && multiplier > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: tierColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: tierColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    '${multiplier}x vPT',
                    style: TextStyle(
                      color: tierColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              const Spacer(),
              if (savingsText != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    savingsText,
                    style: const TextStyle(
                      color: Color(0xFF4CAF50),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                isFree
                    ? '${_currencySymbol}0'
                    : '$_currencySymbol${_formatPrice(_displayPrices[plan.id] ?? price)}',
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
                  isFree ? '' : period,
                  style: TextStyle(color: AppColors.goldText, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...plan.features.map(
            (f) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(
                    Icons.check_circle_rounded,
                    color: isFree ? AppColors.hintText : tierColor,
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
            ),
          ),
          // Reward multiplier info row
          if (multiplier != null) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: tierColor.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: tierColor.withValues(alpha: 0.15)),
              ),
              child: Row(
                children: [
                  Icon(
                    multiplier > 0
                        ? Icons.rocket_launch_rounded
                        : Icons.block_rounded,
                    color: tierColor,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      multiplier > 0
                          ? '${multiplier}x Community Pool Reward Multiplier'
                          : 'No vPT Rewards',
                      style: TextStyle(
                        color: multiplier > 0 ? tierColor : AppColors.hintText,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (!isFree)
            GestureDetector(
              onTap: isSubscribing || isLockedForCreator || isRepLocked
                  ? null
                  : () => _subscribe(plan),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  gradient: isSubscribing
                      ? AppColors.buttonDisabledGradient
                      : isLockedForCreator || isRepLocked
                      ? null
                      : isHighlighted
                      ? AppColors.buttonGradient
                      : null,
                  color: isLockedForCreator || isRepLocked
                      ? AppColors.lightBlue.withValues(alpha: 0.25)
                      : isHighlighted
                      ? null
                      : AppColors.lightBlue,
                  borderRadius: BorderRadius.circular(12),
                  border: isLockedForCreator || isRepLocked
                      ? Border.all(color: AppColors.inputBorder)
                      : isHighlighted
                      ? null
                      : Border.all(
                          color: AppColors.lightOrange.withValues(alpha: 0.3),
                        ),
                ),
                child: Center(
                  child: isSubscribing
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              AppColors.white,
                            ),
                          ),
                        )
                      : isRepLocked
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.lock_rounded,
                              color: AppColors.hintText,
                              size: 15,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Requires Level $requiredRepLevel Reputation',
                              style: const TextStyle(
                                color: AppColors.hintText,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        )
                      : Text(
                          isLockedForCreator
                              ? 'Creator Account Active'
                              : isPremium
                              ? 'Go Premium'
                              : isPro
                              ? 'Go Pro'
                              : 'Subscribe',
                          style: TextStyle(
                            color: isLockedForCreator
                                ? AppColors.hintText
                                : isPremium
                                ? AppColors.white
                                : AppColors.lightOrange,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.lightBlue.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Text(
                  'Current Plan',
                  style: TextStyle(
                    color: AppColors.hintText,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
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

  Widget _buildInfoBanner({
    required String title,
    required String message,
    required Color color,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}
