import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:flutter/widgets.dart';

/// Handles inbound deep links (App Links / Universal Links) and routes them
/// to the correct Flutter screen using the global navigator key.
class DeepLinkService {
  DeepLinkService._();

  static final _appLinks = AppLinks();
  static StreamSubscription<Uri>? _sub;

  /// Optional callback invoked when the payment gateway redirects back to the
  /// app via [afrovision://checkout/result?payment_id=...].
  /// The CheckoutScreen registers this to trigger verification automatically.
  static void Function(String paymentId)? onCheckoutResult;

  /// Call once from [main] or the root widget's build, passing the global
  /// [NavigatorState] key used by [MaterialApp].
  static Future<void> initialize(GlobalKey<NavigatorState> navigatorKey) async {
    // Handle the link that launched the app (cold start).
    final initial = await _appLinks.getInitialLink();
    if (initial != null) {
      _route(initial, navigatorKey);
    }

    // Handle links while the app is already running (warm start).
    _sub?.cancel();
    _sub = _appLinks.uriLinkStream.listen((uri) {
      _route(uri, navigatorKey);
    });
  }

  static void dispose() {
    _sub?.cancel();
    _sub = null;
  }

  // ─── Route resolution ──────────────────────────────────────────────

  static void _route(Uri uri, GlobalKey<NavigatorState> navigatorKey) {
    final nav = navigatorKey.currentState;
    if (nav == null) return;

    final path = uri.path;

    if (path == '/reset-password') {
      final token = uri.queryParameters['token'];
      if (token != null && token.isNotEmpty) {
        nav.pushNamed('/reset-password', arguments: token);
        return;
      }
    }

    // Payment gateway callback: afrovision://checkout/result?payment_id=xxx
    if (path == '/result' &&
        (uri.scheme == 'afrovision') &&
        uri.host == 'checkout') {
      final paymentId = uri.queryParameters['payment_id'];
      if (paymentId != null && paymentId.isNotEmpty) {
        onCheckoutResult?.call(paymentId);
      }
      return;
    }
  }
}
