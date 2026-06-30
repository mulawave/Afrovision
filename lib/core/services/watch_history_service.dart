import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class WatchHistoryEntry {
  final String id;
  final String name;
  final String? logo;
  final String? banner;
  final DateTime viewedAt;

  WatchHistoryEntry({
    required this.id,
    required this.name,
    this.logo,
    this.banner,
    required this.viewedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'logo': logo,
        'banner': banner,
        'viewedAt': viewedAt.toIso8601String(),
      };

  factory WatchHistoryEntry.fromJson(Map<String, dynamic> json) {
    return WatchHistoryEntry(
      id: json['id'] as String,
      name: json['name'] as String,
      logo: json['logo'] as String?,
      banner: json['banner'] as String?,
      viewedAt: DateTime.parse(json['viewedAt'] as String),
    );
  }
}

class WatchHistoryService {
  static const _key = 'watch_history_v1';
  static const int _maxEntries = 20;

  /// Load the stored watch history (most recent first).
  static Future<List<WatchHistoryEntry>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => WatchHistoryEntry.fromJson(e as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => b.viewedAt.compareTo(a.viewedAt));
    } catch (_) {
      return [];
    }
  }

  /// Record a channel view. If the channel already exists, move it to the top and update timestamp.
  static Future<void> record({
    required String channelId,
    required String channelName,
    String? channelLogo,
    String? channelBanner,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final history = await getHistory();
    history.removeWhere((e) => e.id == channelId);
    history.insert(
      0,
      WatchHistoryEntry(
        id: channelId,
        name: channelName,
        logo: channelLogo,
        banner: channelBanner,
        viewedAt: DateTime.now(),
      ),
    );
    final trimmed = history.length > _maxEntries
        ? history.sublist(0, _maxEntries)
        : history;
    await prefs.setString(
      _key,
      jsonEncode(trimmed.map((e) => e.toJson()).toList()),
    );
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
