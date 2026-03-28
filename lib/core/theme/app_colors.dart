import 'package:flutter/material.dart';

class AppColors {
  static const Color darkBlue = Color(0xFF050A30);
  static const Color lightBlue = Color(0xFF173A6D);
  static const Color lightOrange = Color(0xFFF5C16C);
  static const Color orange = Color(0xFFF49617);
  static const Color white = Color(0xFFFFFFFF);
  static const Color inputFill = Color(0xFF0D1442);
  static const Color inputBorder = Color(0xFF1E2A5A);
  static const Color inputFocusBorder = Color(0xFFF49617);
  static const Color hintText = Color(0xFF5A6190);
  static const Color errorRed = Color(0xFFFF4D6A);
  static const Color cardBg = Color(0xFF0A1040);

  static const LinearGradient primaryGradient = LinearGradient(
    colors: [lightBlue, darkBlue],
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
