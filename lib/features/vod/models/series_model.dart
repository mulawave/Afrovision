class SeriesModel {
  final String id;
  final String channelId;
  final String? createdBy;
  final String title;
  final String? description;
  final String? coverUrl;
  final String status;
  final int? publishedAt;
  final int createdAt;
  final int? updatedAt;
  final List<SeasonModel> seasons;

  const SeriesModel({
    required this.id,
    required this.channelId,
    this.createdBy,
    required this.title,
    this.description,
    this.coverUrl,
    this.status = 'draft',
    this.publishedAt,
    required this.createdAt,
    this.updatedAt,
    this.seasons = const [],
  });

  bool get isPublished => status == 'published';

  /// Flatten all published episodes across all seasons in order.
  List<EpisodeModel> get allEpisodes {
    final all = <EpisodeModel>[];
    for (final season in seasons) {
      all.addAll(season.episodes);
    }
    return all;
  }

  factory SeriesModel.fromJson(Map<String, dynamic> json) {
    return SeriesModel(
      id: _asString(json['id']),
      channelId: _asString(json['channel_id']),
      createdBy: _asNullableString(json['created_by']),
      title: _asString(json['title']),
      description: _asNullableString(json['description']),
      coverUrl: _asNullableString(json['cover_url']),
      status: _asString(json['status'], fallback: 'draft'),
      publishedAt: (json['published_at'] as num?)?.toInt(),
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updated_at'] as num?)?.toInt(),
      seasons: _parseSeasons(json['seasons']),
    );
  }

  static List<SeasonModel> _parseSeasons(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<Map<String, dynamic>>()
        .map((e) => SeasonModel.fromJson(e))
        .toList();
  }

  static String _asString(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    return value.toString();
  }

  static String? _asNullableString(dynamic value) {
    if (value == null) return null;
    final parsed = value.toString();
    return parsed.isEmpty ? null : parsed;
  }
}

class SeasonModel {
  final String id;
  final String seriesId;
  final int seasonNumber;
  final String title;
  final int? createdAt;
  final int? updatedAt;
  final List<EpisodeModel> episodes;

  const SeasonModel({
    required this.id,
    required this.seriesId,
    this.seasonNumber = 1,
    this.title = '',
    this.createdAt,
    this.updatedAt,
    this.episodes = const [],
  });

  factory SeasonModel.fromJson(Map<String, dynamic> json) {
    return SeasonModel(
      id: _asString(json['id']),
      seriesId: _asString(json['series_id']),
      seasonNumber: (json['season_number'] as num?)?.toInt() ?? 1,
      title: _asString(json['title']),
      createdAt: (json['created_at'] as num?)?.toInt(),
      updatedAt: (json['updated_at'] as num?)?.toInt(),
      episodes: _parseEpisodes(json['episodes']),
    );
  }

  static List<EpisodeModel> _parseEpisodes(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<Map<String, dynamic>>()
        .map((e) => EpisodeModel.fromJson(e))
        .toList();
  }

  static String _asString(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    return value.toString();
  }
}

class EpisodeModel {
  final String id;
  final String seriesId;
  final String seasonId;
  final String? createdBy;
  final int episodeNumber;
  final String title;
  final String? synopsis;
  final String? posterUrl;
  final String ageClassification;

  // Content rating
  final bool hasExplicitLanguage;
  final bool hasNudity;
  final bool hasViolence;
  final bool hasRevealingClothes;
  final bool hasPartialNudity;
  final bool hasExplicitContent;
  final bool hasParentalGuidance;
  final bool hasEroticDancing;
  final bool hasSexualNature;
  final bool hasSex;

  final String videoSourceMode;
  final String? hostedUrl;
  final String? externalUrl;
  final String? embedUrl;
  final String? hlsUrl;
  final bool downloadable;
  final int duration;
  final String status;
  final int? publishedAt;
  final int createdAt;
  final int? updatedAt;

  const EpisodeModel({
    required this.id,
    required this.seriesId,
    required this.seasonId,
    this.createdBy,
    this.episodeNumber = 1,
    required this.title,
    this.synopsis,
    this.posterUrl,
    this.ageClassification = 'teen',
    this.hasExplicitLanguage = false,
    this.hasNudity = false,
    this.hasViolence = false,
    this.hasRevealingClothes = false,
    this.hasPartialNudity = false,
    this.hasExplicitContent = false,
    this.hasParentalGuidance = false,
    this.hasEroticDancing = false,
    this.hasSexualNature = false,
    this.hasSex = false,
    this.videoSourceMode = 'hosted',
    this.hostedUrl,
    this.externalUrl,
    this.embedUrl,
    this.hlsUrl,
    this.downloadable = false,
    this.duration = 0,
    this.status = 'draft',
    this.publishedAt,
    required this.createdAt,
    this.updatedAt,
  });

  /// Best public playback URL for this episode.
  String? get playbackUrl {
    switch (videoSourceMode) {
      case 'hls':
        return hlsUrl;
      case 'external_url':
        return externalUrl;
      case 'embed':
        return embedUrl;
      case 'hosted':
      default:
        return hostedUrl;
    }
  }

  bool get isPublished => status == 'published';

  factory EpisodeModel.fromJson(Map<String, dynamic> json) {
    return EpisodeModel(
      id: _asString(json['id']),
      seriesId: _asString(json['series_id']),
      seasonId: _asString(json['season_id']),
      createdBy: _asNullableString(json['created_by']),
      episodeNumber: (json['episode_number'] as num?)?.toInt() ?? 1,
      title: _asString(json['title']),
      synopsis: _asNullableString(json['synopsis']),
      posterUrl: _asNullableString(json['poster_url']),
      ageClassification: _asString(json['age_classification'], fallback: 'teen'),
      hasExplicitLanguage: _asBool(json['has_explicit_language']),
      hasNudity: _asBool(json['has_nudity']),
      hasViolence: _asBool(json['has_violence']),
      hasRevealingClothes: _asBool(json['has_revealing_clothes']),
      hasPartialNudity: _asBool(json['has_partial_nudity']),
      hasExplicitContent: _asBool(json['has_explicit_content']),
      hasParentalGuidance: _asBool(json['has_parental_guidance']),
      hasEroticDancing: _asBool(json['has_erotic_dancing']),
      hasSexualNature: _asBool(json['has_sexual_nature']),
      hasSex: _asBool(json['has_sex']),
      videoSourceMode: _asString(json['video_source_mode'], fallback: 'hosted'),
      hostedUrl: _asNullableString(json['hosted_url']),
      externalUrl: _asNullableString(json['external_url']),
      embedUrl: _asNullableString(json['embed_url']),
      hlsUrl: _asNullableString(json['hls_url']),
      downloadable: _asBool(json['downloadable']),
      duration: (json['duration'] as num?)?.toInt() ?? 0,
      status: _asString(json['status'], fallback: 'draft'),
      publishedAt: (json['published_at'] as num?)?.toInt(),
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updated_at'] as num?)?.toInt(),
    );
  }

  static String _asString(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    return value.toString();
  }

  static String? _asNullableString(dynamic value) {
    if (value == null) return null;
    final parsed = value.toString();
    return parsed.isEmpty ? null : parsed;
  }

  static bool _asBool(dynamic value) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final normalized = value.trim().toLowerCase();
      if (normalized == 'true' || normalized == '1') return true;
      if (normalized == 'false' || normalized == '0') return false;
    }
    return false;
  }
}

class EpisodeNavigation {
  final String? previousEpisodeId;
  final String? nextEpisodeId;

  const EpisodeNavigation({
    this.previousEpisodeId,
    this.nextEpisodeId,
  });

  factory EpisodeNavigation.fromJson(Map<String, dynamic> json) {
    return EpisodeNavigation(
      previousEpisodeId: json['previousEpisodeId']?.toString(),
      nextEpisodeId: json['nextEpisodeId']?.toString(),
    );
  }
}
