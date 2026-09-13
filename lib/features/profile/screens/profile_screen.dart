import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/premium_card.dart';
import '../../../core/widgets/role_badge.dart';
import '../../../core/widgets/reputation_badge.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../../auth/services/auth_service.dart';
import '../../currency/models/currency_model.dart';
import '../../currency/currency_service.dart';
import '../../reputation/models/reputation_model.dart';
import '../../reputation/services/reputation_service.dart';
import '../../reputation/widgets/reputation_card.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';
import '../../subscription/models/plan_model.dart';
import '../../subscription/services/subscription_service.dart';
import '../../referral/services/referral_service.dart';
import '../../subscription/models/channel_subscription_model.dart';
import '../../subscription/services/channel_subscription_service.dart';
import '../../broadcast/services/broadcast_service.dart';

enum _ProfileTab { profile, myPlan, subscriptions, refer, advertise, reminders }

final BoxDecoration Function({Color? accent, double radius}) _premiumCard =
    premiumCard;

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  UserModel? _user;
  ReputationModel? _reputation;
  bool _loading = true;
  List<CurrencyModel> _currencies = [];
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  _ProfileTab _tab = _ProfileTab.profile;

  // Lazily-loaded summary data for the secondary tabs.
  List<PlanModel>? _plans;
  bool _plansLoading = false;
  ReferralDashboard? _referralDashboard;
  bool _referralLoading = false;
  List<ChannelSubscriptionModel>? _channelSubs;
  bool _channelSubsLoading = false;
  List<Map<String, dynamic>>? _reminders;
  bool _remindersLoading = false;
  String? _remindersError;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _loadProfile();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final results = await Future.wait([
        ProfileService.getProfile(),
        CurrencyService.getCurrencies(),
        ReputationService.getMyReputation()
            .then<ReputationModel?>((v) => v)
            .catchError((_) => null),
      ]);
      if (!mounted) return;
      setState(() {
        _user = results[0] as UserModel;
        _currencies = results[1] as List<CurrencyModel>;
        _reputation = results[2] as ReputationModel?;
        _loading = false;
      });
      _animController.forward();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    await AuthService.logout();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }

  void _switchTab(_ProfileTab tab) {
    setState(() => _tab = tab);
    // Lazily fetch the summary data behind each secondary tab the first
    // time it is opened.
    switch (tab) {
      case _ProfileTab.myPlan:
        _loadPlans();
        break;
      case _ProfileTab.subscriptions:
        _loadChannelSubs();
        break;
      case _ProfileTab.refer:
        _loadReferralDashboard();
        break;
      case _ProfileTab.reminders:
        _loadReminders();
        break;
      case _ProfileTab.profile:
      case _ProfileTab.advertise:
        break;
    }
  }

  Future<void> _loadPlans() async {
    if (_plans != null || _plansLoading) return;
    setState(() => _plansLoading = true);
    try {
      final plans = await SubscriptionService.getPlans();
      if (!mounted) return;
      setState(() {
        _plans = plans;
        _plansLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _plansLoading = false);
    }
  }

  Future<void> _loadChannelSubs() async {
    if (_channelSubs != null || _channelSubsLoading) return;
    setState(() => _channelSubsLoading = true);
    try {
      final result = await ChannelSubscriptionService.getMine();
      if (!mounted) return;
      if (result['success'] == true) {
        final list = (result['subscriptions'] as List<dynamic>)
            .cast<ChannelSubscriptionModel>()
            .where((s) => s.isActive)
            .toList();
        setState(() {
          _channelSubs = list;
          _channelSubsLoading = false;
        });
      } else {
        setState(() {
          _channelSubs = [];
          _channelSubsLoading = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _channelSubs = [];
        _channelSubsLoading = false;
      });
    }
  }

  Future<void> _loadReferralDashboard() async {
    if (_referralDashboard != null || _referralLoading) return;
    setState(() => _referralLoading = true);
    try {
      final dashboard = await ReferralService.getDashboard();
      if (!mounted) return;
      setState(() {
        _referralDashboard = dashboard;
        _referralLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _referralLoading = false);
    }
  }

  Future<void> _loadReminders() async {
    if (_reminders != null || _remindersLoading) return;
    setState(() {
      _remindersLoading = true;
      _remindersError = null;
    });
    try {
      final reminders = await BroadcastService.getMyReminders();
      if (!mounted) return;
      setState(() {
        _reminders = reminders;
        _remindersLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _remindersError = e.toString();
        _remindersLoading = false;
      });
    }
  }

  Future<void> _removeReminder(String programId) async {
    try {
      await BroadcastService.removeReminder(programId);
      setState(() {
        _reminders = _reminders
            ?.where((r) => r['program_id'] != programId)
            .toList();
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Error: $e',
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
  }

  Future<void> _clearAllReminders() async {
    if (_reminders == null || _reminders!.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Clear All Reminders?',
          style: TextStyle(color: AppColors.white, fontSize: 16),
        ),
        content: const Text(
          'This will remove all your pending reminders.',
          style: TextStyle(color: AppColors.hintText, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.hintText)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear All', style: TextStyle(color: AppColors.errorRed)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      final ids = _reminders!
          .map((r) => r['program_id'] as String?)
          .whereType<String>()
          .toList();
      for (final id in ids) {
        try {
          await BroadcastService.removeReminder(id);
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() => _reminders = []);
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
              const MarqueeTickerWidget(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _user == null
                    ? _buildError()
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
            onTap: () => Navigator.pop(context, true),
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
            'Profile',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/account-settings'),
            child: Container(
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.settings_rounded,
                color: AppColors.orange,
                size: 18,
              ),
            ),
          ),
          GestureDetector(
            onTap: () async {
              final result = await Navigator.pushNamed(
                context,
                '/edit-profile',
              );
              if (result == true) _loadProfile();
            },
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.edit_rounded,
                color: AppColors.orange,
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.errorRed,
            size: 48,
          ),
          const SizedBox(height: 12),
          const Text(
            'Failed to load profile',
            style: TextStyle(color: AppColors.white, fontSize: 16),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () {
              setState(() => _loading = true);
              _loadProfile();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: Column(
          children: [
            _buildTabRow(),
            Expanded(child: _buildTabBody()),
          ],
        ),
      ),
    );
  }

  // ───────── Tab pill row ─────────
  Widget _buildTabRow() {
    final tabs = <_ProfileTab, String>{
      _ProfileTab.profile: 'Profile',
      _ProfileTab.myPlan: 'My Plan',
      _ProfileTab.subscriptions: 'Subscriptions',
      _ProfileTab.refer: 'Refer & Earn',
      _ProfileTab.advertise: 'Advertise',
      _ProfileTab.reminders: 'Reminders',
    };
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
        children: tabs.entries.map((entry) {
          final active = _tab == entry.key;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => _switchTab(entry.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                decoration: BoxDecoration(
                  gradient: active ? AppColors.buttonGradient : null,
                  color: active ? null : AppColors.inputFill,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: active
                        ? Colors.transparent
                        : AppColors.inputBorder,
                  ),
                  boxShadow: active
                      ? [
                          BoxShadow(
                            color: AppColors.orange.withValues(alpha: 0.4),
                            blurRadius: 14,
                            offset: const Offset(0, 5),
                          ),
                        ]
                      : null,
                ),
                alignment: Alignment.center,
                child: Text(
                  entry.value,
                  style: TextStyle(
                    color: active ? AppColors.white : AppColors.hintText,
                    fontSize: 13,
                    fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTabBody() {
    switch (_tab) {
      case _ProfileTab.profile:
        return _buildProfileTab();
      case _ProfileTab.myPlan:
        return _buildMyPlanTab();
      case _ProfileTab.subscriptions:
        return _buildSubscriptionsTab();
      case _ProfileTab.refer:
        return _buildReferTab();
      case _ProfileTab.advertise:
        return _buildAdvertiseTab();
      case _ProfileTab.reminders:
        return _buildRemindersTab();
    }
  }

  // ───────── Profile tab ─────────
  Widget _buildProfileTab() {
    final user = _user!;
    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: _loadProfile,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          children: [
            _buildIdentityCard(user),
            const SizedBox(height: 14),
            _buildStatusStrip(user),
            const SizedBox(height: 16),

            if (user.isCreator) ...[
              _buildVptBalanceCard(user),
              const SizedBox(height: 12),
            ],

            if (_reputation != null) ...[
              ReputationCard(reputation: _reputation!),
              const SizedBox(height: 12),
            ],

            if (_currencies.isNotEmpty) ...[
              _buildCurrencySelector(user),
              const SizedBox(height: 16),
            ],

            _MenuRow(
              icon: Icons.diamond_rounded,
              iconColor: const Color(0xFFFFC24B),
              label: 'My Plan',
              subtitle: user.hasActiveSubscription
                  ? user.subscriptionPlanDisplay
                  : 'No active plan',
              onTap: () => _switchTab(_ProfileTab.myPlan),
            ),
            _MenuRow(
              icon: Icons.card_membership_rounded,
              iconColor: AppColors.softBlue,
              label: 'My Subscriptions',
              subtitle: 'Channel subscriptions & billing',
              onTap: () => Navigator.pushNamed(context, '/my-subscriptions'),
            ),
            _MenuRow(
              icon: Icons.account_balance_wallet_rounded,
              iconColor: const Color(0xFF5FD39A),
              label: 'Digital Assets',
              subtitle: '${_formatVpt(user.vpt)} vPT',
              onTap: () => Navigator.pushNamed(context, '/digital-assets'),
            ),
            _MenuRow(
              icon: Icons.card_giftcard_rounded,
              iconColor: const Color(0xFFC0A4FF),
              label: 'Refer & Earn',
              subtitle: 'Invite friends, earn rewards',
              onTap: () => _switchTab(_ProfileTab.refer),
            ),
            _MenuRow(
              icon: Icons.campaign_rounded,
              iconColor: const Color(0xFFF1789A),
              label: 'Advertise',
              subtitle: 'Run ads on AfroVision',
              onTap: () => _switchTab(_ProfileTab.advertise),
            ),
            _MenuRow(
              icon: Icons.notifications_active_rounded,
              iconColor: AppColors.lightOrange,
              label: 'My Reminders',
              subtitle: 'Upcoming program alerts',
              onTap: () => _switchTab(_ProfileTab.reminders),
            ),
            _MenuRow(
              icon: Icons.bookmark_rounded,
              iconColor: const Color(0xFFFFD700),
              label: 'Saved Waves',
              onTap: () => Navigator.pushNamed(context, '/saved-waves'),
            ),
            _MenuRow(
              icon: Icons.pin_rounded,
              iconColor: const Color(0xFFFF8C42),
              label: 'My Personal Identifier Codes',
              onTap: () => Navigator.pushNamed(context, '/identifier-codes'),
            ),
            _MenuRow(
              icon: Icons.confirmation_number_rounded,
              iconColor: const Color(0xFF7FC4FF),
              label: 'My PICs',
              subtitle: 'Exclusive channel access codes',
              onTap: () => Navigator.pushNamed(context, '/my-pics'),
            ),
            _MenuRow(
              icon: Icons.qr_code_scanner_rounded,
              iconColor: const Color(0xFF7FC4FF),
              label: 'Connect TV',
              onTap: () => Navigator.pushNamed(context, '/tv-pairing'),
            ),
            if (user.role == 'creator')
              _MenuRow(
                icon: Icons.video_settings_rounded,
                iconColor: const Color(0xFFC0A4FF),
                label: 'Creator Studio',
                onTap: () => Navigator.pushNamed(context, '/creator-studio'),
              ),
            _MenuRow(
              icon: Icons.settings_rounded,
              iconColor: AppColors.hintText,
              label: 'Settings',
              onTap: () => Navigator.pushNamed(context, '/account-settings'),
            ),
            _MenuRow(
              icon: Icons.menu_book_rounded,
              iconColor: AppColors.hintText,
              label: 'Legal & Static Pages',
              onTap: () => Navigator.pushNamed(context, '/legal'),
            ),
            const SizedBox(height: 8),
            _MenuRow(
              icon: Icons.delete_forever_rounded,
              iconColor: AppColors.errorRed,
              label: 'Delete Account',
              destructive: true,
              onTap: () => Navigator.pushNamed(context, '/delete-account'),
            ),
            _MenuRow(
              icon: Icons.logout_rounded,
              iconColor: AppColors.errorRed,
              label: 'Logout',
              destructive: true,
              onTap: _logout,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIdentityCard(UserModel user) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      decoration: _premiumCard(radius: 20),
      child: Column(
        children: [
          Container(
            width: 96,
            height: 96,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [AppColors.orange, AppColors.lightOrange, Color(0xFFFFE3AE)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.orange.withValues(alpha: 0.35),
                  blurRadius: 22,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.darkBlue,
                gradient: (user.avatarUrl == null || user.avatarUrl!.isEmpty)
                    ? LinearGradient(
                        colors: [
                          AppColors.orange.withValues(alpha: 0.35),
                          AppColors.lightOrange.withValues(alpha: 0.18),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                image: (user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                    ? DecorationImage(
                        image: NetworkImage(user.avatarUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: (user.avatarUrl == null || user.avatarUrl!.isEmpty)
                  ? Center(
                      child: Text(
                        _avatarInitials(user),
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ReputationBadgeWidget(
                level: _reputation?.level ?? 0,
                size: 17,
                showTooltip: true,
              ),
              if ((_reputation?.level ?? 0) > 0) const SizedBox(width: 6),
              Flexible(
                child: Text(
                  user.name ?? 'No name set',
                  style: TextStyle(
                    color: user.name != null
                        ? AppColors.white
                        : AppColors.hintText,
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            user.email,
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.55),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              RoleBadge(
                role: user.role,
                isPremiumCreator:
                    user.hasActiveSubscription && user.isPremiumCreator,
                subscriptionPlan: user.subscriptionPlan,
              ),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/kyc'),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: _kycColor(user.kycStatus).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _kycColor(user.kycStatus).withValues(alpha: 0.4),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.verified_user_rounded,
                          size: 12, color: _kycColor(user.kycStatus)),
                      const SizedBox(width: 4),
                      Text(
                        'KYC ${user.kycStatus.toUpperCase()}',
                        style: TextStyle(
                          color: _kycColor(user.kycStatus),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusStrip(UserModel user) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
      decoration: _premiumCard(accent: AppColors.softBlue, radius: 16),
      child: Row(
        children: [
          Expanded(
            child: _statusField(
              'MEMBER SINCE',
              _formatDate(user.createdAt),
              color: AppColors.white,
            ),
          ),
          Container(
            width: 1,
            height: 30,
            color: Colors.white.withValues(alpha: 0.08),
          ),
          Expanded(
            child: _statusField(
              'PLAN STATUS',
              user.hasActiveSubscription
                  ? user.subscriptionStatus.toUpperCase()
                  : 'EXPIRED',
              color: user.hasActiveSubscription
                  ? AppColors.successGreen
                  : AppColors.errorRed,
            ),
          ),
          Container(
            width: 1,
            height: 30,
            color: Colors.white.withValues(alpha: 0.08),
          ),
          Expanded(
            child: _statusField(
              'EXPIRES',
              user.subscriptionExpiry != null
                  ? _formatDate(user.subscriptionExpiry!)
                  : '—',
              color: AppColors.lightOrange,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusField(String label, String value, {Color? color}) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.white.withValues(alpha: 0.4),
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 5),
        Text(
          value,
          style: TextStyle(
            color: color ?? AppColors.white,
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildVptBalanceCard(UserModel user) {
    final hasEnough = user.vpt >= 500;
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/digital-assets'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: _premiumCard(
          accent: hasEnough ? AppColors.successGreen : AppColors.orange,
          radius: 16,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.orange.withValues(alpha: 0.22),
                    AppColors.lightOrange.withValues(alpha: 0.08),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(
                Icons.account_balance_wallet_rounded,
                color: AppColors.lightOrange,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'vPT BALANCE',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.45),
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${_formatVpt(user.vpt)} vPT',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(
                    '≈ ₦${_formatVpt(user.vpt * 750)}',
                    style: TextStyle(
                      color: AppColors.lightOrange.withValues(alpha: 0.85),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: hasEnough
                    ? const Color(0xFF4CAF50).withValues(alpha: 0.1)
                    : AppColors.errorRed.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                hasEnough ? 'Edit Ready' : 'Low',
                style: TextStyle(
                  color: hasEnough
                      ? const Color(0xFF4CAF50)
                      : AppColors.errorRed,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatVpt(double amount) {
    final intAmount = amount.toInt();
    if (intAmount >= 1000) {
      final str = intAmount.toString();
      final buffer = StringBuffer();
      for (int i = 0; i < str.length; i++) {
        if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
        buffer.write(str[i]);
      }
      return buffer.toString();
    }
    return intAmount.toString();
  }

  Widget _buildCurrencySelector(UserModel user) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _premiumCard(accent: AppColors.softBlue, radius: 16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: AppColors.softBlue.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(
              Icons.currency_exchange_rounded,
              color: AppColors.softBlue,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Preferred Currency',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.lightBlue.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.3),
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: user.preferredCurrency,
                dropdownColor: AppColors.lightBlue,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: AppColors.orange,
                  size: 18,
                ),
                isDense: true,
                style: const TextStyle(
                  color: AppColors.orange,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
                items: _currencies.map((c) {
                  return DropdownMenuItem(
                    value: c.code,
                    child: Text('${c.symbol} ${c.code}'),
                  );
                }).toList(),
                onChanged: (code) async {
                  if (code == null || code == user.preferredCurrency) return;
                  try {
                    await CurrencyService.updatePreferredCurrency(code);
                    _loadProfile();
                  } catch (e) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          e.toString(),
                          style: const TextStyle(color: AppColors.white),
                        ),
                        backgroundColor: AppColors.errorRed.withValues(
                          alpha: 0.9,
                        ),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    );
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ───────── My Plan tab ─────────
  Widget _buildMyPlanTab() {
    final user = _user!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: _premiumCard(accent: AppColors.orange, radius: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        gradient: AppColors.buttonGradient,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.orange.withValues(alpha: 0.4),
                            blurRadius: 14,
                          ),
                        ],
                      ),
                      child: const Icon(Icons.diamond_rounded,
                          color: AppColors.white, size: 18),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Your Current Plan',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    RoleBadge(
                      role: user.role,
                      isPremiumCreator:
                          user.hasActiveSubscription && user.isPremiumCreator,
                      subscriptionPlan: user.subscriptionPlan,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _planRow('Status', user.hasActiveSubscription
                    ? user.subscriptionStatus.toUpperCase()
                    : 'EXPIRED'),
                _planRow('Plan Type',
                    user.hasActiveSubscription ? user.subscriptionPlanDisplay : 'NONE'),
                _planRow(
                  'Renewal Date',
                  user.subscriptionExpiry != null
                      ? _formatDate(user.subscriptionExpiry!)
                      : '—',
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () async {
                    final result = await Navigator.pushNamed(context, '/plans');
                    if (result == true) _loadProfile();
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.swap_horiz_rounded,
                            color: AppColors.white, size: 18),
                        SizedBox(width: 8),
                        Text(
                          'Manage Plan',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Text(
            'AVAILABLE PLANS',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.4),
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 12),
          if (_plansLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.orange),
              ),
            )
          else if (_plans == null || _plans!.isEmpty)
            const Text(
              'Plans are unavailable right now.',
              style: TextStyle(color: AppColors.hintText, fontSize: 13),
            )
          else
            ..._plans!.map((plan) {
              final isCurrent = user.hasActiveSubscription &&
                  user.subscriptionPlan == plan.id;
              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: _premiumCard(
                  accent: isCurrent ? AppColors.orange : AppColors.hintText,
                  radius: 14,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            plan.name,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            plan.price > 0
                                ? '${plan.currency} ${plan.price.toStringAsFixed(0)}/mo'
                                : 'Free',
                            style: const TextStyle(
                              color: AppColors.hintText,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (isCurrent)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.orange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'Current',
                          style: TextStyle(
                            color: AppColors.orange,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _planRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.hintText, fontSize: 12),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ───────── Subscriptions tab (summary + deep link) ─────────
  Widget _buildSubscriptionsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'CHANNEL SUBSCRIPTIONS',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.4),
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 12),
          if (_channelSubsLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.orange),
              ),
            )
          else if (_channelSubs == null || _channelSubs!.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: _premiumCard(accent: AppColors.hintText, radius: 14),
              child: const Text(
                'No active channel subscriptions yet.',
                style: TextStyle(color: AppColors.hintText, fontSize: 13),
              ),
            )
          else
            ..._channelSubs!.take(3).map((sub) => Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(16),
                  decoration: _premiumCard(
                    accent: sub.isPremium ? AppColors.orange : AppColors.successGreen,
                    radius: 14,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              sub.channelName,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              sub.nextBilling != null
                                  ? 'Renews ${_formatDate(DateTime.fromMillisecondsSinceEpoch(sub.nextBilling!).toIso8601String())}'
                                  : 'No renewal date',
                              style: TextStyle(
                                color: AppColors.white.withValues(alpha: 0.42),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: sub.isPremium
                              ? AppColors.orange.withValues(alpha: 0.15)
                              : AppColors.successGreen.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: sub.isPremium
                                ? AppColors.orange.withValues(alpha: 0.4)
                                : AppColors.successGreen.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Text(
                          sub.isPremium ? 'EXCLUSIVE' : 'FREE',
                          style: TextStyle(
                            color: sub.isPremium
                                ? AppColors.orange
                                : AppColors.successGreen,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                )),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/my-subscriptions'),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.softBlue.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.softBlue.withValues(alpha: 0.35),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'See All Subscriptions',
                    style: TextStyle(
                      color: AppColors.softBlue,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(Icons.arrow_forward_rounded,
                      color: AppColors.softBlue, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ───────── Refer & Earn tab (summary + deep link) ─────────
  Widget _buildReferTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_referralLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.orange),
              ),
            )
          else if (_referralDashboard == null)
            const Text(
              'Referral data is unavailable right now.',
              style: TextStyle(color: AppColors.hintText, fontSize: 13),
            )
          else ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF8B5CF6), Color(0xFFC0A4FF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.4),
                    blurRadius: 26,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.card_giftcard_rounded,
                        color: AppColors.white, size: 22),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'YOUR REFERRAL CODE',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.85),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _referralDashboard!.referralCode,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _statTile(
                    'Invites',
                    '${_referralDashboard!.invitedCount}',
                    Icons.people_rounded,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _statTile(
                    'Cash Earned',
                    '₦${_formatVpt(_referralDashboard!.totalEarningsNgn)}',
                    Icons.payments_rounded,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _statTile(
                    'vPT Earned',
                    _formatVpt(_referralDashboard!.totalEarningsVptUnits),
                    Icons.account_balance_wallet_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: _premiumCard(accent: const Color(0xFFC0A4FF), radius: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'REFERRAL LEVELS',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.4),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.7,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 10,
                    runSpacing: 8,
                    children: _referralDashboard!.levelDistribution.map((lvl) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 11, vertical: 7),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              const Color(0xFF8B5CF6).withValues(alpha: 0.24),
                              const Color(0xFFC0A4FF).withValues(alpha: 0.10),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFFC0A4FF).withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          'L${lvl.level} · ${lvl.percentage}%',
                          style: const TextStyle(
                            color: Color(0xFFD5C4FF),
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/referral'),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.successGreen.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.successGreen.withValues(alpha: 0.35),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'View Full Referral Dashboard',
                    style: TextStyle(
                      color: AppColors.successGreen,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(Icons.arrow_forward_rounded,
                      color: AppColors.successGreen, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statTile(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: _premiumCard(accent: const Color(0xFFC0A4FF), radius: 14),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: const Color(0xFFC0A4FF).withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: const Color(0xFFC0A4FF), size: 16),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.4),
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ───────── Advertise tab (entry card + deep link) ─────────
  Widget _buildAdvertiseTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: _premiumCard(accent: const Color(0xFFF1789A), radius: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFFF1789A).withValues(alpha: 0.3),
                            const Color(0xFFF1789A).withValues(alpha: 0.1),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: const Icon(
                        Icons.campaign_rounded,
                        color: Color(0xFFF1789A),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Text(
                        'Advertise on AfroVision',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Submit ads, track analytics, and manage your campaigns from the advertiser dashboard.',
                  style: TextStyle(color: AppColors.hintText, fontSize: 13),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/advertiser'),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFF1789A), Color(0xFFFFA0BC)],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFF1789A).withValues(alpha: 0.35),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Open Advertiser Dashboard',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(width: 6),
                        Icon(Icons.arrow_forward_rounded,
                            color: AppColors.white, size: 16),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ───────── Reminders tab (embedded) ─────────
  Widget _buildRemindersTab() {
    if (_remindersLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.orange),
      );
    }
    if (_remindersError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.errorRed, size: 48),
              const SizedBox(height: 16),
              Text(
                _remindersError!,
                style: const TextStyle(color: AppColors.errorRed, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              GestureDetector(
                onTap: _loadReminders,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Retry',
                    style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    final reminders = _reminders ?? [];
    if (reminders.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.notifications_none_rounded, color: AppColors.hintText, size: 56),
            SizedBox(height: 16),
            Text(
              'No reminders set',
              style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w700),
            ),
            SizedBox(height: 6),
            Text(
              'Tap the bell icon on any upcoming program\nto set a reminder',
              style: TextStyle(color: AppColors.hintText, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: () {
        _reminders = null;
        return _loadReminders();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: GestureDetector(
              onTap: _clearAllReminders,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: AppColors.errorRed.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
                ),
                child: const Text(
                  'Clear All',
                  style: TextStyle(color: AppColors.errorRed, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),
          ...reminders.map((reminder) {
            final title = reminder['video_title'] as String? ?? 'Unknown Program';
            final channelName = reminder['channel_name'] as String? ?? 'Unknown Channel';
            final sendAtMs = (reminder['send_at'] as num?)?.toInt() ?? 0;
            final programId = reminder['program_id'] as String? ?? '';
            final sendAt = DateTime.fromMillisecondsSinceEpoch(sendAtMs);
            final isPast = sendAt.isBefore(DateTime.now());
            final timeStr =
                '${sendAt.hour.toString().padLeft(2, '0')}:${sendAt.minute.toString().padLeft(2, '0')}';
            final dateStr = '${sendAt.day}/${sendAt.month}/${sendAt.year}';
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(16),
              decoration: _premiumCard(
                accent: isPast ? AppColors.hintText : AppColors.lightOrange,
                radius: 14,
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isPast
                            ? [
                                AppColors.hintText.withValues(alpha: 0.2),
                                AppColors.hintText.withValues(alpha: 0.06),
                              ]
                            : [
                                AppColors.lightOrange.withValues(alpha: 0.3),
                                AppColors.orange.withValues(alpha: 0.1),
                              ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: Icon(
                      isPast
                          ? Icons.notifications_off_outlined
                          : Icons.notifications_active,
                      color: isPast ? AppColors.hintText : AppColors.lightOrange,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            color: isPast ? AppColors.hintText : AppColors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          channelName,
                          style: const TextStyle(color: AppColors.goldText, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        timeStr,
                        style: TextStyle(
                          color: isPast ? AppColors.hintText : AppColors.lightOrange,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        dateStr,
                        style: const TextStyle(color: AppColors.goldText, fontSize: 10),
                      ),
                    ],
                  ),
                  const SizedBox(width: 10),
                  GestureDetector(
                    onTap: () => _removeReminder(programId),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.errorRed.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.close, color: AppColors.errorRed, size: 16),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  String _avatarInitials(UserModel user) {
    if (user.name != null && user.name!.isNotEmpty) {
      final parts = user.name!.trim().split(' ');
      if (parts.length >= 2) {
        return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    return user.email[0].toUpperCase();
  }

  Color _kycColor(String status) {
    switch (status) {
      case 'verified':
        return const Color(0xFF4CAF50);
      case 'pending':
        return AppColors.lightOrange;
      default:
        return AppColors.hintText;
    }
  }

  String _formatDate(String isoDate) {
    final date = DateTime.tryParse(isoDate);
    if (date == null) return isoDate;
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
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}

/// Reusable tappable menu row used by the Profile tab's plain menu list:
/// icon + label (+ optional subtitle) + chevron.
class _MenuRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final bool destructive;

  const _MenuRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    this.subtitle,
    required this.onTap,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final labelColor = destructive ? AppColors.errorRed : AppColors.white;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 14),
        decoration: destructive
            ? BoxDecoration(
                color: AppColors.errorRed.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.25)),
              )
            : _premiumCard(accent: iconColor, radius: 14),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    iconColor.withValues(alpha: 0.28),
                    iconColor.withValues(alpha: 0.10),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: iconColor, size: 19),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      color: labelColor,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.42),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: destructive
                  ? AppColors.errorRed
                  : AppColors.white.withValues(alpha: 0.28),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
