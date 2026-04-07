import 'dart:async';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
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
  String? errorMessage;

  // Sync
  int _syncTick = 0;
  bool _disposed = false;
  bool _isSeeking = false;

  VideoPlayerController? get controller => _controller;

  /// Callback when current program ends (non-loop only).
  VoidCallback? onProgramEnded;

  /// Initialize the player with a video URL and seek to the correct live position.
  Future<void> initialize({
    required String videoUrl,
    required int startTime,
    required int endTime,
    required int duration,
    required int positionSec,
    required bool loop,
  }) async {
    programStartTime = startTime;
    programEndTime = endTime;
    videoDuration = duration;
    isLoop = loop;

    await _disposeController();

    final ctrl = VideoPlayerController.networkUrl(Uri.parse(videoUrl));
    _controller = ctrl;

    ctrl.addListener(_onPlayerStateChange);

    try {
      await ctrl.initialize();
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
      errorMessage = null;
      notifyListeners();

      _startSyncTimer();
    } catch (e) {
      if (_disposed) return;
      hasError = true;
      errorMessage = 'Failed to load video: $e';
      notifyListeners();
    }
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
    if (_disposed || _controller == null || !_controller!.value.isInitialized) {
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
    if (wasBuffering && !isBuffering && !value.isPlaying) {
      _controller!.play();
    }

    // Network/error recovery
    if (value.hasError && !hasError) {
      hasError = true;
      errorMessage = value.errorDescription ?? 'Playback error';
      notifyListeners();
      _retryPlayback();
    }

    notifyListeners();
  }

  // ─── Recovery ───

  /// Call when app resumes from background.
  void onAppResumed() {
    if (_controller == null || !_controller!.value.isInitialized) return;

    // For live mode, resync to current position
    if (!isLoop) {
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
    if (_disposed || _controller == null) return;

    await Future.delayed(const Duration(seconds: 3));
    if (_disposed) return;

    try {
      await _controller!.initialize();
      if (isLoop) {
        await _controller!.setLooping(true);
      }
      // Seek to approximate current position for live mode
      if (!isLoop) {
        final correctedTime = BroadcastService.correctedNow;
        final expectedMs = correctedTime - programStartTime;
        await _controller!.seekTo(Duration(milliseconds: expectedMs));
      }
      await _controller!.play();
      hasError = false;
      errorMessage = null;
      notifyListeners();
    } catch (_) {
      // Will retry via listener on next error cycle
    }
  }

  // ─── Controls ───

  void setVolume(double volume) {
    _controller?.setVolume(volume);
  }

  double get volume => _controller?.value.volume ?? 1.0;

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
    _isSeeking = false;
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
