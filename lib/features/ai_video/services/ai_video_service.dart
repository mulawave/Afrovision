import '../../../core/api/api_service.dart';
import '../models/ai_video_config_model.dart';

class AiVideoService {
  static Future<AiVideoConfigResponseModel> getConfig() async {
    final data = await ApiService.get('/ai-video/config');
    return AiVideoConfigResponseModel.fromJson(data);
  }

  static Future<AiVideoConfigResponseModel> getPublicConfig() async {
    final data = await ApiService.getPublic('/ai-video/config');
    return AiVideoConfigResponseModel.fromJson(
      (data as Map<String, dynamic>?) ?? const <String, dynamic>{},
    );
  }

  static Future<AiVideoJobListResponseModel> getMyJobs() async {
    final data = await ApiService.get('/ai-video/my-jobs');
    return AiVideoJobListResponseModel.fromJson(
      (data as Map<String, dynamic>?) ?? const <String, dynamic>{},
    );
  }

  static Future<AiVideoJobModel> getJob(String jobId) async {
    final data = await ApiService.get('/ai-video/jobs/$jobId');
    final root =
        (data['job'] as Map<String, dynamic>? ?? const <String, dynamic>{});
    return AiVideoJobModel.fromJson(root);
  }

  static Future<AiVideoJobModel> createJob({
    required String requestType,
    String? prompt,
    String? negativePrompt,
    required int durationSeconds,
    String aspectRatio = '16:9',
    String resolution = '720p',
    String? seed,
    String? sourceImageUrl,
  }) async {
    final data = await ApiService.post('/ai-video/jobs', {
      'request_type': requestType,
      'prompt': prompt,
      'negative_prompt': negativePrompt,
      'duration_seconds': durationSeconds,
      'aspect_ratio': aspectRatio,
      'resolution': resolution,
      'seed': seed,
      'source_image_url': sourceImageUrl,
    });
    final root =
        (data['job'] as Map<String, dynamic>? ?? const <String, dynamic>{});
    return AiVideoJobModel.fromJson(root);
  }

  static Future<AiVideoJobModel> cancelJob(String jobId) async {
    final data = await ApiService.post('/ai-video/jobs/$jobId/cancel', {});
    final root =
        (data['job'] as Map<String, dynamic>? ?? const <String, dynamic>{});
    return AiVideoJobModel.fromJson(root);
  }

  static Future<AiVideoJobModel> retryJob(String jobId) async {
    final data = await ApiService.post('/ai-video/jobs/$jobId/retry', {});
    final root =
        (data['job'] as Map<String, dynamic>? ?? const <String, dynamic>{});
    return AiVideoJobModel.fromJson(root);
  }

  static Future<AiVideoSourceImageUploadModel> getSourceImageUploadUrl(
    String contentType,
  ) async {
    final data = await ApiService.post('/ai-video/source-image/upload-url', {
      'content_type': contentType,
    });
    return AiVideoSourceImageUploadModel.fromJson(
      (data as Map<String, dynamic>?) ?? const <String, dynamic>{},
    );
  }
}
