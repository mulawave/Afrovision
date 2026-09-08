import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../utils/wallet_format.dart';

class WithdrawalSuccessModal extends StatefulWidget {
  final double requestedAmount;
  final double withdrawalFee;
  final double vatAmount;
  final double totalDebit;
  final String bankName;
  final VoidCallback onClose;

  const WithdrawalSuccessModal({
    super.key,
    required this.requestedAmount,
    required this.withdrawalFee,
    required this.vatAmount,
    required this.totalDebit,
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
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Nocturne.borderCard),
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
          FadeTransition(
            opacity: _checkFade,
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Nocturne.green.withValues(alpha: 0.12),
                border: Border.all(
                  color: Nocturne.green.withValues(alpha: 0.35),
                  width: 2,
                ),
              ),
              child: const Icon(
                Icons.check_rounded,
                color: Nocturne.green,
                size: 38,
              ),
            ),
          ),
          const SizedBox(height: 18),
          FadeTransition(
            opacity: _contentFade,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Withdrawal Request Submitted',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Nocturne.text,
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.01,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '₦${walletFormatAmount(widget.requestedAmount)}',
                  style: const TextStyle(
                    color: Nocturne.green,
                    fontSize: 26,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.02,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Nocturne.bg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Nocturne.borderCard),
                  ),
                  child: Column(
                    children: [
                      _feeRow(
                        'Requested amount',
                        '₦${walletFormatAmount(widget.requestedAmount)}',
                        Nocturne.text,
                      ),
                      const SizedBox(height: 8),
                      _feeRow(
                        'Withdrawal fee',
                        '₦${walletFormatAmount(widget.withdrawalFee)}',
                        Nocturne.textFaint,
                      ),
                      const SizedBox(height: 6),
                      _feeRow(
                        'VAT (7.5%)',
                        '₦${walletFormatAmount(widget.vatAmount)}',
                        Nocturne.textFaint,
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 10),
                        child: Divider(color: Nocturne.borderCard, height: 1),
                      ),
                      _feeRow(
                        'Total debited',
                        '₦${walletFormatAmount(widget.totalDebit)}',
                        Nocturne.gold,
                        bold: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _infoRow(Icons.account_balance_rounded, widget.bankName),
                const SizedBox(height: 6),
                _infoRow(Icons.schedule_rounded, 'Processing within 24 hours'),
                const SizedBox(height: 18),
                GestureDetector(
                  onTap: widget.onClose,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: Nocturne.goldCta,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Nocturne.gold.withValues(alpha: 0.30),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Done',
                      style: TextStyle(
                        color: Color(0xFF26170A),
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
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
            color: Nocturne.textFaint,
            fontSize: 12,
            fontWeight: bold ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, color: Nocturne.textFaint, size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
