import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// A premium full-width in-app notification banner that slides down from the
/// top of the screen — similar to iOS / modern Android heads-up banners.
///
/// Call [NotificationBanner.show] from anywhere that has a [BuildContext].
class NotificationBanner {
  NotificationBanner._();

  static OverlayEntry? _currentEntry;
  static Timer? _autoDismiss;

  /// Show a branded banner at the top of the screen.
  ///
  /// [type] controls the accent color:
  ///   • `withdrawal_approved` / `success` → green
  ///   • `withdrawal_rejected` / `error`   → red
  ///   • anything else                     → orange (default)
  static void show(
    BuildContext context, {
    required String title,
    required String body,
    String? type,
    VoidCallback? onTap,
    Duration duration = const Duration(seconds: 5),
  }) {
    dismiss(); // Remove any existing banner first

    final overlay = Overlay.of(context);
    final Color accentColor;
    final IconData icon;

    switch (type) {
      case 'withdrawal_approved':
      case 'success':
        accentColor = AppColors.successGreen;
        icon = Icons.check_circle_rounded;
        break;
      case 'withdrawal_rejected':
      case 'error':
        accentColor = AppColors.errorRed;
        icon = Icons.cancel_rounded;
        break;
      default:
        accentColor = AppColors.orange;
        icon = Icons.notifications_active_rounded;
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

  /// Programmatically dismiss the current banner.
  static void dismiss() {
    _autoDismiss?.cancel();
    _autoDismiss = null;
    _currentEntry?.remove();
    _currentEntry = null;
  }
}

// ── The actual animated banner widget ──────────────────────────────────────────

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
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _slide = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _fade = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _animateOut() async {
    await _ctrl.reverse();
    widget.onDismiss();
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SlideTransition(
        position: _slide,
        child: FadeTransition(
          opacity: _fade,
          child: GestureDetector(
            onTap: widget.onTap,
            onVerticalDragEnd: (details) {
              // Swipe up to dismiss
              if (details.primaryVelocity != null &&
                  details.primaryVelocity! < -200) {
                _animateOut();
              }
            },
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.only(
                top: topPadding + 12,
                bottom: 16,
                left: 16,
                right: 16,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.cardBg,
                    AppColors.darkBlue.withValues(alpha: 0.97),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
                border: Border(
                  bottom: BorderSide(
                    color: widget.accentColor.withValues(alpha: 0.4),
                    width: 2,
                  ),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Icon circle
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: widget.accentColor.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: widget.accentColor.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Icon(
                      widget.icon,
                      color: widget.accentColor,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Text content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                widget.title,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.2,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'now',
                              style: TextStyle(
                                color: AppColors.hintText.withValues(
                                  alpha: 0.7,
                                ),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.body,
                          style: TextStyle(
                            color: AppColors.white.withValues(alpha: 0.8),
                            fontSize: 13,
                            height: 1.4,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  // Close button
                  GestureDetector(
                    onTap: () => _animateOut(),
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8, top: 2),
                      child: Icon(
                        Icons.close_rounded,
                        color: AppColors.hintText.withValues(alpha: 0.5),
                        size: 18,
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
}
