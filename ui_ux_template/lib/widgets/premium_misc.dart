// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — MISCELLANEOUS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  DIVIDER WITH LABEL — "── OR ──" pattern.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumDivider extends StatelessWidget {
  final String? label;

  const PremiumDivider({super.key, this.label});

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;

    if (label == null) {
      return Container(height: 1, color: c.surfaceBorder);
    }

    return Row(
      children: [
        Expanded(child: Container(height: 1, color: c.surfaceBorder)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            label!,
            style: TextStyle(
              color: c.textGold,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
        ),
        Expanded(child: Container(height: 1, color: c.surfaceBorder)),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PASSWORD STRENGTH INDICATOR — animated strength bars + criteria.
// ─────────────────────────────────────────────────────────────────────────────

enum _PwStrength { none, weak, medium, strong, superb }

class PremiumPasswordStrength extends StatelessWidget {
  final String password;

  const PremiumPasswordStrength({super.key, required this.password});

  static const _barColors = [
    Color(0xFFFF4D4D),
    Color(0xFFF49617),
    Color(0xFFFFD700),
    Color(0xFF00E676),
  ];

  static const _labels = {
    _PwStrength.none: '',
    _PwStrength.weak: 'Weak',
    _PwStrength.medium: 'Medium',
    _PwStrength.strong: 'Strong',
    _PwStrength.superb: 'Superb',
  };

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    int met = 0;
    if (password.contains(RegExp(r'[A-Z]'))) met++;
    if (password.contains(RegExp(r'[a-zA-Z]')) &&
        password.contains(RegExp(r'[0-9]')))
      met++;
    if (password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]')))
      met++;
    if (password.length > 6) met++;

    final strength = _PwStrength.values[met];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: List.generate(4, (i) {
            final active = i < met;
            return Expanded(
              child: AnimatedContainer(
                duration: PremiumTheme.animations.progressFill,
                curve: Curves.easeOutCubic,
                height: 4,
                margin: EdgeInsets.only(right: i < 3 ? 6 : 0),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: active
                      ? _barColors[i]
                      : c.surfaceBorder.withValues(alpha: 0.4),
                  boxShadow: active
                      ? [
                          BoxShadow(
                            color: _barColors[i].withValues(alpha: 0.4),
                            blurRadius: 6,
                          ),
                        ]
                      : null,
                ),
              ),
            );
          }),
        ),
        if (strength != _PwStrength.none) ...[
          const SizedBox(height: 8),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: Text(
              _labels[strength]!,
              key: ValueKey(strength),
              style: TextStyle(
                color: _barColors[met - 1],
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHECKBOX — themed checkbox with accent colors.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumCheckbox extends StatelessWidget {
  final bool value;
  final ValueChanged<bool?>? onChanged;
  final Widget? label;

  const PremiumCheckbox({
    super.key,
    required this.value,
    this.onChanged,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Checkbox(
          value: value,
          onChanged: onChanged,
          activeColor: c.accent,
          checkColor: c.darkPrimary,
          side: BorderSide(color: value ? c.accent : c.textHint, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        ),
        if (label != null) Flexible(child: label!),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DROPDOWN — themed dropdown selector.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumDropdown<T> extends StatelessWidget {
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final String? hint;

  const PremiumDropdown({
    super.key,
    this.value,
    required this.items,
    this.onChanged,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: c.surfaceFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.surfaceBorder),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          items: items,
          onChanged: onChanged,
          dropdownColor: c.lightPrimary,
          icon: Icon(Icons.keyboard_arrow_down_rounded, color: c.accent),
          hint: hint != null ? Text(hint!, style: ts.inputHint) : null,
          style: ts.body,
          isExpanded: true,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOADING INDICATOR — accent-colored circular spinner.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumLoader extends StatelessWidget {
  final double size;
  final double strokeWidth;

  const PremiumLoader({super.key, this.size = 36, this.strokeWidth = 2.5});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: strokeWidth,
        valueColor: AlwaysStoppedAnimation<Color>(PremiumTheme.colors.accent),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REFRESH INDICATOR — themed pull-to-refresh wrapper.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumRefreshIndicator extends StatelessWidget {
  final Future<void> Function() onRefresh;
  final Widget child;

  const PremiumRefreshIndicator({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    return RefreshIndicator(
      color: c.accent,
      backgroundColor: c.surfaceFill,
      onRefresh: onRefresh,
      child: child,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  LIVE BADGE — small "● LIVE" status indicator.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumLiveBadge extends StatelessWidget {
  final Color? color;

  const PremiumLiveBadge({super.key, this.color});

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final dotColor = color ?? c.success;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          'LIVE',
          style: TextStyle(
            color: dotColor,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EMPTY STATE — centered icon + title + subtitle for empty lists.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  const PremiumEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: c.surfaceFill,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: c.textHint, size: 48),
            ),
            const SizedBox(height: 20),
            Text(title, style: ts.cardHeader, textAlign: TextAlign.center),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                style: ts.bodySecondary,
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[const SizedBox(height: 24), action!],
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOGO — branded logo circle with glow + title text.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumLogo extends StatelessWidget {
  final double size;
  final String title;
  final String? tagline;
  final Widget? imageWidget;

  const PremiumLogo({
    super.key,
    this.size = 80,
    this.title = 'PREMIUM',
    this.tagline,
    this.imageWidget,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final s = PremiumTheme.shadows;
    final ts = PremiumTheme.textStyles;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [s.logoGlow],
          ),
          child:
              imageWidget ??
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [c.accent, c.accentLight],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.star_rounded,
                  color: c.darkPrimary,
                  size: size * 0.5,
                ),
              ),
        ),
        const SizedBox(height: 16),
        Text(title, style: ts.logo),
        if (tagline != null) ...[
          const SizedBox(height: 6),
          Text(tagline!, style: ts.tagline),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DIALOG / BOTTOM SHEET — themed modal.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumBottomSheet extends StatelessWidget {
  final String? title;
  final Widget child;
  final List<Widget>? actions;

  const PremiumBottomSheet({
    super.key,
    this.title,
    required this.child,
    this.actions,
  });

  /// Convenience method to show this as a modal bottom sheet.
  static Future<T?> show<T>(
    BuildContext context, {
    required Widget child,
    String? title,
    List<Widget>? actions,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) =>
          PremiumBottomSheet(title: title, actions: actions, child: child),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;

    return Container(
      decoration: BoxDecoration(
        color: c.darkPrimary,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: c.surfaceBorder),
          left: BorderSide(color: c.surfaceBorder),
          right: BorderSide(color: c.surfaceBorder),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: c.surfaceBorder,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          if (title != null) ...[
            const SizedBox(height: 20),
            Text(title!, style: ts.cardHeader),
          ],
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: child,
          ),
          if (actions != null) ...[
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(children: actions!),
            ),
          ],
          SizedBox(height: MediaQuery.of(context).padding.bottom + 20),
        ],
      ),
    );
  }
}
