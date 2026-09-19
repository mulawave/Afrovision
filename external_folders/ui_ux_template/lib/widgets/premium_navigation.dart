// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — NAVIGATION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  BOTTOM NAV BAR — gradient background, accent-highlighted active tab.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<PremiumNavItem> items;

  const PremiumBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: c.darkPrimary,
        border: Border(top: BorderSide(color: c.surfaceBorder, width: 0.5)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: items.asMap().entries.map((entry) {
            final i = entry.key;
            final item = entry.value;
            final isActive = i == currentIndex;
            return _NavTab(
              icon: item.icon,
              activeIcon: item.activeIcon ?? item.icon,
              label: item.label,
              isActive: isActive,
              badge: item.badge,
              onTap: () => onTap(i),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class PremiumNavItem {
  final IconData icon;
  final IconData? activeIcon;
  final String label;
  final int badge;

  const PremiumNavItem({
    required this.icon,
    this.activeIcon,
    required this.label,
    this.badge = 0,
  });
}

class _NavTab extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final int badge;
  final VoidCallback onTap;

  const _NavTab({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.badge,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: PremiumTheme.animations.stateTransition,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? c.accent.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  isActive ? activeIcon : icon,
                  color: isActive ? c.accent : c.textHint,
                  size: 24,
                ),
                if (badge > 0)
                  Positioned(
                    right: -8,
                    top: -4,
                    child: PremiumBadgeCounter(count: badge),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: ts.tiny.copyWith(
                color: isActive ? c.accent : c.textHint,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  BADGE COUNTER — unread notification dot / count pill.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumBadgeCounter extends StatelessWidget {
  final int count;
  final Color? color;

  const PremiumBadgeCounter({super.key, required this.count, this.color});

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final bg = color ?? c.accent;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(count > 99 ? '99+' : '$count', style: ts.counter),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  APP BAR ACTION BUTTON — icon in a styled container.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumAppBarAction extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final int badge;
  final Color? iconColor;

  const PremiumAppBarAction({
    super.key,
    required this.icon,
    this.onTap,
    this.badge = 0,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: c.surfaceFill,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: c.surfaceBorder),
            ),
            child: Icon(icon, color: iconColor ?? c.textPrimary, size: 18),
          ),
          if (badge > 0)
            Positioned(
              right: -4,
              top: -4,
              child: PremiumBadgeCounter(count: badge),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOGGLE / SEGMENTED CONTROL — premium tab-like toggle.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumSegmentedControl extends StatelessWidget {
  final List<String> segments;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  const PremiumSegmentedControl({
    super.key,
    required this.segments,
    required this.selectedIndex,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final g = PremiumTheme.gradients;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: c.surfaceFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.surfaceBorder),
      ),
      child: Row(
        children: segments.asMap().entries.map((entry) {
          final i = entry.key;
          final label = entry.value;
          final isActive = i == selectedIndex;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(i),
              child: AnimatedContainer(
                duration: PremiumTheme.animations.stateTransition,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  gradient: isActive ? g.button : null,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isActive ? c.darkPrimary : c.textHint,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB BAR — premium styled TabBar with gradient indicator.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumTabBar extends StatelessWidget implements PreferredSizeWidget {
  final TabController controller;
  final List<Tab> tabs;

  const PremiumTabBar({
    super.key,
    required this.controller,
    required this.tabs,
  });

  @override
  Size get preferredSize => const Size.fromHeight(48);

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final g = PremiumTheme.gradients;

    return TabBar(
      controller: controller,
      indicator: BoxDecoration(
        gradient: g.button,
        borderRadius: BorderRadius.circular(10),
      ),
      indicatorSize: TabBarIndicatorSize.tab,
      labelColor: c.textPrimary,
      unselectedLabelColor: c.textHint,
      labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      unselectedLabelStyle: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
      ),
      dividerColor: Colors.transparent,
      tabs: tabs,
    );
  }
}
