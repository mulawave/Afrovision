import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:video_player/video_player.dart';
import 'package:youtube_explode_dart/youtube_explode_dart.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
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
  int _surferIndex = -1;
  String? _surferError;

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
    _eventTimer?.cancel();
    _hideControlsTimer?.cancel();
    _player?.dispose();
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
      _player?.onAppResumed();
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
    setState(() {
      _loading = true;
      _error = null;
      _premiumBlocked = false;
    });

    try {
      _channel = await ChannelService.getChannelById(_channelId!);

      // Keep analytics parity with website by recording channel view on open.
      ChannelService.recordView(_channelId!).catchError((_) {});
      _loadFollowStatus();
      _loadSurferChannels();

      if (_channel!.requiresPayment) {
        final access = await PremiumStreamService.checkAccess(_channelId!);
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

      await BroadcastService.syncServerOffset();

      final data = await BroadcastService.getNowPlaying(_channelId!);
      if (!mounted) return;

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
        // Use video URL directly if it's already a full URL (GCS),
        // otherwise prepend the backend base URL
        final fullUrl = videoUrl.startsWith('http')
            ? videoUrl
            : '${AppConfig.baseUrl}$videoUrl';

        // Check if this is an external stream
        if (_channel != null && _channel!.streamSourceMode != 'native') {
          await _initExternalStream(_channel!, startTime, endTime, _duration);
        } else {
          await _initBroadcastPlayer(
            fullUrl,
            startTime,
            endTime,
            _duration,
            positionSec,
            _isLoop,
          );
        }

        // Trigger pre-roll (first load) or mid-roll (program change)
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!_preRollDone) {
            _checkPreRoll();
          } else {
            _checkMidRoll();
          }
        });
      } else {
        _isLoop = false;
        _eventTimer?.cancel();
        setState(() => _loading = false);
        _animCtrl.forward();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
      _eventTimer?.cancel();
      _animCtrl.forward();
    }
  }

  Future<void> _loadFollowStatus() async {
    final ch = _channel;
    if (ch == null) return;
    try {
      final status = await ChannelService.getFollowStatus(ch.ownerId);
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
          ? await ChannelService.unfollowCreator(ch.ownerId)
          : await ChannelService.followCreator(ch.ownerId);
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

  Future<void> _loadSurferChannels() async {
    if (_channelId == null) return;
    setState(() {
      _surferLoading = true;
      _surferError = null;
    });
    try {
      final channels = await ChannelService.getPublicChannels();
      if (!mounted) return;

      var list = channels;
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
    if (_channelId == next.id || _loading) return;
    setState(() {
      _channelId = next.id;
    });
    await _loadReminders();
    await _fetchNowPlaying();
  }

  void _switchRelative(int direction) {
    if (_surferChannels.isEmpty || _surferIndex < 0) return;
    final nextIndex = (_surferIndex + direction).clamp(
      0,
      _surferChannels.length - 1,
    );
    if (nextIndex == _surferIndex) return;
    _switchToChannel(_surferChannels[nextIndex]);
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
    _player?.dispose();

    final player = BroadcastPlayer();
    _player = player;

    player.onProgramEnded = () {
      if (mounted) _fetchNowPlaying();
    };

    player.addListener(() {
      if (mounted) setState(() {});
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
      setState(() => _loading = false);
      _animCtrl.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load video: $e';
        _loading = false;
      });
      _eventTimer?.cancel();
      _animCtrl.forward();
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

    if (channel.streamSourceMode == 'external_youtube') {
      await _resolveYouTubeStream(playbackUrl, startTime, endTime, duration);
    } else if (channel.streamSourceMode == 'external_hls' ||
        channel.streamSourceMode == 'external_dash') {
      await _playExternalStream(playbackUrl, startTime, endTime, duration);
    } else {
      setState(() {
        _error =
            'Unsupported external stream mode: ${channel.streamSourceMode}';
        _loading = false;
      });
      _animCtrl.forward();
    }
  }

  Future<void> _resolveYouTubeStream(
    String url,
    int startTime,
    int endTime,
    int duration,
  ) async {
    final yt = YoutubeExplode();
    try {
      final videoId = VideoId.parseVideoId(url);
      if (videoId == null) {
        throw Exception('Invalid YouTube URL: $url');
      }

      final manifest = await yt.videos.streamsClient
          .getManifest(videoId)
          .timeout(const Duration(seconds: 15));

      // Prefer muxed streams so video + audio are both available.
      final muxed = manifest.muxed.sortByBitrate();
      final info = muxed.isNotEmpty
          ? muxed.last
          : (throw Exception('No playable YouTube stream variants found.'));

      await _initBroadcastPlayer(
        info.url.toString(),
        startTime,
        endTime,
        duration,
        0,
        false,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not resolve YouTube playback stream: $e';
        _loading = false;
      });
      _eventTimer?.cancel();
      _animCtrl.forward();
    } finally {
      yt.close();
    }
  }

  Future<void> _playExternalStream(
    String url,
    int startTime,
    int endTime,
    int duration,
  ) async {
    final fullUrl = url.startsWith('http') ? url : '${AppConfig.baseUrl}$url';
    await _initBroadcastPlayer(fullUrl, startTime, endTime, duration, 0, false);
  }

  void _startEventPolling() {
    _eventTimer?.cancel();
    _lastEventAt = DateTime.now().millisecondsSinceEpoch;
    _eventTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (_channelId == null) return;
      try {
        final events = await InteractionService.getChannelEvents(
          _channelId!,
          _lastEventAt,
        );
        if (events.isEmpty) return;

        for (final event in events) {
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
          if (event.createdAt > _lastEventAt) {
            _lastEventAt = event.createdAt;
          }
        }
      } catch (e) {
        debugPrint('[ChannelPlayer] event poll error: $e');
      }
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

  @override
  Widget build(BuildContext context) {
    if (_isFullscreen) return _buildFullscreenPlayer();
    return Scaffold(
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
                child: _loading
                    ? _buildLoadingState()
                    : FadeTransition(opacity: _fadeIn, child: _buildBody()),
              ),
            ],
          ),
        ),
      ),
    );
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
      ],
    );
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
            onTap: () => Navigator.pop(context),
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
          if (_channel != null)
            Container(
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
                  GestureDetector(
                    onTap: _followLoading ? null : _toggleFollow,
                    child: _followLoading
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
                  ),
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
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline,
                color: AppColors.errorRed,
                size: 48,
              ),
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(color: AppColors.errorRed, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              GestureDetector(
                onTap: _fetchNowPlaying,
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
                    'Retry',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
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

    // No program currently playing
    if (_nowPlaying == null) {
      return _buildNoProgram();
    }

    // Playing
    return _buildPlayer();
  }

  Widget _buildNoProgram() {
    final hasLogo = _channel?.logoUrl != null;
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
  }

  Widget _buildPlayer() {
    final ctrl = _player?.controller;
    final initialized = ctrl != null && ctrl.value.isInitialized;

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
                if (_player?.isBuffering == true && initialized)
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
                // Title (tap for description)
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
                const SizedBox(height: 12),

                // Live position indicator (read-only, no seek)
                _buildLiveIndicator(),

                const SizedBox(height: 16),

                _buildSurferBar(),

                const SizedBox(height: 16),

                // Reaction + Gift bar
                _buildInteractionBar(),

                const SizedBox(height: 16),

                // Volume control (only control allowed)
                _buildVolumeControl(),

                // Up next
                if (_nextProgram != null) ...[
                  const SizedBox(height: 28),
                  _buildUpNextCard(),
                ],

                const SizedBox(height: 28),
                LiveChatPanel(channelId: _channelId!),
              ],
            ),
          ),
        ),
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

  Widget _buildSurferBar() {
    final canGoPrev = _surferIndex > 0;
    final canGoNext =
        _surferIndex >= 0 && _surferIndex < _surferChannels.length - 1;

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
            onTap: () => _switchRelative(1),
          ),
        ],
      ),
    );
  }

  Widget _surferArrow({
    required IconData icon,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedOpacity(
        opacity: enabled ? 1 : 0.35,
        duration: const Duration(milliseconds: 180),
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: Icon(icon, color: AppColors.white, size: 18),
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
          const SizedBox(height: 12),
        ],
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
