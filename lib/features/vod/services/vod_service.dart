import '../../../core/api/api_service.dart';
import '../models/movie_model.dart';
import '../models/series_model.dart';

class MovieListResponse {
  final List<MovieModel> movies;
  final int page;
  final int limit;
  final int total;
  final int pages;

  const MovieListResponse({
    required this.movies,
    required this.page,
    required this.limit,
    required this.total,
    required this.pages,
  });

  factory MovieListResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    final movies = (data['movies'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(MovieModel.fromJson)
        .toList();
    final pagination = data['pagination'] as Map<String, dynamic>? ?? {};
    return MovieListResponse(
      movies: movies,
      page: (pagination['page'] as num?)?.toInt() ?? 1,
      limit: (pagination['limit'] as num?)?.toInt() ?? 24,
      total: (pagination['total'] as num?)?.toInt() ?? 0,
      pages: (pagination['pages'] as num?)?.toInt() ?? 1,
    );
  }
}

class SeriesListResponse {
  final List<SeriesModel> series;
  final int page;
  final int limit;
  final int total;
  final int pages;

  const SeriesListResponse({
    required this.series,
    required this.page,
    required this.limit,
    required this.total,
    required this.pages,
  });

  factory SeriesListResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    final series = (data['series'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(SeriesModel.fromJson)
        .toList();
    final pagination = data['pagination'] as Map<String, dynamic>? ?? {};
    return SeriesListResponse(
      series: series,
      page: (pagination['page'] as num?)?.toInt() ?? 1,
      limit: (pagination['limit'] as num?)?.toInt() ?? 24,
      total: (pagination['total'] as num?)?.toInt() ?? 0,
      pages: (pagination['pages'] as num?)?.toInt() ?? 1,
    );
  }
}

class EpisodeDetailResponse {
  final EpisodeModel episode;
  final EpisodeNavigation navigation;

  const EpisodeDetailResponse({
    required this.episode,
    required this.navigation,
  });

  factory EpisodeDetailResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return EpisodeDetailResponse(
      episode: EpisodeModel.fromJson(data['episode'] as Map<String, dynamic>),
      navigation: EpisodeNavigation.fromJson(
        data['navigation'] as Map<String, dynamic>? ?? {},
      ),
    );
  }
}

class WatchProgress {
  final int positionSeconds;
  final int durationSeconds;
  final int? updatedAt;

  const WatchProgress({
    required this.positionSeconds,
    required this.durationSeconds,
    this.updatedAt,
  });

  factory WatchProgress.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return WatchProgress(
      positionSeconds: (data['position_seconds'] as num?)?.toInt() ?? 0,
      durationSeconds: (data['duration_seconds'] as num?)?.toInt() ?? 0,
      updatedAt: (data['updated_at'] as num?)?.toInt(),
    );
  }
}

/// Service for movies and series public feeds, details, and watch progress.
class VodService {
  /// GET /movies — global public movie feed.
  static Future<MovieListResponse> getPublicMovies({
    int page = 1,
    int limit = 24,
  }) async {
    final data = await ApiService.get('/movies?page=$page&limit=$limit');
    return MovieListResponse.fromJson(data);
  }

  /// GET /movies/:movieId — public movie detail.
  static Future<MovieModel> getMovieById(String movieId) async {
    final data = await ApiService.get('/movies/$movieId');
    final movieData = data['data'] as Map<String, dynamic>? ?? {};
    return MovieModel.fromJson(movieData['movie'] as Map<String, dynamic>);
  }

  /// GET /channels/:channelId/movies — channel-scoped published movies.
  static Future<List<MovieModel>> getChannelMovies(String channelId) async {
    final data = await ApiService.get('/channels/$channelId/movies');
    final list = (data['data'] as Map<String, dynamic>? ?? {})['movies'] as List? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(MovieModel.fromJson)
        .toList();
  }

  /// GET /series — global public series feed.
  static Future<SeriesListResponse> getPublicSeries({
    int page = 1,
    int limit = 24,
  }) async {
    final data = await ApiService.get('/series?page=$page&limit=$limit');
    return SeriesListResponse.fromJson(data);
  }

  /// GET /channels/:channelId/series — channel-scoped published series.
  static Future<List<SeriesModel>> getChannelSeries(String channelId) async {
    final data = await ApiService.get('/channels/$channelId/series');
    final list = (data['data'] as Map<String, dynamic>? ?? {})['series'] as List? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(SeriesModel.fromJson)
        .toList();
  }

  /// GET /channels/:channelId/series/:seriesId — series detail with seasons & episodes.
  static Future<SeriesModel> getSeriesDetail(
    String channelId,
    String seriesId,
  ) async {
    final data = await ApiService.get('/channels/$channelId/series/$seriesId');
    final seriesData = data['data'] as Map<String, dynamic>? ?? {};
    return SeriesModel.fromJson(seriesData['series'] as Map<String, dynamic>);
  }

  /// GET /channels/:channelId/series/:seriesId/episodes/:episodeId
  static Future<EpisodeDetailResponse> getEpisodeDetail(
    String channelId,
    String seriesId,
    String episodeId,
  ) async {
    final data = await ApiService.get(
      '/channels/$channelId/series/$seriesId/episodes/$episodeId',
    );
    return EpisodeDetailResponse.fromJson(data);
  }

  /// POST /watch-progress/:mediaType/:mediaId
  static Future<void> saveProgress(
    String mediaType,
    String mediaId,
    int positionSeconds,
    int durationSeconds,
  ) async {
    await ApiService.post(
      '/watch-progress/$mediaType/$mediaId',
      {
        'position_seconds': positionSeconds,
        'duration_seconds': durationSeconds,
      },
    );
  }

  /// GET /watch-progress/:mediaType/:mediaId
  static Future<WatchProgress?> getProgress(
    String mediaType,
    String mediaId,
  ) async {
    try {
      final data = await ApiService.get('/watch-progress/$mediaType/$mediaId');
      return WatchProgress.fromJson(data);
    } catch (_) {
      return null;
    }
  }
}
