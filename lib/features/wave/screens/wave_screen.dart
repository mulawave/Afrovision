import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';

import '../../../core/storage/auth_storage.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/services/auth_service.dart';
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
  static const int _controllerKeepDistance = 1;
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

  late final PageController _pageController;

  bool _loading = true;
  bool _loadingMore = false;
  bool _isCreator = false;
  bool _autoscroll = false;
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

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
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
      final feed = await _getNovelFeed(limit: 15);

      if (!mounted) return;
      setState(() {
        _waves.addAll(feed.waves);
        _nextCursor = feed.nextCursor;
        _isCreator = isCreator;
        _isAuthenticated = token != null && token.isNotEmpty;
        _adultConsentAccepted = false;
        _waveSessionId = 'wv_${DateTime.now().millisecondsSinceEpoch}';
        _loading = false;
      });

      if (_waves.isNotEmpty) {
        _preloadWave(_waves.first);
        _loadPulseMoments(_waves.first.id);
        if (_waves.length > 1) {
          _preloadWave(_waves[1]);
        }
        _pruneControllers(centerIndex: 0);
        _markWaveSeen(_waves.first.id);
        _ensureWaveAccessAndPlay(force: true);
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

        final seenIds = _waves.map((wave) => wave.id).toSet();
        final prepend = channelWaves
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

    setState(() {
      _activeWaveIndex = targetIndex;
    });

    _pageController.jumpToPage(targetIndex);
    _onPageChanged(targetIndex);
  }

  Future<void> _applySharedWaveIfNeeded() async {
    final waveId = _pendingWaveId;
    if (waveId == null || waveId.isEmpty || _waves.isEmpty) return;

    var targetIndex = _waves.indexWhere((wave) => wave.id == waveId);

    if (targetIndex < 0) {
      try {
        final sharedWave = await WaveService.getWave(waveId);
        if (!mounted) return;

        final existingIndex = _waves.indexWhere(
          (wave) => wave.id == sharedWave.id,
        );
        if (existingIndex < 0) {
          setState(() {
            _waves.insert(0, sharedWave);
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

    setState(() {
      _activeWaveIndex = targetIndex;
    });

    _pageController.jumpToPage(targetIndex);
    _onPageChanged(targetIndex);
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

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;

    setState(() => _loadingMore = true);
    try {
      final feed = await _getNovelFeed(limit: 15, cursor: _nextCursor);
      if (!mounted) return;
      setState(() {
        final existing = _waves.map((wave) => wave.id).toSet();
        _waves.addAll(feed.waves.where((wave) => !existing.contains(wave.id)));
        _nextCursor = feed.nextCursor;
      });
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
    precacheImage(NetworkImage(wave.thumbnailUrl), context).catchError((_) {});
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
        _failedWaveIds.contains(wave.id)) {
      return;
    }

    final controller = VideoPlayerController.networkUrl(
      Uri.parse(wave.videoUrl),
    );
    controller
        .initialize()
        .then((_) {
          if (!mounted) return;

          controller.setLooping(!_autoscroll);
          _videoControllers[wave.id] = controller;
          _durations[wave.id] = controller.value.duration.inSeconds;

          void listener() {
            if (!mounted || !controller.value.isInitialized) return;

            final position = controller.value.position;
            final total = controller.value.duration;

            if (_isActiveWave(wave.id)) {
              final prevMs = _lastTickMs[wave.id] ?? -1000;
              if ((position.inMilliseconds - prevMs).abs() >= 220) {
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
              if (_autoscroll && _isActiveWave(wave.id)) {
                _advanceWave();
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
        .catchError((_) {
          if (!mounted) return;
          _failedWaveIds.add(wave.id);
          if (_isActiveWave(wave.id)) {
            Future<void>.delayed(const Duration(milliseconds: 200), () {
              if (!mounted || !_isActiveWave(wave.id)) return;
              _advanceWave();
            });
          }
        });
  }

  void _disposeWaveControllerById(String waveId) {
    final listener = _videoListeners.remove(waveId);
    final controller = _videoControllers.remove(waveId);
    if (listener != null && controller != null) {
      controller.removeListener(listener);
    }
    controller?.dispose();
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
    if (_checkingAccessWaveId == active.id) return;

    final controller = _videoControllers[active.id];
    if (controller == null) {
      _preloadWave(active);
      return;
    }
    if (controller.value.isInitialized) {
      controller.play();
    }
  }

  void _onPageChanged(int index) {
    if (!mounted) return;
    if (index < 0 || index >= _waves.length) return;
    _pauseAll();
    setState(() {
      _activeWaveIndex = index;
    });

    _preloadWave(_waves[index]);
    _markWaveSeen(_waves[index].id);
    _loadPulseMoments(_waves[index].id);
    if (index + 1 < _waves.length) {
      _preloadWave(_waves[index + 1]);
    }
    if (index - 1 >= 0) {
      _preloadWave(_waves[index - 1]);
    }
    _pruneControllers(centerIndex: index);
    _ensureWaveAccessAndPlay(force: true);

    if (index >= _waves.length - 3 && _nextCursor != null) {
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
    });
    for (final controller in _videoControllers.values) {
      if (controller.value.isInitialized) {
        await controller.setLooping(!_autoscroll);
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
    try {
      await WaveService.reportWave(wave.id, 'inappropriate content');
      _showSnack('Reported');
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
      builder: (_) =>
          _WaveCommentsSheet(waveId: wave.id, count: wave.commentCount),
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
        return Container(
          decoration: BoxDecoration(
            color: AppColors.darkBlue.withValues(alpha: 0.98),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: SafeArea(
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
                      color: AppColors.inputBorder,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Share Wave',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    wave.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.hintText,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppButton(
                    label: 'WhatsApp Contact',
                    onPressed: () async {
                      Navigator.pop(context);
                      await SharePlus.instance.share(
                        ShareParams(
                          text: shareText,
                          subject: wave.title,
                          files: shareFiles,
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton(
                    onPressed: () async {
                      Navigator.pop(context);
                      await SharePlus.instance.share(
                        ShareParams(
                          text: shareText,
                          subject: wave.title,
                          files: shareFiles,
                        ),
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      foregroundColor: AppColors.lightOrange,
                      side: BorderSide(
                        color: AppColors.lightOrange.withValues(alpha: 0.35),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text('WhatsApp Status / More'),
                  ),
                ],
              ),
            ),
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
        onToggleFullscreen: _toggleImmersiveFullscreen,
        onInterested: () => _onInterest(wave, 'interested'),
        onNotInterested: () => _onInterest(wave, 'not_interested'),
        onReport: () => _onReport(wave),
      ),
    );
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _formatCount(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  String _ageLabel(WaveModel wave) {
    if (wave.ageClassification == 'adult') return '18+';
    if (wave.ageClassification == 'minor_safe') return 'MINOR SAFE';
    return 'TEEN';
  }

  Color _ageBadgeBg(WaveModel wave) {
    if (wave.ageClassification == 'adult') {
      return AppColors.errorRed.withValues(alpha: 0.24);
    }
    if (wave.ageClassification == 'minor_safe') {
      return AppColors.successGreen.withValues(alpha: 0.24);
    }
    return AppColors.orange.withValues(alpha: 0.24);
  }

  Color _ageBadgeBorder(WaveModel wave) {
    if (wave.ageClassification == 'adult') {
      return AppColors.errorRed.withValues(alpha: 0.64);
    }
    if (wave.ageClassification == 'minor_safe') {
      return AppColors.successGreen.withValues(alpha: 0.64);
    }
    return AppColors.orange.withValues(alpha: 0.64);
  }

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
    return GestureDetector(
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
              child: Container(
                color: AppColors.darkBlue,
                child: isReady
                    ? FittedBox(
                        fit: BoxFit.cover,
                        child: SizedBox(
                          width: controller.value.size.width,
                          height: controller.value.size.height,
                          child: VideoPlayer(controller),
                        ),
                      )
                    : Image.network(
                        wave.thumbnailUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Center(
                          child: Icon(
                            Icons.play_circle_fill_rounded,
                            color: AppColors.orange,
                            size: 60,
                          ),
                        ),
                      ),
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
          Positioned(
            top: 6,
            right: 8,
            child: SafeArea(
              bottom: false,
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _ageBadgeBg(wave),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _ageBadgeBorder(wave)),
                    ),
                    child: Text(
                      _ageLabel(wave),
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
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
                ],
              ),
            ),
          ),
          // EXCLUSIVE badge — shown in top-left when this wave has exclusive gating
          if (_isExclusiveWave(wave))
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
          Positioned(
            left: 12,
            right: 80,
            bottom: 74,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  wave.creatorName,
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (wave.description.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    wave.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Positioned(right: 0, top: 0, bottom: 0, child: _buildRightRail(wave)),
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

  Widget _buildBlockedOverlay(WaveModel wave, WaveAccessDecision decision) {
    String actionLabel = 'Skip Wave';
    VoidCallback action = _advanceWave;

    final code = (decision.code ?? '').toUpperCase();
    final bool isExclusive =
        code == 'EXCLUSIVE_ENTITLEMENT_REQUIRED' ||
        code == 'EXCLUSIVE_PIC_REQUIRED';

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
      } else if (isExclusive) {
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
    if (isExclusive) {
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
    return SizedBox(
      width: 62,
      child: SafeArea(
        left: false,
        top: false,
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 126),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _railItem(
                icon: Icons.visibility_rounded,
                label: _formatCount(wave.viewCount),
              ),
              const SizedBox(height: 20),
              _PulseRailItem(
                label: _formatCount(wave.pulseCount),
                onPulse: (intensity) => _onPulse(wave, intensity),
              ),
              const SizedBox(height: 20),
              _railItem(
                icon: Icons.repeat_rounded,
                label: _formatCount(wave.repeatPlayCount),
              ),
              const SizedBox(height: 20),
              _railItem(
                icon: Icons.chat_bubble_rounded,
                label: _formatCount(wave.commentCount),
                onTap: () => _showCommentsSheet(wave),
              ),
              const SizedBox(height: 20),
              _railItem(
                icon: Icons.share_rounded,
                label: 'Share',
                onTap: () => _shareWave(wave),
              ),
              const SizedBox(height: 20),
              _railItem(
                icon: wave.bookmarked
                    ? Icons.bookmark_rounded
                    : Icons.bookmark_border_rounded,
                iconColor: wave.bookmarked ? AppColors.orange : AppColors.white,
                label: 'Save',
                onTap: () => _onBookmark(wave),
              ),
            ],
          ),
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
      width: 62,
      height: 58,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: iconColor, size: 22),
          if (label.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 10,
                fontWeight: FontWeight.w500,
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
            height: 58,
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
                const SizedBox(height: 4),
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

class _WaveCommentsSheet extends StatefulWidget {
  final String waveId;
  final int count;

  const _WaveCommentsSheet({required this.waveId, required this.count});

  @override
  State<_WaveCommentsSheet> createState() => _WaveCommentsSheetState();
}

class _WaveCommentsSheetState extends State<_WaveCommentsSheet> {
  final TextEditingController _commentCtrl = TextEditingController();
  bool _loading = true;
  bool _posting = false;
  List<WaveCommentModel> _comments = const <WaveCommentModel>[];

  @override
  void initState() {
    super.initState();
    _loadComments();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    setState(() => _loading = true);
    try {
      final comments = await WaveService.getComments(widget.waveId);
      if (!mounted) return;
      setState(() {
        _comments = comments;
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
        _commentCtrl.clear();
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Failed to post comment')));
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
      decoration: BoxDecoration(
        color: AppColors.darkBlue.withValues(alpha: 0.96),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.white.withValues(alpha: 0.24),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Text(
                  'Comments · ${widget.count}',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded, color: AppColors.white),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.orange),
                  )
                : _comments.isEmpty
                ? const Center(
                    child: Text(
                      'No comments yet. Be first!',
                      style: TextStyle(color: AppColors.hintText),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    itemBuilder: (_, index) {
                      final c = _comments[index];
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.orange,
                            child: Text(
                              c.displayName.isEmpty
                                  ? '?'
                                  : c.displayName[0].toUpperCase(),
                              style: const TextStyle(
                                color: AppColors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  c.displayName,
                                  style: const TextStyle(
                                    color: AppColors.lightOrange,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  c.text,
                                  style: const TextStyle(
                                    color: AppColors.white,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    },
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemCount: _comments.length,
                  ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              16 + MediaQuery.of(context).viewInsets.bottom,
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentCtrl,
                    maxLength: 500,
                    style: const TextStyle(color: AppColors.white),
                    decoration: InputDecoration(
                      counterText: '',
                      hintText: 'Add a comment...',
                      hintStyle: const TextStyle(color: AppColors.hintText),
                      filled: true,
                      fillColor: AppColors.inputFill,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _posting ? null : _postComment,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.orange,
                    foregroundColor: AppColors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  child: Text(_posting ? '...' : 'Post'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WaveOptionsSheet extends StatelessWidget {
  final bool autoscroll;
  final Future<void> Function() onToggleAutoscroll;
  final Future<void> Function() onToggleFullscreen;
  final Future<void> Function() onInterested;
  final Future<void> Function() onNotInterested;
  final Future<void> Function() onReport;

  const _WaveOptionsSheet({
    required this.autoscroll,
    required this.onToggleAutoscroll,
    required this.onToggleFullscreen,
    required this.onInterested,
    required this.onNotInterested,
    required this.onReport,
  });

  @override
  Widget build(BuildContext context) {
    final items =
        <
          ({
            IconData icon,
            String label,
            Future<void> Function() action,
            bool danger,
          })
        >[
          (
            icon: Icons.fullscreen_rounded,
            label: 'View Fullscreen',
            action: onToggleFullscreen,
            danger: false,
          ),
          (
            icon: autoscroll ? Icons.pause_rounded : Icons.repeat_rounded,
            label: autoscroll ? 'Pause Autoscroll' : 'Enable Autoscroll',
            action: onToggleAutoscroll,
            danger: false,
          ),
          (
            icon: Icons.thumb_up_rounded,
            label: 'Interested',
            action: onInterested,
            danger: false,
          ),
          (
            icon: Icons.thumb_down_rounded,
            label: 'Not Interested',
            action: onNotInterested,
            danger: false,
          ),
          (
            icon: Icons.flag_rounded,
            label: 'Report',
            action: onReport,
            danger: true,
          ),
        ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.darkBlue.withValues(alpha: 0.96),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.white.withValues(alpha: 0.24),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 8),
            for (final item in items)
              ListTile(
                leading: Icon(
                  item.icon,
                  color: item.danger ? AppColors.errorRed : AppColors.white,
                ),
                title: Text(
                  item.label,
                  style: TextStyle(
                    color: item.danger ? AppColors.errorRed : AppColors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                onTap: () async {
                  Navigator.pop(context);
                  await item.action();
                },
              ),
            const SizedBox(height: 14),
          ],
        ),
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
