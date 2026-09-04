import 'package:flutter/material.dart';

/// Tokens from the Nocturne "AfroVision Home" design.
/// Colors and spacings mirror the reference HTML so the app chrome
/// reads as one system with the design canvas.
class Nocturne {
  const Nocturne._();

  // Ground + surface
  static const Color bg = Color(0xFF080E21);
  static const Color bgHeader = Color(0xFF14224C);
  static const Color surface = Color(0xFF0B1533);
  static const Color surfaceRaised = Color(0xFF101D43);
  static const Color surfaceDeep = Color(0xFF060B1C);
  static const Color surfaceRail = Color(0xFF0A1330);
  static const Color surfaceInset = Color(0xFF16255C);

  // Borders / rules
  static const Color border = Color(0xFF22325E);
  static const Color borderStrong = Color(0xFF2A3A6B);
  static const Color borderMuted = Color(0xFF1B2748);
  static const Color borderCard = Color(0xFF24345F);

  // Text
  static const Color text = Color(0xFFEEF1F8);
  static const Color textDim = Color(0xFFDBE2F2);
  static const Color textMuted = Color(0xFF9AA6C4);
  static const Color textFaint = Color(0xFF8FA0C8);
  static const Color textHint = Color(0xFF7D8BAD);

  // Accent — gold
  static const Color gold = Color(0xFFF0A52A);
  static const Color goldLight = Color(0xFFF5C266);
  static const Color goldSoft = Color(0xFFF7C66A);
  static const Color goldWash = Color(0x24F0A52A); // ~14% alpha

  // Semantic tints
  static const Color green = Color(0xFF5FD39A);
  static const Color greenWash = Color(0x292F9E6B); // ~16% alpha
  static const Color red = Color(0xFFE2543F);
  static const Color redSoft = Color(0xFFF18B78);
  static const Color blue = Color(0xFF7FC4FF);
  static const Color blueSoft = Color(0xFFA9D9FF);
  static const Color purple = Color(0xFF6D3FA8);

  // Card gradients
  static const LinearGradient headerGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF17295E), Color(0xFF0E1A3F)],
  );

  static const LinearGradient walletGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF152350), Color(0xFF101C40)],
  );

  static const LinearGradient goldCta = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFEF9615), Color(0xFFF8C96F)],
  );

  static const LinearGradient spotlightGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0x24F0A52A), Color(0x08F0A52A)],
  );

  // Radii
  static const double radiusSm = 8;
  static const double radiusMd = 11;
  static const double radiusLg = 14;
  static const double radiusXl = 16;

  // Common shadows
  static List<BoxShadow> get cardShadow => const [
    BoxShadow(color: Color(0x66000000), blurRadius: 30, offset: Offset(0, 12)),
  ];
}
