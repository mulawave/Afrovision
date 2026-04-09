import 'dart:async';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../services/broadcast_service.dart';

/// DSTV-style ad break overlay for the Flutter channel player.
/// Plays a list of in-stream ads sequentially with intro/outro transitions.
class AdBreakOverlay extends StatefulWidget {
  final List<Map<String, dynamic>> ads;
  final String channelName;
  final String? channelId;
  final VoidCallback onComplete;

  const AdBreakOverlay({
    super.key,
    required this.ads,
    required this.channelName,
    this.channelId,
    required this.onComplete,
  });

  @override
  State<AdBreakOverlay> createState() => _AdBreakOverlayState();
}

enum _AdPhase { intro, playing, outro }

class _AdBreakOverlayState extends State<AdBreakOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  _AdPhase _phase = _AdPhase.intro;
  int _currentIndex = 0;
  int _countdown = 0;
  Timer? _countdownTimer;
  Timer? _phaseTimer;
  Timer? _fallbackTimer;
  VideoPlayerController? _adController;
  final Set<String> _recordedImpressions = {};

  Map<String, dynamic> get _currentAd => widget.ads[_currentIndex];
  int get _totalAds => widget.ads.length;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
    _startIntro();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _phaseTimer?.cancel();
    _fallbackTimer?.cancel();
    _adController?.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _startIntro() {
    setState(() => _phase = _AdPhase.intro);
    _phaseTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) _startPlaying();
    });
  }

  Future<void> _startPlaying() async {
    setState(() => _phase = _AdPhase.playing);

    final ad = _currentAd;
    final mediaUrl = ad['media_url'] as String? ?? '';
    final fullUrl = mediaUrl.startsWith('http')
        ? mediaUrl
        : '${AppConfig.baseUrl}$mediaUrl';
    final duration = (ad['duration'] as num?)?.toInt() ?? 15;

    setState(() => _countdown = duration);

    // Record impression
    _recordImpression(ad);

    // Countdown timer
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _countdown = (_countdown - 1).clamp(0, 999));
    });

    // Initialize ad video
    _adController?.dispose();
    try {
      _adController = VideoPlayerController.networkUrl(Uri.parse(fullUrl));
      await _adController!.initialize();
      if (!mounted) return;
      await _adController!.play();
      setState(() {});

      _adController!.addListener(_onAdVideoStateChange);
    } catch (_) {
      // Video failed — skip after duration
    }

    // Fallback: skip after duration + 3s grace
    _fallbackTimer?.cancel();
    _fallbackTimer = Timer(Duration(seconds: duration + 3), () {
      if (mounted) _onAdFinished();
    });
  }

  void _onAdVideoStateChange() {
    if (_adController == null || !_adController!.value.isInitialized) return;
    if (_adController!.value.position >= _adController!.value.duration &&
        _adController!.value.duration > Duration.zero) {
      _onAdFinished();
    }
  }

  void _onAdFinished() {
    _countdownTimer?.cancel();
    _fallbackTimer?.cancel();
    _adController?.removeListener(_onAdVideoStateChange);

    if (_currentIndex < _totalAds - 1) {
      setState(() => _currentIndex++);
      // Brief pause between ads
      _phaseTimer = Timer(const Duration(milliseconds: 600), () {
        if (mounted) _startPlaying();
      });
    } else {
      _startOutro();
    }
  }

  void _startOutro() {
    _adController?.pause();
    setState(() => _phase = _AdPhase.outro);
    _phaseTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) widget.onComplete();
    });
  }

  void _recordImpression(Map<String, dynamic> ad) {
    final adId = ad['id'] as String? ?? '';
    if (adId.isEmpty || _recordedImpressions.contains(adId)) return;
    _recordedImpressions.add(adId);
    BroadcastService.recordAdImpression(
      adId: adId,
      channelId: widget.channelId,
    ).catchError((_) => <String, dynamic>{});
  }

  String _getCategoryLabel(String category) {
    switch (category) {
      case 'in_stream_pre':
        return 'Pre-Roll';
      case 'in_stream_mid':
        return 'Mid-Roll';
      case 'in_stream_brief':
        return 'Brief';
      default:
        return 'Ad';
    }
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Container(
        color: Colors.black,
        child: Stack(
          children: [
            if (_phase == _AdPhase.intro) _buildIntro(),
            if (_phase == _AdPhase.playing) _buildPlaying(),
            if (_phase == _AdPhase.outro) _buildOutro(),
          ],
        ),
      ),
    );
  }

  Widget _buildIntro() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF050A30), Color(0xFF0A1545), Color(0xFF050A30)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // AfroVision icon
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.orange, AppColors.lightOrange],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.tv, color: AppColors.darkBlue, size: 28),
            ),
            const SizedBox(height: 8),
            Text(
              'AfroVision',
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.8),
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Ad Break',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 26,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text:
                        '$_totalAds ad${_totalAds != 1 ? 's' : ''} · Returning to ',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.5),
                      fontSize: 13,
                    ),
                  ),
                  TextSpan(
                    text: widget.channelName,
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  TextSpan(
                    text: ' shortly',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.5),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: AppColors.orange,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaying() {
    final ad = _currentAd;
    final title = ad['title'] as String? ?? 'Advertisement';
    final description = ad['description'] as String? ?? '';
    final clickUrl = ad['click_url'] as String? ?? '';
    final category = ad['category'] as String? ?? '';
    final duration = (ad['duration'] as num?)?.toInt() ?? 15;
    final progress = duration > 0
        ? ((duration - _countdown) / duration).clamp(0.0, 1.0)
        : 0.5;

    return Stack(
      children: [
        // Ad video
        if (_adController != null && _adController!.value.isInitialized)
          Center(
            child: AspectRatio(
              aspectRatio: _adController!.value.aspectRatio,
              child: VideoPlayer(_adController!),
            ),
          )
        else
          const Center(
            child: CircularProgressIndicator(color: AppColors.orange),
          ),

        // Top bar: Ad indicator
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.black.withValues(alpha: 0.8),
                  Colors.transparent,
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.tv, color: AppColors.darkBlue, size: 12),
                      const SizedBox(width: 4),
                      Text(
                        'Ad ${_currentIndex + 1} of $_totalAds',
                        style: const TextStyle(
                          color: AppColors.darkBlue,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _getCategoryLabel(category),
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.7),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _countdown > 0 ? '${_countdown}s' : 'Ending...',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.6),
                      fontSize: 10,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Bottom bar: progress + title
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.8),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Progress bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: AppColors.white.withValues(alpha: 0.1),
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      AppColors.orange,
                    ),
                    minHeight: 3,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: TextStyle(
                              color: AppColors.white.withValues(alpha: 0.9),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (description.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              description,
                              style: TextStyle(
                                color: AppColors.white.withValues(alpha: 0.5),
                                fontSize: 10,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (clickUrl.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Learn More',
                              style: TextStyle(
                                color: AppColors.white.withValues(alpha: 0.8),
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              Icons.open_in_new,
                              color: AppColors.white.withValues(alpha: 0.6),
                              size: 12,
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOutro() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF050A30), Color(0xFF0A1545), Color(0xFF050A30)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.orange, AppColors.lightOrange],
                ),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.play_arrow,
                color: AppColors.darkBlue,
                size: 28,
              ),
            ),
            const SizedBox(height: 16),
            Text.rich(
              TextSpan(
                children: [
                  const TextSpan(
                    text: 'Returning to ',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  TextSpan(
                    text: widget.channelName,
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Your program continues now',
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.5),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 28),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: AppColors.lightOrange,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
