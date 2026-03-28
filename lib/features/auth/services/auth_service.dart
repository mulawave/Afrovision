import '../../../core/api/api_service.dart';
import '../../../core/storage/auth_storage.dart';
import '../models/user_model.dart';

class AuthService {
  static Future<UserModel> register(String email, String password) async {
    final data = await ApiService.post('/auth/register', {
      'email': email,
      'password': password,
    });
    await AuthStorage.saveToken(data['token'] as String);
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> login(String email, String password) async {
    final data = await ApiService.post('/auth/login', {
      'email': email,
      'password': password,
    });
    await AuthStorage.saveToken(data['token'] as String);
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> getCurrentUser() async {
    final data = await ApiService.get('/auth/me');
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<void> logout() async {
    await AuthStorage.deleteToken();
  }

  static Future<String> forgotPassword(String email) async {
    final data = await ApiService.post('/auth/forgot-password', {
      'email': email,
    });
    return data['resetToken'] as String;
  }

  static Future<void> resetPassword(String token, String password) async {
    await ApiService.post('/auth/reset-password', {
      'token': token,
      'password': password,
    });
  }
}
