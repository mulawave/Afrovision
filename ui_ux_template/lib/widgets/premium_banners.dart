// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — BANNERS & NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  NOTIFICATION BANNER — slides in from top, auto-dismisses.
// ─────────────────────────────────────────────────────────────────────────────

/// Premium overlay notification banner with slide-in animation.
///
/// ```dart
/// PremiumNotificationBanner.show(context,
///   title: 'Payment received',
///   body: 'Your wallet has been credited.',
///   type: BannerType.success,
/// );
/// ```
class PremiumNotificationBanner {
  PremiumNotificationBanner._();

  static OverlayEntry? _currentEntry;
  static Timer? _autoDismiss;

  static void show(
    BuildContext context, {
    required String title,
    required String body,
    BannerType type = BannerType.info,
    VoidCallback? onTap,
    Duration duration = const Duration(seconds: 5),
  }) {
    dismiss();

    final overlay = Overlay.of(context);
    final c = PremiumTheme.colors;

    Color accentColor;
    IconData icon;

    switch (type) {
      case BannerType.success:
        accentColor = c.success;
        icon = Icons.check_circle_rounded;
        break;
      case BannerType.error:
        accentColor = c.error;
        icon = Icons.cancel_rounded;
        break;
      case BannerType.warning:
        accentColor = c.accentLight;
        icon = Icons.warning_rounded;
        break;
      case BannerType.info:
        accentColor = c.accent;
        icon = Icons.notifications_active_rounded;
        break;
    }

    _currentEntry = OverlayEntry(
      builder: (_) => _BannerWidget(
        title: title,
        body: body,
        accentColor: accentColor,
        icon: icon,
        onTap: () {
          dismiss();
          onTap?.call();
        },
        onDismiss: dismiss,
      ),
    );

    overlay.insert(_currentEntry!);
    _autoDismiss = Timer(duration, dismiss);
  }

  static void dismiss() {
    _autoDismiss?.cancel();
    _autoDismiss = null;
    _currentEntry?.remove();
    _currentEntry = null;
  }
}

enum BannerType { success, error, warning, info }

class _BannerWidget extends StatefulWidget {
  final String title;
  final String body;
  final Color accentColor;
  final IconData icon;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  const _BannerWidget({
    required this.title,
    required this.body,
    required this.accentColor,
    required this.icon,
    required this.onTap,
    required this.onDismiss,
  });

  @override
  State<_BannerWidget> createState() => _BannerWidgetState();
}

class _BannerWidgetState extends State<_BannerWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<Offset> _slide;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    final cfg = PremiumTheme.animations;
    _ctrl = AnimationController(vsync: this, duration: cfg.bannerSlide);
    _slide = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: cfg.bannerCurve));
    _fade = Tween<double>(begin: 0, end: 1).animate(_ctrl);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final topPad = MediaQuery.of(context).padding.top;

    return Positioned(
      top: topPad + 8,
      left: 12,
      right: 12,
      child: SlideTransition(
        position: _slide,
        child: FadeTransition(
          opacity: _fade,
          child: GestureDetector(
            onTap: widget.onTap,
            onVerticalDragEnd: (_) => widget.onDismiss(),
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: c.surfaceFill,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: widget.accentColor.withValues(alpha: 0.4),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: widget.accentColor.withValues(alpha: 0.2),
                      blurRadius: 20,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: widget.accentColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        widget.icon,
                        color: widget.accentColor,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            widget.title,
                            style: ts.body.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.body,
                            style: ts.bodySecondary.copyWith(fontSize: 12),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: widget.onDismiss,
                      child: Icon(
                        Icons.close_rounded,
                        color: c.textHint,
                        size: 18,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  INLINE ALERT BANNER — error / success / info message bar.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumAlertBanner extends StatelessWidget {
  final String message;
  final BannerType type;
  final VoidCallback? onDismiss;

  const PremiumAlertBanner({
    super.key,
    required this.message,
    this.type = BannerType.error,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;

    Color accentColor;
    IconData icon;
    switch (type) {
      case BannerType.success:
        accentColor = c.success;
        icon = Icons.check_circle_outline_rounded;
        break;
      case BannerType.error:
        accentColor = c.error;
        icon = Icons.error_outline_rounded;
        break;
      case BannerType.warning:
        accentColor = c.accentLight;
        icon = Icons.warning_amber_rounded;
        break;
      case BannerType.info:
        accentColor = c.info;
        icon = Icons.info_outline_rounded;
        break;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accentColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: accentColor, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: ts.body.copyWith(color: accentColor, fontSize: 13),
            ),
          ),
          if (onDismiss != null)
            GestureDetector(
              onTap: onDismiss,
              child: Icon(Icons.close_rounded, color: accentColor, size: 16),
            ),
        ],
      ),
    );
  }
}
