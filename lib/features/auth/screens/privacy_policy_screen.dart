import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(
                        Icons.arrow_back_ios_new,
                        color: AppColors.white,
                        size: 20,
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'Privacy Policy',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
              ),
              Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.orange.withValues(alpha: 0),
                      AppColors.orange.withValues(alpha: 0.5),
                      AppColors.orange.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),

              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildDocHeader(
                        'AfroVision Privacy Policy',
                        'Effective Date: March 26, 2026',
                      ),
                      const SizedBox(height: 28),

                      _buildSectionTitle('1. Introduction'),
                      _buildParagraph(
                        'AfroVision ("Company", "we", "us", or "our") is '
                        'committed to protecting your privacy. This Privacy '
                        'Policy explains how we collect, use, disclose, and '
                        'safeguard your information when you use our mobile '
                        'application ("App"). Please read this policy carefully. '
                        'By using the App, you consent to the practices described '
                        'in this Privacy Policy.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('2. Information We Collect'),
                      _buildSubTitle('2.1 Information You Provide'),
                      _buildParagraph(
                        'We collect information you voluntarily provide when '
                        'registering for an account, including:',
                      ),
                      const SizedBox(height: 8),
                      _buildBullet('Email address'),
                      _buildBullet('Account credentials (password stored in hashed form)'),
                      _buildBullet('Profile information you choose to add'),
                      const SizedBox(height: 12),
                      _buildSubTitle('2.2 Automatically Collected Information'),
                      _buildParagraph(
                        'When you use the App, we may automatically collect:',
                      ),
                      const SizedBox(height: 8),
                      _buildBullet('Device type, operating system, and unique device identifiers'),
                      _buildBullet('Usage data (features accessed, interactions, timestamps)'),
                      _buildBullet('IP address and approximate location (country/region level)'),
                      _buildBullet('App performance data and crash reports'),
                      const SizedBox(height: 24),

                      _buildSectionTitle('3. How We Use Your Information'),
                      _buildParagraph(
                        'We use the information we collect for the following purposes:',
                      ),
                      const SizedBox(height: 8),
                      _buildNumberedItem('1', 'To create and manage your user account'),
                      _buildNumberedItem('2', 'To authenticate your identity and maintain session security'),
                      _buildNumberedItem('3', 'To provide, maintain, and improve our App\'s features'),
                      _buildNumberedItem('4', 'To communicate with you about updates, security alerts, and support'),
                      _buildNumberedItem('5', 'To detect, prevent, and address technical issues and fraud'),
                      _buildNumberedItem('6', 'To comply with legal obligations and enforce our Terms'),
                      const SizedBox(height: 24),

                      _buildSectionTitle('4. Data Storage & Security'),
                      _buildSubTitle('4.1 Storage'),
                      _buildParagraph(
                        'Your data is stored on secure servers with industry-standard '
                        'encryption. Passwords are cryptographically hashed using '
                        'bcrypt and are never stored in plain text.',
                      ),
                      const SizedBox(height: 12),
                      _buildSubTitle('4.2 Security Measures'),
                      _buildParagraph(
                        'We implement appropriate technical and organizational '
                        'security measures including:',
                      ),
                      const SizedBox(height: 8),
                      _buildBullet('TLS/SSL encryption for data in transit'),
                      _buildBullet('Secure token-based authentication (JWT)'),
                      _buildBullet('Regular security audits and vulnerability assessments'),
                      _buildBullet('Access controls and principle of least privilege'),
                      const SizedBox(height: 12),
                      _buildSubTitle('4.3 Data Breach Notification'),
                      _buildParagraph(
                        'In the event of a data breach that affects your personal '
                        'information, we will notify you within 72 hours of '
                        'becoming aware of the breach, in compliance with '
                        'applicable data protection regulations.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('5. Data Sharing & Disclosure'),
                      _buildParagraph(
                        'We do not sell, trade, or rent your personal information '
                        'to third parties. We may share your information only in '
                        'the following circumstances:',
                      ),
                      const SizedBox(height: 8),
                      _buildBullet('With your explicit consent'),
                      _buildBullet('With service providers who assist us in operating the App (under strict confidentiality agreements)'),
                      _buildBullet('To comply with legal obligations, court orders, or governmental requests'),
                      _buildBullet('To protect the rights, property, or safety of AfroVision and its users'),
                      _buildBullet('In connection with a merger, acquisition, or sale of assets (with prior notice)'),
                      const SizedBox(height: 24),

                      _buildSectionTitle('6. Your Rights'),
                      _buildParagraph(
                        'Depending on your jurisdiction, you may have the '
                        'following rights regarding your personal data:',
                      ),
                      const SizedBox(height: 8),
                      _buildRightItem('Access', 'Request a copy of the personal data we hold about you'),
                      _buildRightItem('Correction', 'Request correction of inaccurate or incomplete data'),
                      _buildRightItem('Deletion', 'Request deletion of your personal data ("Right to be Forgotten")'),
                      _buildRightItem('Portability', 'Request your data in a structured, machine-readable format'),
                      _buildRightItem('Objection', 'Object to processing of your personal data for certain purposes'),
                      _buildRightItem('Restriction', 'Request restriction of processing under certain conditions'),
                      const SizedBox(height: 12),
                      _buildParagraph(
                        'To exercise any of these rights, please contact us using '
                        'the information provided in Section 10.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('7. Cookies & Tracking'),
                      _buildParagraph(
                        'The App may use local storage mechanisms (such as '
                        'SharedPreferences) to store authentication tokens and '
                        'user preferences. These are essential for the App to '
                        'function and cannot be opted out of while using the App.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('8. Children\'s Privacy'),
                      _buildParagraph(
                        'Our App is not intended for children under the age of 13. '
                        'We do not knowingly collect personal information from '
                        'children under 13. If we discover that a child under 13 '
                        'has provided us with personal information, we will '
                        'promptly delete such information from our servers.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('9. Changes to This Policy'),
                      _buildParagraph(
                        'We may update this Privacy Policy from time to time. We '
                        'will notify you of any changes by updating the "Effective '
                        'Date" at the top of this policy. We encourage you to '
                        'review this Privacy Policy periodically to stay informed '
                        'about how we are protecting your data.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('10. Contact Us'),
                      _buildParagraph(
                        'If you have questions, concerns, or requests regarding '
                        'this Privacy Policy or our data practices, please '
                        'contact us at:',
                      ),
                      const SizedBox(height: 10),
                      _buildContactCard(),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _buildDocHeader(String title, String subtitle) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.orange.withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.orange,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: TextStyle(
              color: AppColors.goldText,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  static Widget _buildSectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.lightOrange,
          fontSize: 16,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  static Widget _buildSubTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: TextStyle(
          color: AppColors.white.withValues(alpha: 0.9),
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  static Widget _buildParagraph(String text) {
    return Text(
      text,
      style: TextStyle(
        color: AppColors.white.withValues(alpha: 0.75),
        fontSize: 13.5,
        height: 1.7,
        letterSpacing: 0.15,
      ),
    );
  }

  static Widget _buildBullet(String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Container(
              width: 5,
              height: 5,
              decoration: const BoxDecoration(
                color: AppColors.orange,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.75),
                fontSize: 13.5,
                height: 1.6,
                letterSpacing: 0.15,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _buildNumberedItem(String number, String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  color: AppColors.orange,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                text,
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.75),
                  fontSize: 13.5,
                  height: 1.5,
                  letterSpacing: 0.15,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _buildRightItem(String title, String description) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.shield_outlined,
              color: AppColors.orange, size: 16),
          const SizedBox(width: 12),
          Expanded(
            child: RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: '$title: ',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.9),
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      height: 1.5,
                    ),
                  ),
                  TextSpan(
                    text: description,
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.7),
                      fontSize: 13.5,
                      height: 1.5,
                      letterSpacing: 0.15,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _buildContactCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.business_outlined,
                  color: AppColors.orange, size: 16),
              const SizedBox(width: 10),
              Text(
                'AfroVision',
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.9),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.email_outlined,
                  color: AppColors.orange, size: 16),
              const SizedBox(width: 10),
              const Text(
                'privacy@afrovision.com',
                style: TextStyle(
                  color: AppColors.lightOrange,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.language_outlined,
                  color: AppColors.orange, size: 16),
              const SizedBox(width: 10),
              const Text(
                'afrovision.online',
                style: TextStyle(
                  color: AppColors.lightOrange,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
