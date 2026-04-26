import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

/// Animated gradient progress bar showing rep progress toward the next level.
class RepProgressBar extends StatefulWidget {
  /// 0.0–1.0 fill fraction.
  final double progress;

  /// Current reps (shown on the left label).
  final double currentReps;

  /// Reps needed for the next level (shown on the right label).
  /// Pass null if the user is at max level.
  final double? targetReps;

  /// Reputation level — used to select the gradient color.
  final int level;

  const RepProgressBar({
    super.key,
    required this.progress,
    required this.currentReps,
    this.targetReps,
    required this.level,
  });

  @override
  State<RepProgressBar> createState() => _RepProgressBarState();
}

class _RepProgressBarState extends State<RepProgressBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _anim = Tween<double>(
      begin: 0,
      end: widget.progress.clamp(0.0, 1.0),
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void didUpdateWidget(RepProgressBar old) {
    super.didUpdateWidget(old);
    if (old.progress != widget.progress) {
      _anim = Tween<double>(
        begin: _anim.value,
        end: widget.progress.clamp(0.0, 1.0),
      ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
      _ctrl
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  LinearGradient get _barGradient {
    switch (widget.level) {
      case 1:
        return const LinearGradient(
          colors: [AppColors.reputationBlue, Color(0xFFADD8FF)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        );
      case 2:
        return const LinearGradient(
          colors: [AppColors.reputationPurple, Color(0xFFB87FFF)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        );
      case 3:
        return AppColors.buttonGradient;
      default:
        return const LinearGradient(
          colors: [AppColors.hintText, AppColors.inputBorder],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        );
    }
  }

  String _formatReps(double v) {
    if (v >= 1000) {
      return '${(v / 1000).toStringAsFixed(v % 1000 == 0 ? 0 : 1)}K';
    }
    return v.toStringAsFixed(0);
  }

  @override
  Widget build(BuildContext context) {
    final target = widget.targetReps;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedBuilder(
          animation: _anim,
          builder: (context, _) {
            return LayoutBuilder(
              builder: (context, constraints) {
                final barWidth = constraints.maxWidth;
                final filledWidth = (barWidth * _anim.value).clamp(
                  0.0,
                  barWidth,
                );
                return Stack(
                  children: [
                    // Track
                    Container(
                      height: 8,
                      width: barWidth,
                      decoration: BoxDecoration(
                        color: AppColors.inputBorder.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    // Fill
                    Container(
                      height: 8,
                      width: filledWidth,
                      decoration: BoxDecoration(
                        gradient: _barGradient,
                        borderRadius: BorderRadius.circular(4),
                        boxShadow: [
                          BoxShadow(
                            color: _glowColor.withValues(alpha: 0.5),
                            blurRadius: 6,
                            offset: Offset.zero,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            );
          },
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '${_formatReps(widget.currentReps)} Reps',
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (target != null)
              Text(
                '${_formatReps(target)} needed',
                style: const TextStyle(
                  color: AppColors.hintText,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              )
            else
              const Text(
                'Max Level',
                style: TextStyle(
                  color: AppColors.lightOrange,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      ],
    );
  }

  Color get _glowColor {
    switch (widget.level) {
      case 1:
        return AppColors.reputationBlue;
      case 2:
        return AppColors.reputationPurple;
      case 3:
        return AppColors.orange;
      default:
        return AppColors.hintText;
    }
  }
}
