// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

/// A premium gradient button with loading state, glow shadow, and smooth
/// state transitions.
class PremiumButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;
  final double? width;
  final double height;
  final IconData? icon;
  final double borderRadius;

  const PremiumButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.enabled = true,
    this.width,
    this.height = 54,
    this.icon,
    this.borderRadius = 14,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = enabled && !loading && onPressed != null;
    final c = PremiumTheme.colors;
    final d = PremiumTheme.decorations;
    final ts = PremiumTheme.textStyles;

    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: AnimatedContainer(
        duration: PremiumTheme.animations.stateTransition,
        decoration: isActive
            ? d.buttonActive.copyWith(
                borderRadius: BorderRadius.circular(borderRadius),
              )
            : d.buttonDisabled.copyWith(
                borderRadius: BorderRadius.circular(borderRadius),
              ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: isActive ? onPressed : null,
            borderRadius: BorderRadius.circular(borderRadius),
            splashColor: c.textPrimary.withValues(alpha: 0.1),
            child: Center(
              child: loading
                  ? SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          c.darkPrimary,
                        ),
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (icon != null) ...[
                          Icon(
                            icon,
                            color: isActive ? c.darkPrimary : c.textHint,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                        ],
                        Text(
                          label,
                          style: isActive
                              ? ts.buttonLabel
                              : ts.buttonLabelDisabled,
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

/// A premium outlined button with accent border.
class PremiumOutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double borderRadius;
  final double height;

  const PremiumOutlineButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.borderRadius = 14,
    this.height = 50,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    return SizedBox(
      height: height,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: c.accentLight, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, color: c.accentLight, size: 18),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: TextStyle(
                color: c.accentLight,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A text-link style button.
class PremiumTextButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;

  const PremiumTextButton({super.key, required this.label, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Text(label, style: PremiumTheme.textStyles.link),
    );
  }
}
