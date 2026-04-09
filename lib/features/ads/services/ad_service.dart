import '../../../core/api/api_service.dart';

class AdService {
  static Future<List<Map<String, dynamic>>> getMyAds() async {
    final data = await ApiService.get('/ads/mine');
    return List<Map<String, dynamic>>.from(data['ads'] ?? []);
  }

  static Future<Map<String, dynamic>> submitAd(Map<String, dynamic> body) async {
    return ApiService.post('/ads', body);
  }

  static Future<Map<String, dynamic>> getMyAnalytics() async {
    return ApiService.get('/ads/billing/my-analytics');
  }

  static Future<Map<String, dynamic>> topUp(String adId, double amount) async {
    return ApiService.post('/ads/billing/top-up', {
      'ad_id': adId,
      'amount': amount,
    });
  }

  static Future<Map<String, dynamic>> pauseAd(String adId) async {
    return ApiService.patch('/ads/$adId', {'status': 'paused'});
  }

  static Future<Map<String, dynamic>> resumeAd(String adId) async {
    return ApiService.patch('/ads/$adId', {'status': 'active'});
  }
}
