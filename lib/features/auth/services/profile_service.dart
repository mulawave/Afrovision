import 'dart:io';
import '../../../core/api/api_service.dart';
import '../../../core/widgets/profile_setup_guard.dart';
import '../models/user_model.dart';
import 'auth_service.dart';

class ProfileService {
  static Future<UserModel> getProfile() async {
    final data = await ApiService.get('/users/me');
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> updateProfile({
    String? name,
    String? email,
    String? firstName,
    String? lastName,
    String? country,
    String? state,
    String? city,
    String? address,
    String? phoneNumber,
    String? referralSource,
    String? referralSourceDetail,
  }) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (email != null) body['email'] = email;
    if (firstName != null) body['firstName'] = firstName;
    if (lastName != null) body['lastName'] = lastName;
    if (country != null) body['country'] = country;
    if (state != null) body['state'] = state;
    if (city != null) body['city'] = city;
    if (address != null) body['address'] = address;
    if (phoneNumber != null) body['phoneNumber'] = phoneNumber;
    if (referralSource != null) body['referralSource'] = referralSource;
    if (referralSourceDetail != null) body['referralSourceDetail'] = referralSourceDetail;
    final data = await ApiService.put('/users/update-profile', body);
    AuthService.clearCache();
    ProfileSetupGuard.clearCache();
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<UserModel> uploadAvatar(File file) async {
    final data = await ApiService.uploadFile(
      '/users/avatar',
      file,
      fieldName: 'avatar',
    );
    AuthService.clearCache();
    ProfileSetupGuard.clearCache();
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  static Future<Map<String, dynamic>> requestCreator() async {
    return ApiService.post('/users/request-creator', {});
  }
}
