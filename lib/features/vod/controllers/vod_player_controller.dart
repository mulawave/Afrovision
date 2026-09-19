import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_player/video_player.dart' as vp;

import '../../../core/media/afrovision_video_controller.dart';
import '../../../core/services/player_settings_service.dart';

/// Simplified, VOD-focused player that reuses the channel [AfrovisionVideoController]
/// and the validated [MpvBufferConfig] VOD profile.
///
/// Handles both network streams and local downloaded files, and fires an
/// [onCompleted] callback once for non-looping playback so callers can
/// auto-advance to the next episode.
///
/// Honours the `useMediaKit` Watch Settings toggle: when the user opts into
/// the legacy engine, playback runs on `video_player` instead of media_kit —
/// previously this controller always used media_kit regardless of the
/// setting, so the toggle had no effect on movies/series.
class VodPlayerController extends ChangeNotifier {
  AfrovisionVideoController? _controller;
  vp.VideoPlayerController? _legacyController;
  bool _useMediaKit = true;
  bool _disposed = false;
  bool _superDisposed = false;
  bool _isInitializing = false;
  String? _activeSource;
  bool _legacyHasError = false;
  String? _legacyErrorMessage;

  VoidCallback? onCompleted;
  bool _legacyCompletedFired = false;

  // Exposed state
  bool get isInitialized =>
      _useMediaKit ? (_controller?.isInitialized ?? false) : (_legacyController?.value.isInitialized ?? false);
  bool get isPlaying =>
      _useMediaKit ? (_controller?.value.isPlaying ?? false) : (_legacyController?.value.isPlaying ?? false);
  bool get isBuffering =>
      _useMediaKit ? (_controller?.value.isBuffering ?? false) : (_legacyController?.value.isBuffering ?? false);
  bool get hasError => _useMediaKit ? (_controller?.hasError ?? false) : _legacyHasError;
  String? get errorMessage => _useMediaKit ? _controller?.errorMessage : _legacyErrorMessage;
  Duration get position =>
      _useMediaKit ? (_controller?.value.position ?? Duration.zero) : (_legacyController?.value.position ?? Duration.zero);
  Duration get duration =>
      _useMediaKit ? (_controller?.value.duration ?? Duration.zero) : (_legacyController?.value.duration ?? Duration.zero);
  double get aspectRatio {
    if (_useMediaKit) {
      final value = _controller?.value;
      if (value == null) return 16 / 9;
      final w = value.width;
      final h = value.height;
      if (w > 0 && h > 0) return w / h;
      return 16 / 9;
    }
    final ar = _legacyController?.value.aspectRatio;
    return (ar != null && ar > 0) ? ar : 16 / 9;
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

    await PlayerSettingsService.instance.initialize();
    final settings = PlayerSettingsService.instance.current;
    _useMediaKit = settings.useMediaKit;
    final bps = userHlsBps ?? settings.quality.bps;

    try {
      if (_useMediaKit) {
        await _initMediaKit(
          videoUrl: videoUrl,
          localFilePath: localFilePath,
          startPositionSeconds: startPositionSeconds,
          userHlsBps: bps,
        );
      } else {
        await _initLegacy(
          videoUrl: videoUrl,
          localFilePath: localFilePath,
          startPositionSeconds: startPositionSeconds,
        );
      }
    } catch (e) {
      debugPrint('[VodPlayerController] Initialize error: $e');
    } finally {
      _isInitializing = false;
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> _initMediaKit({
    String? videoUrl,
    String? localFilePath,
    required int startPositionSeconds,
    int? userHlsBps,
  }) async {
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

    await _controller!.initialize(
      isLive: false,
      startPosition: Duration(seconds: startPositionSeconds),
      userHlsBps: userHlsBps,
    );

    // Auto-play as soon as the decoder is ready so the user does not have
    // to tap play a second time after the player screen loads.
    if (_disposed) return;
    await _controller!.play();
  }

  Future<void> _initLegacy({
    String? videoUrl,
    String? localFilePath,
    required int startPositionSeconds,
  }) async {
    _legacyHasError = false;
    _legacyErrorMessage = null;
    _legacyCompletedFired = false;

    final controller = localFilePath != null
        ? vp.VideoPlayerController.file(File(localFilePath))
        : vp.VideoPlayerController.networkUrl(Uri.parse(videoUrl!));
    _legacyController = controller;
    controller.addListener(_onLegacyStateChanged);

    try {
      await controller.initialize();
      if (_disposed) return;
      if (startPositionSeconds > 0) {
        await controller.seekTo(Duration(seconds: startPositionSeconds));
      }
      await controller.play();
    } catch (e) {
      _legacyHasError = true;
      _legacyErrorMessage = 'Playback failed: $e';
    }
  }

  void _onLegacyStateChanged() {
    if (_disposed) return;
    final value = _legacyController?.value;
    if (value != null && value.hasError && !_legacyHasError) {
      _legacyHasError = true;
      _legacyErrorMessage = value.errorDescription ?? 'Playback failed';
    }
    if (value != null &&
        !value.isLooping &&
        value.duration > Duration.zero &&
        value.position >= value.duration &&
        !_legacyCompletedFired) {
      _legacyCompletedFired = true;
      onCompleted?.call();
    }
    notifyListeners();
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
    if (_useMediaKit) {
      await _controller?.play();
    } else {
      await _legacyController?.play();
    }
  }

  Future<void> pause() async {
    if (_useMediaKit) {
      await _controller?.pause();
    } else {
      await _legacyController?.pause();
    }
  }

  Future<void> togglePlayPause() async {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  Future<void> seekTo(Duration position) async {
    if (_useMediaKit) {
      await _controller?.seekTo(position);
    } else {
      await _legacyController?.seekTo(position);
    }
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
    if (_useMediaKit) {
      await _controller?.setVolume(volume);
    } else {
      await _legacyController?.setVolume(volume);
    }
  }

  Widget buildVideo({BoxFit fit = BoxFit.contain}) {
    if (_useMediaKit) {
      final vc = _controller?.videoController;
      if (vc == null) return Container(color: Colors.black);
      return Video(
        controller: vc,
        fit: fit,
        controls: NoVideoControls,
      );
    }
    final legacy = _legacyController;
    if (legacy == null || !legacy.value.isInitialized) {
      return Container(color: Colors.black);
    }
    return FittedBox(
      fit: fit,
      child: SizedBox(
        width: legacy.value.size.width,
        height: legacy.value.size.height,
        child: vp.VideoPlayer(legacy),
      ),
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
    final oldLegacy = _legacyController;
    _legacyController = null;
    if (oldLegacy != null) {
      oldLegacy.removeListener(_onLegacyStateChanged);
      await oldLegacy.dispose();
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
