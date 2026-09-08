import '../../../core/api/api_service.dart';

class GuardianService {
  static Map<String, dynamic>? _cache;

  static Future<Map<String, dynamic>?> getMine() async {
    try {
      final data = await ApiService.get('/guardian/me');
      if (data['id'] == null) return null;
      _cache = Map<String, dynamic>.from(data as Map);
      return _cache;
    } catch (_) {
      return _cache;
    }
  }

  static Future<Map<String, dynamic>> submit(Map<String, dynamic> body) async {
    final result = await ApiService.post('/guardian/submit', body);
    _cache = null;
    return result;
  }

  static void invalidate() {
    _cache = null;
  }
}
