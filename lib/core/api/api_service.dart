import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../storage/auth_storage.dart';
import 'dart:io';

class ApiService {
  static final String _baseUrl = AppConfig.baseUrl;
  static const Duration _timeout = Duration(seconds: 30);
  static const Duration _uploadTimeout = Duration(seconds: 60);

  static Future<Map<String, String>> _headers() async {
    final token = await AuthStorage.getToken();
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  /// Safely decode JSON from a response body.
  /// Throws a readable ApiException when the server returns HTML instead of JSON.
  static Map<String, dynamic> _decodeJson(http.Response response) {
    final body = response.body.trimLeft();
    if (body.startsWith('<')) {
      throw ApiException(
        'Server returned an unexpected response. Please try again later.',
        response.statusCode,
      );
    }
    return jsonDecode(body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await http.post(
      Uri.parse('$_baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(_timeout);
    final data = _decodeJson(response);
    if (response.statusCode >= 400) {
      throw ApiException(
        data['error'] as String? ?? 'Request failed',
        response.statusCode,
      );
    }
    return data;
  }

  static Future<Map<String, dynamic>> get(String path) async {
    final response = await http.get(
      Uri.parse('$_baseUrl$path'),
      headers: await _headers(),
    ).timeout(_timeout);
    final data = _decodeJson(response);
    if (response.statusCode >= 400) {
      throw ApiException(
        data['error'] as String? ?? 'Request failed',
        response.statusCode,
      );
    }
    return data;
  }

  static Future<Map<String, dynamic>> put(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await http.put(
      Uri.parse('$_baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(_timeout);
    final data = _decodeJson(response);
    if (response.statusCode >= 400) {
      throw ApiException(
        data['error'] as String? ?? 'Request failed',
        response.statusCode,
      );
    }
    return data;
  }

  static Future<Map<String, dynamic>> patch(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await http.patch(
      Uri.parse('$_baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(_timeout);
    final data = _decodeJson(response);
    if (response.statusCode >= 400) {
      throw ApiException(
        data['error'] as String? ?? 'Request failed',
        response.statusCode,
      );
    }
    return data;
  }

  static Future<Map<String, dynamic>> delete(String path) async {
    final response = await http.delete(
      Uri.parse('$_baseUrl$path'),
      headers: await _headers(),
    ).timeout(_timeout);
    final data = _decodeJson(response);
    if (response.statusCode >= 400) {
      throw ApiException(
        data['error'] as String? ?? 'Request failed',
        response.statusCode,
      );
    }
    return data;
  }

  static Future<Map<String, dynamic>> uploadFile(
    String path,
    File file, {
    String fieldName = 'file',
  }) async {
    final token = await AuthStorage.getToken();
    final request = http.MultipartRequest('POST', Uri.parse('$_baseUrl$path'));
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.files.add(await http.MultipartFile.fromPath(fieldName, file.path));
    final streamedResponse = await request.send().timeout(_uploadTimeout);
    final response = await http.Response.fromStream(streamedResponse);
    final data = _decodeJson(response);
    if (response.statusCode >= 400) {
      throw ApiException(
        data['error'] as String? ?? 'Upload failed',
        response.statusCode,
      );
    }
    return data;
  }

  static Future<Map<String, dynamic>> uploadFileWithFields(
    String path,
    File file,
    Map<String, String> fields, {
    String fieldName = 'file',
  }) async {
    final token = await AuthStorage.getToken();
    final request = http.MultipartRequest('POST', Uri.parse('$_baseUrl$path'));
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.fields.addAll(fields);
    request.files.add(await http.MultipartFile.fromPath(fieldName, file.path));
    final streamedResponse = await request.send().timeout(_uploadTimeout);
    final response = await http.Response.fromStream(streamedResponse);
    final data = _decodeJson(response);
    if (response.statusCode >= 400) {
      throw ApiException(
        data['error'] as String? ?? 'Upload failed',
        response.statusCode,
      );
    }
    return data;
  }

  /// Public GET — no auth header, returns dynamic (can be List or Map)
  static Future<dynamic> getPublic(String path) async {
    final response = await http.get(
      Uri.parse('$_baseUrl$path'),
      headers: {'Content-Type': 'application/json'},
    ).timeout(_timeout);
    final body = response.body.trimLeft();
    if (body.startsWith('<')) {
      throw ApiException(
        'Server returned an unexpected response. Please try again later.',
        response.statusCode,
      );
    }
    final data = jsonDecode(body);
    if (response.statusCode >= 400) {
      throw ApiException(
        (data is Map ? data['error'] : null) as String? ?? 'Request failed',
        response.statusCode,
      );
    }
    return data;
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
