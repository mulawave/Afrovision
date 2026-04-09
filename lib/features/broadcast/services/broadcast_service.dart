import 'dart:io';
import 'package:http/http.dart' as http;
import '../../../core/api/api_service.dart';
import '../models/video_model.dart';
import '../models/program_model.dart';

class BroadcastService {
  // ─── Server Time Offset ────────────────────────────────

  static int _serverOffset = 0;

  /// Device-corrected current time using server offset.
  static int get correctedNow =>
      DateTime.now().millisecondsSinceEpoch + _serverOffset;

  /// Fetch server time once and compute offset for future use.
  static Future<void> syncServerOffset() async {
    try {
      final serverTime = await getServerTime();
      _serverOffset = serverTime - DateTime.now().millisecondsSinceEpoch;
    } catch (_) {
      // Silent fail — offset stays at 0 (trust device clock as fallback)
    }
  }

  // ─── Videos ────────────────────────────────────────────

  static Future<VideoModel> uploadVideo({
    required String channelId,
    required String title,
    required String description,
    required int duration,
    required File videoFile,
  }) async {
    final data =
        await ApiService.uploadFileWithFields('/broadcast/videos', videoFile, {
          'channel_id': channelId,
          'title': title,
          'description': description,
          'duration': duration.toString(),
        }, fieldName: 'video');
    return VideoModel.fromJson(data['video'] as Map<String, dynamic>);
  }

  /// Get a signed URL for direct-to-GCS upload.
  static Future<Map<String, String>> getUploadUrl({
    required String contentType,
    String? fileName,
  }) async {
    final data = await ApiService.post('/broadcast/videos/upload-url', {
      'content_type': contentType,
      if (fileName != null) 'file_name': fileName,
    });
    return {
      'signed_url': data['signed_url'] as String,
      'public_url': data['public_url'] as String,
      'filename': data['filename'] as String,
    };
  }

  /// Upload file bytes directly to GCS via signed URL.
  static Future<void> uploadToGcs({
    required String signedUrl,
    required File file,
    required String contentType,
    void Function(int sent, int total)? onProgress,
  }) async {
    final fileBytes = await file.readAsBytes();
    final totalBytes = fileBytes.length;
    final uri = Uri.parse(signedUrl);

    if (onProgress != null) {
      // Streamed upload with progress
      final request = http.StreamedRequest('PUT', uri);
      request.headers['Content-Type'] = contentType;
      request.headers['Content-Length'] = totalBytes.toString();
      request.contentLength = totalBytes;

      int bytesSent = 0;
      const chunkSize = 64 * 1024; // 64KB chunks
      for (int i = 0; i < totalBytes; i += chunkSize) {
        final end = (i + chunkSize < totalBytes) ? i + chunkSize : totalBytes;
        request.sink.add(fileBytes.sublist(i, end));
        bytesSent = end;
        onProgress(bytesSent, totalBytes);
      }
      request.sink.close();

      final response = await request.send();
      if (response.statusCode >= 400) {
        throw Exception('GCS upload failed with status ${response.statusCode}');
      }
    } else {
      final response = await http.put(
        uri,
        headers: {'Content-Type': contentType},
        body: fileBytes,
      );
      if (response.statusCode >= 400) {
        throw Exception('GCS upload failed with status ${response.statusCode}');
      }
    }
  }

  /// Register a video that was uploaded directly to GCS.
  static Future<VideoModel> registerUploadedVideo({
    required String channelId,
    required String title,
    required String description,
    required int duration,
    required String videoUrl,
  }) async {
    final data = await ApiService.post('/broadcast/videos/register', {
      'channel_id': channelId,
      'title': title,
      'description': description,
      'duration': duration,
      'video_url': videoUrl,
    });
    return VideoModel.fromJson(data['video'] as Map<String, dynamic>);
  }

  static Future<List<VideoModel>> getMyVideos() async {
    final data = await ApiService.get('/broadcast/videos/me');
    final list = data['videos'] as List<dynamic>;
    return list
        .map((e) => VideoModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<List<VideoModel>> getChannelVideos(String channelId) async {
    final data = await ApiService.get('/broadcast/videos/channel/$channelId');
    final list = data['videos'] as List<dynamic>;
    return list
        .map((e) => VideoModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<void> deleteVideo(String videoId) async {
    await ApiService.delete('/broadcast/videos/$videoId');
  }

  // ─── Schedule ──────────────────────────────────────────

  static Future<ProgramModel> scheduleProgram({
    required String channelId,
    required String videoId,
    required int startTime,
  }) async {
    final data = await ApiService.post('/broadcast/schedule', {
      'channel_id': channelId,
      'video_id': videoId,
      'start_time': startTime,
    });
    return ProgramModel.fromJson(data['program'] as Map<String, dynamic>);
  }

  static Future<List<ProgramModel>> scheduleSequential({
    required String channelId,
    required List<String> videoIds,
    required int startTime,
  }) async {
    final data = await ApiService.post('/broadcast/schedule/sequential', {
      'channel_id': channelId,
      'video_ids': videoIds,
      'start_time': startTime,
    });
    final list = data['programs'] as List<dynamic>;
    return list
        .map((e) => ProgramModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<List<ProgramModel>> getChannelSchedule(String channelId) async {
    final data = await ApiService.get('/broadcast/schedule/$channelId');
    final list = data['schedule'] as List<dynamic>;
    return list
        .map((e) => ProgramModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<void> deleteProgram(String programId) async {
    await ApiService.delete('/broadcast/schedule/$programId');
  }

  // ─── Playback ──────────────────────────────────────────

  static Future<Map<String, dynamic>> getNowPlaying(String channelId) async {
    return ApiService.get('/broadcast/now-playing/$channelId');
  }

  static Future<int> getServerTime() async {
    final data = await ApiService.get('/broadcast/time');
    return data['server_time'] as int;
  }

  // ─── Reminders ────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getMyReminders() async {
    final data = await ApiService.get('/broadcast/reminders/me');
    return List<Map<String, dynamic>>.from(data['reminders'] ?? []);
  }

  static Future<Map<String, dynamic>> setReminder(String programId) async {
    return ApiService.post('/broadcast/reminders', {'program_id': programId});
  }

  static Future<void> removeReminder(String programId) async {
    await ApiService.delete('/broadcast/reminders/$programId');
  }

  // ─── Ad Serving ────────────────────────────────────────

  /// Fetch in-stream ads for a channel break (pre-roll, mid-roll, brief).
  static Future<List<Map<String, dynamic>>> getInStreamAds(
    String? channelId,
  ) async {
    final path = channelId != null
        ? '/ads/serve/stream?channel_id=$channelId'
        : '/ads/serve/stream';
    final data = await ApiService.get(path);
    return List<Map<String, dynamic>>.from(data['ads'] ?? []);
  }

  /// Fetch a banner ad for a given placement (home or page).
  static Future<Map<String, dynamic>?> getBannerAd(String placement) async {
    final data = await ApiService.get('/ads/serve/banner?placement=$placement');
    final ad = data['ad'];
    return ad is Map<String, dynamic> ? ad : null;
  }

  /// Record that an ad was displayed.
  static Future<Map<String, dynamic>> recordAdImpression({
    required String adId,
    String? channelId,
    int viewerCount = 1,
  }) async {
    return ApiService.post('/ads/impression', {
      'ad_id': adId,
      if (channelId != null) 'channel_id': channelId,
      'viewer_count': viewerCount,
    });
  }
}
