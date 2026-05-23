import 'dart:async';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/profile_service.dart';
import '../services/home_service.dart';
import '../models/user_model.dart';
import '../../notifications/services/notification_inbox_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../../../core/widgets/role_badge.dart';
import '../../broadcast/widgets/banner_ad_widget.dart';
import '../../../core/utils/app_rating.dart';
import '../../../core/utils/kyc_gender_checker.dart';
import '../../../core/services/notification_service.dart';
import '../../promo/widgets/promo_modal_dialog.dart';
import '../../reputation/models/reputation_model.dart';
import '../../reputation/services/reputation_service.dart';
import '../../../core/services/watch_history_service.dart';
import '../../subscription/models/channel_subscription_model.dart';
import '../../subscription/services/channel_subscription_service.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  UserModel? _user;
  HomeStats? _stats;
  ReputationModel? _reputation;
  bool _loading = true;
  int _subscriptionCount = 0;
  List<WatchHistoryEntry> _watchHistory = [];
  List<ChannelModel> _allChannels = [];
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;
  late PageController _promoPageController;
  Timer? _promoTimer;
  int _promoPage = 0;
  int _unreadNotifications = 0;
  late ScrollController _recentScrollController;
  Timer? _recentScrollTimer;
  List<String> _marqueeTopics = [];
  late ScrollController _marqueeController;
  Timer? _marqueeTimer;

  @override
  void initState() {
    super.initState();
    _recentScrollController = ScrollController();
    _marqueeController = ScrollController();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _promoPageController = PageController(viewportFraction: 0.88);
    _loadData();
    _requestNotificationPermission();

    // Listen for foreground push messages to auto-refresh unread count
    NotificationService.onUnreadCountChanged = _refreshUnreadCount;
  }

  @override
  void dispose() {
    NotificationService.onUnreadCountChanged = null;
    _animController.dispose();
    _promoPageController.dispose();
    _promoTimer?.cancel();
    _recentScrollTimer?.cancel();
    _recentScrollController.dispose();
    _marqueeTimer?.cancel();
    _marqueeController.dispose();
    super.dispose();
  }

  /// Request notification permission on first visit, with rationale dialog.
  Future<void> _requestNotificationPermission() async {
    final alreadyGranted = await NotificationService.isPermissionGranted();
    if (alreadyGranted) return;
    if (!mounted) return;
    // Small delay so the home screen settles before showing the dialog
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;
    // requestPermission() calls registerToken() internally on grant
    await NotificationService.requestPermission(context);
  }

  /// Refresh just the unread count + app icon badge (called from FCM listener).
  Future<void> _refreshUnreadCount() async {
    try {
      final count = await NotificationInboxService.getUnreadCount();
      if (!mounted) return;
      setState(() => _unreadNotifications = count);
      NotificationService.updateAppBadge(count);
    } catch (_) {}
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        ProfileService.getProfile(),
        HomeService.getStats().catchError(
          (_) => HomeStats(
            totalVpt: 0,
            totalNgn: 0,
            vptRate: 750,
            nairaEquivalent: 0,
            totalDistributedVpt: 0,
            totalDistributedNgn: 0,
            totalBeneficiaries: 0,
            recentChannels: [],
            promotedChannels: [],
            totalChannels: 0,
            totalMembers: 0,
          ),
        ),
        NotificationInboxService.getUnreadCount().catchError((_) => 0),
        ReputationService.getMyReputation()
            .then<ReputationModel?>((v) => v)
            .catchError((_) => null),
      ]);
      if (!mounted) return;
      setState(() {
        _user = results[0] as UserModel;
        _stats = results[1] as HomeStats;
        _unreadNotifications = results[2] as int;
        _reputation = results[3] as ReputationModel?;
        _loading = false;
      });
      // Sync app icon badge with current unread count
      NotificationService.updateAppBadge(_unreadNotifications);
      _animController.forward();
      _startPromoAutoScroll();
      _startRecentAutoScroll();

      // Load watch history & subscription count (non-blocking)
      _loadWatchHistory();
      _loadSubscriptionCount();
      _loadMarquee();
      _loadAllChannels();
      // Check if we should show the rating dialog
      if (context.mounted) AppRating.checkAndPrompt(context);
      // Check if user has missing KYC gender to prompt for completion
      if (context.mounted) KycGenderChecker.checkAndPrompt(context);
      // Show promo modal if available (once per session)
      if (context.mounted) PromoModalDialog.checkAndShow(context);
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _startPromoAutoScroll() {
    _promoTimer?.cancel();
    final promoted = _stats?.promotedChannels ?? [];
    final int count;
    if (promoted.isNotEmpty) {
      count = promoted.length;
    } else {
      final withBanner = _allChannels
          .where((c) => (c.bannerUrl ?? '').isNotEmpty)
          .take(8)
          .toList();
      count =
          (withBanner.isNotEmpty ? withBanner : _allChannels.take(8).toList())
              .length;
    }
    if (count <= 1) return;
    _promoTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted) return;
      _promoPage = (_promoPage + 1) % count;
      _promoPageController.animateToPage(
        _promoPage,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  void _startRecentAutoScroll() {
    final recentCount = _stats?.recentChannels.length ?? 0;
    final allCount = _allChannels.length > 15 ? 15 : _allChannels.length;
    final count = recentCount > 0 ? recentCount : allCount;
    if (count <= 2) return;
    _recentScrollTimer?.cancel();
    _recentScrollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted || !_recentScrollController.hasClients) return;
      final max = _recentScrollController.position.maxScrollExtent;
      final current = _recentScrollController.offset;
      final next = current - 160;
      _recentScrollController.animateTo(
        next <= 0 ? max : next,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
      );
    });
  }

  Future<void> _loadWatchHistory() async {
    try {
      final history = await WatchHistoryService.getHistory();
      if (mounted) {
        setState(() => _watchHistory = history);
      }
    } catch (_) {
      // silent
    }
  }

  Future<void> _loadSubscriptionCount() async {
    try {
      final result = await ChannelSubscriptionService.getMine();
      if (mounted && result['success'] == true) {
        final subs = result['subscriptions'] as List<dynamic>? ?? [];
        final activeCount = subs
            .whereType<ChannelSubscriptionModel>()
            .where((s) => s.isActive)
            .length;
        setState(() => _subscriptionCount = activeCount);
      }
    } catch (_) {
      // silent
    }
  }

  Future<void> _loadMarquee() async {
    try {
      final topics = await HomeService.getMarqueeTopics();
      if (!mounted) return;
      if (topics.isNotEmpty) {
        setState(() => _marqueeTopics = topics);
        _startMarqueeScroll();
      }
    } catch (_) {
      // silent — marquee is non-critical
    }
  }

  Future<void> _loadAllChannels() async {
    try {
      final channels = await ChannelService.getPublicChannels();
      if (!mounted) return;
      setState(() => _allChannels = channels);
      // Restart auto-scrollers now that fallback channels are available
      _startPromoAutoScroll();
      _startRecentAutoScroll();
    } catch (_) {
      // silent — used only as fallback for sliders
    }
  }

  void _startMarqueeScroll() {
    _marqueeTimer?.cancel();
    _marqueeTimer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (!mounted || !_marqueeController.hasClients) return;
      final max = _marqueeController.position.maxScrollExtent;
      final current = _marqueeController.offset;
      if (current >= max) {
        _marqueeController.jumpTo(0);
      } else {
        _marqueeController.jumpTo(current + 0.8);
      }
    });
  }

  Future<void> _logout() async {
    await AuthService.logout();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }

  Future<void> _goToProfile() async {
    final result = await Navigator.pushNamed(context, '/profile');
    if (result == true) _loadData();
  }

  Future<void> _goToNotifications() async {
    await Navigator.pushNamed(context, '/notifications');
    if (!mounted) return;
    _loadData();
  }

  String _formatNumber(double n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toStringAsFixed(n == n.roundToDouble() ? 0 : 2);
  }

  String _formatNaira(double n) {
    final str = n.toStringAsFixed(0);
    final buffer = StringBuffer();
    int count = 0;
    for (int i = str.length - 1; i >= 0; i--) {
      buffer.write(str[i]);
      count++;
      if (count % 3 == 0 && i > 0) buffer.write(',');
    }
    return '₦${buffer.toString().split('').reversed.join()}';
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
              _buildTopBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.orange,
                        backgroundColor: AppColors.inputFill,
                        onRefresh: _loadData,
                        child: FadeTransition(
                          opacity: _fadeAnim,
                          child: SlideTransition(
                            position: _slideAnim,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.only(bottom: 40),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildCommunityPoolBanner(),
                                  _buildChallengeBanner(),
                                  if (_marqueeTopics.isNotEmpty)
                                    _buildMarqueeTicker(),
                                  if (_user != null &&
                                      _user!.kycStatus != 'verified' &&
                                      _user!.kycStatus != 'pending')
                                    _buildKycAlert(),
                                  const SizedBox(height: 22),
                                  if ((_stats?.promotedChannels.isNotEmpty ??
                                          false) ||
                                      _allChannels.isNotEmpty) ...[
                                    _buildFeaturedChannelsSlider(),
                                    const SizedBox(height: 16),
                                    _buildThemeDivider(),
                                    const SizedBox(height: 16),
                                  ],
                                  _buildMySubscriptionsCard(),
                                  const SizedBox(height: 16),
                                  _buildThemeDivider(),
                                  const SizedBox(height: 16),
                                  if ((_watchHistory.isNotEmpty)) ...[
                                    _buildRecentlyViewed(),
                                    const SizedBox(height: 16),
                                    _buildThemeDivider(),
                                    const SizedBox(height: 16),
                                  ],
                                  if ((_stats?.recentChannels.isNotEmpty ??
                                          false) ||
                                      _allChannels.isNotEmpty) ...[
                                    _buildPublicChannelsSlider(),
                                    const SizedBox(height: 16),
                                    _buildThemeDivider(),
                                    const SizedBox(height: 16),
                                  ],
                                  _buildActionCards(),
                                  const SizedBox(height: 16),
                                  _buildThemeDivider(),
                                  const SizedBox(height: 24),
                                  _buildAdvertsSection(),
                                  const SizedBox(height: 16),
                                  _buildThemeDivider(),
                                  const SizedBox(height: 24),
                                  _buildTwoColumnSection(),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ───────── TOP BAR ─────────
  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome back,',
                  style: TextStyle(color: AppColors.lightOrange, fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(
                  _user?.name ?? _user?.email ?? 'User',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (_user != null) ...[
                  const SizedBox(height: 5),
                  RoleBadge(
                    role: _user!.role,
                    isPremiumCreator: _user!.isPremiumCreator,
                    subscriptionPlan: _user!.subscriptionPlan,
                  ),
                ],
                if (_reputation != null) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.cardBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.inputBorder.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('⭐', style: TextStyle(fontSize: 14)),
                        const SizedBox(width: 4),
                        Text(
                          _formatNumber(_reputation!.totalReps),
                          style: const TextStyle(
                            color: AppColors.lightOrange,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '· ${_reputation!.levelName}',
                          style: TextStyle(
                            color: AppColors.hintText,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          _topBarBtn(
            Icons.notifications_rounded,
            _goToNotifications,
            badgeCount: _unreadNotifications,
          ),
          const SizedBox(width: 8),
          _buildAvatarButton(),
          const SizedBox(width: 8),
          _topBarBtn(Icons.logout_rounded, _logout),
        ],
      ),
    );
  }

  Widget _topBarBtn(IconData icon, VoidCallback onTap, {int badgeCount = 0}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.inputBorder),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Padding(
              padding: const EdgeInsets.all(10),
              child: Icon(icon, color: AppColors.orange, size: 20),
            ),
            if (badgeCount > 0)
              Positioned(
                right: -4,
                top: -4,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.orange,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    badgeCount > 99 ? '99+' : '$badgeCount',
                    style: const TextStyle(
                      color: AppColors.darkBlue,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarButton() {
    final url = _user?.avatarUrl;
    final initial = (_user?.name ?? _user?.email ?? 'U')[0].toUpperCase();
    return GestureDetector(
      onTap: _goToProfile,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.lightOrange, width: 1.5),
          image: (url != null && url.isNotEmpty)
              ? DecorationImage(image: NetworkImage(url), fit: BoxFit.cover)
              : null,
          color: (url == null || url.isEmpty) ? AppColors.inputFill : null,
        ),
        child: (url == null || url.isEmpty)
            ? Center(
                child: Text(
                  initial,
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            : null,
      ),
    );
  }

  // ───────── COMMUNITY POOL BANNER ─────────
  Widget _buildCommunityPoolBanner() {
    final pool = _stats;
    final vpt = pool?.totalVpt ?? 0;
    final naira = pool?.nairaEquivalent ?? 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            colors: [
              const Color(0xFF0E1A50),
              AppColors.darkBlue.withValues(alpha: 0.95),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(
            color: AppColors.lightOrange.withValues(alpha: 0.25),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.lightOrange.withValues(alpha: 0.06),
              blurRadius: 20,
              spreadRadius: 2,
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.account_balance_rounded,
                    color: AppColors.lightOrange,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Community Pool',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Color(0xFF4CAF50),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        'LIVE',
                        style: TextStyle(
                          color: Color(0xFF4CAF50),
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // vPT amount
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${_formatNumber(vpt)} vPT',
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(width: 10),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '(${_formatNaira(naira)})',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  '1 vPT = ₦${pool?.vptRate ?? 750}',
                  style: TextStyle(color: AppColors.white, fontSize: 11),
                ),
                const Spacer(),
                Text(
                  '${_stats?.totalMembers ?? 0} members · ${_stats?.totalChannels ?? 0} channels',
                  style: TextStyle(color: AppColors.white, fontSize: 10),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.lightOrange.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.lightOrange.withValues(alpha: 0.12),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          '${_formatNumber(pool?.totalDistributedVpt ?? 0)} vPT',
                          style: const TextStyle(
                            color: AppColors.lightOrange,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '(${_formatNaira(pool?.totalDistributedNgn ?? 0)})',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 10,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Distributed',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 36,
                    color: AppColors.lightOrange.withValues(alpha: 0.15),
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          '${pool?.totalBeneficiaries ?? 0}',
                          style: const TextStyle(
                            color: AppColors.lightOrange,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Beneficiaries',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ───────── CHALLENGE BANNER ─────────
  Widget _buildChallengeBanner() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: GestureDetector(
        onTap: () => Navigator.pushNamed(context, '/challenge'),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              colors: [
                AppColors.orange.withValues(alpha: 0.22),
                AppColors.lightBlue.withValues(alpha: 0.5),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(color: AppColors.orange.withValues(alpha: 0.3)),
            boxShadow: [
              BoxShadow(
                color: AppColors.orange.withValues(alpha: 0.08),
                blurRadius: 18,
                spreadRadius: 1,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.emoji_events_rounded,
                  color: AppColors.orange,
                  size: 26,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'AfroVision Challenge',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Auditions open \u2022 Tap to learn more',
                      style: TextStyle(
                        color: AppColors.lightOrange,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: AppColors.orange,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Join',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ───────── MARQUEE TICKER ─────────
  Widget _buildMarqueeTicker() {
    final text = _marqueeTopics.join('   •   ');
    // Duplicate for seamless scrolling
    final fullText = '$text   •   $text';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
      child: Container(
        height: 32,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: AppColors.darkBlue.withValues(alpha: 0.7),
          border: Border.all(color: AppColors.orange.withValues(alpha: 0.15)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SingleChildScrollView(
            controller: _marqueeController,
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Text(
                fullText,
                style: TextStyle(
                  color: AppColors.lightOrange.withValues(alpha: 0.85),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.3,
                ),
                maxLines: 1,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ───────── KYC ALERT ─────────
  Widget _buildKycAlert() {
    final isRejected = _user?.kycStatus == 'rejected';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: GestureDetector(
        onTap: () => Navigator.pushNamed(context, '/kyc'),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: isRejected
                ? Colors.red.withValues(alpha: 0.1)
                : AppColors.orange.withValues(alpha: 0.1),
            border: Border.all(
              color: isRejected
                  ? Colors.red.withValues(alpha: 0.25)
                  : AppColors.orange.withValues(alpha: 0.25),
            ),
          ),
          child: Row(
            children: [
              Icon(
                isRejected
                    ? Icons.warning_amber_rounded
                    : Icons.verified_user_outlined,
                color: isRejected ? Colors.red[400] : AppColors.orange,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  isRejected
                      ? 'KYC rejected. Tap to re-submit.'
                      : 'Complete KYC to unlock all features',
                  style: TextStyle(
                    color: isRejected ? Colors.red[300] : AppColors.lightOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: isRejected ? Colors.red : AppColors.orange,
                ),
                child: Text(
                  isRejected ? 'Re-submit' : 'Complete',
                  style: const TextStyle(
                    color: AppColors.darkBlue,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ───────── PROMOTED CHANNELS SLIDER ─────────
  Widget _buildFeaturedChannelsSlider() {
    // Build unified list: prefer promoted channels, fall back to channels with
    // banners, then any public channels
    final promoted = _stats?.promotedChannels ?? [];
    List<PromotedChannel> items;
    if (promoted.isNotEmpty) {
      items = promoted;
    } else {
      final withBanner = _allChannels
          .where((c) => (c.bannerUrl ?? '').isNotEmpty)
          .take(8)
          .toList();
      final source = withBanner.isNotEmpty
          ? withBanner
          : _allChannels.take(8).toList();
      items = source
          .map(
            (ch) => PromotedChannel(
              id: ch.id,
              name: ch.name,
              category: ch.category,
              channelNumber: ch.channelNumber,
              logoUrl: ch.logoUrl,
              bannerUrl: ch.bannerUrl,
            ),
          )
          .toList();
    }
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _sectionLabel(
            'FEATURED CHANNELS',
            Icons.featured_play_list_rounded,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 130,
          child: PageView.builder(
            controller: _promoPageController,
            itemCount: items.length,
            onPageChanged: (i) => setState(() => _promoPage = i),
            itemBuilder: (context, index) {
              final ch = items[index];
              return GestureDetector(
                onTap: () async {
                  await Navigator.pushNamed(
                    context,
                    '/channel-player',
                    arguments: ch.id,
                  );
                  _loadData();
                },
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppColors.lightOrange.withValues(alpha: 0.3),
                    ),
                    image: (ch.bannerUrl != null && ch.bannerUrl!.isNotEmpty)
                        ? DecorationImage(
                            image: NetworkImage(
                              AppConfig.mediaUrl(ch.bannerUrl!),
                            ),
                            fit: BoxFit.cover,
                          )
                        : null,
                    gradient: (ch.bannerUrl == null || ch.bannerUrl!.isEmpty)
                        ? LinearGradient(
                            colors: [
                              AppColors.lightBlue.withValues(alpha: 0.5),
                              AppColors.darkBlue,
                            ],
                          )
                        : null,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              AppColors.darkBlue.withValues(alpha: 0.85),
                            ],
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 12,
                        left: 14,
                        right: 14,
                        child: Row(
                          children: [
                            if (ch.logoUrl != null && ch.logoUrl!.isNotEmpty)
                              Container(
                                width: 32,
                                height: 32,
                                margin: const EdgeInsets.only(right: 10),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: AppColors.lightOrange.withValues(
                                      alpha: 0.5,
                                    ),
                                  ),
                                  image: DecorationImage(
                                    image: NetworkImage(
                                      AppConfig.mediaUrl(ch.logoUrl!),
                                    ),
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    ch.name,
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (ch.category != null)
                                    Text(
                                      ch.category!,
                                      style: const TextStyle(
                                        color: AppColors.lightOrange,
                                        fontSize: 11,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Positioned(
                        top: 8,
                        right: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.orange.withValues(alpha: 0.85),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'FEATURED',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        if (items.length > 1) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(items.length, (i) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: i == _promoPage ? 20 : 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(
                  color: i == _promoPage
                      ? AppColors.orange
                      : AppColors.goldText,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }

  // ───────── PUBLIC CHANNELS SLIDER ─────────
  Widget _buildPublicChannelsSlider() {
    // Use recent channels from stats; fall back to all loaded channels
    final recentList = _stats?.recentChannels ?? [];

    final int itemCount;
    if (recentList.isNotEmpty) {
      itemCount = recentList.length;
    } else {
      itemCount = _allChannels.length > 15 ? 15 : _allChannels.length;
    }
    if (itemCount == 0) return const SizedBox.shrink();

    String getId(int i) =>
        recentList.isNotEmpty ? recentList[i].id : _allChannels[i].id;
    String getName(int i) =>
        recentList.isNotEmpty ? recentList[i].name : _allChannels[i].name;
    String? getLogoUrl(int i) =>
        recentList.isNotEmpty ? recentList[i].logoUrl : _allChannels[i].logoUrl;
    String? getCategory(int i) => recentList.isNotEmpty
        ? recentList[i].category
        : _allChannels[i].category;
    String getChannelNumber(int i) => recentList.isNotEmpty
        ? recentList[i].channelNumber
        : _allChannels[i].channelNumber;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _sectionLabel('PUBLIC CHANNELS', Icons.public_rounded),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 110,
          child: ListView.builder(
            controller: _recentScrollController,
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 18),
            itemCount: itemCount,
            itemBuilder: (context, index) {
              final channelId = getId(index);
              final channelName = getName(index);
              final logoUrl = getLogoUrl(index);
              final category = getCategory(index);
              final channelNumber = getChannelNumber(index);

              return GestureDetector(
                onTap: () async {
                  await Navigator.pushNamed(
                    context,
                    '/channel-player',
                    arguments: channelId,
                  );
                  _loadData();
                },
                child: Container(
                  width: 130,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.lightOrange.withValues(alpha: 0.2),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 6,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.orange.withValues(alpha: 0.12),
                          border: Border.all(
                            color: AppColors.lightOrange.withValues(alpha: 0.3),
                            width: 1.5,
                          ),
                          image: (logoUrl != null && logoUrl.isNotEmpty)
                              ? DecorationImage(
                                  image: NetworkImage(
                                    AppConfig.mediaUrl(logoUrl),
                                  ),
                                  fit: BoxFit.cover,
                                )
                              : null,
                        ),
                        child: (logoUrl == null || logoUrl.isEmpty)
                            ? const Icon(
                                Icons.live_tv_rounded,
                                color: AppColors.orange,
                                size: 20,
                              )
                            : null,
                      ),
                      const SizedBox(height: 8),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          channelName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        (category != null && category.isNotEmpty)
                            ? category
                            : '#$channelNumber',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.lightOrange.withValues(alpha: 0.7),
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ───────── 6 ACTION CARDS ─────────
  Widget _buildActionCards() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          // Row 1
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  icon: Icons.live_tv_rounded,
                  label: 'Browse\nChannels',
                  onTap: () => Navigator.pushNamed(context, '/channels'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.dialpad_rounded,
                  label: 'Channel\nNumber',
                  onTap: () => Navigator.pushNamed(context, '/channel-access'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.video_settings_rounded,
                  label: 'Creator\nStudio',
                  onTap: () => Navigator.pushNamed(context, '/creator-studio'),
                  locked:
                      _user != null &&
                      _user!.role != 'creator' &&
                      _user!.role != 'admin',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Row 2
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  icon: Icons.campaign_rounded,
                  label: 'Advertise',
                  onTap: () => Navigator.pushNamed(context, '/advertiser'),
                  subtle: true,
                  accentColor: AppColors.orange,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.notifications_active_rounded,
                  label: 'My\nReminders',
                  onTap: () => Navigator.pushNamed(context, '/reminders'),
                  subtle: true,
                  accentColor: AppColors.lightOrange,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.account_balance_wallet_rounded,
                  label: 'Digital\nAssets',
                  onTap: () => Navigator.pushNamed(context, '/digital-assets'),
                  subtle: true,
                  accentColor: AppColors.lightOrange,
                ),
              ),
            ],
          ),
          // Admin Panel (admin only)
          if (_user != null && _user!.isAdmin) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _actionCard(
                    icon: Icons.admin_panel_settings_rounded,
                    label: 'Admin\nPanel',
                    onTap: () => Navigator.pushNamed(context, '/admin-panel'),
                    accentColor: AppColors.orange,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(child: SizedBox()),
                const SizedBox(width: 12),
                const Expanded(child: SizedBox()),
              ],
            ),
          ],
          // Subscribe button (subscription-aware)
          if (_user != null) ...[
            const SizedBox(height: 18),
            if (_user!.hasActiveSubscription)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.lightOrange, AppColors.orange],
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.workspace_premium_rounded,
                      color: AppColors.darkBlue,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      (_user!.subscriptionPlan ?? '').toLowerCase() == 'premium'
                          ? 'Premium Membership'
                          : 'Upgrade Now',
                      style: const TextStyle(
                        color: AppColors.darkBlue,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              )
            else
              GestureDetector(
                onTap: () async {
                  final result = await Navigator.pushNamed(context, '/plans');
                  if (result == true) _loadData();
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
                      Icon(
                        Icons.diamond_rounded,
                        color: AppColors.white,
                        size: 18,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Subscribe to a Plan',
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
        ],
      ),
    );
  }

  Widget _actionCard({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool locked = false,
    bool subtle = false,
    Color? accentColor,
  }) {
    final color = accentColor ?? AppColors.orange;
    return GestureDetector(
      onTap: locked ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: subtle
                ? AppColors.inputBorder
                : AppColors.lightOrange.withValues(alpha: 0.2),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                color: locked ? AppColors.goldText : color,
                size: 22,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: locked ? AppColors.goldText : AppColors.white,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                height: 1.3,
              ),
            ),
            if (locked) ...[
              const SizedBox(height: 4),
              Icon(Icons.lock_rounded, color: AppColors.goldText, size: 12),
            ],
          ],
        ),
      ),
    );
  }

  // ───────── ADVERTS SECTION ─────────
  Widget _buildAdvertsSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('SPOTLIGHT', Icons.campaign_rounded),
          const SizedBox(height: 10),
          // Live banner ad from ad system
          const Padding(
            padding: EdgeInsets.zero,
            child: BannerAdWidget(placement: 'home'),
          ),
          const SizedBox(height: 10),
          // Premium ad banners
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/advertiser'),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: [
                    AppColors.orange.withValues(alpha: 0.15),
                    AppColors.darkBlue.withValues(alpha: 0.9),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(
                  color: AppColors.orange.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.rocket_launch_rounded,
                      color: AppColors.orange,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Boost Your Channel',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Promote your content to thousands of viewers across Africa.',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 11,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.orange.withValues(alpha: 0.6),
                    size: 22,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Two smaller ad boxes
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/plans'),
                  child: _adBox(
                    icon: Icons.workspace_premium_rounded,
                    title: (_user?.hasActiveSubscription ?? false)
                        ? 'Premium Unlocked'
                        : 'Go Premium',
                    subtitle: (_user?.hasActiveSubscription ?? false)
                        ? '${_user!.subscriptionPlanDisplay} plan active'
                        : 'Unlock exclusive features',
                    color: AppColors.lightOrange,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/referral'),
                  child: _adBox(
                    icon: Icons.groups_rounded,
                    title: 'Refer & Earn',
                    subtitle: 'Earn vPT for invites',
                    color: const Color(0xFF4CAF50),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _adBox({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: TextStyle(color: AppColors.white, fontSize: 10),
          ),
        ],
      ),
    );
  }

  // ───────── TWO COLUMN SECTION ─────────
  Widget _buildTwoColumnSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left: Updates & Announcements
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.campaign_rounded,
                        color: AppColors.orange.withValues(alpha: 0.8),
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Updates',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _announcementItem(
                    'Platform Launch',
                    'AfroVision is live! Start creating & exploring channels.',
                    Icons.celebration_rounded,
                    AppColors.lightOrange,
                  ),
                  const SizedBox(height: 10),
                  _announcementItem(
                    'Creator Program',
                    'Apply to become a verified creator today.',
                    Icons.verified_rounded,
                    const Color(0xFF4CAF50),
                  ),
                  const SizedBox(height: 10),
                  _announcementItem(
                    'Community Rules',
                    'Review guidelines to keep our space safe.',
                    Icons.shield_rounded,
                    AppColors.orange,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Right: Quick Stats & Highlights
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.insights_rounded,
                        color: AppColors.lightOrange.withValues(alpha: 0.8),
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Highlights',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _highlightStat(
                    Icons.people_rounded,
                    'Members',
                    '${_stats?.totalMembers ?? 0}',
                  ),
                  const SizedBox(height: 10),
                  _highlightStat(
                    Icons.tv_rounded,
                    'Channels',
                    '${_stats?.totalChannels ?? 0}',
                  ),
                  const SizedBox(height: 10),
                  _highlightStat(
                    Icons.toll_rounded,
                    'Your vPT',
                    _formatNumber(_user?.vpt ?? 0),
                  ),
                  const SizedBox(height: 10),
                  _highlightStat(
                    Icons.star_rounded,
                    'Plan',
                    _user?.subscriptionPlanDisplay ?? 'NONE',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _announcementItem(
    String title,
    String body,
    IconData icon,
    Color color,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(7),
          ),
          child: Icon(icon, color: color, size: 12),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                body,
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 9,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _highlightStat(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, color: AppColors.lightOrange, size: 14),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: TextStyle(color: AppColors.white, fontSize: 10),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  // ───────── MY SUBSCRIPTIONS CARD ─────────
  Widget _buildMySubscriptionsCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: () => Navigator.pushNamed(
          context,
          '/my-subscriptions',
        ).then((_) => _loadSubscriptionCount()),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.orange.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.subscriptions_outlined,
                  color: AppColors.orange,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'My Subscriptions',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$_subscriptionCount active subscription${_subscriptionCount == 1 ? '' : 's'}',
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.55),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white54, size: 22),
            ],
          ),
        ),
      ),
    );
  }

  // ───────── RECENTLY VIEWED ─────────
  Widget _buildRecentlyViewed() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _sectionLabel('Recently Viewed', Icons.history),
              GestureDetector(
                onTap: () => WatchHistoryService.clear().then(
                  (_) => _loadWatchHistory(),
                ),
                child: Text(
                  'Clear',
                  style: TextStyle(
                    color: AppColors.orange.withValues(alpha: 0.7),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 72,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20),
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemCount: _watchHistory.length > 10 ? 10 : _watchHistory.length,
            itemBuilder: (_, i) {
              final entry = _watchHistory[i];
              return GestureDetector(
                onTap: () => Navigator.pushNamed(
                  context,
                  '/channel-player',
                  arguments: entry.id,
                ),
                child: Container(
                  width: 72,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: AppColors.white.withValues(alpha: 0.08),
                    image: entry.logo != null && entry.logo!.isNotEmpty
                        ? DecorationImage(
                            image: NetworkImage(entry.logo!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  alignment: Alignment.center,
                  child: (entry.logo == null || entry.logo!.isEmpty)
                      ? Text(
                          entry.name.isNotEmpty
                              ? entry.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                        )
                      : null,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ───────── HELPERS ─────────
  Widget _buildThemeDivider() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      height: 1,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.transparent,
            AppColors.lightOrange.withValues(alpha: 0.45),
            AppColors.orange.withValues(alpha: 0.55),
            AppColors.lightOrange.withValues(alpha: 0.45),
            Colors.transparent,
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: AppColors.lightOrange, size: 14),
        const SizedBox(width: 6),
        Text(
          text,
          style: const TextStyle(
            color: AppColors.lightOrange,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
      ],
    );
  }
}
