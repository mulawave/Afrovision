import '../../../core/ads/pangle_widgets.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../../subscription/models/channel_subscription_model.dart';
import '../../subscription/screens/channel_subscription_screen.dart';
import '../../subscription/services/channel_subscription_service.dart';
import '../../subscription/widgets/exclusive_membership_sheets.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/auth_service.dart';
import '../../broadcast/models/channel_library_models.dart';
import '../../broadcast/services/channel_library_service.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';
import '../models/media_center_hero_model.dart';
import '../models/movie_model.dart';
import '../models/series_model.dart';
import '../services/media_center_service.dart';
import '../services/vod_service.dart';
import '../../../core/utils/image_cache_key.dart';
import 'catch_up_tab.dart';
import 'movie_detail_screen.dart';
import 'series_detail_screen.dart';

enum _MediaTab { catchUp, movies, series, library }

class MediaCenterScreen extends StatefulWidget {
  const MediaCenterScreen({super.key});

  @override
  State<MediaCenterScreen> createState() => _MediaCenterScreenState();
}

class _MediaCenterScreenState extends State<MediaCenterScreen>
    with AutomaticKeepAliveClientMixin, TickerProviderStateMixin {
  late final TabController _tabController;
  final _catchUpKey = GlobalKey<CatchUpTabState>();
  bool _loading = true;
  String? _error;
  List<MovieModel> _movies = [];
  List<SeriesModel> _series = [];
  List<_ExclusiveMovie> _exclusiveMovies = [];
  List<_ExclusiveSeries> _exclusiveSeries = [];
  List<ChannelSubscriptionModel> _expiringSoon = [];
  List<ChannelSubscriptionModel> _expiredExclusive = [];
  List<_LibraryEntry> _libraryItems = const <_LibraryEntry>[];
  bool _libraryLoading = false;
  List<ChannelModel> _nonMemberExclusive = const <ChannelModel>[];
  UserModel? _currentUser;
  bool _bannerDismissed = false;

  /// Filter chip active for the current tab. `'all'` means unfiltered.
  /// See `_buildChipRow` for the full set. `_activeChip` is a tapped chip;
  /// tapping the same chip again does NOT reset — the `All` chip is the
  /// explicit clear (per media_center_completion.md Phase 1).
  String _activeChip = 'all';
  _MediaTab _tab = _MediaTab.catchUp;

  /// Media Center hero banners loaded from GET /media-center/heroes.
  /// Empty on failure or when admin has published nothing.
  List<MediaCenterHero> _heroes = const <MediaCenterHero>[];

  /// Continue-watching items across every media type — populates the
  /// Continue Watching rail on Movies and Series tabs. Empty hides the rail.
  List<ContinueWatchingItem> _continueWatching =
      const <ContinueWatchingItem>[];

  /// Number of seconds considered "this week" for the New This Week rail.
  static const int _kNewThisWeekWindowSec = 7 * 86400;

  static const int _kExpiringWindowDays = 7;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _MediaTab.values.length, vsync: this)
      ..addListener(_onTabControllerChanged);
    _loadData();
    _loadLibrary();
    _loadHeroes();
    _loadContinueWatching();
  }

  /// Keeps `_tab` (the enum every render branch switches on) in sync with
  /// swipe gestures on the TabBarView, not just explicit tab-button taps.
  void _onTabControllerChanged() {
    final next = _MediaTab.values[_tabController.index];
    if (next == _tab) return;
    setState(() => _tab = next);
    if (next == _MediaTab.library) _loadLibrary();
  }

  @override
  void dispose() {
    _tabController
      ..removeListener(_onTabControllerChanged)
      ..dispose();
    super.dispose();
  }

  /// Continue-watching items — fail-tolerant. Empty list hides the rail.
  Future<void> _loadContinueWatching() async {
    try {
      final items = await VodService.getContinueWatchingCached(
        onCached: (cached) {
          if (!mounted) return;
          setState(() => _continueWatching = cached);
        },
      );
      if (!mounted) return;
      setState(() => _continueWatching = items);
    } catch (_) {
      if (!mounted) return;
      setState(() => _continueWatching = const <ContinueWatchingItem>[]);
    }
  }

  /// Media Center hero banners — fail-tolerant. Empty list hides the rail.
  Future<void> _loadHeroes() async {
    try {
      final heroes = await MediaCenterService.getHeroesCached(
        onCached: (cached) {
          if (!mounted) return;
          setState(() => _heroes = cached);
        },
      );
      if (!mounted) return;
      setState(() => _heroes = heroes);
    } catch (_) {
      if (!mounted) return;
      setState(() => _heroes = const <MediaCenterHero>[]);
    }
  }

  /// Aggregates readable library items (books, magazines, comics, journals)
  /// from every exclusive channel the user is an active member of.
  ///
  /// Membership rule (per media_center_completion.md Phase 2): ANY active
  /// membership counts, regardless of whether it carries a fee. The
  /// fee-based rule (`amount > 0 || isPremium`) only governs Renew/paywall
  /// surfaces — it must not gate content visibility for fee-free/comped
  /// memberships (e.g. admin-granted or referral-based access).
  ///
  /// Fail-tolerant per-channel fetch — a failing channel is skipped, others
  /// still surface.
  Future<void> _loadLibrary() async {
    if (_libraryLoading) return;
    setState(() => _libraryLoading = true);
    try {
      final res = await ChannelSubscriptionService.getMine();
      if (res['success'] != true) {
        if (!mounted) return;
        setState(() {
          _libraryItems = const <_LibraryEntry>[];
          _libraryLoading = false;
        });
        return;
      }
      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final subs = (res['subscriptions'] as List<dynamic>? ?? [])
          .whereType<ChannelSubscriptionModel>()
          .where((s) {
            if (!s.isActive) return false;
            final nb = s.nextBilling;
            return nb == null || nb > nowSec;
          })
          .toList();
      if (subs.isEmpty) {
        if (!mounted) return;
        setState(() {
          _libraryItems = const <_LibraryEntry>[];
          _libraryLoading = false;
        });
        return;
      }

      final calls = subs
          .map((s) => ChannelLibraryService.getChannelLibraryCached(
                s.channelId,
                limit: 48,
              ).catchError((_) => const ChannelLibraryListResponse(
                    items: <ChannelLibraryItemModel>[],
                    page: 1,
                    limit: 48,
                    total: 0,
                    pages: 1,
                  )))
          .toList();
      final results = await Future.wait(calls);

      final items = <_LibraryEntry>[];
      for (int i = 0; i < subs.length; i++) {
        final s = subs[i];
        final resp = results[i];
        for (final it in resp.items) {
          items.add(_LibraryEntry(
            item: it,
            channelName: s.channelName,
            channelTag: _tagFor(s.channelName),
          ));
        }
      }
      if (!mounted) return;
      setState(() {
        _libraryItems = items;
        _libraryLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _libraryItems = const <_LibraryEntry>[];
        _libraryLoading = false;
      });
    }
  }

  void _openLibraryItem(_LibraryEntry entry) {
    Navigator.of(context).pushNamed(
      '/channel-library/item',
      arguments: {
        'channelId': entry.item.channelId,
        'itemId': entry.item.id,
      },
    );
  }

  Future<void> _loadData() async {
    // Never show the full-screen spinner if we already have paint-ready data
    // from a previous load — cache-first surfacing does that job.
    final hasAny = _movies.isNotEmpty ||
        _series.isNotEmpty ||
        _exclusiveMovies.isNotEmpty ||
        _exclusiveSeries.isNotEmpty;
    setState(() {
      _loading = !hasAny;
      _error = null;
    });
    try {
      final results = await Future.wait([
        VodService.getPublicMoviesCached(
          limit: 12,
          onCached: (r) {
            if (!mounted) return;
            setState(() {
              _movies = r.movies;
              _loading = false;
            });
          },
        ),
        VodService.getPublicSeriesCached(
          limit: 12,
          onCached: (r) {
            if (!mounted) return;
            setState(() {
              _series = r.series;
              _loading = false;
            });
          },
        ),
        _loadExclusive(),
        _loadNonMemberExclusive(),
      ]);
      final movieResponse = results[0] as MovieListResponse;
      final seriesResponse = results[1] as SeriesListResponse;
      final exclusive = results[2] as _ExclusiveBundle;
      if (!mounted) return;
      setState(() {
        _movies = movieResponse.movies;
        _series = seriesResponse.series;
        _exclusiveMovies = exclusive.movies;
        _exclusiveSeries = exclusive.series;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  /// Aggregates movies and series across every exclusive channel the user
  /// currently holds an active membership in. A membership is treated as
  /// exclusive when the plan carries a fee (amount > 0) or the model flags
  /// it as premium — matching the "fee > 0 == exclusive" rule.
  ///
  /// Failure of any single channel's fetch never sinks the whole load: it
  /// is swallowed silently so the remaining channels still surface.
  /// Load the exclusive channels the user is NOT a member of, so the
  /// Media Center can surface an About/Request info card per channel
  /// (state K in the design). Non-KYC users see nothing here — the guard
  /// keeps discovery quiet until they verify.
  ///
  /// Fail-tolerant: on any error, non-member cards simply don't render.
  Future<void> _loadNonMemberExclusive() async {
    try {
      final userFuture = AuthService.getCurrentUser().then<UserModel?>((u) => u);
      final channelsFuture = ChannelService.getPublicChannels()
          .then<List<ChannelModel>>((c) => c)
          .catchError((_) => const <ChannelModel>[]);
      final subsFuture = ChannelSubscriptionService.getMine();

      final user = await userFuture;
      final channels = await channelsFuture;
      final subsRes = await subsFuture;

      // Every channel_id the user has ANY membership record for — active,
      // expired, cancelled. All of those already produce their own surface
      // (content shelf / renew card), so the info card shouldn't duplicate.
      final coveredIds = <String>{};
      if (subsRes['success'] == true) {
        for (final s in (subsRes['subscriptions'] as List<dynamic>? ?? [])
            .whereType<ChannelSubscriptionModel>()) {
          coveredIds.add(s.channelId);
        }
      }

      // State D (design): a KYC-unverified non-member must see no trace of
      // the exclusive channel at all — not even the About/Request card.
      // Previously this filter only checked isExclusive/membership, so an
      // unverified user's state D silently collapsed into state C (the
      // discovery card), leaking the channel's existence pre-KYC.
      final nonMember = (user != null && user.kycVerified)
          ? channels
              .where((c) => c.isExclusive && !coveredIds.contains(c.id))
              .toList()
          : const <ChannelModel>[];

      if (!mounted) return;
      setState(() {
        _currentUser = user;
        _nonMemberExclusive = nonMember;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _nonMemberExclusive = const <ChannelModel>[];
      });
    }
  }

  Future<_ExclusiveBundle> _loadExclusive() async {
    try {
      final res = await ChannelSubscriptionService.getMine();
      if (res['success'] != true) return const _ExclusiveBundle.empty();
      // Split memberships (per media_center_completion.md Phase 2):
      //   - allMemberships → drives the CONTENT shelves (any active membership,
      //     regardless of whether it carries a fee). This fixes admin-granted
      //     / referral-comped Xlounge Extreme memberships not surfacing.
      //   - feeBasedMemberships → drives Renew card / paywall (the fee-based
      //     rule still applies for money-moving flows).
      final all = (res['subscriptions'] as List<dynamic>? ?? [])
          .whereType<ChannelSubscriptionModel>()
          .toList();
      if (all.isEmpty) return const _ExclusiveBundle.empty();

      final feeBased = all.where((s) => s.amount > 0 || s.isPremium).toList();

      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final windowSec = _kExpiringWindowDays * 86400;

      // Entitled (fetch content): ANY active + not-yet-past-billing membership.
      final subs = all.where((s) {
        if (!s.isActive) return false;
        final nb = s.nextBilling;
        return nb == null || nb > nowSec;
      }).toList();

      // Expired (render a Renew card in place of the shelf). Fee-based only —
      // fee-free memberships don't have a paywall to renew back into.
      final expired = feeBased.where((s) {
        if (!s.isActive) return true;
        final nb = s.nextBilling;
        return nb != null && nb <= nowSec;
      }).toList();

      // Expiring within N days (banner + still entitled).
      final expiringSoon = subs.where((s) {
        final nb = s.nextBilling;
        if (nb == null) return false;
        return nb > nowSec && nb - nowSec <= windowSec;
      }).toList();

      if (mounted) {
        setState(() {
          _expiringSoon = expiringSoon;
          _expiredExclusive = expired;
        });
      }

      // Kick off every channel's movies + series in parallel, cache-first.
      // The onCached callbacks paint the previously-known list instantly,
      // then the awaited results overwrite with fresh data.
      final calls = <Future<List<dynamic>>>[];
      for (final s in subs) {
        calls.add(
          VodService.getChannelMoviesCached(
            s.channelId,
            onCached: (m) => _appendExclusiveCached(s, m, series: false),
          ).catchError((_) => <MovieModel>[]),
        );
        calls.add(
          VodService.getChannelSeriesCached(
            s.channelId,
            onCached: (m) => _appendExclusiveCached(s, m, series: true),
          ).catchError((_) => <SeriesModel>[]),
        );
      }
      final results = await Future.wait(calls);

      final movies = <_ExclusiveMovie>[];
      final series = <_ExclusiveSeries>[];
      for (int i = 0; i < subs.length; i++) {
        final s = subs[i];
        final tag = _tagFor(s.channelName);
        final mList = results[i * 2];
        final sList = results[i * 2 + 1];
        for (final m in mList.whereType<MovieModel>()) {
          movies.add(_ExclusiveMovie(m, s.channelName, tag));
        }
        for (final se in sList.whereType<SeriesModel>()) {
          series.add(_ExclusiveSeries(se, s.channelName, tag));
        }
      }
      return _ExclusiveBundle(movies: movies, series: series);
    } catch (_) {
      return const _ExclusiveBundle.empty();
    }
  }

  /// Splice cached exclusive-channel content into the visible list as soon
  /// as it comes back from SectionCache, so the exclusive shelf paints
  /// before the network round-trip completes. Dedupes on movie/series id
  /// per channel so the fresh network response cleanly overwrites without
  /// leaving orphans.
  void _appendExclusiveCached(
    ChannelSubscriptionModel s,
    List<dynamic> items, {
    required bool series,
  }) {
    if (!mounted || items.isEmpty) return;
    final tag = _tagFor(s.channelName);
    setState(() {
      _loading = false;
      if (series) {
        final existing = _exclusiveSeries
            .where((e) => e.channelName != s.channelName)
            .toList();
        for (final it in items.whereType<SeriesModel>()) {
          existing.add(_ExclusiveSeries(it, s.channelName, tag));
        }
        _exclusiveSeries = existing;
      } else {
        final existing = _exclusiveMovies
            .where((e) => e.channelName != s.channelName)
            .toList();
        for (final it in items.whereType<MovieModel>()) {
          existing.add(_ExclusiveMovie(it, s.channelName, tag));
        }
        _exclusiveMovies = existing;
      }
    });
  }

  static String _tagFor(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '★';
    if (parts.length == 1) {
      return parts.first.substring(0, parts.first.length.clamp(0, 3)).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: Nocturne.gold,
          backgroundColor: Nocturne.surfaceRaised,
          onRefresh: _loadData,
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    // NestedScrollView keeps the header/chips/tab-bar in the outer scroll
    // while the TabBarView body swipes between Movies / Series / Library —
    // each tab gets its own independent scroll position.
    return NestedScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      headerSliverBuilder: (context, innerBoxIsScrolled) => [
        SliverToBoxAdapter(child: _buildHeader()),
        if (_shouldShowExpiringBanner)
          SliverToBoxAdapter(child: _buildExpiringBanner()),
        if (_heroes.isNotEmpty)
          SliverToBoxAdapter(child: _buildHeroRail()),
        SliverToBoxAdapter(child: _buildChipRow()),
        SliverToBoxAdapter(child: _buildTabs()),
      ],
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildTabBody(_MediaTab.catchUp, const PageStorageKey('mc_catchup')),
          _buildTabBody(_MediaTab.movies, const PageStorageKey('mc_movies')),
          _buildTabBody(_MediaTab.series, const PageStorageKey('mc_series')),
          _buildTabBody(_MediaTab.library, const PageStorageKey('mc_library')),
        ],
      ),
    );
  }

  /// One swipeable page of the TabBarView — independently scrollable so
  /// each tab keeps its own scroll offset while swiping between them.
  Widget _buildTabBody(_MediaTab tab, Key key) {
    return RefreshIndicator(
      key: ValueKey('refresh_$tab'),
      onRefresh: () => _refreshTab(tab),
      color: Nocturne.gold,
      backgroundColor: Nocturne.surfaceRaised,
      child: SingleChildScrollView(
        key: key,
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            tab == _MediaTab.catchUp
                ? CatchUpTab(key: _catchUpKey)
                : _buildTabContent(tab),
            const PangleBigBanner(),
          ],
        ),
      ),
    );
  }

  Future<void> _refreshTab(_MediaTab tab) async {
    final futures = <Future<void>>[
      _loadContinueWatching(),
      _loadHeroes(),
    ];
    switch (tab) {
      case _MediaTab.catchUp:
        final catchUp = _catchUpKey.currentState;
        if (catchUp != null) futures.add(catchUp.refresh());
        break;
      case _MediaTab.library:
        futures.add(_loadLibrary());
        break;
      case _MediaTab.movies:
      case _MediaTab.series:
        futures.add(_loadData());
        break;
    }
    await Future.wait(futures);
  }

  // ───────── HERO RAIL (Phase 4) ─────────
  Widget _buildHeroRail() {
    return _HeroRail(
      heroes: _heroes,
      onOpen: _openHero,
    );
  }

  void _openHero(MediaCenterHero hero) {
    switch (hero.linkType) {
      case 'movie':
        Navigator.of(context).pushNamed(
          '/movie',
          arguments: {'movieId': hero.linkTarget},
        );
        break;
      case 'series':
        Navigator.of(context).pushNamed(
          '/series',
          arguments: {'seriesId': hero.linkTarget},
        );
        break;
      case 'channel':
        Navigator.of(context).pushNamed(
          '/channel-view',
          arguments: {'channelId': hero.linkTarget},
        );
        break;
      case 'url':
      default:
        // External URL handling left to app-level launcher (out of scope here).
        break;
    }
  }

  bool get _shouldShowExpiringBanner =>
      !_bannerDismissed && _expiringSoon.isNotEmpty;

  /// The nearest-to-expiry sub — the one the banner names first.
  ChannelSubscriptionModel? get _leadExpiring {
    if (_expiringSoon.isEmpty) return null;
    final sorted = [..._expiringSoon]
      ..sort((a, b) => (a.nextBilling ?? 0).compareTo(b.nextBilling ?? 0));
    return sorted.first;
  }

  int _daysLeftFor(ChannelSubscriptionModel s) {
    final nb = s.nextBilling;
    if (nb == null) return 0;
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final left = ((nb - now) / 86400).ceil();
    return left < 0 ? 0 : left;
  }

  Widget _buildExpiringBanner() {
    final s = _leadExpiring!;
    final daysLeft = _daysLeftFor(s);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF17224A),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFA8761F), width: 1),
        ),
        padding: const EdgeInsets.fromLTRB(12, 11, 8, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: Nocturne.goldSoft,
                  shape: BoxShape.circle,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Your ${s.channelName} membership ends in $daysLeft ${daysLeft == 1 ? 'day' : 'days'}',
                    style: const TextStyle(
                      color: Color(0xFFFDF3E2),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Renew to keep watching exclusive movies, series and your library.',
                    style: const TextStyle(
                      color: Nocturne.goldLight,
                      fontSize: 11.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => _openRenewFor(s, expired: false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Nocturne.gold, width: 1),
                      ),
                      child: const Text(
                        'Renew now',
                        style: TextStyle(
                          color: Nocturne.goldLight,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            GestureDetector(
              onTap: () => setState(() => _bannerDismissed = true),
              child: const SizedBox(
                width: 22,
                height: 22,
                child: Icon(Icons.close_rounded,
                    color: Color(0xFFC2A06A), size: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openRenewFor(
    ChannelSubscriptionModel s, {
    required bool expired,
  }) async {
    final tag = _tagFor(s.channelName);
    final expiryDate = s.nextBilling == null
        ? '—'
        : _formatDate(DateTime.fromMillisecondsSinceEpoch(s.nextBilling! * 1000));
    final planName = s.isPremium ? 'Premium' : 'Membership';
    final planPrice = s.amount > 0
        ? '${s.currency ?? 'NGN'} ${s.amount.toStringAsFixed(0)} / ${s.intervalUnit}'
        : 'Free';
    await showRenewSheet(
      context,
      channelName: s.channelName,
      channelTag: tag,
      planName: planName,
      planPrice: planPrice,
      expiryDate: expiryDate,
      expired: expired,
      onConfirm: () {
        // Push the existing subscription screen — it owns the Play Billing
        // hand-off. Refresh Media Center after it returns.
        Navigator.of(context)
            .push(MaterialPageRoute(
              builder: (_) => const ChannelSubscriptionScreen(),
              settings: RouteSettings(arguments: {
                'channelId': s.channelId,
                'channelName': s.channelName,
                'isPremium': s.isPremium,
                'priceNgn': s.amount,
                'intervalUnit': s.intervalUnit,
              }),
            ))
            .then((_) => _loadData());
      },
    );
  }

  String _formatDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  // ───────── HEADER ─────────
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: const [
                Text(
                  'AFROVISION',
                  style: TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 1.2,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Media Center',
                  style: TextStyle(
                    color: Nocturne.text,
                    fontSize: 21,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
          _headerIconBtn(
            icon: Icons.search_rounded,
            onTap: () => Navigator.of(context).pushNamed('/media/search'),
          ),
          const SizedBox(width: 8),
          _headerIconBtn(
            icon: Icons.history_rounded,
            onTap: () => Navigator.of(context).pushNamed('/watch-history'),
          ),
          const SizedBox(width: 8),
          _headerPillBtn(
            label: 'Tune in',
            onTap: () => Navigator.pushNamed(context, '/channel-access'),
          ),
        ],
      ),
    );
  }

  Widget _headerIconBtn({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Nocturne.border, width: 1),
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 17, color: Nocturne.text),
      ),
    );
  }

  Widget _headerPillBtn({required String label, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Nocturne.border, width: 1),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            color: Nocturne.textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  // ───────── CHIPS ─────────
  /// Chip labels + their filter keys. Toggle-select; tapping the active
  /// chip resets to `'all'`. Filters apply to the Movies + Series tabs;
  /// the Library and Catch-up tabs are not filterable, so chips are hidden.
  static const List<MapEntry<String, String>> _chipDefs = [
    MapEntry('All', 'all'),
    MapEntry('New', 'new'),
    MapEntry('Trending', 'trending'),
    MapEntry('Free', 'free'),
    MapEntry('Exclusive', 'exclusive'),
  ];

  // Trailing fade width — signals "more chips this way" instead of an abrupt
  // clip at the screen edge, which is what read as "garbled/broken" text.
  static const double _chipFadeWidth = 28;

  Widget _buildChipRow() {
    if (_tab == _MediaTab.catchUp) return const SizedBox.shrink();
    return SizedBox(
      height: 40,
      child: ShaderMask(
        shaderCallback: (bounds) {
          final fadeStart =
              (1 - (_chipFadeWidth / bounds.width)).clamp(0.0, 1.0);
          return LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: const [Colors.black, Colors.black, Colors.transparent],
            stops: [0.0, fadeStart, 1.0],
          ).createShader(bounds);
        },
        blendMode: BlendMode.dstIn,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(20, 0, 20 + _chipFadeWidth, 14),
          children: [
            for (final c in _chipDefs) ...[
              _chip(c.key, c.value),
              const SizedBox(width: 8),
            ],
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, String key) {
    final active = _activeChip == key;
    return GestureDetector(
      onTap: () {
        // Per media_center_completion.md Phase 1: taps always set the chip
        // active. `All` is the explicit clear — never a toggle-off.
        if (_activeChip != key) setState(() => _activeChip = key);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Nocturne.gold.withValues(alpha: 0.14) : null,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? Nocturne.gold : Nocturne.border,
            width: 1,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          maxLines: 1,
          softWrap: false,
          overflow: TextOverflow.visible,
          style: TextStyle(
            color: active ? Nocturne.goldLight : Nocturne.textMuted,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            height: 1.0,
          ),
        ),
      ),
    );
  }

  // ── Filter/sort helpers driven by _activeChip ─────────────────────────
  //
  // Semantics (Phase 1):
  //   - `all`       → show both public + exclusive shelves
  //   - `new`       → sort by publishedAt/createdAt desc, no visibility filter
  //   - `trending`  → sort by totalViews desc (movies) / release recency (series)
  //   - `free`      → hide exclusive shelf, show public only
  //   - `exclusive` → hide public shelf, show exclusive only
  //
  // Empty results render `_chipEmptyState()` per-tab so we NEVER paint a
  // blank tab body.

  bool get _hideExclusive => _activeChip == 'free';
  bool get _hidePublic => _activeChip == 'exclusive';

  List<MovieModel> _shapedMovies() {
    if (_hidePublic) return const <MovieModel>[];
    final base = [..._movies];
    if (_activeChip == 'new') {
      base.sort((a, b) =>
          (b.publishedAt ?? b.createdAt).compareTo(a.publishedAt ?? a.createdAt));
    } else if (_activeChip == 'trending') {
      base.sort((a, b) => b.totalViews.compareTo(a.totalViews));
    }
    return base;
  }

  List<SeriesModel> _shapedSeries() {
    if (_hidePublic) return const <SeriesModel>[];
    final base = [..._series];
    if (_activeChip == 'new') {
      base.sort((a, b) =>
          (b.publishedAt ?? b.createdAt).compareTo(a.publishedAt ?? a.createdAt));
    }
    return base;
  }

  /// Human-readable label for the active chip. Used by empty-state strings.
  String _activeChipLabel() {
    for (final c in _chipDefs) {
      if (c.value == _activeChip) return c.key;
    }
    return 'All';
  }

  /// Empty state rendered when a chip filter drops the tab's dataset to zero.
  Widget _chipEmptyState({required IconData icon, required String kind}) {
    return _emptyState(
      'No ${_activeChipLabel()} $kind content yet.\nTry another filter.',
      icon,
    );
  }

  List<_ExclusiveMovie> _shapedExclusiveMovies() {
    if (_hideExclusive) return const <_ExclusiveMovie>[];
    final base = [..._exclusiveMovies];
    if (_activeChip == 'new') {
      base.sort((a, b) => (b.movie.publishedAt ?? b.movie.createdAt)
          .compareTo(a.movie.publishedAt ?? a.movie.createdAt));
    } else if (_activeChip == 'trending') {
      base.sort((a, b) => b.movie.totalViews.compareTo(a.movie.totalViews));
    }
    return base;
  }

  String _labelForPublicMovies() {
    switch (_activeChip) {
      case 'new':
        return 'New movies';
      case 'trending':
        return 'Trending movies';
      case 'free':
        return 'Free movies';
      default:
        return 'Popular on AfroVision';
    }
  }

  String _labelForPublicSeries() {
    switch (_activeChip) {
      case 'new':
        return 'New series';
      case 'trending':
        return 'Trending series';
      case 'free':
        return 'Free series';
      default:
        return 'Series for you';
    }
  }

  List<_ExclusiveSeries> _shapedExclusiveSeries() {
    if (_hideExclusive) return const <_ExclusiveSeries>[];
    final base = [..._exclusiveSeries];
    if (_activeChip == 'new') {
      base.sort((a, b) => (b.series.publishedAt ?? b.series.createdAt)
          .compareTo(a.series.publishedAt ?? a.series.createdAt));
    }
    return base;
  }

  // ───────── TABS ─────────
  Widget _buildTabs() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Nocturne.border, width: 1)),
      ),
      child: Row(
        children: [
          _tabButton('Catch Up', _MediaTab.catchUp),
          const SizedBox(width: 20),
          _tabButton('Movies', _MediaTab.movies),
          const SizedBox(width: 20),
          _tabButton('Series', _MediaTab.series),
          const SizedBox(width: 20),
          _tabButton('Library', _MediaTab.library),
        ],
      ),
    );
  }

  Widget _tabButton(String label, _MediaTab which) {
    final active = _tab == which;
    return GestureDetector(
      onTap: () => _tabController.animateTo(_MediaTab.values.indexOf(which)),
      child: Container(
        padding: const EdgeInsets.fromLTRB(0, 8, 0, 11),
        decoration: active
            ? const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: Nocturne.gold, width: 2),
                ),
              )
            : null,
        child: Text(
          label,
          style: TextStyle(
            color: active ? Nocturne.text : Nocturne.textFaint,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  // ───────── TAB CONTENT ─────────
  Widget _buildTabContent(_MediaTab tab) {
    if (tab == _MediaTab.catchUp) return const CatchUpTab();
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 60),
        child: Center(child: CircularProgressIndicator(color: Nocturne.gold)),
      );
    }
    if (_error != null) return _buildError(_error!);

    switch (tab) {
      case _MediaTab.movies:
        final exMovies = _shapedExclusiveMovies();
        final pubMovies = _shapedMovies();
        final cw = _continueWatchingForTab(_MediaTab.movies);
        final newThisWeek = _newThisWeekMovies();
        final because = _becauseYouWatchedMovies();
        return _buildStack([
          if (!_hideExclusive)
            ..._expiredExclusive.map(_buildRenewCard),
          if (!_hideExclusive) ..._buildNonMemberInfoCards(),
          if (cw.isNotEmpty) _continueWatchingRail(cw),
          if (newThisWeek.isNotEmpty)
            _posterSection(
              label: 'New this week',
              note: '${newThisWeek.length} titles',
              items: newThisWeek
                  .map((m) => _PosterItem(
                        id: 'movie_new_${m.id}',
                        title: m.title,
                        meta: _movieMeta(m),
                        imageUrl: m.posterUrl,
                        onTap: () => _openMovie(m),
                      ))
                  .toList(),
            ),
          if (because != null && because.items.isNotEmpty)
            _posterSection(
              label: 'Because you watched ${because.seed}',
              note: '${because.items.length} titles',
              items: because.items
                  .map((m) => _PosterItem(
                        id: 'movie_because_${m.id}',
                        title: m.title,
                        meta: _movieMeta(m),
                        imageUrl: m.posterUrl,
                        onTap: () => _openMovie(m),
                      ))
                  .toList(),
            ),
          if (exMovies.isNotEmpty)
            _posterSection(
              label: 'Exclusive · your channels',
              note: '${exMovies.length} titles',
              exclusive: true,
              items: exMovies
                  .map((e) => _PosterItem(
                        id: 'movie_ex_${e.movie.id}',
                        title: e.movie.title,
                        meta: _movieMeta(e.movie),
                        imageUrl: e.movie.posterUrl,
                        channelTag: e.tag,
                        channelName: e.channelName,
                        onTap: () => _openMovie(e.movie),
                      ))
                  .toList(),
            ),
          if (pubMovies.isNotEmpty)
            _posterSection(
              label: _labelForPublicMovies(),
              note: '${pubMovies.length} titles',
              items: pubMovies
                  .map((m) => _PosterItem(
                        id: 'movie_pub_${m.id}',
                        title: m.title,
                        meta: _movieMeta(m),
                        imageUrl: m.posterUrl,
                        onTap: () => _openMovie(m),
                      ))
                  .toList(),
            ),
          if (pubMovies.isEmpty &&
              exMovies.isEmpty &&
              (_hideExclusive || _expiredExclusive.isEmpty))
            _chipEmptyState(icon: Icons.movie_outlined, kind: 'movie'),
        ]);
      case _MediaTab.series:
        final exSeries = _shapedExclusiveSeries();
        final pubSeries = _shapedSeries();
        final cw = _continueWatchingForTab(_MediaTab.series);
        final newThisWeek = _newThisWeekSeries();
        return _buildStack([
          if (!_hideExclusive)
            ..._expiredExclusive.map(_buildRenewCard),
          if (!_hideExclusive) ..._buildNonMemberInfoCards(),
          if (cw.isNotEmpty) _continueWatchingRail(cw),
          if (newThisWeek.isNotEmpty)
            _posterSection(
              label: 'New this week',
              note: '${newThisWeek.length} titles',
              items: newThisWeek
                  .map((s) => _PosterItem(
                        id: 'series_new_${s.id}',
                        title: s.title,
                        meta: _seriesMeta(s),
                        imageUrl: s.coverUrl,
                        onTap: () => _openSeries(s),
                      ))
                  .toList(),
            ),
          if (exSeries.isNotEmpty)
            _posterSection(
              label: 'Exclusive · your channels',
              note: '${exSeries.length} titles',
              exclusive: true,
              items: exSeries
                  .map((e) => _PosterItem(
                        id: 'series_ex_${e.series.id}',
                        title: e.series.title,
                        meta: _seriesMeta(e.series),
                        imageUrl: e.series.coverUrl,
                        channelTag: e.tag,
                        channelName: e.channelName,
                        onTap: () => _openSeries(e.series),
                      ))
                  .toList(),
            ),
          if (pubSeries.isNotEmpty)
            _posterSection(
              label: _labelForPublicSeries(),
              note: '${pubSeries.length} titles',
              items: pubSeries
                  .map((s) => _PosterItem(
                        id: 'series_pub_${s.id}',
                        title: s.title,
                        meta: _seriesMeta(s),
                        imageUrl: s.coverUrl,
                        onTap: () => _openSeries(s),
                      ))
                  .toList(),
            ),
          if (pubSeries.isEmpty &&
              exSeries.isEmpty &&
              (_hideExclusive || _expiredExclusive.isEmpty))
            _chipEmptyState(icon: Icons.tv_outlined, kind: 'series'),
        ]);
      case _MediaTab.catchUp:
        return const CatchUpTab();
      case _MediaTab.library:
        if (_libraryLoading && _libraryItems.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 60),
            child: Center(
                child: CircularProgressIndicator(color: Nocturne.gold)),
          );
        }
        if (_libraryItems.isEmpty) {
          return _emptyState(
            'Your library is empty.\nDownloaded titles will appear here.',
            Icons.bookmark_border_rounded,
          );
        }
        return _libraryGrid();
    }
  }

  Widget _libraryGrid() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Expanded(
                child: Text(
                  'Your library',
                  style: TextStyle(
                    color: Nocturne.text,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Text(
                '${_libraryItems.length} ${_libraryItems.length == 1 ? 'title' : 'titles'}',
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            itemCount: _libraryItems.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 9,
              crossAxisSpacing: 9,
              childAspectRatio: 2 / 3,
            ),
            itemBuilder: (context, i) => _libraryTile(
              _libraryItems[i],
              key: ValueKey(_libraryItems[i].item.id),
            ),
          ),
        ],
      ),
    );
  }

  Widget _libraryTile(_LibraryEntry entry, {Key? key}) {
    final item = entry.item;
    return GestureDetector(
      key: key,
      onTap: () => _openLibraryItem(entry),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (item.coverAssetUrl != null && item.coverAssetUrl!.isNotEmpty)
              CachedNetworkImage(
                imageUrl: item.coverAssetUrl!,
                cacheKey: imageCacheKey(item.coverAssetUrl),
                fit: BoxFit.cover,
                memCacheWidth: 320,
                placeholder: (_, __) => _libraryFallback(item.contentType),
                errorWidget: (_, __, ___) => _libraryFallback(item.contentType),
              )
            else
              _libraryFallback(item.contentType),
            // Overlay for legibility.
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Nocturne.borderStrong, width: 1),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    const Color(0xFF060B1C).withValues(alpha: 0.85),
                  ],
                  stops: const [0.5, 1],
                ),
              ),
            ),
            // Channel-tag pill.
            Positioned(
              top: 6,
              left: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF423A6A).withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  entry.channelTag,
                  style: const TextStyle(
                    color: Color(0xFFF7DCAE),
                    fontSize: 8.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
            // Content-type glyph.
            Positioned(
              top: 6,
              right: 6,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFF0B1533).withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Icon(
                  _iconForContentType(item.contentType),
                  size: 11,
                  color: Nocturne.goldLight,
                ),
              ),
            ),
            Positioned(
              left: 9,
              right: 9,
              bottom: 9,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _libraryMeta(item),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 9.5,
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

  String _libraryMeta(ChannelLibraryItemModel item) {
    final parts = <String>[_labelForContentType(item.contentType)];
    if (item.estimatedReadMinutes > 0) {
      parts.add('${item.estimatedReadMinutes} min read');
    } else if (item.totalPages > 0) {
      parts.add('${item.totalPages} pages');
    }
    return parts.join(' · ');
  }

  IconData _iconForContentType(String type) {
    switch (type.toLowerCase()) {
      case 'comic':
        return Icons.auto_stories_rounded;
      case 'magazine':
        return Icons.article_rounded;
      case 'journal':
        return Icons.receipt_long_rounded;
      case 'book':
      default:
        return Icons.menu_book_rounded;
    }
  }

  String _labelForContentType(String type) {
    switch (type.toLowerCase()) {
      case 'comic':
        return 'Comic';
      case 'magazine':
        return 'Magazine';
      case 'journal':
        return 'Journal';
      case 'book':
        return 'Book';
      default:
        return 'Reading';
    }
  }

  Widget _libraryFallback(String contentType) => Container(
        color: const Color(0xFF111C3F),
        alignment: Alignment.center,
        child: Icon(
          _iconForContentType(contentType),
          color: Nocturne.textHint,
          size: 26,
        ),
      );

  /// Renew card that replaces an expired exclusive channel's shelf in the
  /// Movies/Series tabs. Matches the design's `isRenew` block.
  /// One "private membership" info card per exclusive channel the user
  /// isn't a member of. Rendered only for KYC-verified users — non-KYC
  /// users don't get exclusive-channel discovery here (`/kyc` is the
  /// gate). Tapping the card pushes the paywall, which owns the
  /// referral-based branch (Xlounge → purchase, else → request/About).
  List<Widget> _buildNonMemberInfoCards() {
    final u = _currentUser;
    if (u == null || !u.kycVerified) return const <Widget>[];
    if (_nonMemberExclusive.isEmpty) return const <Widget>[];
    return _nonMemberExclusive
        .map((ch) => Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: _nonMemberInfoCard(ch),
            ))
        .toList();
  }

  Widget _nonMemberInfoCard(ChannelModel ch) {
    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed(
        '/exclusive-access',
        arguments: ch,
      ).then((_) {
        // Re-check memberships after the user returns — they may have
        // just joined, in which case the info card drops out.
        _loadNonMemberExclusive();
        _loadExclusive();
      }),
      child: Container(
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(Nocturne.radiusLg),
          border: Border.all(color: const Color(0xFF4A3A1A), width: 1),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: Nocturne.surfaceInset,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.lock_outline_rounded,
                    size: 15,
                    color: Nocturne.goldSoft,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'PREMIUM · PRIVATE MEMBERSHIP',
                        style: TextStyle(
                          color: Nocturne.gold,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1,
                        ),
                      ),
                      Text(
                        ch.name,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '${ch.name} is an Exclusive Channel with Private Membership. Only Exclusive Channel members can access its content.',
              style: const TextStyle(
                color: Nocturne.textMuted,
                fontSize: 12.5,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Nocturne.gold, width: 1),
                    color: Nocturne.gold.withValues(alpha: 0.14),
                  ),
                  child: Text(
                    _isXloungeUser ? 'Purchase membership' : 'Request membership',
                    style: const TextStyle(
                      color: Nocturne.goldLight,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Nocturne.border, width: 1),
                  ),
                  child: const Text(
                    'Learn more',
                    style: TextStyle(
                      color: Nocturne.textMuted,
                      fontSize: 12.5,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  bool get _isXloungeUser {
    final src = _currentUser?.referralSource?.trim().toLowerCase();
    return src == 'xlounge-extreme';
  }

  Widget _buildRenewCard(ChannelSubscriptionModel s) {
    final tag = _tagFor(s.channelName);
    final expiryDate = s.nextBilling == null
        ? '—'
        : _formatDate(
            DateTime.fromMillisecondsSinceEpoch(s.nextBilling! * 1000));
    final planName = s.isPremium ? 'Premium' : 'Membership';
    final planPrice = s.amount > 0
        ? '${s.currency ?? 'NGN'} ${s.amount.toStringAsFixed(0)} / ${s.intervalUnit}'
        : 'Free';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF17224A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFA8761F), width: 1),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: const Color(0xFF4A3A1A),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    tag,
                    style: const TextStyle(
                      color: Color(0xFFF7DCAE),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'PREMIUM · MEMBERSHIP EXPIRED',
                        style: TextStyle(
                          color: Nocturne.goldSoft,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1,
                        ),
                      ),
                      Text(
                        s.channelName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFFDF3E2),
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Your membership ended on $expiryDate. Renew to get back your exclusive movies, series and saved library on ${s.channelName}.',
              style: const TextStyle(
                color: Nocturne.goldLight,
                fontSize: 12.5,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0x38F5C266), width: 1),
                  bottom: BorderSide(color: Color(0x38F5C266), width: 1),
                ),
              ),
              child: Row(
                children: [
                  _renewFact('Plan', planName),
                  const SizedBox(width: 16),
                  _renewFact('Price', planPrice),
                  const SizedBox(width: 16),
                  _renewFact('Expired', expiryDate),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Blocked while expired: exclusive movies · series · saved library',
              style: TextStyle(
                color: Color(0xFFF0C88F),
                fontSize: 11.5,
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: GestureDetector(
                onTap: () => _openRenewFor(s, expired: true),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 9),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Nocturne.gold, width: 1),
                  ),
                  child: const Text(
                    'Renew membership',
                    style: TextStyle(
                      color: Nocturne.goldLight,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
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

  Widget _renewFact(String label, String value) {
    return Flexible(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFFC2A06A),
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFFFDF3E2),
              fontSize: 12.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStack(List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }

  Widget _posterSection({
    required String label,
    required String note,
    required List<_PosterItem> items,
    bool exclusive = false,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        label,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    if (exclusive) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4A3A1A),
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: const Text(
                          'EXCLUSIVE',
                          style: TextStyle(
                            color: Color(0xFFFDF3E2),
                            fontSize: 9.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.7,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Text(
                note,
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 9,
              crossAxisSpacing: 9,
              childAspectRatio: 2 / 3,
            ),
            itemBuilder: (context, i) => _buildPoster(items[i]),
          ),
        ],
      ),
    );
  }

  Widget _buildPoster(_PosterItem item) {
    return GestureDetector(
      // Stable per-item key — prevents Flutter from reusing this tile's
      // Element (and its in-flight CachedNetworkImage ImageStream) for a
      // different poster when the list is rebuilt (chip filter change,
      // pagination, tab swipe). Without this, movie/series posters can
      // visually flash or hold the wrong title's image.
      key: ValueKey(item.id),
      onTap: item.onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
              CachedNetworkImage(
                imageUrl: item.imageUrl!,
                cacheKey: imageCacheKey(item.imageUrl),
                fit: BoxFit.cover,
                // 3-column posters — ~150 wide at 2:3 → cap decoded size.
                memCacheWidth: 320,
                placeholder: (_, __) => _posterFallback(),
                errorWidget: (_, __, ___) => _posterFallback(),
              )
            else
              _posterFallback(),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Nocturne.borderStrong, width: 1),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    const Color(0xFF060B1C).withValues(alpha: 0.85),
                  ],
                  stops: const [0.5, 1],
                ),
              ),
            ),
            if (item.channelTag != null)
              Positioned(
                top: 6,
                left: 6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF423A6A).withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    item.channelTag!,
                    style: const TextStyle(
                      color: Color(0xFFF7DCAE),
                      fontSize: 8.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            Positioned(
              left: 9,
              right: 9,
              bottom: 9,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      height: 1.25,
                    ),
                  ),
                  if (item.meta.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.meta,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Nocturne.textFaint,
                        fontSize: 9.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _posterFallback() => Container(
        color: const Color(0xFF111C3F),
        alignment: Alignment.center,
        child: const Icon(
          Icons.movie_creation_outlined,
          color: Nocturne.textHint,
          size: 30,
        ),
      );

  String _movieMeta(MovieModel m) {
    final year = _tryField<int>(m, ['year']);
    final duration = _tryField<int>(m, ['durationMinutes', 'duration', 'lengthMinutes']);
    final parts = <String>[];
    if (year != null && year > 0) parts.add(year.toString());
    if (duration != null && duration > 0) {
      final h = duration ~/ 60;
      final rem = duration % 60;
      parts.add(h > 0 ? '${h}h ${rem.toString().padLeft(2, '0')}m' : '${rem}m');
    }
    return parts.join(' · ');
  }

  String _seriesMeta(SeriesModel s) {
    final seasons = _tryField<int>(s, ['seasonCount', 'seasons', 'totalSeasons']);
    final episodes = _tryField<int>(s, ['episodeCount', 'episodes', 'totalEpisodes']);
    final parts = <String>[];
    if (seasons != null && seasons > 0) parts.add('S$seasons');
    if (episodes != null && episodes > 0) parts.add('$episodes episodes');
    return parts.join(' · ');
  }

  /// Read a numeric field by name via toJson() if the model exposes it,
  /// otherwise return null. Keeps the redesign decoupled from evolving models.
  T? _tryField<T>(dynamic obj, List<String> keys) {
    try {
      final json = obj.toJson() as Map<String, dynamic>;
      for (final k in keys) {
        final v = json[k];
        if (v is T) return v;
        if (T == int && v is num) return v.toInt() as T;
      }
    } catch (_) {}
    return null;
  }

  Widget _emptyState(String msg, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
      child: Column(
        children: [
          Icon(icon, color: Nocturne.textHint, size: 34),
          const SizedBox(height: 12),
          Text(
            msg,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 12.5,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String message) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Nocturne.redSoft, size: 40),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Nocturne.textMuted, fontSize: 12.5),
          ),
          const SizedBox(height: 18),
          GestureDetector(
            onTap: _loadData,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Nocturne.gold, width: 1),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: Nocturne.gold,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openMovie(MovieModel movie) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => MovieDetailScreen(movie: movie)),
    );
  }

  void _openSeries(SeriesModel series) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => SeriesDetailScreen(series: series)),
    );
  }

  // ───────── PHASE 5 RAIL DERIVATIONS ─────────

  /// Filter continue-watching items to the current tab (movies vs series).
  List<ContinueWatchingItem> _continueWatchingForTab(_MediaTab tab) {
    if (_continueWatching.isEmpty) return const <ContinueWatchingItem>[];
    if (tab == _MediaTab.movies) {
      return _continueWatching.where((i) => i.mediaType == 'movie').toList();
    }
    return _continueWatching.where((i) => i.mediaType == 'episode').toList();
  }

  /// Movies published or created in the last 7 days.
  List<MovieModel> _newThisWeekMovies() {
    if (_movies.isEmpty) return const <MovieModel>[];
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    return _movies.where((m) {
      final ts = m.publishedAt ?? m.createdAt;
      return ts > 0 && (now - ts) <= _kNewThisWeekWindowSec;
    }).toList()
      ..sort((a, b) => (b.publishedAt ?? b.createdAt)
          .compareTo(a.publishedAt ?? a.createdAt));
  }

  /// Series published or created in the last 7 days.
  List<SeriesModel> _newThisWeekSeries() {
    if (_series.isEmpty) return const <SeriesModel>[];
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    return _series.where((s) {
      final ts = s.publishedAt ?? s.createdAt;
      return ts > 0 && (now - ts) <= _kNewThisWeekWindowSec;
    }).toList()
      ..sort((a, b) => (b.publishedAt ?? b.createdAt)
          .compareTo(a.publishedAt ?? a.createdAt));
  }

  /// Simple heuristic: seed is the most recently continue-watched movie title;
  /// items are up to 6 other movies excluding the seed itself. Returns null
  /// when there's no seed or when there is only one movie in the catalogue.
  _BecauseYouWatched? _becauseYouWatchedMovies() {
    if (_movies.length < 2) return null;
    final seedCw = _continueWatching
        .where((i) => i.mediaType == 'movie' && (i.movieId ?? '').isNotEmpty)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    if (seedCw.isEmpty) return null;
    final seedId = seedCw.first.movieId!;
    final seedTitle = seedCw.first.title;
    final pool = _movies.where((m) => m.id != seedId).toList();
    if (pool.isEmpty) return null;
    pool.sort((a, b) => b.totalViews.compareTo(a.totalViews));
    return _BecauseYouWatched(
      seed: seedTitle.isEmpty ? 'your last title' : seedTitle,
      items: pool.take(6).toList(),
    );
  }

  Widget _continueWatchingRail(List<ContinueWatchingItem> items) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Expanded(
                child: Text(
                  'Continue watching',
                  style: TextStyle(
                    color: Nocturne.text,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Text(
                '${items.length} ${items.length == 1 ? 'title' : 'titles'}',
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 178,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.zero,
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, i) => _continueWatchingCard(items[i]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _continueWatchingCard(ContinueWatchingItem item) {
    return GestureDetector(
      onTap: () => _openContinueWatching(item),
      child: SizedBox(
        width: 118,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 118,
                height: 132,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if ((item.posterUrl ?? '').isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: item.posterUrl!,
                        cacheKey: imageCacheKey(item.posterUrl),
                        fit: BoxFit.cover,
                        memCacheWidth: 260,
                        placeholder: (_, __) => _posterFallback(),
                        errorWidget: (_, __, ___) => _posterFallback(),
                      )
                    else
                      _posterFallback(),
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: Nocturne.borderStrong, width: 1),
                      ),
                    ),
                    Positioned(
                      left: 6,
                      right: 6,
                      bottom: 6,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: item.progress,
                          minHeight: 3,
                          backgroundColor:
                              Colors.white.withValues(alpha: 0.16),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                              Nocturne.gold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Nocturne.text,
                fontSize: 11,
                fontWeight: FontWeight.w500,
                height: 1.25,
              ),
            ),
            if ((item.episodeTitle ?? '').isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                item.episodeTitle!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 9.5,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _openContinueWatching(ContinueWatchingItem item) async {
    if (item.mediaType == 'movie' && (item.movieId ?? '').isNotEmpty) {
      try {
        final movie = await VodService.getMovieById(item.movieId!);
        if (!mounted) return;
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => MovieDetailScreen(movie: movie),
          ),
        );
      } catch (_) {}
    } else if (item.mediaType == 'episode' && (item.seriesId ?? '').isNotEmpty) {
      try {
        final series = await VodService.getSeriesById(item.seriesId!);
        if (!mounted) return;
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => SeriesDetailScreen(series: series),
          ),
        );
      } catch (_) {}
    }
  }
}

class _BecauseYouWatched {
  final String seed;
  final List<MovieModel> items;
  const _BecauseYouWatched({required this.seed, required this.items});
}

class _LibraryEntry {
  final ChannelLibraryItemModel item;
  final String channelName;
  final String channelTag;
  const _LibraryEntry({
    required this.item,
    required this.channelName,
    required this.channelTag,
  });
}

class _PosterItem {
  /// Movie/series id. Used as the GridView item's stable key so Flutter
  /// never reuses one poster tile's Element (and its CachedNetworkImage's
  /// in-flight ImageStream) for a different title when the underlying list
  /// changes shape — the exact cause of movie/series posters visually
  /// "overriding" each other between rebuilds.
  final String id;
  final String title;
  final String meta;
  final String? imageUrl;
  final VoidCallback onTap;
  final String? channelTag;
  final String? channelName;
  const _PosterItem({
    required this.id,
    required this.title,
    required this.meta,
    required this.imageUrl,
    required this.onTap,
    this.channelTag,
    this.channelName,
  });
}

class _ExclusiveMovie {
  final MovieModel movie;
  final String channelName;
  final String tag;
  const _ExclusiveMovie(this.movie, this.channelName, this.tag);
}

class _ExclusiveSeries {
  final SeriesModel series;
  final String channelName;
  final String tag;
  const _ExclusiveSeries(this.series, this.channelName, this.tag);
}

class _ExclusiveBundle {
  final List<_ExclusiveMovie> movies;
  final List<_ExclusiveSeries> series;
  const _ExclusiveBundle({required this.movies, required this.series});
  const _ExclusiveBundle.empty()
      : movies = const [],
        series = const [];
}

/// Media Center hero rail — 3-card swipe with pager dots.
/// Full-bleed 16:9 art, gradient scrim, title + subtitle overlay, gold CTA.
class _HeroRail extends StatefulWidget {
  final List<MediaCenterHero> heroes;
  final void Function(MediaCenterHero) onOpen;
  const _HeroRail({required this.heroes, required this.onOpen});

  @override
  State<_HeroRail> createState() => _HeroRailState();
}

class _HeroRailState extends State<_HeroRail> {
  final PageController _pc = PageController(viewportFraction: 0.92);
  int _index = 0;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final heroes = widget.heroes;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 14),
      child: Column(
        children: [
          SizedBox(
            height: 200,
            child: PageView.builder(
              controller: _pc,
              itemCount: heroes.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) => _heroCard(heroes[i]),
            ),
          ),
          if (heroes.length > 1) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (int i = 0; i < heroes.length; i++)
                  Container(
                    width: i == _index ? 18 : 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: i == _index
                          ? Nocturne.gold
                          : Nocturne.border,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _heroCard(MediaCenterHero h) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: GestureDetector(
        onTap: () => widget.onOpen(h),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (h.imageUrl.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: h.imageUrl,
                  cacheKey: imageCacheKey(h.imageUrl),
                  fit: BoxFit.cover,
                  memCacheWidth: 900,
                  placeholder: (_, __) => Container(color: Nocturne.surfaceInset),
                  errorWidget: (_, __, ___) => Container(color: Nocturne.surfaceInset),
                )
              else
                Container(color: Nocturne.surfaceInset),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      const Color(0xFF060B1C).withValues(alpha: 0.85),
                    ],
                    stops: const [0.35, 1],
                  ),
                ),
              ),
              Positioned(
                left: 16,
                right: 16,
                bottom: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      h.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if ((h.subtitle ?? '').isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        h.subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Nocturne.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Nocturne.gold,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Watch now',
                        style: TextStyle(
                          color: Color(0xFF26170A),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
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
  }
}
