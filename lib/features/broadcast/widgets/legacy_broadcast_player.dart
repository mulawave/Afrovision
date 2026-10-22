import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../core/config/app_config.dart';
import '../../../core/media/hls_variant_cap.dart';
import '../../../core/storage/auth_storage.dart';
import '../services/broadcast_service.dart';

/// Legacy `video_player` broadcast player implementation.
///
/// Kept as a fallback engine when `media_kit` fails or the user explicitly
/// opts out in Watch Settings. This is the original `BroadcastPlayer` logic,
/// with added support for a configurable live delay.
class LegacyBroadcastPlayer extends ChangeNotifier {
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
  int _liveDelayMs = 0;
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
    int liveDelaySeconds = 0,
    VideoFormat? formatHint,
    int? capBps,
  }) async {
    programStartTime = startTime;
    programEndTime = endTime;
    videoDuration = duration;
    isLoop = loop;
    _liveDelayMs = liveDelaySeconds * 1000;
    availableRenditions = List<int>.unmodifiable(
      renditions.toSet().toList()..sort(),
    );
    selectedQuality = quality;
    _baseVideoUrl = videoUrl;
    final effectiveUrl = _withQuality(videoUrl, quality);
    final lowerUrl = effectiveUrl.toLowerCase();
    final adaptiveStream =
        formatHint == VideoFormat.hls ||
        formatHint == VideoFormat.dash ||
        lowerUrl.contains('.m3u8') ||
        lowerUrl.contains('.mpd') ||
        lowerUrl.contains('application/vnd.apple.mpegurl');
    _isContinuousStream =
        adaptiveStream && !(startTime > 0 && endTime > startTime);
    final hasProgramWindow =
        !_isContinuousStream && startTime > 0 && endTime > startTime;
    _currentVideoUrl = effectiveUrl;

    _formatHint = formatHint;
    _capBps = capBps;

    await _disposeController();
    if (_disposed) return;

    final ctrl = await _createController(effectiveUrl);
    // Disposed while the token/playlist lookup was pending: a controller
    // created now would be a decoder that nothing ever disposes.
    if (ctrl == null) return;
    _controller = ctrl;

    ctrl.addListener(_onPlayerStateChange);

    _initInFlight = true;
    try {
      await ctrl.initialize().timeout(const Duration(seconds: 30));
      _initInFlight = false;
      if (_disposed) return;

      if (isLoop) {
        await ctrl.setLooping(true);
      }

      // For scheduled/looped programs, use the exact server-tracked position.
      // The live delay is only meaningful for continuous live HLS, which the
      // legacy controller handles by starting at the live edge on its own.
      final startMs = hasProgramWindow
          ? (positionSec * 1000).clamp(0, duration * 1000)
          : positionSec * 1000 - _liveDelayMs;
      if (startMs >= 0 && startMs < duration * 1000) {
        await ctrl.seekTo(Duration(milliseconds: startMs));
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
      _initInFlight = false;
      if (_disposed) return;
      // The trimmed local playlist didn't open on this device; play the
      // original stream (uncapped, still adaptive) rather than failing.
      if (_usingCappedPlaylist && !_cappedPlaylistFailed) {
        _cappedPlaylistFailed = true;
        await initialize(
          videoUrl: videoUrl,
          startTime: startTime,
          endTime: endTime,
          duration: duration,
          positionSec: positionSec,
          loop: loop,
          renditions: renditions,
          quality: quality,
          liveDelaySeconds: liveDelaySeconds,
          formatHint: formatHint,
          capBps: capBps,
        );
        return;
      }
      hasError = true;
      errorMessage = sanitizeError(e);
      final description = e.toString();
      if (description.contains('403')) {
        isRecovering = false;
        notifyListeners();
        onAccessDenied?.call();
        return;
      }
      isRecovering = true;
      notifyListeners();
      unawaited(_retryPlayback());
    }
  }

  // While initialize() runs it handles its own failure (capped-playlist
  // fallback, then the retry loop); the listener must not start a second one.
  bool _initInFlight = false;

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
      liveDelaySeconds: _liveDelayMs ~/ 1000,
      formatHint: _formatHint,
      capBps: _capBps,
    );
  }

  VideoFormat? _formatHint;
  int? _capBps;
  bool _usingCappedPlaylist = false;
  bool _cappedPlaylistFailed = false;

  /// ExoPlayer adapts quality to the connection on its own; for HLS the
  /// user's bitrate cap is applied by trimming the master playlist.
  Future<VideoPlayerController?> _createController(String url) async {
    final headers = await _buildNetworkHeaders(url);
    if (_disposed) return null;

    final isHls =
        _formatHint == VideoFormat.hls || url.toLowerCase().contains('.m3u8');
    final cap = _capBps;
    _usingCappedPlaylist = false;
    if (isHls && cap != null && !_cappedPlaylistFailed) {
      final cappedPath = await HlsVariantCap.writeCapped(
        url,
        capBps: cap,
        headers: headers,
      );
      if (_disposed) return null;
      if (cappedPath != null) {
        _usingCappedPlaylist = true;
        return VideoPlayerController.file(File(cappedPath));
      }
    }

    return VideoPlayerController.networkUrl(
      Uri.parse(url),
      httpHeaders: headers,
      formatHint: _formatHint,
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

      if (_syncTick % 60 == 0) {
        await BroadcastService.syncServerOffset();
      }

      if (_holdPaused) return;

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

      final correctedTime = BroadcastService.correctedNow;

      // Program end check
      if (correctedTime >= programEndTime) {
        _syncTimer?.cancel();
        await _controller?.pause();
        onProgramEnded?.call();
        return;
      }

      // Expected position respects live delay.
      final expectedMs = correctedTime - programStartTime - _liveDelayMs;
      final actualMs = _controller!.value.position.inMilliseconds;
      final behindMs = expectedMs - actualMs;

      // Falling behind on a slow connection is fine; seeking forward to catch
      // up throws the buffer away and stalls again, which was a hang loop.
      // Only re-sync when far behind, or when ahead of the broadcast.
      if (behindMs > 60000 || behindMs < -8000) {
        _isSeeking = true;
        if (expectedMs > 0) {
          await _controller!.seekTo(Duration(milliseconds: expectedMs));
        }
        _isSeeking = false;
      }

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

    if (wasBuffering &&
        !isBuffering &&
        !value.isPlaying &&
        !_adPaused &&
        !_holdPaused) {
      _controller!.play();
    }

    if (value.hasError && !hasError && !_initInFlight) {
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

  void setAppActive(bool active) {
    _isAppActive = active;
  }

  bool _holdPaused = false;

  /// While held, the sync timer and buffer listener don't auto-resume.
  void setHoldPaused(bool held) {
    _holdPaused = held;
  }

  void onAppResumed() {
    if (_controller == null || !_controller!.value.isInitialized) return;

    if (!isLoop && _hasProgramWindow) {
      final correctedTime = BroadcastService.correctedNow;
      if (correctedTime >= programEndTime) {
        onProgramEnded?.call();
        return;
      }
      final expectedMs = correctedTime - programStartTime - _liveDelayMs;
      if (expectedMs > 0) {
        _controller!.seekTo(Duration(milliseconds: expectedMs));
      }
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
            final replacement = await _createController(url);
            if (replacement == null) return;
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
            final expectedMs = correctedTime - programStartTime - _liveDelayMs;
            if (expectedMs > 0) {
              await _controller!.seekTo(Duration(milliseconds: expectedMs));
            }
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

  void pauseForAd() {
    _adPaused = true;
    _syncTimer?.cancel();
    _controller?.pause();
    notifyListeners();
  }

  void resumeFromAd() {
    _adPaused = false;
    if (_controller != null && _controller!.value.isInitialized) {
      if (!isLoop && _hasProgramWindow) {
        final correctedTime = BroadcastService.correctedNow;
        if (correctedTime < programEndTime) {
          final expectedMs = correctedTime - programStartTime - _liveDelayMs;
          if (expectedMs > 0) {
            _controller!.seekTo(Duration(milliseconds: expectedMs));
          }
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

  /// Translates raw platform/network exceptions into user-friendly messages.
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
