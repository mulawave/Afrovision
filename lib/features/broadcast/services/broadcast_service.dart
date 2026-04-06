import 'dart:io';
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
    required int duration,
    required File videoFile,
  }) async {
    final data = await ApiService.uploadFileWithFields(
      '/broadcast/videos',
      videoFile,
      {
        'channel_id': channelId,
        'title': title,
        'duration': duration.toString(),
      },
      fieldName: 'video',
    );
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

  static Future<List<ProgramModel>> getChannelSchedule(
      String channelId) async {
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
}
