import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/reputation_badge.dart';
import '../models/reputation_model.dart';
import 'rep_progress_bar.dart';

/// Compact reputation card for embedding in profile or other screens.
/// Tapping navigates to /reputation.
class ReputationCard extends StatelessWidget {
  final ReputationModel reputation;

  const ReputationCard({super.key, required this.reputation});

  String _formatReps(double v) {
    if (v >= 1000) {
      return '${(v / 1000).toStringAsFixed(v % 1000 == 0 ? 0 : 1)}K';
    }
    return v.toStringAsFixed(0);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed('/reputation'),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.3),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
            BoxShadow(
              color: AppColors.orange.withValues(alpha: 0.06),
              blurRadius: 20,
              spreadRadius: 0,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ReputationBadgeWidget(
                    level: reputation.level,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${_formatReps(reputation.totalReps)} Reps',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        reputation.level > 0
                            ? reputation.levelName
                            : 'No Badge — Keep Gifting!',
                        style: const TextStyle(
                          color: AppColors.lightOrange,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.hintText,
                  size: 22,
                ),
              ],
            ),
            const SizedBox(height: 16),
            RepProgressBar(
              progress: reputation.progressPercent,
              currentReps: reputation.totalReps,
              targetReps: reputation.nextLevelThreshold,
              level: reputation.level,
            ),
          ],
        ),
      ),
    );
  }
}
