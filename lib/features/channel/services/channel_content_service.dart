import 'dart:convert';

import '../../../core/api/api_service.dart';
import '../../../core/services/section_cache.dart';

class ChannelMovie {
  final String id;
  final String channelId;
  final String title;
  final String synopsis;
  final String? posterUrl;
  final String? hostedUrl;
  final String? externalUrl;
  final String videoSourceMode;
  final String status;
  final String ageClassification;
  final int duration;
  final int totalViews;
  final int? publishedAt;
  final int? createdAt;

  ChannelMovie({
    required this.id,
    required this.channelId,
    required this.title,
    this.synopsis = '',
    this.posterUrl,
    this.hostedUrl,
    this.externalUrl,
    this.videoSourceMode = 'hosted',
    this.status = 'draft',
    this.ageClassification = 'teen',
    this.duration = 0,
    this.totalViews = 0,
    this.publishedAt,
    this.createdAt,
  });

  factory ChannelMovie.fromJson(Map<String, dynamic> json) {
    return ChannelMovie(
      id: json['id'] ?? '',
      channelId: json['channel_id'] ?? '',
      title: json['title'] ?? 'Untitled',
      synopsis: json['synopsis'] ?? '',
      posterUrl: json['poster_url'],
      hostedUrl: json['hosted_url'],
      externalUrl: json['external_url'],
      videoSourceMode: json['video_source_mode'] ?? 'hosted',
      status: json['status'] ?? 'draft',
      ageClassification: json['age_classification'] ?? 'teen',
      duration: (json['duration'] as num?)?.toInt() ?? 0,
      totalViews: (json['total_views'] as num?)?.toInt() ?? 0,
      publishedAt: json['published_at'] is int
          ? json['published_at']
          : (json['published_at'] as num?)?.toInt(),
      createdAt: json['created_at'] is int
          ? json['created_at']
          : (json['created_at'] as num?)?.toInt(),
    );
  }

  String? get playableUrl {
    if (videoSourceMode == 'external_url') return externalUrl;
    return hostedUrl;
  }

  bool get hasVideo => playableUrl != null && playableUrl!.isNotEmpty;
}

class ChannelSeries {
  final String id;
  final String channelId;
  final String title;
  final String description;
  final String? coverUrl;
  final String status;
  final String ageClassification;
  final int? publishedAt;
  final int? createdAt;

  ChannelSeries({
    required this.id,
    required this.channelId,
    required this.title,
    this.description = '',
    this.coverUrl,
    this.status = 'draft',
    this.ageClassification = 'teen',
    this.publishedAt,
    this.createdAt,
  });

  factory ChannelSeries.fromJson(Map<String, dynamic> json) {
    return ChannelSeries(
      id: json['id'] ?? '',
      channelId: json['channel_id'] ?? '',
      title: json['title'] ?? 'Untitled',
      description: json['description'] ?? '',
      coverUrl: json['cover_url'],
      status: json['status'] ?? 'draft',
      ageClassification: json['age_classification'] ?? 'teen',
      publishedAt: json['published_at'] is int
          ? json['published_at']
          : (json['published_at'] as num?)?.toInt(),
      createdAt: json['created_at'] is int
          ? json['created_at']
          : (json['created_at'] as num?)?.toInt(),
    );
  }
}

class ChannelEpisode {
  final String id;
  final String seasonId;
  final String title;
  final int episodeNumber;
  final String? videoUrl;
  final String? hostedUrl;
  final String? publicUrl;
  final int duration;
  final int? createdAt;

  ChannelEpisode({
    required this.id,
    required this.seasonId,
    required this.title,
    this.episodeNumber = 0,
    this.videoUrl,
    this.hostedUrl,
    this.publicUrl,
    this.duration = 0,
    this.createdAt,
  });

  factory ChannelEpisode.fromJson(Map<String, dynamic> json) {
    return ChannelEpisode(
      id: json['id'] ?? '',
      seasonId: json['season_id'] ?? '',
      title: json['title'] ?? 'Untitled',
      episodeNumber: (json['episode_number'] as num?)?.toInt() ?? 0,
      videoUrl: json['video_url']?.toString(),
      hostedUrl: json['hosted_url']?.toString(),
      publicUrl: json['public_url']?.toString(),
      duration: (json['duration'] as num?)?.toInt() ?? 0,
      createdAt: json['created_at'] is int
          ? json['created_at']
          : (json['created_at'] as num?)?.toInt(),
    );
  }

  String? get playableUrl {
    return videoUrl ?? hostedUrl ?? publicUrl;
  }

  bool get hasVideo => playableUrl != null && playableUrl!.isNotEmpty;
}

class ChannelSeason {
  final String id;
  final String seriesId;
  final String title;
  final int seasonNumber;
  final List<ChannelEpisode> episodes;

  ChannelSeason({
    required this.id,
    required this.seriesId,
    required this.title,
    this.seasonNumber = 1,
    this.episodes = const <ChannelEpisode>[],
  });

  factory ChannelSeason.fromJson(Map<String, dynamic> json) {
    final rawEpisodes = json['episodes'];
    return ChannelSeason(
      id: json['id'] ?? '',
      seriesId: json['series_id'] ?? '',
      title: json['title'] ?? 'Season ${(json['season_number'] as num?)?.toInt() ?? 1}',
      seasonNumber: (json['season_number'] as num?)?.toInt() ?? 1,
      episodes: rawEpisodes is List
          ? rawEpisodes
              .whereType<Map<String, dynamic>>()
              .map(ChannelEpisode.fromJson)
              .toList()
          : const <ChannelEpisode>[],
    );
  }
}

class ChannelSeriesDetail {
  final String id;
  final String channelId;
  final String title;
  final String description;
  final String? coverUrl;
  final String status;
  final List<ChannelSeason> seasons;

  ChannelSeriesDetail({
    required this.id,
    required this.channelId,
    required this.title,
    this.description = '',
    this.coverUrl,
    this.status = 'draft',
    this.seasons = const <ChannelSeason>[],
  });

  factory ChannelSeriesDetail.fromJson(Map<String, dynamic> json) {
    final rawSeasons = json['seasons'];
    return ChannelSeriesDetail(
      id: json['id'] ?? '',
      channelId: json['channel_id'] ?? '',
      title: json['title'] ?? 'Untitled',
      description: json['description'] ?? '',
      coverUrl: json['cover_url']?.toString(),
      status: json['status'] ?? 'draft',
      seasons: rawSeasons is List
          ? rawSeasons
              .whereType<Map<String, dynamic>>()
              .map(ChannelSeason.fromJson)
              .toList()
          : const <ChannelSeason>[],
    );
  }

  List<ChannelEpisode> get allEpisodes {
    final list = <ChannelEpisode>[];
    final sortedSeasons = [...seasons]..sort((a, b) => a.seasonNumber.compareTo(b.seasonNumber));
    for (final season in sortedSeasons) {
      final sorted = [...season.episodes]
        ..sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));
      list.addAll(sorted);
    }
    return list;
  }
}

class ChannelContentService {
  // ── Cache keys ─────────────────────────────────────────────────────────
  static String _moviesKey(String channelId) => 'movies_$channelId';
  static String _seriesKey(String channelId) => 'series_$channelId';

  static List<ChannelMovie> _parseMovies(dynamic data) {
    if (data is! Map) return const <ChannelMovie>[];
    final root = data['data'] as Map<String, dynamic>? ??
        data.cast<String, dynamic>();
    final rawMovies = root['movies'];
    if (rawMovies is! List) return const <ChannelMovie>[];
    return rawMovies
        .whereType<Map<String, dynamic>>()
        .map(ChannelMovie.fromJson)
        .toList();
  }

  static List<ChannelSeries> _parseSeries(dynamic data) {
    if (data is! Map) return const <ChannelSeries>[];
    final root = data['data'] as Map<String, dynamic>? ??
        data.cast<String, dynamic>();
    final rawSeries = root['series'];
    if (rawSeries is! List) return const <ChannelSeries>[];
    return rawSeries
        .whereType<Map<String, dynamic>>()
        .map(ChannelSeries.fromJson)
        .toList();
  }

  static Future<List<ChannelMovie>> getChannelMovies(String channelId) async {
    final data = await ApiService.get('/channels/$channelId/movies');
    // Persist raw JSON for the stale-while-revalidate path.
    await SectionCache.write(_moviesKey(channelId), jsonEncode(data));
    return _parseMovies(data);
  }

  static Future<List<ChannelSeries>> getChannelSeries(String channelId) async {
    final data = await ApiService.get('/channels/$channelId/series');
    await SectionCache.write(_seriesKey(channelId), jsonEncode(data));
    return _parseSeries(data);
  }

  /// Stale-while-revalidate variant used by the channel profile screen.
  ///
  /// If a cached payload exists (even if older than the fresh window), it is
  /// decoded and delivered synchronously to [onCached] so the UI can paint
  /// instantly. The network fetch then runs in the background and — on
  /// success — writes fresh JSON back to the cache and returns the fresh
  /// list. On failure the future still resolves to the last cached list
  /// (or an empty list) so callers do not have to distinguish.
  static Future<List<ChannelMovie>> getChannelMoviesCached(
    String channelId, {
    void Function(List<ChannelMovie>)? onCached,
  }) async {
    List<ChannelMovie> cached = const <ChannelMovie>[];
    final rawCached = await SectionCache.readStale(_moviesKey(channelId));
    if (rawCached != null) {
      try {
        cached = _parseMovies(jsonDecode(rawCached));
        if (cached.isNotEmpty && onCached != null) onCached(cached);
      } catch (_) {}
    }
    try {
      return await getChannelMovies(channelId);
    } catch (_) {
      return cached;
    }
  }

  static Future<List<ChannelSeries>> getChannelSeriesCached(
    String channelId, {
    void Function(List<ChannelSeries>)? onCached,
  }) async {
    List<ChannelSeries> cached = const <ChannelSeries>[];
    final rawCached = await SectionCache.readStale(_seriesKey(channelId));
    if (rawCached != null) {
      try {
        cached = _parseSeries(jsonDecode(rawCached));
        if (cached.isNotEmpty && onCached != null) onCached(cached);
      } catch (_) {}
    }
    try {
      return await getChannelSeries(channelId);
    } catch (_) {
      return cached;
    }
  }

  static Future<ChannelSeriesDetail?> getSeriesDetail(
    String channelId,
    String seriesId,
  ) async {
    try {
      final data = await ApiService.get('/channels/$channelId/series/$seriesId');
      final root = data['data'] as Map<String, dynamic>? ?? data;
      final rawSeries = root['series'] ?? root;
      if (rawSeries is! Map<String, dynamic>) return null;
      return ChannelSeriesDetail.fromJson(rawSeries);
    } catch (e) {
      return null;
    }
  }
}
