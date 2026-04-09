import 'dart:async';
import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';

/// AfroVision branded flash screen overlay for program transitions.
/// Shows "Coming Up Next" or "Now Playing" with optional ElevenLabs TTS.
class FlashScreenOverlay extends StatefulWidget {
  final String type; // 'coming_up' or 'now_playing'
  final String title;
  final String channelName;
  final Duration duration;
  final VoidCallback onComplete;

  const FlashScreenOverlay({
    super.key,
    required this.type,
    required this.title,
    required this.channelName,
    this.duration = const Duration(seconds: 4),
    required this.onComplete,
  });

  @override
  State<FlashScreenOverlay> createState() => _FlashScreenOverlayState();
}

class _FlashScreenOverlayState extends State<FlashScreenOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;
  AudioPlayer? _audioPlayer;
  Timer? _dismissTimer;

  String get _heading =>
      widget.type == 'now_playing' ? 'Now Playing' : 'Coming Up Next';

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));

    _animCtrl.forward();
    _playTTS();

    _dismissTimer = Timer(widget.duration, () {
      if (!mounted) return;
      _animCtrl.reverse().then((_) {
        if (mounted) widget.onComplete();
      });
    });
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    _audioPlayer?.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _playTTS() async {
    try {
      final url =
          '${AppConfig.baseUrl}/broadcast/flash-audio'
          '?type=${widget.type}'
          '&title=${Uri.encodeComponent(widget.title)}'
          '&channel_name=${Uri.encodeComponent(widget.channelName)}';
      _audioPlayer = AudioPlayer();
      await _audioPlayer!.play(UrlSource(url));
    } catch (_) {
      // TTS not available — silent flash
    }
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Container(
        color: Colors.black.withValues(alpha: 0.95),
        child: Stack(
          children: [
            // Animated decoration lines
            Positioned(
              top: MediaQuery.of(context).size.height * 0.25,
              left: 0,
              right: 0,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      AppColors.orange.withValues(alpha: 0.2),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              top: MediaQuery.of(context).size.height * 0.75,
              left: 0,
              right: 0,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      AppColors.lightOrange.withValues(alpha: 0.15),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // Main content
            Center(
              child: SlideTransition(
                position: _slideAnim,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // AfroVision logo
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.orange, AppColors.lightOrange],
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.tv,
                            color: AppColors.darkBlue,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'AfroVision',
                          style: TextStyle(
                            color: AppColors.white.withValues(alpha: 0.6),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Type label
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.orange.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: AppColors.orange.withValues(alpha: 0.25),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: AppColors.orange,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _heading.toUpperCase(),
                            style: const TextStyle(
                              color: AppColors.orange,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Title
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        widget.title,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Channel name
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: 'on ',
                            style: TextStyle(
                              color: AppColors.white.withValues(alpha: 0.4),
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
                        ],
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
}
