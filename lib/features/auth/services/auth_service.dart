import '../../../core/api/api_service.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/storage/auth_storage.dart';
import '../models/user_model.dart';

class AuthService {
  static UserModel? _cachedUser;
  static DateTime? _cachedAt;
  static const _cacheTtl = Duration(minutes: 2);

  static void _setCache(UserModel user) {
    _cachedUser = user;
    _cachedAt = DateTime.now();
  }

  static void clearCache() {
    _cachedUser = null;
    _cachedAt = null;
  }

  static Future<UserModel> getCurrentUser({bool forceRefresh = false}) async {
    final cached = _cachedUser;
    final cachedAt = _cachedAt;
    if (!forceRefresh &&
        cached != null &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) < _cacheTtl) {
      return cached;
    }
    final data = await ApiService.get('/auth/me');
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    _setCache(user);
    return user;
  }

  static Future<UserModel> register(
    String email,
    String password, {
    String? referralCode,
  }) async {
    final body = <String, dynamic>{
      'email': email,
      'password': password,
      'client': 'mobile',
    };
    if (referralCode != null && referralCode.isNotEmpty) {
      body['referral_code'] = referralCode;
    }
    final data = await ApiService.post('/auth/register', body);
    await AuthStorage.saveToken(data['token'] as String);
    // Register FCM token silently after new account creation
    NotificationService.registerToken();
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    _setCache(user);
    return user;
  }

  static Future<UserModel> login(String email, String password) async {
    final data = await ApiService.post('/auth/login', {
      'email': email,
      'password': password,
      'client': 'mobile',
    });
    await AuthStorage.saveToken(data['token'] as String);
    // Re-register FCM token on every login (token may have rotated)
    NotificationService.registerToken();
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    _setCache(user);
    return user;
  }

  static Future<void> logout() async {
    // Remove FCM token from backend before clearing the session
    await NotificationService.unregisterToken();
    await AuthStorage.deleteToken();
    clearCache();
  }

  static Future<void> forgotPassword(String email) async {
    await ApiService.post('/auth/forgot-password', {'email': email});
  }

  static Future<void> resetPassword(String token, String password) async {
    await ApiService.post('/auth/reset-password', {
      'token': token,
      'password': password,
    });
  }

  /// Login with PAK (Personal Access Key) — mirrors the exact raven_lib handleLogin flow.
  /// The backend performs: CI3 API → Firestore fallback chain → UID derivation → merge write.
  static Future<UserModel> pakLogin(String pak) async {
    final data = await ApiService.post('/auth/pak-login', {'pak': pak});
    await AuthStorage.saveToken(data['token'] as String);
    NotificationService.registerToken();
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  // ── Account Deletion ──────────────────────────────────

  static Future<Map<String, dynamic>> requestAccountDeletion(
    String reason,
    String feedback,
  ) async {
    return await ApiService.post('/users/delete-account', {
      'reason': reason,
      'feedback': feedback,
    });
  }

  static Future<Map<String, dynamic>> getDeletionStatus() async {
    return await ApiService.get('/users/delete-account');
  }

  static Future<Map<String, dynamic>> cancelAccountDeletion() async {
    return await ApiService.delete('/users/delete-account');
  }

  static Future<Map<String, dynamic>> confirmImmediateDeletion(
    String password,
  ) async {
    return await ApiService.post('/users/delete-account/confirm', {
      'password': password,
    });
  }
}
