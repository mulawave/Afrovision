import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../models/movie_model.dart';
import '../models/series_model.dart';
import '../services/vod_service.dart';
import 'movie_detail_screen.dart';
import 'series_detail_screen.dart';

/// Netflix-style home for VOD and series.
///
/// Shows a featured hero, a "Movies" rail, and a "Series" rail. Tapping an item
/// pushes its detail page; from there the user can play or download.
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
  MovieModel? _hero;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        VodService.getPublicMovies(limit: 12),
        VodService.getPublicSeries(limit: 12),
      ]);

      final movieResponse = results[0] as MovieListResponse;
      final seriesResponse = results[1] as SeriesListResponse;

      setState(() {
        _movies = movieResponse.movies;
        _series = seriesResponse.series;
        _hero = _movies.isNotEmpty ? _movies.first : null;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      body: RefreshIndicator(
        color: AppColors.orange,
        backgroundColor: AppColors.cardBg,
        onRefresh: _loadData,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.orange),
      );
    }

    if (_error != null) {
      return _buildError(_error!);
    }

    if (_movies.isEmpty && _series.isEmpty) {
      return _buildEmpty();
    }

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHero(),
              const SizedBox(height: 24),
              _buildSectionHeader('Movies'),
              _buildMovieRail(),
              const SizedBox(height: 24),
              _buildSectionHeader('Series'),
              _buildSeriesRail(),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHero() {
    final hero = _hero;
    if (hero == null) return const SizedBox.shrink();

    final poster = hero.posterUrl;
    return GestureDetector(
      onTap: () => _openMovie(hero),
      child: Container(
        height: 320,
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.lightBlue.withValues(alpha: 0.6),
              AppColors.darkBlue,
            ],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (poster != null && poster.isNotEmpty)
              ShaderMask(
                shaderCallback: (rect) {
                  return LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.white, Colors.white.withValues(alpha: 0.0)],
                    stops: const [0.0, 0.9],
                  ).createShader(rect);
                },
                blendMode: BlendMode.dstIn,
                child: Image.network(
                  poster,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: 320,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            Positioned(
              left: 20,
              right: 20,
              bottom: 40,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.orange,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'FEATURED',
                      style: TextStyle(
                        color: AppColors.darkBlue,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    hero.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (hero.synopsis != null && hero.synopsis!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      hero.synopsis!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.85),
                        fontSize: 13,
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

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildMovieRail() {
    if (_movies.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 180,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _movies.length,
        itemBuilder: (context, index) => _buildPosterCard(
          title: _movies[index].title,
          imageUrl: _movies[index].posterUrl,
          onTap: () => _openMovie(_movies[index]),
        ),
      ),
    );
  }

  Widget _buildSeriesRail() {
    if (_series.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 180,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _series.length,
        itemBuilder: (context, index) => _buildPosterCard(
          title: _series[index].title,
          imageUrl: _series[index].coverUrl,
          onTap: () => _openSeries(_series[index]),
        ),
      ),
    );
  }

  Widget _buildPosterCard({
    required String title,
    required String? imageUrl,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 120,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                height: 150,
                color: AppColors.cardBg,
                child: imageUrl != null && imageUrl.isNotEmpty
                    ? Image.network(
                        imageUrl,
                        fit: BoxFit.cover,
                        width: 120,
                        height: 150,
                        errorBuilder: (_, __, ___) => _posterFallback(title),
                      )
                    : _posterFallback(title),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.white, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _posterFallback(String title) {
    return Center(
      child: Icon(
        Icons.movie,
        color: AppColors.hintText,
        size: 40,
      ),
    );
  }

  Widget _buildError(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.errorRed, size: 48),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.white, fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadData,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.orange,
                foregroundColor: AppColors.darkBlue,
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return const Center(
      child: Text(
        'No movies or series available yet.',
        style: TextStyle(color: AppColors.hintText, fontSize: 14),
      ),
    );
  }

  void _openMovie(MovieModel movie) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MovieDetailScreen(movie: movie),
      ),
    );
  }

  void _openSeries(SeriesModel series) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SeriesDetailScreen(series: series),
      ),
    );
  }
}
