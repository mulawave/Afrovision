import 'package:flutter/material.dart';
import 'dart:async';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../services/broadcast_service.dart';
import '../widgets/broadcast_player.dart';
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
      if (_channelId != null) _fetchNowPlaying();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _eventTimer?.cancel();
    _player?.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  // ─── App lifecycle: resync on resume ───

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _player?.onAppResumed();
    }
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

  // ─── Build ───

  @override
  Widget build(BuildContext context) {
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
                    ? AppColors.hintText.withValues(alpha: 0.2)
                    : AppColors.orange.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _isLoop
                      ? AppColors.hintText.withValues(alpha: 0.5)
                      : AppColors.orange.withValues(alpha: 0.5),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _isLoop ? AppColors.hintText : AppColors.orange,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _isLoop ? 'REPLAY' : 'LIVE',
                    style: TextStyle(
                      color: _isLoop ? AppColors.hintText : AppColors.orange,
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
                  _channel!.logoUrl!.startsWith('http')
                      ? _channel!.logoUrl!
                      : '${AppConfig.baseUrl}${_channel!.logoUrl}',
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
        // Video player with buffering overlay
        Stack(
          alignment: Alignment.center,
          children: [
            if (initialized)
              AspectRatio(
                aspectRatio: ctrl.value.aspectRatio,
                child: VideoPlayer(ctrl),
              )
            else
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  color: Colors.black,
                  child: const Center(
                    child: CircularProgressIndicator(color: AppColors.orange),
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
          ],
        ),

        // Now playing info (no seek bar — live TV)
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title
                Text(
                  _videoTitle,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
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
        final current = value.position.inSeconds;
        final total = _duration > 0 ? _duration : 1;
        final progress = (current / total).clamp(0.0, 1.0);

        String formatTime(int sec) {
          final m = (sec ~/ 60).toString().padLeft(2, '0');
          final s = (sec % 60).toString().padLeft(2, '0');
          return '$m:$s';
        }

        return Column(
          children: [
            // Non-interactive progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: AppColors.inputBorder.withValues(alpha: 0.3),
                valueColor: const AlwaysStoppedAnimation<Color>(
                  AppColors.orange,
                ),
                minHeight: 4,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  formatTime(current),
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                // Live indicator instead of total time
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: _isLoop ? AppColors.hintText : AppColors.orange,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _isLoop ? 'REPLAY' : 'LIVE',
                      style: TextStyle(
                        color: _isLoop ? AppColors.hintText : AppColors.orange,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        );
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

  Widget _buildUpNextCard() {
    final title = _nextProgram!['video_title'] as String? ?? 'Unknown';
    final startMs = _nextProgram!['start_time'] as int? ?? 0;
    final dt = DateTime.fromMillisecondsSinceEpoch(startMs);
    final timeStr =
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
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
        ],
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
