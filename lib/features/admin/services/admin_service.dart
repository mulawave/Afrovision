import '../../../core/api/api_service.dart';

class AdminService {
  static Future<Map<String, dynamic>> getDashboard() async {
    final data = await ApiService.get('/admin/dashboard');
    return data['dashboard'] as Map<String, dynamic>;
  }

  static Future<List<Map<String, dynamic>>> getUsers() async {
    final data = await ApiService.get('/admin/users');
    final list = data['users'] as List<dynamic>? ?? [];
    return list.cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getAllChannels() async {
    final data = await ApiService.get('/admin/channels');
    final list = data['channels'] as List<dynamic>? ?? [];
    return list.cast<Map<String, dynamic>>();
  }

  static Future<void> disableChannel(String id) async {
    await ApiService.post('/admin/channels/$id/disable', {});
  }

  static Future<void> enableChannel(String id) async {
    await ApiService.post('/admin/channels/$id/enable', {});
  }

  static Future<List<Map<String, dynamic>>> getFeatureFlags() async {
    final data = await ApiService.get('/admin/features');
    final list = data['flags'] as List<dynamic>? ?? [];
    return list.cast<Map<String, dynamic>>();
  }

  static Future<void> toggleFeatureFlag(String key, bool enabled) async {
    await ApiService.post('/admin/features', {'key': key, 'enabled': enabled});
  }

  static Future<List<Map<String, dynamic>>> getAuditLogs({
    int limit = 50,
  }) async {
    final data = await ApiService.get('/admin/audit?limit=$limit');
    final list = data['logs'] as List<dynamic>? ?? [];
    return list.cast<Map<String, dynamic>>();
  }
}
