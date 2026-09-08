import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../models/movie_model.dart';
import '../models/series_model.dart';
import '../services/vod_service.dart';
import 'movie_detail_screen.dart';
import 'series_detail_screen.dart';

/// Nocturne search over public movies + series.
///
/// Debounced client-side filter — the search bar type-throttles into a
/// single filter pass over the same feeds the Media Center already loads
/// (cached first via `VodService.*Cached`), so results appear instantly
/// on a warm cache and gracefully fall back to the network on cold.
///
/// Route: `/media/search`. Exclusive-channel content is intentionally
/// excluded from the free public feeds; per plan Phase 6.3 that surface
/// stays gated behind the paywall.
class MediaSearchScreen extends StatefulWidget {
  const MediaSearchScreen({super.key});

  @override
  State<MediaSearchScreen> createState() => _MediaSearchScreenState();
}

class _MediaSearchScreenState extends State<MediaSearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  bool _loading = true;
  String? _error;

  List<MovieModel> _movies = const [];
  List<SeriesModel> _series = const [];

  String _query = '';

  @override
  void initState() {
    super.initState();
    _prime();
    _controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onChanged);
    _controller.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _prime() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        VodService.getPublicMoviesCached(limit: 48),
        VodService.getPublicSeriesCached(limit: 48),
      ]);
      final movies = (results[0] as MovieListResponse).movies;
      final series = (results[1] as SeriesListResponse).series;
      if (!mounted) return;
      setState(() {
        _movies = movies;
        _series = series;
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

  void _onChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 180), () {
      if (!mounted) return;
      setState(() => _query = _controller.text.trim());
    });
  }

  List<_Row> get _rows {
    if (_query.isEmpty) {
      // Empty search → recent picks, capped so the screen doesn't feel
      // like it dumped the whole catalogue.
      return [
        ..._movies.take(10).map((m) => _Row.movie(m)),
        ..._series.take(10).map((s) => _Row.series(s)),
      ];
    }
    final q = _query.toLowerCase();
    bool match(String title) => title.toLowerCase().contains(q);
    return [
      ..._movies.where((m) => match(m.title)).map(_Row.movie),
      ..._series.where((s) => match(s.title)).map(_Row.series),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 6, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _searchBar(),
              const SizedBox(height: 12),
              Text(
                _loading
                    ? 'Searching…'
                    : _query.isEmpty
                        ? 'Recent picks'
                        : '${rows.length} result${rows.length == 1 ? '' : 's'} for “$_query”',
                style: const TextStyle(color: Nocturne.textFaint, fontSize: 11),
              ),
              const SizedBox(height: 12),
              Expanded(child: _body(rows)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _searchBar() {
    return Row(
      children: [
        GestureDetector(
          onTap: () => Navigator.of(context).maybePop(),
          child: Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: Nocturne.border, width: 1),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.chevron_left_rounded,
                color: Nocturne.text, size: 20),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            constraints: const BoxConstraints(minHeight: 38),
            decoration: BoxDecoration(
              color: const Color(0xFF101D43),
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: Nocturne.border, width: 1),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 11),
            child: Row(
              children: [
                const Icon(Icons.search_rounded,
                    size: 15, color: Nocturne.textFaint),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _controller,
                    autofocus: true,
                    cursorColor: Nocturne.gold,
                    style: const TextStyle(
                        color: Nocturne.text, fontSize: 13.5),
                    decoration: const InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      hintText: 'Search movies and series',
                      hintStyle: TextStyle(
                          color: Nocturne.textHint, fontSize: 13.5),
                    ),
                  ),
                ),
                if (_controller.text.isNotEmpty)
                  GestureDetector(
                    onTap: () {
                      _controller.clear();
                      setState(() => _query = '');
                    },
                    child: const Padding(
                      padding: EdgeInsets.only(left: 4),
                      child: Icon(Icons.close_rounded,
                          size: 16, color: Nocturne.textHint),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _body(List<_Row> rows) {
    if (_loading && rows.isEmpty) {
      return const Center(
          child: CircularProgressIndicator(color: Nocturne.gold));
    }
    if (_error != null && rows.isEmpty) {
      return _errorBlock(_error!);
    }
    if (rows.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _query.isEmpty
                ? 'Nothing to show yet.'
                : 'No matches for “$_query”.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Nocturne.textFaint, fontSize: 12.5),
          ),
        ),
      );
    }
    return ListView.separated(
      itemCount: rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) => _rowTile(rows[i]),
    );
  }

  Widget _rowTile(_Row row) {
    return GestureDetector(
      onTap: () {
        if (row.movie != null) {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => MovieDetailScreen(movie: row.movie!),
          ));
        } else if (row.series != null) {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => SeriesDetailScreen(series: row.series!),
          ));
        }
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              width: 52,
              height: 74,
              child: (row.posterUrl == null || row.posterUrl!.isEmpty)
                  ? Container(color: const Color(0xFF111C3F))
                  : CachedNetworkImage(
                      imageUrl: row.posterUrl!,
                      fit: BoxFit.cover,
                      memCacheWidth: 156,
                      placeholder: (_, __) =>
                          Container(color: const Color(0xFF111C3F)),
                      errorWidget: (_, __, ___) =>
                          Container(color: const Color(0xFF111C3F)),
                    ),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  row.title,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  row.meta,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorBlock(String msg) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: Nocturne.redSoft, size: 32),
            const SizedBox(height: 10),
            Text(msg,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Nocturne.textMuted, fontSize: 12.5)),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _prime,
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
      ),
    );
  }
}

class _Row {
  final MovieModel? movie;
  final SeriesModel? series;
  const _Row._({this.movie, this.series});
  factory _Row.movie(MovieModel m) => _Row._(movie: m);
  factory _Row.series(SeriesModel s) => _Row._(series: s);

  String get title => movie?.title ?? series?.title ?? '';
  String? get posterUrl => movie?.posterUrl ?? series?.coverUrl;
  String get meta {
    if (movie != null) {
      final parts = <String>['Movie'];
      if (movie!.duration > 0) {
        final d = Duration(seconds: movie!.duration);
        final h = d.inHours;
        final m = d.inMinutes.remainder(60);
        parts.add(h > 0 ? '${h}h ${m.toString().padLeft(2, '0')}m' : '${m}m');
      }
      return parts.join(' · ');
    }
    if (series != null) {
      final parts = <String>['Series'];
      if (series!.seasons.isNotEmpty) {
        parts.add('S${series!.seasons.length}');
      }
      return parts.join(' · ');
    }
    return '';
  }
}
