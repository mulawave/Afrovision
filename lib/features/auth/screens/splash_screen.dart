import 'dart:async';

import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../../../core/api/api_service.dart';
import '../../payments/services/google_play_billing_service.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/storage/auth_storage.dart';
import '../../../core/theme/nocturne_theme.dart';

/// The only full-bleed screen in the app (design: "Splash Screen" mock) —
/// a gold spinner on the Home gradient, no invented logo lockup, and a
/// skip control. Every other screen sits on the flat page background;
/// this one keeps a distinct vertical gradient by design.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeIn;
  late Animation<double> _scale;
  bool _showRetry = false;
  Completer<void>? _skipCompleter;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _scale = Tween<double>(
      begin: 0.8,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));
    _controller.forward();
    _checkAuth();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onSkip() {
    final completer = _skipCompleter;
    if (completer != null && !completer.isCompleted) completer.complete();
  }

  Future<void> _checkAuth() async {
    if (mounted) setState(() => _showRetry = false);
    debugPrint('[Splash] Starting auth check...');
    final skipCompleter = Completer<void>();
    _skipCompleter = skipCompleter;
    await Future.any([
      Future.delayed(const Duration(milliseconds: 2000)),
      skipCompleter.future,
    ]);
    final token = await AuthStorage.getToken();
    debugPrint('[Splash] Token present: ${token != null}');
    if (!mounted) return;

    if (token == null) {
      Navigator.pushReplacementNamed(context, '/login');
      return;
    }

    try {
      debugPrint('[Splash] Calling getCurrentUser...');
      final user = await AuthService.getCurrentUser();
      debugPrint('[Splash] getCurrentUser succeeded');
      if (!mounted) return;

      // Register FCM token silently (permission may already be granted).
      await NotificationService.registerToken();

      // Retry any Google Play purchases charged but never verified with the
      // backend (e.g. the app was killed mid-verification). Non-blocking.
      GooglePlayBillingService.retryPendingVerifications();

      // Request notification permission if not yet granted.
      // We do NOT gate on notDetermined — on Android 12 and below the status
      // is never notDetermined (permission is implicit), so gating on it would
      // mean the dialog is never shown.  We simply skip if already authorized.
      final alreadyGranted = await NotificationService.isPermissionGranted();
      if (!alreadyGranted && mounted) {
        await NotificationService.requestPermission(context);
        // registerToken() is called inside requestPermission on grant
      }

      if (!mounted) return;

      // Redirect to profile setup if incomplete (non-admin)
      if (!user.isProfileComplete && user.role != 'admin') {
        Navigator.pushReplacementNamed(context, '/profile-setup');
        return;
      }

      // Redirect to KYC if required (non-admin)
      if (user.kycRequired && user.role != 'admin') {
        Navigator.pushReplacementNamed(context, '/kyc');
        return;
      }

      Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      debugPrint('[Splash] Auth check failed: $e');
      if (!mounted) return;

      // Only a real auth rejection (401/403) should sign the user out.
      // Network hiccups (timeouts, offline) must not delete a valid token —
      // offer a retry instead so a brief connectivity blip doesn't log
      // the user out of the app.
      final statusCode = e is ApiException ? e.statusCode : null;
      final isAuthRejection = statusCode == 401 || statusCode == 403;

      if (isAuthRejection) {
        await AuthStorage.deleteToken();
        if (!mounted) return;
        Navigator.pushReplacementNamed(context, '/login');
      } else {
        setState(() => _showRetry = true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Nocturne.bgHeader, Nocturne.bg],
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: FadeTransition(
                opacity: _fadeIn,
                child: ScaleTransition(
                  scale: _scale,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(
                        width: 50,
                        height: 50,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          backgroundColor: Nocturne.borderMuted,
                          valueColor: AlwaysStoppedAnimation<Color>(Nocturne.gold),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'LOADING AFROVISION',
                        style: TextStyle(
                          color: Nocturne.textMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                        ),
                      ),
                      if (_showRetry) ...[
                        const SizedBox(height: 20),
                        const Text(
                          'Could not connect. Check your internet connection.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Nocturne.textMuted, fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _checkAuth,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Nocturne.goldLight,
                            foregroundColor: Nocturne.bg,
                          ),
                          child: const Text('Retry'),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 40,
              child: Center(
                child: OutlinedButton(
                  onPressed: _onSkip,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Nocturne.textMuted,
                    side: const BorderSide(color: Nocturne.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                  child: const Text('Skip splash', style: TextStyle(fontSize: 12.5)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
