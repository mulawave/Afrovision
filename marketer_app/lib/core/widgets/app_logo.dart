import 'package:flutter/material.dart';
import 'package:afrovision_marketer/core/theme/app_colors.dart';

class AppLogo extends StatelessWidget {
  final double size;
  const AppLogo({super.key, this.size = 48});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(size * 0.22),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(size * 0.22),
            child: Image.asset(
              'assets/images/logo.png',
              fit: BoxFit.cover,
              width: size,
              height: size,
            ),
          ),
        ),
        SizedBox(width: size * 0.2),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: 'Afro', style: TextStyle(color: AppColors.white, fontSize: size * 0.42, fontWeight: FontWeight.bold)),
                  TextSpan(text: 'Vision', style: TextStyle(color: AppColors.orange, fontSize: size * 0.42, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            Text(
              'Marketer',
              style: TextStyle(color: AppColors.lightOrange, fontSize: size * 0.25, fontWeight: FontWeight.w500, letterSpacing: 2),
            ),
          ],
        ),
      ],
    );
  }
}
