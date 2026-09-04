import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../../subscription/models/channel_subscription_model.dart';
import '../../subscription/screens/channel_subscription_screen.dart';
import '../../subscription/services/channel_subscription_service.dart';
import '../../subscription/widgets/exclusive_membership_sheets.dart';
import '../models/movie_model.dart';
import '../models/series_model.dart';
import '../services/vod_service.dart';
import 'movie_detail_screen.dart';
import 'series_detail_screen.dart';

enum _MediaTab { movies, series, library }

class MediaCenterScreen extends StatefulWidget {
  const MediaCenterScreen({super.key});

  @override
  State<MediaCenterScreen> createState() => _MediaCenterScreenState();
}

class _MediaCenterScreenState extends State<MediaCenterScreen>
    with AutomaticKeepAliveClientMixin {
  bool _loading = true;
  String? _error;
  List<MovieModel> _movies = [];
  List<SeriesModel> _series = [];
  List<_ExclusiveMovie> _exclusiveMovies = [];
  List<_ExclusiveSeries> _exclusiveSeries = [];
  List<ChannelSubscriptionModel> _expiringSoon = [];
  List<ChannelSubscriptionModel> _expiredExclusive = [];
  bool _bannerDismissed = false;
  _MediaTab _tab = _MediaTab.movies;

  static const int _kExpiringWindowDays = 7;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadData();
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
  Future<_ExclusiveBundle> _loadExclusive() async {
    try {
      final res = await ChannelSubscriptionService.getMine();
      if (res['success'] != true) return const _ExclusiveBundle.empty();
      // Every exclusive-channel membership the user has, regardless of state.
      // Exclusive == amount > 0 or is_premium (per the fee-based rule).
      final allExclusive = (res['subscriptions'] as List<dynamic>? ?? [])
          .whereType<ChannelSubscriptionModel>()
          .where((s) => s.amount > 0 || s.isPremium)
          .toList();
      if (allExclusive.isEmpty) return const _ExclusiveBundle.empty();

      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final windowSec = _kExpiringWindowDays * 86400;

      // Entitled (fetch content): active + not-yet-past-billing.
      final subs = allExclusive.where((s) {
        if (!s.isActive) return false;
        final nb = s.nextBilling;
        return nb == null || nb > nowSec;
      }).toList();

      // Expired (render a Renew card in place of the shelf).
      final expired = allExclusive.where((s) {
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
      final all = await Future.wait(calls);

      final movies = <_ExclusiveMovie>[];
      final series = <_ExclusiveSeries>[];
      for (int i = 0; i < subs.length; i++) {
        final s = subs[i];
        final tag = _tagFor(s.channelName);
        final mList = all[i * 2];
        final sList = all[i * 2 + 1];
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
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _buildHeader()),
        if (_shouldShowExpiringBanner)
          SliverToBoxAdapter(child: _buildExpiringBanner()),
        SliverToBoxAdapter(child: _buildChipRow()),
        SliverToBoxAdapter(child: _buildTabs()),
        SliverToBoxAdapter(child: _buildTabContent()),
      ],
    );
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
            onTap: () => _snack('Search coming soon'),
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
  Widget _buildChipRow() {
    const chips = ['New', 'Nollywood', 'Free'];
    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
        children: [
          for (final c in chips) ...[
            _chip(c),
            const SizedBox(width: 7),
          ],
        ],
      ),
    );
  }

  Widget _chip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Nocturne.border, width: 1),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Nocturne.textFaint,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
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
      onTap: () => setState(() => _tab = which),
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
  Widget _buildTabContent() {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 60),
        child: Center(child: CircularProgressIndicator(color: Nocturne.gold)),
      );
    }
    if (_error != null) return _buildError(_error!);

    switch (_tab) {
      case _MediaTab.movies:
        return _buildStack([
          ..._expiredExclusive.map(_buildRenewCard),
          if (_exclusiveMovies.isNotEmpty)
            _posterSection(
              label: 'Exclusive · your channels',
              note: '${_exclusiveMovies.length} titles',
              exclusive: true,
              items: _exclusiveMovies
                  .map((e) => _PosterItem(
                        title: e.movie.title,
                        meta: _movieMeta(e.movie),
                        imageUrl: e.movie.posterUrl,
                        channelTag: e.tag,
                        channelName: e.channelName,
                        onTap: () => _openMovie(e.movie),
                      ))
                  .toList(),
            ),
          if (_movies.isNotEmpty)
            _posterSection(
              label: 'Popular on AfroVision',
              note: '${_movies.length} titles',
              items: _movies
                  .map((m) => _PosterItem(
                        title: m.title,
                        meta: _movieMeta(m),
                        imageUrl: m.posterUrl,
                        onTap: () => _openMovie(m),
                      ))
                  .toList(),
            ),
          if (_movies.isEmpty &&
              _exclusiveMovies.isEmpty &&
              _expiredExclusive.isEmpty)
            _emptyState('No movies yet.', Icons.movie_outlined),
        ]);
      case _MediaTab.series:
        return _buildStack([
          ..._expiredExclusive.map(_buildRenewCard),
          if (_exclusiveSeries.isNotEmpty)
            _posterSection(
              label: 'Exclusive · your channels',
              note: '${_exclusiveSeries.length} titles',
              exclusive: true,
              items: _exclusiveSeries
                  .map((e) => _PosterItem(
                        title: e.series.title,
                        meta: _seriesMeta(e.series),
                        imageUrl: e.series.coverUrl,
                        channelTag: e.tag,
                        channelName: e.channelName,
                        onTap: () => _openSeries(e.series),
                      ))
                  .toList(),
            ),
          if (_series.isNotEmpty)
            _posterSection(
              label: 'Series for you',
              note: '${_series.length} titles',
              items: _series
                  .map((s) => _PosterItem(
                        title: s.title,
                        meta: _seriesMeta(s),
                        imageUrl: s.coverUrl,
                        onTap: () => _openSeries(s),
                      ))
                  .toList(),
            ),
          if (_series.isEmpty &&
              _exclusiveSeries.isEmpty &&
              _expiredExclusive.isEmpty)
            _emptyState('No series yet.', Icons.tv_outlined),
        ]);
      case _MediaTab.library:
        return _emptyState(
          'Your library is empty.\nSaved and downloaded titles will appear here.',
          Icons.bookmark_border_rounded,
        );
    }
  }

  /// Renew card that replaces an expired exclusive channel's shelf in the
  /// Movies/Series tabs. Matches the design's `isRenew` block.
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
      onTap: item.onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
              Image.network(
                item.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _posterFallback(),
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

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: Nocturne.surfaceInset,
        duration: const Duration(seconds: 2),
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
}

class _PosterItem {
  final String title;
  final String meta;
  final String? imageUrl;
  final VoidCallback onTap;
  final String? channelTag;
  final String? channelName;
  const _PosterItem({
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
