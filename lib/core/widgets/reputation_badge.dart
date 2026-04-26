import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Inline badge showing a viewer's reputation level.
///
/// Level 0 — renders nothing (SizedBox.shrink).
/// Level 1 — dull blue shield.
/// Level 2 — purple shield + padlock.
/// Level 3 — orange shield + padlock + verified check.
class ReputationBadgeWidget extends StatelessWidget {
  final int level;
  final double size;
  final bool showTooltip;

  const ReputationBadgeWidget({
    super.key,
    required this.level,
    this.size = 16,
    this.showTooltip = false,
  });

  @override
  Widget build(BuildContext context) {
    if (level <= 0) return const SizedBox.shrink();

    final badge = _buildBadge();
    if (showTooltip) {
      return Tooltip(message: 'Level $level Reputation', child: badge);
    }
    return badge;
  }

  Widget _buildBadge() {
    switch (level) {
      case 1:
        return Icon(
          Icons.shield_rounded,
          color: AppColors.reputationBlue,
          size: size,
        );
      case 2:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.shield_rounded,
              color: AppColors.reputationPurple,
              size: size,
            ),
            SizedBox(width: size * 0.15),
            Icon(
              Icons.lock_rounded,
              color: AppColors.reputationPurple,
              size: size * 0.85,
            ),
          ],
        );
      case 3:
      default:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield_rounded, color: AppColors.orange, size: size),
            SizedBox(width: size * 0.15),
            Icon(
              Icons.lock_rounded,
              color: AppColors.orange,
              size: size * 0.85,
            ),
            SizedBox(width: size * 0.15),
            Icon(
              Icons.verified_rounded,
              color: AppColors.orange,
              size: size * 0.85,
            ),
          ],
        );
    }
  }
}
