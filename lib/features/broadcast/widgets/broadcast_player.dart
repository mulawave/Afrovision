import 'dart:async';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../services/broadcast_service.dart';

/// Centralized broadcast player wrapper.
/// Handles: init, sync, lifecycle resume, buffer recovery, network retry,
/// drift protection, and program-end detection.
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

      if (positionSec > 0) {
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

  // ─── Sync Engine (3s interval, millisecond precision) ───

  void _startSyncTimer() {
    _syncTimer?.cancel();
    _syncTick = 0;
    _syncTimer =
        Timer.periodic(const Duration(seconds: 3), (_) => _onSyncTick());
  }

  Future<void> _onSyncTick() async {
    if (_disposed || _controller == null || !_controller!.value.isInitialized) {
      return;
    }

    try {
      _syncTick++;

      // Recalibrate server offset every ~3 minutes (60 ticks × 3s)
      if (_syncTick % 60 == 0) {
        await BroadcastService.syncServerOffset();
      }

      final correctedTime = BroadcastService.correctedNow;

      // Program end check (non-loop only)
      if (!isLoop && correctedTime >= programEndTime) {
        _syncTimer?.cancel();
        await _controller?.pause();
        onProgramEnded?.call();
        return;
      }

      // Compute expected position in milliseconds for precision
      int expectedMs;
      if (isLoop) {
        final elapsedMs = correctedTime - programEndTime;
        expectedMs = elapsedMs % (videoDuration * 1000);
      } else {
        expectedMs = correctedTime - programStartTime;
      }

      final actualMs = _controller!.value.position.inMilliseconds;
      final driftMs = (expectedMs - actualMs).abs();

      // Smart sync: hard correction > 5s, moderate correction > 1.5s
      if (driftMs > 5000 || driftMs > 1500) {
        _controller!.seekTo(Duration(milliseconds: expectedMs));
      }

      // Force hard sync every 30s (10 ticks × 3s) as drift protection
      if (_syncTick % 10 == 0) {
        _controller!.seekTo(Duration(milliseconds: expectedMs));
      }
    } catch (_) {
      // Silent fail — retry on next tick
    }
  }

  // ─── Player State Listener ───

  void _onPlayerStateChange() {
    if (_disposed || _controller == null) return;

    final value = _controller!.value;
    final wasBuffering = isBuffering;
    isBuffering = value.isBuffering;

    // Buffer recovery: resync when buffering ends
    if (wasBuffering && !isBuffering) {
      _resyncNow();
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
    _resyncNow();
    if (!_controller!.value.isPlaying) {
      _controller!.play();
    }
  }

  void _resyncNow() {
    if (_controller == null || !_controller!.value.isInitialized) return;

    final correctedTime = BroadcastService.correctedNow;
    int expectedMs;
    if (isLoop) {
      final elapsedMs = correctedTime - programEndTime;
      expectedMs = elapsedMs % (videoDuration * 1000);
    } else {
      expectedMs = correctedTime - programStartTime;
    }
    _controller!.seekTo(Duration(milliseconds: expectedMs));
  }

  Future<void> _retryPlayback() async {
    if (_disposed || _controller == null) return;

    await Future.delayed(const Duration(seconds: 3));
    if (_disposed) return;

    try {
      await _controller!.initialize();
      _resyncNow();
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
