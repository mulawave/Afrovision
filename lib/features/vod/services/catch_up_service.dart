import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/api/api_service.dart';
import '../../../core/services/section_cache.dart';
import '../models/catch_up_models.dart';

/// Service for the Catch-up/IMDb discovery feed and series metadata enrichment.
class CatchUpService {
  static const String _cacheKey = 'catchup_home';
  static final Map<String, CatchUpItem> _titleDetailCache = {};

  static Future<CatchUpHome> getHome() async {
    final data = await ApiService.get('/catchup/home');
    await SectionCache.write(_cacheKey, jsonEncode(data));
    return CatchUpHome.fromJson(data);
  }

  static Future<CatchUpHome> getHomeCached({
    void Function(CatchUpHome cached)? onCached,
  }) async {
    if (onCached != null) {
      final raw = await SectionCache.readStale(_cacheKey);
      if (raw != null) {
        try {
          onCached(CatchUpHome.fromJson(
              jsonDecode(raw) as Map<String, dynamic>));
        } catch (_) {}
      }
    }
    return getHome();
  }

  static Future<CatchUpItem> getDetail(String type, String id) async {
    final data = await ApiService.get('/catchup/detail?type=$type&id=$id');
    final payload = data['data'] as Map<String, dynamic>? ?? data;
    return CatchUpItem.fromJson(payload);
  }

  /// Resolves rich TMDB / TV metadata (cast with circular photos, ratings,
  /// release date, genres, overview) for a series by its title.
  static Future<CatchUpItem?> lookupSeriesByTitle(String rawTitle) async {
    final cleanTitle = rawTitle
        .replaceAll(RegExp(r'\b(season|s)\s*\d+.*$', caseSensitive: false), '')
        .replaceAll(RegExp(r'\(\d{4}\)'), '')
        .trim();
    if (cleanTitle.isEmpty) return null;

    final key = cleanTitle.toLowerCase();
    if (_titleDetailCache.containsKey(key)) return _titleDetailCache[key];

    // 1. Try backend TMDB title lookup endpoint (/catchup/detail?type=series&title=...)
    try {
      final encoded = Uri.encodeQueryComponent(cleanTitle);
      final data =
          await ApiService.get('/catchup/detail?type=series&title=$encoded');
      final payload = data['data'] as Map<String, dynamic>?;
      if (payload != null && payload['title'] != null) {
        final item = CatchUpItem.fromJson(payload);
        if (item.cast.isNotEmpty || item.overview.isNotEmpty) {
          _titleDetailCache[key] = item;
          return item;
        }
      }
    } catch (_) {}

    // 2. Match against cached/live TMDB Catch-Up Home feed and call getDetail(id)
    try {
      final home = await getHomeCached();
      final all = <CatchUpItem>[
        ...home.hero,
        if (home.episodeSpotlight != null) home.episodeSpotlight!,
        for (final r in home.rails) ...r.items,
      ];
      CatchUpItem? matched;
      for (final item in all) {
        final t = item.title.trim().toLowerCase();
        if (t == key || t.contains(key) || key.contains(t)) {
          matched = item;
          break;
        }
      }
      if (matched != null && matched.id.isNotEmpty) {
        final detail = await getDetail(matched.type, matched.id);
        _titleDetailCache[key] = detail;
        return detail;
      }
    } catch (_) {}

    // 3. Public TVMaze fallback (zero-config, returns cast photos, roles,
    //    release date, rating, genres, and summary for any series title).
    try {
      final uri = Uri.parse(
        'https://api.tvmaze.com/singlesearch/shows?q=${Uri.encodeQueryComponent(cleanTitle)}&embed=cast',
      );
      final res = await http.get(uri).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final imageMap = map['image'] as Map<String, dynamic>?;
        final ratingMap = map['rating'] as Map<String, dynamic>?;
        final embedded = map['_embedded'] as Map<String, dynamic>?;
        final rawCast = embedded?['cast'] as List? ?? const [];

        final cast = <CatchUpCredit>[];
        final seenIds = <String>{};
        for (final entry in rawCast.whereType<Map<String, dynamic>>()) {
          final person = entry['person'] as Map<String, dynamic>?;
          final character = entry['character'] as Map<String, dynamic>?;
          if (person == null) continue;
          final pid = (person['id'] ?? '').toString();
          if (pid.isEmpty || seenIds.contains(pid)) continue;
          seenIds.add(pid);
          final pImg = person['image'] as Map<String, dynamic>?;
          final cImg = character?['image'] as Map<String, dynamic>?;
          cast.add(
            CatchUpCredit(
              id: pid,
              name: (person['name'] ?? 'Unknown').toString(),
              role: character?['name']?.toString(),
              profileUrl: (pImg?['medium'] ??
                      pImg?['original'] ??
                      cImg?['medium'])
                  ?.toString(),
            ),
          );
        }

        final summaryHtml = (map['summary'] ?? '').toString();
        final overview = summaryHtml
            .replaceAll(RegExp(r'<[^>]*>'), '')
            .replaceAll('&amp;', '&')
            .replaceAll('&quot;', '"')
            .trim();

        final item = CatchUpItem(
          id: (map['id'] ?? '').toString(),
          type: 'series',
          title: (map['name'] ?? cleanTitle).toString(),
          overview: overview,
          posterUrl: imageMap?['medium']?.toString(),
          backdropUrl: imageMap?['original']?.toString(),
          rating: (ratingMap?['average'] as num?)?.toDouble() ?? 0.0,
          releaseDate: map['premiered']?.toString(),
          runtime: (map['averageRuntime'] as num?)?.toInt() ??
              (map['runtime'] as num?)?.toInt(),
          genres: (map['genres'] as List? ?? const [])
              .map((e) => e.toString())
              .toList(),
          cast: cast,
        );
        _titleDetailCache[key] = item;
        return item;
      }
    } catch (_) {}

    return null;
  }

  /// Resolves rich TMDB movie metadata (cast with circular photos, ratings,
  /// release date, runtime, genres, overview, trailer, certification) by title.
  static Future<CatchUpItem?> lookupMovieByTitle(String rawTitle) async {
    final cleanTitle = rawTitle
        .replaceAll(RegExp(r'\(\d{4}\)'), '')
        .replaceAll(RegExp(r'\[.*?\]'), '')
        .trim();
    if (cleanTitle.isEmpty) return null;

    final key = 'movie:${cleanTitle.toLowerCase()}';
    if (_titleDetailCache.containsKey(key)) return _titleDetailCache[key];

    // 1. Try backend TMDB title lookup endpoint (/catchup/detail?type=movie&title=...)
    try {
      final encoded = Uri.encodeQueryComponent(cleanTitle);
      final data =
          await ApiService.get('/catchup/detail?type=movie&title=$encoded');
      final payload = data['data'] as Map<String, dynamic>?;
      if (payload != null && payload['title'] != null) {
        final item = CatchUpItem.fromJson(payload);
        if (item.cast.isNotEmpty ||
            item.overview.isNotEmpty ||
            item.rating > 0) {
          _titleDetailCache[key] = item;
          return item;
        }
      }
    } catch (_) {}

    // 2. Match against cached/live TMDB Catch-Up Home feed and call getDetail(id)
    try {
      final home = await getHomeCached();
      final all = <CatchUpItem>[
        ...home.hero,
        for (final r in home.rails) ...r.items,
      ];
      final cleanLower = cleanTitle.toLowerCase();
      CatchUpItem? matched;
      for (final item in all) {
        if (item.type != 'movie') continue;
        final t = item.title.trim().toLowerCase();
        if (t == cleanLower ||
            t.contains(cleanLower) ||
            cleanLower.contains(t)) {
          matched = item;
          break;
        }
      }
      if (matched != null && matched.id.isNotEmpty) {
        final detail = await getDetail('movie', matched.id);
        _titleDetailCache[key] = detail;
        return detail;
      }
    } catch (_) {}

    return null;
  }
}
