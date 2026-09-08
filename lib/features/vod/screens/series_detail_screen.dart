import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../../core/widgets/wave_thumbnail.dart';
import '../models/series_model.dart';
import '../models/vod_playback_args.dart';
import '../services/vod_service.dart';
import 'vod_player_screen.dart';

class SeriesDetailScreen extends StatefulWidget {
  final SeriesModel series;

  const SeriesDetailScreen({super.key, required this.series});

  @override
  State<SeriesDetailScreen> createState() => _SeriesDetailScreenState();
}

class _SeriesDetailScreenState extends State<SeriesDetailScreen> {
  bool _loading = true;
  SeriesModel? _series;
  String? _error;
  final Map<String, int> _episodeProgress = {};

  @override
  void initState() {
    super.initState();
    _loadSeries();
  }

  Future<void> _loadSeries() async {
    try {
      final detail = await VodService.getSeriesDetail(
        widget.series.channelId,
        widget.series.id,
      );
      if (!mounted) return;
      setState(() {
        _series = detail;
        _loading = false;
      });
      _loadEpisodeProgress(detail);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _series = widget.series;
        _error = e.toString();
        _loading = false;
      });
      _loadEpisodeProgress(widget.series);
    }
  }

  Future<void> _loadEpisodeProgress(SeriesModel series) async {
    final episodes = series.allEpisodes;
    for (final ep in episodes) {
      try {
        final progress = await VodService.getProgress('episode', ep.id);
        if (progress != null && mounted) {
          final pos = progress.positionSeconds;
          final dur = progress.durationSeconds;
          final resumable =
              pos > 0 && (dur <= 0 || pos < dur * 0.95);
          if (resumable) _episodeProgress[ep.id] = pos;
        }
      } catch (_) {}
      if (!mounted) return;
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final series = _series ?? widget.series;
    final firstEpisode =
        series.seasons.isNotEmpty ? series.seasons.first.episodes.firstOrNull : null;
    final canPlay = firstEpisode?.playbackUrl != null;

    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildHero(context, series)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildActionRow(
                      context,
                      canPlay: canPlay,
                      onPlay: canPlay ? () => _playEpisode(firstEpisode!) : null,
                    ),
                    const SizedBox(height: 16),
                    if (series.description != null &&
                        series.description!.isNotEmpty)
                      Text(
                        series.description!,
                        style: const TextStyle(
                          color: Nocturne.textMuted,
                          fontSize: 13,
                          height: 1.5,
                        ),
                      ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        _error!,
                        style: const TextStyle(
                          color: Nocturne.redSoft,
                          fontSize: 11.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (series.seasons.isNotEmpty)
              SliverList(
                delegate: SliverChildListDelegate(_buildEpisodeList(series)),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 30)),
          ],
        ),
      ),
    );
  }

  Widget _buildHero(BuildContext context, SeriesModel series) {
    final cover = series.coverUrl;
    return Stack(
      children: [
        Container(
          height: 230,
          width: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF1C2C62), Color(0xFF0D1633)],
            ),
            border: Border(
              bottom: BorderSide(color: Nocturne.border, width: 1),
            ),
          ),
          child: cover != null && cover.isNotEmpty
              ? ShaderMask(
                  shaderCallback: (r) => LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.white, Colors.white.withValues(alpha: 0)],
                    stops: const [0.55, 1],
                  ).createShader(r),
                  blendMode: BlendMode.dstIn,
                  child: CachedNetworkImage(
                    imageUrl: cover,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: 230,
                    memCacheHeight: 460,
                    placeholder: (_, __) => const SizedBox.shrink(),
                    errorWidget: (_, __, ___) => const SizedBox.shrink(),
                  ),
                )
              : null,
        ),
        Positioned(
          left: 16,
          top: 12,
          child: GestureDetector(
            onTap: () => Navigator.of(context).maybePop(),
            child: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: const Color(0xFF0B1533).withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: Nocturne.borderStrong, width: 1),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.chevron_left_rounded,
                  color: Nocturne.text, size: 22),
            ),
          ),
        ),
        Positioned(
          left: 20,
          right: 20,
          bottom: 18,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                series.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Nocturne.text,
                  fontSize: 24,
                  fontWeight: FontWeight.w500,
                  letterSpacing: -0.15,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _seriesMeta(series),
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActionRow(
    BuildContext context, {
    required bool canPlay,
    required VoidCallback? onPlay,
  }) {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: onPlay,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(9),
                border: Border.all(
                  color: canPlay ? Nocturne.gold : Nocturne.border,
                  width: 1,
                ),
                color: canPlay
                    ? Nocturne.gold.withValues(alpha: 0.02)
                    : Colors.transparent,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.play_arrow_rounded,
                    color: canPlay ? Nocturne.gold : Nocturne.textHint,
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _loading
                        ? 'Loading…'
                        : (canPlay ? 'Play Episode 1' : 'Unavailable'),
                    style: TextStyle(
                      color: canPlay ? Nocturne.gold : Nocturne.textHint,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Added to library'),
                duration: Duration(seconds: 2),
              ),
            );
          },
          child: Container(
            width: 46,
            height: 42,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: Nocturne.border, width: 1),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.add_rounded,
                color: Nocturne.textMuted, size: 18),
          ),
        ),
      ],
    );
  }

  Widget _seasonHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 6),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: Nocturne.gold,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 1,
        ),
      ),
    );
  }

  List<Widget> _buildEpisodeList(SeriesModel series) {
    final list = <Widget>[];
    for (final season in series.seasons) {
      list.add(_seasonHeader(season.title));
      for (final ep in season.episodes) {
        list.add(_episodeTile(ep));
      }
    }
    return list;
  }

  Widget _episodeTile(EpisodeModel ep) {
    final playable = ep.playbackUrl != null;
    final hasProgress = _episodeProgress.containsKey(ep.id);
    final buttonLabel = hasProgress ? 'Resume' : 'Play this Episode';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 64,
              height: 44,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  WaveThumbnail(
                    thumbnailUrl: (ep.posterUrl ?? '').isNotEmpty
                        ? AppConfig.mediaUrl(ep.posterUrl!)
                        : '',
                    videoUrl: (ep.playbackUrl ?? '').isNotEmpty
                        ? AppConfig.mediaUrl(ep.playbackUrl!)
                        : '',
                    memCacheWidth: 128,
                    memCacheHeight: 88,
                    placeholder: Container(
                      color: Nocturne.surfaceRaised,
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.video_library_rounded,
                        color: Nocturne.textHint,
                        size: 18,
                      ),
                    ),
                  ),
                  Positioned(
                    left: 4,
                    bottom: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF060B1C)
                            .withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'E${ep.episodeNumber}',
                        style: const TextStyle(
                          color: Nocturne.gold,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  ep.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (ep.duration > 0) ...[
                  const SizedBox(height: 2),
                  Text(
                    _formatDuration(ep.duration),
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          playable
              ? GestureDetector(
                  onTap: () => _playEpisode(ep),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: Nocturne.gold.withValues(alpha: 0.08),
                      border: Border.all(color: Nocturne.gold, width: 1),
                    ),
                    child: Text(
                      buttonLabel,
                      style: const TextStyle(
                        color: Nocturne.gold,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                )
              : const Icon(
                  Icons.lock_outline_rounded,
                  color: Nocturne.textHint,
                  size: 20,
                ),
        ],
      ),
    );
  }

  String _seriesMeta(SeriesModel s) {
    final parts = <String>[];
    if (s.seasons.isNotEmpty) parts.add('S${s.seasons.length}');
    final episodes = s.seasons.fold<int>(0, (a, se) => a + se.episodes.length);
    if (episodes > 0) parts.add('$episodes episodes');
    return parts.join(' · ');
  }

  void _playEpisode(EpisodeModel episode) {
    if (episode.ageClassification.toLowerCase() == 'adult') {
      KycGuard.ensureKycVerified(
        context,
        onComplete: () => _openPlayer(episode),
      );
      return;
    }
    _openPlayer(episode);
  }

  void _openPlayer(EpisodeModel episode) {
    final series = _series ?? widget.series;
    final all = series.allEpisodes;
    final index = all.indexWhere((e) => e.id == episode.id);
    final nextId =
        index >= 0 && index < all.length - 1 ? all[index + 1].id : null;
    final prevId = index > 0 ? all[index - 1].id : null;
    final args = VodPlaybackArgs.fromEpisode(
      series,
      episode,
      nextEpisodeId: nextId,
      previousEpisodeId: prevId,
    );
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => VodPlayerScreen(args: args)),
    );
  }

  String _formatDuration(int seconds) {
    final d = Duration(seconds: seconds);
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    if (h > 0) return '${h}h ${m.toString().padLeft(2, '0')}m';
    return '${m}m';
  }
}
