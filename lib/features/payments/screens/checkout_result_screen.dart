import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

class CheckoutResultScreen extends StatelessWidget {
  const CheckoutResultScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;
    final data = args is Map<String, dynamic> ? args : <String, dynamic>{};

    final status = (data['status'] as String? ?? 'unknown').toLowerCase();
    final title = _titleForStatus(status);
    final message =
        (data['message'] as String?) ?? _defaultMessageForStatus(status);
    final paymentId = data['paymentId'] as String?;
    final purpose = data['purpose'] as String? ?? 'wallet_topup';

    final theme = _themeForStatus(status);

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: Column(
              children: [
                Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context, {'action': 'close'}),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.inputBorder),
                        ),
                        child: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          color: AppColors.white,
                          size: 18,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Checkout Result',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: theme.border),
                  ),
                  child: Column(
                    children: [
                      Icon(theme.icon, color: theme.color, size: 54),
                      const SizedBox(height: 14),
                      Text(
                        title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        message,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.hintText,
                          fontSize: 14,
                          height: 1.45,
                        ),
                      ),
                      if (paymentId != null && paymentId.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Reference: $paymentId',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.goldText,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                _buildDetailsCard(purpose),
                const Spacer(),
                ..._buildActions(context, status),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailsCard(String purpose) {
    final purposeText = purpose == 'platform_plan'
        ? 'Platform plan subscription checkout'
        : 'Wallet top-up checkout';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'DETAILS',
            style: TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            purposeText,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildActions(BuildContext context, String status) {
    switch (status) {
      case 'success':
        return [
          _primaryButton(
            context,
            label: 'Continue',
            onTap: () => Navigator.pop(context, {'action': 'done'}),
          ),
        ];
      case 'failed':
        return [
          _primaryButton(
            context,
            label: 'Retry Checkout',
            onTap: () => Navigator.pop(context, {'action': 'retry_checkout'}),
          ),
          const SizedBox(height: 12),
          _secondaryButton(
            context,
            label: 'Verify Again',
            onTap: () => Navigator.pop(context, {'action': 'retry_verify'}),
          ),
        ];
      case 'canceled':
        return [
          _primaryButton(
            context,
            label: 'Restart Checkout',
            onTap: () => Navigator.pop(context, {'action': 'retry_checkout'}),
          ),
          const SizedBox(height: 12),
          _secondaryButton(
            context,
            label: 'Close',
            onTap: () => Navigator.pop(context, {'action': 'close'}),
          ),
        ];
      case 'pending':
        return [
          _primaryButton(
            context,
            label: 'Verify Again',
            onTap: () => Navigator.pop(context, {'action': 'retry_verify'}),
          ),
          const SizedBox(height: 12),
          _secondaryButton(
            context,
            label: 'Open Checkout Again',
            onTap: () => Navigator.pop(context, {'action': 'reopen_checkout'}),
          ),
        ];
      default:
        return [
          _primaryButton(
            context,
            label: 'Verify Again',
            onTap: () => Navigator.pop(context, {'action': 'retry_verify'}),
          ),
          const SizedBox(height: 12),
          _secondaryButton(
            context,
            label: 'Close',
            onTap: () => Navigator.pop(context, {'action': 'close'}),
          ),
        ];
    }
  }

  Widget _primaryButton(
    BuildContext context, {
    required String label,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.orange,
          foregroundColor: AppColors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _secondaryButton(
    BuildContext context, {
    required String label,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.lightOrange,
          side: BorderSide(color: AppColors.lightOrange.withValues(alpha: 0.4)),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  String _titleForStatus(String status) {
    switch (status) {
      case 'success':
        return 'Payment Successful';
      case 'failed':
        return 'Payment Failed';
      case 'canceled':
        return 'Checkout Canceled';
      case 'pending':
        return 'Payment Pending';
      default:
        return 'Payment Status Unknown';
    }
  }

  String _defaultMessageForStatus(String status) {
    switch (status) {
      case 'success':
        return 'Your payment was verified and applied successfully.';
      case 'failed':
        return 'The gateway reported a failed payment. You can retry checkout or verify again.';
      case 'canceled':
        return 'You canceled checkout before payment was completed.';
      case 'pending':
        return 'Your payment is not completed yet. Verify again after finishing at the gateway.';
      default:
        return 'We could not determine the payment outcome yet. Please verify again.';
    }
  }

  _ResultTheme _themeForStatus(String status) {
    switch (status) {
      case 'success':
        return _ResultTheme(
          color: AppColors.successGreen,
          border: AppColors.successGreen.withValues(alpha: 0.35),
          icon: Icons.check_circle_rounded,
        );
      case 'failed':
        return _ResultTheme(
          color: AppColors.errorRed,
          border: AppColors.errorRed.withValues(alpha: 0.35),
          icon: Icons.cancel_rounded,
        );
      case 'canceled':
        return _ResultTheme(
          color: AppColors.lightOrange,
          border: AppColors.lightOrange.withValues(alpha: 0.35),
          icon: Icons.remove_circle_outline_rounded,
        );
      case 'pending':
        return _ResultTheme(
          color: AppColors.orange,
          border: AppColors.orange.withValues(alpha: 0.35),
          icon: Icons.hourglass_top_rounded,
        );
      default:
        return _ResultTheme(
          color: AppColors.infoBlue,
          border: AppColors.infoBlue.withValues(alpha: 0.35),
          icon: Icons.help_outline_rounded,
        );
    }
  }
}

class _ResultTheme {
  final Color color;
  final Color border;
  final IconData icon;

  const _ResultTheme({
    required this.color,
    required this.border,
    required this.icon,
  });
}
