import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_colors.dart';

class AppRating {
  static const _launchCountKey = 'app_launch_count';
  static const _hasRatedKey = 'app_has_rated';
  static const _launchInterval = 3;
  static const _playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.afrovision.afrovision';

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
            // Dynamic copy based on star selection
            String headline;
            String subtitle;
            String buttonLabel;
            if (selectedStars == 0) {
              headline = 'You\'re Part of\nSomething Special';
              subtitle =
                  'AfroVision was built for people like you — dreamers, creators, and culture lovers who believe Africa\'s voice deserves a global stage.\n\nHow does the experience feel so far?';
              buttonLabel = 'Tap a Star';
            } else if (selectedStars <= 2) {
              headline = 'We Hear You';
              subtitle =
                  'Your honesty means everything. We\'re working hard to make this the home you deserve. Every update gets us closer.';
              buttonLabel = 'Send Feedback';
            } else if (selectedStars == 3) {
              headline = 'We\'re Getting There';
              subtitle =
                  'Good — but not great yet. Your rating helps us understand what to build next so AfroVision feels exactly right for you.';
              buttonLabel = 'Submit & Help Us Grow';
            } else {
              headline = 'You Made Our Day ✨';
              subtitle =
                  'People like you are why we wake up and build. A quick review on the Play Store helps more Africans discover what you\'ve found.';
              buttonLabel = 'Leave a Review';
            }

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
                        Icons.favorite_rounded,
                        color: AppColors.white,
                        size: 36,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      headline,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      subtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.8),
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Star rating row
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(5, (i) {
                          final starNum = i + 1;
                          return GestureDetector(
                            onTap: () =>
                                setDialogState(() => selectedStars = starNum),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              child: AnimatedScale(
                                scale: starNum <= selectedStars ? 1.15 : 1.0,
                                duration: const Duration(milliseconds: 200),
                                child: Icon(
                                  starNum <= selectedStars
                                      ? Icons.star_rounded
                                      : Icons.star_outline_rounded,
                                  color: AppColors.lightOrange,
                                  size: 40,
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Submit button
                    GestureDetector(
                      onTap: selectedStars > 0
                          ? () async {
                              await prefs.setBool(_hasRatedKey, true);
                              if (ctx.mounted) Navigator.of(ctx).pop();
                              // 4-5 stars → open Play Store for review
                              if (selectedStars >= 4) {
                                final uri = Uri.parse(_playStoreUrl);
                                launchUrl(
                                  uri,
                                  mode: LaunchMode.externalApplication,
                                );
                              }
                            }
                          : null,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          gradient: selectedStars > 0
                              ? AppColors.buttonGradient
                              : null,
                          color: selectedStars > 0 ? null : AppColors.inputFill,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          buttonLabel,
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
                        'Not Now',
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
