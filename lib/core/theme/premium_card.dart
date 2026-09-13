import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Rich card treatment shared across screens that want a premium feel: a
/// subtle depth gradient (rather than one flat fill), a tint-matched
/// border, and a two-layer shadow — a soft black lift plus a faint colored
/// glow behind it — so cards read as sitting above the background instead
/// of being painted flat onto it.
BoxDecoration premiumCard({Color? accent, double radius = 18}) {
  final tint = accent ?? AppColors.orange;
  return BoxDecoration(
    gradient: LinearGradient(
      colors: [
        AppColors.cardBg.withValues(alpha: 0.98),
        AppColors.inputFill,
      ],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: tint.withValues(alpha: 0.22)),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.35),
        blurRadius: 22,
        offset: const Offset(0, 10),
      ),
      BoxShadow(
        color: tint.withValues(alpha: 0.14),
        blurRadius: 28,
        spreadRadius: -10,
      ),
    ],
  );
}
