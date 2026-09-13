import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../storage/auth_storage.dart';
import 'dart:io';

class ApiService {
  static final String _baseUrl = AppConfig.baseUrl;
  static const Duration _timeout = Duration(seconds: 30);
  static const Duration _uploadTimeout = Duration(seconds: 60);
  static const int _maxRetries = 2;

  // Simple in-memory cache for GET responses (path → {data, expiry})
  static final Map<String, _CacheEntry> _cache = {};
  static const Duration _cacheTtl = Duration(minutes: 2);

  static Future<T> _safeRequest<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw ApiException(
        'Request timed out. Please check your internet connection and try again.',
        0,
      );
    } on SocketException {
      throw ApiException(
        'Network is unavailable. Please check your connection and retry.',
        0,
      );
    } on http.ClientException {
      throw ApiException(
        'Network is unavailable. Please check your connection and retry.',
        0,
      );
    } catch (e) {
      throw ApiException('Something went wrong. Please try again. Error: $e', 0);
    }
  }

  /// Retry on transient network errors (timeout, socket, client exceptions).
  /// Does NOT retry on ApiException (server returned a real response).
  static Future<T> _withRetry<T>(Future<T> Function() action) async {
    int attempts = 0;
    while (true) {
      try {
        return await action();
      } on TimeoutException {
        attempts++;
        if (attempts > _maxRetries) rethrow;
        await Future.delayed(Duration(seconds: attempts * 2));
      } on SocketException {
        attempts++;
        if (attempts > _maxRetries) rethrow;
        await Future.delayed(Duration(seconds: attempts * 2));
      } on http.ClientException {
        attempts++;
        if (attempts > _maxRetries) rethrow;
        await Future.delayed(Duration(seconds: attempts * 2));
      }
    }
  }

  static Future<Map<String, String>> _headers() async {
    final token = await AuthStorage.getToken();
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static dynamic _readCache(String path) {
    final entry = _cache[path];
    if (entry == null) return null;
    if (DateTime.now().isAfter(entry.expiry)) {
      _cache.remove(path);
      return null;
    }
    return entry.data;
  }

  static void _writeCache(String path, dynamic data) {
    _cache[path] = _CacheEntry(
      data: data,
      expiry: DateTime.now().add(_cacheTtl),
    );
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
    return _safeRequest(() async {
      final response = await http
          .post(
            Uri.parse('$_baseUrl$path'),
            headers: await _headers(),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
      final data = _decodeJson(response);
      if (response.statusCode >= 400) {
        throw ApiException(
          data['error'] as String? ?? 'Request failed',
          response.statusCode,
        );
      }
      return data;
    });
  }

  static void clearCache() {
    _cache.clear();
  }

  static Future<Map<String, dynamic>> get(String path, {bool noCache = false}) async {
    if (!noCache) {
      final cached = _readCache(path);
      if (cached != null) return cached as Map<String, dynamic>;
    }
    final result = await _safeRequest(() => _withRetry(() async {
      final response = await http
          .get(Uri.parse('$_baseUrl$path'), headers: await _headers())
          .timeout(_timeout);
      final data = _decodeJson(response);
      if (response.statusCode >= 400) {
        throw ApiException(
          data['error'] as String? ?? 'Request failed',
          response.statusCode,
        );
      }
      return data;
    }));
    if (!noCache) {
      _writeCache(path, result);
    }
    return result;
  }

  static Future<Map<String, dynamic>> put(
    String path,
    Map<String, dynamic> body,
  ) async {
    return _safeRequest(() async {
      final response = await http
          .put(
            Uri.parse('$_baseUrl$path'),
            headers: await _headers(),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
      final data = _decodeJson(response);
      if (response.statusCode >= 400) {
        throw ApiException(
          data['error'] as String? ?? 'Request failed',
          response.statusCode,
        );
      }
      return data;
    });
  }

  static Future<Map<String, dynamic>> patch(
    String path,
    Map<String, dynamic> body,
  ) async {
    return _safeRequest(() async {
      final response = await http
          .patch(
            Uri.parse('$_baseUrl$path'),
            headers: await _headers(),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
      final data = _decodeJson(response);
      if (response.statusCode >= 400) {
        throw ApiException(
          data['error'] as String? ?? 'Request failed',
          response.statusCode,
        );
      }
      return data;
    });
  }

  static Future<Map<String, dynamic>> delete(String path) async {
    return _safeRequest(() async {
      final response = await http
          .delete(Uri.parse('$_baseUrl$path'), headers: await _headers())
          .timeout(_timeout);
      final data = _decodeJson(response);
      if (response.statusCode >= 400) {
        throw ApiException(
          data['error'] as String? ?? 'Request failed',
          response.statusCode,
        );
      }
      return data;
    });
  }

  static Future<Map<String, dynamic>> uploadFile(
    String path,
    File file, {
    String fieldName = 'file',
  }) async {
    return _safeRequest(() async {
      final token = await AuthStorage.getToken();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl$path'),
      );
      if (token != null) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      request.files.add(
        await http.MultipartFile.fromPath(fieldName, file.path),
      );
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
    });
  }

  static Future<Map<String, dynamic>> uploadFileWithFields(
    String path,
    File file,
    Map<String, String> fields, {
    String fieldName = 'file',
  }) async {
    return _safeRequest(() async {
      final token = await AuthStorage.getToken();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl$path'),
      );
      if (token != null) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      request.fields.addAll(fields);
      request.files.add(
        await http.MultipartFile.fromPath(fieldName, file.path),
      );
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
    });
  }

  /// Public GET — no auth header, returns dynamic (can be List or Map)
  static Future<dynamic> getPublic(String path, {bool noCache = false}) async {
    if (!noCache) {
      final cached = _readCache(path);
      if (cached != null) return cached;
    }
    final result = await _safeRequest(() => _withRetry(() async {
      final response = await http
          .get(
            Uri.parse('$_baseUrl$path'),
            headers: {
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip',
            },
          )
          .timeout(_timeout);
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
    }));
    if (!noCache) {
      _writeCache(path, result);
    }
    return result;
  }

  /// Authenticated GET — sends auth header, returns dynamic (can be List or Map)
  static Future<dynamic> getDynamic(String path) async {
    final cached = _readCache(path);
    if (cached != null) return cached;
    final result = await _safeRequest(() => _withRetry(() async {
      final response = await http
          .get(Uri.parse('$_baseUrl$path'), headers: await _headers())
          .timeout(_timeout);
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
    }));
    _writeCache(path, result);
    return result;
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}

class _CacheEntry {
  final dynamic data;
  final DateTime expiry;
  _CacheEntry({required this.data, required this.expiry});
}
