// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — COLOR ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
//
//  ★  THIS IS THE SINGLE FILE THAT CONTROLS THE ENTIRE TEMPLATE THEME.
//  ★  Change colors here → save → every widget updates instantly.
//  ★  Call PremiumTheme.resetToDefaults() to restore the original palette.
//
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

/// The single source of truth for every color, gradient, shadow, and decoration
/// used throughout the Premium UI/UX Template Kit.
///
/// **How to customise:**
/// 1. Edit the color values in [_Defaults] at the bottom of this file.
///    OR
/// 2. Call [PremiumTheme.configure] at app startup with your own palette.
///    OR
/// 3. Call [PremiumTheme.resetToDefaults] to revert any runtime changes.
///
/// Every widget in this kit reads from [PremiumTheme.colors], [PremiumTheme.gradients],
/// [PremiumTheme.shadows], and [PremiumTheme.decorations] — so one save here
/// propagates everywhere.
class PremiumTheme {
  PremiumTheme._();

  // ── Singleton instances ────────────────────────────────────────────────────

  static PremiumColors _colors = _Defaults.colors;
  static PremiumGradients _gradients = PremiumGradients._fromColors(_colors);
  static PremiumShadows _shadows = PremiumShadows._fromColors(_colors);
  static PremiumDecorations _decorations = PremiumDecorations._fromAll(
    _colors,
    _gradients,
    _shadows,
  );
  static PremiumTextStyles _textStyles = PremiumTextStyles._fromColors(_colors);
  static PremiumAnimationConfig _animations = const PremiumAnimationConfig();

  // ── Public getters ─────────────────────────────────────────────────────────

  static PremiumColors get colors => _colors;
  static PremiumGradients get gradients => _gradients;
  static PremiumShadows get shadows => _shadows;
  static PremiumDecorations get decorations => _decorations;
  static PremiumTextStyles get textStyles => _textStyles;
  static PremiumAnimationConfig get animations => _animations;

  // ── Configuration API ──────────────────────────────────────────────────────

  /// Replace the entire palette at runtime.  Rebuilds all derived objects.
  static void configure(PremiumColors custom) {
    _colors = custom;
    _rebuild();
  }

  /// Restore the factory-default palette (the values in [_Defaults]).
  static void resetToDefaults() {
    _colors = _Defaults.colors;
    _rebuild();
  }

  /// Override just the animation timings.
  static void configureAnimations(PremiumAnimationConfig config) {
    _animations = config;
  }

  static void _rebuild() {
    _gradients = PremiumGradients._fromColors(_colors);
    _shadows = PremiumShadows._fromColors(_colors);
    _decorations = PremiumDecorations._fromAll(_colors, _gradients, _shadows);
    _textStyles = PremiumTextStyles._fromColors(_colors);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  COLOR PALETTE
// ═════════════════════════════════════════════════════════════════════════════

class PremiumColors {
  // ── Core brand colors ────────────────────────────────────────────────────

  /// Primary dark background — deepest layer.
  final Color darkPrimary;

  /// Secondary dark — used for gradient top / lighter dark accent.
  final Color lightPrimary;

  /// Primary accent — call-to-action buttons, active states, links.
  final Color accent;

  /// Secondary accent / gold — labels, highlights, tag text.
  final Color accentLight;

  /// Pure white — headings, body text on dark backgrounds.
  final Color textPrimary;

  // ── Surface colors ───────────────────────────────────────────────────────

  /// Input field / card inner background.
  final Color surfaceFill;

  /// Subtle border for inputs and cards.
  final Color surfaceBorder;

  /// Active / focused border.
  final Color surfaceFocusBorder;

  /// Placeholder / secondary text.
  final Color textHint;

  /// Gold-tinted text for labels & captions.
  final Color textGold;

  /// Card background (slightly different from surfaceFill).
  final Color cardBackground;

  // ── Semantic colors ──────────────────────────────────────────────────────

  /// Error / destructive actions.
  final Color error;

  /// Success / positive confirmations.
  final Color success;

  /// Informational highlights.
  final Color info;

  /// Soft accent for secondary information.
  final Color softAccent;

  // ── Special palette colors ───────────────────────────────────────────────

  /// Button disabled gradient start.
  final Color disabledStart;

  /// Button disabled gradient end.
  final Color disabledEnd;

  /// Purple accent for blockchain / stake features.
  final Color purple;

  /// Purple dark for blockchain gradient end.
  final Color purpleDark;

  const PremiumColors({
    required this.darkPrimary,
    required this.lightPrimary,
    required this.accent,
    required this.accentLight,
    required this.textPrimary,
    required this.surfaceFill,
    required this.surfaceBorder,
    required this.surfaceFocusBorder,
    required this.textHint,
    required this.textGold,
    required this.cardBackground,
    required this.error,
    required this.success,
    required this.info,
    required this.softAccent,
    required this.disabledStart,
    required this.disabledEnd,
    required this.purple,
    required this.purpleDark,
  });

  /// Create a copy with overrides — handy for small tweaks.
  PremiumColors copyWith({
    Color? darkPrimary,
    Color? lightPrimary,
    Color? accent,
    Color? accentLight,
    Color? textPrimary,
    Color? surfaceFill,
    Color? surfaceBorder,
    Color? surfaceFocusBorder,
    Color? textHint,
    Color? textGold,
    Color? cardBackground,
    Color? error,
    Color? success,
    Color? info,
    Color? softAccent,
    Color? disabledStart,
    Color? disabledEnd,
    Color? purple,
    Color? purpleDark,
  }) {
    return PremiumColors(
      darkPrimary: darkPrimary ?? this.darkPrimary,
      lightPrimary: lightPrimary ?? this.lightPrimary,
      accent: accent ?? this.accent,
      accentLight: accentLight ?? this.accentLight,
      textPrimary: textPrimary ?? this.textPrimary,
      surfaceFill: surfaceFill ?? this.surfaceFill,
      surfaceBorder: surfaceBorder ?? this.surfaceBorder,
      surfaceFocusBorder: surfaceFocusBorder ?? this.surfaceFocusBorder,
      textHint: textHint ?? this.textHint,
      textGold: textGold ?? this.textGold,
      cardBackground: cardBackground ?? this.cardBackground,
      error: error ?? this.error,
      success: success ?? this.success,
      info: info ?? this.info,
      softAccent: softAccent ?? this.softAccent,
      disabledStart: disabledStart ?? this.disabledStart,
      disabledEnd: disabledEnd ?? this.disabledEnd,
      purple: purple ?? this.purple,
      purpleDark: purpleDark ?? this.purpleDark,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  GRADIENTS (auto-derived from colors)
// ═════════════════════════════════════════════════════════════════════════════

class PremiumGradients {
  /// Full-screen background: lightPrimary → darkPrimary, top→bottom.
  final LinearGradient screenBackground;

  /// Primary button: accent → accentLight, left→right.
  final LinearGradient button;

  /// Disabled button: disabledStart → disabledEnd, left→right.
  final LinearGradient buttonDisabled;

  /// Hero card glow: accent-tinted gradient.
  final LinearGradient heroCard;

  /// Accent-to-transparent banner overlay.
  final LinearGradient bannerOverlay;

  /// Purple/blockchain card gradient.
  final LinearGradient purpleCard;

  /// Accent card gradient (orange-tinted).
  final LinearGradient accentCard;

  /// Horizontal shimmer bar gradient.
  final LinearGradient shimmerBar;

  const PremiumGradients({
    required this.screenBackground,
    required this.button,
    required this.buttonDisabled,
    required this.heroCard,
    required this.bannerOverlay,
    required this.purpleCard,
    required this.accentCard,
    required this.shimmerBar,
  });

  factory PremiumGradients._fromColors(PremiumColors c) {
    return PremiumGradients(
      screenBackground: LinearGradient(
        colors: [c.lightPrimary, c.darkPrimary],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ),
      button: LinearGradient(
        colors: [c.accent, c.accentLight],
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
      ),
      buttonDisabled: LinearGradient(
        colors: [c.disabledStart, c.disabledEnd],
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
      ),
      heroCard: LinearGradient(
        colors: [
          c.accent.withValues(alpha: 0.15),
          c.accentLight.withValues(alpha: 0.05),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      bannerOverlay: LinearGradient(
        colors: [
          c.surfaceFill.withValues(alpha: 0.95),
          c.darkPrimary.withValues(alpha: 0.95),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      purpleCard: LinearGradient(
        colors: [
          c.purple.withValues(alpha: 0.18),
          c.purpleDark.withValues(alpha: 0.08),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      accentCard: LinearGradient(
        colors: [
          c.accent.withValues(alpha: 0.15),
          c.accentLight.withValues(alpha: 0.05),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      shimmerBar: LinearGradient(
        colors: [
          c.darkPrimary,
          c.lightPrimary.withValues(alpha: 0.3),
          c.darkPrimary,
        ],
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  SHADOWS (auto-derived from colors)
// ═════════════════════════════════════════════════════════════════════════════

class PremiumShadows {
  /// Standard button glow.
  final BoxShadow buttonGlow;

  /// Hero card glow (larger spread).
  final BoxShadow heroCardGlow;

  /// Focused input glow.
  final BoxShadow inputFocusGlow;

  /// Subtle card depth shadow.
  final BoxShadow cardDepth;

  /// Large logo/avatar glow.
  final BoxShadow logoGlow;

  const PremiumShadows({
    required this.buttonGlow,
    required this.heroCardGlow,
    required this.inputFocusGlow,
    required this.cardDepth,
    required this.logoGlow,
  });

  factory PremiumShadows._fromColors(PremiumColors c) {
    return PremiumShadows(
      buttonGlow: BoxShadow(
        color: c.accent.withValues(alpha: 0.35),
        blurRadius: 16,
        offset: const Offset(0, 6),
      ),
      heroCardGlow: BoxShadow(
        color: c.accent.withValues(alpha: 0.20),
        blurRadius: 24,
        spreadRadius: 2,
        offset: const Offset(0, 6),
      ),
      inputFocusGlow: BoxShadow(
        color: c.accent.withValues(alpha: 0.15),
        blurRadius: 12,
        spreadRadius: 0,
      ),
      cardDepth: BoxShadow(
        color: c.darkPrimary.withValues(alpha: 0.40),
        blurRadius: 12,
        offset: const Offset(0, 4),
      ),
      logoGlow: BoxShadow(
        color: c.accent.withValues(alpha: 0.25),
        blurRadius: 24,
        spreadRadius: 2,
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  PRE-BUILT DECORATIONS (auto-derived from colors + gradients + shadows)
// ═════════════════════════════════════════════════════════════════════════════

class PremiumDecorations {
  /// Standard card: rounded corners, subtle border, card depth shadow.
  final BoxDecoration card;

  /// Hero / feature card: gradient background, accent glow, large radius.
  final BoxDecoration heroCard;

  /// Input field (default state).
  final BoxDecoration inputDefault;

  /// Input field (focused state).
  final BoxDecoration inputFocused;

  /// Input field (error state).
  final BoxDecoration inputError;

  /// Active button decoration.
  final BoxDecoration buttonActive;

  /// Disabled button decoration.
  final BoxDecoration buttonDisabled;

  /// Banner / overlay container.
  final BoxDecoration banner;

  /// Icon container (small rounded square with alpha bg).
  final BoxDecoration iconContainer;

  /// Badge / status pill.
  final BoxDecoration statusBadge;

  /// Purple/blockchain card.
  final BoxDecoration purpleCard;

  /// Accent-tinted card.
  final BoxDecoration accentCard;

  /// Error banner.
  final BoxDecoration errorBanner;

  /// Success banner.
  final BoxDecoration successBanner;

  const PremiumDecorations({
    required this.card,
    required this.heroCard,
    required this.inputDefault,
    required this.inputFocused,
    required this.inputError,
    required this.buttonActive,
    required this.buttonDisabled,
    required this.banner,
    required this.iconContainer,
    required this.statusBadge,
    required this.purpleCard,
    required this.accentCard,
    required this.errorBanner,
    required this.successBanner,
  });

  factory PremiumDecorations._fromAll(
    PremiumColors c,
    PremiumGradients g,
    PremiumShadows s,
  ) {
    return PremiumDecorations(
      card: BoxDecoration(
        color: c.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.surfaceBorder.withValues(alpha: 0.3)),
        boxShadow: [s.cardDepth],
      ),
      heroCard: BoxDecoration(
        gradient: g.heroCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.accent.withValues(alpha: 0.2)),
        boxShadow: [s.heroCardGlow],
      ),
      inputDefault: BoxDecoration(
        color: c.surfaceFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.surfaceBorder, width: 1.0),
      ),
      inputFocused: BoxDecoration(
        color: c.surfaceFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.surfaceFocusBorder, width: 1.5),
        boxShadow: [s.inputFocusGlow],
      ),
      inputError: BoxDecoration(
        color: c.surfaceFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.error, width: 1.5),
      ),
      buttonActive: BoxDecoration(
        gradient: g.button,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [s.buttonGlow],
      ),
      buttonDisabled: BoxDecoration(
        gradient: g.buttonDisabled,
        borderRadius: BorderRadius.circular(14),
      ),
      banner: BoxDecoration(
        gradient: g.bannerOverlay,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.surfaceBorder.withValues(alpha: 0.4)),
      ),
      iconContainer: BoxDecoration(
        color: c.accent.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      statusBadge: BoxDecoration(
        color: c.accent.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.accent.withValues(alpha: 0.4)),
      ),
      purpleCard: BoxDecoration(
        gradient: g.purpleCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.purple.withValues(alpha: 0.25)),
      ),
      accentCard: BoxDecoration(
        gradient: g.accentCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.accent.withValues(alpha: 0.2)),
      ),
      errorBanner: BoxDecoration(
        color: c.error.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.error.withValues(alpha: 0.3)),
      ),
      successBanner: BoxDecoration(
        color: c.success.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.success.withValues(alpha: 0.3)),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEXT STYLES (auto-derived from colors)
// ═════════════════════════════════════════════════════════════════════════════

class PremiumTextStyles {
  /// Screen title: 20px, w700, white.
  final TextStyle screenTitle;

  /// Card header: 18px, w700, white.
  final TextStyle cardHeader;

  /// Large amount / stat: 28px, w800, accentLight.
  final TextStyle largeAmount;

  /// Body text: 15px, w500, white.
  final TextStyle body;

  /// Secondary body: 14px, w500, hint.
  final TextStyle bodySecondary;

  /// Small caption / label: 11px, w600, gold, wide spacing.
  final TextStyle caption;

  /// Button text (active): 16px, w700, darkPrimary.
  final TextStyle buttonLabel;

  /// Button text (disabled): 16px, w700, hint.
  final TextStyle buttonLabelDisabled;

  /// Input label: 13px, w600, accentLight.
  final TextStyle inputLabel;

  /// Input text: 15px, w500, white.
  final TextStyle inputText;

  /// Input hint: 14px, w400, hint.
  final TextStyle inputHint;

  /// Error text: 12px, w500, error.
  final TextStyle errorText;

  /// Link text: 14px, w600, accent.
  final TextStyle link;

  /// Badge text: 12px, w600, accent.
  final TextStyle badge;

  /// Counter / notification badge: 10px, w700, darkPrimary.
  final TextStyle counter;

  /// Tiny label: 9px, w700, hint.
  final TextStyle tiny;

  /// Logo text: 28px, w800, white, extra wide spacing.
  final TextStyle logo;

  /// Tagline: 14px, w500, accent.
  final TextStyle tagline;

  const PremiumTextStyles({
    required this.screenTitle,
    required this.cardHeader,
    required this.largeAmount,
    required this.body,
    required this.bodySecondary,
    required this.caption,
    required this.buttonLabel,
    required this.buttonLabelDisabled,
    required this.inputLabel,
    required this.inputText,
    required this.inputHint,
    required this.errorText,
    required this.link,
    required this.badge,
    required this.counter,
    required this.tiny,
    required this.logo,
    required this.tagline,
  });

  factory PremiumTextStyles._fromColors(PremiumColors c) {
    return PremiumTextStyles(
      screenTitle: TextStyle(
        color: c.textPrimary,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
      cardHeader: TextStyle(
        color: c.textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
      largeAmount: TextStyle(
        color: c.accentLight,
        fontSize: 28,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
      body: TextStyle(
        color: c.textPrimary,
        fontSize: 15,
        fontWeight: FontWeight.w500,
      ),
      bodySecondary: TextStyle(
        color: c.textHint,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      caption: TextStyle(
        color: c.textGold,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.2,
      ),
      buttonLabel: TextStyle(
        color: c.darkPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.0,
      ),
      buttonLabelDisabled: TextStyle(
        color: c.textHint,
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.0,
      ),
      inputLabel: TextStyle(
        color: c.accentLight,
        fontSize: 13,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.8,
      ),
      inputText: TextStyle(
        color: c.textPrimary,
        fontSize: 15,
        fontWeight: FontWeight.w500,
      ),
      inputHint: TextStyle(color: c.textHint, fontSize: 14),
      errorText: TextStyle(
        color: c.error,
        fontSize: 12,
        fontWeight: FontWeight.w500,
      ),
      link: TextStyle(
        color: c.accent,
        fontSize: 14,
        fontWeight: FontWeight.w600,
      ),
      badge: TextStyle(
        color: c.accent,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
      counter: TextStyle(
        color: c.darkPrimary,
        fontSize: 10,
        fontWeight: FontWeight.w700,
      ),
      tiny: TextStyle(
        color: c.textHint,
        fontSize: 9,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
      logo: TextStyle(
        color: c.textPrimary,
        fontSize: 28,
        fontWeight: FontWeight.w800,
        letterSpacing: 4,
      ),
      tagline: TextStyle(
        color: c.accent,
        fontSize: 14,
        fontWeight: FontWeight.w500,
        letterSpacing: 1.5,
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  ANIMATION CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

class PremiumAnimationConfig {
  /// Screen entry fade + slide duration.
  final Duration screenEntry;

  /// Button / container state transition.
  final Duration stateTransition;

  /// Notification banner slide-in.
  final Duration bannerSlide;

  /// Strength bar / progress fill.
  final Duration progressFill;

  /// Screen entry slide offset (vertical).
  final double screenSlideOffset;

  /// Screen entry curve.
  final Curve screenEntryCurve;

  /// Screen fade curve.
  final Curve screenFadeCurve;

  /// Banner slide curve.
  final Curve bannerCurve;

  const PremiumAnimationConfig({
    this.screenEntry = const Duration(milliseconds: 800),
    this.stateTransition = const Duration(milliseconds: 200),
    this.bannerSlide = const Duration(milliseconds: 400),
    this.progressFill = const Duration(milliseconds: 350),
    this.screenSlideOffset = 0.15,
    this.screenEntryCurve = Curves.easeOutCubic,
    this.screenFadeCurve = Curves.easeOut,
    this.bannerCurve = Curves.easeOutCubic,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  ★  DEFAULT PALETTE  ★
//  ─────────────────────
//  Edit ONLY this section to change the default theme.
//  Save the file and hot-reload — the entire app updates instantly.
// ═════════════════════════════════════════════════════════════════════════════

class _Defaults {
  _Defaults._();

  static const PremiumColors colors = PremiumColors(
    // ── Core brand ───────────────────────────
    darkPrimary: Color(0xFF050A30), // Deep dark blue
    lightPrimary: Color(0xFF173A6D), // Secondary blue
    accent: Color(0xFFF49617), // Orange CTA
    accentLight: Color(0xFFF5C16C), // Gold / light orange
    textPrimary: Color(0xFFFFFFFF), // White
    // ── Surfaces ─────────────────────────────
    surfaceFill: Color(0xFF0D1442), // Input / inner card bg
    surfaceBorder: Color(0xFF1E2A5A), // Subtle border
    surfaceFocusBorder: Color(0xFFF49617), // Focused border (= accent)
    textHint: Color(0xFF5A6190), // Placeholder text
    textGold: Color(0xFFF5C16C), // Label gold (= accentLight)
    cardBackground: Color(0xFF0A1040), // Card bg
    // ── Semantic ─────────────────────────────
    error: Color(0xFFFF4D6A),
    success: Color(0xFF4CAF50),
    info: Color(0xFF2196F3),
    softAccent: Color(0xFF64B5F6),

    // ── Special ──────────────────────────────
    disabledStart: Color(0xFF3A3A5C),
    disabledEnd: Color(0xFF2A2A4C),
    purple: Color(0xFF7C3AED),
    purpleDark: Color(0xFF4C1D95),
  );
}
