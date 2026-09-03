import 'dart:async';
import 'dart:io';
import 'dart:ui' show Size;

import 'package:flutter/foundation.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../config/app_config.dart';
import '../services/network_profile_service.dart';
import '../storage/auth_storage.dart';
import '../utils/mpv_buffer_config.dart';

/// A value object compatible with VideoPlayerController.value usage patterns.
class AfrovisionVideoValue {
  final bool isInitialized;
  final bool isPlaying;
  final bool isBuffering;
  final bool hasError;
  final String? errorMessage;
  final Duration position;
  final Duration duration;
  final int width;
  final int height;
  final bool isCompleted;

  const AfrovisionVideoValue({
    required this.isInitialized,
    required this.isPlaying,
    required this.isBuffering,
    required this.hasError,
    this.errorMessage,
    required this.position,
    required this.duration,
    required this.width,
    required this.height,
    this.isCompleted = false,
  });

  Size get size => Size(width.toDouble(), height.toDouble());

  double get aspectRatio {
    if (width > 0 && height > 0) return width / height;
    return 0.0;
  }
}

/// A wrapper around media_kit's [Player] that exposes a VideoPlayer-like API.
///
/// Supports both live broadcast streams (HLS, DASH, progressive MP4) and VOD
/// content. The caller controls the player engine through the same surface used
/// by the legacy [video_player] path: `initialize`, `play`, `pause`, `seekTo`,
/// `setVolume`, `setLooping`, `value`, and `addListener`.
class AfrovisionVideoController extends ChangeNotifier {
  Player? _player;
  VideoController? _videoController;
  String? _url;
  String? _filePath;
  Map<String, String>? _httpHeaders;
  bool _isInitialized = false;
  bool _isPlaying = false;
  bool _isBuffering = false;
  bool _isLooping = false;
  bool _completed = false;
  bool _hasError = false;
  String? _errorMessage;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  Duration _startPosition = Duration.zero;
  int _width = 0;
  int _height = 0;
  bool _disposed = false;
  bool _superDisposed = false;
  bool _isLive = false;
  int? _userHlsBps;

  StreamSubscription? _playingSub;
  StreamSubscription? _completedSub;
  StreamSubscription? _bufferingSub;
  StreamSubscription? _positionSub;
  StreamSubscription? _durationSub;
  StreamSubscription? _widthSub;
  StreamSubscription? _heightSub;
  StreamSubscription? _errorSub;
  StreamSubscription? _networkSub;

  /// Optional callback fired once when non-looping playback reaches the end.
  VoidCallback? onCompleted;

  AfrovisionVideoController._();

  /// Create a controller for a network URL.
  static AfrovisionVideoController networkUrl(
    Uri url, {
    Map<String, String>? httpHeaders,
  }) {
    final c = AfrovisionVideoController._();
    c._url = url.toString();
    c._httpHeaders = httpHeaders;
    return c;
  }

  /// Create a controller for a local file.
  static AfrovisionVideoController file(
    File file, {
    Map<String, String>? httpHeaders,
  }) {
    final c = AfrovisionVideoController._();
    c._filePath = file.uri.toString();
    c._httpHeaders = httpHeaders;
    return c;
  }

  /// The media_kit [VideoController] for rendering with the [Video] widget.
  VideoController? get videoController => _videoController;

  /// The underlying media_kit [Player] for direct access if needed.
  Player? get player => _player;

  /// Whether the player has been initialized and is ready to play.
  bool get isInitialized => _isInitialized;

  /// Whether an error occurred during initialization or playback.
  bool get hasError => _hasError;

  /// The last error message, if any.
  String? get errorMessage => _errorMessage;

  /// Whether the controller is currently in live (broadcast) mode.
  bool get isLive => _isLive;

  /// A value object compatible with VideoPlayerController.value usage.
  AfrovisionVideoValue get value => AfrovisionVideoValue(
        isInitialized: _isInitialized,
        isPlaying: _isPlaying,
        isBuffering: _isBuffering,
        hasError: _hasError,
        errorMessage: _errorMessage,
        position: _position,
        duration: _duration,
        width: _width,
        height: _height,
        isCompleted: _completed,
      );

  /// Initialize the player and load the media.
  ///
  /// [isLive] selects the large live-HLS buffer and enables reconnect tuning.
  /// [startPosition] is the offset at which playback should begin (used by
  /// broadcast players to start behind the live edge).
  /// [userHlsBps] is an optional user-selected bitrate ceiling in bits/s.
  Future<void> initialize({
    bool isLive = false,
    Duration startPosition = Duration.zero,
    int? userHlsBps,
  }) async {
    final source = _url ?? _filePath;
    if (source == null) throw StateError('No source set');

    _isLive = isLive;
    _startPosition = startPosition;
    _userHlsBps = userHlsBps;

    // Make sure the network profile is warm before we decide bitrate / buffer.
    await NetworkProfileService.instance.initialize();

    _player = Player(
      configuration: PlayerConfiguration(
        bufferSize: isLive ? MpvBufferConfig.liveBufferSize : MpvBufferConfig.vodBufferSize,
      ),
    );
    _videoController = VideoController(_player!);

    // Subscribe to state streams and translate to ChangeNotifier pattern.
    _playingSub = _player!.stream.playing.listen((playing) {
      _isPlaying = playing;
      if (!_disposed) notifyListeners();
    });

    _completedSub = _player!.stream.completed.listen((_) {
      _completed = true;
      // For non-looping videos, snap position to duration so completion
      // detection in listeners fires once.
      if (!_isLooping && _duration > Duration.zero) {
        _position = _duration;
        if (!_disposed) notifyListeners();
      }
      if (!_disposed && _completed && !_isLooping) onCompleted?.call();
    });

    _bufferingSub = _player!.stream.buffering.listen((buffering) {
      _isBuffering = buffering;
      if (!_disposed) notifyListeners();
    });

    _positionSub = _player!.stream.position.listen((pos) {
      // Don't regress position after completion snap.
      if (!_completed || pos >= _position) {
        _position = pos;
      }
      if (!_disposed) notifyListeners();
    });

    _durationSub = _player!.stream.duration.listen((dur) {
      _duration = dur;
      if (!_disposed) notifyListeners();
    });

    _widthSub = _player!.stream.width.listen((w) {
      _width = w ?? 0;
      if (!_disposed) notifyListeners();
    });

    _heightSub = _player!.stream.height.listen((h) {
      _height = h ?? 0;
      if (!_disposed) notifyListeners();
    });

    _errorSub = _player!.stream.error.listen((error) {
      _hasError = true;
      _errorMessage = error;
      debugPrint('[AfrovisionVideoController] Error: $error');
      if (!_disposed) notifyListeners();
    });

    // Keep the bitrate cap in sync if the user switches networks mid-session.
    _networkSub = NetworkProfileService.instance.onTypeChanged.listen((_) async {
      final p = _player;
      if (p == null || _disposed) return;
      await MpvBufferConfig.applyHlsBitrateCap(
        p,
        networkType: NetworkProfileService.instance.currentType,
        userBps: _userHlsBps,
      );
    });

    // Apply the appropriate MPV buffer profile.
    if (isLive) {
      await MpvBufferConfig.applyForLive(_player!);
    } else {
      await MpvBufferConfig.applyForVod(_player!);
    }

    // Apply the user-selected bitrate cap on top of the buffer profile.
    await MpvBufferConfig.applyHlsBitrateCap(
      _player!,
      userBps: _userHlsBps,
    );

    final headers = _httpHeaders ?? await _buildNetworkHeaders(source);
    final media = Media(source, httpHeaders: headers);

    // Open with a hard timeout — if MPV can't start demuxing in 30s the URL
    // or network is unusable.
    await _player!.open(media, play: false).timeout(
      const Duration(seconds: 30),
      onTimeout: () {
        throw TimeoutException('Afrovision open timed out after 30s');
      },
    );

    if (_disposed) return;

    // Wait for an actual decoded frame before claiming success. This prevents
    // the UI from showing a black player that is still buffering forever.
    final firstWidth = await _player!.stream.width
        .firstWhere((w) => (w ?? 0) > 0)
        .timeout(
          const Duration(seconds: 10),
          onTimeout: () => 0,
        );
    if (firstWidth == null || firstWidth <= 0) {
      throw TimeoutException('Afrovision first frame timed out after 10s');
    }

    if (_disposed) return;

    // Seek to the requested start position once the decoder is ready.
    if (_startPosition > Duration.zero) {
      await _player!.seek(_startPosition);
      if (_disposed) return;
    }

    _hasError = false;
    _errorMessage = null;
    _isInitialized = true;
    if (!_disposed) notifyListeners();
  }

  Future<void> play() async {
    _completed = false;
    _isPlaying = true;
    if (!_disposed) notifyListeners();
    await _player?.play();
  }

  Future<void> pause() async {
    _isPlaying = false;
    if (!_disposed) notifyListeners();
    await _player?.pause();
  }

  Future<void> seekTo(Duration position) async {
    _completed = false;
    await _player?.seek(position);
  }

  /// Set volume (0.0–1.0 scale, converted to media_kit's 0–100 scale).
  Future<void> setVolume(double volume) async {
    final clamped = (volume * 100).clamp(0.0, 100.0);
    await _player?.setVolume(clamped);
  }

  /// Set playback speed (1.0 = normal speed).
  Future<void> setPlaybackSpeed(double speed) async {
    await _player?.setRate(speed);
    // Preserve audio pitch at non-1.0 speeds (VideoPlayerController does this by default).
    final platform = _player?.platform;
    if (platform != null) {
      final native = platform as dynamic;
      try {
        await native.setProperty('audio-pitch-correction', 'yes');
      } catch (_) {}
    }
  }

  /// Enable or disable looping playback.
  Future<void> setLooping(bool looping) async {
    _isLooping = looping;
    await _player?.setPlaylistMode(
      looping ? PlaylistMode.loop : PlaylistMode.none,
    );
  }

  /// Build auth headers for backend URLs, mirroring [BroadcastPlayer].
  static Future<Map<String, String>> _buildNetworkHeaders(String source) async {
    if (source.startsWith('file://')) return const <String, String>{};

    final uri = Uri.tryParse(source);
    final appUri = Uri.tryParse(AppConfig.baseUrl);
    if (uri == null || appUri == null) return const <String, String>{};

    final isSameBackend =
        uri.host.toLowerCase() == appUri.host.toLowerCase() &&
            (uri.port == appUri.port || uri.port == 0 || appUri.port == 0);
    if (!isSameBackend) return const <String, String>{};

    final token = await AuthStorage.getToken();
    if (token == null || token.isEmpty) return const <String, String>{};
    return <String, String>{'Authorization': 'Bearer $token'};
  }

  @override
  void dispose() {
    // Synchronous disposal for callers that must return immediately.
    // We call [super.dispose] here (as required by @mustCallSuper) and start
    // the heavy native player disposal in an unawaited future.
    _disposed = true;
    _superDisposed = true;
    _cancelSubscriptions();
    super.dispose();
    unawaited(_disposePlayer());
  }

  /// Asynchronous disposal that awaits [Player.dispose] so the native audio
  /// session is fully released before a new controller is created.
  Future<void> disposeAsync() async {
    _disposed = true;
    _cancelSubscriptions();
    await _disposePlayer();
    if (!_superDisposed) {
      _superDisposed = true;
      super.dispose();
    }
  }

  void _cancelSubscriptions() {
    _playingSub?.cancel();
    _completedSub?.cancel();
    _bufferingSub?.cancel();
    _positionSub?.cancel();
    _durationSub?.cancel();
    _widthSub?.cancel();
    _heightSub?.cancel();
    _errorSub?.cancel();
    _networkSub?.cancel();
  }

  Future<void> _disposePlayer() async {
    // Note: VideoController does not have a dispose method in media_kit.
    // Disposing the Player is sufficient.
    if (_player != null) {
      await _player!.dispose();
      _player = null;
    }
  }
}
