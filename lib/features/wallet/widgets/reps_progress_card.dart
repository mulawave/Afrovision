import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../reputation/models/reputation_model.dart';

class RepsProgressCard extends StatelessWidget {
  final ReputationModel? reputation;
  final VoidCallback? onTap;

  const RepsProgressCard({
    super.key,
    this.reputation,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final rep = reputation;
    if (rep == null) {
      return GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            gradient: Nocturne.walletGradient,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Nocturne.borderCard),
            boxShadow: Nocturne.cardShadow,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          child: Row(
            children: [
              _IconBox(),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Reputation',
                      style: TextStyle(
                        color: Nocturne.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Start watching and earning Reps.',
                      style: TextStyle(
                        color: Nocturne.textFaint,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  color: Nocturne.textHint, size: 18),
            ],
          ),
        ),
      );
    }

    final level = rep.level;
    final reps = rep.totalReps.toInt();
    final nextLevel = level + 1;
    final nextThreshold = rep.nextLevelThreshold;
    final needed = nextThreshold != null ? (nextThreshold - rep.totalReps).toInt() : 0;
    final progress = rep.progressPercent;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Nocturne.borderCard),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        child: Row(
          children: [
            _IconBox(),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Level $level',
                        style: const TextStyle(
                          color: Color(0xFFC0A4FF),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_formatCompact(reps)} Reps',
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: Container(
                      height: 5,
                      color: const Color(0x18FFFFFF),
                      child: FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: progress.clamp(0.0, 1.0),
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Color(0xFF8B5CF6), Color(0xFFC4A2FF)],
                            ),
                            borderRadius:
                                BorderRadius.all(Radius.circular(3)),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_formatCompact(reps)} Reps',
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 10,
                        ),
                      ),
                      Text(
                        nextThreshold == null
                            ? 'All levels completed'
                            : '${_formatCompact(needed)} needed for Level $nextLevel',
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right_rounded,
                color: Nocturne.textHint, size: 18),
          ],
        ),
      ),
    );
  }

  static String _formatCompact(int value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    }
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}K';
    }
    return value.toString();
  }
}

class _IconBox extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: const Color(0x298B5CF6),
        borderRadius: BorderRadius.circular(11),
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.shield_rounded,
        color: Color(0xFFC0A4FF),
        size: 18,
      ),
    );
  }
}
