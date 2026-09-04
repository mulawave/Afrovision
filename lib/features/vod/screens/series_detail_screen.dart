import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../models/series_model.dart';
import '../models/vod_playback_args.dart';
import '../services/vod_service.dart';
import 'vod_player_screen.dart';

/// Series detail page with seasons, episode list, and play/next-episode support.
class SeriesDetailScreen extends StatefulWidget {
  final SeriesModel series;

  const SeriesDetailScreen({
    super.key,
    required this.series,
  });

  @override
  State<SeriesDetailScreen> createState() => _SeriesDetailScreenState();
}

class _SeriesDetailScreenState extends State<SeriesDetailScreen> {
  bool _loading = true;
  SeriesModel? _series;
  String? _error;

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
      setState(() {
        _series = detail;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _series = widget.series;
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final series = _series ?? widget.series;
    final hasSeasons = series.seasons.isNotEmpty;
    final firstEpisode = hasSeasons ? series.seasons.first.episodes.firstOrNull : null;

    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: AppColors.darkBlue,
            foregroundColor: AppColors.white,
            expandedHeight: 260,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: _buildCover(series.coverUrl),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    series.title,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (firstEpisode != null)
                    SizedBox(
                      width: double.infinity,
                      child: AppButton(
                        label: 'Play Episode 1',
                        onPressed: firstEpisode.playbackUrl != null
                            ? () => _playEpisode(firstEpisode)
                            : null,
                        loading: _loading,
                      ),
                    ),
                  const SizedBox(height: 20),
                  if (series.description != null && series.description!.isNotEmpty)
                    Text(
                      series.description!,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.85),
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: AppColors.errorRed, fontSize: 12),
                      ),
                    ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
          if (hasSeasons)
            SliverList(
              delegate: SliverChildListDelegate(
                series.seasons.expand((season) {
                  return [
                    _buildSeasonHeader(season.title),
                    ...season.episodes.map((ep) => _buildEpisodeTile(ep, season.title)),
                  ];
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCover(String? coverUrl) {
    return Container(
      width: double.infinity,
      height: 260,
      color: AppColors.cardBg,
      child: coverUrl != null && coverUrl.isNotEmpty
          ? Image.network(
              coverUrl,
              fit: BoxFit.cover,
              width: double.infinity,
              height: 260,
              errorBuilder: (_, __, ___) => _coverFallback(),
            )
          : _coverFallback(),
    );
  }

  Widget _coverFallback() {
    return const Center(
      child: Icon(Icons.tv, color: AppColors.hintText, size: 64),
    );
  }

  Widget _buildSeasonHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.lightOrange,
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildEpisodeTile(EpisodeModel episode, String seasonTitle) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      leading: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Center(
          child: Text(
            '${episode.episodeNumber}',
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
      title: Text(
        episode.title,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        _formatDuration(episode.duration),
        style: const TextStyle(color: AppColors.hintText, fontSize: 12),
      ),
      trailing: episode.playbackUrl != null
          ? const Icon(Icons.play_circle_fill, color: AppColors.orange)
          : const Icon(Icons.lock, color: AppColors.hintText),
      onTap: episode.playbackUrl != null ? () => _playEpisode(episode) : null,
    );
  }

  void _playEpisode(EpisodeModel episode) {
    final series = _series ?? widget.series;

    // Find next/previous episodes in the full series order.
    final all = series.allEpisodes;
    final index = all.indexWhere((e) => e.id == episode.id);
    final nextId = index >= 0 && index < all.length - 1 ? all[index + 1].id : null;
    final prevId = index > 0 ? all[index - 1].id : null;

    final args = VodPlaybackArgs.fromEpisode(
      series,
      episode,
      nextEpisodeId: nextId,
      previousEpisodeId: prevId,
    );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => VodPlayerScreen(args: args),
      ),
    );
  }

  String _formatDuration(int seconds) {
    final d = Duration(seconds: seconds);
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    if (h > 0) return '${h}h ${m}m';
    return '${m}m';
  }
}
