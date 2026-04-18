import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum PasswordStrength { none, weak, medium, strong, superb }

class PasswordCriteria {
  final bool hasUppercase;
  final bool hasAlphanumeric;
  final bool hasSpecialChar;
  final bool hasMinLength;

  const PasswordCriteria({
    required this.hasUppercase,
    required this.hasAlphanumeric,
    required this.hasSpecialChar,
    required this.hasMinLength,
  });

  int get metCount =>
      (hasUppercase ? 1 : 0) +
      (hasAlphanumeric ? 1 : 0) +
      (hasSpecialChar ? 1 : 0) +
      (hasMinLength ? 1 : 0);

  PasswordStrength get strength {
    final count = metCount;
    if (count == 0) return PasswordStrength.none;
    if (count == 1) return PasswordStrength.weak;
    if (count == 2) return PasswordStrength.medium;
    if (count == 3) return PasswordStrength.strong;
    return PasswordStrength.superb;
  }

  factory PasswordCriteria.evaluate(String password) {
    return PasswordCriteria(
      hasUppercase: password.contains(RegExp(r'[A-Z]')),
      hasAlphanumeric:
          password.contains(RegExp(r'[a-zA-Z]')) &&
          password.contains(RegExp(r'[0-9]')),
      hasSpecialChar: password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]')),
      hasMinLength: password.length > 6,
    );
  }
}

class PasswordStrengthIndicator extends StatelessWidget {
  final String password;

  const PasswordStrengthIndicator({super.key, required this.password});

  static const _barColors = [
    Color(0xFFFF4D4D), // weak - red
    Color(0xFFF49617), // medium - orange
    Color(0xFFFFD700), // strong - yellow
    Color(0xFF00E676), // superb - green
  ];

  static const _strengthLabels = {
    PasswordStrength.none: '',
    PasswordStrength.weak: 'Weak',
    PasswordStrength.medium: 'Medium',
    PasswordStrength.strong: 'Strong',
    PasswordStrength.superb: 'Superb',
  };

  @override
  Widget build(BuildContext context) {
    final criteria = PasswordCriteria.evaluate(password);
    final strength = criteria.strength;
    final activeBars = criteria.metCount;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Strength bars
        Row(
          children: List.generate(4, (index) {
            final isActive = index < activeBars;
            return Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 350),
                curve: Curves.easeOutCubic,
                height: 4,
                margin: EdgeInsets.only(right: index < 3 ? 6 : 0),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: isActive
                      ? _barColors[index]
                      : AppColors.inputBorder.withValues(alpha: 0.4),
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: _barColors[index].withValues(alpha: 0.4),
                            blurRadius: 6,
                            spreadRadius: 0,
                          ),
                        ]
                      : null,
                ),
              ),
            );
          }),
        ),

        // Strength label
        if (strength != PasswordStrength.none) ...[
          const SizedBox(height: 8),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: Text(
              _strengthLabels[strength]!,
              key: ValueKey(strength),
              style: TextStyle(
                color: _barColors[activeBars - 1],
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ],

        // Criteria list — auto-hide with slide when all met
        AnimatedSize(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut,
          alignment: Alignment.topCenter,
          child: strength == PasswordStrength.superb
              ? const SizedBox.shrink()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 14),
                    _CriteriaItem(
                      label: 'Must have 1 capital letter or more',
                      met: criteria.hasUppercase,
                    ),
                    const SizedBox(height: 8),
                    _CriteriaItem(
                      label: 'Must be alphanumeric',
                      met: criteria.hasAlphanumeric,
                    ),
                    const SizedBox(height: 8),
                    _CriteriaItem(
                      label: 'Must have a special character',
                      met: criteria.hasSpecialChar,
                    ),
                    const SizedBox(height: 8),
                    _CriteriaItem(
                      label: 'Must be more than 6 characters in length',
                      met: criteria.hasMinLength,
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _CriteriaItem extends StatelessWidget {
  final String label;
  final bool met;

  const _CriteriaItem({required this.label, required this.met});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 350),
          switchInCurve: Curves.elasticOut,
          switchOutCurve: Curves.easeIn,
          transitionBuilder: (child, animation) {
            return ScaleTransition(scale: animation, child: child);
          },
          child: met
              ? const Icon(
                  Icons.check_circle,
                  key: ValueKey('check'),
                  color: Color(0xFF00E676),
                  size: 18,
                )
              : Icon(
                  Icons.radio_button_unchecked,
                  key: const ValueKey('uncheck'),
                  color: AppColors.goldText,
                  size: 18,
                ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 300),
            style: TextStyle(
              color: met ? const Color(0xFF00E676) : AppColors.hintText,
              fontSize: 12,
              fontWeight: met ? FontWeight.w600 : FontWeight.w400,
              letterSpacing: 0.2,
            ),
            child: Text(label),
          ),
        ),
      ],
    );
  }
}
