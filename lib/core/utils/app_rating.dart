import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_colors.dart';

class AppRating {
  static const _launchCountKey = 'app_launch_count';
  static const _hasRatedKey = 'app_has_rated';
  static const _launchInterval = 3;

  /// Call on every app launch. Shows the rating dialog every 3rd launch
  /// until the user has rated.
  static Future<void> checkAndPrompt(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final hasRated = prefs.getBool(_hasRatedKey) ?? false;
    if (hasRated) return;

    final count = (prefs.getInt(_launchCountKey) ?? 0) + 1;
    await prefs.setInt(_launchCountKey, count);

    if (count % _launchInterval == 0 && context.mounted) {
      _showRatingDialog(context, prefs);
    }
  }

  static void _showRatingDialog(BuildContext context, SharedPreferences prefs) {
    int selectedStars = 0;
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Dialog(
              backgroundColor: Colors.transparent,
              child: Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0E1A50), AppColors.darkBlue],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: AppColors.lightOrange.withValues(alpha: 0.25),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.4),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: AppColors.buttonGradient,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.star_rounded,
                        color: AppColors.white,
                        size: 36,
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      'Enjoying AfroVision?',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Rate your experience to help us improve!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Star rating row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (i) {
                        final starNum = i + 1;
                        return GestureDetector(
                          onTap: () =>
                              setDialogState(() => selectedStars = starNum),
                          child: Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 4),
                            child: Icon(
                              starNum <= selectedStars
                                  ? Icons.star_rounded
                                  : Icons.star_outline_rounded,
                              color: AppColors.lightOrange,
                              size: 40,
                            ),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 24),
                    // Submit button
                    GestureDetector(
                      onTap: selectedStars > 0
                          ? () async {
                              await prefs.setBool(_hasRatedKey, true);
                              if (ctx.mounted) Navigator.of(ctx).pop();
                            }
                          : null,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          gradient: selectedStars > 0
                              ? AppColors.buttonGradient
                              : null,
                          color: selectedStars > 0
                              ? null
                              : AppColors.inputFill,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          selectedStars > 0 ? 'Submit Rating' : 'Tap a Star',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: selectedStars > 0
                                ? AppColors.white
                                : AppColors.hintText,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: () => Navigator.of(ctx).pop(),
                      child: const Text(
                        'Maybe Later',
                        style: TextStyle(
                          color: AppColors.hintText,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
