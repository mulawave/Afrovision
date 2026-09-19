import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_service.dart';
import '../storage/auth_storage.dart';
import 'telemetry_service.dart';

/// User-facing quality / data-saver profiles for HLS / DASH streams.
///
/// Raw MP4 streams only have a single source resolution, so the selector is
/// disabled for those sources and this setting only applies when an adaptive
/// manifest is available.
enum QualityProfile {
  dataSaver(500000, 'Data Saver', '240p / 0.5 Mbps'),
  balanced(1500000, 'Balanced', '480p / 1.5 Mbps'),
  quality(3000000, 'Quality', '720p / 3 Mbps'),
  best(5000000, 'Best', '1080p / 5 Mbps'),
  auto(null, 'Auto', 'No cap — best available');

  const QualityProfile(this.bps, this.label, this.description);

  /// Bitrate ceiling in bits per second, or `null` for no cap.
  final int? bps;
  final String label;
  final String description;

  static QualityProfile fromName(String? name) {
    return QualityProfile.values.firstWhere(
      (p) => p.name == name,
      orElse: () => QualityProfile.balanced,
    );
  }
}

/// Persisted user settings for the channel watch player.
class PlayerSettings {
  final int liveDelaySeconds;
  final QualityProfile quality;
  final bool useMediaKit;

  /// Refuse to start playback unless connected to Wi-Fi.
  final bool wifiOnlyStreaming;

  /// Cap streams to the Data Saver bitrate whenever off Wi-Fi, regardless
  /// of the selected [quality] tier.
  final bool dataSaverOnCellular;

  const PlayerSettings({
    this.liveDelaySeconds = 30,
    this.quality = QualityProfile.balanced,
    this.useMediaKit = true,
    this.wifiOnlyStreaming = false,
    this.dataSaverOnCellular = false,
  });

  PlayerSettings copyWith({
    int? liveDelaySeconds,
    QualityProfile? quality,
    bool? useMediaKit,
    bool? wifiOnlyStreaming,
    bool? dataSaverOnCellular,
  }) {
    return PlayerSettings(
      liveDelaySeconds: liveDelaySeconds ?? this.liveDelaySeconds,
      quality: quality ?? this.quality,
      useMediaKit: useMediaKit ?? this.useMediaKit,
      wifiOnlyStreaming: wifiOnlyStreaming ?? this.wifiOnlyStreaming,
      dataSaverOnCellular: dataSaverOnCellular ?? this.dataSaverOnCellular,
    );
  }

  Map<String, dynamic> toMap() => {
        'liveDelaySeconds': liveDelaySeconds,
        'quality': quality.name,
        'useMediaKit': useMediaKit,
        'wifiOnlyStreaming': wifiOnlyStreaming,
        'dataSaverOnCellular': dataSaverOnCellular,
      };

  factory PlayerSettings.fromMap(Map<String, dynamic> map) {
    return PlayerSettings(
      liveDelaySeconds: map['liveDelaySeconds'] as int? ?? 30,
      quality: QualityProfile.fromName(map['quality'] as String?),
      useMediaKit: map['useMediaKit'] as bool? ?? true,
      wifiOnlyStreaming: map['wifiOnlyStreaming'] as bool? ?? false,
      dataSaverOnCellular: map['dataSaverOnCellular'] as bool? ?? false,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlayerSettings &&
          other.liveDelaySeconds == liveDelaySeconds &&
          other.quality == quality &&
          other.useMediaKit == useMediaKit &&
          other.wifiOnlyStreaming == wifiOnlyStreaming &&
          other.dataSaverOnCellular == dataSaverOnCellular;

  @override
  int get hashCode =>
      liveDelaySeconds.hashCode ^
      quality.hashCode ^
      useMediaKit.hashCode ^
      wifiOnlyStreaming.hashCode ^
      dataSaverOnCellular.hashCode;
}

/// What quality tiers the backend can actually produce right now. Fetched
/// once from `GET /broadcast/playback-capabilities` — without this, Watch
/// Settings offered Quality (720p) and Best (1080p) unconditionally even
/// though the backend's default rendition ladder only ever produces
/// 240p/480p, so picking them did nothing.
class PlaybackCapabilities {
  final bool transcodingEnabled;
  final List<int> availableRenditions;

  const PlaybackCapabilities({
    this.transcodingEnabled = false,
    this.availableRenditions = const [],
  });

  /// Whether [profile] maps to a rendition height the backend can produce.
  /// `auto` and `dataSaver` (240p) are always considered reachable — the
  /// former degrades gracefully and 240p is the one rendition guaranteed by
  /// the backend's own fallback default.
  bool supports(QualityProfile profile) {
    if (profile == QualityProfile.auto || profile == QualityProfile.dataSaver) {
      return true;
    }
    if (!transcodingEnabled) return false;
    final requiredHeight = switch (profile) {
      QualityProfile.balanced => 480,
      QualityProfile.quality => 720,
      QualityProfile.best => 1080,
      _ => 0,
    };
    return availableRenditions.contains(requiredHeight);
  }

  factory PlaybackCapabilities.fromJson(Map<String, dynamic> json) {
    return PlaybackCapabilities(
      transcodingEnabled: json['transcoding_enabled'] as bool? ?? false,
      availableRenditions: (json['available_renditions'] as List?)
              ?.map((v) => (v as num).toInt())
              .toList() ??
          const [],
    );
  }
}

/// Loads, persists, and broadcasts changes to [PlayerSettings].
///
/// Settings are stored locally with [SharedPreferences] and synced to the
/// authenticated user's backend profile so the same preferences follow the
/// user across devices. Sync failures are non-fatal and logged.
class PlayerSettingsService {
  static final PlayerSettingsService _instance = PlayerSettingsService._();
  static PlayerSettingsService get instance => _instance;

  PlayerSettingsService._();

  static const _prefsKey = 'afrovision_player_settings_v1';
  static const _backendSyncDebounceMs = 1500;

  PlayerSettings _settings = const PlayerSettings();
  final _notifier = ValueNotifier<PlayerSettings>(const PlayerSettings());

  bool _initialized = false;
  Timer? _backendSyncTimer;

  PlaybackCapabilities _capabilities = const PlaybackCapabilities();
  final _capabilitiesNotifier =
      ValueNotifier<PlaybackCapabilities>(const PlaybackCapabilities());

  ValueNotifier<PlayerSettings> get notifier => _notifier;
  PlayerSettings get current => _settings;

  ValueNotifier<PlaybackCapabilities> get capabilitiesNotifier => _capabilitiesNotifier;
  PlaybackCapabilities get capabilities => _capabilities;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    // Non-blocking — the settings screen renders with a conservative
    // (everything disabled except Data Saver/Auto) default until this
    // resolves, rather than delaying the whole screen on it.
    _loadCapabilities();

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      if (raw != null && raw.isNotEmpty) {
        // Storage is a simple JSON-ish map; parse it manually to avoid
        // importing dart:convert in this file.
        final map = _parseSimpleMap(raw);
        _settings = PlayerSettings.fromMap(map);
      }
    } catch (e) {
      debugPrint('[PlayerSettingsService] Load failed: $e');
    }

    _notifier.value = _settings;

    // Then try to load from the backend so the same settings follow the user
    // across devices. If the network is unavailable or the user is not logged
    // in, the local copy is kept.
    await _loadFromBackend();
  }

  Future<void> _loadCapabilities() async {
    try {
      final response = await ApiService.getPublic('/broadcast/playback-capabilities');
      if (response is Map<String, dynamic>) {
        _capabilities = PlaybackCapabilities.fromJson(response);
        _capabilitiesNotifier.value = _capabilities;
      }
    } catch (e) {
      debugPrint('[PlayerSettingsService] Capabilities load failed: $e');
    }
  }

  Future<void> _loadFromBackend() async {
    String? token;
    try {
      token = await AuthStorage.getToken();
    } catch (e) {
      debugPrint('[PlayerSettingsService] Token read failed: $e');
      return;
    }
    if (token == null || token.isEmpty) return;

    try {
      final response = await ApiService.get('/users/me');
      final user = response['user'] as Map<String, dynamic>?;
      final cloud = user?['player_settings'] as Map<String, dynamic>?;
      if (cloud == null || cloud.isEmpty) return;

      final cloudSettings = PlayerSettings.fromMap(cloud);
      if (cloudSettings == _settings) return;

      _settings = cloudSettings;
      _notifier.value = _settings;
      await _saveLocal(_settings);
    } catch (e) {
      debugPrint('[PlayerSettingsService] Backend load failed: $e');
    }
  }

  Future<void> save(PlayerSettings settings) async {
    _settings = settings;
    _notifier.value = settings;

    TelemetryService.marker(
      'player_settings_save',
      parameters: settings.toMap(),
    );

    await _saveLocal(settings);
    _scheduleBackendSync(settings);
  }

  Future<void> _saveLocal(PlayerSettings settings) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = _encodeSimpleMap(settings.toMap());
      await prefs.setString(_prefsKey, raw);
    } catch (e) {
      debugPrint('[PlayerSettingsService] Local save failed: $e');
      TelemetryService.error('player_settings_save', e);
    }
  }

  void _scheduleBackendSync(PlayerSettings settings) {
    _backendSyncTimer?.cancel();
    _backendSyncTimer = Timer(
      const Duration(milliseconds: _backendSyncDebounceMs),
      () => _syncToBackend(settings),
    );
  }

  Future<void> _syncToBackend(PlayerSettings settings) async {
    String? token;
    try {
      token = await AuthStorage.getToken();
    } catch (e) {
      debugPrint('[PlayerSettingsService] Token read failed: $e');
      return;
    }
    if (token == null || token.isEmpty) return;

    try {
      await ApiService.patch('/users/player-settings', {
        'player_settings': settings.toMap(),
      });
    } catch (e) {
      debugPrint('[PlayerSettingsService] Backend sync failed: $e');
      TelemetryService.error('player_settings_sync', e);
    }
  }

  Future<void> setLiveDelay(int seconds) => save(_settings.copyWith(liveDelaySeconds: seconds));
  Future<void> setQuality(QualityProfile quality) => save(_settings.copyWith(quality: quality));
  Future<void> setUseMediaKit(bool value) => save(_settings.copyWith(useMediaKit: value));
  Future<void> setWifiOnlyStreaming(bool value) => save(_settings.copyWith(wifiOnlyStreaming: value));
  Future<void> setDataSaverOnCellular(bool value) => save(_settings.copyWith(dataSaverOnCellular: value));

  /// A tiny key:value serializer suitable for a map with only a few entries.
  String _encodeSimpleMap(Map<String, dynamic> map) {
    return map.entries.map((e) => '${e.key}=${e.value}').join(';');
  }

  Map<String, dynamic> _parseSimpleMap(String raw) {
    final result = <String, dynamic>{};
    for (final part in raw.split(';')) {
      final eq = part.indexOf('=');
      if (eq == -1) continue;
      final key = part.substring(0, eq);
      final value = part.substring(eq + 1);
      if (key == 'liveDelaySeconds') {
        result[key] = int.tryParse(value) ?? 30;
      } else if (key == 'useMediaKit' || key == 'wifiOnlyStreaming' || key == 'dataSaverOnCellular') {
        result[key] = value == 'true';
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
