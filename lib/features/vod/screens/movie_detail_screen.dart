import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../models/movie_model.dart';
import '../models/vod_playback_args.dart';
import 'vod_player_screen.dart';

class MovieDetailScreen extends StatelessWidget {
  final MovieModel movie;

  const MovieDetailScreen({super.key, required this.movie});

  @override
  Widget build(BuildContext context) {
    final hasSource = movie.playbackUrl != null && movie.playbackUrl!.isNotEmpty;
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildHero(context)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildActionRow(context, hasSource: hasSource),
                    const SizedBox(height: 16),
                    if (movie.synopsis != null && movie.synopsis!.isNotEmpty)
                      Text(
                        movie.synopsis!,
                        style: const TextStyle(
                          color: Nocturne.textMuted,
                          fontSize: 13,
                          height: 1.5,
                        ),
                      ),
                    const SizedBox(height: 18),
                    _buildDetails(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHero(BuildContext context) {
    final poster = movie.posterUrl;
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
          child: poster != null && poster.isNotEmpty
              ? ShaderMask(
                  shaderCallback: (r) => LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.white, Colors.white.withValues(alpha: 0)],
                    stops: const [0.55, 1],
                  ).createShader(r),
                  blendMode: BlendMode.dstIn,
                  child: Image.network(
                    poster,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: 230,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                )
              : null,
        ),
        Positioned(
          left: 16,
          top: 12,
          child: _backButton(context),
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
                movie.title,
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
                _metaLine(),
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

  Widget _backButton(BuildContext context) {
    return GestureDetector(
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
    );
  }

  Widget _buildActionRow(BuildContext context, {required bool hasSource}) {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: hasSource ? () => _play(context) : null,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(9),
                border: Border.all(
                  color: hasSource ? Nocturne.gold : Nocturne.border,
                  width: 1,
                ),
                color: hasSource
                    ? Nocturne.gold.withValues(alpha: 0.02)
                    : Colors.transparent,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.play_arrow_rounded,
                    color: hasSource ? Nocturne.gold : Nocturne.textHint,
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    hasSource ? 'Play' : 'Unavailable',
                    style: TextStyle(
                      color: hasSource ? Nocturne.gold : Nocturne.textHint,
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
        _iconOnly(
          icon: Icons.add_rounded,
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Added to library'),
                duration: Duration(seconds: 2),
              ),
            );
          },
        ),
        if (movie.downloadable) ...[
          const SizedBox(width: 8),
          _iconOnly(
            icon: Icons.download_rounded,
            onTap: hasSource
                ? () => _play(context, fromDownload: true)
                : () {},
          ),
        ],
      ],
    );
  }

  Widget _iconOnly({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 46,
        height: 42,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: Nocturne.border, width: 1),
        ),
        alignment: Alignment.center,
        child: Icon(icon, color: Nocturne.textMuted, size: 18),
      ),
    );
  }

  Widget _buildDetails() {
    final rows = <MapEntry<String, String>>[];
    if (movie.ageClassification.isNotEmpty) {
      rows.add(MapEntry('Rating', movie.ageClassification.toUpperCase()));
    }
    if (movie.duration > 0) {
      rows.add(MapEntry('Duration', _formatDuration(movie.duration)));
    }
    rows.add(MapEntry('Access',
        movie.downloadable ? 'Playable · downloadable' : 'Playable'));
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'DETAILS',
          style: TextStyle(
            color: Nocturne.textFaint,
            fontSize: 10,
            fontWeight: FontWeight.w500,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 8),
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 96,
                  child: Text(
                    r.key,
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 12.5,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    r.value,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 12.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  String _metaLine() {
    final parts = <String>[];
    if (movie.duration > 0) parts.add(_formatDuration(movie.duration));
    if (movie.ageClassification.isNotEmpty) {
      parts.add(movie.ageClassification.toUpperCase());
    }
    return parts.join(' · ');
  }

  void _play(BuildContext context, {bool fromDownload = false}) {
    final args = VodPlaybackArgs.fromMovie(movie);
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
