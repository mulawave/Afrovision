import 'dart:io';
import '../../../core/api/api_service.dart';
import '../models/user_model.dart';

class ProfileService {
  static Future<UserModel> getProfile() async {
    final data = await ApiService.get('/users/me');
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> updateProfile({String? name, String? email}) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (email != null) body['email'] = email;
    final data = await ApiService.put('/users/update-profile', body);
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> uploadAvatar(File file) async {
    final data = await ApiService.uploadFile(
      '/users/avatar',
      file,
      fieldName: 'avatar',
    );
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<Map<String, dynamic>> requestCreator() async {
    return ApiService.post('/users/request-creator', {});
  }
}
