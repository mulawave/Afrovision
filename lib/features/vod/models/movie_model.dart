class MovieModel {
  final String id;
  final String channelId;
  final String? createdBy;
  final String title;
  final String? synopsis;
  final String? posterUrl;
  final int? releaseDate;
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

  final String videoSourceMode; // 'hosted' | 'external_url' | 'embed' | 'hls'
  final String? hostedUrl;
  final String? externalUrl;
  final String? embedUrl;
  final String? hlsUrl;
  final bool downloadable;
  final int duration; // seconds
  final String status;
  final int? publishedAt;
  final int createdAt;
  final int? updatedAt;
  final int totalViews;
  final int totalDownloads;

  const MovieModel({
    required this.id,
    required this.channelId,
    this.createdBy,
    required this.title,
    this.synopsis,
    this.posterUrl,
    this.releaseDate,
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
    this.totalViews = 0,
    this.totalDownloads = 0,
  });

  /// Best public playback URL for this movie, or null if none available.
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

  factory MovieModel.fromJson(Map<String, dynamic> json) {
    return MovieModel(
      id: _asString(json['id']),
      channelId: _asString(json['channel_id']),
      createdBy: _asNullableString(json['created_by']),
      title: _asString(json['title']),
      synopsis: _asNullableString(json['synopsis']),
      posterUrl: _asNullableString(json['poster_url']),
      releaseDate: (json['release_date'] as num?)?.toInt(),
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
      totalViews: (json['total_views'] as num?)?.toInt() ?? 0,
      totalDownloads: (json['total_downloads'] as num?)?.toInt() ?? 0,
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
