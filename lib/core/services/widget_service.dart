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
    String avatarInitial = '',
    String avatarUrl = '',
    String recentChannel1 = '',
    String recentChannel2 = '',
    String recentChannel3 = '',
    String recentChannelId1 = '',
    String recentChannelId2 = '',
    String recentChannelId3 = '',
    String recentChannelLogo1 = '',
    String recentChannelLogo2 = '',
    String recentChannelLogo3 = '',
    String recentChannelCover1 = '',
    String recentChannelCover2 = '',
    String recentChannelCover3 = '',
    String notification1 = '',
    String notification2 = '',
    String notification3 = '',
    String assetCash = '₦0.00',
    String assetVpt = '0.00',
    String assetRavens = '0',
  }) async {
    try {
      print('[WidgetService] Updating widget: liveCount=$liveCount, planName=$planName, avatarInitial=$avatarInitial');
      final result = await _channel.invokeMethod('updateWidget', {
        'liveCount': liveCount,
        'nextShowChannel': nextShowChannel,
        'nextShowTitle': nextShowTitle,
        'nextShowTime': nextShowTime,
        'planName': planName.isEmpty ? 'Free Plan' : planName,
        'daysToRenewal': daysToRenewal,
        'notificationCount': notificationCount,
        'wavesCount': wavesCount,
        'libraryUpdates': libraryUpdates,
        'avatarInitial': avatarInitial,
        'avatarUrl': avatarUrl,
        'recentChannel1': recentChannel1,
        'recentChannel2': recentChannel2,
        'recentChannel3': recentChannel3,
        'recentChannelId1': recentChannelId1,
        'recentChannelId2': recentChannelId2,
        'recentChannelId3': recentChannelId3,
        'recentChannelLogo1': recentChannelLogo1,
        'recentChannelLogo2': recentChannelLogo2,
        'recentChannelLogo3': recentChannelLogo3,
        'recentChannelCover1': recentChannelCover1,
        'recentChannelCover2': recentChannelCover2,
        'recentChannelCover3': recentChannelCover3,
        'notification1': notification1,
        'notification2': notification2,
        'notification3': notification3,
        'assetCash': assetCash,
        'assetVpt': assetVpt,
        'assetRavens': assetRavens,
      });
      print('[WidgetService] Widget update successful: $result');
    } on PlatformException catch (e) {
      // Widget may not be pinned — ignore errors silently.
      print('[WidgetService] Widget update failed (PlatformException): ${e.code} - ${e.message}');
    } catch (e) {
      // Widget may not be pinned — ignore errors silently.
      print('[WidgetService] Widget update failed: $e');
    }
  }
}
