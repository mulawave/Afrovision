import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../core/media/afrovision_video_controller.dart';
import '../../../core/services/video_cache_service.dart';

/// Single playable item for the media player (movie or episode).
class MediaPlayerItem {
  final String id;
  final String title;
  final String? subtitle;
  final String url;
  final int duration;

  const MediaPlayerItem({
    required this.id,
    required this.title,
    this.subtitle,
    required this.url,
    this.duration = 0,
  });
}

/// Arguments passed to the media player route.
class MediaPlayerArgs {
  final String title;
  final List<MediaPlayerItem> items;
  final int initialIndex;

  const MediaPlayerArgs({
    required this.title,
    required this.items,
    this.initialIndex = 0,
  });

  factory MediaPlayerArgs.fromRoute(Object? arguments) {
    if (arguments is MediaPlayerArgs) return arguments;
    if (arguments is Map<String, dynamic>) {
      final items = (arguments['items'] as List<dynamic>?)
              ?.whereType<MediaPlayerItem>()
              .toList() ??
          const <MediaPlayerItem>[];
      return MediaPlayerArgs(
        title: (arguments['title'] ?? 'Now Playing').toString(),
        items: items,
        initialIndex: (arguments['initialIndex'] as num?)?.toInt() ?? 0,
      );
    }
    return const MediaPlayerArgs(title: 'Now Playing', items: []);
  }
}

/// Generic movie/series episode player for channel-scoped VOD content.
///
/// Restored per wips_restoration.md Phase 2. Uses the current (superior)
/// [AfrovisionVideoController] directly — NOT the wips `WaveVideoController`
/// typedef, which Phase 0/1's audit found to be an older, less capable
/// implementation. This file only differs from its wips source in that
/// respect: two call sites construct `AfrovisionVideoController` instead of
/// `WaveVideoController`. Everything else — playlist auto-advance, local
/// cache-first playback, countdown UI — is unchanged.
class MediaPlayerScreen extends StatefulWidget {
  const MediaPlayerScreen({super.key});

  @override
  State<MediaPlayerScreen> createState() => _MediaPlayerScreenState();
}

class _MediaPlayerScreenState extends State<MediaPlayerScreen> {
  late MediaPlayerArgs _args;
  AfrovisionVideoController? _controller;
  bool _isLoading = true;
  String? _error;
  int _currentIndex = 0;
  bool _isFinished = false;
  int _nextCountdown = 0;
  Timer? _countdownTimer;
  bool _hasAutoAdvanced = false;
  double? _dragPosition;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final routeArgs = ModalRoute.of(context)?.settings.arguments;
    _args = MediaPlayerArgs.fromRoute(routeArgs);
    _currentIndex = _args.initialIndex.clamp(0, _args.items.length - 1);
    if (_controller == null && _args.items.isNotEmpty) {
      _loadEpisode(_currentIndex);
    }
  }

  Future<void> _loadEpisode(int index) async {
    if (index < 0 || index >= _args.items.length) return;

    _countdownTimer?.cancel();
    _countdownTimer = null;

    setState(() {
      _isLoading = true;
      _error = null;
      _isFinished = false;
      _hasAutoAdvanced = false;
      _dragPosition = null;
    });

    _disposeController();

    final item = _args.items[index];
    final uri = Uri.tryParse(item.url);
    if (uri == null || item.url.isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'Video URL is missing for ${item.title}.';
      });
      return;
    }

    _currentIndex = index;

    // Prefer a local cache copy if it exists; otherwise stream from the
    // network and cache in the background for next time.  HLS manifests
    // cannot be cached as a single file.
    AfrovisionVideoController? controller;
    File? cachedFile;
    final isHls = item.url.toLowerCase().contains('.m3u8');

    if (!isHls) {
      try {
        cachedFile = await VideoCacheService.instance.getCachedFile(item.id);
      } catch (_) {}
    }

    if (cachedFile != null) {
      debugPrint('[MediaPlayer] Playing from cache for ${item.id}');
      controller = AfrovisionVideoController.file(cachedFile);
    } else {
      controller = AfrovisionVideoController.networkUrl(uri);
      if (!isHls) {
        VideoCacheService.instance.downloadAndCache(item.id, item.url);
      }
    }

    _controller = controller;

    try {
      await controller.initialize();
      if (!mounted) return;

      controller.addListener(_onControllerUpdate);
      await controller.play();

      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = 'Failed to load video. Please try again.';
      });
    }
  }

  void _onControllerUpdate() {
    final value = _controller?.value;
    if (value == null || !mounted) return;

    if (value.hasError) {
      setState(() {
        _isLoading = false;
        _error = value.errorMessage ?? 'Playback error. Please try again.';
      });
      return;
    }

    if (!_hasAutoAdvanced && value.isCompleted && !_isFinished) {
      _handleEpisodeFinished();
    }
  }

  void _handleEpisodeFinished() {
    if (_hasAutoAdvanced || _isFinished) return;

    if (_currentIndex < _args.items.length - 1) {
      setState(() {
        _isFinished = true;
        _nextCountdown = 5;
      });

      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        setState(() {
          _nextCountdown--;
        });

        if (_nextCountdown <= 0) {
          timer.cancel();
          _hasAutoAdvanced = true;
          _loadEpisode(_currentIndex + 1);
        }
      });
    } else {
      setState(() {
        _isFinished = true;
      });
    }
  }

  void _disposeController() {
    final ctrl = _controller;
    if (ctrl != null) {
      _controller = null;
      ctrl.removeListener(_onControllerUpdate);
      ctrl.dispose();
    }
  }

  Future<void> _playNext() async {
    if (_currentIndex < _args.items.length - 1) {
      _countdownTimer?.cancel();
      _loadEpisode(_currentIndex + 1);
    }
  }

  Future<void> _playPrevious() async {
    if (_currentIndex > 0) {
      _countdownTimer?.cancel();
      _loadEpisode(_currentIndex - 1);
    }
  }

  Future<void> _togglePlayPause() async {
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    if (ctrl.value.isPlaying) {
      await ctrl.pause();
    } else {
      await ctrl.play();
    }
    setState(() {});
  }

  Future<void> _seekToPercent(double percent) async {
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    final durationMs = ctrl.value.duration.inMilliseconds;
    if (durationMs <= 0) return;
    final target = Duration(
      milliseconds: (percent.clamp(0.0, 1.0) * durationMs).toInt(),
    );
    await ctrl.seekTo(target);
    if (mounted) setState(() => _dragPosition = null);
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _disposeController();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = _args.items.isNotEmpty ? _args.items[_currentIndex] : null;
    final ctrl = _controller;
    final value = ctrl?.value;
    final hasNext = _currentIndex < _args.items.length - 1;
    final hasPrevious = _currentIndex > 0;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black.withValues(alpha: 0.7),
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          _args.title,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
      ),
      body: _error != null
          ? _buildError()
          : _isLoading || ctrl == null || value == null || !value.isInitialized
              ? const Center(child: CircularProgressIndicator(color: Colors.white))
              : Stack(
                  fit: StackFit.expand,
                  children: [
                    // Video surface
                    GestureDetector(
                      onTap: _togglePlayPause,
                      child: Center(
                        child: AspectRatio(
                          aspectRatio: value.aspectRatio > 0
                              ? value.aspectRatio
                              : 16 / 9,
                          child: Video(
                            controller: ctrl.videoController!,
                            controls: NoVideoControls,
                          ),
                        ),
                      ),
                    ),

                    // Bottom control bar
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.7),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        child: SafeArea(
                          top: false,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (current != null)
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        current.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                    if (current.subtitle != null)
                                      Text(
                                        current.subtitle!,
                                        style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 12),
                                      ),
                                  ],
                                ),
                              const SizedBox(height: 8),
                              _buildProgressSlider(value),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  IconButton(
                                    onPressed: hasPrevious ? _playPrevious : null,
                                    icon: const Icon(Icons.skip_previous),
                                    color: Colors.white,
                                    disabledColor: Colors.white24,
                                  ),
                                  IconButton(
                                    onPressed: _togglePlayPause,
                                    icon: Icon(
                                      value.isPlaying
                                          ? Icons.pause
                                          : Icons.play_arrow,
                                    ),
                                    color: Colors.white,
                                    iconSize: 40,
                                  ),
                                  IconButton(
                                    onPressed: hasNext ? _playNext : null,
                                    icon: const Icon(Icons.skip_next),
                                    color: Colors.white,
                                    disabledColor: Colors.white24,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    // Auto-next countdown overlay
                    if (_isFinished && _nextCountdown > 0 && hasNext)
                      _buildCountdown(current?.title ?? ''),

                    // Series completion message
                    if (_isFinished && !hasNext)
                      const Positioned.fill(
                        child: ColoredBox(
                          color: Colors.black54,
                          child: Center(
                            child: Text(
                              'Series complete',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }

  Widget _buildProgressSlider(AfrovisionVideoValue value) {
    final durationMs = value.duration.inMilliseconds;
    final positionMs = value.position.inMilliseconds;
    final effectivePosition =
        _dragPosition != null ? (_dragPosition! * durationMs).toInt() : positionMs;
    final fraction = durationMs > 0
        ? (effectivePosition / durationMs).clamp(0.0, 1.0)
        : 0.0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Slider(
          value: fraction,
          onChanged: durationMs > 0
              ? (v) => setState(() => _dragPosition = v)
              : null,
          onChangeEnd: durationMs > 0
              ? (v) => _seekToPercent(v)
              : null,
          activeColor: Colors.white,
          inactiveColor: Colors.white24,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatDuration(Duration(milliseconds: effectivePosition)),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              Text(
                _formatDuration(value.duration),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = d.inHours;
    if (hours > 0) {
      return '$hours:${minutes.padLeft(2, '0')}:$seconds';
    }
    return '$minutes:$seconds';
  }

  Widget _buildCountdown(String nextTitle) {
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black54,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Next episode: $nextTitle',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Text(
                'Playing in $_nextCountdown...',
                style: const TextStyle(color: Colors.white, fontSize: 16),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ElevatedButton(
                    onPressed: () {
                      _countdownTimer?.cancel();
                      _playNext();
                    },
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black),
                    child: const Text('Play Now'),
                  ),
                  const SizedBox(width: 12),
                  TextButton(
                    onPressed: () {
                      _countdownTimer?.cancel();
                      setState(() {
                        _isFinished = false;
                        _nextCountdown = 0;
                      });
                    },
                    child: const Text(
                      'Cancel',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _error ?? 'Could not play this content.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _loadEpisode(_currentIndex),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
