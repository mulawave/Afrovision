import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/reputation_badge.dart';

/// Floating reaction and gift animation overlay.
/// Place as a Stack child over the video player area.
class GiftOverlay extends StatefulWidget {
  const GiftOverlay({super.key});

  @override
  State<GiftOverlay> createState() => GiftOverlayState();
}

class GiftOverlayState extends State<GiftOverlay> {
  final List<_FloatingEmoji> _emojis = [];
  final List<_GiftBanner> _banners = [];
  int _emojiId = 0;
  int _bannerId = 0;

  /// Show a floating emoji reaction.
  void addReaction(String emoji) {
    final id = _emojiId++;
    setState(() {
      _emojis.add(
        _FloatingEmoji(
          id: id,
          emoji: emoji,
          xOffset: Random().nextDouble() * 0.6 + 0.2,
        ),
      );
    });
    // Auto-remove after animation
    Future.delayed(const Duration(milliseconds: 2000), () {
      if (!mounted) return;
      setState(() {
        _emojis.removeWhere((e) => e.id == id);
      });
    });
  }

  /// Show a gift sent banner with optional combo.
  void showGift({
    required String senderName,
    required String giftName,
    required String giftIcon,
    int combo = 0,
    int senderRepLevel = 0,
  }) {
    final id = _bannerId++;
    setState(() {
      _banners.add(
        _GiftBanner(
          id: id,
          senderName: senderName,
          giftName: giftName,
          giftIcon: giftIcon,
          combo: combo,
          senderRepLevel: senderRepLevel,
        ),
      );
    });
    // Auto-remove after 3.5s
    Future.delayed(const Duration(milliseconds: 3500), () {
      if (!mounted) return;
      setState(() {
        _banners.removeWhere((b) => b.id == id);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          // Floating emojis
          ..._emojis.map(
            (e) => _FloatingEmojiWidget(key: ValueKey(e.id), data: e),
          ),
          // Gift banners
          Positioned(
            left: 12,
            bottom: 60,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: _banners
                  .map((b) => _GiftBannerWidget(key: ValueKey(b.id), data: b))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Floating Emoji ──────────────────────────────────────

class _FloatingEmoji {
  final int id;
  final String emoji;
  final double xOffset;
  _FloatingEmoji({
    required this.id,
    required this.emoji,
    required this.xOffset,
  });
}

class _FloatingEmojiWidget extends StatefulWidget {
  final _FloatingEmoji data;
  const _FloatingEmojiWidget({super.key, required this.data});

  @override
  State<_FloatingEmojiWidget> createState() => _FloatingEmojiWidgetState();
}

class _FloatingEmojiWidgetState extends State<_FloatingEmojiWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _yAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _yAnim = Tween<double>(
      begin: 1.0,
      end: 0.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _fadeAnim = Tween<double>(
      begin: 1.0,
      end: 0.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: const Interval(0.6, 1.0)));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _AnimBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return Positioned(
          left: MediaQuery.of(context).size.width * widget.data.xOffset,
          bottom: 40 + (1 - _yAnim.value) * 200,
          child: Opacity(
            opacity: _fadeAnim.value,
            child: Text(
              widget.data.emoji,
              style: const TextStyle(fontSize: 28),
            ),
          ),
        );
      },
    );
  }
}

// ─── Gift Banner ─────────────────────────────────────────

class _GiftBanner {
  final int id;
  final String senderName;
  final String giftName;
  final String giftIcon;
  final int combo;
  final int senderRepLevel;
  _GiftBanner({
    required this.id,
    required this.senderName,
    required this.giftName,
    required this.giftIcon,
    required this.combo,
    this.senderRepLevel = 0,
  });
}

class _GiftBannerWidget extends StatefulWidget {
  final _GiftBanner data;
  const _GiftBannerWidget({super.key, required this.data});

  @override
  State<_GiftBannerWidget> createState() => _GiftBannerWidgetState();
}

class _GiftBannerWidgetState extends State<_GiftBannerWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<Offset> _slideAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3500),
    );
    _slideAnim = Tween<Offset>(begin: const Offset(-1.0, 0.0), end: Offset.zero)
        .animate(
          CurvedAnimation(
            parent: _ctrl,
            curve: const Interval(0.0, 0.15, curve: Curves.easeOut),
          ),
        );
    _fadeAnim = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.75, 1.0, curve: Curves.easeIn),
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
    return SlideTransition(
      position: _slideAnim,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.darkBlue.withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.orange.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(widget.data.giftIcon, style: const TextStyle(fontSize: 22)),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (widget.data.senderRepLevel > 0) ...[
                        ReputationBadgeWidget(
                          level: widget.data.senderRepLevel,
                          size: 13,
                        ),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        '${widget.data.senderName} sent ${widget.data.giftIcon} ${widget.data.giftName}',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  if (widget.data.combo > 1)
                    Text(
                      'x${widget.data.combo} COMBO!',
                      style: const TextStyle(
                        color: AppColors.orange,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
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
}

/// Helper: _AnimBuilder is just AnimatedWidget shorthand
class _AnimBuilder extends AnimatedWidget {
  final Widget Function(BuildContext, Widget?) builder;

  const _AnimBuilder({
    required Animation<double> animation,
    required this.builder,
  }) : super(listenable: animation);

  @override
  Widget build(BuildContext context) {
    return builder(context, null);
  }
}
