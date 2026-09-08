import 'dart:convert';

import '../../../core/api/api_service.dart';
import '../../../core/services/section_cache.dart';
import '../models/media_center_hero_model.dart';

/// Client for the Media Center surface's own endpoints (currently: heroes).
/// Follows the stale-while-revalidate pattern already used by [VodService]:
/// the `*Cached` variants hand back the last known list synchronously via
/// `onCached`, then hit the network and overwrite the cache.
class MediaCenterService {
  static const String _heroesKey = 'media_center_heroes';

  /// GET /media-center/heroes — public list of currently-active heroes.
  static Future<List<MediaCenterHero>> getHeroes() async {
    final data = await ApiService.get('/media-center/heroes');
    await SectionCache.write(_heroesKey, jsonEncode(data));
    return _parse(data);
  }

  /// Stale-while-revalidate wrapper for [getHeroes]. Fail-tolerant.
  static Future<List<MediaCenterHero>> getHeroesCached({
    void Function(List<MediaCenterHero> cached)? onCached,
  }) async {
    if (onCached != null) {
      final raw = await SectionCache.readStale(_heroesKey);
      if (raw != null) {
        try {
          onCached(_parse(jsonDecode(raw) as Map<String, dynamic>));
        } catch (_) {}
      }
    }
    return getHeroes();
  }

  static List<MediaCenterHero> _parse(Map<String, dynamic> data) {
    // Backend shape: { "heroes": [ … ] } or { "data": { "heroes": [ … ] } }.
    final inner =
        data['data'] as Map<String, dynamic>? ?? data;
    final list = inner['heroes'] as List? ?? const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(MediaCenterHero.fromJson)
        .toList();
  }
}
