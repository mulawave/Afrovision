import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_app_badger/flutter_app_badger.dart';
import '../api/api_service.dart';
import '../storage/auth_storage.dart';
import '../theme/app_colors.dart';

// ── Background message handler ────────────────────────────────────────────────
// Must be a top-level function (not a class member).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase is already initialized by the time this is called on Android 12+.
  // Update the app icon badge when a background message arrives.
  try {
    final dataCount = message.data['unread_count'];
    if (dataCount != null) {
      final count = int.tryParse(dataCount.toString()) ?? 0;
      if (count > 0) {
        FlutterAppBadger.updateBadgeCount(count);
      }
    }
  } catch (_) {}
}

// ── Notification channel (Android) ───────────────────────────────────────────
const _kChannelId = 'afrovision_main';
const _kChannelName = 'AfroVision';
const _kChannelDesc =
    'Channel updates, gifts, admin alerts, and account notifications';

class NotificationService {
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  /// Global navigator key — set this from MaterialApp to enable deep navigation
  /// from notification taps.
  static GlobalKey<NavigatorState>? navigatorKey;

  /// Callback invoked whenever the in-app unread count changes so the home
  /// screen (or any listener) can refresh its badge. Set by the HomeScreen.
  static VoidCallback? onUnreadCountChanged;

  // ── Initialization ──────────────────────────────────────────────────────────

  /// Call once in main(), after Firebase.initializeApp().
  static Future<void> initialize() async {
    // Register background handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // iOS — show alert/badge/sound while app is in foreground
    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );

    // Android — create the high-importance channel
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            _kChannelId,
            _kChannelName,
            description: _kChannelDesc,
            importance: Importance.high,
            playSound: true,
          ),
        );

    // Initialize flutter_local_notifications with tap callback
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Show heads-up notification when app is in the foreground
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // Handle notification tap when app was in the background (not terminated)
    FirebaseMessaging.onMessageOpenedApp.listen(_onMessageOpenedApp);

    // Handle notification tap that launched the app from terminated state
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      // Delay slightly so the navigator is ready
      Future.delayed(const Duration(milliseconds: 800), () {
        _navigateFromMessage(initialMessage);
      });
    }
  }

  // ── App icon badge ──────────────────────────────────────────────────────────

  /// Update the app launcher icon badge count. Pass 0 to clear.
  static Future<void> updateAppBadge(int count) async {
    try {
      if (count <= 0) {
        FlutterAppBadger.removeBadge();
      } else {
        FlutterAppBadger.updateBadgeCount(count);
      }
    } catch (_) {}
  }

  // ── Permission ──────────────────────────────────────────────────────────────

  /// Check current permission status. Returns true when already authorized.
  static Future<bool> isPermissionGranted() async {
    final settings = await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Check if permission has never been asked (not determined).
  static Future<bool> isPermissionNotDetermined() async {
    final settings = await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.notDetermined;
  }

  /// Show in-app rationale (Android) then trigger the OS permission prompt.
  /// Safe to call on both platforms — on iOS the OS prompt is shown directly.
  /// Returns true if the user granted permission.
  static Future<bool> requestPermission(BuildContext context) async {
    // On Android, show our own rationale dialog first
    if (Platform.isAndroid) {
      final proceed = await _showRationaleDialog(context);
      if (!proceed) return false;
    }

    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  // ── Token management ────────────────────────────────────────────────────────

  /// Get the FCM token and upload it to the backend.
  /// Silent — no permission prompt. Call after login.
  static Future<void> registerToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _uploadToken(token);
      // Keep token fresh if it rotates
      FirebaseMessaging.instance.onTokenRefresh.listen(_uploadToken);
    } catch (_) {
      // Non-fatal — token will be registered on next launch
    }
  }

  /// Remove the FCM token from the backend and delete it locally.
  /// Call on logout.
  static Future<void> unregisterToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await ApiService.post('/users/fcm-token/remove', {'token': token});
      }
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  static Future<void> _uploadToken(String token) async {
    final authToken = await AuthStorage.getToken();
    if (authToken == null) return; // User is not logged in
    try {
      await ApiService.post('/users/fcm-token', {'token': token});
    } catch (_) {}
  }

  static void _onForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    // Update app icon badge from data payload
    _updateBadgeFromData(message.data);

    // Notify listeners (e.g. HomeScreen) to refresh unread count
    onUnreadCountChanged?.call();

    // Store the notification_id in the payload so the tap handler can use it
    final payload = message.data['notification_id'] ?? '';

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _kChannelId,
          _kChannelName,
          channelDescription: _kChannelDesc,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: payload,
    );
  }

  /// Called when user taps a local notification (foreground heads-up).
  static void _onNotificationTap(NotificationResponse response) {
    _navigateToNotifications();
  }

  /// Called when user taps FCM notification while the app was in background.
  static void _onMessageOpenedApp(RemoteMessage message) {
    _navigateFromMessage(message);
  }

  /// Route to the correct screen based on the FCM data payload.
  static void _navigateFromMessage(RemoteMessage message) {
    // Update badge from data
    _updateBadgeFromData(message.data);
    // Always navigate to the notifications screen
    _navigateToNotifications();
  }

  /// Navigate to /notifications using the global navigator key.
  static void _navigateToNotifications() {
    final nav = navigatorKey?.currentState;
    if (nav != null) {
      nav.pushNamed('/notifications');
    }
  }

  /// Extract unread_count from data payload and update the app icon badge.
  static void _updateBadgeFromData(Map<String, dynamic> data) {
    try {
      final raw = data['unread_count'];
      if (raw != null) {
        final count = int.tryParse(raw.toString()) ?? 0;
        updateAppBadge(count);
      }
    } catch (_) {}
  }

  static Future<bool> _showRationaleDialog(BuildContext context) async {
    return await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => Dialog(
            backgroundColor: AppColors.cardBg,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(color: AppColors.orange.withValues(alpha: 0.25)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.notifications_active_rounded,
                      color: AppColors.orange,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Stay in the Loop',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Allow AfroVision to send you notifications for:\n\n'
                    '• New broadcasts from your favourite channels\n'
                    '• Gifts and reactions from your audience\n'
                    '• Subscription and wallet updates\n'
                    '• Important account and admin alerts',
                    style: TextStyle(
                      color: AppColors.hintText,
                      fontSize: 14,
                      height: 1.6,
                    ),
                    textAlign: TextAlign.left,
                  ),
                  const SizedBox(height: 28),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: AppColors.inputBorder.withValues(
                                alpha: 0.4,
                              ),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            'Not Now',
                            style: TextStyle(
                              color: AppColors.hintText.withValues(alpha: 0.8),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.orange,
                            foregroundColor: AppColors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Allow',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ) ??
        false;
  }
}
