import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Flat card treatment shared across screens: a fill one shade lighter than
/// the page background, a thin tint-matched border, and a single soft lift
/// shadow — matching the reference design's restrained, mostly-flat cards
/// where color shows up in badges/icons/buttons rather than in the card
/// fill itself.
BoxDecoration premiumCard({Color? accent, double radius = 18}) {
  final tint = accent ?? AppColors.orange;
  return BoxDecoration(
    color: AppColors.inputFill,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: tint.withValues(alpha: 0.18)),
    boxShadow: const [
      BoxShadow(
        color: Color(0x66000000),
        blurRadius: 20,
        offset: Offset(0, 8),
      ),
    ],
  );
}
