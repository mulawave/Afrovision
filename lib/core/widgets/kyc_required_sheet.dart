import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/nocturne_theme.dart';

/// Standard bottom sheet shown when a non-KYC user tries to perform an action
/// that requires verified KYC (play, purchase, upload, withdraw, etc.).
class KycRequiredSheet extends StatelessWidget {
  const KycRequiredSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Nocturne.surface,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(22),
          topRight: Radius.circular(22),
        ),
        border: Border(
          top: BorderSide(color: Nocturne.gold, width: 1),
          left: BorderSide(color: Nocturne.border, width: 1),
          right: BorderSide(color: Nocturne.border, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x8C000000),
            blurRadius: 50,
            offset: Offset(0, -20),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: Nocturne.borderStrong,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Icon(
              Icons.verified_user_rounded,
              color: Nocturne.gold,
              size: 42,
            ),
            const SizedBox(height: 14),
            const Text(
              'KYC Verification Required',
              style: TextStyle(
                color: Nocturne.text,
                fontSize: 19,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Adult content, purchases, and creator actions require a verified KYC account.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Nocturne.textMuted,
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'If you are not interested in verifying your account, you can still watch free public channels on the website.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Nocturne.textFaint,
                fontSize: 12,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            _primaryButton(
              label: 'Complete KYC',
              onTap: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: 10),
            _ghostButton(
              label: 'Watch free on website',
              onTap: () async {
                final uri = Uri.parse(
                  'https://afrovision-website-zoeqld5lsa-uc.a.run.app',
                );
                if (await canLaunchUrl(uri)) {
                  await launchUrl(
                    uri,
                    mode: LaunchMode.externalApplication,
                  );
                }
              },
            ),
            const SizedBox(height: 8),
            _textButton(
              label: 'Maybe later',
              onTap: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }

  Widget _primaryButton({
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          gradient: Nocturne.goldCta,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            color: Nocturne.surface,
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _ghostButton({
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Nocturne.border, width: 1),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            color: Nocturne.text,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _textButton({
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
