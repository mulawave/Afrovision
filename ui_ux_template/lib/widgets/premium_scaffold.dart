// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — SCREEN SCAFFOLD
// ═══════════════════════════════════════════════════════════════════════════════
//  Drop-in replacement for Scaffold that provides the signature gradient
//  background + built-in fade/slide entry animation.

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

/// A premium screen wrapper with:
/// - Full gradient background (lightPrimary → darkPrimary)
/// - Optional fade-in + slide-up entry animation
/// - Safe area handling
/// - Optional custom app bar row
class PremiumScaffold extends StatefulWidget {
  /// The screen body.
  final Widget body;

  /// Whether to animate the body on first appearance.
  final bool animate;

  /// Optional leading widget in the top bar (e.g. back button).
  final Widget? leading;

  /// Optional title in the top bar.
  final String? title;

  /// Optional trailing widgets in the top bar.
  final List<Widget>? actions;

  /// Extra top padding above the app bar row.
  final double topPadding;

  /// Override the background gradient.
  final Gradient? backgroundGradient;

  const PremiumScaffold({
    super.key,
    required this.body,
    this.animate = true,
    this.leading,
    this.title,
    this.actions,
    this.topPadding = 0,
    this.backgroundGradient,
  });

  @override
  State<PremiumScaffold> createState() => _PremiumScaffoldState();
}

class _PremiumScaffoldState extends State<PremiumScaffold>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animCtrl;
  late final Animation<double> _fadeIn;
  late final Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    final cfg = PremiumTheme.animations;
    _animCtrl = AnimationController(vsync: this, duration: cfg.screenEntry);
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: cfg.screenFadeCurve));
    _slideUp = Tween<Offset>(
      begin: Offset(0, cfg.screenSlideOffset),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: cfg.screenEntryCurve));
    if (widget.animate) _animCtrl.forward();
    if (!widget.animate) _animCtrl.value = 1.0;
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = PremiumTheme.colors;
    final g = PremiumTheme.gradients;
    final ts = PremiumTheme.textStyles;

    final hasAppBar =
        widget.leading != null ||
        widget.title != null ||
        (widget.actions?.isNotEmpty ?? false);

    Widget content = widget.body;

    if (hasAppBar) {
      content = Column(
        children: [
          SizedBox(height: widget.topPadding),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                if (widget.leading != null) widget.leading!,
                if (widget.title != null) ...[
                  const SizedBox(width: 14),
                  Expanded(child: Text(widget.title!, style: ts.screenTitle)),
                ] else
                  const Spacer(),
                if (widget.actions != null) ...widget.actions!,
              ],
            ),
          ),
          Expanded(child: widget.body),
        ],
      );
    }

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: widget.backgroundGradient ?? g.screenBackground,
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeIn,
            child: SlideTransition(position: _slideUp, child: content),
          ),
        ),
      ),
    );
  }
}

/// The signature back-button used in premium app bars.
class PremiumBackButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final IconData icon;

  const PremiumBackButton({
    super.key,
    this.onPressed,
    this.icon = Icons.arrow_back_ios_new_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    return GestureDetector(
      onTap: onPressed ?? () => Navigator.of(context).maybePop(),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: c.surfaceFill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.surfaceBorder),
        ),
        child: Icon(icon, color: c.textPrimary, size: 18),
      ),
    );
  }
}
