import 'dart:io';
import 'package:http/http.dart' as http;
import '../../../core/api/api_service.dart';

class AdService {
  static Future<List<Map<String, dynamic>>> getMyAds() async {
    final data = await ApiService.get('/ads/me');
    return List<Map<String, dynamic>>.from(data['ads'] ?? []);
  }

  static Future<Map<String, dynamic>> submitAd(
    Map<String, dynamic> body,
  ) async {
    return ApiService.post('/ads', body);
  }

  static Future<Map<String, dynamic>> getUploadUrl({
    required String contentType,
    String? fileName,
  }) async {
    return ApiService.post('/ads/upload-url', {
      'content_type': contentType,
      if (fileName != null) 'file_name': fileName,
    });
  }

  static Future<void> uploadToGcs({
    required String signedUrl,
    required File file,
    required String contentType,
  }) async {
    final response = await http.put(
      Uri.parse(signedUrl),
      headers: {'Content-Type': contentType},
      body: await file.readAsBytes(),
    );
    if (response.statusCode >= 400) {
      throw Exception('Upload failed with status ${response.statusCode}');
    }
  }

  static Future<Map<String, dynamic>> getMyAnalytics() async {
    return ApiService.get('/ads/my-analytics');
  }

  static Future<Map<String, dynamic>> topUp(String adId, double amount) async {
    return ApiService.patch('/ads/$adId/budget', {
      'amount': amount,
    });
  }

  static Future<Map<String, dynamic>> pauseAd(String adId) async {
    return ApiService.patch('/ads/$adId/pause', {});
  }

  static Future<Map<String, dynamic>> resumeAd(String adId) async {
    return ApiService.patch('/ads/$adId/activate', {});
  }
}
