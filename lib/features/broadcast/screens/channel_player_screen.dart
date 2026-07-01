import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../../../core/services/watch_history_service.dart';
import '../services/broadcast_service.dart';
import '../widgets/broadcast_player.dart';
import '../widgets/ad_break_overlay.dart';
import '../widgets/flash_screen_overlay.dart';
import '../../interactions/widgets/gift_overlay.dart';
import '../../interactions/widgets/gift_sheet.dart';
import '../../interactions/widgets/live_chat_panel.dart';
import '../../interactions/services/interaction_service.dart';
import '../../interactions/models/interaction_models.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';
import '../../channel/services/premium_stream_service.dart';
import '../../../core/api/api_service.dart';
import '../../static_pages/static_pages_registry.dart';
import '../../../core/services/pip_service.dart';
import '../../../core/services/floating_player_service.dart';

class ChannelPlayerScreen extends StatefulWidget {
  const ChannelPlayerScreen({super.key});

  @override
  State<ChannelPlayerScreen> createState() => _ChannelPlayerScreenState();
}

class _ChannelPlayerScreenState extends State<ChannelPlayerScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;

  String? _channelId;
  ChannelModel? _channel;
  BroadcastPlayer? _player;
  WebViewController? _ytWebViewController;
  final GlobalKey<GiftOverlayState> _overlayKey = GlobalKey<GiftOverlayState>();
  Timer? _eventTimer;

  // Now-playing state
  bool _loading = true;
  String? _error;
  bool _premiumBlocked = false;
  Map<String, dynamic>? _nowPlaying;
  Map<String, dynamic>? _nextProgram;
  bool _isLoop = false;
  int _lastEventAt = 0;
  final List<ChannelEventModel> _recentEvents = [];

  // Program info
  int _duration = 0;
  String _videoTitle = '';

  // Reminders
  final Set<String> _remindedProgramIds = {};
  bool _reminderLoading = false;

  // Ad break state
  List<Map<String, dynamic>> _adBreakAds = [];
  bool _showAdBreak = false;
  bool _preRollDone = false;
  String? _lastProgramId;
  int _lastMidRollAt = 0;
  static const _midRollInterval = 15 * 60 * 1000; // 15 minutes

  // Flash screen state
  bool _showFlash = false;
  String _flashType = 'now_playing';
  String _flashTitle = '';

  // Fullscreen state
  bool _isFullscreen = false;
  bool _showFullscreenControls = true;
  bool _showFullscreenGift = false;
  bool _showFullscreenReact = false;
  Timer? _hideControlsTimer;

  // Follow state
  bool _followLoading = false;
  bool _isFollowing = false;
  int _followersCount = 0;

  // Channel surfer state
  List<ChannelModel> _surferChannels = [];
  bool _surferLoading = false;
  bool _surferSwitching = false;
  int _surferSwitchDirection = 0;
  int _surferIndex = -1;
  String? _surferError;
  bool _youtubeReady = false;
  bool _ytEmbedBlocked = false;
  double _ytVolume = 1.0; // YouTube WebView volume (0.0–1.0)
  String _externalRuntimeMode = 'native';
  String? _activePlaybackKey;
  bool _refreshInFlight = false;
  int _eventPollSession = 0;
  DateTime? _lastAccessDeniedRecoveryAt;
  bool _accessDeniedRecoveryInFlight = false;

  // ── Silent network-recovery state ──
  // When the channel is actively playing and a transient network hiccup
  // returns an empty payload or throws, we retry silently rather than
  // tearing down the player and showing "no program" to the user.
  int _silentRetryCount = 0;
  static const int _maxSilentRetries = 4;
  Timer? _silentRetryTimer;
  bool _isReconnecting = false;

  // ── Background / PiP state ────────────────────────────────────────────────
  bool _isInBackground = false;
  bool _isInPiPMode = false;
  // Set to true before popping to floating mode so dispose() doesn't kill
  // the controllers that the floating overlay is still using.
  bool _isHandedOffToFloat = false;

  // ── Freeze detection ──
  Duration? _lastKnownPosition;
  Timer? _freezeWatchdogTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));

    // Listen for native PiP mode changes so we can switch to the minimal
    // PiP layout and restore the full UI when the user expands the window.
    PipService.setModeChangedCallback((isInPiP) {
      if (!mounted) return;
      setState(() => _isInPiPMode = isInPiP);
      if (!isInPiP) {
        // Restored to full screen — restart polling and watchdog.
        if (_channelId != null && _eventTimer == null) _startEventPolling();
        _startFreezeWatchdog();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_channelId == null) {
      _channelId = ModalRoute.of(context)?.settings.arguments as String?;
      if (_channelId != null) {
        _fetchNowPlaying();
        _loadReminders();
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // Disable PiP auto-enter so it doesn't trigger on unrelated screens.
    PipService.setAutoEnterEnabled(false);
    // If we handed off the controllers to the floating overlay, don't stop
    // or dispose them — the overlay is still using them.
    if (!_isHandedOffToFloat) unawaited(_stopPlaybackForRetune());
    _eventTimer?.cancel();
    _hideControlsTimer?.cancel();

    _silentRetryTimer?.cancel();
    _freezeWatchdogTimer?.cancel();
    _animCtrl.dispose();
    // Restore portrait orientation
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  // ─── App lifecycle: resync on resume ───

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _isInBackground = false;
      // Floating-mode lifecycle is handled by FloatingPlayerService itself.
      if (!FloatingPlayerService.instance.isActive) {
        // Normal resume — resync native player and restart polling.
        _player?.setAppActive(true);
        _player?.onAppResumed();
        if (_externalRuntimeMode == 'youtube' && _ytWebViewController != null) {
          _ytWebViewController!
              .runJavaScript(
                'try{document.getElementById("yt").contentWindow'
                '.postMessage(\'{"event":"command","func":"playVideo","args":[]}\', "*");}catch(e){}',
              )
              .catchError((_) {});
        }
      }
      if (_channelId != null && _eventTimer == null) _startEventPolling();
      _startFreezeWatchdog();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      _isInBackground = true;
      // Floating-mode background hand-off is handled by FloatingPlayerService.
      // Pause the in-app controllers (PiP keeps playing in its own window).
      _player?.setAppActive(false);
      if (!_isInPiPMode) {
        _player?.controller?.pause();
        _pauseYouTubePlayback();
      }
      _eventTimer?.cancel();
      _eventTimer = null;
      _freezeWatchdogTimer?.cancel();
      _silentRetryTimer?.cancel();
    }
  }

  Future<void> _pauseYouTubePlayback({WebViewController? controller}) async {
    final ctrl = controller ?? _ytWebViewController;
    if (ctrl == null) return;
    try {
      await ctrl.runJavaScript(
        'try{document.getElementById("yt").contentWindow'
        '.postMessage(\'{"event":"command","func":"pauseVideo","args":[]}\', "*");}catch(e){}',
      );
    } catch (_) {}
  }

  /// Fully tears down the YouTube WebView so it cannot keep playing audio
  /// after the widget is removed. Capture the controller before nulling it.
  Future<void> _disposeYouTubeController() async {
    final ctrl = _ytWebViewController;
    _ytWebViewController = null;
    if (ctrl == null) return;
    await _pauseYouTubePlayback(controller: ctrl);
    try {
      // Loading a blank page stops the platform WebView from keeping the
      // YouTube audio session alive.
      await ctrl.loadRequest(Uri.parse('about:blank'));
    } catch (_) {}
  }

  Future<void> _stopPlaybackForRetune() async {
    _eventTimer?.cancel();
    _eventPollSession++;
    final player = _player;
    _player = null;
    if (player != null) {
      await player.disposeAsync();
    }
    await _disposeYouTubeController();
    _youtubeReady = false;
    _ytEmbedBlocked = false;
    _externalRuntimeMode = 'native';
    _silentRetryTimer?.cancel();
    _freezeWatchdogTimer?.cancel();
    _lastKnownPosition = null;
    _silentRetryCount = 0;
    _isReconnecting = false;
    _overlayKey.currentState?.clear();
  }

  Future<void> _onPullToRefresh() async {
    if (_refreshInFlight) return;
    _refreshInFlight = true;
    HapticFeedback.selectionClick();
    try {
      await _fetchNowPlaying();
      HapticFeedback.lightImpact();
    } finally {
      _refreshInFlight = false;
    }
  }

  // ─── Reminders ───

  Future<void> _loadReminders() async {
    try {
      final list = await BroadcastService.getMyReminders();
      if (!mounted) return;
      setState(() {
        _remindedProgramIds.clear();
        for (final r in list) {
          if (r['channel_id'] == _channelId) {
            _remindedProgramIds.add(r['program_id'] as String);
          }
        }
      });
    } catch (_) {}
  }

  Future<void> _toggleReminder(String programId) async {
    if (_reminderLoading) return;
    setState(() => _reminderLoading = true);
    try {
      if (_remindedProgramIds.contains(programId)) {
        await BroadcastService.removeReminder(programId);
        if (mounted) setState(() => _remindedProgramIds.remove(programId));
      } else {
        await BroadcastService.setReminder(programId);
        if (mounted) setState(() => _remindedProgramIds.add(programId));
      }
    } catch (_) {}
    if (mounted) setState(() => _reminderLoading = false);
  }

  // ─── Core: fetch what's playing ───

  Future<void> _fetchNowPlaying() async {
    final channelId = _channelId;
    if (channelId == null) return;
    // Never fetch while the app is in the background — the result is
    // unreliable and can tear down a healthy player on resume.
    if (_isInBackground) return;

    final cachedChannel = ChannelService.getCachedChannelById(channelId);
    final playableSnapshot = BroadcastService.getCachedPlayableSnapshot(
      channelId,
    );
    setState(() {
      _loading = true;
      _error = null;
      _premiumBlocked = false;
      _youtubeReady = false;
      if (cachedChannel != null) {
        _channel = cachedChannel;
      }
    });

    try {
      final channelFuture = ChannelService.getChannelById(channelId);
      final offsetFuture = BroadcastService.syncServerOffset();
      final nowPlayingFuture = BroadcastService.getNowPlaying(
        channelId,
        preferCache: false,
      );

      if (cachedChannel != null && playableSnapshot != null) {
        await _applyPlaybackPayload(
          channelId,
          playableSnapshot,
          triggerAdChecks: false,
        );
      }

      _channel = await channelFuture;

      // Keep Recently Visited in sync even when opening channels directly
      // in the live player (without passing through channel profile screen).
      WatchHistoryService.record(
        channelId: _channel!.id,
        channelName: _channel!.name,
        channelLogo: _channel!.logoUrl,
        channelBanner: _channel!.bannerUrl,
      ).catchError((_) {});

      // Keep analytics parity with website by recording channel view on open.
      ChannelService.recordView(channelId).catchError((_) {});
      _loadFollowStatus();
      _loadSurferChannels();

      if (_channel!.requiresPayment) {
        final access = await PremiumStreamService.checkAccess(channelId);
        if ((access['has_access'] as bool? ?? false) != true) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _premiumBlocked = true;
          });
          _animCtrl.forward();
          return;
        }
      }

      await offsetFuture;

      final data = await nowPlayingFuture.timeout(
        const Duration(seconds: 8),
        onTimeout: () =>
            BroadcastService.getCachedNowPlaying(channelId) ??
            <String, dynamic>{},
      );
      if (!mounted) return;
      await _applyPlaybackPayload(channelId, data);
    } catch (e) {
      if (e is ApiException && _channelId != null) {
        final msg = e.message.toLowerCase();
        final looksExclusiveBlocked =
            msg.contains('exclusive channels') ||
            msg.contains('personal identifier code access required') ||
            msg.contains('adult kyc verification is required');

        if (looksExclusiveBlocked) {
          if (!mounted) return;
          final granted = await Navigator.pushNamed(
            context,
            '/exclusive-access',
            arguments: _channelId,
          );

          if (granted == true && mounted) {
            await _fetchNowPlaying();
            return;
          }
        }
      }

      if (!mounted) return;

      // For transient network errors during active playback, retry silently
      // instead of tearing down the player with an error screen.
      final hadActivePlayback =
          _activePlaybackKey != null || _isExternalPlaybackReady();
      final isTransientError = e is! ApiException;
      if (hadActivePlayback &&
          isTransientError &&
          _silentRetryCount < _maxSilentRetries) {
        _silentRetryCount++;
        _silentRetryTimer?.cancel();
        final delay = Duration(seconds: 3 * _silentRetryCount);
        _silentRetryTimer = Timer(delay, () {
          if (mounted) _fetchNowPlaying();
        });
        setState(() {
          _isReconnecting = true;
          _loading = false;
        });
        _animCtrl.forward();
        return;
      }

      setState(() {
        _error = BroadcastPlayer.sanitizeError(e);
        _loading = false;
      });
      _eventTimer?.cancel();
      _animCtrl.forward();
    }
  }

  Future<void> _applyPlaybackPayload(
    String channelId,
    Map<String, dynamic> data, {
    bool triggerAdChecks = true,
  }) async {
    _nowPlaying = data['now_playing'] as Map<String, dynamic>?;
    _nextProgram = data['next_program'] as Map<String, dynamic>?;

    if (_nowPlaying != null) {
      final startTime = (_nowPlaying!['start_time'] as num?)?.toInt() ?? 0;
      final endTime = (_nowPlaying!['end_time'] as num?)?.toInt() ?? 0;
      _duration = (_nowPlaying!['duration'] as num?)?.toInt() ?? 0;
      _videoTitle = _nowPlaying!['video_title'] as String? ?? '';
      _isLoop = _nowPlaying!['is_loop'] as bool? ?? false;
      final positionSec = (_nowPlaying!['position'] as num?)?.toInt() ?? 0;
      final videoUrl = _nowPlaying!['video_url'] as String? ?? '';
      final fullUrl = _resolvePlaybackUrl(videoUrl);
      final runtimeMode = _inferExternalRuntimeMode(
        _channel?.streamSourceMode,
        fullUrl,
      );
      final playbackKey =
          '$channelId|$runtimeMode|${_nowPlaying!['program_id'] ?? ''}|$fullUrl';

      if (_activePlaybackKey != playbackKey) {
        _activePlaybackKey = playbackKey;
        if (runtimeMode == 'youtube' && _channel != null) {
          // YouTube needs embed rendering path.
          await _initExternalStream(_channel!, startTime, endTime, _duration);
        } else {
          // Default player path for native/HLS/DASH/URL playback from now_playing.
          await _initBroadcastPlayer(
            fullUrl,
            startTime,
            endTime,
            _duration,
            positionSec,
            _isLoop,
          );
        }
      } else if (mounted) {
        setState(() => _loading = false);
        _animCtrl.forward();
      }

      if (triggerAdChecks) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!_preRollDone) {
            _checkPreRoll();
          } else {
            _checkMidRoll();
          }
        });
      }
      return;
    }

    if (_channel != null && _canFallbackToExternalPlayback(_channel!)) {
      _videoTitle = _channel!.name;
      _duration = 0;
      _isLoop = false;
      final playbackUrl =
          _channel!.resolvedPlaybackUrl ?? _channel!.externalUrl ?? '';
      final runtimeMode = _inferExternalRuntimeMode(
        _channel!.streamSourceMode,
        playbackUrl,
      );
      final playbackKey = '$channelId|$runtimeMode|external|$playbackUrl';
      if (_activePlaybackKey != playbackKey) {
        _activePlaybackKey = playbackKey;
        await _initExternalStream(_channel!, 0, 0, 0);
      } else if (mounted) {
        setState(() => _loading = false);
        _animCtrl.forward();
      }
      return;
    }

    if (channelId.isNotEmpty) {
      final surferFallback = _surferChannels
          .where((c) => c.id == channelId)
          .cast<ChannelModel?>()
          .firstWhere(
            (c) => c != null && _canFallbackToExternalPlayback(c),
            orElse: () => null,
          );
      if (surferFallback != null) {
        _channel = surferFallback;
        _videoTitle = surferFallback.name;
        _duration = 0;
        _isLoop = false;
        final playbackUrl =
            surferFallback.resolvedPlaybackUrl ??
            surferFallback.externalUrl ??
            '';
        final runtimeMode = _inferExternalRuntimeMode(
          surferFallback.streamSourceMode,
          playbackUrl,
        );
        final playbackKey = '$channelId|$runtimeMode|external|$playbackUrl';
        if (_activePlaybackKey != playbackKey) {
          _activePlaybackKey = playbackKey;
          await _initExternalStream(surferFallback, 0, 0, 0);
        } else if (mounted) {
          setState(() => _loading = false);
          _animCtrl.forward();
        }
        return;
      }
    }

    // ── Silent retry: don't show "no program" on a transient empty response ──
    // If we had active playback and the network briefly returned nothing,
    // keep the existing player alive and retry in the background.
    final hadActivePlayback =
        _activePlaybackKey != null || _isExternalPlaybackReady();
    if (hadActivePlayback && _silentRetryCount < _maxSilentRetries) {
      _silentRetryCount++;
      _silentRetryTimer?.cancel();
      // Exponential-ish backoff: 3s, 6s, 9s, 12s
      final delay = Duration(seconds: 3 * _silentRetryCount);
      _silentRetryTimer = Timer(delay, () {
        if (mounted) _fetchNowPlaying();
      });
      if (mounted) {
        setState(() {
          _isReconnecting = true;
          _loading = false;
        });
        _animCtrl.forward();
      }
      return;
    }

    // Max retries exhausted or genuinely no active program — clear and show standby.
    _silentRetryCount = 0;
    _isReconnecting = false;
    _activePlaybackKey = null;
    _isLoop = false;
    _eventTimer?.cancel();
    if (mounted) {
      setState(() => _loading = false);
      _animCtrl.forward();
    }
  }

  Future<void> _loadFollowStatus() async {
    final ch = _channel;
    if (ch == null) return;
    try {
      final status = await ChannelService.getChannelFollowStatus(ch.id);
      if (!mounted) return;
      setState(() {
        _isFollowing = status.followed;
        _followersCount = status.followersCount;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isFollowing = false;
        _followersCount = ch.followersCount;
      });
    }
  }

  Future<void> _toggleFollow() async {
    final ch = _channel;
    if (ch == null || _followLoading) return;
    setState(() => _followLoading = true);
    try {
      final status = _isFollowing
          ? await ChannelService.unfollowChannel(ch.id)
          : await ChannelService.followChannel(ch.id);
      if (!mounted) return;
      setState(() {
        _isFollowing = status.followed;
        _followersCount = status.followersCount;
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Could not update follow status. Please retry.',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _followLoading = false);
    }
  }

  Future<void> _shareChannel() async {
    final channelId = _channelId;
    if (channelId == null) return;

    final shareUrl = '${StaticPagesRegistry.websiteBaseUrl}/live/$channelId';

    await Clipboard.setData(ClipboardData(text: shareUrl));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Live link copied to clipboard.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _loadSurferChannels() async {
    if (_channelId == null) return;
    setState(() {
      _surferLoading = true;
      _surferError = null;
    });
    try {
      final channels = await ChannelService.getPublicChannels();
      if (!mounted) return;

      var list = channels
          .where(
            (c) =>
                _canFallbackToExternalPlayback(c) ||
                c.isStreamLive ||
                c.isStreamScheduled,
          )
          .toList();
      if (list.isEmpty) {
        list = channels;
      }
      final current = _channel;
      if (current != null && list.indexWhere((c) => c.id == current.id) == -1) {
        list = [current, ...list];
      }

      final idx = list.indexWhere((c) => c.id == _channelId);
      setState(() {
        _surferChannels = list;
        _surferIndex = idx >= 0 ? idx : 0;
        _surferError = null;
      });
      _prefetchNearbyNowPlaying();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _surferError = 'Unable to load channel surfer';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Unable to load channel surfer. Tap retry.',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _surferLoading = false);
    }
  }

  Future<void> _switchToChannel(ChannelModel next) async {
    if (_channelId == next.id) return;

    await _stopPlaybackForRetune();

    setState(() {
      _loading = true;
      _error = null;
      _premiumBlocked = false;
      _channelId = next.id;
      _channel = next;
      _nowPlaying = null;
      _nextProgram = null;
      _videoTitle = next.name;
      _surferIndex = _surferChannels.indexWhere((c) => c.id == next.id);
      _youtubeReady = false;
      _externalRuntimeMode = 'native';
      _activePlaybackKey = null;
      _recentEvents.clear();
      _lastEventAt = 0;
    });
    _eventTimer?.cancel();
    final remindersFuture = _loadReminders();
    await _fetchNowPlaying();
    await remindersFuture;
    _prefetchNearbyNowPlaying();
  }

  void _prefetchNearbyNowPlaying() {
    if (_surferChannels.isEmpty) return;

    final indices = <int>{
      if (_surferIndex >= 0) _surferIndex,
      if (_surferIndex > 0) _surferIndex - 1,
      if (_surferIndex >= 0 && _surferIndex < _surferChannels.length - 1)
        _surferIndex + 1,
    };

    for (final index in indices) {
      final candidate = _surferChannels[index];
      BroadcastService.prefetchNowPlaying(candidate.id).then((_) {
        _prewarmCandidatePlayback(candidate);
      });
    }
  }

  void _prewarmCandidatePlayback(ChannelModel candidate) {
    final snapshot = BroadcastService.getCachedPlayableSnapshot(candidate.id);
    if (snapshot == null) return;

    final nowPlaying = snapshot['now_playing'] as Map<String, dynamic>?;
    if (nowPlaying != null) {
      final videoUrl = nowPlaying['video_url'] as String? ?? '';
      if (videoUrl.isNotEmpty) {
        BroadcastService.prewarmPlaybackUrl(videoUrl);
        return;
      }
    }

    final externalUrl = candidate.resolvedPlaybackUrl ?? candidate.externalUrl;
    if (externalUrl != null && externalUrl.isNotEmpty) {
      BroadcastService.prewarmPlaybackUrl(externalUrl);
    }
  }

  Future<void> _switchRelative(int direction) async {
    if (_surferChannels.isEmpty || _surferIndex < 0 || _surferSwitching) {
      return;
    }
    final nextIndex = (_surferIndex + direction).clamp(
      0,
      _surferChannels.length - 1,
    );
    if (nextIndex == _surferIndex) return;

    setState(() {
      _surferSwitching = true;
      _surferSwitchDirection = direction;
    });

    try {
      await _switchToChannel(_surferChannels[nextIndex]);
    } finally {
      if (mounted) {
        setState(() {
          _surferSwitching = false;
          _surferSwitchDirection = 0;
        });
      }
    }
  }

  void _openSurferSheet() {
    if (_surferChannels.isEmpty) return;
    var gridMode = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.72,
              decoration: const BoxDecoration(
                color: AppColors.darkBlue,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.goldText.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
                    child: Row(
                      children: [
                        const Text(
                          'CHANNEL SURFER',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const Spacer(),
                        ToggleButtons(
                          isSelected: [!gridMode, gridMode],
                          onPressed: (i) {
                            setSheetState(() => gridMode = i == 1);
                          },
                          borderRadius: BorderRadius.circular(10),
                          borderColor: AppColors.inputBorder,
                          selectedBorderColor: AppColors.orange,
                          selectedColor: AppColors.white,
                          color: AppColors.goldText,
                          fillColor: AppColors.orange.withValues(alpha: 0.2),
                          constraints: const BoxConstraints(
                            minHeight: 30,
                            minWidth: 38,
                          ),
                          children: const [
                            Icon(Icons.view_list_rounded, size: 18),
                            Icon(Icons.grid_view_rounded, size: 18),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: gridMode
                        ? GridView.builder(
                            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  mainAxisSpacing: 10,
                                  crossAxisSpacing: 10,
                                  childAspectRatio: 1.55,
                                ),
                            itemCount: _surferChannels.length,
                            itemBuilder: (_, i) {
                              final item = _surferChannels[i];
                              final selected = item.id == _channelId;
                              return _buildSurferTile(item, selected, true);
                            },
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                            itemCount: _surferChannels.length,
                            itemBuilder: (_, i) {
                              final item = _surferChannels[i];
                              final selected = item.id == _channelId;
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: _buildSurferTile(item, selected, false),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSurferTile(ChannelModel item, bool selected, bool compactGrid) {
    return GestureDetector(
      onTap: () {
        Navigator.pop(context);
        _switchToChannel(item);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: EdgeInsets.symmetric(
          horizontal: compactGrid ? 10 : 12,
          vertical: compactGrid ? 10 : 12,
        ),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.orange.withValues(alpha: 0.16)
              : AppColors.inputFill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.65)
                : AppColors.inputBorder,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '#${item.channelNumber}',
                    style: TextStyle(color: AppColors.goldText, fontSize: 11),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(
                Icons.play_circle_fill_rounded,
                color: AppColors.orange,
                size: 18,
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _initBroadcastPlayer(
    String url,
    int startTime,
    int endTime,
    int duration,
    int positionSec,
    bool loop,
  ) async {
    _externalRuntimeMode = 'native';
    final oldPlayer = _player;
    _player = null;
    if (oldPlayer != null) {
      await oldPlayer.disposeAsync();
    }
    await _disposeYouTubeController();
    _youtubeReady = false;

    final player = BroadcastPlayer();
    _player = player;

    player.onProgramEnded = () {
      if (mounted) _fetchNowPlaying();
    };

    player.onAccessDenied = _handleAccessDeniedRecovery;

    player.addListener(() {
      if (!mounted) return;
      setState(() {
        if (player.isRecovering) {
          _isReconnecting = true;
          _error = null;
          _loading = false;
        } else if (player.hasError && player.errorMessage != null) {
          _error = player.errorMessage;
          _isReconnecting = false;
          _loading = false;
        } else {
          _error = null;
          _isReconnecting = false;
          _loading = false;
        }
      });
    });

    try {
      await player.initialize(
        videoUrl: url,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        positionSec: positionSec,
        loop: loop,
      );
      if (!mounted) return;

      _startEventPolling();
      _startFreezeWatchdog();
      _silentRetryCount = 0;
      _isReconnecting = false;
      setState(() => _loading = false);
      _animCtrl.forward();
      // Enable automatic PiP entry so the video continues when user leaves app.
      unawaited(PipService.setAutoEnterEnabled(true));
    } catch (e) {
      final currentChannel = _channel;
      final fallbackRawUrl =
          currentChannel?.resolvedPlaybackUrl ?? currentChannel?.externalUrl;
      final fallbackResolvedUrl = fallbackRawUrl == null
          ? ''
          : _resolvePlaybackUrl(fallbackRawUrl);
      final canTryExternalFallback =
          currentChannel != null &&
          _canFallbackToExternalPlayback(currentChannel) &&
          fallbackResolvedUrl.isNotEmpty &&
          fallbackResolvedUrl != url;

      if (canTryExternalFallback) {
        if (!mounted) return;
        setState(() {
          _error = null;
          _loading = true;
        });
        await _initExternalStream(currentChannel, 0, 0, 0);
        return;
      }

      if (!mounted) return;
      setState(() {
        _error = BroadcastPlayer.sanitizeError(e);
        _loading = false;
      });
      _eventTimer?.cancel();
      _animCtrl.forward();
    }
  }

  Future<void> _handleAccessDeniedRecovery() async {
    if (!mounted || _accessDeniedRecoveryInFlight) return;

    final now = DateTime.now();
    final lastAttempt = _lastAccessDeniedRecoveryAt;
    if (lastAttempt != null && now.difference(lastAttempt).inSeconds < 8) {
      return;
    }

    _lastAccessDeniedRecoveryAt = now;
    _accessDeniedRecoveryInFlight = true;

    try {
      if (!mounted) return;
      setState(() {
        _loading = true;
        _error = null;
      });
      await _fetchNowPlaying();
    } finally {
      _accessDeniedRecoveryInFlight = false;
    }
  }

  Future<void> _initExternalStream(
    ChannelModel channel,
    int startTime,
    int endTime,
    int duration,
  ) async {
    final playbackUrl = channel.resolvedPlaybackUrl ?? channel.externalUrl;
    if (playbackUrl == null || playbackUrl.isEmpty) {
      setState(() {
        _error = 'No playback URL configured for this external stream.';
        _loading = false;
      });
      _animCtrl.forward();
      return;
    }

    final runtimeMode = _inferExternalRuntimeMode(
      channel.streamSourceMode,
      playbackUrl,
    );
    _externalRuntimeMode = runtimeMode;

    if (runtimeMode == 'youtube') {
      await _initYouTubeEmbedPlayer(playbackUrl);
    } else if (runtimeMode == 'hls' ||
        runtimeMode == 'dash' ||
        runtimeMode == 'url') {
      // External streams are continuous feeds, so avoid schedule-based
      // program window sync/end checks that can retrigger "tuning" loops.
      await _playExternalStream(playbackUrl, 0, 0, 0);
    } else {
      setState(() {
        _error =
            'Unsupported external stream mode: ${channel.streamSourceMode}';
        _loading = false;
      });
      _animCtrl.forward();
    }
  }

  String _inferExternalRuntimeMode(
    String? streamSourceMode,
    String playbackUrl,
  ) {
    final lower = playbackUrl.toLowerCase();
    if (lower.contains('youtube.com') ||
        lower.contains('youtube-nocookie.com') ||
        lower.contains('youtu.be')) {
      return 'youtube';
    }

    if (streamSourceMode == 'external_youtube') return 'youtube';
    if (streamSourceMode == 'external_hls') return 'hls';
    if (streamSourceMode == 'external_dash') return 'dash';

    if (lower.contains('.m3u8')) return 'hls';
    if (lower.contains('.mpd')) return 'dash';
    if (lower.startsWith('http')) return 'url';
    return 'unknown';
  }

  String _resolvePlaybackUrl(String rawUrl) {
    final trimmed = rawUrl.trim();
    if (trimmed.isEmpty) return trimmed;

    final parsed = Uri.tryParse(trimmed);
    if (parsed != null && parsed.hasScheme) {
      return trimmed;
    }

    final base = AppConfig.baseUrl.endsWith('/')
        ? AppConfig.baseUrl.substring(0, AppConfig.baseUrl.length - 1)
        : AppConfig.baseUrl;
    final path = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$base$path';
  }

  bool _canFallbackToExternalPlayback(ChannelModel channel) {
    if (channel.streamStatus == 'invalid' ||
        channel.streamStatus == 'access_denied') {
      return false;
    }
    final url = channel.resolvedPlaybackUrl ?? channel.externalUrl;
    if (url == null || url.isEmpty) return false;

    final lowerMode = channel.streamSourceMode.toLowerCase();
    if (lowerMode == 'native') {
      final lowerUrl = url.toLowerCase();
      return lowerUrl.startsWith('http') ||
          lowerUrl.contains('youtube') ||
          lowerUrl.contains('.m3u8') ||
          lowerUrl.contains('.mpd');
    }
    return true;
  }

  bool _isExternalPlaybackReady() {
    if (_externalRuntimeMode == 'youtube') {
      return _ytWebViewController != null;
    }
    final controller = _player?.controller;
    return controller != null && controller.value.isInitialized;
  }

  String? _extractYouTubeVideoId(String rawUrl) {
    try {
      final parsed = Uri.parse(rawUrl);
      final host = parsed.host.toLowerCase();
      final segments = parsed.pathSegments;

      if (host.contains('youtu.be') && segments.isNotEmpty) {
        return segments.first;
      }

      final v = parsed.queryParameters['v'];
      if (v != null && v.isNotEmpty) return v;

      final embedIndex = segments.indexOf('embed');
      if (embedIndex >= 0 && embedIndex + 1 < segments.length) {
        return segments[embedIndex + 1];
      }

      if (segments.length >= 2 &&
          (segments[0] == 'live' || segments[0] == 'shorts')) {
        return segments[1];
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> _initYouTubeEmbedPlayer(String playbackUrl) async {
    final videoId = _extractYouTubeVideoId(playbackUrl);
    if (videoId == null || videoId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _error = 'Invalid YouTube stream URL.';
        _loading = false;
        _youtubeReady = false;
      });
      _eventTimer?.cancel();
      _animCtrl.forward();
      return;
    }

    final oldPlayer = _player;
    _player = null;
    if (oldPlayer != null) {
      await oldPlayer.disposeAsync();
    }
    await _disposeYouTubeController();

    _ytEmbedBlocked = false;

    // Use youtube-nocookie.com — it has more permissive embedding rules than
    // youtube.com and is less likely to return error 150/152 for live streams.
    final embedUrl = Uri.https('www.youtube-nocookie.com', '/embed/$videoId', {
      'autoplay': '1',
      'controls': '0',
      'mute': '0',
      'playsinline': '1',
      'enablejsapi': '1',
      'rel': '0',
      'iv_load_policy': '3',
      'modestbranding': '1',
      'disablekb': '1',
      'origin': 'https://www.youtube-nocookie.com',
    }).toString();

    // Wrap the embed in a minimal full-bleed HTML page.
    final html =
        '''<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}
</style>
</head>
<body>
<iframe id="yt" src="$embedUrl"
  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
  allowfullscreen></iframe>
</body>
</html>''';

    // Configure the WebView for inline autoplay with sound.
    // On iOS we use WebKitWebViewControllerCreationParams to allow inline media
    // without a user gesture. On Android, setMediaPlaybackRequiresUserGesture(false)
    // serves the same purpose.
    late final PlatformWebViewControllerCreationParams creationParams;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      creationParams = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else {
      creationParams = const PlatformWebViewControllerCreationParams();
    }

    final ctrl = WebViewController.fromPlatformCreationParams(creationParams)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      // Spoof Chrome Mobile UA — Android WebView's default UA contains "wv"
      // which YouTube's server detects and uses to block embedding (error 152).
      // A real Chrome UA passes YouTube's origin checks cleanly.
      ..setUserAgent(
        'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() {
              _youtubeReady = true;
            });
          },
        ),
      );

    final platform = ctrl.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      platform.setMediaPlaybackRequiresUserGesture(false);
    }

    // baseUrl = youtube-nocookie.com so the iframe origin matches the src.
    await ctrl.loadHtmlString(
      html,
      baseUrl: 'https://www.youtube-nocookie.com',
    );

    if (!mounted) return;

    setState(() {
      _ytWebViewController = ctrl;
      _youtubeReady = false;
      _loading = false;
      _error = null;
    });

    _startEventPolling();
    _silentRetryCount = 0;
    _isReconnecting = false;
    _animCtrl.forward();
  }

  Future<void> _playExternalStream(
    String url,
    int startTime,
    int endTime,
    int duration,
  ) async {
    final fullUrl = _resolvePlaybackUrl(url);
    await _initBroadcastPlayer(fullUrl, startTime, endTime, duration, 0, false);
  }

  // ─── Freeze watchdog (bug 4) ───
  // Detects when the native player stops advancing despite reporting "playing"
  // and triggers a recovery — player is re-initialised from the current live
  // position without showing any error to the user.

  void _startFreezeWatchdog() {
    _freezeWatchdogTimer?.cancel();
    _lastKnownPosition = null;
    _freezeWatchdogTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _checkForFreeze();
    });
  }

  void _checkForFreeze() {
    if (_isInBackground) return;
    final ctrl = _player?.controller;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    if (!ctrl.value.isPlaying || (_player?.isBuffering ?? false)) return;

    final pos = ctrl.value.position;
    final last = _lastKnownPosition;
    if (last != null &&
        (pos - last).abs() < const Duration(milliseconds: 400)) {
      // Position hasn't advanced — player is frozen. Recover silently.
      _recoverFrozenPlayer();
    }
    _lastKnownPosition = pos;
  }

  Future<void> _recoverFrozenPlayer() async {
    _freezeWatchdogTimer?.cancel();
    _lastKnownPosition = null;
    final ctrl = _player?.controller;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    try {
      // Seek to current position + 1s to kick ExoPlayer out of the freeze.
      final target = ctrl.value.position + const Duration(seconds: 1);
      await ctrl.seekTo(target);
      await ctrl.play();
    } catch (_) {
      // If seek fails, do a full silent refresh.
      if (mounted && !_isInBackground) _fetchNowPlaying();
    }
    _startFreezeWatchdog();
  }

  void _startEventPolling() {
    final channelId = _channelId;
    if (channelId == null) return;

    final session = ++_eventPollSession;
    _eventTimer?.cancel();
    _recentEvents.clear();
    _lastEventAt = 0;

    Future<void> poll([bool initial = false]) async {
      if (!mounted || session != _eventPollSession) return;
      try {
        final events = await InteractionService.getChannelEvents(
          channelId,
          initial || _lastEventAt <= 0 ? null : _lastEventAt,
        );
        if (!mounted ||
            session != _eventPollSession ||
            _channelId != channelId) {
          return;
        }
        if (events.isEmpty) return;

        var latestSeenAt = _lastEventAt;
        final appended = <ChannelEventModel>[];

        for (final event in events) {
          if (event.channelId != channelId) {
            continue;
          }
          if (event.createdAt > latestSeenAt) {
            latestSeenAt = event.createdAt;
          }

          if (_recentEvents.any((existing) => existing.id == event.id)) {
            continue;
          }
          appended.add(event);

          if (event.type == 'reaction' && event.emoji != null) {
            _overlayKey.currentState?.addReaction(event.emoji!);
          }
          if (event.type == 'gift') {
            _overlayKey.currentState?.showGift(
              senderName: event.senderName,
              giftName: event.giftName ?? 'Gift',
              giftIcon: event.giftIcon ?? '🎁',
              combo: 1,
              senderRepLevel: event.senderRepLevel,
            );
          }
        }

        if (!mounted) return;
        setState(() {
          _lastEventAt = latestSeenAt;
          if (appended.isNotEmpty) {
            _recentEvents.addAll(appended);
            _recentEvents.sort((a, b) => b.createdAt.compareTo(a.createdAt));
            if (_recentEvents.length > 12) {
              _recentEvents.removeRange(12, _recentEvents.length);
            }
          }
        });
      } catch (e) {
        debugPrint('[ChannelPlayer] event poll error: $e');
      }
    }

    poll(true);
    _eventTimer = Timer.periodic(const Duration(seconds: 20), (_) async {
      await poll();
    });
  }

  // ─── Ad Break Logic ───

  Future<void> _fetchAndShowAds() async {
    try {
      final ads = await BroadcastService.getInStreamAds(_channelId);
      if (!mounted || ads.isEmpty) return;
      _player?.pauseForAd();
      setState(() {
        _adBreakAds = ads;
        _showAdBreak = true;
      });
    } catch (_) {}
  }

  void _onAdBreakComplete() {
    _player?.resumeFromAd();
    setState(() {
      _showAdBreak = false;
      _adBreakAds = [];
      _lastMidRollAt = DateTime.now().millisecondsSinceEpoch;
    });
  }

  void _checkPreRoll() {
    if (_preRollDone || _nowPlaying == null) return;
    _preRollDone = true;
    _lastMidRollAt = DateTime.now().millisecondsSinceEpoch;
    _fetchAndShowAds();
  }

  void _checkMidRoll() {
    if (_nowPlaying == null || !_preRollDone) return;
    final programId =
        _nowPlaying!['program_id'] as String? ??
        _nowPlaying!['video_title'] as String? ??
        '';
    if (_lastProgramId != null && _lastProgramId != programId) {
      // Show "Now Playing" flash for the new program
      if (mounted) {
        setState(() {
          _flashType = 'now_playing';
          _flashTitle = _nowPlaying!['video_title'] as String? ?? '';
          _showFlash = true;
        });
      }
      final timeSinceLast =
          DateTime.now().millisecondsSinceEpoch - _lastMidRollAt;
      if (timeSinceLast >= _midRollInterval) {
        _fetchAndShowAds();
      }
    }
    _lastProgramId = programId;
  }

  // ─── Fullscreen ───

  void _enterFullscreen() {
    setState(() => _isFullscreen = true);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _startHideControlsTimer();
  }

  void _exitFullscreen() {
    setState(() {
      _isFullscreen = false;
      _showFullscreenControls = true;
    });
    _hideControlsTimer?.cancel();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  void _startHideControlsTimer() {
    _hideControlsTimer?.cancel();
    _hideControlsTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _showFullscreenControls = false);
    });
  }

  void _onFullscreenTap() {
    setState(() => _showFullscreenControls = !_showFullscreenControls);
    if (_showFullscreenControls) _startHideControlsTimer();
  }

  // ─── Build ───

  // ─── Minimal PiP view (shown when the activity is in PiP overlay) ───

  Widget _buildPiPView() {
    // Show only the video surface. We intentionally reuse the same player
    // widgets (VideoPlayer / WebViewWidget) that are already rendering —
    // creating new instances would interrupt playback.
    final ctrl = _player?.controller;
    final initialized = ctrl != null && ctrl.value.isInitialized;
    final useYT =
        _externalRuntimeMode == 'youtube' && _ytWebViewController != null;
    return Scaffold(
      backgroundColor: Colors.black,
      body: useYT
          ? WebViewWidget(controller: _ytWebViewController!)
          : initialized
          ? Center(
              child: AspectRatio(
                aspectRatio: ctrl.value.aspectRatio,
                child: VideoPlayer(ctrl),
              ),
            )
          : const SizedBox.shrink(),
    );
  }

  @override
  Widget build(BuildContext context) {
    // When Android has shrunk the activity into the native PiP overlay
    // (home-button PiP), show only the raw video without rebuilding the
    // player widget — rebuilding would interrupt playback.
    if (_isInPiPMode) return _buildPiPView();
    if (_isFullscreen) return _buildFullscreenPlayer();
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBackPress();
      },
      child: Scaffold(
        backgroundColor: AppColors.darkBlue,
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
          child: SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _onPullToRefresh,
                    color: AppColors.orange,
                    backgroundColor: AppColors.cardBg,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        return ListView(
                          physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics(),
                          ),
                          padding: EdgeInsets.zero,
                          children: [
                            SizedBox(
                              height: constraints.maxHeight,
                              child: _loading
                                  ? _buildLoadingState()
                                  : FadeTransition(
                                      opacity: _fadeIn,
                                      child: _buildBody(),
                                    ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ), // closes Container (Scaffold body)
      ), // closes Scaffold (PopScope child)
    ); // closes PopScope
  }

  // ─── Branded Loading Screen ───

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Animated TV signal icon
          _LoadingTvWidget(),
          const SizedBox(height: 28),
          const Text(
            'TUNING IN',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w800,
              letterSpacing: 3,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Please wait a moment...',
            style: TextStyle(color: AppColors.goldText, fontSize: 12),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: 180,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: const LinearProgressIndicator(
                backgroundColor: Color(0xFF1A2B5C),
                color: AppColors.orange,
                minHeight: 3,
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Scanning dots
          const _DotsLoader(),
        ],
      ),
    );
  }

  Widget _buildFullscreenPlayer() {
    final ctrl = _player?.controller;
    final initialized = ctrl != null && ctrl.value.isInitialized;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: _onFullscreenTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Video
            if (initialized)
              Center(
                child: AspectRatio(
                  aspectRatio: ctrl.value.aspectRatio,
                  child: VideoPlayer(ctrl),
                ),
              )
            else
              const Center(
                child: CircularProgressIndicator(color: AppColors.orange),
              ),
            // Gift overlay (floating animations)
            GiftOverlay(key: _overlayKey),
            // Timer overlay (top-left)
            if (initialized)
              Positioned(top: 12, left: 12, child: _buildTimerOverlay(ctrl)),
            // Channel logo + name (top-right)
            if (_channel != null)
              Positioned(top: 12, right: 12, child: _buildChannelBadge()),
            // Dismiss tap area for react/gift panels — must be BELOW the
            // interactive panels in the z-order so it doesn't swallow their taps.
            if (_showFullscreenReact || _showFullscreenGift)
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: () => setState(() {
                    _showFullscreenReact = false;
                    _showFullscreenGift = false;
                  }),
                  child: const SizedBox.expand(),
                ),
              ),
            // ── Embedded reaction bar (slides up from bottom) ──
            if (_showFullscreenReact)
              Positioned(
                left: 0,
                right: 0,
                bottom: 68,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {}, // absorb
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.darkBlue.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppColors.inputBorder.withValues(alpha: 0.5),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: _reactionEmojis.map((emoji) {
                        return GestureDetector(
                          onTap: () {
                            _onReactionTap(emoji);
                            setState(() => _showFullscreenReact = false);
                          },
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.inputBorder.withValues(
                                alpha: 0.3,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              emoji,
                              style: const TextStyle(fontSize: 24),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            // ── Embedded gift panel (slides up, renders in-tree) ──
            if (_showFullscreenGift && _channelId != null)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {}, // absorb
                  child: _FullscreenGiftPanel(
                    channelId: _channelId!,
                    overlayKey: _overlayKey,
                    onClose: () {
                      setState(() => _showFullscreenGift = false);
                      _startHideControlsTimer();
                    },
                  ),
                ),
              ),
            // ── Fullscreen controls overlay (bottom bar) ──
            if (_showFullscreenControls && !_showFullscreenGift)
              Positioned(
                bottom: 12,
                left: 12,
                right: 12,
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: () {},
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Interaction buttons
                      _buildFullscreenButtons(),
                      // Exit fullscreen
                      GestureDetector(
                        onTap: _exitFullscreen,
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.fullscreen_exit_rounded,
                            color: AppColors.white,
                            size: 26,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildFullscreenButtons() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Channel surfer picker
        GestureDetector(
          onTap: _surferChannels.isEmpty ? null : _openSurferSheet,
          child: Container(
            padding: const EdgeInsets.all(10),
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.sensors_rounded,
              color: AppColors.white,
              size: 22,
            ),
          ),
        ),
        // Channel surfer grid
        GestureDetector(
          onTap: _surferChannels.isEmpty ? null : _openSurferSheet,
          child: Container(
            padding: const EdgeInsets.all(10),
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.grid_view_rounded,
              color: AppColors.white,
              size: 22,
            ),
          ),
        ),
        // Gift button
        GestureDetector(
          onTap: () {
            _hideControlsTimer?.cancel();
            setState(() {
              _showFullscreenGift = !_showFullscreenGift;
              _showFullscreenReact = false;
            });
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              gradient: _showFullscreenGift
                  ? const LinearGradient(
                      colors: [AppColors.lightOrange, AppColors.orange],
                    )
                  : null,
              color: _showFullscreenGift
                  ? null
                  : Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('🎁', style: TextStyle(fontSize: 16)),
                SizedBox(width: 4),
                Text(
                  'Gift',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
        // Reaction button
        GestureDetector(
          onTap: () {
            _hideControlsTimer?.cancel();
            setState(() {
              _showFullscreenReact = !_showFullscreenReact;
              _showFullscreenGift = false;
            });
          },
          child: Container(
            padding: const EdgeInsets.all(10),
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: _showFullscreenReact
                  ? AppColors.orange.withValues(alpha: 0.8)
                  : Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text('😊', style: TextStyle(fontSize: 18)),
          ),
        ),
        // Chat button (exits fullscreen to use chat)
        GestureDetector(
          onTap: _exitFullscreen,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.chat_bubble_outline_rounded,
              color: AppColors.white,
              size: 22,
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Dashboard quick jump
        GestureDetector(
          onTap: _goDashboard,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.home_rounded,
              color: AppColors.white,
              size: 22,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _goDashboard() async {
    if (!mounted) return;
    // Fully stop playback before leaving (unlike back button which enters floating mode)
    await _stopPlaybackForRetune();
    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/home', (_) => false);
    }
  }

  /// Handles the back button / back gesture on the player screen.
  ///
  /// When content is actively playing, shows an in-app floating mini-player
  /// so the user can navigate to other AfroVision screens while the video
  /// keeps playing above them.  Falls back to a plain pop when nothing is
  /// playing.
  Future<void> _handleBackPress() async {
    final isNativePlaying =
        _player?.controller?.value.isInitialized == true &&
        _player!.controller!.value.isPlaying;
    final isYouTubePlaying =
        _externalRuntimeMode == 'youtube' &&
        _ytWebViewController != null &&
        _youtubeReady;

    if (isNativePlaying || isYouTubePlaying) {
      _enterFloatingMode();
    } else {
      if (mounted) Navigator.pop(context);
    }
  }

  Future<void> _onManualPiPTap() async {
    final isNativePlaying =
        _player?.controller?.value.isInitialized == true &&
        _player!.controller!.value.isPlaying;
    final isYouTubePlaying =
        _externalRuntimeMode == 'youtube' &&
        _ytWebViewController != null &&
        _youtubeReady;

    if (isNativePlaying || isYouTubePlaying) {
      // Enter native Android Picture-in-Picture so the video keeps playing in
      // a system window on top of other apps and the home screen.
      if (await PipService.isSupported) {
        await PipService.enter();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'Picture-in-picture is not supported on this device',
              style: TextStyle(color: AppColors.white),
            ),
            backgroundColor: AppColors.cardBg,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text(
          'Start playback before entering picture-in-picture',
          style: TextStyle(color: AppColors.white),
        ),
        backgroundColor: AppColors.cardBg,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _enterFloatingMode() {
    if (!mounted) return;

    final channelId = _channelId ?? '';

    // Mark that controllers are being handed to the overlay so dispose()
    // won't stop them when this screen is popped.
    _isHandedOffToFloat = true;

    FloatingPlayerService.instance.show(
      context: context,
      videoController: _externalRuntimeMode != 'youtube'
          ? _player?.controller
          : null,
      ytController: _externalRuntimeMode == 'youtube'
          ? _ytWebViewController
          : null,
      channelId: channelId,
      channelName: _channel?.name,
      channelLogoUrl: _channel?.logoUrl,
      externalMode: _externalRuntimeMode,
    );

    Navigator.pop(context);
  }

  Widget _buildTimerOverlay(VideoPlayerController ctrl) {
    return ValueListenableBuilder(
      valueListenable: ctrl,
      builder: (_, value, __) {
        final sec = value.position.inSeconds;
        final m = (sec ~/ 60).toString().padLeft(2, '0');
        final s = (sec % 60).toString().padLeft(2, '0');
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            '$m:$s',
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        );
      },
    );
  }

  Widget _buildChannelBadge() {
    final hasLogo = _channel?.logoUrl != null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasLogo)
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Image.network(
                AppConfig.mediaUrl(_channel!.logoUrl!),
                width: 20,
                height: 20,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: AppColors.orange,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Icon(
                    Icons.tv_rounded,
                    color: AppColors.white,
                    size: 12,
                  ),
                ),
              ),
            )
          else
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: AppColors.orange,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Icon(
                Icons.tv_rounded,
                color: AppColors.white,
                size: 12,
              ),
            ),
          const SizedBox(width: 6),
          Text(
            _channel!.name,
            style: const TextStyle(
              color: AppColors.darkBlue,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: _handleBackPress,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.3),
                ),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              _nowPlaying != null ? 'NOW PLAYING' : 'CHANNEL',
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
              ),
            ),
          ),
          Flexible(
            child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap: _onManualPiPTap,
                    child: Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppColors.inputBorder.withValues(alpha: 0.4),
                        ),
                      ),
                      child: const Icon(
                        Icons.picture_in_picture_alt_rounded,
                        color: AppColors.lightOrange,
                        size: 15,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: _shareChannel,
                    child: Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppColors.inputBorder.withValues(alpha: 0.4),
                        ),
                      ),
                      child: const Icon(
                        Icons.share_rounded,
                        color: AppColors.lightOrange,
                        size: 15,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: _goDashboard,
                    child: Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppColors.inputBorder.withValues(alpha: 0.4),
                        ),
                      ),
                      child: const Icon(
                        Icons.home_rounded,
                        color: AppColors.lightOrange,
                        size: 15,
                      ),
                    ),
                  ),
                ],
              ),
              if (_channel != null) ...[
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: _followLoading ? null : _toggleFollow,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.cardBg,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: AppColors.inputBorder.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.people_alt_rounded,
                          color: AppColors.goldText,
                          size: 12,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '$_followersCount',
                          style: const TextStyle(
                            color: AppColors.goldText,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _followLoading
                            ? const SizedBox(
                                width: 12,
                                height: 12,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.orange,
                                ),
                              )
                            : Text(
                                _isFollowing ? 'Following' : 'Follow',
                                style: TextStyle(
                                  color: _isFollowing
                                      ? AppColors.lightOrange
                                      : AppColors.orange,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          ),
          if (_nowPlaying != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: _isLoop
                    ? const Color(0xFFE53935).withValues(alpha: 0.2)
                    : AppColors.orange.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _isLoop
                      ? const Color(0xFFE53935).withValues(alpha: 0.5)
                      : AppColors.orange.withValues(alpha: 0.5),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _isLoop
                      ? _PulsingDot(color: const Color(0xFFE53935))
                      : Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.orange,
                            shape: BoxShape.circle,
                          ),
                        ),
                  const SizedBox(width: 6),
                  Text(
                    _isLoop ? 'RERUN' : 'LIVE',
                    style: TextStyle(
                      color: _isLoop
                          ? const Color(0xFFE53935)
                          : AppColors.orange,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return _buildSignalLostScreen(_error!);
    }

    if (_premiumBlocked && _channel != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_rounded, color: AppColors.orange, size: 56),
              const SizedBox(height: 16),
              Text(
                '${_channel!.name} requires paid access',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _channel!.entryFeeType == 'ngn'
                    ? 'Pay ₦${_channel!.entryFeeNgn.toStringAsFixed(0)} to watch this stream.'
                    : 'Pay ${_channel!.entryFeeVptUnits} vPT to watch this stream.',
                style: TextStyle(color: AppColors.goldText, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              GestureDetector(
                onTap: () async {
                  final granted = await Navigator.pushNamed(
                    context,
                    '/premium-stream',
                    arguments: _channel,
                  );
                  if (granted == true && mounted) {
                    _fetchNowPlaying();
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Unlock Stream',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Silent retry in progress — keep showing the active player with a
    // subtle reconnecting badge rather than flashing "no program".
    if (_isReconnecting && _isExternalPlaybackReady()) {
      return Stack(children: [_buildPlayer(), _buildReconnectingBadge()]);
    }

    // No program currently playing (and no external stream fallback active)
    if (_nowPlaying == null && !_isExternalPlaybackReady()) {
      return _buildNoProgram();
    }

    // Playing
    return _buildPlayer();
  }

  // ─── Reconnecting badge (shown over the live player during silent retry) ───

  Widget _buildReconnectingBadge() {
    return Positioned(
      top: 12,
      left: 0,
      right: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: AppColors.darkBlue.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.inputBorder.withValues(alpha: 0.5),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 11,
                height: 11,
                child: CircularProgressIndicator(
                  strokeWidth: 1.8,
                  color: AppColors.orange,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Reconnecting...',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Signal Lost (error) screen ───

  Widget _buildSignalLostScreen(String message) {
    final hasLogo = _channel?.logoUrl != null;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Static noise bars — evoke "no signal" on a TV
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                height: 5,
                width: 240,
                child: Row(
                  children: const [
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF444466),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF2A2A44),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF444466),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF1A1A33),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF444466),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF2A2A44),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF444466),
                        child: SizedBox.expand(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),
            // Channel logo or signal icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.4),
                ),
              ),
              child: hasLogo
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(17),
                      child: Image.network(
                        AppConfig.mediaUrl(_channel!.logoUrl!),
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.signal_wifi_off_rounded,
                          color: AppColors.goldText,
                          size: 32,
                        ),
                      ),
                    )
                  : const Icon(
                      Icons.signal_wifi_off_rounded,
                      color: AppColors.goldText,
                      size: 32,
                    ),
            ),
            const SizedBox(height: 20),
            // "SIGNAL LOST" badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFE53935).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: const Color(0xFFE53935).withValues(alpha: 0.4),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.wifi_tethering_error_rounded,
                    color: Color(0xFFE53935),
                    size: 13,
                  ),
                  SizedBox(width: 6),
                  Text(
                    'SIGNAL LOST',
                    style: TextStyle(
                      color: Color(0xFFE53935),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_channel != null)
              Text(
                _channel!.name,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
            const SizedBox(height: 10),
            // User-friendly message — never a raw exception
            Text(
              message,
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.75),
                fontSize: 13,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            // Action row
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                GestureDetector(
                  onTap: _fetchNowPlaying,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 28,
                      vertical: 13,
                    ),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.refresh_rounded,
                          color: AppColors.white,
                          size: 16,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Retry',
                          style: TextStyle(
                            color: AppColors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_surferChannels.length > 1) ...[
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: _openSurferSheet,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 13,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.inputBorder.withValues(alpha: 0.4),
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.sensors_rounded,
                            color: AppColors.lightOrange,
                            size: 16,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Switch',
                            style: TextStyle(
                              color: AppColors.lightOrange,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
            // Show surfer bar if channels loaded
            if (_surferChannels.length > 1) ...[
              const SizedBox(height: 28),
              _buildSurferBar(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNoProgram() {
    final hasLogo = _channel?.logoUrl != null;
    return LayoutBuilder(
      builder: (context, constraints) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // TV color bars
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: SizedBox(
                height: 4,
                width: 220,
                child: Row(
                  children: const [
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFFC0C0C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFFC0C000),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF00C0C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF00C000),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFFC000C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFFC00000),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF0000C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),
            // Channel logo or TV icon
            if (hasLogo)
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: Image.network(
                  AppConfig.mediaUrl(_channel!.logoUrl!),
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Icon(
                    Icons.tv_rounded,
                    color: AppColors.goldText,
                    size: 40,
                  ),
                ),
              )
            else
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: AppColors.cardBg,
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
                child: Icon(
                  Icons.tv_rounded,
                  color: AppColors.goldText,
                  size: 40,
                ),
              ),
            const SizedBox(height: 16),
            Text(
              _channel?.name ?? 'Channel',
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.7),
                fontSize: 14,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'This channel is currently not\ntransmitting any show now',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Check back later',
              style: TextStyle(color: AppColors.goldText, fontSize: 13),
            ),
            const SizedBox(height: 16),
            // Standby indicator
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: AppColors.goldText,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'STANDBY',
                  style: TextStyle(
                    color: AppColors.goldText,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(width: constraints.maxWidth - 56, child: _buildSurferBar()),
            if (_nextProgram != null) ...[
              const SizedBox(height: 32),
              _buildUpNextCard(),
            ],
            const SizedBox(height: 28),
            // Bottom color bars
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: SizedBox(
                height: 4,
                width: 220,
                child: Row(
                  children: const [
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF0000C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF131313),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFFC000C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF131313),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF00C0C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFF131313),
                        child: SizedBox.expand(),
                      ),
                    ),
                    Expanded(
                      child: ColoredBox(
                        color: Color(0xFFC0C0C0),
                        child: SizedBox.expand(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: _fetchNowPlaying,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
                child: const Text(
                  'Refresh',
                  style: TextStyle(
                    color: AppColors.lightOrange,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
      },
    );
  }

  Widget _buildPlayer() {
    final ctrl = _player?.controller;
    final initialized = ctrl != null && ctrl.value.isInitialized;
    final useYouTubeEmbed =
        _externalRuntimeMode == 'youtube' && _ytWebViewController != null;

    return Column(
      children: [
        // Video player with buffering overlay — contained to fit available space
        Flexible(
          child: Container(
            color: Colors.black,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (initialized)
                  Center(
                    child: AspectRatio(
                      aspectRatio: ctrl.value.aspectRatio,
                      child: VideoPlayer(ctrl),
                    ),
                  )
                else if (useYouTubeEmbed)
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: WebViewWidget(controller: _ytWebViewController!),
                  )
                else
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Container(
                      color: Colors.black,
                      child: const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      ),
                    ),
                  ),
                // Buffering overlay
                if (!useYouTubeEmbed &&
                    _player?.isBuffering == true &&
                    initialized)
                  AspectRatio(
                    aspectRatio: ctrl.value.aspectRatio,
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.4),
                      child: const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(color: AppColors.orange),
                            SizedBox(height: 12),
                            Text(
                              'Buffering...',
                              style: TextStyle(
                                color: AppColors.hintText,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (useYouTubeEmbed && !_youtubeReady)
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.18),
                      child: const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(color: AppColors.orange),
                            SizedBox(height: 12),
                            Text(
                              'Preparing channel...',
                              style: TextStyle(
                                color: AppColors.hintText,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                // Stream unavailable overlay (embed restricted by content owner)
                if (useYouTubeEmbed && _ytEmbedBlocked)
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.92),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.cardBg,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: AppColors.inputBorder.withValues(
                                  alpha: 0.4,
                                ),
                              ),
                            ),
                            child: const Icon(
                              Icons.signal_wifi_off_rounded,
                              color: AppColors.goldText,
                              size: 36,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFFE53935,
                              ).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: const Color(
                                  0xFFE53935,
                                ).withValues(alpha: 0.4),
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.wifi_tethering_error_rounded,
                                  color: Color(0xFFE53935),
                                  size: 13,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  'SIGNAL LOST',
                                  style: TextStyle(
                                    color: Color(0xFFE53935),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'This stream is currently unavailable.',
                            style: TextStyle(
                              color: AppColors.white.withValues(alpha: 0.8),
                              fontSize: 13,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 20),
                          GestureDetector(
                            onTap: _fetchNowPlaying,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                                vertical: 11,
                              ),
                              decoration: BoxDecoration(
                                gradient: AppColors.buttonGradient,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text(
                                'Retry',
                                style: TextStyle(
                                  color: AppColors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                // Gift overlay on top of video
                GiftOverlay(key: _overlayKey),
                // Flash screen overlay (behind ad break)
                if (_showFlash && !_showAdBreak)
                  Positioned.fill(
                    child: FlashScreenOverlay(
                      type: _flashType,
                      title: _flashTitle,
                      channelName: _channel?.name ?? 'Channel',
                      onComplete: () {
                        if (mounted) setState(() => _showFlash = false);
                      },
                    ),
                  ),
                // Ad break overlay (covers entire player area)
                if (_showAdBreak && _adBreakAds.isNotEmpty)
                  Positioned.fill(
                    child: AdBreakOverlay(
                      ads: _adBreakAds,
                      channelName: _channel?.name ?? 'Channel',
                      channelId: _channelId,
                      onComplete: _onAdBreakComplete,
                    ),
                  ),
                // Timer overlay (top-left)
                if (initialized)
                  Positioned(top: 8, left: 8, child: _buildTimerOverlay(ctrl)),
                // Channel logo + name badge (top-right)
                if (_channel != null)
                  Positioned(top: 8, right: 8, child: _buildChannelBadge()),
                // Fullscreen toggle (bottom-right)
                if (!useYouTubeEmbed)
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: _enterFullscreen,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.fullscreen_rounded,
                          color: AppColors.white,
                          size: 22,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),

        // Now playing info (no seek bar — live TV)
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title row — hidden when the title duplicates the channel
                // name (YouTube/external mode). The info icon always stays
                // visible; when the title is suppressed it moves to the
                // trailing end of the channel info row below.
                if (_videoTitle.isNotEmpty &&
                    _videoTitle != (_channel?.name ?? '')) ...[
                  GestureDetector(
                    onTap: () {
                      final desc =
                          _nowPlaying?['video_description'] as String? ?? '';
                      _showDescriptionPopup(_videoTitle, desc);
                    },
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _videoTitle,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          Icons.info_outline,
                          color: AppColors.goldText,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // Channel info row — logo, name, badge, category.
                // When the title row is hidden the info icon is shown here.
                if (_channel != null)
                  _buildChannelInfoRow(
                    showInfoIcon:
                        _videoTitle.isEmpty ||
                        _videoTitle == (_channel?.name ?? ''),
                  ),

                const SizedBox(height: 12),

                // Live position indicator (read-only, no seek)
                _buildLiveIndicator(),

                const SizedBox(height: 16),

                // Volume control (only control allowed)
                _buildVolumeControl(),

                const SizedBox(height: 16),

                _buildSurferBar(),

                const SizedBox(height: 16),

                // Reaction + Gift bar
                _buildInteractionBar(),

                const SizedBox(height: 16),

                _buildEngagementTabsPanel(),

                // Up next
                if (_nextProgram != null) ...[
                  const SizedBox(height: 28),
                  _buildUpNextCard(),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ─── Channel info row ───
  // Logo (left, spans both name + category rows) | Name + badge / Category

  Widget _buildChannelInfoRow({bool showInfoIcon = false}) {
    final ch = _channel;
    if (ch == null) return const SizedBox.shrink();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Tappable section: logo + name + badge + category
        Expanded(
          child: GestureDetector(
            onTap: () =>
                Navigator.pushNamed(context, '/channel-view', arguments: ch.id),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Logo — fixed size, visually spans both text rows
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: AppColors.cardBg,
                    border: Border.all(
                      color: AppColors.inputBorder.withValues(alpha: 0.35),
                    ),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ch.logoUrl != null
                      ? Image.network(
                          AppConfig.mediaUrl(ch.logoUrl!),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.tv_rounded,
                            color: AppColors.goldText,
                            size: 24,
                          ),
                        )
                      : const Icon(
                          Icons.tv_rounded,
                          color: AppColors.goldText,
                          size: 24,
                        ),
                ),
                const SizedBox(width: 12),
                // Name + badge (row 1) and category (row 2)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              ch.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 5),
                          const Icon(
                            Icons.verified_user_rounded,
                            color: AppColors.goldText,
                            size: 15,
                          ),
                        ],
                      ),
                      if (ch.category != null && ch.category!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          ch.category!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.goldText,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        // Info icon — shown when the title row is suppressed (title == channel name)
        if (showInfoIcon) ...[
          const SizedBox(width: 10),
          GestureDetector(
            onTap: () {
              final desc = _nowPlaying?['video_description'] as String? ?? '';
              _showDescriptionPopup(ch.name, desc);
            },
            child: Icon(
              Icons.info_outline,
              color: AppColors.goldText,
              size: 20,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildLiveIndicator() {
    final ctrl = _player?.controller;
    if (ctrl == null || !ctrl.value.isInitialized) {
      return const SizedBox.shrink();
    }

    return ValueListenableBuilder(
      valueListenable: ctrl,
      builder: (_, value, __) {
        // Timer is now shown as an overlay on the video — see _buildPlayer()
        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildVolumeControl() {
    // YouTube WebView mode — control via postMessage
    if (_externalRuntimeMode == 'youtube' && _ytWebViewController != null) {
      return Row(
        children: [
          Icon(
            _ytVolume > 0 ? Icons.volume_up : Icons.volume_off,
            color: AppColors.hintText,
            size: 22,
          ),
          Expanded(
            child: Slider(
              value: _ytVolume,
              onChanged: (v) {
                setState(() => _ytVolume = v);
                final vol = (v * 100).round();
                final js = v == 0
                    ? 'try{document.getElementById("yt").contentWindow'
                          '.postMessage(\'{"event":"command","func":"mute","args":[]}\', "*");}catch(e){}'
                    : 'try{document.getElementById("yt").contentWindow'
                          '.postMessage(\'{"event":"command","func":"unMute","args":[]}\', "*");}catch(e){};'
                          'try{document.getElementById("yt").contentWindow'
                          '.postMessage(\'{"event":"command","func":"setVolume","args":[$vol]}\', "*");}catch(e){}';
                _ytWebViewController!.runJavaScript(js).catchError((_) {});
              },
              activeColor: AppColors.orange,
              inactiveColor: AppColors.inputBorder.withValues(alpha: 0.3),
            ),
          ),
        ],
      );
    }

    // Native player mode
    final ctrl = _player?.controller;
    if (ctrl == null || !ctrl.value.isInitialized) {
      return const SizedBox.shrink();
    }
    return ValueListenableBuilder(
      valueListenable: ctrl,
      builder: (_, value, __) {
        return Row(
          children: [
            Icon(
              value.volume > 0 ? Icons.volume_up : Icons.volume_off,
              color: AppColors.hintText,
              size: 22,
            ),
            Expanded(
              child: Slider(
                value: value.volume,
                onChanged: (v) => _player!.setVolume(v),
                activeColor: AppColors.orange,
                inactiveColor: AppColors.inputBorder.withValues(alpha: 0.3),
              ),
            ),
          ],
        );
      },
    );
  }

  void _showDescriptionPopup(
    String title,
    String description, {
    String? timeStr,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.inputBorder.withValues(alpha: 0.3),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.lightOrange.withValues(alpha: 0.15),
                      AppColors.orange.withValues(alpha: 0.05),
                    ],
                  ),
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(16),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (timeStr != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              timeStr,
                              style: TextStyle(
                                color: AppColors.goldText,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.pop(ctx),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.close,
                          color: AppColors.hintText,
                          size: 18,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Description body
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                    width: double.infinity,
                    child: Text(
                      description.isEmpty
                          ? 'No description available.'
                          : description,
                      style: TextStyle(
                        color: description.isEmpty
                            ? AppColors.goldText
                            : AppColors.white.withValues(alpha: 0.85),
                        fontSize: 14,
                        height: 1.5,
                        fontStyle: description.isEmpty
                            ? FontStyle.italic
                            : FontStyle.normal,
                      ),
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

  Widget _buildUpNextCard() {
    final title = _nextProgram!['video_title'] as String? ?? 'Unknown';
    final description = _nextProgram!['video_description'] as String? ?? '';
    final programId = _nextProgram!['program_id'] as String? ?? '';
    final startMs = (_nextProgram!['start_time'] as num?)?.toInt() ?? 0;
    final dt = DateTime.fromMillisecondsSinceEpoch(startMs);
    final timeStr =
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    final hasReminder =
        programId.isNotEmpty && _remindedProgramIds.contains(programId);

    return GestureDetector(
      onTap: () => _showDescriptionPopup(title, description, timeStr: timeStr),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.3),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.lightOrange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.skip_next,
                color: AppColors.lightOrange,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'UP NEXT',
                    style: TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Text(
              timeStr,
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (programId.isNotEmpty) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _toggleReminder(programId),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: hasReminder
                        ? AppColors.orange.withValues(alpha: 0.15)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: _reminderLoading
                      ? const Padding(
                          padding: EdgeInsets.all(8),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.orange,
                          ),
                        )
                      : Icon(
                          hasReminder
                              ? Icons.notifications_active
                              : Icons.notifications_none,
                          color: hasReminder
                              ? AppColors.orange
                              : AppColors.goldText,
                          size: 18,
                        ),
                ),
              ),
            ],
            const SizedBox(width: 8),
            Icon(Icons.info_outline, color: AppColors.goldText, size: 18),
          ],
        ),
      ),
    );
  }

  // ── Interaction bar ──────────────────────────────────────────────────

  static const _reactionEmojis = ['❤️', '🔥', '😂', '👏', '😮', '💯'];

  Widget _buildInteractionBar() {
    return Row(
      children: [
        // Free reaction emojis — scrollable to prevent overflow
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _reactionEmojis
                  .map(
                    (emoji) => GestureDetector(
                      onTap: () => _onReactionTap(emoji),
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.inputBorder.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          emoji,
                          style: const TextStyle(fontSize: 18),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Gift button — always visible on the right
        GestureDetector(
          onTap: _onGiftTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.lightOrange, AppColors.orange],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('🎁', style: TextStyle(fontSize: 18)),
                SizedBox(width: 4),
                Text(
                  'Gift',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEngagementTabsPanel() {
    if (_channelId == null) {
      return const SizedBox.shrink();
    }

    return DefaultTabController(
      length: 2,
      initialIndex: 0,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.3),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TabBar(
              labelColor: AppColors.white,
              unselectedLabelColor: AppColors.goldText,
              indicatorColor: AppColors.orange,
              indicatorWeight: 3,
              tabs: const [
                Tab(text: 'Live Chat'),
                Tab(text: 'Live Activity'),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 430,
              child: TabBarView(
                children: [
                  LiveChatPanel(channelId: _channelId!, embedded: true),
                  SingleChildScrollView(child: _buildLiveActivityContent()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLiveActivityContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Live Activity',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const Spacer(),
            Text(
              'Updates every 20s',
              style: TextStyle(
                color: AppColors.lightOrange.withValues(alpha: 0.85),
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (_recentEvents.isEmpty)
          Text(
            'No reactions or gifts yet for this session.',
            style: TextStyle(
              color: AppColors.lightOrange.withValues(alpha: 0.9),
              fontSize: 12,
            ),
          )
        else
          Column(
            children: _recentEvents.take(5).map((event) {
              final created = DateTime.fromMillisecondsSinceEpoch(
                event.createdAt,
              );
              final hh = created.hour.toString().padLeft(2, '0');
              final mm = created.minute.toString().padLeft(2, '0');
              final actionText = event.type == 'gift'
                  ? 'sent ${event.giftIcon ?? '🎁'} ${event.giftName ?? 'a gift'}'
                  : 'reacted ${event.emoji ?? '🔥'}';

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.inputFill.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: RichText(
                        overflow: TextOverflow.ellipsis,
                        text: TextSpan(
                          children: [
                            TextSpan(
                              text: event.senderName,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            TextSpan(
                              text: ' $actionText',
                              style: TextStyle(
                                color: AppColors.lightOrange.withValues(
                                  alpha: 0.95,
                                ),
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '$hh:$mm',
                      style: TextStyle(
                        color: AppColors.lightOrange.withValues(alpha: 0.75),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  Widget _buildSurferBar() {
    final canGoPrev = _surferIndex > 0;
    final canGoNext =
        _surferIndex >= 0 && _surferIndex < _surferChannels.length - 1;
    final prevLoading = _surferSwitching && _surferSwitchDirection < 0;
    final nextLoading = _surferSwitching && _surferSwitchDirection > 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.inputBorder.withValues(alpha: 0.35),
        ),
      ),
      child: Row(
        children: [
          _surferArrow(
            icon: Icons.skip_previous_rounded,
            enabled: canGoPrev,
            loading: prevLoading,
            onTap: () => _switchRelative(-1),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: GestureDetector(
              onTap: _surferError != null
                  ? _loadSurferChannels
                  : (_surferChannels.isEmpty ? null : _openSurferSheet),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.inputBorder),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.sensors_rounded,
                      size: 15,
                      color: AppColors.lightOrange,
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        _surferLoading
                            ? 'Loading channels...'
                            : _surferError != null
                            ? 'Channel surfer unavailable'
                            : _channel?.name ?? 'Channel Surfer',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      _surferChannels.isEmpty
                          ? '-'
                          : '${_surferIndex + 1}/${_surferChannels.length}',
                      style: TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(
                      _surferError != null
                          ? Icons.refresh_rounded
                          : Icons.expand_more_rounded,
                      size: 16,
                      color: AppColors.goldText,
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _surferArrow(
            icon: Icons.skip_next_rounded,
            enabled: canGoNext,
            loading: nextLoading,
            onTap: () => _switchRelative(1),
          ),
        ],
      ),
    );
  }

  Widget _surferArrow({
    required IconData icon,
    required bool enabled,
    bool loading = false,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: enabled && !loading && !_surferSwitching ? onTap : null,
      child: AnimatedOpacity(
        opacity: enabled || loading ? 1 : 0.35,
        duration: const Duration(milliseconds: 180),
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: loading
              ? const Padding(
                  padding: EdgeInsets.all(8),
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.lightOrange,
                  ),
                )
              : Icon(icon, color: AppColors.white, size: 18),
        ),
      ),
    );
  }

  void _onReactionTap(String emoji) {
    _overlayKey.currentState?.addReaction(emoji);
    if (_channelId != null) {
      InteractionService.sendReaction(
        channelId: _channelId!,
        emoji: emoji,
      ).catchError((_) {});
    }
  }

  Future<void> _onGiftTap() async {
    if (_channelId == null) return;
    final result = await GiftSheet.show(context, _channelId!);
    if (result != null && mounted) {
      _overlayKey.currentState?.showGift(
        senderName: result['sender_name'] as String? ?? 'You',
        giftName: result['gift_name'] as String? ?? 'Gift',
        giftIcon: result['gift_icon'] as String? ?? '🎁',
        combo: (result['combo'] as num?)?.toInt() ?? 1,
        senderRepLevel: (result['sender_rep_level'] as num?)?.toInt() ?? 0,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fullscreen Gift Panel — renders in-tree (no modal route) so it appears above
// the immersive fullscreen video surface on all Android devices.
// ─────────────────────────────────────────────────────────────────────────────

class _FullscreenGiftPanel extends StatefulWidget {
  final String channelId;
  final GlobalKey<GiftOverlayState> overlayKey;
  final VoidCallback onClose;

  const _FullscreenGiftPanel({
    required this.channelId,
    required this.overlayKey,
    required this.onClose,
  });

  @override
  State<_FullscreenGiftPanel> createState() => _FullscreenGiftPanelState();
}

class _FullscreenGiftPanelState extends State<_FullscreenGiftPanel> {
  List<GiftModel> _gifts = [];
  GiftWalletModel? _wallet;
  bool _loading = true;
  String? _sendingId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        InteractionService.getGifts(),
        InteractionService.getMyGiftWallet(),
      ]);
      if (!mounted) return;
      setState(() {
        _gifts = results[0] as List<GiftModel>;
        _wallet = results[1] as GiftWalletModel;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _sendGift(GiftModel gift) async {
    if (_sendingId != null) return;
    setState(() {
      _sendingId = gift.id;
      _error = null;
    });
    try {
      final result = await InteractionService.sendGift(
        channelId: widget.channelId,
        giftId: gift.id,
      );
      if (!mounted) return;
      widget.overlayKey.currentState?.showGift(
        senderName: result['sender_name'] as String? ?? 'You',
        giftName: result['gift_name'] as String? ?? 'Gift',
        giftIcon: result['gift_icon'] as String? ?? '🎁',
        combo: (result['combo'] as num?)?.toInt() ?? 1,
        senderRepLevel: (result['sender_rep_level'] as num?)?.toInt() ?? 0,
      );
      widget.onClose();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sendingId = null;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxHeight: 280),
      decoration: BoxDecoration(
        color: AppColors.darkBlue.withValues(alpha: 0.97),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: const Border(
          top: BorderSide(color: AppColors.inputBorder, width: 1),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          // Handle + header row
          Row(
            children: [
              const SizedBox(width: 16),
              const Text(
                'SEND A GIFT',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              if (_wallet != null)
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _wallet!.vptLabel,
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              GestureDetector(
                onTap: widget.onClose,
                child: Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.all(6),
                  child: const Icon(
                    Icons.close_rounded,
                    color: AppColors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.errorRed, fontSize: 12),
              ),
            ),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(30),
              child: CircularProgressIndicator(color: AppColors.orange),
            )
          else if (_gifts.isEmpty)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Text(
                'No gifts available',
                style: TextStyle(color: AppColors.goldText, fontSize: 14),
              ),
            )
          else
            Flexible(
              child: GridView.builder(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 5,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.75,
                ),
                itemCount: _gifts.length,
                itemBuilder: (_, i) {
                  final gift = _gifts[i];
                  final isSending = _sendingId == gift.id;
                  return GestureDetector(
                    onTap: isSending ? null : () => _sendGift(gift),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSending
                              ? AppColors.orange
                              : AppColors.inputBorder.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          isSending
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    color: AppColors.orange,
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(
                                  gift.icon,
                                  style: const TextStyle(fontSize: 22),
                                ),
                          const SizedBox(height: 4),
                          Text(
                            gift.name,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                          ),
                          Text(
                            gift.priceLabel,
                            style: const TextStyle(
                              color: AppColors.lightOrange,
                              fontSize: 9,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          // Settlement split info
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.cardBg.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  _fsSplitChip('Creator', '50%', AppColors.lightOrange),
                  const SizedBox(width: 6),
                  _fsSplitChip('Operations', '30%', AppColors.softBlue),
                  const SizedBox(width: 6),
                  _fsSplitChip('Community', '20%', AppColors.successGreen),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _fsSplitChip(String label, String pct, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Text(
              pct,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              label,
              style: TextStyle(
                color: AppColors.hintText,
                fontSize: 8,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Animated TV icon for the channel loading screen.
class _LoadingTvWidget extends StatefulWidget {
  @override
  State<_LoadingTvWidget> createState() => _LoadingTvWidgetState();
}

class _LoadingTvWidgetState extends State<_LoadingTvWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;
  late Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _scale = Tween<double>(
      begin: 0.92,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
    _glow = Tween<double>(
      begin: 0.3,
      end: 0.7,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
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
      builder: (_, __) => Transform.scale(
        scale: _scale.value,
        child: Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [AppColors.lightOrange, AppColors.orange],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.orange.withValues(alpha: _glow.value),
                blurRadius: 28,
                spreadRadius: 4,
              ),
            ],
          ),
          child: const Icon(
            Icons.live_tv_rounded,
            color: AppColors.white,
            size: 42,
          ),
        ),
      ),
    );
  }
}

/// Animated scanning dots for the channel loading screen.
class _DotsLoader extends StatefulWidget {
  const _DotsLoader();

  @override
  State<_DotsLoader> createState() => _DotsLoaderState();
}

class _DotsLoaderState extends State<_DotsLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
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
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            final delay = i * 0.33;
            final t = (_ctrl.value - delay).clamp(0.0, 1.0);
            final opacity = (t < 0.5 ? t * 2 : (1 - t) * 2).clamp(0.2, 1.0);
            return Container(
              width: 7,
              height: 7,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.orange.withValues(alpha: opacity),
              ),
            );
          }),
        );
      },
    );
  }
}

/// A pulsing/blinking dot widget for the Rerun badge.
class _PulsingDot extends StatefulWidget {
  final Color color;
  const _PulsingDot({required this.color});

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.3, end: 1.0).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
      ),
    );
  }
}
