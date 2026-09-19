import '../../../core/ads/pangle_widgets.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../../../core/utils/image_cache_key.dart';
import '../services/vod_service.dart';
import 'movie_detail_screen.dart';
import 'series_detail_screen.dart';

/// Full-screen watch history / continue watching list.
///
/// Shows every in-progress movie or episode with a horizontal progress bar
/// below the thumbnail indicating how far the viewer has watched.
class WatchHistoryScreen extends StatefulWidget {
  const WatchHistoryScreen({super.key});

  @override
  State<WatchHistoryScreen> createState() => _WatchHistoryScreenState();
}

class _WatchHistoryScreenState extends State<WatchHistoryScreen> {
  List<ContinueWatchingItem> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await VodService.getContinueWatching(limit: 50);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _onRefresh() => _load();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(color: Nocturne.gold),
                    )
                  : RefreshIndicator(
                      color: Nocturne.gold,
                      backgroundColor: Nocturne.surfaceRaised,
                      onRefresh: _onRefresh,
                      child: _buildBody(),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).maybePop(),
            child: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: Nocturne.borderStrong, width: 1),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.chevron_left_rounded,
                color: Nocturne.text,
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Text(
              'Watch History',
              style: TextStyle(
                color: Nocturne.text,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
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
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Nocturne.gold,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      );
    }

    if (_items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 80),
        children: const [
          Icon(Icons.play_circle_outline_rounded,
              color: Nocturne.textHint, size: 40),
          SizedBox(height: 16),
          Text(
            'No watch history yet.\nMovies and series you start will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Nocturne.textFaint,
              fontSize: 12.5,
              height: 1.5,
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
      itemCount: _items.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (context, i) => i == _items.length
          ? const PangleBigBanner()
          : _buildItem(_items[i]),
    );
  }

  Widget _buildItem(ContinueWatchingItem item) {
    final subtitle = item.mediaType == 'episode' &&
            (item.episodeTitle ?? '').isNotEmpty
        ? '${item.title} · ${item.episodeTitle}'
        : item.title;

    return GestureDetector(
      onTap: () => _openItem(item),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        height: 84,
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 84,
                height: 84,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if ((item.posterUrl ?? '').isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: item.posterUrl!,
                        cacheKey: imageCacheKey(item.posterUrl),
                        fit: BoxFit.cover,
                        memCacheWidth: 240,
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
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _progressLabel(item.positionSeconds, item.durationSeconds),
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Nocturne.gold.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.play_arrow_rounded,
                color: Nocturne.gold,
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _progressLabel(int position, int duration) {
    if (duration <= 0) return 'In progress';
    if (position >= duration - 30) return 'Watched';
    final left = duration - position;
    final m = left ~/ 60;
    final s = left % 60;
    final part = s >= 30 ? '${m + 1}m' : '${m}m';
    return '$part left';
  }

  Widget _posterFallback() {
    return Container(
      color: Nocturne.surface,
      alignment: Alignment.center,
      child: const Icon(Icons.movie_rounded,
          color: Nocturne.textHint, size: 26),
    );
  }

  Future<void> _openItem(ContinueWatchingItem item) async {
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
}
