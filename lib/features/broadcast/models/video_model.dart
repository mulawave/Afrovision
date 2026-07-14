import '../../../core/config/app_config.dart';

class VideoModel {
  final String id;
  final String creatorUid;
  final String channelId;
  final String title;
  final String description;
  final String videoUrl;
  final String? thumbnailUrl;
  final int duration;
  final String transcodingStatus;
  final String? transcodingError;
  final String? masterPlaylistUrl;
  final List<int> availableRenditions;
  final int createdAt;

  VideoModel({
    required this.id,
    required this.creatorUid,
    required this.channelId,
    required this.title,
    this.description = '',
    required this.videoUrl,
    this.thumbnailUrl,
    required this.duration,
    this.transcodingStatus = 'unavailable',
    this.transcodingError,
    this.masterPlaylistUrl,
    this.availableRenditions = const [],
    required this.createdAt,
  });

  String get fullVideoUrl =>
      videoUrl.startsWith('http') ? videoUrl : '${AppConfig.baseUrl}$videoUrl';
  String? get fullThumbnailUrl => thumbnailUrl != null
      ? (thumbnailUrl!.startsWith('http')
            ? thumbnailUrl!
            : '${AppConfig.baseUrl}$thumbnailUrl')
      : null;

  factory VideoModel.fromJson(Map<String, dynamic> json) {
    return VideoModel(
      id: json['id'] as String,
      creatorUid: json['creator_uid'] as String? ?? '',
      channelId: json['channel_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      videoUrl: json['video_url'] as String? ?? '',
      thumbnailUrl: json['thumbnail_url'] as String?,
      duration: (json['duration'] as num?)?.toInt() ?? 0,
      transcodingStatus: json['transcoding_status'] as String? ?? 'unavailable',
      transcodingError: json['transcoding_error'] as String?,
      masterPlaylistUrl: json['master_playlist_url'] as String?,
      availableRenditions:
          (json['available_renditions'] as List<dynamic>? ?? const [])
              .whereType<num>()
              .map((value) => value.toInt())
              .toList(),
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
    );
  }
}
