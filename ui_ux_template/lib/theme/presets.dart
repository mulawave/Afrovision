// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — PRESET THEMES
// ═══════════════════════════════════════════════════════════════════════════════
//
//  Ready-made color palettes you can apply with one line:
//
//    PremiumTheme.configure(PremiumPresets.midnight);
//    PremiumTheme.configure(PremiumPresets.crimson);
//    PremiumTheme.configure(PremiumPresets.emerald);
//    PremiumTheme.configure(PremiumPresets.royal);
//    PremiumTheme.configure(PremiumPresets.sunset);
//    PremiumTheme.configure(PremiumPresets.arctic);
//
//  Or call PremiumTheme.resetToDefaults() to go back to the original
//  AfroVision dark-blue + gold palette.
//
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'color_engine.dart';

class PremiumPresets {
  PremiumPresets._();

  // ── Midnight — deep indigo + electric blue ──────────────────────────────

  static const PremiumColors midnight = PremiumColors(
    darkPrimary: Color(0xFF0A0E27),
    lightPrimary: Color(0xFF1A237E),
    accent: Color(0xFF448AFF),
    accentLight: Color(0xFF82B1FF),
    textPrimary: Color(0xFFFFFFFF),
    surfaceFill: Color(0xFF0D1442),
    surfaceBorder: Color(0xFF1C2660),
    surfaceFocusBorder: Color(0xFF448AFF),
    textHint: Color(0xFF5C6BC0),
    textGold: Color(0xFF82B1FF),
    cardBackground: Color(0xFF0C1240),
    error: Color(0xFFFF5252),
    success: Color(0xFF69F0AE),
    info: Color(0xFF40C4FF),
    softAccent: Color(0xFF82B1FF),
    disabledStart: Color(0xFF2C3050),
    disabledEnd: Color(0xFF1E2240),
    purple: Color(0xFF7C4DFF),
    purpleDark: Color(0xFF311B92),
  );

  // ── Crimson — dark charcoal + vibrant red/rose ─────────────────────────

  static const PremiumColors crimson = PremiumColors(
    darkPrimary: Color(0xFF1A0A0A),
    lightPrimary: Color(0xFF4A1520),
    accent: Color(0xFFFF1744),
    accentLight: Color(0xFFFF8A80),
    textPrimary: Color(0xFFFFFFFF),
    surfaceFill: Color(0xFF2A0F14),
    surfaceBorder: Color(0xFF5A2030),
    surfaceFocusBorder: Color(0xFFFF1744),
    textHint: Color(0xFF8C5060),
    textGold: Color(0xFFFF8A80),
    cardBackground: Color(0xFF200D12),
    error: Color(0xFFFF6E6E),
    success: Color(0xFF4CAF50),
    info: Color(0xFF29B6F6),
    softAccent: Color(0xFFEF9A9A),
    disabledStart: Color(0xFF3A2530),
    disabledEnd: Color(0xFF2A1820),
    purple: Color(0xFFE040FB),
    purpleDark: Color(0xFF7B1FA2),
  );

  // ── Emerald — deep forest + green/gold ─────────────────────────────────

  static const PremiumColors emerald = PremiumColors(
    darkPrimary: Color(0xFF051A0A),
    lightPrimary: Color(0xFF1B5E20),
    accent: Color(0xFF00E676),
    accentLight: Color(0xFFB9F6CA),
    textPrimary: Color(0xFFFFFFFF),
    surfaceFill: Color(0xFF0A2410),
    surfaceBorder: Color(0xFF1E4A28),
    surfaceFocusBorder: Color(0xFF00E676),
    textHint: Color(0xFF4A7A5A),
    textGold: Color(0xFFB9F6CA),
    cardBackground: Color(0xFF081E0D),
    error: Color(0xFFFF5252),
    success: Color(0xFF69F0AE),
    info: Color(0xFF40C4FF),
    softAccent: Color(0xFFA5D6A7),
    disabledStart: Color(0xFF2A3A2C),
    disabledEnd: Color(0xFF1A2A1C),
    purple: Color(0xFFCE93D8),
    purpleDark: Color(0xFF6A1B9A),
  );

  // ── Royal — deep purple + gold ─────────────────────────────────────────

  static const PremiumColors royal = PremiumColors(
    darkPrimary: Color(0xFF0D0520),
    lightPrimary: Color(0xFF311B92),
    accent: Color(0xFFFFD700),
    accentLight: Color(0xFFFFE57F),
    textPrimary: Color(0xFFFFFFFF),
    surfaceFill: Color(0xFF140A30),
    surfaceBorder: Color(0xFF3A2070),
    surfaceFocusBorder: Color(0xFFFFD700),
    textHint: Color(0xFF7E57C2),
    textGold: Color(0xFFFFE57F),
    cardBackground: Color(0xFF100828),
    error: Color(0xFFFF5252),
    success: Color(0xFF69F0AE),
    info: Color(0xFFB388FF),
    softAccent: Color(0xFFD1C4E9),
    disabledStart: Color(0xFF2A1A50),
    disabledEnd: Color(0xFF1A1040),
    purple: Color(0xFFB388FF),
    purpleDark: Color(0xFF4A148C),
  );

  // ── Sunset — warm dark + orange/pink tones ─────────────────────────────

  static const PremiumColors sunset = PremiumColors(
    darkPrimary: Color(0xFF1A0A05),
    lightPrimary: Color(0xFF6D3A17),
    accent: Color(0xFFFF6D00),
    accentLight: Color(0xFFFFAB40),
    textPrimary: Color(0xFFFFFFFF),
    surfaceFill: Color(0xFF2A1408),
    surfaceBorder: Color(0xFF5A3018),
    surfaceFocusBorder: Color(0xFFFF6D00),
    textHint: Color(0xFF8A6050),
    textGold: Color(0xFFFFAB40),
    cardBackground: Color(0xFF201006),
    error: Color(0xFFFF5252),
    success: Color(0xFF4CAF50),
    info: Color(0xFF29B6F6),
    softAccent: Color(0xFFFFCC80),
    disabledStart: Color(0xFF3A2A20),
    disabledEnd: Color(0xFF2A1A10),
    purple: Color(0xFFFF80AB),
    purpleDark: Color(0xFFC2185B),
  );

  // ── Arctic — icy whites & blues on near-black ─────────────────────────

  static const PremiumColors arctic = PremiumColors(
    darkPrimary: Color(0xFF0A0F1A),
    lightPrimary: Color(0xFF1A2740),
    accent: Color(0xFF80DEEA),
    accentLight: Color(0xFFB2EBF2),
    textPrimary: Color(0xFFECEFF1),
    surfaceFill: Color(0xFF101828),
    surfaceBorder: Color(0xFF263040),
    surfaceFocusBorder: Color(0xFF80DEEA),
    textHint: Color(0xFF546E7A),
    textGold: Color(0xFFB2EBF2),
    cardBackground: Color(0xFF0D1420),
    error: Color(0xFFEF5350),
    success: Color(0xFF66BB6A),
    info: Color(0xFF42A5F5),
    softAccent: Color(0xFF80CBC4),
    disabledStart: Color(0xFF263238),
    disabledEnd: Color(0xFF1C2530),
    purple: Color(0xFFCE93D8),
    purpleDark: Color(0xFF4A148C),
  );
}
