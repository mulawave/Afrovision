import '../../../core/api/api_service.dart';

class KycService {
  static const Duration _cacheTtl = Duration(minutes: 2);
  static Map<String, dynamic>? _cache;
  static DateTime? _cacheUpdatedAt;
  static Future<Map<String, dynamic>?>? _requestInFlight;

  static Future<Map<String, dynamic>?> getMe({
    bool forceRefresh = false,
  }) async {
    final now = DateTime.now();
    final cacheAge = _cacheUpdatedAt == null
        ? null
        : now.difference(_cacheUpdatedAt!);

    if (!forceRefresh &&
        _cache != null &&
        cacheAge != null &&
        cacheAge < _cacheTtl) {
      return _cache;
    }

    if (_requestInFlight != null) {
      return _requestInFlight!;
    }

    _requestInFlight = () async {
      try {
        final data = await ApiService.get('/kyc/me');
        if (data['id'] == null) {
          _cache = null;
          _cacheUpdatedAt = DateTime.now();
          return null;
        }

        _cache = Map<String, dynamic>.from(data as Map);
        _cacheUpdatedAt = DateTime.now();
        return _cache;
      } catch (_) {
        return _cache;
      }
    }();

    try {
      return await _requestInFlight!;
    } finally {
      _requestInFlight = null;
    }
  }

  static void invalidate() {
    _cache = null;
    _cacheUpdatedAt = null;
  }
}
