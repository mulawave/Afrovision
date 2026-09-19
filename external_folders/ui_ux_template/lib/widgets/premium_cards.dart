// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — CARDS
// ═══════════════════════════════════════════════════════════════════════════════
//  A collection of premium card variants extracted from the AfroVision design
//  system.  All cards auto-theme from [PremiumTheme.colors].

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  STANDARD CARD — rounded, subtle border, card depth shadow.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final VoidCallback? onTap;

  const PremiumCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.borderRadius = 14,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final d = PremiumTheme.decorations;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: PremiumTheme.animations.stateTransition,
        padding: padding,
        decoration: d.card.copyWith(
          borderRadius: BorderRadius.circular(borderRadius),
        ),
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HERO CARD — gradient glow, larger radius, used for featured content.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumHeroCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final VoidCallback? onTap;

  const PremiumHeroCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.borderRadius = 20,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final d = PremiumTheme.decorations;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding,
        decoration: d.heroCard.copyWith(
          borderRadius: BorderRadius.circular(borderRadius),
        ),
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAT CARD — icon + label + value row (wallet balances, counters, etc.)
// ─────────────────────────────────────────────────────────────────────────────

class PremiumStatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? accentColor;
  final VoidCallback? onTap;
  final Widget? trailing;

  const PremiumStatCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.accentColor,
    this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final color = accentColor ?? c.accent;

    return PremiumCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: ts.caption.copyWith(
                    color: color.withValues(alpha: 0.8),
                  ),
                ),
                const SizedBox(height: 4),
                Text(value, style: ts.largeAmount),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PURPLE / BLOCKCHAIN CARD — purple-tinted gradient card.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumPurpleCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  const PremiumPurpleCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final d = PremiumTheme.decorations;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding,
        decoration: d.purpleCard,
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACCENT CARD — orange-tinted gradient card for highlights.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumAccentCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  const PremiumAccentCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final d = PremiumTheme.decorations;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding,
        decoration: d.accentCard,
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOM TINTED CARD — supply any accent color.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumTintedCard extends StatelessWidget {
  final Widget child;
  final Color tintColor;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final VoidCallback? onTap;

  const PremiumTintedCard({
    super.key,
    required this.child,
    required this.tintColor,
    this.padding = const EdgeInsets.all(20),
    this.borderRadius = 16,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              tintColor.withValues(alpha: 0.18),
              tintColor.withValues(alpha: 0.05),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: tintColor.withValues(alpha: 0.25)),
        ),
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN / SUBSCRIPTION CARD — premium pricing card with optional "popular" tag.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumPlanCard extends StatelessWidget {
  final String planName;
  final String price;
  final String period;
  final List<String> features;
  final bool isPopular;
  final bool isSelected;
  final VoidCallback? onTap;

  const PremiumPlanCard({
    super.key,
    required this.planName,
    required this.price,
    required this.period,
    required this.features,
    this.isPopular = false,
    this.isSelected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final g = PremiumTheme.gradients;
    final s = PremiumTheme.shadows;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: PremiumTheme.animations.stateTransition,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: isSelected ? g.heroCard : null,
          color: isSelected ? null : c.cardBackground,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? c.accent.withValues(alpha: 0.5)
                : c.surfaceBorder.withValues(alpha: 0.3),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected ? [s.heroCardGlow] : [s.cardDepth],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(planName, style: ts.cardHeader),
                const Spacer(),
                if (isPopular)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      gradient: g.button,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'POPULAR',
                      style: ts.counter.copyWith(fontSize: 9),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(price, style: ts.largeAmount),
                const SizedBox(width: 4),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text('/ $period', style: ts.bodySecondary),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...features.map(
              (f) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.check_circle_rounded,
                      color: c.success,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(f, style: ts.body)),
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
