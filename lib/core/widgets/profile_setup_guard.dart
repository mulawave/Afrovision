import 'package:flutter/material.dart';
import '../../features/auth/services/auth_service.dart';
import '../../features/auth/models/user_model.dart';
import '../storage/auth_storage.dart';
import '../theme/app_colors.dart';

class ProfileSetupGuard extends NavigatorObserver {
  // Static so profile updates elsewhere in the app (ProfileService) can
  // invalidate this cache without needing a reference to the observer
  // instance registered on MaterialApp.
  static UserModel? _cachedUser;
  static DateTime? _lastCheck;
  static const _checkInterval = Duration(minutes: 5);

  /// Invalidate the cached user so the next route check re-fetches fresh
  /// profile-completeness state instead of bouncing the user back into
  /// setup for up to 5 minutes after they just completed it.
  static void clearCache() {
    _cachedUser = null;
    _lastCheck = null;
  }

  Future<UserModel?> _getUser() async {
    // Return cached user if fresh
    if (_cachedUser != null && _lastCheck != null &&
        DateTime.now().difference(_lastCheck!) < _checkInterval) {
      return _cachedUser;
    }

    final token = await AuthStorage.getToken();
    if (token == null) return null;

    try {
      _cachedUser = await AuthService.getCurrentUser();
      _lastCheck = DateTime.now();
      return _cachedUser;
    } catch (_) {
      return null;
    }
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _checkRoute(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) _checkRoute(newRoute);
  }

  void _checkRoute(Route<dynamic> route) {
    final name = route.settings.name;
    if (name == null) return;

    // Allow auth-related and profile-setup routes
    const allowedRoutes = [
      '/splash',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/profile-setup',
      '/pak-login',
      '/terms',
      '/privacy-policy',
    ];
    if (allowedRoutes.contains(name)) return;

    _getUser().then((user) {
      if (user == null) return;
      if (user.isProfileComplete || user.role == 'admin') return;

      final navigator = this.navigator;
      if (navigator == null || !navigator.mounted) return;

      // Check if we're already on profile-setup to avoid loops
      final currentRoute = navigator.canPop()
          ? null
          : route;
      if (currentRoute?.settings.name == '/profile-setup') return;

      navigator.pushNamedAndRemoveUntil(
        '/profile-setup',
        (_) => false,
      );

      final context = navigator.context;
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Please complete your profile to continue using AfroVision.',
              style: TextStyle(color: AppColors.white),
            ),
            backgroundColor: AppColors.cardBg,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 4),
          ),
        );
      }
    });
  }
}
