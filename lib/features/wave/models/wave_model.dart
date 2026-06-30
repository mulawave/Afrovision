class WaveModel {
  final String id;
  final String title;
  final String description;
  final String channelId;
  final String channelName;
  final String creatorName; // Creator/channel owner name for rendering
  final String? ownerId; // Channel owner uid - used for moderation + admin badge
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
  final bool hasRevealingClothes;
  final bool hasPartialNudity;
  final bool hasExplicitContent;
  final bool hasParentalGuidance;
  final bool hasEroticDancing;
  final bool hasSexualNature;
  final bool hasSex;
  final String channelType; // 'public' or 'private' only - exclusive channels are identified by fee
  final double exclusiveMonthlyFeeNgn; // > 0 indicates exclusive channel
  final String? channelLogoUrl; // Channel logo for brand/channel card

  const WaveModel({
    required this.id,
    required this.title,
    required this.description,
    required this.channelId,
    required this.channelName,
    required this.creatorName,
    this.ownerId,
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
    required this.hasRevealingClothes,
    required this.hasPartialNudity,
    this.hasExplicitContent = false,
    this.hasParentalGuidance = false,
    this.hasEroticDancing = false,
    this.hasSexualNature = false,
    this.hasSex = false,
    this.channelType = 'public',
    this.exclusiveMonthlyFeeNgn = 0,
    this.channelLogoUrl,
  });

  bool get isAgeRestricted => ageClassification == 'adult';
  bool get isUnavailable => status == 'hidden' || status == 'deleted';
  /// Exclusive channels are identified by having a membership fee > 0
  /// Type field is only 'public' or 'private', exclusive channels can be either
  bool get belongsToExclusiveChannel => exclusiveMonthlyFeeNgn > 0;
  
  bool get isAdultContent => ageClassification == 'adult';

  /// Build a compact content label string like "18+ S.N.L.V" or "TEEN ED.SN.RC.L"
  String get contentLabels {
    final codes = <String>[];
    if (hasSex) codes.add('S');
    if (hasSexualNature) codes.add('SN');
    if (hasNudity) codes.add('N');
    if (hasExplicitLanguage) codes.add('L');
    if (hasViolence) codes.add('V');
    if (hasRevealingClothes) codes.add('RC');
    if (hasPartialNudity) codes.add('PN');
    if (hasExplicitContent) codes.add('XC');
    if (hasParentalGuidance) codes.add('PG');
    if (hasEroticDancing) codes.add('ED');
    if (codes.isEmpty) return _ageLabel;
    return '$_ageLabel ${codes.join('.')}';
  }

  String get _ageLabel {
    if (ageClassification == 'adult') return '18+';
    if (ageClassification == 'minor_safe') return 'MINOR';
    if (hasRevealingClothes) return 'TEEN RC';
    return 'TEEN';
  }

  WaveModel copyWith({
    bool? bookmarked,
    int? pulseCount,
    int? viewCount,
    int? repeatPlayCount,
    int? commentCount,
    String? channelType,
    double? exclusiveMonthlyFeeNgn,
    String? channelLogoUrl,
    bool? hasRevealingClothes,
    bool? hasPartialNudity,
    bool? hasExplicitContent,
    bool? hasParentalGuidance,
    bool? hasEroticDancing,
    bool? hasSexualNature,
    bool? hasSex,
  }) {
    return WaveModel(
      id: id,
      title: title,
      description: description,
      channelId: channelId,
      channelName: channelName,
      creatorName: creatorName,
      ownerId: ownerId,
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
      hasRevealingClothes: hasRevealingClothes ?? this.hasRevealingClothes,
      hasPartialNudity: hasPartialNudity ?? this.hasPartialNudity,
      hasExplicitContent: hasExplicitContent ?? this.hasExplicitContent,
      hasParentalGuidance: hasParentalGuidance ?? this.hasParentalGuidance,
      hasEroticDancing: hasEroticDancing ?? this.hasEroticDancing,
      hasSexualNature: hasSexualNature ?? this.hasSexualNature,
      hasSex: hasSex ?? this.hasSex,
      channelType: channelType ?? this.channelType,
      exclusiveMonthlyFeeNgn: exclusiveMonthlyFeeNgn ?? this.exclusiveMonthlyFeeNgn,
      channelLogoUrl: channelLogoUrl ?? this.channelLogoUrl,
    );
  }

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  static double _toDouble(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  factory WaveModel.fromJson(Map<String, dynamic> json) {
    final creatorUid = json['creator_uid']?.toString();
    final channelId = json['channel_id']?.toString();
    final rawCreatorName =
        (json['creator_name'] ?? json['channel_name'] ?? json['owner_name'] ?? channelId ?? creatorUid ?? 'Unknown Channel')
            .toString();
    // Guard against raw UUIDs being rendered as creator name (security)
    final safeCreatorName = _isLikelyUuid(rawCreatorName) ? 'Channel' : rawCreatorName;
    final channelName =
        (json['channel_name'] ?? json['creator_name'] ?? json['owner_name'] ?? channelId ?? creatorUid ?? 'Unknown Channel')
            .toString();

    return WaveModel(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['caption'] ?? 'Untitled Wave').toString(),
      description: (json['description'] ?? '').toString(),
      channelId: (json['channel_id'] ?? '').toString(),
      channelName: channelName,
      creatorName: safeCreatorName,
      ownerId: (json['owner_id'] ?? json['creator_uid'])?.toString(),
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
      hasRevealingClothes: json['has_revealing_clothes'] == true,
      hasPartialNudity: json['has_partial_nudity'] == true,
      hasExplicitContent: json['has_explicit_content'] == true,
      hasParentalGuidance: json['has_parental_guidance'] == true,
      hasEroticDancing: json['has_erotic_dancing'] == true,
      hasSexualNature: json['has_sexual_nature'] == true,
      hasSex: json['has_sex'] == true,
      channelType: (json['channel_type'] ?? 'public').toString(),
      exclusiveMonthlyFeeNgn: _toDouble(
        json['exclusive_monthly_fee_ngn'] ?? json['channel_exclusive_fee'],
      ),
      channelLogoUrl: json['channel_logo_url']?.toString(),
    );
  }

  /// Quick check if a string looks like a UUID (e.g. "37973453-8c54-4e22...")
  static bool _isLikelyUuid(String value) {
    return value.length >= 32 && value.contains('-');
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
  final String userId;
  final String displayName;
  final String? avatarUrl;
  final String text;
  final int createdAt;
  final int replyCount;
  final int reactionCount;
  final String? parentCommentId; // For nested replies
  final bool isChannelOwner; // Author is the channel owner -> show admin badge
  final bool authorBanned; // Author is banned from commenting on this channel
  final bool viewerIsOwner; // Current viewer owns the channel -> moderation

  const WaveCommentModel({
    required this.id,
    required this.userId,
    required this.displayName,
    this.avatarUrl,
    required this.text,
    required this.createdAt,
    this.replyCount = 0,
    this.reactionCount = 0,
    this.parentCommentId,
    this.isChannelOwner = false,
    this.authorBanned = false,
    this.viewerIsOwner = false,
  });

  factory WaveCommentModel.fromJson(Map<String, dynamic> json) {
    return WaveCommentModel(
      id: (json['id'] ?? '').toString(),
      userId: (json['user_id'] ?? '').toString(),
      displayName: (json['display_name'] ?? 'User').toString(),
      avatarUrl: json['avatar_url']?.toString(),
      text: (json['text'] ?? '').toString(),
      createdAt: (json['created_at'] is num)
          ? (json['created_at'] as num).toInt()
          : 0,
      replyCount: (json['reply_count'] is num)
          ? (json['reply_count'] as num).toInt()
          : 0,
      reactionCount: (json['reaction_count'] is num)
          ? (json['reaction_count'] as num).toInt()
          : 0,
      parentCommentId: json['parent_comment_id']?.toString(),
      isChannelOwner: json['is_channel_owner'] == true,
      authorBanned: json['author_banned'] == true,
      viewerIsOwner: json['viewer_is_owner'] == true,
    );
  }

  WaveCommentModel copyWith({
    int? replyCount,
    int? reactionCount,
    bool? authorBanned,
  }) {
    return WaveCommentModel(
      id: id,
      userId: userId,
      displayName: displayName,
      avatarUrl: avatarUrl,
      text: text,
      createdAt: createdAt,
      replyCount: replyCount ?? this.replyCount,
      reactionCount: reactionCount ?? this.reactionCount,
      parentCommentId: parentCommentId,
      isChannelOwner: isChannelOwner,
      authorBanned: authorBanned ?? this.authorBanned,
      viewerIsOwner: viewerIsOwner,
    );
  }

  /// Check if this comment is a reply to another comment
  bool get isReply => parentCommentId != null && parentCommentId!.isNotEmpty;

  /// Format relative time (e.g., "2 hours ago")
  String get relativeTime {
    final now = DateTime.now();
    final commentTime = DateTime.fromMillisecondsSinceEpoch(createdAt);
    final diff = now.difference(commentTime);

    if (diff.inDays > 365) {
      return '${(diff.inDays / 365).floor()}y ago';
    } else if (diff.inDays > 30) {
      return '${(diff.inDays / 30).floor()}mo ago';
    } else if (diff.inDays > 0) {
      return '${diff.inDays}d ago';
    } else if (diff.inHours > 0) {
      return '${diff.inHours}h ago';
    } else if (diff.inMinutes > 0) {
      return '${diff.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}