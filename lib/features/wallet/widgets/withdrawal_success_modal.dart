import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class WithdrawalSuccessModal extends StatefulWidget {
  final double amount;
  final double totalDebit;
  final double transactionFee;
  final double serviceCharge;
  final double vatAmount;
  final String bankName;
  final VoidCallback onClose;

  const WithdrawalSuccessModal({
    super.key,
    required this.amount,
    required this.totalDebit,
    required this.transactionFee,
    required this.serviceCharge,
    required this.vatAmount,
    required this.bankName,
    required this.onClose,
  });

  @override
  State<WithdrawalSuccessModal> createState() => _WithdrawalSuccessModalState();
}

class _WithdrawalSuccessModalState extends State<WithdrawalSuccessModal>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;
  late Animation<double> _checkFade;
  late Animation<double> _contentFade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _scaleAnim = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.0, 0.35, curve: Curves.easeOutBack),
      ),
    );
    _fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.0, 0.25, curve: Curves.easeOut),
      ),
    );
    _checkFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.35, 0.6, curve: Curves.easeOut),
      ),
    );
    _contentFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.55, 0.85, curve: Curves.easeOut),
      ),
    );

    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  String _fmt(double val) {
    if (val == val.roundToDouble()) return val.toInt().toString();
    return val.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        return Container(
          color: Colors.black.withValues(alpha: _fadeAnim.value * 0.6),
          child: Center(
            child: Transform.scale(
              scale: _scaleAnim.value,
              child: Opacity(opacity: _fadeAnim.value, child: _buildModal()),
            ),
          ),
        );
      },
    );
  }

  Widget _buildModal() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 28),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: AppColors.successGreen.withValues(alpha: 0.25),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 32,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Animated checkmark circle
          FadeTransition(
            opacity: _checkFade,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.successGreen.withValues(alpha: 0.12),
                border: Border.all(
                  color: AppColors.successGreen.withValues(alpha: 0.3),
                  width: 2,
                ),
              ),
              child: const Icon(
                Icons.check_rounded,
                color: AppColors.successGreen,
                size: 40,
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Content with fade
          FadeTransition(
            opacity: _contentFade,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Withdrawal Request Submitted',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '₦${_fmt(widget.amount)}',
                  style: const TextStyle(
                    color: AppColors.successGreen,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 16),

                // Fee breakdown card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: Column(
                    children: [
                      _feeRow(
                        'You will receive',
                        '₦${_fmt(widget.amount)}',
                        AppColors.successGreen,
                      ),
                      const SizedBox(height: 8),
                      _feeRow(
                        'Transaction fee',
                        '₦${_fmt(widget.transactionFee)}',
                        AppColors.goldText,
                      ),
                      const SizedBox(height: 6),
                      _feeRow(
                        'Service charge',
                        '₦${_fmt(widget.serviceCharge)}',
                        AppColors.goldText,
                      ),
                      const SizedBox(height: 6),
                      _feeRow(
                        'VAT (7.5%)',
                        '₦${_fmt(widget.vatAmount)}',
                        AppColors.goldText,
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Divider(color: AppColors.inputBorder, height: 1),
                      ),
                      _feeRow(
                        'Total debited',
                        '₦${_fmt(widget.totalDebit)}',
                        AppColors.orange,
                        bold: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Info rows
                _infoRow(Icons.account_balance_rounded, widget.bankName),
                const SizedBox(height: 8),
                _infoRow(Icons.schedule_rounded, 'Processing within 24 hours'),
                const SizedBox(height: 20),

                // Close button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: widget.onClose,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.orange,
                      foregroundColor: AppColors.darkBlue,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Done',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _feeRow(
    String label,
    String value,
    Color valueColor, {
    bool bold = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.goldText,
            fontSize: 12,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, color: AppColors.goldText, size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: AppColors.goldText,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
