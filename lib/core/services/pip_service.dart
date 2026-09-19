import 'package:flutter/services.dart';

/// Manages Android Picture-in-Picture mode.
///
/// When the user navigates away from the player screen while content is
/// playing, the app calls [enter] to shrink into a floating overlay window
/// that continues playing above every other app and screen.
///
/// The native side sends [onPiPModeChanged] callbacks back to Flutter so the
/// player screen can switch to the minimal PiP layout and restore full UI
/// when the user taps the window to expand.
class PipService {
  static const _channel = MethodChannel('com.afrovision.afrovision/pip');

  static Function(bool isInPiP)? _onModeChanged;

  /// Register a callback that fires whenever PiP mode starts or ends.
  static void setModeChangedCallback(Function(bool isInPiP) callback) {
    _onModeChanged = callback;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onPiPModeChanged') {
        final isInPiP = call.arguments['isInPiP'] as bool? ?? false;
        _onModeChanged?.call(isInPiP);
      }
    });
  }

  /// Returns true if the device supports PiP (Android 8.0+).
  static Future<bool> get isSupported async {
    try {
      return await _channel.invokeMethod<bool>('isPiPSupported') ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Enters PiP mode. The activity shrinks into a floating window; the
  /// Flutter widget tree stays alive and the video keeps playing.
  ///
  /// Returns whether the OS actually entered PiP. Callers should attempt
  /// this directly on an explicit user tap rather than pre-gating on
  /// [isSupported] — that check reflects an AppOps special-access flag that
  /// defaults to revoked on several OEM Android skins even when the device
  /// and app both fully support PiP, which made a manual PiP button
  /// permanently report "not supported" without ever really trying.
  static Future<bool> enter({
    int aspectWidth = 16,
    int aspectHeight = 9,
  }) async {
    try {
      return await _channel.invokeMethod<bool>('enterPiP', {
            'aspectWidth': aspectWidth,
            'aspectHeight': aspectHeight,
          }) ??
          false;
    } catch (_) {
      return false;
    }
  }

  /// Enables or disables automatic PiP entry when the user navigates away
  /// from the app (home button, recents, etc.).  When [enabled] is true the
  /// activity enters PiP automatically; the user never loses the video.
  static Future<void> setAutoEnterEnabled(bool enabled) async {
    try {
      await _channel.invokeMethod('setPipAutoEnter', {'enabled': enabled});
    } catch (_) {}
  }
}
