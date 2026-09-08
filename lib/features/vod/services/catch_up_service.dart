import 'dart:convert';

import '../../../core/api/api_service.dart';
import '../../../core/services/section_cache.dart';
import '../models/catch_up_models.dart';

/// Service for the Catch-up/IMDb discovery feed.
///
/// The feed is backed by the server-side /catchup/home endpoint which
/// proxies TMDB requests using the admin-configured IMDb/TMDB API key.
class CatchUpService {
  static const String _cacheKey = 'catchup_home';

  static Future<CatchUpHome> getHome() async {
    final data = await ApiService.get('/catchup/home');
    await SectionCache.write(_cacheKey, jsonEncode(data));
    return CatchUpHome.fromJson(data);
  }

  static Future<CatchUpHome> getHomeCached({
    void Function(CatchUpHome cached)? onCached,
  }) async {
    if (onCached != null) {
      final raw = await SectionCache.readStale(_cacheKey);
      if (raw != null) {
        try {
          onCached(CatchUpHome.fromJson(
              jsonDecode(raw) as Map<String, dynamic>));
        } catch (_) {}
      }
    }
    return getHome();
  }

  static Future<CatchUpItem> getDetail(String type, String id) async {
    final data = await ApiService.get('/catchup/detail?type=$type&id=$id');
    final payload = data['data'] as Map<String, dynamic>? ?? data;
    return CatchUpItem.fromJson(payload);
  }
}
