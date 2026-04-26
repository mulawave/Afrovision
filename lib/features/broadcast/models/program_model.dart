import '../../../core/config/app_config.dart';

class ProgramModel {
  final String id;
  final String channelId;
  final String videoId;
  final int startTime;
  final int endTime;
  final String type;
  final String status;
  final int createdAt;

  // Enriched fields from playback/schedule responses
  final String? videoUrl;
  final String? videoTitle;
  final String? videoDescription;
  final String? thumbnailUrl;
  final int? videoDuration;
  final int? position;
  final bool isLoop;

  ProgramModel({
    required this.id,
    required this.channelId,
    required this.videoId,
    required this.startTime,
    required this.endTime,
    required this.type,
    required this.status,
    required this.createdAt,
    this.videoUrl,
    this.videoTitle,
    this.videoDescription,
    this.thumbnailUrl,
    this.videoDuration,
    this.position,
    this.isLoop = false,
  });

  String? get fullVideoUrl => videoUrl != null
      ? (videoUrl!.startsWith('http')
            ? videoUrl!
            : '${AppConfig.baseUrl}$videoUrl')
      : null;
  String? get fullThumbnailUrl => thumbnailUrl != null
      ? (thumbnailUrl!.startsWith('http')
            ? thumbnailUrl!
            : '${AppConfig.baseUrl}$thumbnailUrl')
      : null;

  factory ProgramModel.fromJson(Map<String, dynamic> json) {
    return ProgramModel(
      id: json['id'] as String? ?? json['program_id'] as String? ?? '',
      channelId: json['channel_id'] as String? ?? '',
      videoId: json['video_id'] as String? ?? '',
      startTime: (json['start_time'] as num?)?.toInt() ?? 0,
      endTime: (json['end_time'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'sim_live',
      status: json['status'] as String? ?? 'scheduled',
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      videoUrl: json['video_url'] as String?,
      videoTitle: json['video_title'] as String?,
      videoDescription: json['video_description'] as String?,
      thumbnailUrl: json['thumbnail_url'] as String?,
      videoDuration: (json['video_duration'] as num?)?.toInt() ?? (json['duration'] as num?)?.toInt(),
      position: (json['position'] as num?)?.toInt(),
      isLoop: json['is_loop'] as bool? ?? false,
    );
  }
}
