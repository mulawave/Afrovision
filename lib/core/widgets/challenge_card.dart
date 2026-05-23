import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class ChallengeCard extends StatelessWidget {
  final String title;
  final String phase;
  final int? maxContestants;
  final int? enrolled;
  final VoidCallback? onTap;
  final bool isActive;

  const ChallengeCard({
    super.key,
    required this.title,
    required this.phase,
    this.maxContestants,
    this.enrolled,
    this.onTap,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOut,
      margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 0),
      decoration: BoxDecoration(
        gradient: isActive ? AppColors.primaryGradient : null,
        color: isActive ? null : AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkBlue.withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(
          color: isActive ? AppColors.orange : AppColors.inputBorder,
          width: 1.5,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Text(
                          'Phase: ',
                          style: TextStyle(
                            color: AppColors.hintText,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          phase,
                          style: TextStyle(
                            color: AppColors.goldText,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        if (maxContestants != null) ...[
                          const SizedBox(width: 18),
                          Text(
                            'Max: ',
                            style: TextStyle(
                              color: AppColors.hintText,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            '$maxContestants',
                            style: TextStyle(
                              color: AppColors.goldText,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ],
                        if (enrolled != null) ...[
                          const SizedBox(width: 18),
                          Text(
                            'Enrolled: ',
                            style: TextStyle(
                              color: AppColors.hintText,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            '$enrolled',
                            style: TextStyle(
                              color: AppColors.successGreen,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              if (isActive)
                Icon(Icons.check_circle, color: AppColors.orange, size: 32),
            ],
          ),
        ),
      ),
    );
  }
}
