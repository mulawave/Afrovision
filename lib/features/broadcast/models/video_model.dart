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
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
    );
  }
}
