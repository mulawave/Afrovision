import 'dart:async';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/profile_service.dart';
import '../services/home_service.dart';
import '../models/user_model.dart';
import '../../notifications/services/notification_inbox_service.dart';
import '../../notifications/models/notification_item.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../../../core/widgets/role_badge.dart';
import '../../../core/widgets/active_floating_player_banner.dart';
import '../../../core/services/widget_service.dart';
import '../../../core/api/api_service.dart';
import '../../broadcast/widgets/banner_ad_widget.dart';
import '../../../core/utils/app_rating.dart';
import '../../../core/utils/kyc_gender_checker.dart';
import '../../../core/services/notification_service.dart';
import '../../promo/widgets/promo_modal_dialog.dart';
import '../../reputation/models/reputation_model.dart';
import '../../reputation/services/reputation_service.dart';
import '../../../core/services/watch_history_service.dart';
import '../../broadcast/services/broadcast_service.dart';
import '../../subscription/models/channel_subscription_model.dart';
import '../../subscription/services/channel_subscription_service.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';
import '../../challenge/services/challenge_service.dart';
import '../../challenge/models/challenge_model.dart';
import '../../announcements/services/announcement_service.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';

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
  int _remindersCount = 0;
  List<WatchHistoryEntry> _watchHistory = [];
  List<ChannelModel> _allChannels = [];
  List<PromotedChannel> _featuredChannels = [];
  ChallengeModel? _activeChallenge;
  List<Announcement> _announcements = [];
  List<Map<String, dynamic>> _updates = [];
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;
  late PageController _promoPageController;
  Timer? _promoTimer;
  int _promoPage = 0;
  int _unreadNotifications = 0;
  late ScrollController _recentScrollController;
  Timer? _recentScrollTimer;
  int _adBannerIndex = 0;
  Timer? _adBannerTimer;

  @override
  void initState() {
    super.initState();
    _recentScrollController = ScrollController();
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
    _adBannerTimer?.cancel();
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
      await _syncHomeWidget();
    } catch (_) {}
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        ProfileService.getProfile(),
        HomeService.getStats(forceRefresh: true).catchError(
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
        ChallengeService.getActiveChallenge()
            .then<ChallengeModel?>((v) => v)
            .catchError((_) => null),
        AnnouncementService.getActiveAnnouncements(
          limit: 3,
        ).catchError((_) => <Announcement>[]),
        ApiService.get('/home/content').catchError((_) => <String, dynamic>{}),
      ]);
      if (!mounted) return;
      setState(() {
        _user = results[0] as UserModel;
        _stats = results[1] as HomeStats;
        _unreadNotifications = results[2] as int;
        _reputation = results[3] as ReputationModel?;
        _activeChallenge = results[4] as ChallengeModel?;
        _announcements = results[5] as List<Announcement>;

        // Parse updates from homepage content
        final homepageContent = results[6] as Map<String, dynamic>?;
        final sections = homepageContent?['homepage']?['sections'] as List?;
        final updatesSection = sections == null
            ? null
            : (sections.firstWhere(
                    (section) => section['key'] == 'updates',
                    orElse: () => null,
                  )
                  as Map<String, dynamic>?);
        final items = updatesSection?['items'] as List?;
        _updates = (items ?? []).cast<Map<String, dynamic>>();

        // Parse featured channels from homepage design
        final featuredChannelsSection = sections == null
            ? null
            : (sections.firstWhere(
                    (section) => section['key'] == 'featured_channels',
                    orElse: () => null,
                  )
                  as Map<String, dynamic>?);
        final featuredChannelsItems = featuredChannelsSection?['items'] as List?;
        _featuredChannels = (featuredChannelsItems ?? [])
            .map((item) => PromotedChannel(
                  // Use the real channel_id for navigation; the `id` field is the
                  // homepage section-item id (e.g. "featured-xxx") and must NOT
                  // be used to resolve a channel.
                  id: item['channel_id'] as String? ?? item['id'] as String? ?? '',
                  name: item['name'] as String? ?? '',
                  category: item['category'] as String?,
                  channelNumber: item['channel_id'] as String? ?? '',
                  logoUrl: item['logo_url'] as String?,
                  bannerUrl: item['banner_url'] as String?,
                ))
            .toList();

        _loading = false;
      });
      // Sync app icon badge with current unread count
      NotificationService.updateAppBadge(_unreadNotifications);
      await _syncHomeWidget();
      _animController.forward();
      _startPromoAutoScroll();
      _startRecentAutoScroll();
      _startAdBannerShuffle();

      // Load watch history & subscription count (non-blocking)
      _loadWatchHistory();
      _loadSubscriptionCount();
      _loadReminderCount();
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
    final featured = _featuredChannels.isNotEmpty
        ? _featuredChannels
        : _stats?.promotedChannels ?? [];
    final int count;
    if (featured.isNotEmpty) {
      count = featured.length;
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
    _recentScrollTimer?.cancel();
    final count = _watchHistory.length > 10 ? 10 : _watchHistory.length;
    if (count <= 2) return;
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

  Future<void> _loadReminderCount() async {
    try {
      final reminders = await BroadcastService.getMyReminders();
      if (!mounted) return;
      setState(() => _remindersCount = reminders.length);
      await _syncHomeWidget();
    } catch (_) {
      // silent
    }
  }

  Future<void> _loadWatchHistory() async {
    try {
      final history = await WatchHistoryService.getHistory();
      if (!mounted) return;
      setState(() => _watchHistory = history);
      await _syncHomeWidget();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _startRecentAutoScroll();
      });
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
        await _syncHomeWidget();
      }
    } catch (_) {
      // silent
    }
  }

  Future<void> _loadAllChannels() async {
    try {
      final channels = await ChannelService.getPublicChannels();
      if (!mounted) return;
      setState(() => _allChannels = channels);
      await _syncHomeWidget();
      // Restart auto-scrollers now that fallback channels are available
      _startPromoAutoScroll();
      _startRecentAutoScroll();
    } catch (_) {
      // silent — used only as fallback for sliders
    }
  }

  void _startAdBannerShuffle() {
    _adBannerTimer?.cancel();
    _adBannerTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!mounted) return;
      setState(() => _adBannerIndex = (_adBannerIndex + 1) % 3);
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

  String _formatPoolNumber(double n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(2)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(2)}K';
    return n.toStringAsFixed(2).replaceFirst(RegExp(r'\.00$'), '');
  }

  double _normalizedCommunityPoolVpt(HomeStats? pool) {
    return pool?.totalVpt ?? 0;
  }

  int _daysUntilRenewal(String? expiry) {
    if (expiry == null || expiry.isEmpty) return 0;
    final parsed = DateTime.tryParse(expiry);
    if (parsed == null) return 0;
    final remaining = parsed.difference(DateTime.now());
    if (remaining.isNegative) return 0;
    final days = remaining.inDays;
    return remaining.inSeconds.remainder(86400) > 0 ? days + 1 : days;
  }

  Future<void> _syncHomeWidget() async {
    final user = _user;
    if (user == null) return;

    try {
      final liveCount = _allChannels
          .where((channel) => channel.isActive && channel.isStreamLive)
          .length;
      final featuredChannel = _stats?.promotedChannels.isNotEmpty == true
          ? _stats!.promotedChannels.first.name
          : (_stats?.recentChannels.isNotEmpty == true
                ? _stats!.recentChannels.first.name
                : '');

      // Fetch top 3 notifications for widget preview
      List<NotificationItem> notifs = [];
      try {
        final inbox = await NotificationInboxService.getNotifications(limit: 3);
        notifs = inbox.notifications;
      } catch (_) {}

      // Recently viewed channels from watch history (top 3)
      final recent = _watchHistory.take(3).toList();

      String resolveMedia(String? url) {
        if (url == null || url.isEmpty) return '';
        return url.startsWith('http') ? url : AppConfig.mediaUrl(url);
      }

      WidgetService.update(
        liveCount: liveCount,
        nextShowChannel: _ws(featuredChannel),
        nextShowTitle: _ws(
          _stats?.promotedChannels.isNotEmpty == true
              ? (_stats!.promotedChannels.first.category ?? 'Featured channel')
              : 'Dashboard update',
        ),
        nextShowTime: _ws(
          _stats?.promotedChannels.isNotEmpty == true ? 'Live now' : '',
        ),
        planName: _ws(user.subscriptionPlanDisplay, max: 20),
        daysToRenewal: _daysUntilRenewal(user.subscriptionExpiry),
        notificationCount: _unreadNotifications,
        wavesCount: _watchHistory.length,
        libraryUpdates: _remindersCount,
        avatarInitial: _ws(
          (user.name ?? user.email).isNotEmpty
              ? (user.name ?? user.email)[0].toUpperCase()
              : '?',
          max: 1,
        ),
        avatarUrl: resolveMedia(user.avatarUrl),
        recentChannel1: recent.isNotEmpty ? _ws(recent[0].name) : '',
        recentChannel2: recent.length > 1 ? _ws(recent[1].name) : '',
        recentChannel3: recent.length > 2 ? _ws(recent[2].name) : '',
        recentChannelId1: recent.isNotEmpty ? _ws(recent[0].id) : '',
        recentChannelId2: recent.length > 1 ? _ws(recent[1].id) : '',
        recentChannelId3: recent.length > 2 ? _ws(recent[2].id) : '',
        recentChannelLogo1: recent.isNotEmpty ? resolveMedia(recent[0].logo) : '',
        recentChannelLogo2: recent.length > 1 ? resolveMedia(recent[1].logo) : '',
        recentChannelLogo3: recent.length > 2 ? resolveMedia(recent[2].logo) : '',
        recentChannelCover1: recent.isNotEmpty ? resolveMedia(recent[0].banner) : '',
        recentChannelCover2: recent.length > 1 ? resolveMedia(recent[1].banner) : '',
        recentChannelCover3: recent.length > 2 ? resolveMedia(recent[2].banner) : '',
        notification1: notifs.isNotEmpty ? _ws(notifs[0].title) : '',
        notification2: notifs.length > 1 ? _ws(notifs[1].title) : '',
        notification3: notifs.length > 2 ? _ws(notifs[2].title) : '',
        assetCash: '₦${user.cash.toStringAsFixed(2)}',
        assetVpt: user.vptBalance.toStringAsFixed(2),
        assetRavens: user.coins.toInt().toString(),
      );
    } catch (_) {
      // Widget update is non-critical; swallow errors so dashboard is unaffected.
    }
  }

  /// Sanitise a string before sending it to the Android home-screen widget.
  /// Null, empty, and excessively long strings are all handled gracefully.
  String _ws(String? value, {int max = 40}) {
    if (value == null || value.isEmpty) return '';
    final trimmed = value.trim();
    return trimmed.length > max ? trimmed.substring(0, max) : trimmed;
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
                                  const ActiveFloatingPlayerBanner(),
                                  _buildAdvertsSection(),
                                  const SizedBox(height: 16),
                                  _buildUserAssetsSection(),
                                  const SizedBox(height: 16),
                                  _buildThemeDivider(),
                                  const SizedBox(height: 16),
                                  _buildAnnouncementsCard(),
                                  const SizedBox(height: 16),
                                  _buildThemeDivider(),
                                  const SizedBox(height: 16),
                                  if ((_stats?.promotedChannels.isNotEmpty ??
                                          false) ||
                                      _allChannels.isNotEmpty) ...[
                                    _buildFeaturedChannelsSlider(),
                                    const SizedBox(height: 16),
                                    _buildThemeDivider(),
                                    const SizedBox(height: 16),
                                  ],
                                  _buildActionCards(),
                                  const SizedBox(height: 16),
                                  _buildThemeDivider(),
                                  const SizedBox(height: 16),
                                  _buildCommunityPoolBanner(),
                                  if (_activeChallenge != null)
                                    _buildChallengeBanner(),
                                  if (_user != null &&
                                      _user!.kycStatus != 'verified' &&
                                      _user!.kycStatus != 'pending')
                                    _buildKycAlert(),
                                  const SizedBox(height: 22),
                                  _buildMySubscriptionsCard(),
                                  const SizedBox(height: 16),
                                  _buildThemeDivider(),
                                  const SizedBox(height: 16),
                                  if (_watchHistory.isNotEmpty) ...[
                                    _buildPublicChannelsSlider(),
                                    const SizedBox(height: 16),
                                    _buildThemeDivider(),
                                    const SizedBox(height: 16),
                                  ],
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
                    isPremiumCreator: _user!.hasActiveSubscription && _user!.isPremiumCreator,
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
    final displayVpt = _normalizedCommunityPoolVpt(pool);
    final naira = pool?.totalNgn ?? 0;

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
                  '${_formatPoolNumber(displayVpt)} vPT',
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
    // Build unified list: prefer featured channels from admin, fall back to promoted channels,
    // then channels with banners, then any public channels
    final featured = _featuredChannels.isNotEmpty
        ? _featuredChannels
        : _stats?.promotedChannels ?? [];
    List<PromotedChannel> items;
    if (featured.isNotEmpty) {
      items = featured.where((c) => c.id.isNotEmpty).toList();
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
                    '/channel-view',
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
    if (_watchHistory.isEmpty) return const SizedBox.shrink();
    final itemCount = _watchHistory.length > 10 ? 10 : _watchHistory.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _sectionLabel(
            'RECENTLY VISITED CHANNELS',
            Icons.history_rounded,
            color: AppColors.softBlue,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 94,
          child: ListView.builder(
            controller: _recentScrollController,
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 18),
            itemCount: itemCount,
            itemBuilder: (context, index) {
              final entry = _watchHistory[index];
              final logoUrl = entry.logo;
              final resolvedLogoUrl = (logoUrl != null && logoUrl.isNotEmpty)
                  ? (logoUrl.startsWith('http')
                        ? logoUrl
                        : AppConfig.mediaUrl(logoUrl))
                  : null;

              return GestureDetector(
                onTap: () async {
                  await Navigator.pushNamed(
                    context,
                    '/channel-player',
                    arguments: entry.id,
                  );
                  _loadData();
                },
                child: Container(
                  width: 86,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: AppColors.softBlue.withValues(alpha: 0.25),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.lightBlue.withValues(alpha: 0.55),
                            border: Border.all(
                              color: AppColors.softBlue.withValues(alpha: 0.35),
                              width: 1.4,
                            ),
                            image: resolvedLogoUrl != null
                                ? DecorationImage(
                                    image: NetworkImage(resolvedLogoUrl),
                                    fit: BoxFit.cover,
                                  )
                                : null,
                          ),
                          child: resolvedLogoUrl == null
                              ? Icon(
                                  Icons.live_tv_rounded,
                                  color: AppColors.softBlue.withValues(
                                    alpha: 0.95,
                                  ),
                                  size: 22,
                                )
                              : null,
                        ),
                      ),
                      Positioned(
                        bottom: 8,
                        left: 0,
                        right: 0,
                        child: Text(
                          entry.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
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
      ],
    );
  }

  // ───────── 6 ACTION CARDS ─────────
  Widget _buildActionCards() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _sectionLabel(
              'INSTANT ACTIONS',
              Icons.bolt_rounded,
              color: AppColors.softBlue,
            ),
          ),
          // Row 1
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  icon: Icons.explore_rounded,
                  label: 'Browse Channel',
                  onTap: () => Navigator.pushNamed(context, '/channels'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.dialpad_rounded,
                  label: 'Channel Number',
                  onTap: () => Navigator.pushNamed(context, '/channel-access'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.live_tv_rounded,
                  label: 'Live Now',
                  onTap: () => Navigator.pushNamed(context, '/live'),
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
                  icon: Icons.video_settings_rounded,
                  label: 'Creator Studio',
                  onTap: () => Navigator.pushNamed(context, '/creator-studio'),
                  locked:
                      _user != null &&
                      _user!.role != 'creator' &&
                      _user!.role != 'admin',
                  accentColor: AppColors.successGreen,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.campaign_rounded,
                  label: 'Advertise',
                  onTap: () => Navigator.pushNamed(context, '/advertiser'),
                  subtle: true,
                  accentColor: AppColors.successGreen,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.account_balance_wallet_rounded,
                  label: 'Digital Assets',
                  onTap: () => Navigator.pushNamed(context, '/digital-assets'),
                  subtle: true,
                  accentColor: AppColors.successGreen,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Row 3
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  icon: Icons.workspace_premium_rounded,
                  label: 'My Plan',
                  onTap: () => Navigator.pushNamed(context, '/my-plan'),
                  accentColor: AppColors.softBlue,
                  badgeLabel: _user?.hasActiveSubscription == true
                      ? '${_planDaysLeft()}d'
                      : 'Start Here',
                  badgeIcon: _user?.hasActiveSubscription == true
                      ? Icons.timer_rounded
                      : Icons.launch_rounded,
                  badgeColor: _user?.hasActiveSubscription == true
                      ? AppColors.softBlue
                      : AppColors.infoBlue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.notifications_active_rounded,
                  label: 'My Reminders',
                  onTap: () => Navigator.pushNamed(context, '/reminders'),
                  accentColor: AppColors.softBlue,
                  badgeLabel: '$_remindersCount',
                  badgeIcon: Icons.notifications_rounded,
                  badgeColor: AppColors.softBlue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  icon: Icons.waves_rounded,
                  label: 'Surf Waves',
                  onTap: () => Navigator.pushNamed(context, '/wave'),
                  accentColor: AppColors.softBlue,
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
                    label: 'Admin Panel',
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
    String? badgeLabel,
    IconData? badgeIcon,
    Color? badgeColor,
  }) {
    final color = accentColor ?? AppColors.orange;
    final effectiveBadgeColor = badgeColor ?? color;
    return GestureDetector(
      onTap: locked ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
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
        child: Stack(
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  softWrap: false,
                  style: TextStyle(
                    color: locked ? AppColors.goldText : AppColors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    height: 1.25,
                  ),
                ),
                if (locked) ...[
                  const SizedBox(height: 4),
                  const Icon(
                    Icons.lock_rounded,
                    color: AppColors.goldText,
                    size: 12,
                  ),
                ],
              ],
            ),
            if (badgeLabel != null)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: effectiveBadgeColor.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: effectiveBadgeColor.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (badgeIcon != null) ...[
                        Icon(badgeIcon, color: effectiveBadgeColor, size: 11),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        badgeLabel,
                        style: TextStyle(
                          color: effectiveBadgeColor,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ───────── USER ASSETS SECTION ─────────
  Widget _buildUserAssetsSection() {
    final user = _user;
    if (user == null) return const SizedBox.shrink();
    final cash = (user.cash ?? 0).toDouble();
    final vpt = (user.vptBalance ?? user.vpt ?? 0).toDouble();
    final ravens = (user.coins ?? 0).toDouble();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('MY ASSETS', Icons.account_balance_wallet_rounded),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _assetCard(
                  label: 'Cash',
                  value: '₦${cash.toStringAsFixed(2)}',
                  icon: Icons.payments_rounded,
                  color: AppColors.orange,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _assetCard(
                  label: 'vPT Offchain',
                  value: vpt.toStringAsFixed(2),
                  icon: Icons.token_rounded,
                  color: const Color(0xFF4CAF50),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _assetCard(
                  label: 'Ravens',
                  value: ravens.toStringAsFixed(0),
                  icon: Icons.favorite_rounded,
                  color: const Color(0xFFE91E63),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _assetCard({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.2)),
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
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: AppColors.hintText,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ───────── ADVERTS SECTION (shuffling banner) ─────────
  Widget _buildAdvertsSection() {
    final ads = <_AdBannerData>[
      _AdBannerData(
        icon: Icons.rocket_launch_rounded,
        title: 'Boost Your Channel',
        subtitle: 'Promote your content to thousands of viewers across Africa.',
        color: AppColors.orange,
        route: '/advertiser',
      ),
      _AdBannerData(
        icon: Icons.workspace_premium_rounded,
        title: (_user?.hasActiveSubscription ?? false)
            ? 'Premium Unlocked'
            : 'Go Premium',
        subtitle: (_user?.hasActiveSubscription ?? false)
            ? '${_user!.subscriptionPlanDisplay} plan active'
            : 'Unlock exclusive features',
        color: AppColors.lightOrange,
        route: '/plans',
      ),
      _AdBannerData(
        icon: Icons.groups_rounded,
        title: 'Refer & Earn',
        subtitle: 'Earn vPT for every friend you invite.',
        color: const Color(0xFF4CAF50),
        route: '/referral',
      ),
    ];
    final current = ads[_adBannerIndex];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('SPOTLIGHT', Icons.campaign_rounded),
          const SizedBox(height: 4),
          const Padding(
            padding: EdgeInsets.zero,
            child: BannerAdWidget(placement: 'home'),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, current.route),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 600),
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: child,
              ),
              child: Container(
                key: ValueKey<int>(_adBannerIndex),
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: LinearGradient(
                    colors: [
                      current.color.withValues(alpha: 0.15),
                      AppColors.darkBlue.withValues(alpha: 0.9),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  border: Border.all(
                    color: current.color.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: current.color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        current.icon,
                        color: current.color,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            current.title,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            current.subtitle,
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
                      color: current.color.withValues(alpha: 0.6),
                      size: 22,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ───────── ANNOUNCEMENTS CARD ─────────
  Widget _buildAnnouncementsCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                      'Announcements',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () =>
                      Navigator.pushNamed(context, '/announcements'),
                  child: const Text(
                    'See all',
                    style: TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_announcements.isEmpty)
              const Text(
                'Announcements from Admin will appear here',
                style: TextStyle(color: AppColors.hintText, fontSize: 12),
              )
            else
              ..._announcements.take(3).map((announcement) {
                return Column(
                  children: [
                    _announcementItem(
                      announcement.title,
                      announcement.body,
                      _getIconForString(announcement.icon),
                      _getColorFromString(announcement.color),
                    ),
                    if (announcement != _announcements.last)
                      const SizedBox(height: 10),
                  ],
                );
              }),
          ],
        ),
      ),
    );
  }

  // ───────── TWO COLUMN SECTION ─────────
  Widget _buildTwoColumnSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Updates Card (existing, from backend)
          Container(
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
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                    GestureDetector(
                      onTap: () =>
                          Navigator.pushNamed(context, '/updates-list'),
                      child: const Text(
                        'See all',
                        style: TextStyle(
                          color: AppColors.lightOrange,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_updates.isEmpty)
                  const Text(
                    'No updates yet.',
                    style: TextStyle(color: AppColors.hintText, fontSize: 12),
                  )
                else
                  ..._updates.take(3).map((update) {
                    final body = update['body'] as String?;
                    final summary = update['summary'] as String? ?? '';
                    final displayBody = body ?? summary;
                    return Column(
                      children: [
                        _announcementItem(
                          update['title'] as String? ?? '',
                          displayBody,
                          update['icon'] as String? ?? '✨',
                          _getColorForTag(update['tag'] as String? ?? ''),
                          isTruncated: true,
                        ),
                        if (update != _updates.last) const SizedBox(height: 10),
                      ],
                    );
                  }),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Bottom: Quick Stats & Highlights
          Container(
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
        ],
      ),
    );
  }

  Widget _announcementItem(
    String title,
    String body,
    dynamic icon,
    Color color, {
    bool isTruncated = false,
  }) {
    final displayBody = isTruncated && body.length > 80
        ? '${body.substring(0, 80)}...'
        : body;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(7),
          ),
          child: icon is IconData
              ? Icon(icon, color: color, size: 12)
              : Text(
                  icon is String ? icon : '✨',
                  style: TextStyle(fontSize: 12),
                ),
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
              Row(
                children: [
                  Expanded(
                    child: Text(
                      displayBody,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 9,
                        height: 1.3,
                      ),
                      maxLines: isTruncated ? 2 : null,
                      overflow: isTruncated ? TextOverflow.ellipsis : null,
                    ),
                  ),
                  if (isTruncated && body.length > 80)
                    GestureDetector(
                      onTap: () =>
                          Navigator.pushNamed(context, '/updates-list'),
                      child: const Text(
                        ' Read more',
                        style: TextStyle(
                          color: AppColors.lightOrange,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
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

  Widget _sectionLabel(String text, IconData icon, {Color? color}) {
    final accent = color ?? AppColors.lightOrange;
    return Row(
      children: [
        Icon(icon, color: accent, size: 14),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            color: accent,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
      ],
    );
  }

  int _planDaysLeft() {
    final expiry = _user?.subscriptionExpiry;
    if (expiry == null || expiry.isEmpty) return 0;
    final parsed = DateTime.tryParse(expiry);
    if (parsed == null) return 0;
    final remaining = parsed.difference(DateTime.now());
    if (remaining.isNegative) return 0;
    final days = remaining.inDays;
    return remaining.inSeconds.remainder(86400) > 0 ? days + 1 : days;
  }

  IconData _getIconForString(String iconName) {
    switch (iconName) {
      case 'campaign':
        return Icons.campaign_rounded;
      case 'celebration':
        return Icons.celebration_rounded;
      case 'verified':
        return Icons.verified_rounded;
      case 'shield':
        return Icons.shield_rounded;
      case 'info':
        return Icons.info_rounded;
      case 'warning':
        return Icons.warning_rounded;
      case 'error':
        return Icons.error_rounded;
      case 'star':
        return Icons.star_rounded;
      case 'check_circle':
        return Icons.check_circle_rounded;
      default:
        return Icons.campaign_rounded;
    }
  }

  Color _getColorFromString(String colorString) {
    try {
      return Color(int.parse(colorString.replaceAll('#', '0xFF')));
    } catch (_) {
      return AppColors.orange;
    }
  }

  Color _getColorForTag(String tag) {
    final tagMap = {
      'New Feature': AppColors.lightOrange,
      'Monetization': const Color(0xFF4CAF50),
      'Enhancement': AppColors.orange,
      'Economy': const Color(0xFFFFD700),
      'Platform': const Color(0xFF2196F3),
      'Performance': const Color(0xFF9C27B0),
    };
    return tagMap[tag] ?? AppColors.lightOrange;
  }
}

class _AdBannerData {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final String route;

  const _AdBannerData({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.route,
  });
}
