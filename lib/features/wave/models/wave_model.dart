class WaveModel {
  final String id;
  final String title;
  final String description;
  final String channelId;
  final String channelName;
  final String creatorName; // Creator/channel owner name for rendering
  final String thumbnailUrl;
  final String videoUrl;
  final int duration;
  final String ageClassification;
  final String status;
  final bool hiddenFromTimeline;
  final bool bookmarked;
  final int pulseCount;
  final int viewCount;
  final int repeatPlayCount;
  final int commentCount;
  final bool hasExplicitLanguage;
  final bool hasNudity;
  final bool hasViolence;

  const WaveModel({
    required this.id,
    required this.title,
    required this.description,
    required this.channelId,
    required this.channelName,
    required this.creatorName,
    required this.thumbnailUrl,
    required this.videoUrl,
    required this.duration,
    required this.ageClassification,
    required this.status,
    required this.hiddenFromTimeline,
    required this.bookmarked,
    required this.pulseCount,
    required this.viewCount,
    required this.repeatPlayCount,
    required this.commentCount,
    required this.hasExplicitLanguage,
    required this.hasNudity,
    required this.hasViolence,
  });

  bool get isAgeRestricted => ageClassification == 'adult';
  bool get isUnavailable => status == 'hidden' || status == 'deleted';

  WaveModel copyWith({
    bool? bookmarked,
    int? pulseCount,
    int? viewCount,
    int? repeatPlayCount,
    int? commentCount,
  }) {
    return WaveModel(
      id: id,
      title: title,
      description: description,
      channelId: channelId,
      channelName: channelName,
      creatorName: creatorName,
      thumbnailUrl: thumbnailUrl,
      videoUrl: videoUrl,
      duration: duration,
      ageClassification: ageClassification,
      status: status,
      hiddenFromTimeline: hiddenFromTimeline,
      bookmarked: bookmarked ?? this.bookmarked,
      pulseCount: pulseCount ?? this.pulseCount,
      viewCount: viewCount ?? this.viewCount,
      repeatPlayCount: repeatPlayCount ?? this.repeatPlayCount,
      commentCount: commentCount ?? this.commentCount,
      hasExplicitLanguage: hasExplicitLanguage,
      hasNudity: hasNudity,
      hasViolence: hasViolence,
    );
  }

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  factory WaveModel.fromJson(Map<String, dynamic> json) {
    final creatorUid = json['creator_uid']?.toString();
    final channelId = json['channel_id']?.toString();
    final channelName =
        (json['channel_name'] ??
                json['creator_name'] ??
                json['owner_name'] ??
                channelId ??
                creatorUid ??
                'Unknown Channel')
            .toString();
    return WaveModel(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['caption'] ?? 'Untitled Wave').toString(),
      description: (json['description'] ?? '').toString(),
      channelId: (json['channel_id'] ?? '').toString(),
      channelName: channelName,
      creatorName:
          channelName, // fallback to channel_name if creator_name missing
      thumbnailUrl: (json['thumbnail_url'] ?? json['poster_url'] ?? '')
          .toString(),
      videoUrl: (json['video_url'] ?? '').toString(),
      duration: _toInt(json['duration']),
      ageClassification: (json['age_classification'] ?? 'minor_safe')
          .toString(),
      status: (json['status'] ?? 'active').toString(),
      hiddenFromTimeline: json['hidden_from_timeline'] == true,
      bookmarked: json['bookmarked'] == true || json['is_bookmarked'] == true,
      pulseCount: _toInt(json['pulse_count'] ?? json['pulses_count']),
      viewCount: _toInt(
        json['views_count'] ?? json['views'] ?? json['total_views'],
      ),
      repeatPlayCount: _toInt(json['repeat_play_count'] ?? json['view_count']),
      commentCount: _toInt(json['comment_count']),
      hasExplicitLanguage: json['has_explicit_language'] == true,
      hasNudity: json['has_nudity'] == true,
      hasViolence: json['has_violence'] == true,
    );
  }
}

class WavePulseMomentModel {
  final int second;
  final int intensitySum;

  const WavePulseMomentModel({
    required this.second,
    required this.intensitySum,
  });

  factory WavePulseMomentModel.fromJson(Map<String, dynamic> json) {
    return WavePulseMomentModel(
      second: WaveModel._toInt(json['second']),
      intensitySum: WaveModel._toInt(json['intensity_sum']),
    );
  }
}

class WaveCommentModel {
  final String id;
  final String displayName;
  final String text;
  final int createdAt;

  const WaveCommentModel({
    required this.id,
    required this.displayName,
    required this.text,
    required this.createdAt,
  });

  factory WaveCommentModel.fromJson(Map<String, dynamic> json) {
    return WaveCommentModel(
      id: (json['id'] ?? '').toString(),
      displayName: (json['display_name'] ?? 'User').toString(),
      text: (json['text'] ?? '').toString(),
      createdAt: (json['created_at'] is num)
          ? (json['created_at'] as num).toInt()
          : 0,
    );
  }
}
