import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class PicStorageService {
  static const String _picsKey = 'exclusive_pics_v2';

  static Future<void> savePic(String channelId, String pic) async {
    final prefs = await SharedPreferences.getInstance();
    final pics = await getPics();
    pics[channelId] = pic;
    await prefs.setString(_picsKey, jsonEncode(pics));
  }

  static Future<Map<String, String>> getPics() async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = prefs.getString(_picsKey);
    if (encoded == null) return {};
    try {
      final decoded = jsonDecode(encoded) as Map<String, dynamic>;
      return decoded.map((key, value) => MapEntry(key, value.toString()));
    } catch (e) {
      return {};
    }
  }

  static Future<String?> getPic(String channelId) async {
    final pics = await getPics();
    return pics[channelId];
  }

  static Future<void> removePic(String channelId) async {
    final prefs = await SharedPreferences.getInstance();
    final pics = await getPics();
    pics.remove(channelId);
    await prefs.setString(_picsKey, jsonEncode(pics));
  }
}
