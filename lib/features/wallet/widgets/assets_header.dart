import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';

class AssetsHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback? onBack;
  final Widget? trailing;
  final bool showBack;

  const AssetsHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.onBack,
    this.trailing,
    this.showBack = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: Nocturne.headerGradient,
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Row(
              children: [
                if (showBack)
                  _HeaderButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: onBack ?? () => Navigator.maybePop(context),
                  )
                else
                  const SizedBox(width: 36),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.01,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
                if (trailing == null) const SizedBox(width: 36),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _HeaderButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: const Color(0x08FFFFFF),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Nocturne.borderStrong),
        ),
        alignment: Alignment.center,
        child: Icon(
          icon,
          color: const Color(0xFFC3CDE6),
          size: 16,
        ),
      ),
    );
  }
}

class HideBalancesButton extends StatelessWidget {
  final bool hidden;
  final VoidCallback onToggle;

  const HideBalancesButton({
    super.key,
    required this.hidden,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return _HeaderButton(
      icon: hidden ? Icons.visibility_off_rounded : Icons.visibility_rounded,
      onTap: onToggle,
    );
  }
}
