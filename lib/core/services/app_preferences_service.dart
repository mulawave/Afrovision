import 'package:shared_preferences/shared_preferences.dart';

/// Device-local app preferences shown on the Account Settings screen.
///
/// These are simple on/off switches and values that live only on this
/// device (SharedPreferences) — there is no backend "preferences" endpoint
/// today, so nothing here syncs across devices. Where a preference has a
/// real consumer elsewhere in the app (autoplay, picture-in-picture, watch
/// history), that consumer reads through this service; the rest are
/// stored for the user's own reference until a real feature reads them.
class AppPreferencesService {
  static const _autoplayNextKey = 'pref_autoplay_next';
  static const _alwaysHdKey = 'pref_always_hd';
  static const _pipEnabledKey = 'pref_pip_enabled';
  static const _privateProfileKey = 'pref_private_profile';
  static const _saveWatchHistoryKey = 'pref_save_watch_history';
  static const _adultContentKey = 'pref_adult_content';
  static const _biometricUnlockKey = 'pref_biometric_unlock';
  static const _languageKey = 'pref_language';
  static const _deviceCodeKey = 'pref_device_code';

  static Future<bool> _getBool(String key, bool fallback) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(key) ?? fallback;
  }

  static Future<void> _setBool(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  static Future<bool> get autoplayNext => _getBool(_autoplayNextKey, true);
  static Future<void> setAutoplayNext(bool v) => _setBool(_autoplayNextKey, v);

  static Future<bool> get alwaysStreamHd => _getBool(_alwaysHdKey, false);
  static Future<void> setAlwaysStreamHd(bool v) => _setBool(_alwaysHdKey, v);

  static Future<bool> get pipEnabled => _getBool(_pipEnabledKey, true);
  static Future<void> setPipEnabled(bool v) => _setBool(_pipEnabledKey, v);

  static Future<bool> get privateProfile => _getBool(_privateProfileKey, false);
  static Future<void> setPrivateProfile(bool v) => _setBool(_privateProfileKey, v);

  static Future<bool> get saveWatchHistory => _getBool(_saveWatchHistoryKey, true);
  static Future<void> setSaveWatchHistory(bool v) => _setBool(_saveWatchHistoryKey, v);

  static Future<bool> get adultContent => _getBool(_adultContentKey, false);
  static Future<void> setAdultContent(bool v) => _setBool(_adultContentKey, v);

  static Future<bool> get biometricUnlock => _getBool(_biometricUnlockKey, false);
  static Future<void> setBiometricUnlock(bool v) => _setBool(_biometricUnlockKey, v);

  static Future<String> get language async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_languageKey) ?? 'English';
  }

  /// A device code shown in Identifier Codes. Generated once per install
  /// and cached locally — there is no backend device-registry today, so
  /// this is not verifiable server-side, only a stable label for support
  /// conversations on this device.
  static Future<String> deviceCode() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_deviceCodeKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final code = _generateDeviceCode();
    await prefs.setString(_deviceCodeKey, code);
    return code;
  }

  static String _generateDeviceCode() {
    final rand = DateTime.now().microsecondsSinceEpoch;
    final hex = rand.toRadixString(16).toUpperCase();
    final suffix = hex.length >= 6 ? hex.substring(hex.length - 6) : hex.padLeft(6, '0');
    return 'DEV-$suffix';
  }
}
