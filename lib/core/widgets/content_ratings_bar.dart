import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Compact row of IARC content rating badges for auth screens.
class ContentRatingsBar extends StatelessWidget {
  const ContentRatingsBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _badge('PEGI', '18', const Color(0xFFE3000B)),
            const SizedBox(width: 8),
            _badge('IARC', '18+', const Color(0xFF1A1A1A)),
            const SizedBox(width: 8),
            _badge('ESRB', 'M', const Color(0xFF000000)),
            const SizedBox(width: 8),
            _badge('USK', '18', const Color(0xFFE3000B)),
            const SizedBox(width: 8),
            _badge('GRAC', '18', const Color(0xFFE3000B)),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'Rated by IARC',
          style: TextStyle(
            color: AppColors.lightOrange.withValues(alpha: 0.45),
            fontSize: 10,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _badge(String label, String rating, Color color) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.3),
          width: 0.5,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 6,
              fontWeight: FontWeight.w700,
              height: 1,
            ),
          ),
          Text(
            rating,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w900,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
