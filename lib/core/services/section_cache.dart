import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Lightweight TTL'd JSON cache for tab-scoped API payloads (channel Waves,
/// Movies, Series, etc.).
///
/// Design goals — see phase1-buffering-findings.md F8:
///   1. On every visit to a channel profile the app used to re-fetch waves,
///      movies and series unconditionally, producing a "loading afresh"
///      experience even though the payloads rarely change between visits.
///   2. Persisting the raw API JSON to SharedPreferences lets subsequent
///      visits paint content instantly ("stale-while-revalidate"), while a
///      background refresh keeps the UI eventually consistent.
///   3. Zero backend cost — this is purely a client-side optimisation.
///
/// The cache is keyed by an opaque string (typically
/// `'<section>_<channelId>'`) and stores the raw JSON string plus a
/// timestamp. Callers decide how to serialise/deserialise their payload
/// via [jsonEncode]/[jsonDecode].
class SectionCache {
  static const String _prefix = 'sc_v1_';
  static const String _tsSuffix = '__ts';

  /// Consider a payload "fresh" for this long. Older payloads are still
  /// returned as stale (via [readStale]) so the UI can render instantly
  /// while a background refresh runs.
  static const Duration freshWindow = Duration(seconds: 60);

  /// Hard TTL — anything older than this is treated as absent. Prevents
  /// stale data from lingering across app upgrades.
  static const Duration maxAge = Duration(days: 3);

  /// Returns the cached JSON string if present and younger than [maxAge],
  /// regardless of freshness. Returns null on cache miss or hard expiry.
  static Future<String?> readStale(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt('$_prefix$key$_tsSuffix');
    if (ts == null) return null;
    final age = DateTime.now().millisecondsSinceEpoch - ts;
    if (age > maxAge.inMilliseconds) {
      // Expired — clean up.
      await prefs.remove('$_prefix$key');
      await prefs.remove('$_prefix$key$_tsSuffix');
      return null;
    }
    return prefs.getString('$_prefix$key');
  }

  /// Returns true if the cached entry exists and is inside [freshWindow].
  static Future<bool> isFresh(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt('$_prefix$key$_tsSuffix');
    if (ts == null) return false;
    final age = DateTime.now().millisecondsSinceEpoch - ts;
    return age <= freshWindow.inMilliseconds;
  }

  /// Persist the raw JSON string for [key] with the current timestamp.
  static Future<void> write(String key, String json) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_prefix$key', json);
    await prefs.setInt(
      '$_prefix$key$_tsSuffix',
      DateTime.now().millisecondsSinceEpoch,
    );
  }

  /// Convenience: encode [value] as JSON and persist. Safe for [Map] and
  /// [List] payloads composed of primitives.
  static Future<void> writeJson(String key, Object value) async {
    await write(key, jsonEncode(value));
  }

  /// Convenience: read + decode. Returns null on miss, hard expiry, or
  /// decode failure. Does NOT enforce freshness — callers can decide.
  static Future<Object?> readDecoded(String key) async {
    final raw = await readStale(key);
    if (raw == null) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  /// Remove a single cached entry.
  static Future<void> remove(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_prefix$key');
    await prefs.remove('$_prefix$key$_tsSuffix');
  }
}
