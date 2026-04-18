// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — PROFILE & AVATAR COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  AVATAR — circular image or initials with accent glow.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumAvatar extends StatelessWidget {
  final String? imageUrl;
  final String? initials;
  final double size;
  final bool showGlow;
  final VoidCallback? onTap;

  const PremiumAvatar({
    super.key,
    this.imageUrl,
    this.initials,
    this.size = 80,
    this.showGlow = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final s = PremiumTheme.shadows;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [
              c.accent.withValues(alpha: 0.3),
              c.accentLight.withValues(alpha: 0.15),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: showGlow ? [s.logoGlow] : null,
        ),
        child: ClipOval(
          child: imageUrl != null && imageUrl!.isNotEmpty
              ? Image.network(
                  imageUrl!,
                  width: size,
                  height: size,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => _initialsWidget(c),
                )
              : _initialsWidget(c),
        ),
      ),
    );
  }

  Widget _initialsWidget(PremiumColors c) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: c.surfaceFill,
      child: Text(
        (initials ?? '?').toUpperCase(),
        style: TextStyle(
          color: c.accent,
          fontSize: size * 0.35,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROFILE HEADER — avatar + name + subtitle + optional badge.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumProfileHeader extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final String? subtitle;
  final Widget? badge;
  final VoidCallback? onAvatarTap;
  final List<Widget>? actions;

  const PremiumProfileHeader({
    super.key,
    this.imageUrl,
    required this.name,
    this.subtitle,
    this.badge,
    this.onAvatarTap,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    final ts = PremiumTheme.textStyles;

    return Column(
      children: [
        PremiumAvatar(
          imageUrl: imageUrl,
          initials: name.isNotEmpty ? name[0] : '?',
          size: 90,
          onTap: onAvatarTap,
        ),
        const SizedBox(height: 16),
        Text(name, style: ts.screenTitle),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(subtitle!, style: ts.bodySecondary),
        ],
        if (badge != null) ...[const SizedBox(height: 10), badge!],
        if (actions != null) ...[
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children:
                actions!.expand((w) => [w, const SizedBox(width: 12)]).toList()
                  ..removeLast(),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROFILE MENU ITEM — list tile with icon, label, and optional trailing.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumMenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final Color? iconColor;
  final bool showDivider;

  const PremiumMenuItem({
    super.key,
    required this.icon,
    required this.label,
    this.subtitle,
    this.onTap,
    this.trailing,
    this.iconColor,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final color = iconColor ?? c.accent;

    return Column(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: ts.body),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          style: ts.bodySecondary.copyWith(fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                ),
                trailing ??
                    Icon(
                      Icons.chevron_right_rounded,
                      color: c.textHint,
                      size: 20,
                    ),
              ],
            ),
          ),
        ),
        if (showDivider)
          Divider(color: c.surfaceBorder.withValues(alpha: 0.3), height: 1),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  STATUS / ROLE BADGE — small pill with icon + label.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumStatusBadge extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;

  const PremiumStatusBadge({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
