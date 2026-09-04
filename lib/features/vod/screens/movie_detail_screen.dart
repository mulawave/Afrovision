import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../models/movie_model.dart';
import '../models/vod_playback_args.dart';
import 'vod_player_screen.dart';

/// Movie detail page with synopsis, poster, and play / download entry.
class MovieDetailScreen extends StatelessWidget {
  final MovieModel movie;

  const MovieDetailScreen({
    super.key,
    required this.movie,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: AppColors.darkBlue,
            foregroundColor: AppColors.white,
            expandedHeight: 280,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: _buildPoster(context),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    movie.title,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildMetaRow(),
                  const SizedBox(height: 20),
                  _buildButtons(context),
                  const SizedBox(height: 24),
                  if (movie.synopsis != null && movie.synopsis!.isNotEmpty)
                    Text(
                      movie.synopsis!,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.85),
                        fontSize: 14,
                        height: 1.5,
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

  Widget _buildPoster(BuildContext context) {
    final poster = movie.posterUrl;
    return Container(
      width: double.infinity,
      height: 280,
      color: AppColors.cardBg,
      child: poster != null && poster.isNotEmpty
          ? Image.network(
              poster,
              fit: BoxFit.cover,
              width: double.infinity,
              height: 280,
              errorBuilder: (_, __, ___) => _posterFallback(),
            )
          : _posterFallback(),
    );
  }

  Widget _posterFallback() {
    return const Center(
      child: Icon(Icons.movie, color: AppColors.hintText, size: 64),
    );
  }

  Widget _buildMetaRow() {
    return Row(
      children: [
        if (movie.duration > 0)
          _metaChip(_formatDuration(movie.duration)),
        if (movie.ageClassification.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: _metaChip(movie.ageClassification.toUpperCase()),
          ),
      ],
    );
  }

  Widget _metaChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        border: Border.all(color: AppColors.inputBorder),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(color: AppColors.goldText, fontSize: 12),
      ),
    );
  }

  Widget _buildButtons(BuildContext context) {
    final hasSource = movie.playbackUrl != null && movie.playbackUrl!.isNotEmpty;

    return Row(
      children: [
        Expanded(
          child: AppButton(
            label: 'Play',
            onPressed: hasSource ? () => _play(context) : null,
            loading: false,
          ),
        ),
        if (movie.downloadable) ...[
          const SizedBox(width: 12),
          Expanded(
            child: AppButton(
              label: 'Download',
              onPressed: hasSource ? () => _play(context, fromDownload: true) : null,
              loading: false,
            ),
          ),
        ],
      ],
    );
  }

  void _play(BuildContext context, {bool fromDownload = false}) {
    final args = VodPlaybackArgs.fromMovie(movie);
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
