import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class RoleBadge extends StatelessWidget {
  final String role;
  final bool isPremiumCreator;
  final String? subscriptionPlan;

  const RoleBadge({
    super.key,
    required this.role,
    this.isPremiumCreator = false,
    this.subscriptionPlan,
  });

  @override
  Widget build(BuildContext context) {
    final config = _badgeConfig;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: config.color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: config.color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(config.icon, color: config.color, size: 14),
          const SizedBox(width: 5),
          Text(
            config.label,
            style: TextStyle(
              color: config.color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  _BadgeConfig get _badgeConfig {
    if (role == 'admin') {
      return _BadgeConfig(
        label: 'ADMIN',
        color: AppColors.errorRed,
        icon: Icons.shield_rounded,
      );
    }
    if (role == 'creator' && isPremiumCreator) {
      return _BadgeConfig(
        label: 'PREMIUM CREATOR',
        color: AppColors.orange,
        icon: Icons.workspace_premium_rounded,
      );
    }
    if (role == 'creator' && subscriptionPlan == 'pro') {
      return _BadgeConfig(
        label: 'PRO CREATOR',
        color: const Color(0xFF5FD39A),
        icon: Icons.star_rounded,
      );
    }
    if (role == 'creator') {
      return _BadgeConfig(
        label: 'CREATOR',
        color: const Color(0xFF5FD39A),
        icon: Icons.videocam_rounded,
      );
    }
    return _BadgeConfig(
      label: 'VIEWER',
      color: AppColors.lightOrange,
      icon: Icons.visibility_rounded,
    );
  }
}

class _BadgeConfig {
  final String label;
  final Color color;
  final IconData icon;

  _BadgeConfig({
    required this.label,
    required this.color,
    required this.icon,
  });
}
