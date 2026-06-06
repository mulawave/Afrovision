import 'package:flutter/material.dart';
import '../services/floating_player_service.dart';
import '../theme/app_colors.dart';

class ActiveFloatingPlayerBanner extends StatelessWidget {
  const ActiveFloatingPlayerBanner({
    super.key,
    this.margin = const EdgeInsets.fromLTRB(20, 10, 20, 0),
  });

  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<FloatingSessionSnapshot?>(
      valueListenable: FloatingPlayerService.instance.sessionListenable,
      builder: (context, session, _) {
        if (session == null) return const SizedBox.shrink();

        return Container(
          margin: margin,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: AppColors.lightOrange.withValues(alpha: 0.25),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 9,
                height: 9,
                decoration: const BoxDecoration(
                  color: AppColors.successGreen,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  session.channelName == null || session.channelName!.isEmpty
                      ? 'Live channel running in mini-player'
                      : '${session.channelName} is running in mini-player',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: FloatingPlayerService.instance.reopenActiveChannel,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Text(
                    'Return to Live',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: FloatingPlayerService.instance.dismiss,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: const Icon(
                    Icons.close_rounded,
                    color: AppColors.hintText,
                    size: 14,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
