import '../../../core/api/api_service.dart';
import '../models/user_model.dart';

class ProfileService {
  static Future<UserModel> getProfile() async {
    final data = await ApiService.get('/users/me');
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> updateProfile({required String name}) async {
    final data = await ApiService.put('/users/update-profile', {
      'name': name,
    });
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> requestCreator() async {
    final data = await ApiService.post('/users/request-creator', {});
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }
}
