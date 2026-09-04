import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:video_thumbnail/video_thumbnail.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../storage/auth_storage.dart';
import '../config/app_config.dart';

/// Service that generates thumbnails from video URLs on the client side
/// and uploads them to the backend. This acts as a fallback when the
/// backend's ffmpeg-based thumbnail generation fails (e.g. Cloud Run
/// instance killed before async generation completes).
///
/// Cost-optimized: runs on the viewer's device (zero backend cost).
/// Processes waves sequentially (1 at a time) to avoid bandwidth spikes.
/// Each wave is only processed once per app session via _processedWaveIds.
class ThumbnailService {
  static final Set<String> _processedWaveIds = {};
  static bool _isProcessing = false;

  /// Check if a wave needs a thumbnail and generate one client-side if so.
  /// This is fire-and-forget — errors are logged but not propagated.
  static Future<void> ensureThumbnail({
    required String waveId,
    required String videoUrl,
    required String thumbnailUrl,
  }) async {
    // Skip if already has a thumbnail
    if (thumbnailUrl.isNotEmpty) return;
    // Skip if already processed in this session
    if (_processedWaveIds.contains(waveId)) return;
    // Skip if already processing another wave
    if (_isProcessing) return;

    _processedWaveIds.add(waveId);
    _isProcessing = true;

    try {
      await _generateAndUploadThumbnail(waveId, videoUrl);
    } catch (e) {
      debugPrint('[ThumbnailService] Failed to generate thumbnail for wave $waveId: $e');
      // Allow retry on next session by removing from processed set
      _processedWaveIds.remove(waveId);
    } finally {
      _isProcessing = false;
    }
  }

  /// Generate a thumbnail from a video URL using video_thumbnail,
  /// then upload it to the backend.
  static Future<void> _generateAndUploadThumbnail(
    String waveId,
    String videoUrl,
  ) async {
    // Resolve the video URL — if it's a relative HLS path, prefix with backend URL
    String fullVideoUrl = videoUrl;
    if (!fullVideoUrl.startsWith('http')) {
      fullVideoUrl = '${AppConfig.baseUrl}$fullVideoUrl';
    }

    // Generate thumbnail using video_thumbnail
    final thumbnailFile = await VideoThumbnail.thumbnailFile(
      video: fullVideoUrl,
      thumbnailPath: (await getTemporaryDirectory()).path,
      imageFormat: ImageFormat.JPEG,
      maxWidth: 540,
      quality: 75,
      timeMs: 3000,
    );

    if (thumbnailFile == null) {
      debugPrint('[ThumbnailService] video_thumbnail returned null for wave $waveId');
      return;
    }

    final file = File(thumbnailFile);
    if (!await file.exists()) {
      debugPrint('[ThumbnailService] Generated thumbnail file does not exist for wave $waveId');
      return;
    }

    // Upload to backend
    final uri = Uri.parse('${AppConfig.baseUrl}/wave/$waveId/thumbnail');
    final token = await _getAuthToken();
    if (token == null) {
      debugPrint('[ThumbnailService] No auth token, cannot upload thumbnail for wave $waveId');
      return;
    }

    final request = http.MultipartRequest('POST', uri);
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(
      await http.MultipartFile.fromPath(
        'thumbnail',
        file.path,
        contentType: MediaType('image', 'jpeg'),
      ),
    );

    final response = await request.send().timeout(
      const Duration(seconds: 30),
    );

    if (response.statusCode == 200) {
      debugPrint('[ThumbnailService] Successfully uploaded thumbnail for wave $waveId');
    } else {
      final body = await response.stream.bytesToString();
      debugPrint('[ThumbnailService] Upload failed for wave $waveId: ${response.statusCode} $body');
    }

    // Clean up temp file
    try {
      await file.delete();
    } catch (_) {}
  }

  static Future<String?> _getAuthToken() async {
    try {
      return await AuthStorage.getToken();
    } catch (_) {
      return null;
    }
  }
}
