import 'dart:async';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/profile_service.dart';
import '../services/home_service.dart';
import '../models/user_model.dart';
import '../../notifications/services/notification_inbox_service.dart';
import '../../notifications/models/notification_item.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../../core/config/app_config.dart';
import '../../../core/widgets/active_floating_player_banner.dart';
import '../../../core/services/widget_service.dart';
import '../../broadcast/widgets/banner_ad_widget.dart';
import '../../../core/ads/pangle_widgets.dart';
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
import '../../../core/widgets/grace_period_banner.dart';
import '../../vod/screens/media_center_screen.dart';
import '../../channel/screens/channel_list_screen.dart';
import '../../wave/screens/wave_screen.dart';
import '../../wallet/screens/digital_assets_overview_screen.dart';
import '../../../core/widgets/shimmer_box.dart';

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
  int _currentIndex = 0;
  Timer? _adBannerTimer;
  String _feedTabValue = 'updates';

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

  /// Parses the /home/content payload into the updates + featured-channels
  /// lists. Extracted so cached and fresh loads can apply the same logic.
  /// Caller wraps in setState.
  void _applyHomeContent(Map<String, dynamic>? homepageContent) {
    final sections = homepageContent?['homepage']?['sections'] as List?;
    final updatesSection = sections == null
        ? null
        : (sections.firstWhere(
                (section) => section['key'] == 'updates',
                orElse: () => null,
              ) as Map<String, dynamic>?);
    final items = updatesSection?['items'] as List?;
    _updates = (items ?? []).cast<Map<String, dynamic>>();

    final featuredChannelsSection = sections == null
        ? null
        : (sections.firstWhere(
                (section) => section['key'] == 'featured_channels',
                orElse: () => null,
              ) as Map<String, dynamic>?);
    final featuredChannelsItems = featuredChannelsSection?['items'] as List?;
    _featuredChannels = (featuredChannelsItems ?? [])
        .map(
          (item) => PromotedChannel(
            id: item['channel_id'] as String? ??
                item['id'] as String? ??
                '',
            name: item['name'] as String? ?? '',
            category: item['category'] as String?,
            channelNumber: item['channel_id'] as String? ?? '',
            logoUrl: item['logo_url'] as String?,
            bannerUrl: item['banner_url'] as String?,
          ),
        )
        .toList();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        // Unlike its 6 siblings below, this had no fallback — any failure
        // (a transient network blip, a momentary 401) rejected the whole
        // batch and left the entire home screen blank with _loading=false,
        // since every content section null-guards on _user. Fall back to
        // AuthService's own cached user (already used elsewhere in the
        // app) before giving up.
        ProfileService.getProfile().catchError(
          (_) => AuthService.getCurrentUser(),
        ),
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
        HomeService.getHomeContentCached(
          // Applies cached channel/content data as soon as it's available so
          // that section repaints instantly once the skeleton is gone — but
          // must NOT flip `_loading` false itself. `_user`/`_stats` come from
          // other futures in this same batch and are still null at this
          // point; every content section null-guards on them, so ending the
          // loading state here reveals a half-populated, still-blank shell
          // instead of the skeleton — exactly what happened on re-login,
          // where a stale cache exists and this callback fires almost
          // instantly. `_loading` is only set false once below, after the
          // whole batch (including `_user`/`_stats`) has resolved.
          onCached: (cached) {
            if (!mounted) return;
            setState(() {
              _applyHomeContent(cached);
            });
          },
        ).catchError((_) => <String, dynamic>{}),
      ]);
      if (!mounted) return;
      setState(() {
        _user = results[0] as UserModel;
        _stats = results[1] as HomeStats;
        _unreadNotifications = results[2] as int;
        _reputation = results[3] as ReputationModel?;
        _activeChallenge = results[4] as ChallengeModel?;
        _announcements = results[5] as List<Announcement>;
        _applyHomeContent(results[6] as Map<String, dynamic>?);
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
        recentChannelLogo1: recent.isNotEmpty
            ? resolveMedia(recent[0].logo)
            : '',
        recentChannelLogo2: recent.length > 1
            ? resolveMedia(recent[1].logo)
            : '',
        recentChannelLogo3: recent.length > 2
            ? resolveMedia(recent[2].logo)
            : '',
        recentChannelCover1: recent.isNotEmpty
            ? resolveMedia(recent[0].banner)
            : '',
        recentChannelCover2: recent.length > 1
            ? resolveMedia(recent[1].banner)
            : '',
        recentChannelCover3: recent.length > 2
            ? resolveMedia(recent[2].banner)
            : '',
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
      body: IndexedStack(
        index: _currentIndex,
        children: [
          Container(
            width: double.infinity,
            height: double.infinity,
            color: Nocturne.bg,
            child: SafeArea(
              child: Column(
                children: [
                  _buildTopBar(),
                  const MarqueeTickerWidget(),
                  Expanded(
                    child: _loading
                        ? _buildHomeSkeleton()
                        : RefreshIndicator(
                            color: AppColors.orange,
                            backgroundColor: AppColors.inputFill,
                            onRefresh: _loadData,
                            child: FadeTransition(
                              opacity: _fadeAnim,
                              child: SlideTransition(
                                position: _slideAnim,
                                child: SingleChildScrollView(
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  padding: const EdgeInsets.only(bottom: 40),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const ActiveFloatingPlayerBanner(),
                                      const GracePeriodBanner(),
                                      const SizedBox(height: 14),
                                      _buildUserAssetsSection(),
                                      const SizedBox(height: 14),
                                      if ((_stats
                                                  ?.promotedChannels
                                                  .isNotEmpty ??
                                              false) ||
                                          _allChannels.isNotEmpty) ...[
                                        _buildFeaturedChannelsSlider(),
                                        const SizedBox(height: 16),
                                      ],
                                      _buildActionCards(),
                                      const SizedBox(height: 16),
                                      _buildAdvertsSection(),
                                      const SizedBox(height: 14),
                                      if (_activeChallenge != null) ...[
                                        _buildChallengeBanner(),
                                        const SizedBox(height: 10),
                                      ],
                                      if (_user != null &&
                                          _user!.kycStatus != 'verified' &&
                                          _user!.kycStatus != 'pending') ...[
                                        _buildKycAlert(),
                                        const SizedBox(height: 10),
                                      ],
                                      _buildCommunityPoolBanner(),
                                      const SizedBox(height: 9),
                                      _buildMySubscriptionsCard(),
                                      const SizedBox(height: 16),
                                      if (_watchHistory.isNotEmpty) ...[
                                        _buildPublicChannelsSlider(),
                                        const SizedBox(height: 16),
                                      ],
                                      _buildTwoColumnSection(),
                                      const SizedBox(height: 20),
                                      const PangleBigBanner(),
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
          const ChannelListScreen(),
          const MediaCenterScreen(),
          WaveScreen(isActive: _currentIndex == 3),
          const DigitalAssetsScreen(),
        ],
      ),
      bottomNavigationBar: _buildNocturneNav(),
    );
  }

  // ───────── BOTTOM NAV (Nocturne) ─────────
  Widget _buildNocturneNav() {
    const items = <_NavItem>[
      _NavItem(label: 'Home', icon: Icons.home_rounded, size: 20),
      _NavItem(label: 'Channels', icon: Icons.live_tv_rounded, size: 20),
      _NavItem(label: 'Media', icon: Icons.play_circle_fill_rounded, size: 26),
      _NavItem(label: 'Waves', icon: Icons.waves_rounded, size: 20),
      _NavItem(label: 'Assets', icon: Icons.account_balance_wallet_rounded, size: 20),
    ];
    return Container(
      decoration: const BoxDecoration(
        color: Nocturne.surfaceRail,
        border: Border(top: BorderSide(color: Nocturne.border, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
          child: Row(
            children: [
              for (int i = 0; i < items.length; i++)
                Expanded(
                  child: _NavButton(
                    item: items[i],
                    active: _currentIndex == i,
                    onTap: () => setState(() => _currentIndex = i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // ───────── HOME SKELETON (shown while _loading) ─────────
  // A blank page with a spinner reads as broken/unfinished — this mirrors
  // the shape of the real content sections below (assets row, featured
  // carousel, action cards, adverts, subscriptions, two-column list) so the
  // screen never looks empty, whether the user waited out the splash screen
  // or tapped "Skip splash".
  Widget _buildHomeSkeleton() {
    Widget card({required double width, required double height, BorderRadius? radius}) =>
        ShimmerBox(width: width, height: height, borderRadius: radius ?? BorderRadius.circular(14));

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // My Assets row — 3 stat cards
          Row(
            children: [
              Expanded(child: card(width: double.infinity, height: 74)),
              const SizedBox(width: 10),
              Expanded(child: card(width: double.infinity, height: 74)),
              const SizedBox(width: 10),
              Expanded(child: card(width: double.infinity, height: 74)),
            ],
          ),
          const SizedBox(height: 20),
          // Featured channels carousel
          card(width: double.infinity, height: 150, radius: BorderRadius.circular(18)),
          const SizedBox(height: 20),
          // Action cards row
          Row(
            children: List.generate(4, (i) {
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: i == 3 ? 0 : 10),
                  child: card(width: double.infinity, height: 76),
                ),
              );
            }),
          ),
          const SizedBox(height: 20),
          // Adverts banner
          card(width: double.infinity, height: 90),
          const SizedBox(height: 20),
          // Subscriptions card
          card(width: double.infinity, height: 64),
          const SizedBox(height: 20),
          // Two-column section
          Row(
            children: [
              Expanded(child: card(width: double.infinity, height: 130)),
              const SizedBox(width: 12),
              Expanded(child: card(width: double.infinity, height: 130)),
            ],
          ),
        ],
      ),
    );
  }

  // ───────── TOP BAR (Nocturne) ─────────
  Widget _buildTopBar() {
    final u = _user;
    final name = u?.name ?? u?.email ?? 'User';
    final avatarUrl = u?.avatarUrl;
    final initials = _initialsFor(name);
    final isCreator = u?.role == 'creator' || u?.role == 'admin';
    return Container(
      decoration: const BoxDecoration(
        gradient: Nocturne.headerGradient,
        border: Border(
          bottom: BorderSide(color: Nocturne.border, width: 1),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar tile with gold ring
          GestureDetector(
            onTap: _goToProfile,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF2A3D78), Color(0xFF141F45)],
                ),
                border: Border.all(color: Nocturne.gold, width: 1.5),
                image: (avatarUrl != null && avatarUrl.isNotEmpty)
                    ? DecorationImage(
                        image: NetworkImage(avatarUrl),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              alignment: Alignment.center,
              child: (avatarUrl == null || avatarUrl.isEmpty)
                  ? Text(
                      initials,
                      style: const TextStyle(
                        color: Nocturne.goldLight,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    )
                  : null,
            ),
          ),
          const SizedBox(width: 11),
          // Name + badges
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Welcome back,',
                  style: TextStyle(color: Nocturne.textMuted, fontSize: 11),
                ),
                Text(
                  name,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.15,
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    if (isCreator) _nocturnePill(
                      icon: Icons.videocam_rounded,
                      label: 'CREATOR',
                      fg: Nocturne.green,
                      bg: Nocturne.greenWash,
                    ),
                    if (isCreator && _reputation != null) const SizedBox(width: 6),
                    if (_reputation != null) _nocturnePill(
                      icon: Icons.star_rounded,
                      label:
                          '${_formatNumber(_reputation!.totalReps)} · ${_reputation!.levelName}',
                      fg: Nocturne.goldLight,
                      bg: Nocturne.goldWash,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Bell (with badge)
          _nocturneHeaderBtn(
            icon: Icons.notifications_rounded,
            onTap: _goToNotifications,
            iconColor: Nocturne.gold,
            badge: _unreadNotifications,
          ),
          const SizedBox(width: 7),
          // Sign out
          _nocturneHeaderBtn(
            icon: Icons.logout_rounded,
            onTap: _logout,
            iconColor: Nocturne.textMuted,
          ),
        ],
      ),
    );
  }

  String _initialsFor(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  Widget _nocturnePill({
    required IconData icon,
    required String label,
    required Color fg,
    required Color bg,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: fg.withValues(alpha: 0.35), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _nocturneHeaderBtn({
    required IconData icon,
    required VoidCallback onTap,
    required Color iconColor,
    int badge = 0,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              color: Colors.white.withValues(alpha: 0.03),
              border: Border.all(color: Nocturne.borderStrong, width: 1),
            ),
            child: Icon(icon, color: iconColor, size: 16),
          ),
          if (badge > 0)
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: Nocturne.red,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Nocturne.bgHeader, width: 2),
                ),
                child: Center(
                  child: Text(
                    badge > 99 ? '99+' : '$badge',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      height: 1,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ───────── COMMUNITY POOL BANNER ─────────
  Widget _buildCommunityPoolBanner() {
    final pool = _stats;
    final displayVpt = _normalizedCommunityPoolVpt(pool);
    final naira = pool?.totalNgn ?? 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(Nocturne.radiusLg),
          border: Border.all(color: Nocturne.borderCard, width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: Nocturne.gold.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.account_balance_rounded,
                      color: Nocturne.goldLight, size: 15),
                ),
                const SizedBox(width: 9),
                const Expanded(
                  child: Text(
                    'Community Pool',
                    style: TextStyle(
                      color: Nocturne.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Nocturne.greenWash,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      _LiveDot(),
                      SizedBox(width: 5),
                      Text(
                        'LIVE',
                        style: TextStyle(
                          color: Nocturne.green,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  '${_formatPoolNumber(displayVpt)} vPT',
                  style: const TextStyle(
                    color: Nocturne.goldLight,
                    fontSize: 25,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '(${_formatNaira(naira)})',
                  style: const TextStyle(
                    color: Nocturne.textMuted,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Row(
              children: [
                Text(
                  '1 vPT = ₦${pool?.vptRate ?? 750}',
                  style: const TextStyle(
                      color: Nocturne.textFaint, fontSize: 10.5),
                ),
                const Spacer(),
                Text(
                  '${_stats?.totalMembers ?? 0} members · ${_stats?.totalChannels ?? 0} channels',
                  style: const TextStyle(
                      color: Nocturne.textFaint, fontSize: 10.5),
                ),
              ],
            ),
            const SizedBox(height: 11),
            Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Nocturne.border, width: 1),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _poolStat(
                      value: '${_formatNumber(pool?.totalDistributedVpt ?? 0)} vPT',
                      label:
                          'Distributed (${_formatNaira(pool?.totalDistributedNgn ?? 0)})',
                    ),
                  ),
                  Container(width: 1, height: 36, color: Nocturne.border),
                  Expanded(
                    child: _poolStat(
                      value: '${pool?.totalBeneficiaries ?? 0}',
                      label: 'Beneficiaries',
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

  Widget _poolStat({required String value, required String label}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Nocturne.goldLight,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Nocturne.textFaint, fontSize: 9.5),
          ),
        ],
      ),
    );
  }

  // ───────── CHALLENGE BANNER (Nocturne inline alert) ─────────
  Widget _buildChallengeBanner() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
      child: _nocturneInlineAlert(
        onTap: () => Navigator.pushNamed(context, '/challenge'),
        icon: Icons.emoji_events_rounded,
        tint: Nocturne.goldLight,
        title: 'AfroVision Challenge',
        body: 'Auditions open · Tap to learn more',
        cta: 'Join',
      ),
    );
  }

  Widget _nocturneInlineAlert({
    required VoidCallback onTap,
    required IconData icon,
    required Color tint,
    required String title,
    required String body,
    required String cta,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(Nocturne.radiusLg),
          color: tint.withValues(alpha: 0.06),
          border: Border.all(color: tint.withValues(alpha: 0.28), width: 1),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: tint, size: 18),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    body,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.textMuted,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
              decoration: BoxDecoration(
                color: tint,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                cta,
                style: const TextStyle(
                  color: Color(0xFF241606),
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ───────── KYC ALERT (Nocturne inline alert) ─────────
  Widget _buildKycAlert() {
    final isRejected = _user?.kycStatus == 'rejected';
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
      child: _nocturneInlineAlert(
        onTap: () => Navigator.pushNamed(context, '/kyc'),
        icon: isRejected
            ? Icons.warning_amber_rounded
            : Icons.verified_user_outlined,
        tint: isRejected ? Nocturne.redSoft : Nocturne.goldLight,
        title: isRejected ? 'KYC rejected' : 'Complete KYC',
        body: isRejected
            ? 'Tap to re-submit your documents.'
            : 'Unlock all features by verifying your identity.',
        cta: isRejected ? 'Re-submit' : 'Complete',
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
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 9),
          child: Row(
            children: [
              _nocturneKicker(
                label: 'FEATURED CHANNELS',
                icon: Icons.live_tv_rounded,
                color: Nocturne.gold,
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/channels'),
                child: const Text(
                  'Browse all',
                  style: TextStyle(
                    color: Nocturne.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 150,
          child: PageView.builder(
            controller: _promoPageController,
            itemCount: items.length,
            onPageChanged: (i) => setState(() => _promoPage = i),
            itemBuilder: (context, index) {
              final ch = items[index];
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 5),
                child: _nocturneFeaturedCard(ch),
              );
            },
          ),
        ),
        if (items.length > 1) ...[
          const SizedBox(height: 9),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(items.length, (i) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                width: i == _promoPage ? 18 : 5,
                height: 5,
                margin: const EdgeInsets.symmetric(horizontal: 2.5),
                decoration: BoxDecoration(
                  color: i == _promoPage
                      ? Nocturne.gold
                      : Nocturne.gold.withValues(alpha: 0.32),
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }

  // ───────── RECENTLY VISITED (Nocturne circular row) ─────────
  Widget _buildPublicChannelsSlider() {
    if (_watchHistory.isEmpty) return const SizedBox.shrink();
    final itemCount = _watchHistory.length > 10 ? 10 : _watchHistory.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
          child: _nocturneKicker(
            label: 'RECENTLY VISITED',
            icon: Icons.history_rounded,
            color: Nocturne.blue,
          ),
        ),
        SizedBox(
          height: 88,
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
              final palette = _paletteForName(entry.name);
              final initials = _initialsFor(entry.name);

              return Padding(
                padding: const EdgeInsets.only(right: 12),
                child: GestureDetector(
                  onTap: () async {
                    await Navigator.pushNamed(context, '/channel-player',
                        arguments: entry.id);
                    _loadData();
                  },
                  child: SizedBox(
                    width: 66,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: resolvedLogoUrl == null ? palette.bg : null,
                            color: resolvedLogoUrl != null
                                ? Nocturne.surface
                                : null,
                            image: resolvedLogoUrl != null
                                ? DecorationImage(
                                    image: NetworkImage(resolvedLogoUrl),
                                    fit: BoxFit.cover,
                                  )
                                : null,
                            border: Border.all(
                                color: Nocturne.borderStrong, width: 1),
                          ),
                          alignment: Alignment.center,
                          child: resolvedLogoUrl == null
                              ? Text(
                                  initials,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                )
                              : null,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          entry.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Nocturne.textMuted,
                            fontSize: 9.5,
                            height: 1.2,
                          ),
                        ),
                      ],
                    ),
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
    final isCreator = _user != null &&
        (_user!.role == 'creator' || _user!.role == 'admin');
    final planActive = _user?.hasActiveSubscription == true;

    final tiles = <_ActionTile>[
      _ActionTile(
        icon: Icons.explore_rounded,
        label: 'Browse Channel',
        tint: Nocturne.gold,
        onTap: () => Navigator.pushNamed(context, '/channels'),
      ),
      _ActionTile(
        icon: Icons.dialpad_rounded,
        label: 'Channel Number',
        tint: Nocturne.gold,
        onTap: () => Navigator.pushNamed(context, '/channel-access'),
      ),
      _ActionTile(
        icon: Icons.live_tv_rounded,
        label: 'Live Now',
        tint: Nocturne.redSoft,
        onTap: () => Navigator.pushNamed(context, '/live'),
      ),
      _ActionTile(
        icon: Icons.videocam_rounded,
        label: 'Creator Studio',
        tint: Nocturne.green,
        locked: !isCreator,
        onTap: () => Navigator.pushNamed(context, '/creator-studio'),
      ),
      _ActionTile(
        icon: Icons.campaign_rounded,
        label: 'Advertise',
        tint: Nocturne.green,
        onTap: () => Navigator.pushNamed(context, '/advertiser'),
      ),
      _ActionTile(
        icon: Icons.account_balance_wallet_rounded,
        label: 'Digital Assets',
        tint: Nocturne.green,
        onTap: () => Navigator.pushNamed(context, '/digital-assets'),
      ),
      _ActionTile(
        icon: Icons.verified_rounded,
        label: 'My Plan',
        tint: Nocturne.blue,
        onTap: () => Navigator.pushNamed(context, '/my-plan'),
        badge: planActive ? '${_planDaysLeft()}d' : 'START HERE',
        badgeFg: planActive ? Nocturne.blueSoft : Nocturne.blueSoft,
        badgeBg: planActive
            ? Nocturne.blue.withValues(alpha: 0.2)
            : Nocturne.blue.withValues(alpha: 0.2),
      ),
      _ActionTile(
        icon: Icons.notifications_active_rounded,
        label: 'My Reminders',
        tint: Nocturne.blue,
        onTap: () => Navigator.pushNamed(context, '/reminders'),
        badge: _remindersCount > 0 ? '$_remindersCount' : null,
        badgeFg: Colors.white,
        badgeBg: Nocturne.red,
      ),
      _ActionTile(
        icon: Icons.waves_rounded,
        label: 'Surf Waves',
        tint: Nocturne.blue,
        onTap: () => Navigator.pushNamed(context, '/wave'),
      ),
      if (_user != null && _user!.isAdmin)
        _ActionTile(
          icon: Icons.admin_panel_settings_rounded,
          label: 'Admin Panel',
          tint: Nocturne.gold,
          onTap: () => Navigator.pushNamed(context, '/admin-panel'),
        ),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _nocturneKicker(
              label: 'INSTANT ACTIONS',
              icon: Icons.bolt_rounded,
              color: Nocturne.blue,
            ),
          ),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            itemCount: tiles.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 0.98,
            ),
            itemBuilder: (context, i) => _nocturneActionCell(tiles[i]),
          ),
        ],
      ),
    );
  }

  Widget _nocturneActionCell(_ActionTile t) {
    return GestureDetector(
      onTap: t.locked ? null : t.onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.white.withValues(alpha: 0.02),
          border: Border.all(color: Nocturne.border, width: 1),
        ),
        padding: const EdgeInsets.fromLTRB(6, 12, 6, 10),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: t.tint.withValues(alpha: 0.14),
                  ),
                  child: Icon(
                    t.icon,
                    size: 17,
                    color: t.locked ? Nocturne.textHint : t.tint,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  t.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.locked ? Nocturne.textHint : Nocturne.textDim,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w500,
                    height: 1.25,
                  ),
                ),
              ],
            ),
            if (t.locked)
              const Positioned(
                top: 4,
                left: 4,
                child: Icon(Icons.lock_rounded,
                    size: 11, color: Nocturne.textHint),
              ),
            if (t.badge != null)
              Positioned(
                top: 4,
                right: 4,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: t.badgeBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    t.badge!,
                    style: TextStyle(
                      color: t.badgeFg,
                      fontSize: 8.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                    ),
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
    final cash = user.cash.toDouble();
    final vpt = (user.vptBalance > 0 ? user.vptBalance : user.vpt).toDouble();
    final ravens = user.coins.toDouble();
    final hasActive = user.hasActiveSubscription;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Segmented wallet strip
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Nocturne.radiusLg),
              gradient: Nocturne.walletGradient,
              border: Border.all(color: Nocturne.borderCard, width: 1),
            ),
            padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
            child: Row(
              children: [
                Expanded(
                  child: _walletCell(
                    label: 'CASH',
                    value: '₦${_formatMoney(cash)}',
                    icon: Icons.payments_rounded,
                    tint: Nocturne.goldLight,
                  ),
                ),
                _walletDivider(),
                Expanded(
                  child: _walletCell(
                    label: 'VPT OFFCHAIN',
                    value: vpt.toStringAsFixed(2),
                    icon: Icons.hexagon_rounded,
                    tint: Nocturne.green,
                  ),
                ),
                _walletDivider(),
                Expanded(
                  child: _walletCell(
                    label: 'RAVENS',
                    value: _formatNumber(ravens),
                    icon: Icons.favorite_rounded,
                    tint: Nocturne.redSoft,
                  ),
                ),
              ],
            ),
          ),
          const PangleSpotlightBanner(margin: EdgeInsets.only(top: 9)),
          const SizedBox(height: 9),
          // Plan CTA
          GestureDetector(
            onTap: () async {
              if (hasActive) {
                await Navigator.pushNamed(context, '/my-plan');
              } else {
                final result = await Navigator.pushNamed(context, '/plans');
                if (result == true) _loadData();
              }
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: Nocturne.goldCta,
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x38EF9615),
                    blurRadius: 18,
                    offset: Offset(0, 6),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    hasActive
                        ? Icons.workspace_premium_rounded
                        : Icons.diamond_rounded,
                    color: const Color(0xFF26170A),
                    size: 15,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    hasActive
                        ? '${user.subscriptionPlanDisplay} · Manage'
                        : 'Subscribe to a Plan',
                    style: const TextStyle(
                      color: Color(0xFF26170A),
                      fontSize: 14,
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

  String _formatMoney(double n) {
    final s = n.toStringAsFixed(2);
    final parts = s.split('.');
    final whole = parts[0];
    final buffer = StringBuffer();
    for (int i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
      buffer.write(whole[i]);
    }
    return '${buffer.toString()}.${parts[1]}';
  }

  Widget _walletCell({
    required String label,
    required String value,
    required IconData icon,
    required Color tint,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 12, color: tint),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.7,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Nocturne.text,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.1,
          ),
        ),
      ],
    );
  }

  Widget _walletDivider() => Container(
        width: 1,
        height: 34,
        color: Nocturne.borderCard,
      );

  // ── Shared Nocturne bits ──
  Widget _nocturneKicker({
    required String label,
    required IconData icon,
    required Color color,
  }) {
    return Row(
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 7),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1,
          ),
        ),
      ],
    );
  }

  Widget _nocturneFeaturedCard(PromotedChannel ch) {
    final hasBanner = (ch.bannerUrl ?? '').isNotEmpty;
    final palette = _paletteForName(ch.name);
    final initials = _initialsFor(ch.name);

    return GestureDetector(
      onTap: () async {
        await Navigator.pushNamed(context, '/channel-view', arguments: ch.id);
        _loadData();
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Nocturne.radiusLg),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Background — banner or gradient
            if (hasBanner)
              Image.network(
                AppConfig.mediaUrl(ch.bannerUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    Container(decoration: BoxDecoration(gradient: palette.bg)),
              )
            else
              Container(decoration: BoxDecoration(gradient: palette.bg)),
            // Inner hairline
            Container(
              decoration: BoxDecoration(
                border: Border.all(
                    color: Colors.white.withValues(alpha: 0.14), width: 1),
                borderRadius: BorderRadius.circular(Nocturne.radiusLg),
              ),
            ),
            // Wordmark centered
            if (!hasBanner)
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    ch.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.92),
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.6,
                      shadows: const [
                        Shadow(
                            color: Color(0x66000000),
                            blurRadius: 18,
                            offset: Offset(0, 2)),
                      ],
                    ),
                  ),
                ),
              ),
            // FEATURED pill
            Positioned(
              top: 10,
              right: 10,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Nocturne.gold,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'FEATURED',
                  style: TextStyle(
                    color: Color(0xFF241606),
                    fontSize: 8.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ),
            // Bottom info row
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      const Color(0xFF060B1C).withValues(alpha: 0.86),
                    ],
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: palette.mark,
                        image: (ch.logoUrl ?? '').isNotEmpty
                            ? DecorationImage(
                                image: NetworkImage(
                                    AppConfig.mediaUrl(ch.logoUrl!)),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: (ch.logoUrl ?? '').isEmpty
                          ? Text(
                              initials,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            ch.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (ch.category != null && ch.category!.isNotEmpty)
                            Text(
                              ch.category!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Nocturne.goldLight,
                                fontSize: 10.5,
                              ),
                            ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.play_circle_outline_rounded,
                      color: Colors.white.withValues(alpha: 0.85),
                      size: 20,
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

  _ChannelPalette _paletteForName(String name) {
    const palettes = <_ChannelPalette>[
      _ChannelPalette(
        bg: LinearGradient(colors: [Color(0xFFC9CEDE), Color(0xFF3C4266)],
            begin: Alignment.topLeft, end: Alignment.bottomRight),
        mark: Color(0xFF6D3FA8),
      ),
      _ChannelPalette(
        bg: LinearGradient(colors: [Color(0xFFC0271F), Color(0xFF7C130F)],
            begin: Alignment.topLeft, end: Alignment.bottomRight),
        mark: Color(0xFF1B1B1B),
      ),
      _ChannelPalette(
        bg: LinearGradient(colors: [Color(0xFF1B63C4), Color(0xFF0B2F6B)],
            begin: Alignment.topLeft, end: Alignment.bottomRight),
        mark: Color(0xFF0E4FA1),
      ),
      _ChannelPalette(
        bg: LinearGradient(colors: [Color(0xFF8A2FBE), Color(0xFF3D1266)],
            begin: Alignment.topLeft, end: Alignment.bottomRight),
        mark: Color(0xFF8A2FBE),
      ),
      _ChannelPalette(
        bg: LinearGradient(colors: [Color(0xFF4A3350), Color(0xFF1D1424)],
            begin: Alignment.topLeft, end: Alignment.bottomRight),
        mark: Color(0xFF7A4A63),
      ),
    ];
    if (name.isEmpty) return palettes.first;
    final idx = name.codeUnits.fold<int>(0, (a, b) => a + b) % palettes.length;
    return palettes[idx];
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
        color: const Color(0xFF5FD39A),
        route: '/referral',
      ),
    ];
    final current = ads[_adBannerIndex];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: BannerAdWidget(placement: 'home'),
          ),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, current.route),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 500),
              transitionBuilder: (child, animation) =>
                  FadeTransition(opacity: animation, child: child),
              child: Container(
                key: ValueKey<int>(_adBannerIndex),
                width: double.infinity,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      current.color.withValues(alpha: 0.14),
                      current.color.withValues(alpha: 0.02),
                    ],
                  ),
                  border: Border.all(
                    color: const Color(0xFF4A3A1A),
                    width: 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: current.color.withValues(alpha: 0.18),
                      ),
                      child: Icon(current.icon,
                          color: Nocturne.goldLight, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'SPOTLIGHT',
                            style: TextStyle(
                              color: Nocturne.gold,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            current.title,
                            style: const TextStyle(
                              color: Nocturne.text,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            current.subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Nocturne.textMuted,
                              fontSize: 11.5,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.chevron_right_rounded,
                        color: Nocturne.gold, size: 18),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ───────── UPDATES/ANNOUNCEMENTS TABBED CARD + HIGHLIGHTS ─────────
  Widget _buildTwoColumnSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const PangleNativeAd(
            height: 300,
            margin: EdgeInsets.only(bottom: 14),
          ),
          // Updates tabbed card
          Container(
            decoration: BoxDecoration(
              color: Nocturne.surfaceRaised,
              borderRadius: BorderRadius.circular(Nocturne.radiusLg),
              border: Border.all(color: Nocturne.borderCard, width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(13, 11, 13, 0),
                  child: Row(
                    children: [
                      _feedTab('Updates', _feedTabValue == 'updates',
                          () => setState(() => _feedTabValue = 'updates')),
                      const SizedBox(width: 14),
                      _feedTab('Announcements', _feedTabValue == 'ann',
                          () => setState(() => _feedTabValue = 'ann')),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(
                            context,
                            _feedTabValue == 'ann'
                                ? '/announcements'
                                : '/updates-list'),
                        child: const Padding(
                          padding: EdgeInsets.only(bottom: 9),
                          child: Text(
                            'See all',
                            style: TextStyle(
                              color: Nocturne.gold,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(height: 1, color: Nocturne.border),
                if (_feedTabValue == 'updates')
                  if (_updates.isEmpty)
                    _feedEmpty('Product updates will appear here')
                  else
                    ..._updates.take(3).map((u) {
                      final body = (u['body'] as String?) ??
                          (u['summary'] as String? ?? '');
                      return _feedItem(
                        icon: _getIconForString(u['icon'] as String? ?? ''),
                        title: u['title'] as String? ?? '',
                        body: body,
                        onTap: () =>
                            Navigator.pushNamed(context, '/updates-list'),
                        cta: 'Read more',
                        bordered: u != _updates.first || true,
                      );
                    })
                else if (_announcements.isEmpty)
                  _feedEmpty('Announcements from Admin will appear here')
                else
                  ..._announcements.take(3).map((a) => _feedItem(
                        icon: _getIconForString(a.icon),
                        title: a.title,
                        body: a.body,
                        onTap: () =>
                            Navigator.pushNamed(context, '/announcements'),
                        cta: 'Read',
                        bordered: true,
                      )),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Highlights
          _nocturneKicker(
            label: 'HIGHLIGHTS',
            icon: Icons.show_chart_rounded,
            color: Nocturne.textFaint,
          ),
          const SizedBox(height: 9),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 3.4,
            children: [
              _highlightStat(Icons.groups_rounded, 'Members',
                  '${_stats?.totalMembers ?? 0}', Nocturne.text),
              _highlightStat(Icons.tv_rounded, 'Channels',
                  '${_stats?.totalChannels ?? 0}', Nocturne.text),
              _highlightStat(Icons.hexagon_rounded, 'Your vPT',
                  _formatNumber(_user?.vpt ?? 0), Nocturne.goldLight),
              _highlightStat(
                  Icons.star_rounded,
                  'Plan',
                  (_user?.subscriptionPlanDisplay ?? 'NONE').toUpperCase(),
                  Nocturne.goldLight),
            ],
          ),
          const PangleNativeAd(
            height: 300,
            margin: EdgeInsets.only(top: 14),
          ),
        ],
      ),
    );
  }

  Widget _feedTab(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.only(bottom: 9),
        decoration: active
            ? const BoxDecoration(
                border: Border(
                    bottom: BorderSide(color: Nocturne.gold, width: 2)),
              )
            : null,
        child: Text(
          label,
          style: TextStyle(
            color: active ? Nocturne.text : Nocturne.textHint,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _feedEmpty(String msg) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 14),
        child: Text(
          msg,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Nocturne.textHint, fontSize: 11.5),
        ),
      );

  Widget _feedItem({
    required IconData icon,
    required String title,
    required String body,
    required VoidCallback onTap,
    required String cta,
    bool bordered = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: bordered
          ? const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Color(0xB222325E), width: 1),
              ),
            )
          : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(9),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 15, color: Nocturne.goldLight),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 11,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onTap,
            child: Text(
              cta,
              style: const TextStyle(
                color: Nocturne.gold,
                fontSize: 10.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _highlightStat(
      IconData icon, String label, String value, Color valueColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: Nocturne.border, width: 1),
      ),
      child: Row(
        children: [
          Icon(icon, size: 15, color: Nocturne.textFaint),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Nocturne.textMuted, fontSize: 11),
            ),
          ),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: valueColor,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ───────── MY SUBSCRIPTIONS CARD (Nocturne row) ─────────
  Widget _buildMySubscriptionsCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: GestureDetector(
        onTap: () => Navigator.pushNamed(
          context,
          '/my-subscriptions',
        ).then((_) => _loadSubscriptionCount()),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.02),
            borderRadius: BorderRadius.circular(Nocturne.radiusLg),
            border: Border.all(color: Nocturne.border, width: 1),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Nocturne.gold.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.style_outlined,
                    color: Nocturne.goldLight, size: 17),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'My Subscriptions',
                      style: TextStyle(
                        color: Nocturne.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '$_subscriptionCount active subscription${_subscriptionCount == 1 ? '' : 's'}',
                      style: const TextStyle(
                        color: Nocturne.textMuted,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded,
                  color: Nocturne.textHint, size: 18),
            ],
          ),
        ),
      ),
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

class _ActionTile {
  final IconData icon;
  final String label;
  final Color tint;
  final VoidCallback onTap;
  final bool locked;
  final String? badge;
  final Color badgeFg;
  final Color badgeBg;
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.tint,
    required this.onTap,
    this.locked = false,
    this.badge,
    this.badgeFg = Colors.white,
    this.badgeBg = Nocturne.gold,
  });
}

class _LiveDot extends StatelessWidget {
  const _LiveDot();
  @override
  Widget build(BuildContext context) => Container(
        width: 5,
        height: 5,
        decoration: const BoxDecoration(
          color: Nocturne.green,
          shape: BoxShape.circle,
        ),
      );
}

class _ChannelPalette {
  final LinearGradient bg;
  final Color mark;
  const _ChannelPalette({required this.bg, required this.mark});
}

class _NavItem {
  final String label;
  final IconData icon;
  final double size;
  const _NavItem({required this.label, required this.icon, required this.size});
}

class _NavButton extends StatelessWidget {
  final _NavItem item;
  final bool active;
  final VoidCallback onTap;
  const _NavButton({required this.item, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? Nocturne.gold : Nocturne.textHint;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(item.icon, color: color, size: item.size),
            const SizedBox(height: 4),
            Text(
              item.label,
              style: TextStyle(
                color: color,
                fontSize: 9.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
