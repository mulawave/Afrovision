import 'dart:async';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../core/config/app_config.dart';
import '../../../core/storage/auth_storage.dart';
import '../services/broadcast_service.dart';

/// Centralized broadcast player wrapper.
/// Handles: init, sync, lifecycle resume, buffer recovery, network retry,
/// drift protection, and program-end detection.
///
/// Sync philosophy: minimize seeks to avoid re-buffering.
/// - Loop mode: let VideoPlayer handle native looping, only seek once on init.
/// - Live mode: gentle drift correction — only seek on large drift (>8s),
///   check program end, and recalibrate server offset periodically.
class BroadcastPlayer extends ChangeNotifier {
  VideoPlayerController? _controller;
  Timer? _syncTimer;

  // Program metadata
  int programStartTime = 0;
  int programEndTime = 0;
  int videoDuration = 0;
  bool isLoop = false;

  // State
  bool isInitialized = false;
  bool isBuffering = false;
  bool hasError = false;
  bool isRecovering = false;
  String? errorMessage;
  List<int> availableRenditions = const [];
  int? selectedQuality;

  // Sync
  int _syncTick = 0;
  bool _disposed = false;
  bool _isSeeking = false;
  bool _isAppActive = true;
  bool _isContinuousStream = false;
  String? _currentVideoUrl;
  String? _baseVideoUrl;
  bool _recoveringInFlight = false;
  int _retryCount = 0;
  static const int _maxRetries = 4;

  bool get _hasProgramWindow =>
      !_isContinuousStream &&
      programStartTime > 0 &&
      programEndTime > programStartTime;

  VideoPlayerController? get controller => _controller;

  /// Callback when current program ends (non-loop only).
  VoidCallback? onProgramEnded;
  VoidCallback? onAccessDenied;

  /// Callback to request a fresh playback URL from the parent.
  /// Returns a new URL string, or null if refresh is not available.
  Future<String?> Function()? onRefreshUrl;

  /// Initialize the player with a video URL and seek to the correct live position.
  Future<void> initialize({
    required String videoUrl,
    required int startTime,
    required int endTime,
    required int duration,
    required int positionSec,
    required bool loop,
    List<int> renditions = const [],
    int? quality,
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
    final lowerUrl = effectiveUrl.toLowerCase();
    final adaptiveStream =
        lowerUrl.contains('.m3u8') ||
        lowerUrl.contains('.mpd') ||
        lowerUrl.contains('application/vnd.apple.mpegurl');
    _isContinuousStream =
        adaptiveStream && !(startTime > 0 && endTime > startTime);
    _currentVideoUrl = effectiveUrl;

    await _disposeController();

    final httpHeaders = await _buildNetworkHeaders(effectiveUrl);
    final ctrl = VideoPlayerController.networkUrl(
      Uri.parse(effectiveUrl),
      httpHeaders: httpHeaders,
    );
    _controller = ctrl;

    ctrl.addListener(_onPlayerStateChange);

    try {
      await ctrl.initialize().timeout(const Duration(seconds: 30));
      if (_disposed) return;

      // Loop mode: let VideoPlayer handle native looping
      if (isLoop) {
        await ctrl.setLooping(true);
      }

      if (positionSec > 0 && positionSec < duration) {
        await ctrl.seekTo(Duration(seconds: positionSec));
      }
      await ctrl.play();

      isInitialized = true;
      hasError = false;
      isRecovering = false;
      errorMessage = null;
      _retryCount = 0;
      notifyListeners();

      _startSyncTimer();
    } catch (e) {
      if (_disposed) return;
      hasError = true;
      errorMessage = sanitizeError(e);
      notifyListeners();
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

  Future<void> setQuality(int? quality) async {
    final baseUrl = _baseVideoUrl;
    if (baseUrl == null || !baseUrl.toLowerCase().contains('.m3u8')) return;
    if (quality != null && !availableRenditions.contains(quality)) return;
    if (selectedQuality == quality) return;

    final position = _controller?.value.position.inSeconds ?? 0;
    await initialize(
      videoUrl: baseUrl,
      startTime: programStartTime,
      endTime: programEndTime,
      duration: videoDuration,
      positionSec: position,
      loop: isLoop,
      renditions: availableRenditions,
      quality: quality,
    );
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

  // ─── Sync Engine ───
  // Live mode: 5s interval, gentle drift correction
  // Loop mode: no sync needed — native looping handles it

  void _startSyncTimer() {
    _syncTimer?.cancel();
    _syncTick = 0;
    _syncTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _onSyncTick(),
    );
  }

  Future<void> _onSyncTick() async {
    if (_disposed ||
        !_isAppActive ||
        _controller == null ||
        !_controller!.value.isInitialized) {
      return;
    }
    if (_isSeeking || isBuffering) return;

    try {
      _syncTick++;

      // Recalibrate server offset every ~5 minutes (60 ticks × 5s)
      if (_syncTick % 60 == 0) {
        await BroadcastService.syncServerOffset();
      }

      // Loop mode: no sync needed — native looping handles playback.
      // Just ensure the video is still playing.
      if (isLoop) {
        if (!_controller!.value.isPlaying && !isBuffering) {
          _controller!.play();
        }
        return;
      }

      if (!_hasProgramWindow) {
        if (!_controller!.value.isPlaying && !isBuffering) {
          _controller!.play();
        }
        return;
      }

      // ── Live (non-loop) mode ──

      final correctedTime = BroadcastService.correctedNow;

      // Program end check
      if (correctedTime >= programEndTime) {
        _syncTimer?.cancel();
        await _controller?.pause();
        onProgramEnded?.call();
        return;
      }

      // Compute expected position
      final expectedMs = correctedTime - programStartTime;
      final actualMs = _controller!.value.position.inMilliseconds;
      final driftMs = (expectedMs - actualMs).abs();

      // Only seek on significant drift (>8s) to avoid constant re-buffering.
      // Small drifts are acceptable for sim-live content.
      if (driftMs > 8000) {
        _isSeeking = true;
        await _controller!.seekTo(Duration(milliseconds: expectedMs));
        _isSeeking = false;
      }

      // Ensure playback is running
      if (!_controller!.value.isPlaying && !isBuffering) {
        _controller!.play();
      }
    } catch (_) {
      _isSeeking = false;
    }
  }

  // ─── Player State Listener ───

  void _onPlayerStateChange() {
    if (_disposed || _controller == null) return;

    final value = _controller!.value;
    final wasBuffering = isBuffering;
    isBuffering = value.isBuffering;

    // Buffer recovery: resume playback when buffering ends (no re-seek)
    if (wasBuffering && !isBuffering && !value.isPlaying && !_adPaused) {
      _controller!.play();
    }

    // Network/error recovery
    if (value.hasError && !hasError) {
      hasError = true;
      final description = value.errorDescription ?? '';
      if (description.contains('403')) {
        errorMessage = 'Stream access denied. Please sign in again.';
        isRecovering = false;
        notifyListeners();
        onAccessDenied?.call();
        return;
      }
      errorMessage = sanitizeError(description);
      isRecovering = true;
      _retryCount = 0;
      notifyListeners();
      unawaited(_retryPlayback());
    }

    notifyListeners();
  }

  // ─── Recovery ───

  /// Call when app goes to background / foreground.
  void setAppActive(bool active) {
    _isAppActive = active;
  }

  /// Call when app resumes from background.
  void onAppResumed() {
    if (_controller == null || !_controller!.value.isInitialized) return;

    // For live mode, resync to current position
    if (!isLoop && _hasProgramWindow) {
      final correctedTime = BroadcastService.correctedNow;
      if (correctedTime >= programEndTime) {
        onProgramEnded?.call();
        return;
      }
      final expectedMs = correctedTime - programStartTime;
      _controller!.seekTo(Duration(milliseconds: expectedMs));
    }

    if (!_controller!.value.isPlaying) {
      _controller!.play();
    }
  }

  Future<void> _retryPlayback() async {
    if (_disposed || _controller == null || _recoveringInFlight) return;

    _recoveringInFlight = true;
    try {
      for (
        _retryCount = 1;
        _retryCount <= _maxRetries && !_disposed;
        _retryCount++
      ) {
        await Future.delayed(Duration(seconds: 3 * _retryCount));
        if (_disposed) return;

        try {
          String? url = _currentVideoUrl;

          // On the first retry, attempt to get a fresh signed URL —
          // the current one may have expired (GCS signed URLs are time-limited).
          if (_retryCount == 1 && onRefreshUrl != null) {
            try {
              final freshUrl = await onRefreshUrl!();
              if (freshUrl != null && freshUrl.isNotEmpty) {
                _baseVideoUrl = freshUrl;
                url = _withQuality(freshUrl, selectedQuality);
                _currentVideoUrl = url;
              }
            } catch (_) {
              // Fall back to existing URL if refresh fails
            }
          }

          if (url != null && url.isNotEmpty) {
            final headers = await _buildNetworkHeaders(url);
            if (_disposed) return;

            final replacement = VideoPlayerController.networkUrl(
              Uri.parse(url),
              httpHeaders: headers,
            );
            replacement.addListener(_onPlayerStateChange);
            final previous = _controller;
            _controller = replacement;
            previous?.removeListener(_onPlayerStateChange);
            await previous?.dispose();
          }

          await _controller!.initialize();
          if (_disposed) return;

          if (isLoop) {
            await _controller!.setLooping(true);
          }
          if (!isLoop && _hasProgramWindow) {
            final correctedTime = BroadcastService.correctedNow;
            final expectedMs = correctedTime - programStartTime;
            await _controller!.seekTo(Duration(milliseconds: expectedMs));
          }
          await _controller!.play();

          isInitialized = true;
          hasError = false;
          isRecovering = false;
          errorMessage = null;
          _retryCount = 0;
          _startSyncTimer();
          notifyListeners();
          return;
        } catch (_) {
          if (_disposed) return;
        }
      }
    } finally {
      _recoveringInFlight = false;
      if (!_disposed && hasError) {
        isRecovering = false;
        notifyListeners();
      }
    }
  }

  // ─── Controls ───

  bool _adPaused = false;
  bool get isAdPaused => _adPaused;

  /// Pause playback for an ad break. Stops sync timer.
  void pauseForAd() {
    _adPaused = true;
    _syncTimer?.cancel();
    _controller?.pause();
    notifyListeners();
  }

  /// Resume playback after an ad break. Restarts sync.
  void resumeFromAd() {
    _adPaused = false;
    if (_controller != null && _controller!.value.isInitialized) {
      // Resync position for live mode
      if (!isLoop && _hasProgramWindow) {
        final correctedTime = BroadcastService.correctedNow;
        if (correctedTime < programEndTime) {
          final expectedMs = correctedTime - programStartTime;
          _controller!.seekTo(Duration(milliseconds: expectedMs));
        }
      }
      _controller!.play();
      _startSyncTimer();
    }
    notifyListeners();
  }

  void setVolume(double volume) {
    _controller?.setVolume(volume);
  }

  double get volume => _controller?.value.volume ?? 1.0;

  // ─── Error Sanitizer ───

  /// Translates raw platform/network exceptions into user-friendly messages.
  /// Public so callers outside this class can sanitize errors consistently.
  static String sanitizeError(dynamic error) {
    final raw = error.toString().toLowerCase();

    if (raw.contains('403') || raw.contains('forbidden')) {
      return 'Stream access denied. Please sign in again.';
    }
    if (raw.contains('404') || raw.contains('not found')) {
      return 'This stream is currently unavailable.';
    }
    if (raw.contains('401') || raw.contains('unauthorized')) {
      return 'Your session has expired. Please sign in again.';
    }
    if (raw.contains('timeout') || raw.contains('timed out')) {
      return 'Connection timed out. Check your signal and retry.';
    }
    if (raw.contains('network') ||
        raw.contains('no internet') ||
        raw.contains('socketexception') ||
        raw.contains('connection refused') ||
        raw.contains('unreachable')) {
      return 'No signal. Please check your connection and retry.';
    }
    // Catches ExoPlayer / Media3 / VideoPlayer platform errors
    if (raw.contains('exoplayer') ||
        raw.contains('exoplaybackexception') ||
        raw.contains('media3') ||
        raw.contains('androidx') ||
        raw.contains('source error') ||
        raw.contains('videoerror') ||
        raw.contains('platformexception')) {
      return 'Unable to load this stream. The source may be temporarily unavailable.';
    }
    if (raw.contains('format') ||
        raw.contains('codec') ||
        raw.contains('unsupported')) {
      return 'This stream format is not supported on your device.';
    }
    if (raw.contains('drm') || raw.contains('decrypt')) {
      return 'This content is protected and cannot be played here.';
    }
    // Generic fallback — never expose raw stack traces
    return 'Something went wrong. Please retry or check back later.';
  }

  // ─── Cleanup ───

  Future<void> _disposeController() async {
    _syncTimer?.cancel();
    if (_controller != null) {
      _controller!.removeListener(_onPlayerStateChange);
      await _controller!.dispose();
      _controller = null;
    }
    isInitialized = false;
    isBuffering = false;
    hasError = false;
    isRecovering = false;
    errorMessage = null;
    _isSeeking = false;
    _isContinuousStream = false;
    _recoveringInFlight = false;
    _retryCount = 0;
  }

  /// Async variant used by the channel player so that the old controller is
  /// fully released before the next channel starts, preventing audio conflict.
  Future<void> disposeAsync() async {
    _disposed = true;
    _syncTimer?.cancel();
    await _disposeController();
    super.dispose();
  }

  @override
  void dispose() {
    _disposed = true;
    _syncTimer?.cancel();
    if (_controller != null) {
      _controller!.removeListener(_onPlayerStateChange);
      _controller!.dispose();
      _controller = null;
    }
    super.dispose();
  }
}
