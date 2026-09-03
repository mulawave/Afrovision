import 'dart:async';
import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_player/video_player.dart';

import '../../../core/config/app_config.dart';
import '../../../core/media/afrovision_video_controller.dart';
import '../../../core/services/player_settings_service.dart';
import '../../../core/services/telemetry_service.dart';
import '../../../core/storage/auth_storage.dart';
import '../services/broadcast_service.dart';
import 'legacy_broadcast_player.dart';

/// Current state of a [BroadcastPlayer] engine.
class BroadcastPlayerValue {
  final bool isInitialized;
  final bool isPlaying;
  final bool isBuffering;
  final bool hasError;
  final bool isRecovering;
  final String? errorMessage;
  final Duration position;
  final Duration duration;
  final double aspectRatio;

  const BroadcastPlayerValue({
    this.isInitialized = false,
    this.isPlaying = false,
    this.isBuffering = false,
    this.hasError = false,
    this.isRecovering = false,
    this.errorMessage,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.aspectRatio = 16 / 9,
  });
}

/// Channel watch player.
///
/// Wraps either `media_kit` (default) or the legacy `video_player` engine,
/// exposes a single video surface and a VideoPlayer-like state, and applies
/// user settings for live delay, quality/data cap, and engine kill switch.
class BroadcastPlayer extends ChangeNotifier {
  // Engine references
  AfrovisionVideoController? _mkController;
  LegacyBroadcastPlayer? _legacyPlayer;

  // Program metadata
  int programStartTime = 0;
  int programEndTime = 0;
  int videoDuration = 0;
  bool isLoop = false;
  List<int> availableRenditions = const [];
  int? selectedQuality;

  // State
  bool isInitialized = false;
  bool isBuffering = false;
  bool hasError = false;
  bool isRecovering = false;
  String? errorMessage;

  // Sync / settings
  bool _disposed = false;
  bool _adPaused = false;
  bool _isContinuousStream = false;
  int _liveDelaySeconds = 30;
  int? _userHlsBps;
  double _volume = 1.0;
  String? _currentVideoUrl;
  String? _baseVideoUrl;
  int _mkInitAttempts = 0;
  static const int _maxMkAttempts = 2;

  bool get _hasProgramWindow =>
      !_isContinuousStream &&
      programStartTime > 0 &&
      programEndTime > programStartTime;

  /// The current player value, suitable for building the video surface and UI.
  BroadcastPlayerValue get value {
    if (_mkController != null) {
      final v = _mkController!.value;
      return BroadcastPlayerValue(
        isInitialized: _mkController!.isInitialized,
        isPlaying: v.isPlaying,
        isBuffering: v.isBuffering,
        hasError: v.hasError,
        isRecovering: isRecovering,
        errorMessage: v.errorMessage,
        position: v.position,
        duration: v.duration,
        aspectRatio: v.aspectRatio,
      );
    }

    if (_legacyPlayer != null) {
      final ctrl = _legacyPlayer!.controller;
      final aspect = (ctrl != null && ctrl.value.isInitialized)
          ? ctrl.value.aspectRatio
          : 16 / 9;
      return BroadcastPlayerValue(
        isInitialized: _legacyPlayer!.isInitialized,
        isPlaying: ctrl?.value.isPlaying ?? false,
        isBuffering: _legacyPlayer!.isBuffering,
        hasError: _legacyPlayer!.hasError,
        isRecovering: _legacyPlayer!.isRecovering,
        errorMessage: _legacyPlayer!.errorMessage,
        position: ctrl?.value.position ?? Duration.zero,
        duration: ctrl?.value.duration ?? Duration.zero,
        aspectRatio: aspect,
      );
    }

    return const BroadcastPlayerValue();
  }

  /// For callers that still need a raw legacy controller (e.g. floating player).
  /// Returns `null` when the media_kit engine is active.
  VideoPlayerController? get legacyController => _legacyPlayer?.controller;

  /// Underlying media_kit controller, when active.
  AfrovisionVideoController? get videoController => _mkController;

  /// Resume playback.
  Future<void> play() async {
    await _mkController?.play();
    await _legacyPlayer?.controller?.play();
    notifyListeners();
  }

  /// Pause playback.
  Future<void> pause() async {
    await _mkController?.pause();
    await _legacyPlayer?.controller?.pause();
    notifyListeners();
  }

  /// Seek to a position. For live streams this re-syncs to the
  /// configured live delay behind the current edge.
  Future<void> seekTo(Duration position) async {
    await _mkController?.seekTo(position);
    await _legacyPlayer?.controller?.seekTo(position);
    notifyListeners();
  }

  /// Callbacks.
  VoidCallback? onProgramEnded;
  VoidCallback? onAccessDenied;
  Future<String?> Function()? onRefreshUrl;
  VoidCallback? onSettingsChanged;

  // Settings re-init
  Timer? _settingsReinitTimer;
  PlayerSettings? _lastAppliedSettings;

  BroadcastPlayer() {
    PlayerSettingsService.instance.notifier.addListener(_onSettingsChanged);
  }

  void _onSettingsChanged() {
    if (_disposed) return;
    final settings = PlayerSettingsService.instance.current;
    if (_lastAppliedSettings == settings) return;
    if (_adPaused || _baseVideoUrl == null) {
      _lastAppliedSettings = settings;
      return;
    }
    // Debounce rapid changes (e.g. user tapping through quality options).
    _settingsReinitTimer?.cancel();
    _settingsReinitTimer = Timer(const Duration(milliseconds: 800), () async {
      if (_disposed) return;
      onSettingsChanged?.call();
      await _reinitializeFromSettings();
    });
  }

  Future<void> _reinitializeFromSettings() async {
    final settings = PlayerSettingsService.instance.current;
    _lastAppliedSettings = settings;

    TelemetryService.marker(
      'broadcast_player_reinit_for_settings',
      parameters: settings.toMap(),
    );

    // For scheduled/looped programs, resume at the current playback position.
    // For continuous live streams, the player naturally joins the live edge.
    final resumePosition = _hasProgramWindow
        ? value.position.inSeconds.clamp(0, videoDuration)
        : 0;

    await initialize(
      videoUrl: _baseVideoUrl!,
      startTime: programStartTime,
      endTime: programEndTime,
      duration: videoDuration,
      positionSec: resumePosition,
      loop: isLoop,
      renditions: availableRenditions,
      quality: selectedQuality,
      liveDelaySeconds: settings.liveDelaySeconds,
      userHlsBps: settings.quality.bps,
      useMediaKit: settings.useMediaKit,
    );
  }

  /// Initialize the player with a video URL and seek to the correct live position.
  ///
  /// Settings are read from [PlayerSettingsService] unless explicitly provided.
  Future<void> initialize({
    required String videoUrl,
    required int startTime,
    required int endTime,
    required int duration,
    required int positionSec,
    required bool loop,
    List<int> renditions = const [],
    int? quality,
    int? liveDelaySeconds,
    int? userHlsBps,
    bool? useMediaKit,
  }) async {
    programStartTime = startTime;
    programEndTime = endTime;
    videoDuration = duration;
    isLoop = loop;
    availableRenditions = List<int>.unmodifiable(
      renditions.toSet().toList()..sort(),
    );
    selectedQuality = quality;
    _baseVideoUrl = videoUrl;

    final effectiveUrl = _withQuality(videoUrl, quality);
    _currentVideoUrl = effectiveUrl;

    final lowerUrl = effectiveUrl.toLowerCase();
    final adaptiveStream =
        lowerUrl.contains('.m3u8') ||
        lowerUrl.contains('.mpd') ||
        lowerUrl.contains('application/vnd.apple.mpegurl');
    _isContinuousStream =
        adaptiveStream && !(startTime > 0 && endTime > startTime);

    // Load persisted user settings.
    await PlayerSettingsService.instance.initialize();
    final settings = PlayerSettingsService.instance.current;
    _liveDelaySeconds = liveDelaySeconds ?? settings.liveDelaySeconds;
    _userHlsBps = userHlsBps ?? settings.quality.bps;
    final shouldUseMediaKit = useMediaKit ?? settings.useMediaKit;

    // Remember these settings so a later PlayerSettingsService update can
    // decide whether a re-init is needed.
    _lastAppliedSettings = settings;

    TelemetryService.marker(
      'broadcast_player_initialize',
      parameters: {
        'engine': shouldUseMediaKit ? 'media_kit' : 'legacy',
        'live_delay_seconds': _liveDelaySeconds,
        'quality_bps': _userHlsBps,
        'has_renditions': availableRenditions.isNotEmpty,
      },
    );

    await _disposeEngines();

    if (shouldUseMediaKit) {
      _mkInitAttempts = 0;
      await _initMediaKit(
        effectiveUrl: effectiveUrl,
        positionSec: positionSec,
      );
    } else {
      await _initLegacy(
        effectiveUrl: effectiveUrl,
        positionSec: positionSec,
      );
    }
  }

  String _withQuality(String videoUrl, int? quality) {
    if (quality == null || !videoUrl.toLowerCase().contains('.m3u8')) {
      return videoUrl;
    }
    final uri = Uri.parse(videoUrl);
    return uri
        .replace(
          queryParameters: {...uri.queryParameters, 'quality': '$quality'},
        )
        .toString();
  }

  Future<Map<String, String>> _buildNetworkHeaders(String videoUrl) async {
    final uri = Uri.tryParse(videoUrl);
    final appUri = Uri.tryParse(AppConfig.baseUrl);
    if (uri == null || appUri == null) {
      return const <String, String>{};
    }

    final isSameBackend =
        uri.host.toLowerCase() == appUri.host.toLowerCase() &&
        (uri.port == appUri.port || uri.port == 0 || appUri.port == 0);
    if (!isSameBackend) {
      return const <String, String>{};
    }

    final token = await AuthStorage.getToken();
    if (token == null || token.isEmpty) {
      return const <String, String>{};
    }
    return <String, String>{'Authorization': 'Bearer $token'};
  }

  /// Build the video surface for the current engine.
  ///
  /// The caller should normally wrap this in an [AspectRatio] using
  /// [value.aspectRatio].
  Widget buildVideo({BoxFit fit = BoxFit.contain}) {
    if (_mkController?.videoController != null) {
      return Video(
        controller: _mkController!.videoController!,
        fit: fit,
        controls: NoVideoControls,
      );
    }

    if (_legacyPlayer?.controller != null) {
      return VideoPlayer(_legacyPlayer!.controller!);
    }

    return Container(color: Colors.black);
  }

  // ─── Engine initialization ───

  Future<void> _initMediaKit({
    required String effectiveUrl,
    required int positionSec,
  }) async {
    _mkInitAttempts++;
    isRecovering = _mkInitAttempts > 1;
    notifyListeners();

    try {
      final headers = await _buildNetworkHeaders(effectiveUrl);
      if (_disposed) return;

      final mk = AfrovisionVideoController.networkUrl(
        Uri.parse(effectiveUrl),
        httpHeaders: headers,
      );
      _mkController = mk;

      // On program-end (non-loop), notify the caller to refresh now-playing.
      if (!isLoop && _hasProgramWindow) {
        mk.onCompleted = () {
          if (!_disposed) onProgramEnded?.call();
        };
      }

      mk.addListener(_onMkStateChanged);

      // For scheduled/looped programs, start at the exact server-tracked
      // position. Subtracting the live delay here caused short loops and early
      // joins to clamp to 0 and restart from the beginning.
      final startMs = _hasProgramWindow
          ? (positionSec * 1000).clamp(0, videoDuration * 1000)
          : 0;

      await mk.initialize(
        isLive: true,
        startPosition: Duration(milliseconds: startMs),
        userHlsBps: _userHlsBps,
      );
      if (_disposed) return;

      await mk.setLooping(isLoop);
      await mk.play();
      // Volume is controlled at the device level; leave player gain at max.
      await mk.setVolume(1.0);

      _mkInitAttempts = 0;
      isInitialized = true;
      hasError = false;
      isRecovering = false;
      errorMessage = null;
      if (!_disposed) {
        TelemetryService.marker(
          'broadcast_player_media_kit_ready',
          parameters: {
            'url': _currentVideoUrl,
            'quality_bps': _userHlsBps,
            'live_delay_seconds': _liveDelaySeconds,
          },
        );
        notifyListeners();
      }
    } catch (e) {
      if (_disposed) return;

      if (_mkInitAttempts < _maxMkAttempts && onRefreshUrl != null) {
        try {
          final freshUrl = await onRefreshUrl!();
          if (freshUrl != null && freshUrl.isNotEmpty) {
            _baseVideoUrl = freshUrl;
            final refreshed = _withQuality(freshUrl, selectedQuality);
            _currentVideoUrl = refreshed;
            await _disposeMk();
            await _initMediaKit(
              effectiveUrl: refreshed,
              positionSec: positionSec,
            );
            return;
          }
        } catch (_) {
          // Fall through to fallback.
        }
      }

      // media_kit failed twice — fall back to the legacy video_player engine
      // for this stream only.
      TelemetryService.marker(
        'broadcast_player_media_kit_fallback',
        parameters: {
          'attempts': _mkInitAttempts,
          'error': sanitizeError(e),
        },
      );
      await _disposeMk();
      await _initLegacy(
        effectiveUrl: _currentVideoUrl ?? effectiveUrl,
        positionSec: positionSec,
      );
    }
  }

  Future<void> _initLegacy({
    required String effectiveUrl,
    required int positionSec,
  }) async {
    isRecovering = false;
    notifyListeners();

    final legacy = LegacyBroadcastPlayer();
    _legacyPlayer = legacy;

    legacy.onProgramEnded = onProgramEnded;
    legacy.onAccessDenied = onAccessDenied;
    legacy.onRefreshUrl = onRefreshUrl;
    legacy.addListener(_onLegacyStateChanged);

    await legacy.initialize(
      videoUrl: effectiveUrl,
      startTime: programStartTime,
      endTime: programEndTime,
      duration: videoDuration,
      positionSec: positionSec,
      loop: isLoop,
      renditions: availableRenditions,
      quality: selectedQuality,
      liveDelaySeconds: _liveDelaySeconds,
    );
    // Volume is controlled at the device level; leave player gain at max.
    legacy.setVolume(1.0);

    TelemetryService.marker(
      'broadcast_player_legacy_ready',
      parameters: {
        'url': _currentVideoUrl,
        'quality_bps': _userHlsBps,
        'live_delay_seconds': _liveDelaySeconds,
      },
    );
  }

  // ─── State relay ───

  void _onMkStateChanged() {
    if (_disposed || _mkController == null) return;

    final v = _mkController!.value;

    isInitialized = _mkController!.isInitialized;
    isBuffering = v.isBuffering;
    hasError = v.hasError;
    errorMessage = v.errorMessage;

    if (v.hasError && !isRecovering) {
      errorMessage = sanitizeError(v.errorMessage);
    }

    if (isInitialized && v.isCompleted && !isLoop && _hasProgramWindow) {
      onProgramEnded?.call();
      return;
    }

    if (!_adPaused && isInitialized && !v.isPlaying && !isBuffering) {
      _mkController?.play();
    }

    notifyListeners();
  }

  void _onLegacyStateChanged() {
    if (_disposed || _legacyPlayer == null) return;

    isInitialized = _legacyPlayer!.isInitialized;
    isBuffering = _legacyPlayer!.isBuffering;
    hasError = _legacyPlayer!.hasError;
    isRecovering = _legacyPlayer!.isRecovering;
    errorMessage = _legacyPlayer!.errorMessage;

    notifyListeners();
  }

  // ─── Sync / lifecycle ───

  /// Call when app goes to background / foreground.
  void setAppActive(bool active) {
    _legacyPlayer?.setAppActive(active);
  }

  /// Call when app resumes from background.
  void onAppResumed() {
    if (_disposed) return;

    if (_mkController != null && _mkController!.isInitialized) {
      _syncOnResumeForMk();
      _mkController!.play();
    } else {
      _legacyPlayer?.onAppResumed();
    }
  }

  Future<void> _syncOnResumeForMk() async {
    if (!_hasProgramWindow) return;

    final correctedTime = BroadcastService.correctedNow;
    if (correctedTime >= programEndTime) {
      onProgramEnded?.call();
      return;
    }

    final liveDelayMs = _liveDelaySeconds * 1000;
    final expectedMs = correctedTime - programStartTime - liveDelayMs;
    if (expectedMs > 0) {
      await _mkController?.seekTo(Duration(milliseconds: expectedMs));
    }
  }

  // ─── Quality / program-end ───

  Future<void> setQuality(int? quality) async {
    selectedQuality = quality;
    TelemetryService.marker(
      'broadcast_player_set_quality',
      parameters: {
        'quality': quality,
        'engine': _mkController != null ? 'media_kit' : 'legacy',
      },
    );

    if (_mkController != null) {
      final baseUrl = _baseVideoUrl;
      if (baseUrl == null || !baseUrl.toLowerCase().contains('.m3u8')) return;
      if (quality != null && !availableRenditions.contains(quality)) return;

      final position = _mkController!.value.position.inSeconds;
      final effectiveUrl = _withQuality(baseUrl, quality);
      await _initMediaKit(
        effectiveUrl: effectiveUrl,
        positionSec: position,
      );
      return;
    }

    await _legacyPlayer?.setQuality(quality);
  }

  // ─── Ad break controls ───

  void pauseForAd() {
    _adPaused = true;
    _mkController?.pause();
    _legacyPlayer?.pauseForAd();
    notifyListeners();
  }

  void resumeFromAd() {
    _adPaused = false;

    if (_mkController != null && _mkController!.isInitialized) {
      _syncOnResumeForMk().then((_) => _mkController?.play());
    } else {
      _legacyPlayer?.resumeFromAd();
    }
    notifyListeners();
  }

  void setVolume(double volume) {
    _volume = volume.clamp(0.0, 1.0);
    _mkController?.setVolume(_volume);
    _legacyPlayer?.setVolume(_volume);
    notifyListeners();
  }

  double get volume => _mkController != null
      ? _volume
      : _legacyPlayer?.volume ?? 1.0;

  bool get isAdPaused => _adPaused;

  // ─── Error Sanitizer ───

  static String sanitizeError(dynamic error) {
    return LegacyBroadcastPlayer.sanitizeError(error);
  }

  // ─── Cleanup ───

  Future<void> _disposeMk() async {
    if (_mkController != null) {
      _mkController!.removeListener(_onMkStateChanged);
      await _mkController!.disposeAsync();
      _mkController = null;
    }
  }

  Future<void> _disposeLegacy() async {
    if (_legacyPlayer != null) {
      _legacyPlayer!.removeListener(_onLegacyStateChanged);
      await _legacyPlayer!.disposeAsync();
      _legacyPlayer = null;
    }
  }

  Future<void> _disposeEngines() async {
    await _disposeMk();
    await _disposeLegacy();

    isInitialized = false;
    isBuffering = false;
    hasError = false;
    isRecovering = false;
    errorMessage = null;
    _mkInitAttempts = 0;
  }

  void _preDispose() {
    _disposed = true;
    _settingsReinitTimer?.cancel();
    PlayerSettingsService.instance.notifier.removeListener(_onSettingsChanged);
  }

  Future<void> disposeAsync() async {
    _preDispose();
    await _disposeEngines();
    super.dispose();
  }

  @override
  void dispose() {
    _preDispose();
    _disposeEngines();
    super.dispose();
  }
}
