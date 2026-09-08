import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../../features/auth/services/auth_service.dart';
import '../../features/auth/models/user_model.dart';

class GracePeriodBanner extends StatefulWidget {
  const GracePeriodBanner({super.key});

  @override
  State<GracePeriodBanner> createState() => _GracePeriodBannerState();
}

class _GracePeriodBannerState extends State<GracePeriodBanner> {
  UserModel? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final user = await AuthService.getCurrentUser();
      if (mounted) setState(() { _user = user; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _user == null) return const SizedBox.shrink();
    if (!_user!.gracePeriodActive) return const SizedBox.shrink();

    final endDate = _user!.kycGracePeriodEnd!.split('T')[0];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.orange.withValues(alpha: 0.15),
            AppColors.lightOrange.withValues(alpha: 0.08),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: AppColors.orange, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'KYC Verification Required',
                  style: TextStyle(
                    color: AppColors.orange,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Complete verification before $endDate to keep using AfroVision.',
                  style: TextStyle(color: AppColors.goldText, fontSize: 11, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/kyc'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.orange,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Verify Now',
                style: TextStyle(
                  color: AppColors.darkBlue,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
