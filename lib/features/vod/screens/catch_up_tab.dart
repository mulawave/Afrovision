import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../../../core/utils/image_cache_key.dart';
import '../models/catch_up_models.dart';
import '../models/vod_playback_args.dart';
import '../services/catch_up_service.dart';
import '../services/vod_service.dart';
import 'movie_detail_screen.dart';
import 'series_detail_screen.dart';
import 'vod_player_screen.dart';

/// Catch-up discovery tab for the Media Center.
///
/// Displays an auto-sliding hero carousel of trending movies/series from
/// TMDB, followed by rails for featured, episode spotlight, trending people,
/// what to watch, top picks, current TV, and upcoming movies.
class CatchUpTab extends StatefulWidget {
  const CatchUpTab({super.key});

  @override
  State<CatchUpTab> createState() => CatchUpTabState();
}

class CatchUpTabState extends State<CatchUpTab>
    with WidgetsBindingObserver {
  CatchUpHome _home = const CatchUpHome();
  bool _loading = true;
  String? _error;
  DateTime? _lastLoad;

  List<ContinueWatchingItem> _continueWatching = [];

  late final PageController _heroController;
  Timer? _heroTimer;
  Timer? _heroResumeTimer;
  Timer? _refreshTimer;
  bool _heroPaused = false;
  bool _heroHeld = false;
  int _heroIndex = 0;

  @override
  void initState() {
    super.initState();
    _heroController = PageController(viewportFraction: 0.92);
    WidgetsBinding.instance.addObserver(this);
    _load();
    _loadContinueWatching();
    _startRefreshTimer();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _heroTimer?.cancel();
    _heroController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshIfStale();
    }
  }

  void _startRefreshTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      _refreshIfStale();
    });
  }

  void _refreshIfStale() {
    if (_loading) return;
    final last = _lastLoad;
    final isStale = last == null ||
        DateTime.now().difference(last).inMinutes >= 15;
    if (isStale) _loadSilently();
  }

  Future<void> _load() async {
    await _doLoad(showLoading: true);
  }

  Future<void> _loadSilently() async {
    await _doLoad(showLoading: false);
  }

  /// Pull-to-refresh entry point used by the parent Media Center.
  Future<void> refresh() => _load();

  Future<void> _doLoad({required bool showLoading}) async {
    try {
      if (showLoading && mounted) setState(() => _loading = true);
      final home = await CatchUpService.getHomeCached(
        onCached: showLoading
            ? (cached) {
                if (!mounted) return;
                setState(() {
                  _home = cached;
                  _loading = false;
                });
                _startHeroAutoSlide();
              }
            : null,
      );
      if (!mounted) return;
      setState(() {
        _home = home;
        _loading = false;
        _error = null;
      });
      _lastLoad = DateTime.now();
      _startHeroAutoSlide();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

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
      // Continue watching is a convenience rail; failure is not fatal.
    }
  }

  void _startHeroAutoSlide() {
    _heroTimer?.cancel();
    if (_heroPaused || _heroHeld || _home.hero.isEmpty) return;
    _heroTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || _home.hero.isEmpty) return;
      _heroIndex = (_heroIndex + 1) % _home.hero.length;
      _heroController.animateToPage(
        _heroIndex,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOut,
      );
    });
  }

  void _onHeroPageChanged(int index) {
    _heroIndex = index;
  }

  void _pauseHeroAutoSlide() {
    _heroPaused = true;
    _heroTimer?.cancel();
    _heroResumeTimer?.cancel();
  }

  void _resumeHeroAutoSlide({Duration delay = const Duration(milliseconds: 1200)}) {
    if (_heroHeld) return;
    _heroResumeTimer?.cancel();
    _heroResumeTimer = Timer(delay, () {
      if (!mounted) return;
      _heroPaused = false;
      _startHeroAutoSlide();
    });
  }

  void _playTrailer(String? url, {CatchUpItem? item}) {
    if (url == null || url.isEmpty) return;
    final trailerItem = item;
    final args = VodPlaybackArgs(
      mediaType: 'trailer',
      mediaId: trailerItem?.id ?? 'trailer',
      channelId: '',
      title: trailerItem != null ? '${trailerItem.title} Trailer' : 'Trailer',
      synopsis: trailerItem?.overview,
      posterUrl: trailerItem?.posterUrl ?? trailerItem?.backdropUrl,
      videoSourceMode: 'embed',
      playbackUrl: url,
      duration: 0,
      downloadable: false,
    );
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => VodPlayerScreen(args: args)),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _home.hero.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 80),
        child: Center(
          child: CircularProgressIndicator(color: Nocturne.gold),
        ),
      );
    }

    if (_error != null && _home.hero.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 80, horizontal: 24),
        child: Column(
          children: [
            const Icon(Icons.error_outline_rounded,
                color: Nocturne.textHint, size: 34),
            const SizedBox(height: 12),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Nocturne.textMuted,
                fontSize: 12.5,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 18),
            GestureDetector(
              onTap: _load,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
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

    if (_home.hero.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 80),
        child: Text(
          'Catch-up feed is not available. Ask your admin to configure the IMDb/TMDB API key.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Nocturne.textFaint,
            fontSize: 12.5,
            height: 1.4,
          ),
        ),
      );
    }

    final rails = _home.rails;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildContinueWatchingRail(),
        _buildHero(),
        if (_home.episodeSpotlight != null)
          _buildSpotlight(_home.episodeSpotlight!),
        _buildPeopleRail('Trending People', _home.trendingPeople),
        for (final rail in rails) _buildItemRail(rail.title, rail.items),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildContinueWatchingRail() {
    if (_continueWatching.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Continue Watching',
                style: TextStyle(
                  color: Nocturne.text,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              GestureDetector(
                onTap: () => Navigator.of(context).pushNamed('/watch-history'),
                child: const Text(
                  'See all',
                  style: TextStyle(
                    color: Nocturne.goldLight,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 140,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.zero,
              itemCount: _continueWatching.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, i) => _buildContinueWatchingCard(_continueWatching[i]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContinueWatchingCard(ContinueWatchingItem item) {
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
                        placeholder: (_, __) => _imageFallback(),
                        errorWidget: (_, __, ___) => _imageFallback(),
                      )
                    else
                      _imageFallback(),
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
                          backgroundColor: Colors.white.withValues(alpha: 0.16),
                          valueColor:
                              const AlwaysStoppedAnimation<Color>(Nocturne.gold),
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
    } else if (item.mediaType == 'episode' &&
        (item.seriesId ?? '').isNotEmpty) {
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

  Widget _buildHero() {
    final hero = _home.hero;
    return Column(
      children: [
        SizedBox(
          height: 320,
          child: NotificationListener<ScrollEndNotification>(
            onNotification: (n) {
              if (n.dragDetails != null) _resumeHeroAutoSlide();
              return false;
            },
            child: NotificationListener<ScrollStartNotification>(
              onNotification: (n) {
                if (n.dragDetails != null) _pauseHeroAutoSlide();
                return false;
              },
              child: Listener(
                onPointerDown: (_) {
                  _heroHeld = true;
                  _pauseHeroAutoSlide();
                },
                onPointerUp: (_) {
                  _heroHeld = false;
                  _resumeHeroAutoSlide(delay: const Duration(milliseconds: 800));
                },
                onPointerCancel: (_) {
                  _heroHeld = false;
                  _resumeHeroAutoSlide(delay: const Duration(milliseconds: 800));
                },
                behavior: HitTestBehavior.translucent,
                child: PageView.builder(
                  controller: _heroController,
                  onPageChanged: _onHeroPageChanged,
                  physics: const BouncingScrollPhysics(),
                  itemCount: hero.length,
                  itemBuilder: (context, i) => _buildHeroCard(hero[i]),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(hero.length, (i) {
            final active = i == _heroIndex;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: active ? 18 : 6,
              height: 6,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                color: active ? Nocturne.gold : Nocturne.textFaint,
                borderRadius: BorderRadius.circular(999),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildHeroCard(CatchUpItem item) {
    final imageUrl = item.backdropUrl ?? item.posterUrl;
    return GestureDetector(
      onTap: () => _showDetail(item),
      behavior: HitTestBehavior.translucent,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: ClipRRect(
        borderRadius: BorderRadius.circular(Nocturne.radiusLg),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl != null && imageUrl.isNotEmpty)
              CachedNetworkImage(
                imageUrl: imageUrl,
                cacheKey: imageCacheKey(imageUrl),
                fit: BoxFit.cover,
                memCacheWidth: 800,
                placeholder: (_, __) => _imageFallback(),
                errorWidget: (_, __, ___) => _imageFallback(),
              )
            else
              _imageFallback(),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0x1A000000),
                    const Color(0xE6080E21).withValues(alpha: 0.9),
                  ],
                  stops: const [0.3, 1.0],
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 20,
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
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item.overview,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.textMuted,
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (item.trailerUrl != null && item.trailerUrl!.isNotEmpty)
                    GestureDetector(
                      onTap: () => _playTrailer(item.trailerUrl, item: item),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          gradient: Nocturne.goldCta,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.play_arrow_rounded,
                                color: Color(0xFF0B1533), size: 18),
                            SizedBox(width: 4),
                            Text(
                              'Watch Trailer',
                              style: TextStyle(
                                color: Color(0xFF0B1533),
                                fontSize: 13,
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
            if (item.rating > 0)
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Nocturne.gold.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Nocturne.gold, width: 1),
                  ),
                  child: Text(
                    '${item.rating.toStringAsFixed(1)} ★',
                    style: const TextStyle(
                      color: Nocturne.goldLight,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
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

  Widget _buildSpotlight(CatchUpItem item) {
    final imageUrl = item.backdropUrl ?? item.posterUrl;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Episode Spotlight'),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => _showDetail(item),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(Nocturne.radiusLg),
              child: Container(
                height: 180,
                decoration: BoxDecoration(
                  color: Nocturne.surface,
                  borderRadius: BorderRadius.circular(Nocturne.radiusLg),
                  border: Border.all(color: Nocturne.border, width: 1),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (imageUrl != null && imageUrl.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: imageUrl,
                        cacheKey: imageCacheKey(imageUrl),
                        fit: BoxFit.cover,
                        memCacheWidth: 800,
                        placeholder: (_, __) => _imageFallback(),
                        errorWidget: (_, __, ___) => _imageFallback(),
                      )
                    else
                      _imageFallback(),
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            const Color(0x05000000),
                            const Color(0xE6080E21),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 16,
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
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Trending series · Tap for details',
                            style: TextStyle(
                              color: Nocturne.textMuted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Center(
                      child: Icon(
                        Icons.info_outline_rounded,
                        color: Nocturne.gold,
                        size: 48,
                      ),
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

  Widget _buildItemRail(String label, List<CatchUpItem> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _sectionHeader(label, count: items.length),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 188,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, i) => _buildPosterCard(items[i]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeopleRail(String label, List<CatchUpPerson> people) {
    if (people.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _sectionHeader(label, count: people.length),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 130,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: people.length,
              separatorBuilder: (_, __) => const SizedBox(width: 14),
              itemBuilder: (context, i) => _buildPersonCard(people[i]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPosterCard(CatchUpItem item) {
    return GestureDetector(
      onTap: () => _showDetail(item),
      child: SizedBox(
        width: 118,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(Nocturne.radiusSm),
              child: SizedBox(
                width: 118,
                height: 152,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (item.posterUrl != null && item.posterUrl!.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: item.posterUrl!,
                        cacheKey: imageCacheKey(item.posterUrl),
                        fit: BoxFit.cover,
                        memCacheWidth: 320,
                        placeholder: (_, __) => _imageFallback(),
                        errorWidget: (_, __, ___) => _imageFallback(),
                      )
                    else
                      _imageFallback(),
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(Nocturne.radiusSm),
                        border: Border.all(
                            color: Nocturne.borderStrong, width: 1),
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
            const SizedBox(height: 2),
            Text(
              item.rating > 0 ? '${item.rating.toStringAsFixed(1)} ★' : '',
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPersonCard(CatchUpPerson person) {
    return SizedBox(
      width: 80,
      child: Column(
        children: [
          ClipOval(
            child: SizedBox(
              width: 70,
              height: 70,
              child: person.profileUrl != null && person.profileUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: person.profileUrl!,
                      cacheKey: imageCacheKey(person.profileUrl),
                      fit: BoxFit.cover,
                      memCacheWidth: 200,
                      placeholder: (_, __) => _imageFallback(shape: BoxShape.circle),
                      errorWidget: (_, __, ___) =>
                          _imageFallback(shape: BoxShape.circle),
                    )
                  : _imageFallback(shape: BoxShape.circle),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            person.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (person.knownFor.isNotEmpty)
            Text(
              person.knownFor.take(2).join(', '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 9.5,
              ),
            ),
        ],
      ),
    );
  }

  Widget _sectionHeader(String label, {int? count}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        if (count != null)
          Text(
            '$count',
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 11,
            ),
          ),
      ],
    );
  }

  Widget _imageFallback({BoxShape shape = BoxShape.rectangle}) {
    return Container(
      color: Nocturne.surface,
      alignment: Alignment.center,
      child: Icon(
        Icons.movie_rounded,
        color: Nocturne.textHint,
        size: shape == BoxShape.circle ? 28 : 40,
      ),
    );
  }

  void _showDetail(CatchUpItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => _CatchUpDetailScreen(
          item: item,
          onPlay: (url) => _playTrailer(url, item: item),
          onOpenItem: (i) => _showDetail(i),
        ),
      ),
    );
  }
}

class _CatchUpDetailScreen extends StatefulWidget {
  final CatchUpItem item;
  final void Function(String?) onPlay;
  final void Function(CatchUpItem) onOpenItem;

  const _CatchUpDetailScreen({
    required this.item,
    required this.onPlay,
    required this.onOpenItem,
  });

  @override
  State<_CatchUpDetailScreen> createState() => _CatchUpDetailScreenState();
}

class _CatchUpDetailScreenState extends State<_CatchUpDetailScreen> {
  late CatchUpItem _item;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _item = widget.item;
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    try {
      final detail = await CatchUpService.getDetail(_item.type, _item.id);
      if (!mounted) return;
      setState(() {
        _item = detail;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = _item.backdropUrl ?? _item.posterUrl;
    final trailerUrl = _item.trailerUrl;
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Stack(
                children: [
                  if (imageUrl != null && imageUrl.isNotEmpty)
                    SizedBox(
                      height: 240,
                      width: double.infinity,
                      child: CachedNetworkImage(
                        imageUrl: imageUrl,
                        cacheKey: imageCacheKey(imageUrl),
                        fit: BoxFit.cover,
                        memCacheWidth: 800,
                        placeholder: (_, __) => _imageFallback(),
                        errorWidget: (_, __, ___) => _imageFallback(),
                      ),
                    )
                  else
                    SizedBox(
                      height: 200,
                      width: double.infinity,
                      child: _imageFallback(),
                    ),
                  Positioned(
                    top: 12,
                    left: 16,
                    child: GestureDetector(
                      onTap: () => Navigator.of(context).maybePop(),
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B1533).withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: Nocturne.borderStrong),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Icons.chevron_left_rounded,
                            color: Nocturne.text, size: 22),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _item.title,
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _buildMetaLine(),
                      style: const TextStyle(
                        color: Nocturne.textFaint,
                        fontSize: 12.5,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      _item.overview.isNotEmpty
                          ? _item.overview
                          : 'No overview available.',
                      style: const TextStyle(
                        color: Nocturne.textMuted,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 18),
                    if (_loading)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: CircularProgressIndicator(color: Nocturne.gold),
                        ),
                      )
                    else if (_error != null)
                      Text(
                        _error!,
                        style: const TextStyle(
                          color: Nocturne.redSoft,
                          fontSize: 12,
                        ),
                      ),
                    const SizedBox(height: 4),
                    if (trailerUrl != null && trailerUrl.isNotEmpty)
                      GestureDetector(
                        onTap: () => widget.onPlay(trailerUrl),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            gradient: Nocturne.goldCta,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(Icons.play_arrow_rounded,
                                  color: Color(0xFF0B1533), size: 20),
                              SizedBox(width: 6),
                              Text(
                                'Watch Trailer',
                                style: TextStyle(
                                  color: Color(0xFF0B1533),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 24),
                    _buildCreditSection('Cast', _item.cast),
                    _buildCreditSection('Directors', _item.directors),
                    _buildCreditSection('Producers', _item.producers),
                    _buildCreditSection('Writers', _item.writers),
                    _buildGenresSection(),
                    _buildRecommendationsSection(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _buildMetaLine() {
    final parts = <String>[];
    if (_item.rating > 0) parts.add('${_item.rating.toStringAsFixed(1)} ★');
    if (_item.certification != null && _item.certification!.isNotEmpty) {
      parts.add(_item.certification!);
    }
    if (_item.runtime != null && _item.runtime! > 0) {
      final d = Duration(minutes: _item.runtime!);
      final h = d.inHours;
      final m = d.inMinutes.remainder(60);
      if (h > 0) {
        parts.add('${h}h ${m.toString().padLeft(2, '0')}m');
      } else {
        parts.add('${m}m');
      }
    }
    if (_item.releaseDate != null && _item.releaseDate!.isNotEmpty) {
      parts.add(_item.releaseDate!);
    }
    return parts.join(' · ');
  }

  Widget _buildCreditSection(String label, List<CatchUpCredit> credits) {
    if (credits.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Nocturne.text,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 110,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.zero,
            itemCount: credits.length,
            separatorBuilder: (_, __) => const SizedBox(width: 14),
            itemBuilder: (_, i) => _buildCreditCard(credits[i]),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildCreditCard(CatchUpCredit credit) {
    return SizedBox(
      width: 76,
      child: Column(
        children: [
          ClipOval(
            child: SizedBox(
              width: 64,
              height: 64,
              child: credit.profileUrl != null && credit.profileUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: credit.profileUrl!,
                      cacheKey: imageCacheKey(credit.profileUrl),
                      fit: BoxFit.cover,
                      memCacheWidth: 180,
                      placeholder: (_, __) =>
                          _imageFallback(shape: BoxShape.circle),
                      errorWidget: (_, __, ___) =>
                          _imageFallback(shape: BoxShape.circle),
                    )
                  : _imageFallback(shape: BoxShape.circle),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            credit.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (credit.role != null && credit.role!.isNotEmpty)
            Text(
              credit.role!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 9.5,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildGenresSection() {
    if (_item.genres.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Genres',
          style: TextStyle(
            color: Nocturne.text,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _item.genres.map((g) => _buildPill(g)).toList(),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildPill(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Nocturne.borderStrong),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Nocturne.text,
          fontSize: 11,
        ),
      ),
    );
  }

  Widget _buildRecommendationsSection() {
    final recs = _item.recommendations;
    if (recs.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'More like this',
          style: TextStyle(
            color: Nocturne.text,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 158,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.zero,
            itemCount: recs.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) => _buildRecommendationCard(recs[i]),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildRecommendationCard(CatchUpItem item) {
    return GestureDetector(
      onTap: () => widget.onOpenItem(item),
      child: SizedBox(
        width: 108,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(Nocturne.radiusSm),
              child: SizedBox(
                width: 108,
                height: 140,
                child: item.posterUrl != null && item.posterUrl!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: item.posterUrl!,
                        cacheKey: imageCacheKey(item.posterUrl),
                        fit: BoxFit.cover,
                        memCacheWidth: 300,
                        placeholder: (_, __) => _imageFallback(),
                        errorWidget: (_, __, ___) => _imageFallback(),
                      )
                    : _imageFallback(),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Nocturne.text,
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _imageFallback({BoxShape shape = BoxShape.rectangle}) {
    return Container(
      color: Nocturne.surface,
      alignment: Alignment.center,
      child: Icon(
        Icons.movie_rounded,
        color: Nocturne.textHint,
        size: shape == BoxShape.circle ? 28 : 40,
      ),
    );
  }
}
