import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../../core/api/api_service.dart';
import '../../../core/services/section_cache.dart';
import '../models/wave_model.dart';

typedef UploadProgressCallback = void Function(double progress);

class WaveUploadUrlResponse {
  final String signedUrl;
  final String publicUrl;
  final String filename;

  const WaveUploadUrlResponse({
    required this.signedUrl,
    required this.publicUrl,
    required this.filename,
  });
}

class WaveFeedResponse {
  final List<WaveModel> waves;
  final String? nextCursor;

  const WaveFeedResponse({required this.waves, this.nextCursor});
}

class WavePulseMomentsResponse {
  final List<WavePulseMomentModel> moments;
  final int duration;

  const WavePulseMomentsResponse({
    required this.moments,
    required this.duration,
  });
}

class WaveAccessDecision {
  final bool allowed;
  final bool requiresConsent;
  final String? reason;
  final String? code;

  const WaveAccessDecision({
    required this.allowed,
    required this.requiresConsent,
    required this.reason,
    required this.code,
  });

  factory WaveAccessDecision.fromJson(Map<String, dynamic> json) {
    return WaveAccessDecision(
      allowed: json['allowed'] == true,
      requiresConsent: json['requires_consent'] == true,
      reason: json['reason']?.toString(),
      code: json['code']?.toString(),
    );
  }
}

class WaveService {
  static Future<WaveUploadUrlResponse> getWaveUploadUrl({
    required String channelId,
    required String contentType,
  }) async {
    final data = await ApiService.post('/wave/upload-url', {
      'channel_id': channelId,
      'content_type': contentType,
    });

    return WaveUploadUrlResponse(
      signedUrl: (data['signed_url'] ?? '').toString(),
      publicUrl: (data['public_url'] ?? '').toString(),
      filename: (data['filename'] ?? '').toString(),
    );
  }

  static Future<void> uploadWaveFileToSignedUrl({
    required File file,
    required String signedUrl,
    required String contentType,
    UploadProgressCallback? onProgress,
  }) async {
    final client = HttpClient();
    try {
      final uri = Uri.parse(signedUrl);
      final request = await client.putUrl(uri);
      request.headers.set(HttpHeaders.contentTypeHeader, contentType);

      final totalBytes = await file.length();
      request.contentLength = totalBytes;

      int sentBytes = 0;
      final stream = file.openRead().transform<List<int>>(
        StreamTransformer<List<int>, List<int>>.fromHandlers(
          handleData: (chunk, sink) {
            sentBytes += chunk.length;
            if (onProgress != null && totalBytes > 0) {
              final progress = (sentBytes / totalBytes).clamp(0.0, 1.0);
              onProgress(progress);
            }
            sink.add(chunk);
          },
        ),
      );

      await request.addStream(stream);
      final response = await request.close();

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final body = await utf8.decoder.bind(response).join();
        throw ApiException(
          body.isNotEmpty ? body : 'Wave video upload failed.',
          response.statusCode,
        );
      }

      if (onProgress != null) {
        onProgress(1.0);
      }
    } on FormatException {
      throw ApiException('Invalid upload URL.', 0);
    } on SocketException {
      throw ApiException(
        'Network is unavailable. Please check your connection and retry.',
        0,
      );
    } finally {
      client.close(force: true);
    }
  }

  static Future<WaveModel> registerWave({
    required String channelId,
    required String title,
    required String description,
    required String videoUrl,
    required String ageClassification,
    required bool hasExplicitLanguage,
    required bool hasNudity,
    required bool hasViolence,
    required bool hasRevealingClothes,
    required bool hasPartialNudity,
    bool hasExplicitContent = false,
    bool hasParentalGuidance = false,
    bool hasEroticDancing = false,
    bool hasSexualNature = false,
    bool hasSex = false,
    int duration = 0,
    String thumbnailUrl = '',
  }) async {
    final data = await ApiService.post('/wave/register', {
      'channel_id': channelId,
      'title': title,
      'description': description,
      'video_url': videoUrl,
      'thumbnail_url': thumbnailUrl,
      'duration': duration,
      'age_classification': ageClassification,
      'has_explicit_language': hasExplicitLanguage,
      'has_nudity': hasNudity,
      'has_violence': hasViolence,
      'has_revealing_clothes': hasRevealingClothes,
      'has_partial_nudity': hasPartialNudity,
      'has_explicit_content': hasExplicitContent,
      'has_parental_guidance': hasParentalGuidance,
      'has_erotic_dancing': hasEroticDancing,
      'has_sexual_nature': hasSexualNature,
      'has_sex': hasSex,
    });

    return WaveModel.fromJson(data);
  }

  static Future<WaveModel> updateWave({
    required String waveId,
    required String title,
    required String description,
    required String ageClassification,
    required bool hasExplicitLanguage,
    required bool hasNudity,
    required bool hasViolence,
    required bool hasRevealingClothes,
    required bool hasPartialNudity,
    String thumbnailUrl = '',
  }) async {
    final data = await ApiService.patch('/wave/$waveId', {
      'title': title,
      'description': description,
      'thumbnail_url': thumbnailUrl,
      'age_classification': ageClassification,
      'has_explicit_language': hasExplicitLanguage,
      'has_nudity': hasNudity,
      'has_violence': hasViolence,
      'has_revealing_clothes': hasRevealingClothes,
      'has_partial_nudity': hasPartialNudity,
    });

    final root = data['wave'] as Map<String, dynamic>? ?? data;
    return WaveModel.fromJson(root);
  }

  static Future<void> deleteWave(String waveId) async {
    await ApiService.delete('/wave/$waveId');
  }

  static Future<WaveModel> setTimelineVisibility(
    String waveId, {
    required bool hidden,
  }) async {
    final data = await ApiService.post('/wave/$waveId/timeline-visibility', {
      'hidden': hidden,
    });
    final root = data['wave'] as Map<String, dynamic>? ?? data;
    return WaveModel.fromJson(root);
  }

  static Future<WaveModel> getWave(String waveId) async {
    final data = await ApiService.getPublic('/wave/$waveId');
    final root = data is Map<String, dynamic>
        ? (data['wave'] as Map<String, dynamic>? ??
              data['data'] as Map<String, dynamic>? ??
              data)
        : <String, dynamic>{};
    return WaveModel.fromJson(root);
  }

  static Future<WaveFeedResponse> getWaveFeed({
    int limit = 10,
    String? cursor,
    List<String> excludeIds = const <String>[],
  }) async {
    final query = <String>['limit=$limit'];
    if (cursor != null && cursor.isNotEmpty) {
      query.add('cursor=$cursor');
    }
    if (excludeIds.isNotEmpty) {
      final cleaned = excludeIds
          .where((id) => id.trim().isNotEmpty)
          .take(160)
          .join(',');
      if (cleaned.isNotEmpty) {
        query.add('exclude_ids=$cleaned');
      }
    }

    final path = '/wave/feed?${query.join('&')}';
    final data = await ApiService.get(path);

    final rawWaves = data['waves'];
    final list = rawWaves is List
        ? rawWaves
              .whereType<Map<String, dynamic>>()
              .map(WaveModel.fromJson)
              .toList()
        : <WaveModel>[];

    final nextCursor = data['next_cursor']?.toString();

    return WaveFeedResponse(waves: list, nextCursor: nextCursor);
  }

  static Future<List<WaveModel>> getChannelWaves(
    String channelId, {
    bool includeHidden = false,
  }) async {
    final query = includeHidden ? '?include_hidden=true' : '';
    final data = await ApiService.getDynamic('/wave/channel/$channelId$query');
    if (data is! List) {
      return const <WaveModel>[];
    }
    final waves = data
        .whereType<Map<String, dynamic>>()
        .map(WaveModel.fromJson)
        .toList();
    // Persist raw list for stale-while-revalidate on the channel profile.
    await SectionCache.write(_waveChannelKey(channelId, includeHidden),
        jsonEncode(data));
    return waves;
  }

  /// Stale-while-revalidate wrapper for [getChannelWaves].
  ///
  /// Paints the last known waves for a channel instantly via [onCached],
  /// then hits the network and returns the fresh list. Fixes the
  /// "loading afresh every visit" behaviour on channel profile Waves tabs.
  static Future<List<WaveModel>> getChannelWavesCached(
    String channelId, {
    bool includeHidden = false,
    void Function(List<WaveModel> cached)? onCached,
  }) async {
    if (onCached != null) {
      final raw =
          await SectionCache.readStale(_waveChannelKey(channelId, includeHidden));
      if (raw != null) {
        try {
          final decoded = jsonDecode(raw);
          if (decoded is List) {
            onCached(decoded
                .whereType<Map<String, dynamic>>()
                .map(WaveModel.fromJson)
                .toList());
          }
        } catch (_) {}
      }
    }
    return getChannelWaves(channelId, includeHidden: includeHidden);
  }

  static String _waveChannelKey(String channelId, bool includeHidden) =>
      'wave_ch_${channelId}_${includeHidden ? 'h' : 'v'}';

  static Future<void> addPulse(
    String waveId, {
    int intensity = 1,
    int momentSeconds = 0,
  }) async {
    await ApiService.post('/wave/$waveId/pulse', {
      'intensity': intensity.clamp(1, 3),
      'moment_seconds': momentSeconds,
    });
  }

  static Future<bool> toggleBookmark(String waveId) async {
    final data = await ApiService.post('/wave/$waveId/bookmark', {});
    return data['bookmarked'] == true;
  }

  /// GET /wave/:id/thumbnail — asks the backend for a thumbnail URL,
  /// triggering a lazy fetch/check on the server side. Returns the URL if
  /// one is (now) available, otherwise null. Used by [WaveThumbnail] to
  /// hydrate tiles whose feed row arrived with an empty thumbnail_url.
  ///
  /// Never throws — a network error, 404, or missing field all return null.
  static Future<String?> getWaveThumbnailUrl(String waveId) async {
    try {
      final data = await ApiService.get('/wave/$waveId/thumbnail');
      // Backend returns { thumbnail_url: "..." } or { data: { thumbnail_url: "..." } }
      final root = data['data'] as Map<String, dynamic>? ?? data;
      final url = root['thumbnail_url'] as String?;
      return (url != null && url.isNotEmpty) ? url : null;
    } catch (_) {
      return null;
    }
  }

  static Future<List<WaveModel>> getMyBookmarks() async {
    final data = await ApiService.getDynamic('/wave/me/bookmarks');
    if (data is! List) return const <WaveModel>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(WaveModel.fromJson)
        .toList();
  }

  static Future<List<WaveCommentModel>> getComments(String waveId) async {
    final data = await ApiService.getPublic('/wave/$waveId/comments');
    if (data is! List) return <WaveCommentModel>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(WaveCommentModel.fromJson)
        .toList();
  }

  static Future<WaveCommentModel> postComment(
    String waveId,
    String text,
  ) async {
    final data = await ApiService.post('/wave/$waveId/comments', {
      'text': text,
    });
    return WaveCommentModel.fromJson(data);
  }

  static Future<void> deleteComment(String waveId, String commentId) async {
    await ApiService.delete('/wave/$waveId/comments/$commentId');
  }

  static Future<WaveCommentModel> editComment(
    String waveId,
    String commentId,
    String text,
  ) async {
    final data = await ApiService.patch(
      '/wave/$waveId/comments/$commentId',
      {'text': text},
    );
    return WaveCommentModel.fromJson(data);
  }

  static Future<WaveCommentModel> postReply(
    String waveId,
    String parentCommentId,
    String text,
  ) async {
    final data = await ApiService.post('/wave/$waveId/comments', {
      'text': text,
      'parent_comment_id': parentCommentId,
    });
    return WaveCommentModel.fromJson(data);
  }

  static Future<List<WaveCommentModel>> getReplies(
    String waveId,
    String commentId,
  ) async {
    final data = await ApiService.getPublic('/wave/$waveId/comments/$commentId/replies');
    if (data is! List) return <WaveCommentModel>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(WaveCommentModel.fromJson)
        .toList();
  }

  static Future<bool> toggleCommentReaction(
    String waveId,
    String commentId,
  ) async {
    final data = await ApiService.post('/wave/$waveId/comments/$commentId/reaction', {});
    return data['reacted'] == true;
  }

  /// Channel owner bans a user from commenting on this channel's waves.
  static Future<void> banCommenter(String waveId, String userId) async {
    await ApiService.post('/wave/$waveId/comment-bans/$userId', {});
  }

  /// Channel owner revokes a commenting ban.
  static Future<void> unbanCommenter(String waveId, String userId) async {
    await ApiService.delete('/wave/$waveId/comment-bans/$userId');
  }

  static Future<void> reportWave(
    String waveId,
    String reason, {
    String? details,
  }) async {
    await ApiService.post('/wave/$waveId/report', {
      'reason': reason,
      if (details != null && details.trim().isNotEmpty) 'details': details.trim(),
    });
  }

  static Future<void> setInterest(String waveId, String signal) async {
    await ApiService.post('/wave/$waveId/interest', {'signal': signal});
  }

  /// Track a view/replay of a wave - persists to backend for accurate counts
  static Future<void> trackView(String waveId) async {
    try {
      await ApiService.post('/wave/$waveId/view', {});
    } catch (_) {
      // Silently fail - view tracking is non-critical
    }
  }

  static Future<WavePulseMomentsResponse> getPulseMoments(String waveId) async {
    final data = await ApiService.getPublic('/wave/$waveId/pulses/moments');
    final rawMoments = data['moments'];
    final moments = rawMoments is List
        ? rawMoments
              .whereType<Map<String, dynamic>>()
              .map(WavePulseMomentModel.fromJson)
              .toList()
        : <WavePulseMomentModel>[];

    final durationRaw = data['duration'];
    int duration = 0;
    if (durationRaw is num) {
      duration = durationRaw.toInt();
    } else if (durationRaw is String) {
      duration = int.tryParse(durationRaw) ?? 0;
    }

    return WavePulseMomentsResponse(moments: moments, duration: duration);
  }

  static Future<WaveAccessDecision> checkAccess(
    String waveId, {
    String? sessionId,
  }) async {
    final data = await ApiService.post('/wave/$waveId/access-check', {
      'session_id': sessionId ?? '',
    });
    return WaveAccessDecision.fromJson(data);
  }

  static Future<void> acknowledgeAdultConsent(
    String waveId,
    String sessionId,
  ) async {
    await ApiService.post('/wave/$waveId/access-consent', {
      'session_id': sessionId,
    });
  }
}
