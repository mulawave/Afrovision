import 'package:flutter/services.dart';

/// Pushes fresh data to the AfroVision Android home-screen widget.
///
/// Call [update] whenever relevant data changes (on login, after fetching
/// channels, after notification count changes, etc.). The widget picks up
/// the new values and redraws itself automatically.
class WidgetService {
  static const _channel = MethodChannel('com.afrovision.afrovision/widget');

  static Future<void> update({
    int liveCount = 0,
    String nextShowChannel = '',
    String nextShowTitle = '',
    String nextShowTime = '',
    String planName = '',
    int daysToRenewal = 0,
    int notificationCount = 0,
    int wavesCount = 0,
    int libraryUpdates = 0,
  }) async {
    try {
      await _channel.invokeMethod('updateWidget', {
        'liveCount': liveCount,
        'nextShowChannel': nextShowChannel,
        'nextShowTitle': nextShowTitle,
        'nextShowTime': nextShowTime,
        'planName': planName.isEmpty ? 'Free Plan' : planName,
        'daysToRenewal': daysToRenewal,
        'notificationCount': notificationCount,
        'wavesCount': wavesCount,
        'libraryUpdates': libraryUpdates,
      });
    } catch (_) {
      // Widget may not be pinned — ignore errors silently.
    }
  }
}
