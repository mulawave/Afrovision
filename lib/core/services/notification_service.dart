import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../api/api_service.dart';
import '../storage/auth_storage.dart';
import '../theme/app_colors.dart';
import '../widgets/notification_banner.dart';
import '../../firebase_options.dart';

// ── Background message handler ────────────────────────────────────────────────
// Must be a top-level function (not a class member).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background handler runs in a separate isolate — must initialize Firebase.
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // Badge updates are handled in the foreground handler where
  // flutter_local_notifications is initialized. The background isolate
  // cannot access the plugin instance.
  try {
    final dataCount = message.data['unread_count'];
    if (dataCount != null) {
      final count = int.tryParse(dataCount.toString()) ?? 0;
      if (count > 0) {
        final plugin = FlutterLocalNotificationsPlugin();
        await plugin.show(
          0,
          '',
          '',
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'afrovision_main',
              'AfroVision',
              channelDescription:
                  'Channel updates, gifts, admin alerts, and account notifications',
              importance: Importance.min,
              priority: Priority.min,
              playSound: false,
              enableVibration: false,
              icon: 'ic_stat_notification',
            ),
          ),
        );
      }
    }
  } catch (_) {}
}

// ── Notification channels (Android) ──────────────────────────────────────────
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
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.createNotificationChannel(
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
        // Icon name only — the plugin resolves it from res/drawable/
        android: AndroidInitializationSettings('ic_stat_notification'),
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
      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        if (count <= 0) {
          await androidPlugin.cancel(0);
        } else {
          // Show a silent notification to update the launcher badge count.
          // Android OEMs (Samsung, Sony, etc.) derive the badge from
          // active notifications in the app's channels.
          await _localNotifications.show(
            0,
            '',
            '',
            const NotificationDetails(
              android: AndroidNotificationDetails(
                _kChannelId,
                _kChannelName,
                channelDescription: _kChannelDesc,
                importance: Importance.min,
                priority: Priority.min,
                playSound: false,
                enableVibration: false,
                icon: 'ic_stat_notification',
              ),
            ),
          );
        }
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

    final granted =
        settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;

    // Always re-register the token immediately after the user grants permission
    // so the backend has a fresh, valid token for this device.
    if (granted) {
      await registerToken();
    }

    return granted;
  }

  // ── Token management ────────────────────────────────────────────────────────

  /// Register the device's FCM token with the backend.
  /// Follows the ecosystem convention of users/{uid}.deviceToken:
  /// - Always obtains the current fresh FCM token from Firebase for this installation.
  /// - Skips the upload only when the fresh token already matches the canonical
  ///   deviceToken stored at users/{uid}.deviceToken (avoids redundant calls).
  /// - When the tokens differ, the server's addFcmToken preserves the existing
  ///   deviceToken unchanged and adds the fresh token to fcm_tokens[], so
  ///   sendToUser can reach the device via either token.
  /// Call after login (silent — no permission prompt).
  static Future<void> registerToken() async {
    try {
      // Always get the current FCM token for this installation.
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;

      // Check whether the server already has this exact token as the canonical
      // deviceToken — if so, nothing to do.
      final existing = await _fetchExistingDeviceToken();
      if (existing != null && existing == token) {
        // Token is already registered and current — just keep the refresh listener.
        FirebaseMessaging.instance.onTokenRefresh.listen(_uploadToken);
        return;
      }

      // Fresh token differs from the canonical one (or no canonical exists yet).
      // Register it — the server preserves deviceToken and adds this to fcm_tokens.
      await _uploadToken(token);

      // Keep the token current when FCM rotates it.
      FirebaseMessaging.instance.onTokenRefresh.listen(_uploadToken);
    } catch (_) {
      // Non-fatal — token will be registered on next launch
    }
  }

  /// Remove the FCM token from the backend and delete it locally.
  /// Call on logout.
  static Future<void> unregisterToken() async {
    try {
      // Prefer deleting the canonical deviceToken; fall back to the local FCM token.
      final deviceToken =
          await _fetchExistingDeviceToken() ??
          await FirebaseMessaging.instance.getToken();
      if (deviceToken != null) {
        await ApiService.post('/users/fcm-token/remove', {
          'token': deviceToken,
        });
      }
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /// Fetch the AfroVision-exclusive token stored at users/{uid}.afroDeviceToken.
  /// Returns null when the user is not logged in or no token has been registered.
  static Future<String?> _fetchExistingDeviceToken() async {
    final authToken = await AuthStorage.getToken();
    if (authToken == null) return null;
    try {
      final response = await ApiService.get('/users/device-token');
      final dt = response['afroDeviceToken'];
      if (dt is String && dt.isNotEmpty) return dt;
    } catch (_) {}
    return null;
  }

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

    final channelId = _kChannelId;
    final channelName = _kChannelName;
    final channelDesc = _kChannelDesc;

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          channelDescription: channelDesc,
          importance: Importance.high,
          priority: Priority.max,
          // Monochrome drawable icon required for correct notification display
          icon: 'ic_stat_notification',
          visibility: NotificationVisibility.public,
          playSound: true,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: payload,
    );

    // Show in-app premium banner overlay when the app is in the foreground
    final navContext = navigatorKey?.currentContext;
    if (navContext != null) {
      NotificationBanner.show(
        navContext,
        title: notification.title ?? 'AfroVision',
        body: notification.body ?? '',
        type: message.data['type'],
        onTap: () => _navigateToNotifications(),
      );
    }
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
                              color: AppColors.goldText,
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
