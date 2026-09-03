import 'package:flutter/material.dart';
import 'package:afrovision_marketer/core/theme/app_colors.dart';

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;

  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null || isLoading;
    return Container(
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        gradient: disabled ? AppColors.buttonDisabledGradient : AppColors.buttonGradient,
        borderRadius: BorderRadius.circular(12),
        boxShadow: disabled ? null : [
          BoxShadow(
            color: AppColors.orange.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(12),
          child: Center(
            child: isLoading
                ? SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation(AppColors.darkBlue),
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, color: AppColors.darkBlue, size: 20),
                        SizedBox(width: 8),
                      ],
                      Text(
                        label,
                        style: TextStyle(
                          color: AppColors.darkBlue,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
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
