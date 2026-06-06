import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class LibrarySession {
  final String channelId;
  final String? itemId;
  final int lastPage;

  const LibrarySession({
    required this.channelId,
    required this.itemId,
    required this.lastPage,
  });

  Map<String, dynamic> toJson() => {
    'channelId': channelId,
    'itemId': itemId,
    'lastPage': lastPage,
  };

  factory LibrarySession.fromJson(Map<String, dynamic> json) {
    return LibrarySession(
      channelId: (json['channelId'] ?? '').toString(),
      itemId: json['itemId']?.toString(),
      lastPage: (json['lastPage'] as num?)?.toInt() ?? 1,
    );
  }
}

class LibrarySessionService {
  static const String _key = 'library_session_v1';

  static Future<void> saveSession({
    required String channelId,
    String? itemId,
    int lastPage = 1,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = LibrarySession(
      channelId: channelId,
      itemId: itemId,
      lastPage: lastPage,
    );
    await prefs.setString(_key, jsonEncode(payload.toJson()));
  }

  static Future<LibrarySession?> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return LibrarySession.fromJson(json);
    } catch (_) {
      await prefs.remove(_key);
      return null;
    }
  }
}
