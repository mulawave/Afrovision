import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

class ApiService {
  static const _tokenKey = 'marketer_token';
  static const _marketerKey = 'marketer_data';

  static String? _token;
  static Map<String, dynamic>? _marketer;

  static String? get token => _token;
  static Map<String, dynamic>? get marketer => _marketer;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final raw = prefs.getString(_marketerKey);
    if (raw != null) _marketer = jsonDecode(raw);
  }

  static Future<void> _saveSession(String token, Map<String, dynamic> marketer) async {
    _token = token;
    _marketer = marketer;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_marketerKey, jsonEncode(marketer));
  }

  static Future<void> clearSession() async {
    _token = null;
    _marketer = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_marketerKey);
  }

  static Uri _uri(String path) {
    final base = AppConfig.baseUrl.replaceAll(RegExp(r'/$'), '');
    return Uri.parse('$base$path');
  }

  static Map<String, String> get _headers {
    final h = {'Content-Type': 'application/json'};
    if (_token != null) h['Authorization'] = 'Bearer $_token';
    return h;
  }

  static Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final res = await http.post(_uri(path), headers: _headers, body: jsonEncode(body ?? {})).timeout(const Duration(seconds: 30));
    return _parse(res);
  }

  static Future<Map<String, dynamic>> get(String path) async {
    final res = await http.get(_uri(path), headers: _headers).timeout(const Duration(seconds: 30));
    return _parse(res);
  }

  static Map<String, dynamic> _parse(http.Response res) {
    Map<String, dynamic> data;
    try {
      data = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      data = {
        'success': false,
        'message': res.statusCode >= 500
            ? 'Server error (${res.statusCode}). Please try again.'
            : 'Unexpected response from server (${res.statusCode}).',
      };
    }
    if (res.statusCode == 401) {
      clearSession();
    }
    return data;
  }

  // ── Auth ──────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> login(String username, String pin) async {
    final data = await post('/distribution/marketer/login', body: {'username': username, 'pin': pin});
    if (data['success'] == true) {
      await _saveSession(data['token'] as String, data['marketer'] as Map<String, dynamic>);
    }
    return data;
  }

  static Future<void> logout() async {
    await clearSession();
  }

  // ── Dashboard ─────────────────────────────────────────────────

  static Future<Map<String, dynamic>> me() async {
    return get('/distribution/marketer/me');
  }

  // ── Codes ─────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> requestCode() async {
    return post('/distribution/marketer/codes/request');
  }

  static Future<Map<String, dynamic>> listCodes() async {
    return get('/distribution/marketer/codes');
  }
}
