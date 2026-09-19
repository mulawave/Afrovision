import 'package:flutter/material.dart';

import 'nocturne_theme.dart';

/// Repointed at the Nocturne design tokens (§3.5 of the production
/// readiness audit) — constant *names* are kept as-is so every existing
/// screen compiles unchanged, but the values now match `claude_designs/`
/// instead of the pre-Nocturne palette. `primaryGradient` is flattened to
/// two stops of the same flat background color: the design has no page
/// background gradient at all, only flat `#080E21`.
class AppColors {
  static const Color darkBlue = Nocturne.bg; // was 0xFF050A30
  // NOT repointed to Nocturne — kept at its original value. This is used
  // standalone (not just as a gradient stop) across ~11 screens as a
  // distinct medium-blue tint for info callouts/banners. An earlier pass
  // wrongly flattened this to equal darkBlue for the primaryGradient fix
  // below, which made every one of those info tints render as a
  // near-invisible smear indistinguishable from the page background.
  // primaryGradient no longer references this constant at all, so the two
  // concerns are decoupled.
  static const Color lightBlue = Color(0xFF173A6D);
  static const Color lightOrange = Nocturne.goldLight; // was 0xFFF5C16C
  static const Color orange = Nocturne.gold; // was 0xFFF49617
  static const Color white = Nocturne.text; // was 0xFFFFFFFF
  static const Color inputFill = Nocturne.surfaceRaised; // was 0xFF0D1442
  static const Color inputBorder = Nocturne.borderCard; // was 0xFF1E2A5A
  static const Color inputFocusBorder = Nocturne.gold; // was 0xFFF49617
  static const Color hintText = Nocturne.textHint; // was 0xFF5A6190
  static const Color goldText = lightOrange;
  static const Color errorRed = Nocturne.red; // was 0xFFFF4D6A
  static const Color successGreen = Nocturne.green; // was Material green 0xFF4CAF50
  static const Color infoBlue = Nocturne.blue; // was 0xFF2196F3
  static const Color softBlue = Nocturne.blueSoft; // was 0xFF64B5F6
  static const Color cardBg = Nocturne.surface; // was 0xFF0A1040

  // Reputation level colors — not part of the Nocturne token set; left as-is.
  static const Color reputationBlue = Color(
    0xFF7B9EC8,
  ); // Level 1 — dull blue shield
  static const Color reputationPurple = Color(
    0xFF7B2FBE,
  ); // Level 2 — royal purple

  // Was a two-tone lightBlue→darkBlue gradient; the design specifies a flat
  // solid background with no gradient, so both stops are now the same color.
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Nocturne.bg, Nocturne.bg],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient buttonGradient = LinearGradient(
    colors: [orange, lightOrange],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient buttonDisabledGradient = LinearGradient(
    colors: [Color(0xFF3A3A5C), Color(0xFF2A2A4C)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );
}
