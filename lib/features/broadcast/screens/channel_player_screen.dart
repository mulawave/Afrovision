import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:video_player/video_player.dart';
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
  Timer? _hideControlsTimer;

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
        final startTime = _nowPlaying!['start_time'] as int? ?? 0;
        final endTime = _nowPlaying!['end_time'] as int? ?? 0;
        _duration = _nowPlaying!['duration'] as int? ?? 0;
        _videoTitle = _nowPlaying!['video_title'] as String? ?? '';
        _isLoop = _nowPlaying!['is_loop'] as bool? ?? false;
        final positionSec = _nowPlaying!['position'] as int? ?? 0;
        final videoUrl = _nowPlaying!['video_url'] as String? ?? '';
        // Use video URL directly if it's already a full URL (GCS),
        // otherwise prepend the backend base URL
        final fullUrl = videoUrl.startsWith('http')
            ? videoUrl
            : '${AppConfig.baseUrl}$videoUrl';

        await _initBroadcastPlayer(
          fullUrl,
          startTime,
          endTime,
          _duration,
          positionSec,
          _isLoop,
        );

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
          child: FadeTransition(
            opacity: _fadeIn,
            child: Column(
              children: [
                _buildHeader(),
                Expanded(child: _buildBody()),
              ],
            ),
          ),
        ),
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
            // Gift overlay
            GiftOverlay(key: _overlayKey),
            // Timer overlay (top-left)
            if (initialized)
              Positioned(top: 12, left: 12, child: _buildTimerOverlay(ctrl)),
            // Channel logo + name (top-right)
            if (_channel != null)
              Positioned(top: 12, right: 12, child: _buildChannelBadge()),
            // Fullscreen controls overlay
            if (_showFullscreenControls)
              Positioned(
                top: 12,
                right: _channel != null ? 12 : 12,
                bottom: 12,
                left: 12,
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: () {}, // absorb taps so outer GestureDetector doesn't toggle controls
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Interactions menu button
                          _buildFloatingMenuButton(),
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
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildFloatingMenuButton() {
    return PopupMenuButton<String>(
      icon: Container(
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
      color: AppColors.cardBg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: (value) {
        if (value == 'gift') {
          showModalBottomSheet(
            context: context,
            backgroundColor: Colors.transparent,
            isScrollControlled: true,
            builder: (_) => GiftSheet(channelId: _channelId!),
          );
        } else if (value == 'react') {
          _onReactionTap('❤️');
        } else if (value == 'chat') {
          _exitFullscreen();
        }
      },
      itemBuilder: (_) => [
        const PopupMenuItem(
          value: 'gift',
          child: Row(
            children: [
              Icon(
                Icons.card_giftcard_rounded,
                color: AppColors.orange,
                size: 18,
              ),
              SizedBox(width: 8),
              Text('Gift', style: TextStyle(color: AppColors.white)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'react',
          child: Row(
            children: [
              Icon(Icons.favorite_rounded, color: AppColors.orange, size: 18),
              SizedBox(width: 8),
              Text('React', style: TextStyle(color: AppColors.white)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'chat',
          child: Row(
            children: [
              Icon(Icons.chat_rounded, color: AppColors.orange, size: 18),
              SizedBox(width: 8),
              Text('Chat', style: TextStyle(color: AppColors.white)),
            ],
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
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.orange),
      );
    }

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
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.8),
                  fontSize: 14,
                ),
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
                    color: AppColors.hintText.withValues(alpha: 0.4),
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
                  color: AppColors.hintText.withValues(alpha: 0.4),
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
              style: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.7),
                fontSize: 13,
              ),
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
                    color: AppColors.hintText.withValues(alpha: 0.4),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'STANDBY',
                  style: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.4),
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
                        color: AppColors.hintText.withValues(alpha: 0.5),
                        size: 20,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Live position indicator (read-only, no seek)
                _buildLiveIndicator(),

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
                                color: AppColors.hintText.withValues(
                                  alpha: 0.7,
                                ),
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
                            ? AppColors.hintText.withValues(alpha: 0.5)
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
    final startMs = _nextProgram!['start_time'] as int? ?? 0;
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
                              : AppColors.hintText.withValues(alpha: 0.5),
                          size: 18,
                        ),
                ),
              ),
            ],
            const SizedBox(width: 8),
            Icon(
              Icons.info_outline,
              color: AppColors.hintText.withValues(alpha: 0.5),
              size: 18,
            ),
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
        // Free reaction emojis
        ..._reactionEmojis.map(
          (emoji) => GestureDetector(
            onTap: () => _onReactionTap(emoji),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.inputBorder.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(emoji, style: const TextStyle(fontSize: 18)),
            ),
          ),
        ),
        const Spacer(),
        // Gift button
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
        combo: result['combo'] as int? ?? 1,
      );
    }
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
