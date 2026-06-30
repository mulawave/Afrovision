// ignore_for_file: unused_import

import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart' hide Priority;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../../core/config/app_config.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/services/video_cache_service.dart';
import '../../../core/storage/auth_storage.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/services/auth_service.dart';
import '../../broadcast/models/channel_library_models.dart';
import '../../broadcast/services/channel_library_service.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';
import '../models/wave_model.dart';
import '../services/wave_service.dart';

class WaveScreen extends StatefulWidget {
  const WaveScreen({super.key});

  @override
  State<WaveScreen> createState() => _WaveScreenState();
}

class _WaveScreenState extends State<WaveScreen> {
  static const String _seenWaveIdsKey = 'wave_seen_ids_v1';
  static const int _seenWaveIdsMax = 600;
  // Keep 2 waves on each side alive — low-end chips (Unisoc) cannot handle
  // many concurrent hardware decoders. Aggressive culling prevents NO_MEMORY.
  static const int _controllerKeepDistance = 2;
  final List<WaveModel> _waves = <WaveModel>[];
  final Set<String> _seenWaveIds = <String>{};
  final Set<String> _failedWaveIds = <String>{};
  final Map<String, VideoPlayerController> _videoControllers =
      <String, VideoPlayerController>{};
  final Map<String, VoidCallback> _videoListeners = <String, VoidCallback>{};
  final Map<String, List<WavePulseMomentModel>> _pulseMoments =
      <String, List<WavePulseMomentModel>>{};
  final Map<String, double> _currentTimes = <String, double>{};
  final Map<String, int> _lastTickMs = <String, int>{};
  final Map<String, int> _durations = <String, int>{};
  final Map<String, bool> _endHandled = <String, bool>{};
  final Map<String, WaveAccessDecision> _accessDecisions =
      <String, WaveAccessDecision>{};
  final Map<String, GlobalKey> _wavePreviewKeys = <String, GlobalKey>{};
  final Map<String, String> _channelTypes = <String, String>{};
  final Map<String, bool> _channelCardVisible = <String, bool>{};
  // Static caches so brand-card data survives leaving and re-entering WaveScreen
  static final Map<String, ChannelModel> _channelCache = <String, ChannelModel>{};
  static final Map<String, List<WaveModel>> _channelWavesCache = <String, List<WaveModel>>{};
  // Library uploads (books/comics/magazines) preview per channel
  static final Map<String, List<ChannelLibraryItemModel>> _channelLibraryCache =
      <String, List<ChannelLibraryItemModel>>{};
  // Aggregated channel stats: total pulses and total replays across all waves.
  // Static so they persist alongside the channel/waves caches across re-entry.
  static final Map<String, int> _channelTotalPulses = <String, int>{};
  static final Map<String, int> _channelTotalReplays = <String, int>{};
  // Track controllers that are still initializing to avoid limit bypass
  int _initializingControllerCount = 0;
  // Track waves whose video controllers are currently initializing to prevent duplicates
  final Set<String> _initializingWaveIds = <String>{};
  // Track per-wave initialization retry count to prevent infinite retry loops
  final Map<String, int> _initRetryCount = <String, int>{};
  static const int _maxInitRetries = 2;

  late final PageController _pageController;

  bool _loading = true;
  bool _loadingMore = false;
  bool _isCreator = false;
  bool _autoscroll = false;
  // Transient key that, when non-null, renders the "Autoscroll enabled" badge.
  int? _autoscrollBadgeKey;
  String _autoscrollBadgeLabel = 'Autoscroll enabled';
  bool _muted = false;
  bool _showPlaybackSpeedBar = false;
  double _playbackSpeed = 1.0;
  // Hide all UI overlays (right rail, titles, channel card, timeline)
  bool _hideAllUI = false;
  // Channel follow state (loaded per active wave)
  bool _channelFollowLoading = false;
  bool _isFollowingChannel = false;
  // Key for the local floating indicator overlay (pulse, save, comment, reaction)
  final GlobalKey<_LocalFloatingOverlayState> _floatingOverlayKey =
      GlobalKey<_LocalFloatingOverlayState>();
  bool _reloading = false;
  bool _isAuthenticated = false;
  bool _adultConsentAccepted = false;
  String _waveSessionId = '';
  String? _checkingAccessWaveId;
  String? _error;
  String? _nextCursor;
  int _activeWaveIndex = 0;
  bool _argsHandled = false;
  String? _pendingChannelContextId;
  String? _pendingWaveId;
  // Tracks whether a specific wave navigation was already applied,
  // so _applyChannelContextIfNeeded doesn't override the target index.
  bool _specificWaveNavigationApplied = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    VideoCacheService.instance.initialize();
    _loadInitial();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_argsHandled) return;
    _argsHandled = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map) {
      final waveId = args['waveId']?.toString();
      if (waveId != null && waveId.isNotEmpty) {
        _pendingWaveId = waveId;
      }

      final channelId = args['channelId']?.toString();
      if (channelId != null && channelId.isNotEmpty) {
        _pendingChannelContextId = channelId;
      }
    } else if (args is String && args.isNotEmpty) {
      _pendingChannelContextId = args;
    }

    if (!_loading) {
      _applyChannelContextIfNeeded();
    }
  }

  @override
  void dispose() {
    _restoreSystemUi();
    _pageController.dispose();
    _disposeWaveControllers();
    super.dispose();
  }

  void _disposeWaveControllers() {
    for (final entry in _videoListeners.entries) {
      final controller = _videoControllers[entry.key];
      if (controller != null) {
        controller.removeListener(entry.value);
      }
    }
    for (final controller in _videoControllers.values) {
      controller.dispose();
    }
    _videoListeners.clear();
    _videoControllers.clear();
    _pulseMoments.clear();
    _currentTimes.clear();
    _lastTickMs.clear();
    _durations.clear();
    _endHandled.clear();
    _failedWaveIds.clear();
    _initializingControllerCount = 0;
    _initializingWaveIds.clear();
  }

  Future<void> _loadSeenWaveIds() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = prefs.getStringList(_seenWaveIdsKey) ?? const <String>[];
      _seenWaveIds
        ..clear()
        ..addAll(ids.where((id) => id.isNotEmpty));
    } catch (_) {
      _seenWaveIds.clear();
    }
  }

  Future<void> _persistSeenWaveIds() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = _seenWaveIds.toList(growable: false);
      final trimmed = ids.length > _seenWaveIdsMax
          ? ids.sublist(ids.length - _seenWaveIdsMax)
          : ids;
      await prefs.setStringList(_seenWaveIdsKey, trimmed);
    } catch (_) {
      // best effort persistence
    }
  }

  Future<WaveFeedResponse> _getNovelFeed({
    int limit = 15,
    String? cursor,
    int maxPages = 4,
  }) async {
    final List<WaveModel> pool = <WaveModel>[];
    final Set<String> added = <String>{};
    String? next = cursor;
    final excludeIds = _seenWaveIds.take(160).toList(growable: false);

    for (int page = 0; page < maxPages; page++) {
      final feed = await WaveService.getWaveFeed(
        limit: limit,
        cursor: next,
        excludeIds: excludeIds,
      );
      for (final wave in feed.waves) {
        if (added.add(wave.id)) {
          pool.add(wave);
        }
      }
      next = feed.nextCursor;

      final unseenCount = pool
          .where((wave) => !_seenWaveIds.contains(wave.id))
          .length;
      if (next == null || unseenCount >= limit) {
        break;
      }
    }

    final unseen = pool
        .where((wave) => !_seenWaveIds.contains(wave.id))
        .toList();
    final seen = pool.where((wave) => _seenWaveIds.contains(wave.id)).toList();
    seen.shuffle();
    final ordered = <WaveModel>[...unseen, ...seen];

    return WaveFeedResponse(
      waves: ordered.take(limit).toList(),
      nextCursor: next,
    );
  }

  Future<void> _loadInitial() async {
    _disposeWaveControllers();
    setState(() {
      _loading = true;
      _error = null;
      _nextCursor = null;
      _waves.clear();
      _activeWaveIndex = 0;
      _accessDecisions.clear();
      _checkingAccessWaveId = null;
    });

    try {
      final results = await Future.wait<dynamic>([
        _loadSeenWaveIds(),
        AuthService.getCurrentUser()
            .then((u) => u.isCreatorAccount)
            .catchError((_) => false),
        AuthStorage.getToken(),
      ]);
      final isCreator = results[1] as bool;
      final token = results[2] as String?;
      
      // If a channel context is provided, load that channel's waves first
      if (_pendingChannelContextId != null && _pendingChannelContextId!.isNotEmpty) {
        final channelWaves = await WaveService.getChannelWaves(_pendingChannelContextId!);
        if (!mounted) return;
        
        if (channelWaves.isNotEmpty) {
          final filteredWaves = await _filterWaves(channelWaves);
          if (!mounted) return;
          setState(() {
            _waves.addAll(filteredWaves);
            _isCreator = isCreator;
            _isAuthenticated = token != null && token.isNotEmpty;
            _adultConsentAccepted = false;
            _waveSessionId = 'wv_${DateTime.now().millisecondsSinceEpoch}';
            _loading = false;
          });
        } else {
          // If channel has no waves, fall back to general feed
          final feed = await _getNovelFeed(limit: 15);
          if (!mounted) return;
          final filteredWaves = await _filterWaves(feed.waves);
          if (!mounted) return;
          setState(() {
            _waves.addAll(filteredWaves);
            _nextCursor = feed.nextCursor;
            _isCreator = isCreator;
            _isAuthenticated = token != null && token.isNotEmpty;
            _adultConsentAccepted = false;
            _waveSessionId = 'wv_${DateTime.now().millisecondsSinceEpoch}';
            _loading = false;
          });
        }
      } else {
        // No channel context, load general feed
        final feed = await _getNovelFeed(limit: 15);
        if (!mounted) return;
        final filteredWaves = await _filterWaves(feed.waves);
        if (!mounted) return;
        setState(() {
          _waves.addAll(filteredWaves);
          _nextCursor = feed.nextCursor;
          _isCreator = isCreator;
          _isAuthenticated = token != null && token.isNotEmpty;
          _adultConsentAccepted = false;
          _waveSessionId = 'wv_${DateTime.now().millisecondsSinceEpoch}';
          _loading = false;
        });
      }

      if (_waves.isNotEmpty) {
        // When a channel context or specific wave is pending, skip the initial
        // preloading of indices 0-3 since _applyChannelContextIfNeeded or
        // _applySharedWaveIfNeeded will jump to a different index anyway.
        // Preloading the wrong indices wastes bandwidth and controller slots.
        final hasPendingNavigation = _pendingChannelContextId != null || _pendingWaveId != null;
        if (!hasPendingNavigation) {
          _preloadWave(_waves.first);
          _loadPulseMoments(_waves.first.id);
          for (int i = 1; i < _waves.length && i <= 3; i++) {
            await Future.delayed(const Duration(milliseconds: 200));
            if (!mounted) return;
            _preloadWave(_waves[i]);
          }
        } else {
          // Lightweight - just mark first wave as loading but don't preload video
          _loadPulseMoments(_waves.first.id);
        }
        _pruneControllers(centerIndex: 0);
        _markWaveSeen(_waves.first.id);
        // Access decisions are already set by _filterWaves, no need to call backend check
        _ensureWaveAccessAndPlay(force: false);
      }

      await _applySharedWaveIfNeeded();
      await _applyChannelContextIfNeeded();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _applyChannelContextIfNeeded() async {
    final channelId = _pendingChannelContextId;
    if (channelId == null || channelId.isEmpty || _waves.isEmpty) return;

    var targetIndex = _waves.indexWhere((wave) => wave.channelId == channelId);

    if (targetIndex < 0) {
      try {
        final channelWaves = await WaveService.getChannelWaves(channelId);
        if (!mounted || channelWaves.isEmpty) return;

        // Apply filtering logic to channel waves
        final filteredWaves = await _filterWaves(channelWaves);
        if (!mounted || filteredWaves.isEmpty) return;

        final seenIds = _waves.map((wave) => wave.id).toSet();
        final prepend = filteredWaves
            .where((wave) => !seenIds.contains(wave.id))
            .toList();

        if (prepend.isNotEmpty) {
          setState(() {
            _waves.insertAll(0, prepend);
          });
        }

        targetIndex = _waves.indexWhere((wave) => wave.channelId == channelId);
      } catch (_) {
        return;
      }
    }

    if (targetIndex < 0 || !mounted) return;

    _pendingChannelContextId = null;

    // If a specific wave was already targeted via _applySharedWaveIfNeeded
    // (e.g., user tapped a specific wave from the channel grid), do NOT
    // override the active index with the first channel wave. The specific
    // wave navigation takes priority.
    if (_specificWaveNavigationApplied) {
      _specificWaveNavigationApplied = false;
      // Still load the channel waves into the feed, but don't jump to index 0.
      return;
    }

    // Preload the target wave's video controller NOW, before the page jump.
    // This ensures it has time to initialize while the frame is being built.
    _preloadWave(_waves[targetIndex]);

    setState(() {
      _activeWaveIndex = targetIndex;
    });

    // Use post-frame callback to ensure PageView is built before jumping
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _pageController.jumpToPage(targetIndex);
        _onPageChanged(targetIndex);
      }
    });
  }

  Future<void> _applySharedWaveIfNeeded() async {
    final waveId = _pendingWaveId;
    if (waveId == null || waveId.isEmpty || _waves.isEmpty) return;

    var targetIndex = _waves.indexWhere((wave) => wave.id == waveId);

    if (targetIndex < 0) {
      try {
        final sharedWave = await WaveService.getWave(waveId);
        if (!mounted) return;

        // Apply filtering logic to shared wave
        final filteredWaves = await _filterWaves([sharedWave]);
        if (!mounted) return;
        
        if (filteredWaves.isEmpty) {
          // Wave was filtered out (e.g., non-member of exclusive channel)
          _pendingWaveId = null;
          return;
        }

        final filteredWave = filteredWaves.first;
        final existingIndex = _waves.indexWhere(
          (wave) => wave.id == filteredWave.id,
        );
        if (existingIndex < 0) {
          setState(() {
            _waves.insert(0, filteredWave);
          });
          targetIndex = 0;
        } else {
          targetIndex = existingIndex;
        }
      } catch (_) {
        return;
      }
    }

    if (targetIndex < 0 || !mounted) return;

    _pendingWaveId = null;
    // Mark that a specific wave navigation was applied, so
    // _applyChannelContextIfNeeded won't override the target index.
    _specificWaveNavigationApplied = true;

    // Preload the target shared wave's video controller NOW
    if (targetIndex < _waves.length) {
      _preloadWave(_waves[targetIndex]);
    }

    setState(() {
      _activeWaveIndex = targetIndex;
    });

    // Use post-frame callback to ensure PageView is built before jumping
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _pageController.jumpToPage(targetIndex);
        _onPageChanged(targetIndex);
      }
    });
  }

  Future<void> _reloadFeed() async {
    if (_reloading) return;
    _reloading = true;
    try {
      await _loadInitial();
    } finally {
      _reloading = false;
    }
  }

  Future<void> _refreshFeedFromOptions() async {
    await _reloadFeed();
    if (!mounted) return;
    _showSnack('Feed refreshed');
  }

  Future<void> _loadMore() async {
    if (_loadingMore) return;

    setState(() => _loadingMore = true);
    try {
      final feed = await _getNovelFeed(limit: 15, cursor: _nextCursor);
      if (!mounted) return;
      final filteredWaves = await _filterWaves(feed.waves);
      if (!mounted) return;

      final existing = _waves.map((wave) => wave.id).toSet();
      final newWaves = filteredWaves.where((wave) => !existing.contains(wave.id)).toList();

      if (newWaves.isNotEmpty) {
        setState(() {
          _waves.addAll(newWaves);
          _nextCursor = feed.nextCursor;
        });
      } else if (_nextCursor == null) {
        // Exhausted all new waves — cycle through existing ones
        final cycle = (_waves.toList()..shuffle()).take(15).toList();
        setState(() {
          _waves.addAll(cycle);
        });
      } else {
        setState(() => _nextCursor = feed.nextCursor);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _nextCursor = null);
    } finally {
      if (mounted) {
        setState(() => _loadingMore = false);
      }
    }
  }

  Future<void> _preloadWave(WaveModel wave) async {
    _preloadWaveVideo(wave);
    _precacheThumbnail(wave);
  }

  void _precacheThumbnail(WaveModel wave) {
    if (wave.thumbnailUrl.isEmpty || !mounted) return;
    // Use CachedNetworkImage's built-in caching instead of precacheImage
    // CachedNetworkImage automatically handles caching and memory management
    // This is more efficient than Flutter's precacheImage for remote images
  }

  Future<void> _loadPulseMoments(String waveId) async {
    if (_pulseMoments.containsKey(waveId)) return;
    try {
      final data = await WaveService.getPulseMoments(waveId);
      if (!mounted) return;
      setState(() {
        _pulseMoments[waveId] = data.moments;
        _durations[waveId] = data.duration;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pulseMoments[waveId] = const <WavePulseMomentModel>[];
      });
    }
  }

  void _preloadWaveVideo(WaveModel wave) {
    if (_videoControllers.containsKey(wave.id) ||
        _initializingWaveIds.contains(wave.id)) {
      return;
    }

    // For active waves, always allow preloading even if previously failed
    // (the URL may have been refreshed). For non-active waves, skip if failed.
    if (_failedWaveIds.contains(wave.id) && !_isActiveWave(wave.id)) {
      return;
    }

    // Limit concurrent video controllers to prevent memory issues on low-end devices.
    // Unisoc chips in particular fail with NO_MEMORY when >3 decoders are alive.
    // Also count controllers that are still initializing to avoid limit bypass.
    // CRITICAL: If this is the active wave and we're at the limit, evict the
    // farthest non-active wave's controller to make room.
    const maxConcurrentControllers = 3;
    final isActive = _isActiveWave(wave.id);
    if ((_videoControllers.length + _initializingControllerCount) >= maxConcurrentControllers) {
      if (isActive) {
        // Evict the farthest non-active wave controller to make room for active wave
        String? farthestId;
        int farthestDistance = -1;
        for (final id in _videoControllers.keys) {
          final idx = _waves.indexWhere((w) => w.id == id);
          if (idx >= 0 && !_isActiveWave(id)) {
            final dist = (idx - _activeWaveIndex).abs();
            if (dist > farthestDistance) {
              farthestDistance = dist;
              farthestId = id;
            }
          }
        }
        if (farthestId != null) {
          _disposeWaveControllerById(farthestId);
        }
      } else {
        return;
      }
    }

    _initializingWaveIds.add(wave.id);
    _initializingControllerCount++;

    VideoPlayerController controller;
    try {
      controller = VideoPlayerController.networkUrl(
        Uri.parse(wave.videoUrl),
        videoPlayerOptions: VideoPlayerOptions(
          mixWithOthers: false,
          allowBackgroundPlayback: false,
        ),
      );
    } catch (e) {
      _initializingControllerCount--;
      _failedWaveIds.add(wave.id);
      debugPrint('[WaveScreen] Failed to create video controller for ${wave.id}: $e');
      return;
    }
    
    controller
        .initialize()
        .timeout(
          const Duration(seconds: 12),
          onTimeout: () {
            debugPrint('[WaveScreen] Video initialization timeout for ${wave.id}');
            throw TimeoutException('Video initialization timeout');
          },
        )
        .then((_) {
          if (!mounted) return;

          _initializingControllerCount--;
          _initializingWaveIds.remove(wave.id);
          controller.setLooping(!_autoscroll);
          controller.setVolume(_muted ? 0.0 : 1.0);
          controller.setPlaybackSpeed(_playbackSpeed);
          _videoControllers[wave.id] = controller;
          _durations[wave.id] = controller.value.duration.inSeconds;

          void listener() {
            if (!mounted || !controller.value.isInitialized) return;

            final position = controller.value.position;
            final total = controller.value.duration;

            if (_isActiveWave(wave.id)) {
              // Reduce setState frequency from every 220ms to every 500ms
              // to reduce rebuild load on the timeline and right rail widgets
              final prevMs = _lastTickMs[wave.id] ?? -1000;
              if ((position.inMilliseconds - prevMs).abs() >= 500) {
                _lastTickMs[wave.id] = position.inMilliseconds;
                setState(() {
                  _currentTimes[wave.id] = position.inMilliseconds / 1000.0;
                });
              }
            }

            final nearEnd =
                total.inMilliseconds > 0 &&
                position.inMilliseconds >= total.inMilliseconds - 220;

            if (nearEnd && (_endHandled[wave.id] ?? false) == false) {
              _endHandled[wave.id] = true;
              // Track the replay locally AND persist to backend
              if (_isActiveWave(wave.id)) {
                _updateWave(wave.id, (w) => w.copyWith(repeatPlayCount: w.repeatPlayCount + 1));
                // Persist rewatch count to backend - this ensures counts survive app restarts
                WaveService.trackView(wave.id);
                if (_autoscroll) {
                  _advanceWave();
                } else {
                  _floatingOverlayKey.currentState?.showReplay();
                }
              }
            }

            if (!nearEnd) {
              _endHandled[wave.id] = false;
            }
          }

          _videoListeners[wave.id] = listener;
          controller.addListener(listener);

          if (_isActiveWave(wave.id) &&
              (_accessDecisions[wave.id]?.allowed ?? false)) {
            controller.play();
          }

          setState(() {});
        })
        .catchError((error) {
          // CRITICAL: Always dispose the controller on init failure to release
          // the underlying ExoPlayer / MediaCodec. Without this, the hardware
          // decoder leaks and subsequent waves get NO_MEMORY on low-end chips.
          try {
            controller.dispose();
          } catch (_) {
            // ignore dispose errors on a failed controller
          }

          if (!mounted) return;
          _initializingControllerCount--;
          _initializingWaveIds.remove(wave.id);
          debugPrint('[WaveScreen] Failed to initialize video for ${wave.id}: $error');

          final retries = (_initRetryCount[wave.id] ?? 0) + 1;
          _initRetryCount[wave.id] = retries;

          // For active waves: ALWAYS attempt to refresh the signed URL and retry.
          // The most common cause of init failure is an expired signed URL or a
          // transient network issue -- NOT a permanent codec incompatibility.
          // Never permanently block active waves -- the user may scroll away and
          // come back, at which point _onPageChanged clears the failed state.
          if (isActive) {
            Future.delayed(const Duration(milliseconds: 800), () async {
              if (!mounted || !_isActiveWave(wave.id)) return;
              try {
                final refreshed = await WaveService.getWave(wave.id);
                if (!mounted || !_isActiveWave(wave.id)) return;
                final index = _waves.indexWhere((w) => w.id == wave.id);
                if (index >= 0) {
                  setState(() {
                    _waves[index] = refreshed;
                  });
                  _initRetryCount.remove(wave.id);
                  _failedWaveIds.remove(wave.id);
                  _preloadWaveVideo(_waves[index]);
                }
              } catch (_) {
                debugPrint('[WaveScreen] Failed to refresh URL for ${wave.id}');
              }
            });
          } else if (retries >= _maxInitRetries) {
            // Non-active waves that exhaust retries get temporarily blocked.
            // They will be retried if the user navigates back (_onPageChanged
            // clears failed state).
            _failedWaveIds.add(wave.id);
          }
        });
  }

  void _disposeWaveControllerById(String waveId) {
    final listener = _videoListeners.remove(waveId);
    final controller = _videoControllers.remove(waveId);
    if (controller != null) {
      if (controller.value.isInitialized) {
        controller.pause();
      }
      if (listener != null) {
        controller.removeListener(listener);
      }
      controller.dispose();
    }
    _currentTimes.remove(waveId);
    _lastTickMs.remove(waveId);
    _durations.remove(waveId);
    _endHandled.remove(waveId);
  }

  void _pruneControllers({required int centerIndex}) {
    if (_waves.isEmpty) return;
    final Set<String> keep = <String>{};
    for (
      int i = centerIndex - _controllerKeepDistance;
      i <= centerIndex + _controllerKeepDistance;
      i++
    ) {
      if (i >= 0 && i < _waves.length) {
        keep.add(_waves[i].id);
      }
    }

    final removeIds = _videoControllers.keys
        .where((id) => !keep.contains(id))
        .toList(growable: false);
    for (final waveId in removeIds) {
      _disposeWaveControllerById(waveId);
    }
  }

  void _markWaveSeen(String waveId) {
    if (waveId.isEmpty || _seenWaveIds.contains(waveId)) return;
    _seenWaveIds.add(waveId);
    _persistSeenWaveIds();
  }

  bool _isActiveWave(String waveId) {
    if (_activeWaveIndex < 0 || _activeWaveIndex >= _waves.length) return false;
    return _waves[_activeWaveIndex].id == waveId;
  }

  Future<String> _getChannelType(String channelId) async {
    if (_channelTypes.containsKey(channelId)) {
      return _channelTypes[channelId]!;
    }

    try {
      final channel = await ChannelService.getChannelById(channelId);
      final channelType = channel.type;
      _channelTypes[channelId] = channelType;
      return channelType;
    } catch (_) {
      // If we can't fetch channel type, assume public
      _channelTypes[channelId] = 'public';
      return 'public';
    }
  }

  /// Deduplicate exclusive channels by fetching access status in batch.
  /// Uses [WaveModel.belongsToExclusiveChannel] from the wave's `channelType`
  /// field instead of making N+1 API calls to fetch each channel separately.
  Future<Map<String, ExclusiveAccessStatusModel>> _fetchExclusiveAccessBatch(
    List<WaveModel> waves,
  ) async {
    final Map<String, ExclusiveAccessStatusModel> result = {};
    final uniqueExclusiveIds = waves
        .where((w) => w.belongsToExclusiveChannel)
        .map((w) => w.channelId)
        .toSet();
    for (final channelId in uniqueExclusiveIds) {
      try {
        result[channelId] = await ChannelService.getExclusiveAccessStatus(channelId);
      } catch (_) {
        // If fetch fails, treat as non-exclusive to avoid blocking content
        result[channelId] = ExclusiveAccessStatusModel(
          eligibleByKyc: false,
          hasActiveEntitlement: false,
          renewalRequired: false,
          expiresAt: null,
          monthlyFeeNgn: 0,
        );
      }
    }
    return result;
  }

  /// Filter waves based on exclusive channel membership and subscription status
  /// Implements the logic from the specification:
  /// - Exclusive channel waves: hide from non-members, show with gating for expired subscribers
  /// - Non-exclusive waves: apply age gating for 18+ content
  Future<List<WaveModel>> _filterWaves(List<WaveModel> waves) async {
    if (waves.isEmpty) return waves;

    try {
      final user = await AuthService.getCurrentUser();
      final filteredWaves = <WaveModel>[];
      
      // Batch-fetch exclusive access status for all exclusive waves at once
      // instead of N+1 sequential API calls per wave
      final exclusiveAccessCache = await _fetchExclusiveAccessBatch(waves);

      for (final wave in waves) {
        // Use wave.belongsToExclusiveChannel from the WaveModel's channelType field
        // This avoids fetching each channel individually via getChannelById
        if (wave.belongsToExclusiveChannel) {
          final accessStatus = exclusiveAccessCache[wave.channelId];
          
          if (accessStatus == null || !accessStatus.eligibleByKyc) {
            // Non-members must never know the content exists - HIDE_WAVE_COMPLETELY
            continue;
          }

          if (accessStatus.hasActiveEntitlement) {
            // Active subscribers - SHOW_WAVE, REMOVE_ALL_GATING, REMOVE_AGE_RESTRICTIONS, REMOVE_BLUR_OVERLAYS
            filteredWaves.add(wave);
            _accessDecisions[wave.id] = const WaveAccessDecision(
              allowed: true,
              requiresConsent: false,
              reason: null,
              code: 'EXCLUSIVE_ACTIVE_SUBSCRIBER',
            );
          } else {
            // Expired subscribers - SHOW_WAVE with renewal gating
            filteredWaves.add(wave);
            _accessDecisions[wave.id] = const WaveAccessDecision(
              allowed: false,
              requiresConsent: false,
              reason: 'Your subscription has expired. Renew to continue viewing this content.',
              code: 'EXCLUSIVE_SUBSCRIPTION_EXPIRED',
            );
          }
        } else {
          // Regular non-exclusive wave
          if (wave.isAdultContent) {
            if (user.kycVerified) {
              filteredWaves.add(wave);
            } else {
              filteredWaves.add(wave);
              _accessDecisions[wave.id] = const WaveAccessDecision(
                allowed: false,
                requiresConsent: false,
                reason: 'KYC verification is required to view 18+ content.',
                code: 'AGE_RESTRICTION_KYC_REQUIRED',
              );
            }
          } else {
            filteredWaves.add(wave);
            // Pre-authorize public non-adult waves so playback starts immediately
            // without waiting for a redundant backend access check.
            _accessDecisions[wave.id] = const WaveAccessDecision(
              allowed: true,
              requiresConsent: false,
              reason: null,
              code: 'PUBLIC_CONTENT',
            );
          }
        }
      }

      return filteredWaves;
    } catch (e) {
      return waves;
    }
  }

  Widget _buildAgeVerificationOverlay(
    String actionLabel,
    VoidCallback action,
    WaveAccessDecision decision,
  ) {
    return Positioned.fill(
      child: ClipRect(
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 50, sigmaY: 50),
          child: Container(
            color: Colors.black.withValues(alpha: 1.0),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.lock_rounded,
                  color: AppColors.lightOrange,
                  size: 48,
                ),
                const SizedBox(height: 16),
                const Text(
                  'This content is restricted to verified adult viewers',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  decision.reason ??
                      'You must complete KYC verification to view adult content.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 20),
                AppButton(label: actionLabel, onPressed: action),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _advanceWave,
                  child: const Text(
                    'Skip this wave',
                    style: TextStyle(color: AppColors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRenewalGatingOverlay(
    WaveModel wave,
    WaveAccessDecision decision,
  ) {
    return Positioned.fill(
      child: ClipRect(
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 25, sigmaY: 25),
          child: Container(
            color: Colors.black.withValues(alpha: 0.7),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.card_membership_rounded,
                  color: AppColors.lightOrange,
                  size: 48,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Subscription Expired',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  decision.reason ??
                      'Your subscription has expired. Renew to continue viewing this content.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 20),
                AppButton(
                  label: 'Renew Subscription',
                  onPressed: () {
                    Navigator.pushNamed(
                      context,
                      '/exclusive-access',
                      arguments: wave.channelId,
                    );
                  },
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _advanceWave,
                  child: const Text(
                    'Skip this wave',
                    style: TextStyle(color: AppColors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _pauseAll() {
    for (final controller in _videoControllers.values) {
      if (controller.value.isInitialized) {
        controller.pause();
      }
    }
  }

  Future<void> _ensureWaveAccessAndPlay({bool force = false}) async {
    if (_activeWaveIndex < 0 || _activeWaveIndex >= _waves.length) return;

    final active = _waves[_activeWaveIndex];
    final existing = _accessDecisions[active.id];
    
    // Exclusive active subscribers bypass all gating including age restrictions
    // Always preserve client-side decision for exclusive active subscribers
    // This check must happen BEFORE any backend call to prevent override
    if (existing != null && existing.code == 'EXCLUSIVE_ACTIVE_SUBSCRIBER') {
      _playActiveWave();
      return;
    }
    
    if (!force && existing != null && existing.allowed) {
      _playActiveWave();
      return;
    }

    setState(() {
      _checkingAccessWaveId = active.id;
    });

    try {
      final decision = await WaveService.checkAccess(
        active.id,
        sessionId: _waveSessionId,
      );

      if (!mounted || !_isActiveWave(active.id)) return;

      var resolved = decision;
      if (resolved.requiresConsent && _adultConsentAccepted) {
        resolved = WaveAccessDecision(
          allowed: true,
          requiresConsent: false,
          reason: null,
          code: resolved.code,
        );
      }

      setState(() {
        _accessDecisions[active.id] = resolved;
      });

      if (resolved.allowed) {
        _playActiveWave();
      } else {
        _pauseAll();
      }
    } catch (_) {
      if (!mounted || !_isActiveWave(active.id)) return;
      setState(() {
        _accessDecisions[active.id] = const WaveAccessDecision(
          allowed: false,
          requiresConsent: false,
          reason: 'Unable to verify content access right now',
          code: 'ACCESS_CHECK_FAILED',
        );
      });
      _pauseAll();
    } finally {
      if (mounted && _checkingAccessWaveId == active.id) {
        setState(() {
          _checkingAccessWaveId = null;
        });
      }
    }
  }

  Future<void> _confirmAdultConsent(WaveModel wave) async {
    setState(() {
      _adultConsentAccepted = true;
    });

    if (_isAuthenticated) {
      try {
        await WaveService.acknowledgeAdultConsent(wave.id, _waveSessionId);
      } catch (_) {
        // Ignore transient consent acknowledgement failures.
      }
    }

    await _ensureWaveAccessAndPlay(force: true);
  }

  void _playActiveWave() {
    if (_activeWaveIndex < 0 || _activeWaveIndex >= _waves.length) return;
    final active = _waves[_activeWaveIndex];
    final decision = _accessDecisions[active.id];
    if (decision != null && !decision.allowed) return;
    final controller = _videoControllers[active.id];
    if (controller == null) {
      // Controller doesn't exist yet (limit was hit or not preloaded).
      // Start preloading NOW and schedule a retry after the typical init time.
      _preloadWave(active);
      // Retry after 2s to catch the case where preload succeeded but
      // _playActiveWave was called before it completed.
      Future.delayed(const Duration(milliseconds: 2000), () {
        if (!mounted || !_isActiveWave(active.id)) return;
        final retryController = _videoControllers[active.id];
        if (retryController != null && retryController.value.isInitialized &&
            (_accessDecisions[active.id]?.allowed ?? false)) {
          retryController.play();
        }
      });
      return;
    }
    if (controller.value.isInitialized) {
      controller.play();
    }
  }

  Future<void> _onPageChanged(int index) async {
    if (!mounted) return;
    if (index < 0 || index >= _waves.length) return;
    _pauseAll();
    setState(() {
      _activeWaveIndex = index;
    });

    // CRITICAL: Prune old controllers FIRST before preloading new ones.
    // This frees up controller slots so the active wave's video controller
    // can be created instead of being blocked by the maxConcurrentControllers limit.
    _pruneControllers(centerIndex: index);

    // Clear any previous failed state for the wave the user just scrolled to,
    // so it gets a fresh attempt with a new signed URL.
    final activeWaveId = _waves[index].id;
    _failedWaveIds.remove(activeWaveId);
    _initRetryCount.remove(activeWaveId);

    _preloadWave(_waves[index]);
    _markWaveSeen(_waves[index].id);
    _loadPulseMoments(_waves[index].id);
    _loadChannelFollowStatus(_waves[index]);

    // Track view when user navigates to a wave - this increments repeat_play_count
    // and also records unique views for viewCount
    WaveService.trackView(_waves[index].id);

    // Preload adjacent waves with staggered delays. Low-end chips (Unisoc)
    // cannot handle multiple simultaneous decoder initializations — spacing
    // them out prevents NO_MEMORY codec errors.
    if (index + 1 < _waves.length) {
      await Future.delayed(const Duration(milliseconds: 150));
      if (!mounted) return;
      _preloadWave(_waves[index + 1]);
    }
    if (index + 2 < _waves.length) {
      await Future.delayed(const Duration(milliseconds: 150));
      if (!mounted) return;
      _preloadWave(_waves[index + 2]);
    }
    if (index - 1 >= 0) {
      await Future.delayed(const Duration(milliseconds: 150));
      if (!mounted) return;
      _preloadWave(_waves[index - 1]);
    }

    // Access decisions are already set by _filterWaves, no need to call backend check
    _ensureWaveAccessAndPlay(force: false);

    if (index >= _waves.length - 3) {
      _loadMore();
    }
  }

  void _advanceWave() {
    if (!mounted) return;
    if (_activeWaveIndex >= _waves.length - 1) return;
    if (!_pageController.hasClients) return;
    _pageController.nextPage(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOut,
    );
  }

  Future<void> _toggleAutoscroll() async {
    setState(() {
      _autoscroll = !_autoscroll;
      _autoscrollBadgeLabel =
          _autoscroll ? 'Autoscroll enabled' : 'Autoscroll disabled';
      _autoscrollBadgeKey = DateTime.now().microsecondsSinceEpoch;
    });
    for (final controller in _videoControllers.values) {
      if (controller.value.isInitialized) {
        await controller.setLooping(!_autoscroll);
      }
    }
  }

  Future<void> _toggleMute() async {
    final nextMuted = !_muted;
    setState(() => _muted = nextMuted);
    for (final controller in _videoControllers.values) {
      if (controller.value.isInitialized) {
        await controller.setVolume(nextMuted ? 0.0 : 1.0);
      }
    }
  }

  void _togglePlaybackSpeedBar() {
    setState(() => _showPlaybackSpeedBar = !_showPlaybackSpeedBar);
  }

  void _toggleHideAllUI() {
    setState(() => _hideAllUI = !_hideAllUI);
  }

  Future<void> _loadChannelFollowStatus(WaveModel wave) async {
    try {
      final status = await ChannelService.getChannelFollowStatus(wave.channelId);
      if (!mounted) return;
      setState(() => _isFollowingChannel = status.followed);
    } catch (_) {
      if (!mounted) setState(() => _isFollowingChannel = false);
    }
  }

  Future<void> _toggleChannelFollow(WaveModel wave) async {
    if (_channelFollowLoading) return;
    setState(() => _channelFollowLoading = true);
    try {
      final wasFollowing = _isFollowingChannel;
      final status = wasFollowing
          ? await ChannelService.unfollowChannel(wave.channelId)
          : await ChannelService.followChannel(wave.channelId);
      if (!mounted) return;
      setState(() => _isFollowingChannel = status.followed);

      // Success toast + notification
      if (!wasFollowing && status.followed) {
        _showSnack('Now following ${wave.channelName}');
        await _notifyChannelFollowed(wave);
      } else if (wasFollowing && !status.followed) {
        _showSnack('Unfollowed ${wave.channelName}');
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update follow status')),
      );
    } finally {
      if (mounted) setState(() => _channelFollowLoading = false);
    }
  }

  Future<void> _notifyChannelFollowed(WaveModel wave) async {
    const channelId = 'afrovision_channel_follows';
    const channelName = 'Channel Follows';
    const channelDesc = 'Notifications when you follow channels';
    try {
      final androidPlugin = FlutterLocalNotificationsPlugin()
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          channelId,
          channelName,
          description: channelDesc,
          importance: Importance.defaultImportance,
        ),
      );
    } catch (_) {}
    try {
      await FlutterLocalNotificationsPlugin().show(
        wave.channelId.hashCode,
        'Following ${wave.channelName}',
        'You will receive updates when ${wave.channelName} goes live or posts new waves.',
        NotificationDetails(
          android: AndroidNotificationDetails(
            channelId,
            channelName,
            channelDescription: channelDesc,
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
            icon: 'ic_stat_notification',
          ),
          iOS: const DarwinNotificationDetails(),
        ),
      );
    } catch (_) {}
  }

  Future<void> _setPlaybackSpeed(double speed) async {
    setState(() {
      _playbackSpeed = speed;
      _showPlaybackSpeedBar = false;
    });
    for (final controller in _videoControllers.values) {
      if (controller.value.isInitialized) {
        await controller.setPlaybackSpeed(speed);
      }
    }
  }

  Future<void> _toggleImmersiveFullscreen() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    if (mounted) setState(() {});
  }

  Future<void> _restoreSystemUi() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  Future<void> _onPulse(WaveModel wave, int intensity) async {
    try {
      final currentSeconds = (_currentTimes[wave.id] ?? 0).round();
      await WaveService.addPulse(
        wave.id,
        intensity: intensity,
        momentSeconds: currentSeconds,
      );
      if (!mounted) return;
      _updateWave(wave.id, (w) => w.copyWith(pulseCount: w.pulseCount + 1));
      _applyLocalPulseMoment(wave.id, currentSeconds, intensity);
      _floatingOverlayKey.currentState?.showPulse();
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  void _applyLocalPulseMoment(String waveId, int second, int intensity) {
    if (!mounted) return;
    final moments = List<WavePulseMomentModel>.from(
      _pulseMoments[waveId] ?? const <WavePulseMomentModel>[],
    );
    final idx = moments.indexWhere((m) => m.second == second);
    if (idx == -1) {
      moments.add(
        WavePulseMomentModel(second: second, intensitySum: intensity),
      );
    } else {
      final current = moments[idx];
      moments[idx] = WavePulseMomentModel(
        second: current.second,
        intensitySum: current.intensitySum + intensity,
      );
    }
    setState(() {
      _pulseMoments[waveId] = moments;
    });
  }

  Future<void> _onBookmark(WaveModel wave) async {
    try {
      final bookmarked = await WaveService.toggleBookmark(wave.id);
      if (!mounted) return;
      _updateWave(wave.id, (w) => w.copyWith(bookmarked: bookmarked));
      if (bookmarked) _floatingOverlayKey.currentState?.showSave();
      _showSnack(
        bookmarked
            ? 'Saved to your library'
            : 'Removed from your saves',
      );
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _onInterest(WaveModel wave, String signal) async {
    try {
      await WaveService.setInterest(wave.id, signal);
      _showSnack(
        signal == 'interested'
            ? 'Marked as interested'
            : 'Marked as not interested',
      );
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _onReport(WaveModel wave) async {
    final result = await showModalBottomSheet<_ReportResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WaveReportSheet(waveTitle: wave.title),
    );
    if (result == null || !mounted) return;
    try {
      await WaveService.reportWave(
        wave.id,
        result.category,
        details: result.details,
      );
      if (!mounted) return;
      _showSnack('Report submitted. Thank you for keeping AfroVision safe.');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  void _seekWave(WaveModel wave, double seconds) {
    final controller = _videoControllers[wave.id];
    if (controller == null || !controller.value.isInitialized) return;
    controller.seekTo(Duration(milliseconds: (seconds * 1000).toInt()));
  }

  void _updateWave(String waveId, WaveModel Function(WaveModel) mutate) {
    if (!mounted) return;
    final index = _waves.indexWhere((w) => w.id == waveId);
    if (index == -1) return;
    setState(() {
      _waves[index] = mutate(_waves[index]);
    });
  }

  void _showCommentsSheet(WaveModel wave) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WaveCommentsSheet(
        waveId: wave.id,
        count: wave.commentCount,
        onCountChanged: (newCount) {
          _updateWave(wave.id, (w) => w.copyWith(commentCount: newCount));
        },
        onCommentPosted: () => _floatingOverlayKey.currentState?.showComment(),
        onReactionToggled: () => _floatingOverlayKey.currentState?.showReaction(),
      ),
    );
  }

  String _waveShareUrl(WaveModel wave) {
    final fallbackUrl =
        'https://play.google.com/store/apps/details?id=com.afrovision.afrovision';
    final encodedFallback = Uri.encodeComponent(fallbackUrl);
    return 'intent://wave?wave_id=${Uri.encodeComponent(wave.id)}#Intent;scheme=afrovision;package=com.afrovision.afrovision;S.browser_fallback_url=$encodedFallback;end';
  }

  String _waveShareText(WaveModel wave) {
    return 'Watch "${wave.title}" by ${wave.creatorName} on AfroVision:\n${_waveShareUrl(wave)}';
  }

  Future<Uint8List?> _captureWaveFrame(WaveModel wave) async {
    final key = _wavePreviewKeys[wave.id];
    if (key == null) return null;

    await SchedulerBinding.instance.endOfFrame;
    if (!mounted) return null;

    final previewContext = key.currentContext;
    if (previewContext == null) return null;

    // ignore: use_build_context_synchronously
    final renderObject = previewContext.findRenderObject();
    if (renderObject is! RenderRepaintBoundary) return null;

    try {
      final image = await renderObject.toImage(pixelRatio: 1.25);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return null;
      return byteData.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  Future<void> _shareWave(WaveModel wave) async {
    final shareText = _waveShareText(wave);
    final imageBytes = await _captureWaveFrame(wave);
    final shareFiles = imageBytes == null
        ? <XFile>[]
        : <XFile>[
            XFile.fromData(
              imageBytes,
              mimeType: 'image/png',
              name: 'afrovision-wave-${wave.id}.png',
            ),
          ];

    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          child: Stack(
            children: [
              Positioned.fill(
                child: BackdropFilter(
                  filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: const DecoratedBox(
                    decoration: BoxDecoration(
                      color: Color(0x5E0A1E3A),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      border: Border(
                        top: BorderSide(color: Color(0x99FFD700), width: 0.9),
                        left: BorderSide(color: Color(0x28FFD700), width: 0.5),
                        right: BorderSide(color: Color(0x28FFD700), width: 0.5),
                      ),
                    ),
                  ),
                ),
              ),
              SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                      Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFD700).withValues(alpha: 0.45),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          const Icon(Icons.share_rounded, color: Color(0xFFFFD700), size: 18),
                          const SizedBox(width: 8),
                          const Text(
                            'Share Wave',
                            style: TextStyle(
                              color: Color(0xFFFFD700),
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            wave.channelName,
                            style: TextStyle(
                              color: const Color(0xFFFFD700).withValues(alpha: 0.55),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        wave.title,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.60),
                          fontSize: 12,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Container(
                        height: 1,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              const Color(0xFFFFD700).withValues(alpha: 0.0),
                              const Color(0xFFFFD700).withValues(alpha: 0.60),
                              const Color(0xFFFFD700).withValues(alpha: 0.0),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      GestureDetector(
                        onTap: () async {
                          Navigator.pop(context);
                          await SharePlus.instance.share(
                            ShareParams(
                              text: shareText,
                              subject: wave.title,
                              files: shareFiles,
                            ),
                          );
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFD700).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: const Color(0xFFFFD700).withValues(alpha: 0.80),
                              width: 1,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFFFD700).withValues(alpha: 0.18),
                                blurRadius: 12,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.chat_rounded, size: 16, color: Color(0xFFFFD700)),
                              SizedBox(width: 8),
                              Text(
                                'WhatsApp Contact',
                                style: TextStyle(
                                  color: Color(0xFFFFD700),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      GestureDetector(
                        onTap: () async {
                          Navigator.pop(context);
                          await SharePlus.instance.share(
                            ShareParams(
                              text: shareText,
                              subject: wave.title,
                              files: shareFiles,
                            ),
                          );
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF010D1A).withValues(alpha: 0.70),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: const Color(0xFFFFD700).withValues(alpha: 0.35),
                              width: 0.8,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.more_horiz_rounded, size: 16, color: const Color(0xFFFFD700).withValues(alpha: 0.70)),
                              const SizedBox(width: 8),
                              Text(
                                'WhatsApp Status / More',
                                style: TextStyle(
                                  color: const Color(0xFFFFD700).withValues(alpha: 0.70),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          // Placeholder — Myngul share API to be wired in later
                          _showSnack('Shared to Myngul (coming soon)');
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0C2142).withValues(alpha: 0.85),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: const Color(0xFFFFD700).withValues(alpha: 0.50),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.link_rounded, size: 16, color: const Color(0xFFFFD700).withValues(alpha: 0.70)),
                              const SizedBox(width: 8),
                              Text(
                                'Share to Myngul',
                                style: TextStyle(
                                  color: const Color(0xFFFFD700).withValues(alpha: 0.70),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showOptionsSheet(WaveModel wave) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _WaveOptionsSheet(
        autoscroll: _autoscroll,
        onToggleAutoscroll: _toggleAutoscroll,
        onRefreshFeed: _refreshFeedFromOptions,
        onToggleFullscreen: _toggleImmersiveFullscreen,
        onInterested: () => _onInterest(wave, 'interested'),
        onNotInterested: () => _onInterest(wave, 'not_interested'),
        onReport: () => _onReport(wave),
      ),
    );
  }

  void _showSnack(String message) {
    if (!mounted) return;
    final overlay = Overlay.of(context);
    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _ToastOverlay(
        message: message,
        onDone: () {
          if (entry.mounted) entry.remove();
        },
      ),
    );
    overlay.insert(entry);
    Future.delayed(const Duration(milliseconds: 2800), () {
      if (entry.mounted) entry.remove();
    });
  }

  String _formatCount(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  /// Render the combined age + content label string like "18+ S.N.L.V"
  /// Uses WaveModel.contentLabels which compiles all active flags.
  String _contentLabelText(WaveModel wave) {
    return wave.contentLabels;
  }

  Color _ageBadgeBg(WaveModel wave) {
    if (wave.ageClassification == 'adult') {
      return const Color(0xFF8B0000).withValues(alpha: 0.85);
    }
    if (wave.ageClassification == 'minor_safe') {
      return const Color(0xFF0A4D1E).withValues(alpha: 0.82);
    }
    return const Color(0xFF7A3B00).withValues(alpha: 0.82);
  }

  Color _ageBadgeBorder(WaveModel wave) {
    if (wave.ageClassification == 'adult') {
      return AppColors.errorRed;
    }
    if (wave.ageClassification == 'minor_safe') {
      return AppColors.successGreen;
    }
    return AppColors.orange;
  }

  bool _isAdultWave(WaveModel wave) => wave.ageClassification == 'adult';

  bool _isExclusiveWave(WaveModel wave) {
    final code = (_accessDecisions[wave.id]?.code ?? '').toUpperCase();
    return code == 'EXCLUSIVE_ENTITLEMENT_REQUIRED' ||
        code == 'EXCLUSIVE_PIC_REQUIRED';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: _loading
            ? _buildLoadingState()
            : _error != null
            ? _buildErrorState()
            : _waves.isEmpty
            ? _buildEmptyState()
            : _buildWavePager(),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
          ),
          SizedBox(height: 16),
          Text('Loading Waves...', style: TextStyle(color: AppColors.white)),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.wifi_off_rounded,
              color: AppColors.lightOrange,
              size: 42,
            ),
            const SizedBox(height: 12),
            const Text(
              'Unable to load Waves',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'A temporary error occurred.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.hintText, fontSize: 13),
            ),
            const SizedBox(height: 18),
            AppButton(label: 'Retry', onPressed: _loadInitial, width: 220),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.video_collection_rounded,
              color: AppColors.lightOrange,
              size: 42,
            ),
            const SizedBox(height: 12),
            const Text(
              'No Waves yet',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _isCreator
                  ? 'Start publishing your first Wave from Creator Studio.'
                  : 'Pull to refresh or explore channels while the feed updates.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.hintText, fontSize: 13),
            ),
            const SizedBox(height: 18),
            AppButton(
              label: _isCreator ? 'Open Creator Studio' : 'Explore Channels',
              onPressed: () {
                Navigator.pushNamed(
                  context,
                  _isCreator ? '/creator-studio' : '/channels',
                );
              },
              width: 250,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWavePager() {
    return Stack(
      children: [
        GestureDetector(
          onVerticalDragEnd: (details) {
            final velocity = details.primaryVelocity ?? 0;
            if (velocity > 900 && _activeWaveIndex == 0) {
              _reloadFeed();
            }
          },
          child: PageView.builder(
            controller: _pageController,
            scrollDirection: Axis.vertical,
            itemCount: _waves.length,
            onPageChanged: _onPageChanged,
            itemBuilder: (_, index) {
              final wave = _waves[index];
              final isActive = index == _activeWaveIndex;
              return _buildWaveCard(wave, isActive: isActive);
            },
          ),
        ),
        if (_autoscrollBadgeKey != null)
          Positioned(
            bottom: 140,
            left: 0,
            right: 0,
            child: Center(
              child: _AutoscrollConfirmationBadge(
                key: ValueKey(_autoscrollBadgeKey),
                label: _autoscrollBadgeLabel,
                onDone: () => setState(() => _autoscrollBadgeKey = null),
              ),
            ),
          ),
        Positioned.fill(
          child: _LocalFloatingOverlay(key: _floatingOverlayKey),
        ),
      ],
    );
  }

  Widget _buildWaveCard(WaveModel wave, {required bool isActive}) {
    final controller = _videoControllers[wave.id];
    final isReady = controller != null && controller.value.isInitialized;
    final isPlaying = isReady && controller.value.isPlaying;
    final decision = _accessDecisions[wave.id];
    final checking = _checkingAccessWaveId == wave.id;
    final isBlocked =
        isActive && !checking && decision != null && !decision.allowed;
    final current = _currentTimes[wave.id] ?? 0;
    final duration = _durations[wave.id] ?? wave.duration;
    final moments = _pulseMoments[wave.id] ?? const <WavePulseMomentModel>[];

    return GestureDetector(
      onTap: () {
        if (isBlocked || checking) return;
        if (isReady) {
          if (isPlaying) {
            controller.pause();
          } else {
            controller.play();
          }
          setState(() {});
        }
      },
      child: Stack(
        children: [
          Positioned.fill(
            child: RepaintBoundary(
              key: _wavePreviewKeys.putIfAbsent(wave.id, GlobalKey.new),
              child: Stack(
                children: [
                  // Always show blurred thumbnail background (removes black bars)
                  if (wave.thumbnailUrl.isNotEmpty)
                    Positioned.fill(
                      child: ClipRect(
                        child: ImageFiltered(
                          imageFilter: ui.ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                          child: CachedNetworkImage(
                            imageUrl: wave.thumbnailUrl,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                  // Thumbnail (or video) layer
                  // Video fades in once a real frame is available to avoid
                  // the top-left-corner glitch on first render
                  if (isReady)
                    Positioned.fill(
                      child: AnimatedOpacity(
                        opacity: controller.value.size.width > 0 ? 1.0 : 0.0,
                        duration: const Duration(milliseconds: 220),
                        child: Center(
                          child: AspectRatio(
                            aspectRatio: controller.value.aspectRatio > 0 &&
                                    !controller.value.aspectRatio.isNaN &&
                                    !controller.value.aspectRatio.isInfinite
                                ? controller.value.aspectRatio
                                : 9 / 16,
                            child: VideoPlayer(controller),
                          ),
                        ),
                      ),
                    ),
                  if (!isReady)
                    Positioned.fill(
                      child: wave.thumbnailUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: wave.thumbnailUrl,
                              fit: BoxFit.cover,
                              memCacheWidth: 400,
                              memCacheHeight: 711,
                            )
                          : const SizedBox.shrink(),
                    ),
                ],
              ),
            ),
          ),
          if (isActive && !isPlaying)
            const Center(
              child: Icon(
                Icons.play_arrow_rounded,
                color: AppColors.white,
                size: 66,
              ),
            ),
          if (isActive && _showPlaybackSpeedBar)
            Positioned(
              top: 46,
              left: 12,
              right: 12,
              child: SafeArea(
                bottom: false,
                child: _buildPlaybackSpeedBar(),
              ),
            ),
          if (!_hideAllUI)
            Positioned(
              top: 6,
              right: 8,
              child: SafeArea(
                bottom: false,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _AgeRatingBadge(
                      label: _contentLabelText(wave),
                      background: _ageBadgeBg(wave),
                      border: _ageBadgeBorder(wave),
                      pulsate: _isAdultWave(wave),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        IconButton(
                          onPressed: () => _showOptionsSheet(wave),
                          icon: const Icon(
                            Icons.more_vert_rounded,
                            color: AppColors.white,
                          ),
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.black.withValues(alpha: 0.35),
                          ),
                        ),
                        const SizedBox(height: 6),
                        _AutoplayStatusIcon(
                          enabled: _autoscroll,
                          onTap: _toggleAutoscroll,
                        ),
                        const SizedBox(height: 6),
                        _WaveMiniControl(
                          active: _showPlaybackSpeedBar,
                          icon: Icons.speed_rounded,
                          onTap: _togglePlaybackSpeedBar,
                        ),
                        const SizedBox(height: 6),
                        _WaveMiniControl(
                          active: _muted,
                          icon: _muted
                              ? Icons.volume_off_rounded
                              : Icons.volume_up_rounded,
                          onTap: _toggleMute,
                        ),
                        const SizedBox(height: 6),
                        _WaveMiniControl(
                          active: _hideAllUI,
                          icon: _hideAllUI
                              ? Icons.visibility_off_rounded
                              : Icons.visibility_rounded,
                          onTap: _toggleHideAllUI,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          // When UI is hidden, show a small floating restore button in top-right
          if (_hideAllUI)
            Positioned(
              top: 10,
              right: 10,
              child: SafeArea(
                bottom: false,
                child: GestureDetector(
                  onTap: _toggleHideAllUI,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.45),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.15),
                        width: 0.8,
                      ),
                    ),
                    child: const Icon(
                      Icons.visibility_rounded,
                      size: 16,
                      color: Colors.white70,
                    ),
                  ),
                ),
              ),
            ),
          // EXCLUSIVE badge — shown in top-left when this wave has exclusive gating
          if (!_hideAllUI && _isExclusiveWave(wave))
            Positioned(
              top: 10,
              left: 10,
              child: SafeArea(
                bottom: false,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.orange, AppColors.lightOrange],
                    ),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.workspace_premium_rounded,
                        color: AppColors.darkBlue,
                        size: 10,
                      ),
                      SizedBox(width: 3),
                      Text(
                        'EXCLUSIVE',
                        style: TextStyle(
                          color: AppColors.darkBlue,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (!_hideAllUI)
            Positioned(
              left: 12,
              right: 80,
              bottom: 78,
              child: _buildContentOverlay(wave),
            ),
          if (!_hideAllUI)
            Positioned(right: 0, top: 0, bottom: 0, child: _buildRightRail(wave)),
          // Brand/Channel card overlay (slides up from bottom)
          if (!_hideAllUI)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _buildChannelCard(wave),
            ),
          if (!_hideAllUI)
            Positioned(
              left: 10,
              right: 10,
              bottom: 10,
              child: _EcgTimeline(
              durationSeconds: duration,
              currentTimeSeconds: current,
              moments: moments,
              onSeek: (seconds) => _seekWave(wave, seconds),
            ),
          ),
          if (isActive && checking)
            const Center(
              child: CircularProgressIndicator(color: AppColors.orange),
            ),
          if (isBlocked) _buildBlockedOverlay(wave, decision),
        ],
      ),
    );
  }

  Widget _buildPlaybackSpeedBar() {
    const speeds = <double>[2.0, 1.5, 1.0, 0.5, 0.15];
    const kGold = Color(0xFFFFD700);
    return Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 14, sigmaY: 14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF0A1E3A).withValues(alpha: 0.62),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: kGold.withValues(alpha: 0.45),
                width: 0.8,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final speed in speeds)
                  GestureDetector(
                    onTap: () => _setPlaybackSpeed(speed),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: _playbackSpeed == speed
                            ? kGold.withValues(alpha: 0.95)
                            : Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        speed == 1.0 ? '1x' : '${speed}x',
                        style: TextStyle(
                          color: _playbackSpeed == speed
                              ? AppColors.darkBlue
                              : AppColors.white.withValues(alpha: 0.86),
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }

  Widget _buildBlockedOverlay(WaveModel wave, WaveAccessDecision decision) {
    String actionLabel = 'Skip Wave';
    VoidCallback action = _advanceWave;

    final code = (decision.code ?? '').toUpperCase();
    final bool isExclusiveBlocked =
        code == 'EXCLUSIVE_ENTITLEMENT_REQUIRED' ||
        code == 'EXCLUSIVE_PIC_REQUIRED';

    // Handle exclusive subscription expiry - show renewal gating overlay
    if (code == 'EXCLUSIVE_SUBSCRIPTION_EXPIRED') {
      return _buildRenewalGatingOverlay(wave, decision);
    }

    // Handle age restriction KYC requirement - show age verification overlay
    if (code == 'AGE_RESTRICTION_KYC_REQUIRED') {
      actionLabel = 'Complete KYC Verification';
      action = () {
        Navigator.pushNamed(context, '/kyc-verification');
      };
      return _buildAgeVerificationOverlay(actionLabel, action, decision);
    }

    // Skip age verification blocker for exclusive channel waves
    // Exclusive channel members are already KYC verified (over 18) as part of subscription
    // Only KYC-verified members can access exclusive channels, so no need for age consent
    // Check if the decision code contains EXCLUSIVE (any exclusive-related code)
    if (decision.requiresConsent && code.contains('EXCLUSIVE')) {
      // Allow the wave to play without age blocker for exclusive channels
      return const SizedBox.shrink();
    }

    // If requiresConsent but code doesn't contain EXCLUSIVE, fetch channel type to check
    if (decision.requiresConsent) {
      return FutureBuilder<String>(
        future: _getChannelType(wave.channelId),
        builder: (context, snapshot) {
          final channelType = snapshot.data ?? 'public';
          
          // Skip age blocker if channel is exclusive
          if (channelType == 'exclusive') {
            return const SizedBox.shrink();
          }

          // Show age verification blocker for public channels
          actionLabel = 'I am 18+ Continue';
          action = () {
            _confirmAdultConsent(wave);
          };

          return _buildAgeVerificationOverlay(actionLabel, action, decision);
        },
      );
    }

    if (decision.requiresConsent) {
      actionLabel = 'I am 18+ Continue';
      action = () {
        _confirmAdultConsent(wave);
      };
    } else {
      if (code == 'AUTH_REQUIRED' || code == 'EXCLUSIVE_LOGIN_REQUIRED') {
        actionLabel = 'Login';
        action = () {
          Navigator.pushNamed(context, '/login').then((_) {
            if (!mounted) return;
            _loadInitial();
          });
        };
      } else if (code == 'KYC_REQUIRED' ||
          code == 'TEEN_RESTRICTED' ||
          code == 'EXCLUSIVE_KYC_REQUIRED') {
        actionLabel = 'Complete KYC';
        action = () {
          Navigator.pushNamed(context, '/kyc').then((_) {
            if (!mounted) return;
            _ensureWaveAccessAndPlay(force: true);
          });
        };
      } else if (isExclusiveBlocked) {
        actionLabel = 'Subscribe — Get Access';
        action = () {
          Navigator.pushNamed(
            context,
            '/exclusive-access',
            arguments: wave.channelId,
          ).then((_) {
            if (!mounted) return;
            _ensureWaveAccessAndPlay(force: true);
          });
        };
      }
    }

    // Premium blur overlay for exclusive content
    if (isExclusiveBlocked) {
      return Positioned.fill(
        child: ClipRect(
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: Container(
              color: Colors.black.withValues(alpha: 0.55),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.orange, AppColors.lightOrange],
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'EXCLUSIVE CONTENT',
                      style: TextStyle(
                        color: AppColors.darkBlue,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Icon(
                    Icons.workspace_premium_rounded,
                    color: AppColors.lightOrange,
                    size: 44,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Members Only',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    decision.reason ??
                        'This wave is exclusive to channel subscribers.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Subscribe to unlock this and all exclusive waves from this channel.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.goldText,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 18),
                  AppButton(label: actionLabel, onPressed: action),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _advanceWave,
                    child: const Text(
                      'Skip this wave',
                      style: TextStyle(color: AppColors.white),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.62),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.cardBg.withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.lock_rounded,
                color: AppColors.lightOrange,
                size: 28,
              ),
              const SizedBox(height: 10),
              Text(
                decision.reason ??
                    'This content is not available for your account.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),
              AppButton(label: actionLabel, onPressed: action),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _advanceWave,
                child: const Text(
                  'Skip this wave',
                  style: TextStyle(color: AppColors.goldText),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRightRail(WaveModel wave) {
    final channelLogoUrl = wave.channelLogoUrl != null && wave.channelLogoUrl!.isNotEmpty
        ? AppConfig.mediaUrl(wave.channelLogoUrl!)
        : null;
    return SizedBox(
      width: 58,
      child: SafeArea(
        left: false,
        top: false,
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 80, top: 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _railItem(
                icon: Icons.visibility_rounded,
                label: _formatCount(wave.viewCount),
              ),
              const SizedBox(height: 6),
              _PulseRailItem(
                label: _formatCount(wave.pulseCount),
                onPulse: (intensity) => _onPulse(wave, intensity),
              ),
              const SizedBox(height: 6),
              _railItem(
                icon: Icons.repeat_rounded,
                label: _formatCount(wave.repeatPlayCount),
              ),
              const SizedBox(height: 6),
              _railItem(
                icon: Icons.chat_bubble_rounded,
                label: _formatCount(wave.commentCount),
                onTap: () => _showCommentsSheet(wave),
              ),
              const SizedBox(height: 6),
              _railItem(
                icon: Icons.share_rounded,
                label: 'Share',
                onTap: () => _shareWave(wave),
              ),
              const SizedBox(height: 6),
              _railItem(
                icon: wave.bookmarked
                    ? Icons.bookmark_rounded
                    : Icons.bookmark_border_rounded,
                iconColor: wave.bookmarked ? AppColors.orange : AppColors.white,
                label: 'Save',
                onTap: () => _onBookmark(wave),
              ),
              const SizedBox(height: 6),
              // Follow channel button
              GestureDetector(
                onTap: _channelFollowLoading ? null : () => _toggleChannelFollow(wave),
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _isFollowingChannel
                          ? AppColors.orange.withValues(alpha: 0.7)
                          : AppColors.white.withValues(alpha: 0.7),
                      width: 2,
                    ),
                    color: _isFollowingChannel
                        ? AppColors.orange.withValues(alpha: 0.15)
                        : AppColors.darkBlue.withValues(alpha: 0.7),
                  ),
                  child: Icon(
                    _isFollowingChannel
                        ? Icons.notifications_active_rounded
                        : Icons.add_circle_rounded,
                    color: _isFollowingChannel ? AppColors.orange : AppColors.white,
                    size: 22,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // Channel logo trigger button
              GestureDetector(
                onTap: () {
                  final visible = !(_channelCardVisible[wave.id] ?? false);
                  setState(() => _channelCardVisible[wave.id] = visible);
                  if (visible) _prefetchChannelData(wave);
                },
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: (_channelCardVisible[wave.id] ?? false)
                          ? AppColors.orange
                          : AppColors.white.withValues(alpha: 0.7),
                      width: 2,
                    ),
                    color: AppColors.darkBlue.withValues(alpha: 0.7),
                  ),
                  child: ClipOval(
                    child: channelLogoUrl != null
                        ? CachedNetworkImage(
                            imageUrl: channelLogoUrl,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => const Icon(
                              Icons.tv_rounded,
                              color: AppColors.lightOrange,
                              size: 22,
                            ),
                          )
                        : const Icon(
                            Icons.tv_rounded,
                            color: AppColors.lightOrange,
                            size: 22,
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Content overlay: title (1 line) + description (1 line) + See more + colored hashtags
  Widget _buildContentOverlay(WaveModel wave) {
    final hashtags = _extractHashtags(wave.description);
    final hasContent = wave.title.isNotEmpty || wave.description.isNotEmpty || hashtags.isNotEmpty;
    if (!hasContent) return const SizedBox.shrink();

    const kBlueTint = Color(0xFF1A73E8);
    const kGoldTint = Color(0xFFFFD700);

    return GestureDetector(
      onTap: () => _showWaveDescriptionSheet(wave),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  kBlueTint.withValues(alpha: 0.12),
                  kGoldTint.withValues(alpha: 0.06),
                  Colors.black.withValues(alpha: 0.25),
                ],
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: kBlueTint.withValues(alpha: 0.18),
                width: 0.6,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Title
                if (wave.title.isNotEmpty)
                  Text(
                    wave.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      shadows: [Shadow(color: Colors.black87, blurRadius: 6)],
                    ),
                  ),
                if (wave.title.isNotEmpty && wave.description.isNotEmpty)
                  const SizedBox(height: 3),
                // Description trimmed to 1 line
                if (wave.description.isNotEmpty)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          wave.description,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            shadows: [Shadow(color: Colors.black54, blurRadius: 6)],
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'See more',
                        style: TextStyle(
                          color: const Color(0xFFFFD700).withValues(alpha: 0.9),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          shadows: const [
                            Shadow(color: Colors.black87, blurRadius: 5),
                          ],
                        ),
                      ),
                    ],
                  ),
                // Colored hashtags
                if (hashtags.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: hashtags.asMap().entries.map((e) {
                      final colors = [
                        const Color(0xFFFF4444), // red
                        const Color(0xFFFFD700), // gold
                        const Color(0xFF44FF44), // green
                        const Color(0xFF44DDFF), // cyan
                        const Color(0xFFFF44FF), // magenta
                        const Color(0xFFFF8844), // orange
                        const Color(0xFF4488FF), // blue
                        const Color(0xFFFFAA00), // amber
                      ];
                      final color = colors[e.key % colors.length];
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: color.withValues(alpha: 0.55),
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          e.value,
                          style: TextStyle(
                            color: color.withValues(alpha: 0.95),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            shadows: const [
                              Shadow(color: Colors.black54, blurRadius: 4),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<String> _extractHashtags(String text) {
    final re = RegExp(r'#\w+');
    return re.allMatches(text).map((m) => m.group(0)!).toList();
  }

  void _showWaveDescriptionSheet(WaveModel wave) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _WaveDescriptionSheet(wave: wave),
    );
  }

  Future<void> _prefetchChannelData(WaveModel wave) async {
    final cid = wave.channelId;
    final needsChannel = !_channelCache.containsKey(cid);
    final needsWaves = !_channelWavesCache.containsKey(cid);
    final needsLibrary = !_channelLibraryCache.containsKey(cid);

    // Channel + waves (waves also drive aggregated pulse/replay stats)
    if (needsChannel || needsWaves) {
      try {
        final futures = await Future.wait([
          if (needsChannel) ChannelService.getChannelById(cid),
          if (needsWaves) WaveService.getChannelWaves(cid),
        ]);
        if (!mounted) return;
        setState(() {
          int idx = 0;
          if (needsChannel) _channelCache[cid] = futures[idx++] as ChannelModel;
          if (needsWaves) {
            final allWaves = futures[idx] as List<WaveModel>;
            // Aggregate totals across ALL channel waves
            int totalPulses = 0;
            int totalReplays = 0;
            for (final w in allWaves) {
              totalPulses += w.pulseCount;
              totalReplays += w.repeatPlayCount;
            }
            _channelTotalPulses[cid] = totalPulses;
            _channelTotalReplays[cid] = totalReplays;
            // Preview excludes the current wave, keep first 6
            _channelWavesCache[cid] = allWaves
                .where((w) => w.id != wave.id)
                .take(6)
                .toList();
          }
        });
      } catch (_) {
        if (!mounted) return;
        if (!_channelWavesCache.containsKey(cid)) {
          setState(() => _channelWavesCache[cid] = const <WaveModel>[]);
        }
      }
    }

    // Library uploads (books/comics) — independent fetch, may be empty
    if (needsLibrary) {
      try {
        final resp = await ChannelLibraryService.getChannelLibrary(
          cid,
          limit: 8,
        );
        if (!mounted) return;
        setState(() {
          _channelLibraryCache[cid] = resp.items.take(4).toList();
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => _channelLibraryCache[cid] = const <ChannelLibraryItemModel>[]);
      }
    }
  }

  Widget _buildChannelCard(WaveModel wave) {
    final visible = _channelCardVisible[wave.id] ?? false;
    final channel = _channelCache[wave.channelId];
    final isExclusive = wave.belongsToExclusiveChannel;
    const kGold = Color(0xFFFFD700);

    Widget goldDivider() => Container(
          height: 1,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                kGold.withValues(alpha: 0.0),
                kGold.withValues(alpha: 0.65),
                kGold.withValues(alpha: 0.0),
              ],
            ),
          ),
        );

    return AnimatedSlide(
      offset: visible ? Offset.zero : const Offset(0, 1),
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeOutCubic,
      child: AnimatedOpacity(
        opacity: visible ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 280),
        child: IgnorePointer(
          ignoring: !visible,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(
                margin: const EdgeInsets.fromLTRB(10, 0, 10, 76),
                padding: const EdgeInsets.fromLTRB(16, 14, 14, 16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isExclusive
                        ? [
                            const Color(0xFF1A2238).withValues(alpha: 0.34),
                            const Color(0xFF0A0A14).withValues(alpha: 0.30),
                          ]
                        : [
                            const Color(0xFF0C2142).withValues(alpha: 0.36),
                            const Color(0xFF03070F).withValues(alpha: 0.30),
                          ],
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: kGold.withValues(alpha: 0.50),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0A3A7A).withValues(alpha: 0.18),
                      blurRadius: 28,
                      offset: const Offset(0, 6),
                    ),
                    BoxShadow(
                      color: kGold.withValues(alpha: 0.08),
                      blurRadius: 24,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header row ──
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        _buildChannelCardLogo(wave, channel, isExclusive),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                channel?.name ?? wave.channelName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: kGold,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.3,
                                  shadows: [
                                    Shadow(color: Color(0x99000000), blurRadius: 8),
                                  ],
                                ),
                              ),
                              if (channel != null) ...[
                                const SizedBox(height: 3),
                                Text(
                                  'Channel ${channel.channelNumber}',
                                  style: TextStyle(
                                    color: kGold.withValues(alpha: 0.55),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            GestureDetector(
                              onTap: () => setState(
                                () => _channelCardVisible[wave.id] = false,
                              ),
                              child: Container(
                                padding: const EdgeInsets.all(5),
                                decoration: BoxDecoration(
                                  color: kGold.withValues(alpha: 0.10),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: kGold.withValues(alpha: 0.35),
                                  ),
                                ),
                                child: Icon(
                                  Icons.close_rounded,
                                  color: kGold.withValues(alpha: 0.80),
                                  size: 14,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            if (isExclusive)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFFFFD700), Color(0xFFFF8C00)],
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: [
                                    BoxShadow(
                                      color: kGold.withValues(alpha: 0.35),
                                      blurRadius: 8,
                                    ),
                                  ],
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.workspace_premium_rounded, color: Colors.black, size: 9),
                                    SizedBox(width: 3),
                                    Text(
                                      'EXCLUSIVE',
                                      style: TextStyle(
                                        color: Colors.black,
                                        fontSize: 8,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.8,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else if (channel?.isPremiumChannel == true)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: kGold.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: kGold.withValues(alpha: 0.45),
                                  ),
                                ),
                                child: const Text(
                                  'PREMIUM',
                                  style: TextStyle(
                                    color: kGold,
                                    fontSize: 8,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.7,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // ── Channel stats row ──
                    _buildChannelStatsRow(wave.channelId, channel),
                    const SizedBox(height: 12),
                    goldDivider(),
                    const SizedBox(height: 12),
                    // ── Action buttons (no Waves) ──
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _channelCardButton(
                          icon: Icons.tv_rounded,
                          label: 'Visit Channel',
                          isPrimary: true,
                          onTap: () {
                            setState(() => _channelCardVisible[wave.id] = false);
                            Navigator.pushNamed(context, '/channel', arguments: wave.channelId);
                          },
                        ),
                        _channelCardButton(
                          icon: Icons.live_tv_rounded,
                          label: 'Tune In',
                          onTap: () {
                            setState(() => _channelCardVisible[wave.id] = false);
                            Navigator.pushNamed(context, '/channel-live', arguments: wave.channelId);
                          },
                        ),
                        _channelCardButton(
                          icon: Icons.library_books_rounded,
                          label: 'Library',
                          onTap: () {
                            setState(() => _channelCardVisible[wave.id] = false);
                            Navigator.pushNamed(context, '/channel-library', arguments: wave.channelId);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    goldDivider(),
                    const SizedBox(height: 10),
                    // ── Waves from this channel ──
                    _sectionHeader(
                      icon: Icons.play_circle_outline_rounded,
                      label: 'WAVES FROM THIS CHANNEL',
                    ),
                    const SizedBox(height: 8),
                    _buildLibraryPreview(wave.channelId),
                    // ── Library uploads (books / comics) ──
                    if ((_channelLibraryCache[wave.channelId]?.isNotEmpty) == true) ...[
                      const SizedBox(height: 12),
                      goldDivider(),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _sectionHeader(
                            icon: Icons.menu_book_rounded,
                            label: 'LIBRARY',
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: () {
                              setState(() => _channelCardVisible[wave.id] = false);
                              Navigator.pushNamed(
                                context,
                                '/channel-library',
                                arguments: wave.channelId,
                              );
                            },
                            child: Text(
                              'See all',
                              style: TextStyle(
                                color: kGold.withValues(alpha: 0.70),
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _buildChannelLibraryRow(wave.channelId),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _sectionHeader({required IconData icon, required String label}) {
    const kGold = Color(0xFFFFD700);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: kGold),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: kGold.withValues(alpha: 0.80),
            fontSize: 9,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
          ),
        ),
      ],
    );
  }

  Widget _buildChannelStatsRow(String channelId, ChannelModel? channel) {
    final followers = channel?.followersCount ?? 0;
    final pulses = _channelTotalPulses[channelId] ?? 0;
    final replays = _channelTotalReplays[channelId] ?? 0;
    return Row(
      children: [
        Expanded(
          child: _buildChannelStat(
            icon: Icons.group_rounded,
            count: followers,
            label: 'Followers',
          ),
        ),
        _statDivider(),
        Expanded(
          child: _buildChannelStat(
            icon: Icons.bolt_rounded,
            count: pulses,
            label: 'Pulses',
          ),
        ),
        _statDivider(),
        Expanded(
          child: _buildChannelStat(
            icon: Icons.replay_rounded,
            count: replays,
            label: 'Replays',
          ),
        ),
      ],
    );
  }

  Widget _statDivider() {
    const kGold = Color(0xFFFFD700);
    return Container(
      width: 1,
      height: 28,
      color: kGold.withValues(alpha: 0.18),
    );
  }

  Widget _buildChannelStat({
    required IconData icon,
    required int count,
    required String label,
  }) {
    const kGold = Color(0xFFFFD700);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: kGold),
        const SizedBox(height: 3),
        Text(
          _formatCount(count),
          style: const TextStyle(
            color: kGold,
            fontSize: 14,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 1),
        Text(
          label,
          style: TextStyle(
            color: kGold.withValues(alpha: 0.55),
            fontSize: 9,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }

  Widget _buildChannelLibraryRow(String channelId) {
    final items = _channelLibraryCache[channelId];
    if (items == null) {
      return const SizedBox(
        height: 70,
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFD700)),
            ),
          ),
        ),
      );
    }
    if (items.isEmpty) return const SizedBox.shrink();
    return Row(
      children: [
        for (int i = 0; i < 4; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: i < items.length
                ? _buildLibraryCover(channelId, items[i])
                : const SizedBox.shrink(),
          ),
        ],
      ],
    );
  }

  Widget _buildLibraryCover(String channelId, ChannelLibraryItemModel item) {
    const kGold = Color(0xFFFFD700);
    final cover = item.coverAssetUrl;
    return GestureDetector(
      onTap: () {
        setState(() => _channelCardVisible[channelId] = false);
        Navigator.pushNamed(
          context,
          '/channel-library',
          arguments: channelId,
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: 2 / 3,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0A1528),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: kGold.withValues(alpha: 0.22)),
                ),
                child: cover != null && cover.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: cover,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => const Center(
                          child: Icon(Icons.menu_book_rounded,
                              color: Color(0xFF1E3A60), size: 18),
                        ),
                      )
                    : const Center(
                        child: Icon(Icons.menu_book_rounded,
                            color: Color(0xFF1E3A60), size: 18),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 8,
              height: 1.2,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            item.contentType.toUpperCase(),
            style: TextStyle(
              color: kGold.withValues(alpha: 0.70),
              fontSize: 7,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLibraryPreview(String channelId) {
    final waves = _channelWavesCache[channelId];
    if (waves == null) {
      return const SizedBox(
        height: 80,
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFD700)),
            ),
          ),
        ),
      );
    }
    if (waves.isEmpty) {
      return const SizedBox(
        height: 32,
        child: Center(
          child: Text(
            'No waves yet',
            style: TextStyle(color: Color(0x80FFD700), fontSize: 11),
          ),
        ),
      );
    }
    final preview = waves.take(6).toList();
    return SizedBox(
      height: 80,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.zero,
        itemCount: preview.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final w = preview[i];
          final thumbUrl = w.thumbnailUrl.isNotEmpty
              ? AppConfig.mediaUrl(w.thumbnailUrl)
              : null;
          return GestureDetector(
            onTap: () => setState(() => _channelCardVisible[channelId] = false),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 45,
                height: 80,
                color: const Color(0xFF0A1528),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (thumbUrl != null)
                      CachedNetworkImage(
                        imageUrl: thumbUrl,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => const ColoredBox(color: Color(0xFF0A1528)),
                      )
                    else
                      const Center(
                        child: Icon(Icons.movie_rounded, color: Color(0xFF1E3A60), size: 18),
                      ),
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [Color(0xEE010812), Colors.transparent],
                          ),
                        ),
                        padding: const EdgeInsets.fromLTRB(3, 8, 3, 4),
                        child: Text(
                          w.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 7,
                            height: 1.2,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: const Color(0xFFFFD700).withValues(alpha: 0.18),
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildChannelCardLogo(
    WaveModel wave,
    ChannelModel? channel,
    bool isExclusive,
  ) {
    final logoUrl = channel?.logoUrl != null && channel!.logoUrl!.isNotEmpty
        ? AppConfig.mediaUrl(channel.logoUrl!)
        : wave.channelLogoUrl != null && wave.channelLogoUrl!.isNotEmpty
        ? AppConfig.mediaUrl(wave.channelLogoUrl!)
        : null;

    return Stack(
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: isExclusive
                  ? const Color(0xFFFFD700).withValues(alpha: 0.55)
                  : AppColors.white.withValues(alpha: 0.2),
              width: isExclusive ? 2 : 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: isExclusive
                    ? const Color(0xFFFFD700).withValues(alpha: 0.25)
                    : Colors.black.withValues(alpha: 0.35),
                blurRadius: isExclusive ? 18 : 10,
                spreadRadius: isExclusive ? 2 : 0,
              ),
            ],
          ),
          child: ClipOval(
            child: logoUrl != null
                ? CachedNetworkImage(
                    imageUrl: logoUrl,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _buildLogoFallback(isExclusive),
                  )
                : _buildLogoFallback(isExclusive),
          ),
        ),
        if (isExclusive)
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 18,
              height: 18,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFFF8C00)],
                ),
              ),
              child: const Icon(
                Icons.workspace_premium_rounded,
                color: Colors.black,
                size: 10,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLogoFallback(bool isExclusive) {
    return Container(
      color: isExclusive
          ? const Color(0xFF2A1200)
          : AppColors.darkBlue,
      child: Icon(
        Icons.tv_rounded,
        color: isExclusive ? AppColors.lightOrange : AppColors.orange,
        size: 26,
      ),
    );
  }

  Widget _channelCardButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isPrimary = false,
  }) {
    const kGold = Color(0xFFFFD700);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: isPrimary
              ? kGold.withValues(alpha: 0.14)
              : const Color(0xFF0B3070).withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: kGold.withValues(alpha: isPrimary ? 0.85 : 0.40),
            width: isPrimary ? 1.1 : 0.8,
          ),
          boxShadow: isPrimary
              ? [
                  BoxShadow(
                    color: kGold.withValues(alpha: 0.22),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 13,
              color: kGold,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                color: kGold,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _railItem({
    required IconData icon,
    required String label,
    Color iconColor = AppColors.white,
    VoidCallback? onTap,
  }) {
    final child = SizedBox(
      width: 58,
      height: 48,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            color: iconColor,
            size: 28,
            shadows: const [
              Shadow(color: Color(0xAA000000), blurRadius: 6),
            ],
          ),
          if (label.isNotEmpty) ...[
            const SizedBox(height: 1),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 12,
                fontWeight: FontWeight.w800,
                shadows: [
                  Shadow(color: Color(0xAA000000), blurRadius: 5),
                ],
              ),
            ),
          ],
        ],
      ),
    );

    if (onTap == null) return child;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: child,
    );
  }
}

class _PulseRailItem extends StatefulWidget {
  final String label;
  final ValueChanged<int> onPulse;

  const _PulseRailItem({required this.label, required this.onPulse});

  @override
  State<_PulseRailItem> createState() => _PulseRailItemState();
}

class _PulseRailItemState extends State<_PulseRailItem> {
  Timer? _timer800;
  Timer? _timer2000;
  int _intensity = 1;
  bool _pressing = false;

  void _startPress() {
    _cancelTimers();
    setState(() {
      _pressing = true;
      _intensity = 1;
    });
    _timer800 = Timer(const Duration(milliseconds: 800), () {
      if (!mounted || !_pressing) return;
      setState(() => _intensity = 2);
    });
    _timer2000 = Timer(const Duration(milliseconds: 2000), () {
      if (!mounted || !_pressing) return;
      setState(() => _intensity = 3);
    });
  }

  void _endPress() {
    if (!_pressing) return;
    final pulseIntensity = _intensity;
    _cancelTimers();
    setState(() {
      _pressing = false;
      _intensity = 1;
    });
    widget.onPulse(pulseIntensity);
  }

  void _cancelTimers() {
    _timer800?.cancel();
    _timer2000?.cancel();
    _timer800 = null;
    _timer2000 = null;
  }

  @override
  void dispose() {
    _cancelTimers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final boltCount = _intensity;
    return GestureDetector(
      onTapDown: (_) => _startPress(),
      onTapUp: (_) => _endPress(),
      onTapCancel: _endPress,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 62,
            height: 50,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_pressing)
                  Text(
                    List<String>.filled(boltCount, '⚡').join(),
                    style: const TextStyle(
                      color: AppColors.orange,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                AnimatedScale(
                  duration: const Duration(milliseconds: 120),
                  scale: _pressing ? 1.15 : 1.0,
                  child: const Icon(
                    Icons.bolt_rounded,
                    color: AppColors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  widget.label,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AgeRatingBadge extends StatefulWidget {
  final String label;
  final Color background;
  final Color border;
  final bool pulsate;

  const _AgeRatingBadge({
    required this.label,
    required this.background,
    required this.border,
    required this.pulsate,
  });

  @override
  State<_AgeRatingBadge> createState() => _AgeRatingBadgeState();
}

class _AgeRatingBadgeState extends State<_AgeRatingBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
    if (widget.pulsate) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(covariant _AgeRatingBadge oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pulsate && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!widget.pulsate && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final badge = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: widget.background,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: widget.border, width: 1.2),
      ),
      child: Text(
        widget.label,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
          shadows: [Shadow(color: Color(0xCC000000), blurRadius: 4)],
        ),
      ),
    );

    if (!widget.pulsate) return badge;

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        final t = _animation.value;
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            boxShadow: [
              BoxShadow(
                color: widget.border.withValues(alpha: 0.30 + 0.50 * t),
                blurRadius: 6 + 10 * t,
                spreadRadius: 0.5 + 1.5 * t,
              ),
            ],
          ),
          child: child,
        );
      },
      child: badge,
    );
  }
}

class _WaveCommentsSheet extends StatefulWidget {
  final String waveId;
  final int count;
  final ValueChanged<int>? onCountChanged;
  final VoidCallback? onCommentPosted;
  final VoidCallback? onReactionToggled;

  const _WaveCommentsSheet({
    required this.waveId,
    required this.count,
    this.onCountChanged,
    this.onCommentPosted,
    this.onReactionToggled,
  });

  @override
  State<_WaveCommentsSheet> createState() => _WaveCommentsSheetState();
}

class _WaveCommentsSheetState extends State<_WaveCommentsSheet> {
  final TextEditingController _commentCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  final Map<String, TextEditingController> _replyCtrls =
      <String, TextEditingController>{};
  bool _loading = true;
  bool _posting = false;
  bool _postingReply = false;
  String? _currentUserId;
  bool _viewerIsOwner = false;
  final Set<String> _bannedUserIds = <String>{};
  List<WaveCommentModel> _comments = const <WaveCommentModel>[];
  int _liveCount = 0;

  // Edit state
  String? _editingCommentId;
  final TextEditingController _editCtrl = TextEditingController();

  // Reply state
  String? _replyingToCommentId;

  // Expanded replies
  final Set<String> _expandedReplies = <String>{};

  // Replies cache per parent comment id
  final Map<String, List<WaveCommentModel>> _repliesCache =
      <String, List<WaveCommentModel>>{};

  // Reaction state: which comments current user has reacted to
  final Set<String> _reactedCommentIds = <String>{};

  @override
  void initState() {
    super.initState();
    _liveCount = widget.count;
    _loadComments();
    _loadCurrentUser();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    _editCtrl.dispose();
    _scrollCtrl.dispose();
    for (final ctrl in _replyCtrls.values) {
      ctrl.dispose();
    }
    super.dispose();
  }

  Future<void> _loadCurrentUser() async {
    try {
      final user = await AuthService.getCurrentUser();
      if (!mounted) return;
      setState(() => _currentUserId = user.id);
    } catch (_) {}
  }

  Future<void> _loadComments() async {
    setState(() => _loading = true);
    try {
      final comments = await WaveService.getComments(widget.waveId);
      if (!mounted) return;
      setState(() {
        _comments = comments;
        _liveCount = comments.where((c) => !c.isReply).length;
        _viewerIsOwner = comments.any((c) => c.viewerIsOwner);
        _bannedUserIds
          ..clear()
          ..addAll(comments.where((c) => c.authorBanned).map((c) => c.userId));
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _postComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty || _posting) return;
    setState(() => _posting = true);
    try {
      final created = await WaveService.postComment(widget.waveId, text);
      if (!mounted) return;
      setState(() {
        _comments = <WaveCommentModel>[..._comments, created];
        _liveCount = _liveCount + 1;
        _commentCtrl.clear();
      });
      widget.onCountChanged?.call(_liveCount);
      widget.onCommentPosted?.call();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollCtrl.hasClients) {
          _scrollCtrl.animateTo(
            _scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to post comment')),
      );
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _loadReplies(WaveCommentModel parent) async {
    if (_repliesCache.containsKey(parent.id)) return;
    try {
      final replies = await WaveService.getReplies(widget.waveId, parent.id);
      if (!mounted) return;
      setState(() {
        _repliesCache[parent.id] = replies;
      });
    } catch (_) {}
  }

  Future<void> _postReply(WaveCommentModel parent) async {
    final ctrl = _replyCtrls[parent.id];
    if (ctrl == null) return;
    final text = ctrl.text.trim();
    if (text.isEmpty || _postingReply) return;
    setState(() => _postingReply = true);
    try {
      final created = await WaveService.postReply(widget.waveId, parent.id, text);
      if (!mounted) return;
      setState(() {
        _repliesCache[parent.id] = [
          ...(_repliesCache[parent.id] ?? const <WaveCommentModel>[]),
          created,
        ];
        _replyingToCommentId = null;
      });
      ctrl.clear();
      // Update parent comment's reply count locally
      setState(() {
        _comments = _comments.map((c) {
          if (c.id == parent.id) {
            return c.copyWith(replyCount: c.replyCount + 1);
          }
          return c;
        }).toList();
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to post reply')),
      );
    } finally {
      if (mounted) setState(() => _postingReply = false);
    }
  }

  Future<void> _toggleReaction(WaveCommentModel c) async {
    try {
      final reacted = await WaveService.toggleCommentReaction(
        widget.waveId,
        c.id,
      );
      if (!mounted) return;
      setState(() {
        if (reacted) {
          _reactedCommentIds.add(c.id);
        } else {
          _reactedCommentIds.remove(c.id);
        }
        // Update reaction count in the comment list
        void updateInList(List<WaveCommentModel> list) {
          for (int i = 0; i < list.length; i++) {
            if (list[i].id == c.id) {
              list[i] = c.copyWith(
                reactionCount: reacted
                    ? c.reactionCount + 1
                    : (c.reactionCount - 1).clamp(0, 9999),
              );
              break;
            }
          }
        }

        updateInList(_comments);
        for (final replies in _repliesCache.values) {
          updateInList(replies);
        }
      });
      widget.onReactionToggled?.call();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to toggle reaction')),
      );
    }
  }

  Future<void> _deleteComment(WaveCommentModel c) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text(
          'Delete comment?',
          style: TextStyle(color: AppColors.white),
        ),
        content: const Text(
          'This cannot be undone.',
          style: TextStyle(color: AppColors.hintText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.hintText),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await WaveService.deleteComment(widget.waveId, c.id);
      if (!mounted) return;
      setState(() {
        _comments = _comments.where((x) => x.id != c.id).toList();
        if (!c.isReply) {
          _liveCount = (_liveCount - 1).clamp(0, 9999);
        } else if (c.parentCommentId != null) {
          // Remove from replies cache and decrement parent reply count
          final parentId = c.parentCommentId!;
          if (_repliesCache.containsKey(parentId)) {
            _repliesCache[parentId] =
                _repliesCache[parentId]!.where((r) => r.id != c.id).toList();
          }
          _comments = _comments.map((p) {
            if (p.id == parentId) {
              return p.copyWith(replyCount: (p.replyCount - 1).clamp(0, 9999));
            }
            return p;
          }).toList();
        }
      });
      widget.onCountChanged?.call(_liveCount);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to delete comment')),
      );
    }
  }

  Future<void> _saveEdit(WaveCommentModel c) async {
    final text = _editCtrl.text.trim();
    if (text.isEmpty || text == c.text) {
      setState(() => _editingCommentId = null);
      return;
    }
    try {
      final updated = await WaveService.editComment(widget.waveId, c.id, text);
      if (!mounted) return;
      setState(() {
        _comments = _comments
            .map((x) => x.id == c.id ? updated : x)
            .toList();
        _editingCommentId = null;
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to edit comment')),
      );
    }
  }

  bool _isBanned(String userId) => _bannedUserIds.contains(userId);

  Future<void> _toggleBan(WaveCommentModel c) async {
    final banned = _isBanned(c.userId);
    if (!banned) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: AppColors.cardBg,
          title: const Text(
            'Ban from commenting?',
            style: TextStyle(color: AppColors.white),
          ),
          content: Text(
            '${c.displayName} will no longer be able to comment on this '
            'channel\'s waves until you revoke the ban.',
            style: const TextStyle(color: AppColors.hintText),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text(
                'Cancel',
                style: TextStyle(color: AppColors.hintText),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text(
                'Ban',
                style: TextStyle(color: AppColors.errorRed),
              ),
            ),
          ],
        ),
      );
      if (confirm != true || !mounted) return;
    }
    try {
      if (banned) {
        await WaveService.unbanCommenter(widget.waveId, c.userId);
      } else {
        await WaveService.banCommenter(widget.waveId, c.userId);
      }
      if (!mounted) return;
      setState(() {
        if (banned) {
          _bannedUserIds.remove(c.userId);
        } else {
          _bannedUserIds.add(c.userId);
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            banned
                ? '${c.displayName} can comment again'
                : '${c.displayName} is banned from commenting',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to update ban status')),
      );
    }
  }

  Widget _buildAdminBadge() {
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.orange, AppColors.lightOrange],
        ),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified_rounded, color: AppColors.darkBlue, size: 9),
          SizedBox(width: 3),
          Text(
            'Channel Admin',
            style: TextStyle(
              color: AppColors.darkBlue,
              fontSize: 8,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.72,
        child: Stack(
          children: [
            Positioned.fill(
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                child: const DecoratedBox(
                  decoration: BoxDecoration(
                    color: Color(0x5E0A1E3A),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                    border: Border(
                      top: BorderSide(color: Color(0x99FFD700), width: 0.9),
                      left: BorderSide(color: Color(0x28FFD700), width: 0.5),
                      right: BorderSide(color: Color(0x28FFD700), width: 0.5),
                    ),
                  ),
                ),
              ),
            ),
            Column(
        children: [
          const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFD700).withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 8, 6),
                child: Row(
                  children: [
                    const Icon(Icons.chat_bubble_rounded, size: 14, color: Color(0xFFFFD700)),
                    const SizedBox(width: 8),
                    Text(
                      'Comments',
                      style: const TextStyle(
                        color: Color(0xFFFFD700),
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.1,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFD700).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFFFD700).withValues(alpha: 0.40)),
                      ),
                      child: Text(
                        '$_liveCount',
                        style: const TextStyle(
                          color: Color(0xFFFFD700),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(
                        Icons.close_rounded,
                        color: const Color(0xFFFFD700).withValues(alpha: 0.80),
                        size: 22,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFFFFD700).withValues(alpha: 0.0),
                        const Color(0xFFFFD700).withValues(alpha: 0.60),
                        const Color(0xFFFFD700).withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      )
                    : _comments.where((c) => !c.isReply).isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.chat_bubble_outline_rounded,
                              color: AppColors.hintText.withValues(alpha: 0.4),
                              size: 40,
                            ),
                            const SizedBox(height: 10),
                            const Text(
                              'No comments yet. Be first!',
                              style: TextStyle(
                                color: AppColors.hintText,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                        itemCount: _comments.where((c) => !c.isReply).length,
                        itemBuilder: (_, index) {
                          final topLevel = _comments.where((c) => !c.isReply).toList();
                          final c = topLevel[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _buildCommentBubble(c),
                          );
                        },
                      ),
              ),
              _buildInputBar(),
            ],
          ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputBar() {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        12,
        8,
        12,
        12 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: AppColors.lightBlue.withValues(alpha: 0.5),
                ),
              ),
              child: TextField(
                controller: _commentCtrl,
                maxLength: 500,
                style: const TextStyle(color: AppColors.white, fontSize: 14),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: 'Add a comment...',
                  hintStyle: TextStyle(
                    color: AppColors.white.withValues(alpha: 0.4),
                    fontSize: 14,
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _posting ? null : _postComment,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: _posting ? null : AppColors.buttonGradient,
                color: _posting ? AppColors.hintText : null,
                shape: BoxShape.circle,
              ),
              child: _posting
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.white,
                      ),
                    )
                  : const Icon(
                      Icons.send_rounded,
                      color: AppColors.darkBlue,
                      size: 22,
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommentBubble(WaveCommentModel c) {
    final isOwn = _currentUserId != null && c.userId == _currentUserId;
    final isEditing = _editingCommentId == c.id;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Avatar
        GestureDetector(
          onTap: c.userId.isNotEmpty
              ? () {
                  Navigator.pop(context);
                  Navigator.pushNamed(
                    context,
                    '/user-profile',
                    arguments: c.userId,
                  );
                }
              : null,
          child: CircleAvatar(
            radius: 17,
            backgroundColor: AppColors.orange.withValues(alpha: 0.8),
            backgroundImage: c.avatarUrl != null && c.avatarUrl!.isNotEmpty
                ? NetworkImage(c.avatarUrl!)
                : null,
            child: c.avatarUrl == null || c.avatarUrl!.isEmpty
                ? Text(
                    c.displayName.isEmpty
                        ? '?'
                        : c.displayName[0].toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  )
                : null,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Bubble
              Container(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: isOwn
                      ? const Color(0xFF1A0900).withValues(alpha: 0.88)
                      : const Color(0xFF010A14).withValues(alpha: 0.88),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(4),
                    topRight: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                    bottomRight: Radius.circular(18),
                  ),
                  border: Border.all(
                    color: isOwn
                        ? const Color(0xFFFFD700).withValues(alpha: 0.45)
                        : const Color(0xFFFFD700).withValues(alpha: 0.18),
                    width: 0.8,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Username
                    GestureDetector(
                      onTap: c.userId.isNotEmpty
                          ? () {
                              Navigator.pop(context);
                              Navigator.pushNamed(
                                context,
                                '/user-profile',
                                arguments: c.userId,
                              );
                            }
                          : null,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Flexible(
                            child: Text(
                              c.displayName,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xFFFFD700),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.1,
                              ),
                            ),
                          ),
                          if (c.isChannelOwner) _buildAdminBadge(),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Text or edit field
                    if (isEditing) ...[
                      TextField(
                        controller: _editCtrl,
                        autofocus: true,
                        maxLength: 500,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 14,
                        ),
                        decoration: InputDecoration(
                          counterText: '',
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.zero,
                          hintText: 'Edit comment...',
                          hintStyle: TextStyle(
                            color: AppColors.white.withValues(alpha: 0.4),
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          GestureDetector(
                            onTap: () => _saveEdit(c),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                gradient: AppColors.buttonGradient,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Text(
                                'Save',
                                style: TextStyle(
                                  color: AppColors.darkBlue,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () =>
                                setState(() => _editingCommentId = null),
                            child: Text(
                              'Cancel',
                              style: TextStyle(
                                color: AppColors.white.withValues(alpha: 0.5),
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ] else
                      Text(
                        c.text,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              // Meta row
              Row(
                children: [
                  Text(
                    c.relativeTime,
                    style: TextStyle(
                      color: const Color(0xFFFFD700).withValues(alpha: 0.45),
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: () {
                      _loadReplies(c);
                      setState(() {
                        if (_expandedReplies.contains(c.id)) {
                          _expandedReplies.remove(c.id);
                        } else {
                          _expandedReplies.add(c.id);
                        }
                      });
                    },
                    child: Text(
                      'Reply${c.replyCount > 0 ? ' (${c.replyCount})' : ''}',
                      style: TextStyle(
                        color: const Color(0xFFFFD700).withValues(alpha: 0.75),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: () => _toggleReaction(c),
                    child: Row(
                      children: [
                        Icon(
                          _reactedCommentIds.contains(c.id)
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          size: 12,
                          color: _reactedCommentIds.contains(c.id)
                              ? AppColors.errorRed
                              : AppColors.white.withValues(alpha: 0.5),
                        ),
                        if (c.reactionCount > 0) ...[
                          const SizedBox(width: 3),
                          Text(
                            '${c.reactionCount}',
                            style: TextStyle(
                              color: const Color(0xFFFFD700).withValues(alpha: 0.55),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (isOwn || (_viewerIsOwner && !c.isChannelOwner)) ...[
                    const Spacer(),
                    if (isOwn) ...[
                      GestureDetector(
                        onTap: () {
                          _editCtrl.text = c.text;
                          setState(() => _editingCommentId = c.id);
                        },
                        child: Icon(
                          Icons.edit_rounded,
                          size: 13,
                          color: AppColors.white.withValues(alpha: 0.5),
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    // Owner-only: ban / unban this commenter
                    if (_viewerIsOwner && !isOwn && !c.isChannelOwner) ...[
                      GestureDetector(
                        onTap: () => _toggleBan(c),
                        child: Icon(
                          _isBanned(c.userId)
                              ? Icons.gavel_rounded
                              : Icons.block_rounded,
                          size: 13,
                          color: _isBanned(c.userId)
                              ? AppColors.orange
                              : AppColors.white.withValues(alpha: 0.5),
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    GestureDetector(
                      onTap: () => _deleteComment(c),
                      child: const Icon(
                        Icons.delete_rounded,
                        size: 13,
                        color: AppColors.errorRed,
                      ),
                    ),
                  ],
                ],
              ),
              if (_viewerIsOwner && !isOwn && _isBanned(c.userId))
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    'Banned from commenting',
                    style: TextStyle(
                      color: AppColors.orange.withValues(alpha: 0.85),
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              const SizedBox(height: 4),
              // Reply button
              if (_currentUserId != null && _replyingToCommentId != c.id)
                GestureDetector(
                  onTap: () {
                    setState(() => _replyingToCommentId = c.id);
                    _replyCtrls.putIfAbsent(
                      c.id,
                      () => TextEditingController(),
                    );
                  },
                  child: Text(
                    'Reply',
                    style: TextStyle(
                      color: const Color(0xFFFFD700).withValues(alpha: 0.50),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              // Reply input field
              if (_replyingToCommentId == c.id) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF010A14).withValues(alpha: 0.75),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: const Color(0xFFFFD700).withValues(alpha: 0.30),
                          ),
                        ),
                        child: TextField(
                          controller: _replyCtrls[c.id],
                          maxLength: 500,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 13,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: 'Reply to ${c.displayName}...',
                            hintStyle: TextStyle(
                              color: const Color(0xFFFFD700).withValues(alpha: 0.35),
                              fontSize: 13,
                            ),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: _postingReply ? null : () => _postReply(c),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          gradient: _postingReply ? null : AppColors.buttonGradient,
                          color: _postingReply ? AppColors.hintText : null,
                          shape: BoxShape.circle,
                        ),
                        child: _postingReply
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.white,
                                ),
                              )
                            : const Icon(
                                Icons.send_rounded,
                                color: AppColors.darkBlue,
                                size: 16,
                              ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    GestureDetector(
                      onTap: () {
                        setState(() => _replyingToCommentId = null);
                        _replyCtrls[c.id]?.clear();
                      },
                      child: Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: AppColors.white.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              ],
              // Expanded replies
              if (_expandedReplies.contains(c.id)) ...[
                const SizedBox(height: 6),
                ...(_repliesCache[c.id] ?? const <WaveCommentModel>[])
                    .map((reply) => _buildReplyBubble(reply)),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildReplyBubble(WaveCommentModel reply) {
    final isOwn = _currentUserId != null && reply.userId == _currentUserId;
    return Padding(
      padding: const EdgeInsets.only(left: 8, top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.8),
              shape: BoxShape.circle,
            ),
            child: reply.avatarUrl != null && reply.avatarUrl!.isNotEmpty
                ? ClipOval(
                    child: Image.network(
                      reply.avatarUrl!,
                      width: 24,
                      height: 24,
                      fit: BoxFit.cover,
                    ),
                  )
                : Center(
                    child: Text(
                      reply.displayName.isEmpty
                          ? '?'
                          : reply.displayName[0].toUpperCase(),
                      style: const TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 10,
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                  decoration: BoxDecoration(
                    color: isOwn
                        ? const Color(0xFF1A0900).withValues(alpha: 0.88)
                        : const Color(0xFF010A14).withValues(alpha: 0.88),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(14),
                      bottomLeft: Radius.circular(14),
                      bottomRight: Radius.circular(14),
                    ),
                    border: Border.all(
                      color: isOwn
                          ? const Color(0xFFFFD700).withValues(alpha: 0.45)
                          : const Color(0xFFFFD700).withValues(alpha: 0.15),
                      width: 0.8,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      GestureDetector(
                        onTap: reply.userId.isNotEmpty
                            ? () {
                                Navigator.pop(context);
                                Navigator.pushNamed(
                                  context,
                                  '/user-profile',
                                  arguments: reply.userId,
                                );
                              }
                            : null,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(
                              child: Text(
                                reply.displayName,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Color(0xFFFFD700),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            if (reply.isChannelOwner) _buildAdminBadge(),
                          ],
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        reply.text,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      reply.relativeTime,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.4),
                        fontSize: 9,
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => _toggleReaction(reply),
                      child: Row(
                        children: [
                          Icon(
                            _reactedCommentIds.contains(reply.id)
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            size: 10,
                            color: _reactedCommentIds.contains(reply.id)
                                ? AppColors.errorRed
                                : AppColors.white.withValues(alpha: 0.4),
                          ),
                          if (reply.reactionCount > 0) ...[
                            const SizedBox(width: 2),
                            Text(
                              '${reply.reactionCount}',
                              style: TextStyle(
                                color: AppColors.white.withValues(alpha: 0.4),
                                fontSize: 9,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (isOwn || (_viewerIsOwner && !reply.isChannelOwner)) ...[
                      const Spacer(),
                      if (_viewerIsOwner && !isOwn && !reply.isChannelOwner) ...[
                        GestureDetector(
                          onTap: () => _toggleBan(reply),
                          child: Icon(
                            _isBanned(reply.userId)
                                ? Icons.gavel_rounded
                                : Icons.block_rounded,
                            size: 11,
                            color: _isBanned(reply.userId)
                                ? AppColors.orange
                                : AppColors.white.withValues(alpha: 0.4),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      GestureDetector(
                        onTap: () => _deleteComment(reply),
                        child: const Icon(
                          Icons.delete_rounded,
                          size: 11,
                          color: AppColors.errorRed,
                        ),
                      ),
                    ],
                  ],
                ),
                if (_viewerIsOwner && !isOwn && _isBanned(reply.userId))
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Text(
                      'Banned from commenting',
                      style: TextStyle(
                        color: AppColors.orange.withValues(alpha: 0.85),
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WaveOptionsSheet extends StatefulWidget {
  final bool autoscroll;
  final Future<void> Function() onToggleAutoscroll;
  final Future<void> Function() onRefreshFeed;
  final Future<void> Function() onToggleFullscreen;
  final Future<void> Function() onInterested;
  final Future<void> Function() onNotInterested;
  final Future<void> Function() onReport;

  const _WaveOptionsSheet({
    required this.autoscroll,
    required this.onToggleAutoscroll,
    required this.onRefreshFeed,
    required this.onToggleFullscreen,
    required this.onInterested,
    required this.onNotInterested,
    required this.onReport,
  });

  @override
  State<_WaveOptionsSheet> createState() => _WaveOptionsSheetState();
}

class _WaveOptionsSheetState extends State<_WaveOptionsSheet> {
  bool _switchVal = false;

  @override
  void initState() {
    super.initState();
    _switchVal = widget.autoscroll;
  }

  @override
  Widget build(BuildContext context) {
    const kGold = Color(0xFFFFD700);
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: Stack(
        children: [
          Positioned.fill(
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  color: Color(0x5E0A1E3A),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                  border: Border(
                    top: BorderSide(color: Color(0x99FFD700), width: 0.9),
                    left: BorderSide(color: Color(0x28FFD700), width: 0.5),
                    right: BorderSide(color: Color(0x28FFD700), width: 0.5),
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
                const SizedBox(height: 10),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: kGold.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    height: 1,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          kGold.withValues(alpha: 0.0),
                          kGold.withValues(alpha: 0.50),
                          kGold.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                // ── Autoscrow switch row ──
                ListTile(
                  leading: Icon(
                    _switchVal ? Icons.pause_rounded : Icons.repeat_rounded,
                    color: kGold.withValues(alpha: 0.80),
                  ),
                  title: Text(
                    'Autoscroll',
                    style: TextStyle(
                      color: kGold.withValues(alpha: 0.90),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  trailing: Switch(
                    value: _switchVal,
                    activeThumbColor: AppColors.darkBlue,
                    activeTrackColor: kGold,
                    inactiveThumbColor: Colors.white,
                    inactiveTrackColor: Colors.white.withValues(alpha: 0.20),
                    onChanged: (val) async {
                      setState(() => _switchVal = val);
                      Navigator.pop(context);
                      await widget.onToggleAutoscroll();
                    },
                  ),
                  onTap: () {}, // absorb; switch handles it
                ),
                _optionTile(
                  icon: Icons.refresh_rounded,
                  label: 'Refresh Feed',
                  onTap: widget.onRefreshFeed,
                ),
                _optionTile(
                  icon: Icons.fullscreen_rounded,
                  label: 'View Fullscreen',
                  onTap: widget.onToggleFullscreen,
                ),
                _optionTile(
                  icon: Icons.thumb_up_rounded,
                  label: 'Interested',
                  onTap: widget.onInterested,
                ),
                _optionTile(
                  icon: Icons.thumb_down_rounded,
                  label: 'Not Interested',
                  onTap: widget.onNotInterested,
                ),
                _optionTile(
                  icon: Icons.flag_rounded,
                  label: 'Report',
                  danger: true,
                  onTap: widget.onReport,
                ),
                const SizedBox(height: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _optionTile({
    required IconData icon,
    required String label,
    required Future<void> Function() onTap,
    bool danger = false,
  }) {
    const kGold = Color(0xFFFFD700);
    return ListTile(
      leading: Icon(
        icon,
        color: danger ? AppColors.errorRed : kGold.withValues(alpha: 0.80),
      ),
      title: Text(
        label,
        style: TextStyle(
          color: danger ? AppColors.errorRed : kGold.withValues(alpha: 0.90),
          fontWeight: FontWeight.w600,
        ),
      ),
      onTap: () async {
        Navigator.pop(context);
        await onTap();
      },
    );
  }
}

// ─── Report result data holder ──────────────────────────────

class _ReportResult {
  final String category;
  final String? details;
  const _ReportResult({required this.category, this.details});
}

// ─── Report form bottom sheet ─────────────────────────────────

class _WaveReportSheet extends StatefulWidget {
  final String waveTitle;
  const _WaveReportSheet({required this.waveTitle});

  @override
  State<_WaveReportSheet> createState() => _WaveReportSheetState();
}

class _WaveReportSheetState extends State<_WaveReportSheet>
    with TickerProviderStateMixin {
  static const _categories = [
    ('Inappropriate Content', 'Sexual, violent, or offensive material'),
    ('Spam / Misleading', 'Fake engagement or clickbait'),
    ('Harassment', 'Targeting or bullying someone'),
    ('Copyright', 'Unauthorised use of content'),
    ('Other', 'Something else'),
  ];
  int? _selectedIndex;
  final _detailsCtrl = TextEditingController();

  @override
  void dispose() {
    _detailsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const kGold = Color(0xFFFFD700);
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: Stack(
        children: [
          Positioned.fill(
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  color: Color(0x5E0A1E3A),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                  border: Border(
                    top: BorderSide(color: Color(0x99FFD700), width: 0.9),
                    left: BorderSide(color: Color(0x28FFD700), width: 0.5),
                    right: BorderSide(color: Color(0x28FFD700), width: 0.5),
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.6,
              minChildSize: 0.4,
              maxChildSize: 0.85,
              builder: (_, scrollCtrl) {
                return SingleChildScrollView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: kGold.withValues(alpha: 0.45),
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Report Wave',
                        style: TextStyle(
                          color: kGold,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.waveTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Why are you reporting this?',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ...List.generate(_categories.length, (i) {
                        final (title, subtitle) = _categories[i];
                        final selected = _selectedIndex == i;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedIndex = i),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: selected
                                  ? kGold.withValues(alpha: 0.14)
                                  : Colors.black.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: selected
                                    ? kGold.withValues(alpha: 0.80)
                                    : Colors.white.withValues(alpha: 0.08),
                                width: selected ? 1.2 : 0.8,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  selected
                                      ? Icons.radio_button_checked_rounded
                                      : Icons.radio_button_off_rounded,
                                  color: selected
                                      ? kGold
                                      : Colors.white.withValues(alpha: 0.30),
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        title,
                                        style: TextStyle(
                                          color: selected
                                              ? kGold
                                              : Colors.white.withValues(
                                                  alpha: 0.85,
                                                ),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        subtitle,
                                        style: TextStyle(
                                          color: Colors.white.withValues(
                                            alpha: 0.45,
                                          ),
                                          fontSize: 10,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                      const SizedBox(height: 8),
                      Text(
                        'Additional details (optional)',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _detailsCtrl,
                        maxLines: 3,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Describe what you saw...',
                          hintStyle: TextStyle(
                            color: Colors.white.withValues(alpha: 0.30),
                            fontSize: 12,
                          ),
                          filled: true,
                          fillColor: Colors.black.withValues(alpha: 0.30),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: Colors.white.withValues(alpha: 0.10),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: Colors.white.withValues(alpha: 0.10),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: kGold.withValues(alpha: 0.50),
                            ),
                          ),
                          contentPadding: const EdgeInsets.all(12),
                        ),
                      ),
                      const SizedBox(height: 18),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _selectedIndex == null
                              ? null
                              : () {
                                  final result = _ReportResult(
                                    category: _categories[_selectedIndex!].$1,
                                    details: _detailsCtrl.text.trim(),
                                  );
                                  Navigator.pop(context, result);
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kGold,
                            foregroundColor: AppColors.darkBlue,
                            disabledBackgroundColor:
                                kGold.withValues(alpha: 0.25),
                            disabledForegroundColor:
                                AppColors.darkBlue.withValues(alpha: 0.40),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            textStyle: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.3,
                            ),
                          ),
                          child: const Text('Submit Report'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text(
                            'Cancel',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.50),
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Wave description bottom sheet ──────────────────────────

class _WaveDescriptionSheet extends StatelessWidget {
  final WaveModel wave;

  const _WaveDescriptionSheet({required this.wave});

  @override
  Widget build(BuildContext context) {
    final hashtags = _extractHashtags(wave.description);
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.55,
        child: Stack(
          children: [
            Positioned.fill(
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                child: const DecoratedBox(
                  decoration: BoxDecoration(
                    color: Color(0x5E0A1E3A),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                    border: Border(
                      top: BorderSide(color: Color(0x99FFD700), width: 0.9),
                      left: BorderSide(color: Color(0x28FFD700), width: 0.5),
                      right: BorderSide(color: Color(0x28FFD700), width: 0.5),
                    ),
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFD700).withValues(alpha: 0.45),
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Channel name
                    Row(
                      children: [
                        const Icon(
                          Icons.tv_rounded,
                          color: Color(0xFFFFD700),
                          size: 14,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          wave.channelName,
                          style: const TextStyle(
                            color: Color(0xFFFFD700),
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Title
                    Text(
                      wave.title.isNotEmpty ? wave.title : 'Untitled Wave',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Divider
                    Container(
                      height: 1,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFFFFD700).withValues(alpha: 0.0),
                            const Color(0xFFFFD700).withValues(alpha: 0.60),
                            const Color(0xFFFFD700).withValues(alpha: 0.0),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Full description
                    Expanded(
                      child: SingleChildScrollView(
                        child: Text(
                          wave.description.isNotEmpty
                              ? wave.description
                              : 'No description',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ),
                    // Hashtags
                    if (hashtags.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: hashtags.asMap().entries.map((e) {
                          final colors = [
                            const Color(0xFFFF4444),
                            const Color(0xFFFFD700),
                            const Color(0xFF44FF44),
                            const Color(0xFF44DDFF),
                            const Color(0xFFFF44FF),
                            const Color(0xFFFF8844),
                            const Color(0xFF4488FF),
                            const Color(0xFFFFAA00),
                          ];
                          final color = colors[e.key % colors.length];
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: color.withValues(alpha: 0.55),
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              e.value,
                              style: TextStyle(
                                color: color.withValues(alpha: 0.95),
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static List<String> _extractHashtags(String text) {
    final re = RegExp(r'#\w+');
    return re.allMatches(text).map((m) => m.group(0)!).toList();
  }
}

// ─── Autoscroll confirmation badge ──────────────────────────

class _AutoscrollConfirmationBadge extends StatefulWidget {
  final String label;
  final VoidCallback onDone;
  const _AutoscrollConfirmationBadge({
    super.key,
    required this.label,
    required this.onDone,
  });

  @override
  State<_AutoscrollConfirmationBadge> createState() =>
      _AutoscrollConfirmationBadgeState();
}

class _AutoscrollConfirmationBadgeState
    extends State<_AutoscrollConfirmationBadge>
    with TickerProviderStateMixin {
  late final AnimationController _rise;
  late final AnimationController _burn;
  late final Animation<double> _riseY;
  late final Animation<double> _opacity;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _rise = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _burn = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _riseY = Tween<double>(begin: 0.0, end: -120.0).animate(
      CurvedAnimation(parent: _rise, curve: Curves.easeOutCubic),
    );
    _opacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _rise,
        curve: const Interval(0.55, 1.0, curve: Curves.easeIn),
      ),
    );
    _scale = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _rise, curve: Curves.easeOutBack),
    );

    _rise.forward().whenComplete(() {
      _burn.forward().whenComplete(() => widget.onDone());
    });
  }

  @override
  void dispose() {
    _rise.dispose();
    _burn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const kGold = Color(0xFFFFD700);
    return AnimatedBuilder(
      animation: Listenable.merge([_rise, _burn]),
      builder: (_, __) {
        final burnT = _burn.value;
        return Opacity(
          opacity: _opacity.value * (1 - burnT),
          child: Transform.translate(
            offset: Offset(0, _riseY.value),
            child: Transform.scale(
              scale: _scale.value,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0C2142), Color(0xFF1A2238)],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: kGold.withValues(alpha: 0.60 - 0.40 * burnT),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: kGold.withValues(alpha: 0.18 - 0.18 * burnT),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: const Color(0xFF0A3A7A).withValues(
                        alpha: 0.25 - 0.25 * burnT,
                      ),
                      blurRadius: 28,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.workspace_premium_rounded,
                      color: kGold.withValues(alpha: 1.0 - 0.5 * burnT),
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      widget.label,
                      style: TextStyle(
                        color: kGold.withValues(alpha: 1.0 - 0.5 * burnT),
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ─── Autoplay status icon (below the 3-dots button) ───────────

class _AutoplayStatusIcon extends StatelessWidget {
  final bool enabled;
  final VoidCallback onTap;
  const _AutoplayStatusIcon({required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: enabled
              ? const Color(0xFF2E8B57).withValues(alpha: 0.90)
              : Colors.black.withValues(alpha: 0.45),
          shape: BoxShape.circle,
          border: Border.all(
            color: enabled ? const Color(0xFF4ADE80) : Colors.white.withValues(alpha: 0.15),
            width: enabled ? 1.5 : 0.8,
          ),
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: const Color(0xFF4ADE80).withValues(alpha: 0.55),
                    blurRadius: 10,
                    spreadRadius: 1,
                  ),
                  BoxShadow(
                    color: const Color(0xFFFFFFFF).withValues(alpha: 0.25),
                    blurRadius: 6,
                    spreadRadius: 0.5,
                  ),
                ]
              : null,
        ),
        child: Center(
          child: Icon(
            enabled ? Icons.repeat_rounded : Icons.pause_rounded,
            size: 14,
            color: enabled ? Colors.white : Colors.white.withValues(alpha: 0.45),
          ),
        ),
      ),
    );
  }
}

class _WaveMiniControl extends StatelessWidget {
  final bool active;
  final IconData icon;
  final VoidCallback onTap;

  const _WaveMiniControl({
    required this.active,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const kGold = Color(0xFFFFD700);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: active
              ? kGold.withValues(alpha: 0.90)
              : Colors.black.withValues(alpha: 0.45),
          shape: BoxShape.circle,
          border: Border.all(
            color: active ? kGold : Colors.white.withValues(alpha: 0.15),
            width: active ? 1.5 : 0.8,
          ),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: kGold.withValues(alpha: 0.35),
                    blurRadius: 10,
                    spreadRadius: 1,
                  ),
                ]
              : null,
        ),
        child: Icon(
          icon,
          size: 14,
          color: active ? AppColors.darkBlue : Colors.white.withValues(alpha: 0.70),
        ),
      ),
    );
  }
}

// ─── Local floating indicator overlay ─────────────────────────

class _LocalFloatingOverlay extends StatefulWidget {
  const _LocalFloatingOverlay({super.key});

  @override
  State<_LocalFloatingOverlay> createState() => _LocalFloatingOverlayState();
}

class _LocalFloatingOverlayState extends State<_LocalFloatingOverlay> {
  final List<_FloatingItem> _items = [];
  int _id = 0;

  void showPulse() => _add(Icons.bolt_rounded, const Color(0xFFFFD700));
  void showSave() => _add(Icons.bookmark_rounded, const Color(0xFFFFD700));
  void showComment() => _add(Icons.comment_rounded, const Color(0xFFFFD700));
  void showReaction() =>
      _add(Icons.emoji_emotions_rounded, const Color(0xFFFFD700));
  void showReplay() => _add(Icons.repeat_rounded, const Color(0xFF4ADE80));

  void _add(IconData icon, Color color) {
    final id = _id++;
    setState(() {
      _items.add(
        _FloatingItem(
          id: id,
          icon: icon,
          color: color,
          leftOffset: 8.0 + Random().nextDouble() * 20.0,
        ),
      );
    });
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      setState(() => _items.removeWhere((i) => i.id == id));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        for (final item in _items) _FloatingIndicatorItem(item: item),
      ],
    );
  }
}

class _FloatingItem {
  final int id;
  final IconData icon;
  final Color color;
  final double leftOffset;
  const _FloatingItem({
    required this.id,
    required this.icon,
    required this.color,
    required this.leftOffset,
  });
}

class _FloatingIndicatorItem extends StatefulWidget {
  final _FloatingItem item;
  const _FloatingIndicatorItem({required this.item});

  @override
  State<_FloatingIndicatorItem> createState() => _FloatingIndicatorItemState();
}

class _FloatingIndicatorItemState extends State<_FloatingIndicatorItem>
    with TickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _y;
  late final Animation<double> _opacity;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );
    _y = Tween<double>(begin: 0.0, end: 180.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutQuad),
    );
    _opacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.45, 1.0, curve: Curves.easeIn),
      ),
    );
    _scale = Tween<double>(begin: 0.6, end: 1.2).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.0, 0.35, curve: Curves.easeOutBack),
      ),
    );
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return Positioned(
          bottom: _y.value,
          left: widget.item.leftOffset,
          child: Opacity(
            opacity: _opacity.value,
            child: Transform.scale(
              scale: _scale.value,
              child: Icon(
                widget.item.icon,
                color: widget.item.color,
                size: 22,
              ),
            ),
          ),
        );
      },
    );
  }
}

// ─── Custom top-center toast overlay ──────────────────────────

class _ToastOverlay extends StatefulWidget {
  final String message;
  final VoidCallback onDone;

  const _ToastOverlay({required this.message, required this.onDone});

  @override
  State<_ToastOverlay> createState() => _ToastOverlayState();
}

class _ToastOverlayState extends State<_ToastOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<double> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
      reverseDuration: const Duration(milliseconds: 350),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _slide = Tween<double>(begin: -20.0, end: 0.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack),
    );
    _ctrl.forward();
    Future.delayed(const Duration(milliseconds: 2200), () async {
      if (!mounted) return;
      await _ctrl.reverse();
      widget.onDone();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.paddingOf(context).top + 60,
      left: 24,
      right: 24,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) {
          return Opacity(
            opacity: _fade.value,
            child: Transform.translate(
              offset: Offset(0, _slide.value),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xE60A1E3A),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: const Color(0x99FFD700),
                    width: 0.8,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      color: Color(0xFFFFD700),
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Text(
                        widget.message,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _EcgTimeline extends StatelessWidget {
  final int durationSeconds;
  final double currentTimeSeconds;
  final List<WavePulseMomentModel> moments;
  final ValueChanged<double> onSeek;

  const _EcgTimeline({
    required this.durationSeconds,
    required this.currentTimeSeconds,
    required this.moments,
    required this.onSeek,
  });

  String _formatTime(double secs) {
    final clamped = secs.isNaN || secs.isInfinite ? 0 : secs.floor();
    final minutes = clamped ~/ 60;
    final seconds = clamped % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onHorizontalDragUpdate: (details) {
        final box = context.findRenderObject() as RenderBox?;
        if (box == null || durationSeconds <= 0) return;
        final local = box.globalToLocal(details.globalPosition);
        final ratio = (local.dx / box.size.width).clamp(0.0, 1.0);
        onSeek(ratio * durationSeconds);
      },
      onTapDown: (details) {
        final box = context.findRenderObject() as RenderBox?;
        if (box == null || durationSeconds <= 0) return;
        final ratio = (details.localPosition.dx / box.size.width).clamp(
          0.0,
          1.0,
        );
        onSeek(ratio * durationSeconds);
      },
      child: Container(
        padding: const EdgeInsets.fromLTRB(8, 4, 8, 3),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.52),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text(
                  _formatTime(currentTimeSeconds),
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                Text(
                  'ECG PULSE',
                  style: TextStyle(
                    color: AppColors.white.withValues(alpha: 0.44),
                    fontSize: 8,
                    letterSpacing: 1.0,
                  ),
                ),
                const Spacer(),
                Text(
                  _formatTime(durationSeconds.toDouble()),
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            SizedBox(
              width: double.infinity,
              height: 18,
              child: CustomPaint(
                painter: _EcgPainter(
                  durationSeconds: durationSeconds <= 0 ? 1 : durationSeconds,
                  currentTimeSeconds: currentTimeSeconds,
                  moments: moments,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EcgPainter extends CustomPainter {
  final int durationSeconds;
  final double currentTimeSeconds;
  final List<WavePulseMomentModel> moments;

  const _EcgPainter({
    required this.durationSeconds,
    required this.currentTimeSeconds,
    required this.moments,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final midY = size.height * 0.62;

    final baselinePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.15)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    canvas.drawLine(Offset(0, midY), Offset(size.width, midY), baselinePaint);

    final momentsBySecond = <int, int>{};
    int maxIntensity = 1;
    for (final moment in moments) {
      momentsBySecond[moment.second] = moment.intensitySum;
      if (moment.intensitySum > maxIntensity) {
        maxIntensity = moment.intensitySum;
      }
    }

    final path = Path();
    for (int px = 0; px < size.width.floor(); px++) {
      final second = ((px / size.width) * durationSeconds).floor();
      final intensity = momentsBySecond[second] ?? 0;
      final spike = intensity > 0
          ? (intensity / maxIntensity) * (size.height * 0.52)
          : 0.0;
      final y = midY - spike;
      if (px == 0) {
        path.moveTo(px.toDouble(), y);
      } else {
        path.lineTo(px.toDouble(), y);
      }
    }
    path.lineTo(size.width, midY);

    final pulsePaint = Paint()
      ..color = AppColors.orange
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    canvas.drawPath(path, pulsePaint);

    final playedRatio = (currentTimeSeconds / durationSeconds).clamp(0.0, 1.0);
    final playedX = playedRatio * size.width;

    final fillPaint = Paint()..color = AppColors.orange.withValues(alpha: 0.08);
    canvas.drawRect(Rect.fromLTWH(0, 0, playedX, size.height), fillPaint);

    final playheadPaint = Paint()
      ..color = AppColors.white
      ..strokeWidth = 2;
    canvas.drawLine(
      Offset(playedX, 0),
      Offset(playedX, size.height),
      playheadPaint,
    );

    final knobPaint = Paint()..color = AppColors.white;
    canvas.drawCircle(Offset(playedX, midY), 2.5, knobPaint);
  }

  @override
  bool shouldRepaint(covariant _EcgPainter oldDelegate) {
    return oldDelegate.durationSeconds != durationSeconds ||
        (oldDelegate.currentTimeSeconds - currentTimeSeconds).abs() > 0.05 ||
        oldDelegate.moments.length != moments.length ||
        !_momentsEqual(oldDelegate.moments, moments);
  }

  bool _momentsEqual(
    List<WavePulseMomentModel> a,
    List<WavePulseMomentModel> b,
  ) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i].second != b[i].second ||
          a[i].intensitySum != b[i].intensitySum) {
        return false;
      }
    }
    return true;
  }
}