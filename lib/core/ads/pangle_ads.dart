import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart';

/// Direct Pangle integration (Android only for now). Banner and native ads are
/// platform views that manage their own load/retry; interstitial and app-open
/// ads are preloaded natively and triggered from here with frequency caps.
class PangleAds with WidgetsBindingObserver {
  PangleAds._();
  static final PangleAds instance = PangleAds._();

  static const MethodChannel _channel =
      MethodChannel('com.afrovision.afrovision/pangle');

  static bool get supported => !kIsWeb && Platform.isAndroid;

  // Same exclusions as the original interstitial observer: watch/player
  // screens, auth, checkout and profile setup never get a full-screen ad.
  static const Set<String> _excludedRoutes = {
    '/wave',
    '/channel-player',
    '/media-player',
    '/live',
    '/splash',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/pak-login',
    '/checkout',
    '/checkout/result',
    '/profile-setup',
  };

  static const Duration _appOpenMinBackground = Duration(seconds: 5);

  // Any full-screen ad (interstitial or app-open) blocks the next one for this
  // long, so a launch ad is never followed straight away by another.
  static const Duration _minGapAfterAnyFullscreen = Duration(minutes: 2);

  DateTime? _lastFullscreenAt;
  // Set while a full-screen ad we launched is on screen. The ad opens over
  // the app, which Flutter reports as paused then resumed - that resume is the
  // ad closing, not the user coming back from the background.
  bool _adInFlight = false;
  DateTime? _pausedAt;
  String? _currentRoute;
  bool _started = false;
  bool _launchAdAttempted = false;

  void start() {
    if (!supported || _started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
  }

  bool get _gapElapsed {
    final last = _lastFullscreenAt;
    return last == null ||
        DateTime.now().difference(last) >= _minGapAfterAnyFullscreen;
  }

  bool _eligible(String? route) =>
      route != null && !_excludedRoutes.contains(route);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      if (!_adInFlight) _pausedAt = DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      if (_adInFlight) {
        _adInFlight = false;
        _pausedAt = null;
        return;
      }
      final pausedAt = _pausedAt;
      _pausedAt = null;
      if (pausedAt == null) return;
      if (!_gapElapsed) return;
      if (DateTime.now().difference(pausedAt) < _appOpenMinBackground) return;
      if (!_eligible(_currentRoute)) return;
      unawaited(_show('showAppOpen'));
    }
  }

  void onRouteChanged(String? routeName) {
    _currentRoute = routeName;
    if (!_eligible(routeName)) return;

    // Cold start: the first real screen after splash gets the app-open ad.
    if (!_launchAdAttempted) {
      _launchAdAttempted = true;
      // Reserve the slot now so a route change during the 600ms settle can't
      // queue an interstitial on top of the launch ad.
      _lastFullscreenAt = DateTime.now();
      _afterTransition(routeName, () => _show('showAppOpen'));
      return;
    }

    if (!_gapElapsed) return;
    _afterTransition(routeName, () async {
      await _show('showInterstitial');
    });
  }

  // Let the route transition settle, then re-check the user is still on the
  // same eligible screen before interrupting them.
  void _afterTransition(String? target, Future<void> Function() action) {
    Future<void>.delayed(const Duration(milliseconds: 600), () {
      if (_currentRoute != target || !_eligible(target)) return;
      unawaited(action());
    });
  }

  Future<bool> _show(String method) async {
    if (!supported) return false;
    try {
      final shown = await _channel.invokeMethod<bool>(method) ?? false;
      if (shown) {
        _adInFlight = true;
        _lastFullscreenAt = DateTime.now();
        // Safety net: if the ad never paused the app, don't swallow a genuine
        // resume much later.
        Future<void>.delayed(const Duration(minutes: 2), () {
          _adInFlight = false;
        });
      }
      return shown;
    } catch (e) {
      debugPrint('[PangleAds] $method failed: $e');
      return false;
    }
  }
}

/// Feeds route changes into [PangleAds] frequency logic.
class PangleRouteObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    PangleAds.instance.onRouteChanged(route.settings.name);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    PangleAds.instance.onRouteChanged(previousRoute?.settings.name);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    PangleAds.instance.onRouteChanged(newRoute?.settings.name);
  }
}
