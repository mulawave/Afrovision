import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

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
                        'Terms of Service',
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
                        'AfroVision Terms of Service',
                        'Last Updated: March 26, 2026',
                      ),
                      const SizedBox(height: 28),

                      _buildSectionTitle('1. Acceptance of Terms'),
                      _buildParagraph(
                        'By accessing or using the AfroVision mobile application '
                        '("App"), you agree to be bound by these Terms of Service '
                        '("Terms"). If you do not agree to all of these Terms, you '
                        'may not access or use the App. These Terms constitute a '
                        'legally binding agreement between you and AfroVision '
                        '("Company", "we", "us", or "our").',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('2. Eligibility'),
                      _buildParagraph(
                        'You must be at least 13 years of age to use this App. '
                        'By using the App, you represent and warrant that you meet '
                        'this age requirement. If you are under 18, you represent '
                        'that your parent or legal guardian has reviewed and agreed '
                        'to these Terms on your behalf.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('3. User Accounts'),
                      _buildSubTitle('3.1 Registration'),
                      _buildParagraph(
                        'To access certain features, you must register for an '
                        'account by providing accurate, current, and complete '
                        'information. You are responsible for maintaining the '
                        'confidentiality of your login credentials and for all '
                        'activities that occur under your account.',
                      ),
                      const SizedBox(height: 12),
                      _buildSubTitle('3.2 Account Security'),
                      _buildParagraph(
                        'You agree to immediately notify us of any unauthorized '
                        'use of your account or any other security breach. We '
                        'will not be liable for any loss or damage arising from '
                        'your failure to protect your account credentials.',
                      ),
                      const SizedBox(height: 12),
                      _buildSubTitle('3.3 Account Termination'),
                      _buildParagraph(
                        'We reserve the right to suspend or terminate your account '
                        'at our sole discretion, without prior notice, for conduct '
                        'that we determine violates these Terms, is harmful to '
                        'other users, or is otherwise objectionable.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('4. Acceptable Use'),
                      _buildParagraph(
                        'You agree not to use the App to:',
                      ),
                      const SizedBox(height: 8),
                      _buildBullet('Violate any applicable law, regulation, or third-party rights'),
                      _buildBullet('Upload or transmit viruses, malware, or other malicious code'),
                      _buildBullet('Attempt to gain unauthorized access to any part of the App'),
                      _buildBullet('Interfere with or disrupt the App\'s infrastructure'),
                      _buildBullet('Engage in any activity that imposes an unreasonable load on our systems'),
                      _buildBullet('Collect or harvest any information from other users without consent'),
                      const SizedBox(height: 24),

                      _buildSectionTitle('5. Intellectual Property'),
                      _buildSubTitle('5.1 Our Content'),
                      _buildParagraph(
                        'The App and its original content, features, and '
                        'functionality are owned by AfroVision and are protected '
                        'by international copyright, trademark, patent, trade '
                        'secret, and other intellectual property laws.',
                      ),
                      const SizedBox(height: 12),
                      _buildSubTitle('5.2 Your Content'),
                      _buildParagraph(
                        'You retain ownership of content you submit through the '
                        'App. By submitting content, you grant us a worldwide, '
                        'non-exclusive, royalty-free license to use, reproduce, '
                        'modify, and distribute such content solely for the '
                        'purpose of operating and improving the App.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('6. Disclaimers'),
                      _buildParagraph(
                        'THE APP IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" '
                        'BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR '
                        'IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES '
                        'OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND '
                        'NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE '
                        'UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('7. Limitation of Liability'),
                      _buildParagraph(
                        'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, '
                        'AFROVISION SHALL NOT BE LIABLE FOR ANY INDIRECT, '
                        'INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, '
                        'INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR '
                        'GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE '
                        'OF THE APP.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('8. Indemnification'),
                      _buildParagraph(
                        'You agree to indemnify, defend, and hold harmless '
                        'AfroVision and its officers, directors, employees, and '
                        'agents from any claims, liabilities, damages, losses, and '
                        'expenses arising from your use of the App or your '
                        'violation of these Terms.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('9. Modifications to Terms'),
                      _buildParagraph(
                        'We reserve the right to modify these Terms at any time. '
                        'We will provide notice of material changes by updating '
                        'the "Last Updated" date at the top of these Terms. Your '
                        'continued use of the App after such modifications '
                        'constitutes your acceptance of the revised Terms.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('10. Governing Law'),
                      _buildParagraph(
                        'These Terms shall be governed by and construed in '
                        'accordance with the laws of the jurisdiction in which '
                        'AfroVision is incorporated, without regard to conflict '
                        'of law principles.',
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('11. Contact Us'),
                      _buildParagraph(
                        'If you have questions about these Terms of Service, '
                        'please contact us at:',
                      ),
                      const SizedBox(height: 10),
                      _buildContactInfo('support@afrovision.com'),
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

  static Widget _buildContactInfo(String email) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.email_outlined, color: AppColors.orange, size: 18),
          const SizedBox(width: 12),
          Text(
            email,
            style: const TextStyle(
              color: AppColors.lightOrange,
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
