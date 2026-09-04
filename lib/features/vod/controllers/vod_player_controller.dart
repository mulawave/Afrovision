import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../core/media/afrovision_video_controller.dart';
import '../../../core/services/player_settings_service.dart';

/// Simplified, VOD-focused player that reuses the channel [AfrovisionVideoController]
/// and the validated [MpvBufferConfig] VOD profile.
///
/// Handles both network streams and local downloaded files, and fires an
/// [onCompleted] callback once for non-looping playback so callers can
/// auto-advance to the next episode.
class VodPlayerController extends ChangeNotifier {
  AfrovisionVideoController? _controller;
  bool _disposed = false;
  bool _superDisposed = false;
  bool _isInitializing = false;
  String? _activeSource;

  VoidCallback? onCompleted;

  // Exposed state
  bool get isInitialized => _controller?.isInitialized ?? false;
  bool get isPlaying => _controller?.value.isPlaying ?? false;
  bool get isBuffering => _controller?.value.isBuffering ?? false;
  bool get hasError => _controller?.hasError ?? false;
  String? get errorMessage => _controller?.errorMessage;
  Duration get position => _controller?.value.position ?? Duration.zero;
  Duration get duration => _controller?.value.duration ?? Duration.zero;
  double get aspectRatio {
    final value = _controller?.value;
    if (value == null) return 16 / 9;
    final w = value.width;
    final h = value.height;
    if (w > 0 && h > 0) return w / h;
    return 16 / 9;
  }

  bool get isInitializing => _isInitializing;

  AfrovisionVideoController? get videoController => _controller;
  Player? get player => _controller?.player;

  VodPlayerController();

  /// Initialize the player for a public network URL or a local file path.
  /// [startPositionSeconds] is used to resume a previously watched movie/episode.
  Future<void> initialize({
    String? videoUrl,
    String? localFilePath,
    int startPositionSeconds = 0,
    int? userHlsBps,
  }) async {
    assert(
      (videoUrl != null) ^ (localFilePath != null),
      'Provide exactly one of videoUrl or localFilePath',
    );

    final fileSource = localFilePath != null ? 'file://$localFilePath' : null;
    final requestedSource = videoUrl ?? fileSource;
    if (_isInitializing || _activeSource == requestedSource) return;
    _isInitializing = true;
    _activeSource = requestedSource;
    if (!_disposed) notifyListeners();

    await _disposeController();

    final source = videoUrl ?? 'file://$localFilePath';
    final uri = Uri.parse(source);

    if (source.startsWith('file://')) {
      _controller = AfrovisionVideoController.file(
        File(localFilePath!),
      );
    } else {
      _controller = AfrovisionVideoController.networkUrl(uri);
    }

    _controller!.onCompleted = () {
      if (!_disposed) onCompleted?.call();
    };
    _controller!.addListener(_onStateChanged);

    try {
      await PlayerSettingsService.instance.initialize();
      final settings = PlayerSettingsService.instance.current;
      final bps = userHlsBps ?? settings.quality.bps;

      await _controller!.initialize(
        isLive: false,
        startPosition: Duration(seconds: startPositionSeconds),
        userHlsBps: bps,
      );
    } catch (e) {
      debugPrint('[VodPlayerController] Initialize error: $e');
    } finally {
      _isInitializing = false;
      if (!_disposed) notifyListeners();
    }
  }

  /// Switch quality by re-initializing with a new user bitrate cap.
  /// The start position is preserved.
  Future<void> setQuality(int? bps) async {
    final source = _activeSource;
    final start = position.inSeconds;
    if (source == null) return;

    await initialize(
      videoUrl: source.startsWith('file://') ? null : source,
      localFilePath: source.startsWith('file://') ? source.replaceFirst('file://', '') : null,
      startPositionSeconds: start,
      userHlsBps: bps,
    );
  }

  Future<void> play() async {
    await _controller?.play();
  }

  Future<void> pause() async {
    await _controller?.pause();
  }

  Future<void> togglePlayPause() async {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  Future<void> seekTo(Duration position) async {
    await _controller?.seekTo(position);
  }

  Future<void> seekForward(int seconds) async {
    final target = position + Duration(seconds: seconds);
    final max = duration;
    if (max > Duration.zero && target > max) {
      await seekTo(max);
    } else {
      await seekTo(target);
    }
  }

  Future<void> seekBackward(int seconds) async {
    final target = position - Duration(seconds: seconds);
    if (target < Duration.zero) {
      await seekTo(Duration.zero);
    } else {
      await seekTo(target);
    }
  }

  Future<void> setVolume(double volume) async {
    await _controller?.setVolume(volume);
  }

  Widget buildVideo({BoxFit fit = BoxFit.contain}) {
    final vc = _controller?.videoController;
    if (vc == null) return Container(color: Colors.black);
    return Video(
      controller: vc,
      fit: fit,
      controls: NoVideoControls,
    );
  }

  void _onStateChanged() {
    if (!_disposed) notifyListeners();
  }

  Future<void> _disposeController() async {
    final old = _controller;
    _controller = null;
    if (old != null) {
      old.removeListener(_onStateChanged);
      await old.disposeAsync();
    }
  }

  Future<void> disposeAsync() async {
    _disposed = true;
    await _disposeController();
    if (!_superDisposed) {
      _superDisposed = true;
      super.dispose();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _disposeController();
    if (!_superDisposed) {
      _superDisposed = true;
      super.dispose();
    }
  }
}
