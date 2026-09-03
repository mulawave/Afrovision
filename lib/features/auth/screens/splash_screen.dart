import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/storage/auth_storage.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_logo.dart';

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

  Future<void> _checkAuth() async {
    debugPrint('[Splash] Starting auth check...');
    await Future.delayed(const Duration(milliseconds: 2000));
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
      await AuthStorage.deleteToken();
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: FadeTransition(
          opacity: _fadeIn,
          child: ScaleTransition(
            scale: _scale,
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AppLogo(size: 100, showTagline: true),
                SizedBox(height: 48),
                SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      AppColors.lightOrange,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
