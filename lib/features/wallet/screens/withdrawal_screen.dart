import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/bank_details_model.dart';
import '../models/withdrawal_model.dart';
import '../services/wallet_service.dart';
import '../utils/wallet_format.dart';
import '../widgets/assets_header.dart';
import '../widgets/wallet_toast.dart';
import '../widgets/withdrawal_success_modal.dart';

class WithdrawalScreen extends StatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  State<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends State<WithdrawalScreen>
    with SingleTickerProviderStateMixin {
  static const double _transactionFee = 50;
  static const double _serviceCharge = 50;
  static const double _totalFees = _transactionFee + _serviceCharge;
  static const double _vatRate = 0.075;
  static final double _vatAmount =
      ((_totalFees * _vatRate * 100).round() / 100);
  static final double _totalCharges = _totalFees + _vatAmount;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  final _amountCtrl = TextEditingController();

  List<WithdrawalModel> _withdrawals = [];
  Map<String, dynamic> _wallet = {};
  BankDetailsModel? _bankDetails;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  bool _showSuccessModal = false;
  double _successAmount = 0;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _loadData();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait<dynamic>([
        WalletService.getMyWithdrawals(),
        WalletService.getGiftWalletBalance(),
        WalletService.getMyBankDetails(),
      ]);
      if (!mounted) return;
      setState(() {
        _withdrawals = results[0] as List<WithdrawalModel>;
        _wallet = results[1] as Map<String, dynamic>;
        _bankDetails = results[2] as BankDetailsModel?;
        _loading = false;
        _error = null;
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  double get _ngnBalance {
    final v = _wallet['cash'];
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  int get _withdrawalCount => _withdrawals.length;

  double get _amount => double.tryParse(_amountCtrl.text.trim()) ?? 0;

  bool get _canSubmit {
    final amount = _amount;
    return _bankDetails != null &&
        amount > 0 &&
        amount >= 100 &&
        amount + _totalCharges <= _ngnBalance &&
        !_submitting;
  }

  Future<void> _goToAddBankAccount() async {
    if (!await KycGuard.ensureKycVerified(context)) return;
    final saved = await Navigator.pushNamed(context, '/add-bank-account');
    if (!mounted) return;
    if (saved == true) {
      WalletToast.show(context, 'Bank account saved successfully.');
      setState(() => _loading = true);
      await _loadData();
    }
  }

  Future<void> _submitRequest() async {
    if (!await KycGuard.ensureKycVerified(context)) return;
    if (_bankDetails == null) {
      WalletToast.show(context, 'Add and verify your bank account before withdrawing.');
      return;
    }

    final amount = _amount;
    if (amount <= 0) {
      WalletToast.show(context, 'Enter a valid amount.');
      return;
    }
    if (amount < 100) {
      WalletToast.show(context, 'Minimum withdrawal is ₦100.');
      return;
    }
    if (amount + _totalCharges > _ngnBalance) {
      WalletToast.show(
        context,
        'Insufficient balance. You need ₦${walletFormatAmount(amount + _totalCharges)} '
        '(₦${walletFormatAmount(amount)} + ₦${walletFormatAmount(_totalFees)} fees + ₦${walletFormatAmount(_vatAmount)} VAT) '
        'but you only have ₦${walletFormatAmount(_ngnBalance)}.',
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await WalletService.requestWithdrawal(amount);
      if (!mounted) return;
      _amountCtrl.clear();
      setState(() {
        _submitting = false;
        _successAmount = amount;
        _showSuccessModal = true;
      });
      _loadData();
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      WalletToast.show(context, e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: Stack(
        children: [
          SafeArea(
            top: false,
            child: Column(
              children: [
                const AssetsHeader(
                  title: 'Withdraw',
                  subtitle: 'Cash to bank',
                ),
                Expanded(
                  child: _loading
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: Nocturne.gold,
                            strokeWidth: 3,
                          ),
                        )
                      : _error != null
                      ? _buildErrorState()
                      : FadeTransition(
                          opacity: _fadeIn,
                          child: SlideTransition(
                            position: _slideUp,
                            child: RefreshIndicator(
                              onRefresh: _loadData,
                              color: Nocturne.gold,
                              backgroundColor: Nocturne.surfaceRaised,
                              child: ListView(
                                padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                                children: [
                                  _buildBankCard(),
                                  const SizedBox(height: 14),
                                  _buildRequestCard(),
                                  const SizedBox(height: 16),
                                  _buildHistoryCard(),
                                  const SizedBox(height: 24),
                                ],
                              ),
                            ),
                          ),
                        ),
                ),
              ],
            ),
          ),
          if (_showSuccessModal)
            WithdrawalSuccessModal(
              requestedAmount: _successAmount,
              withdrawalFee: _totalFees,
              vatAmount: _vatAmount,
              totalDebit: _successAmount + _totalCharges,
              bankName: _bankDetails?.bankName ?? 'Your bank',
              onClose: () => setState(() => _showSuccessModal = false),
            ),
        ],
      ),
    );
  }

  Widget _buildBankCard() {
    final bank = _bankDetails;
    final verified = bank != null;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: verified ? Nocturne.borderCard : Nocturne.gold.withValues(alpha: 0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Nocturne.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Nocturne.gold.withValues(alpha: 0.25)),
                ),
                child: const Icon(
                  Icons.account_balance_rounded,
                  color: Nocturne.goldLight,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Withdrawal Bank Account',
                  style: TextStyle(
                    color: Nocturne.text,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (verified)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: Nocturne.green.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Nocturne.green.withValues(alpha: 0.32),
                    ),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_rounded, color: Nocturne.green, size: 12),
                      SizedBox(width: 4),
                      Text(
                        'VERIFIED',
                        style: TextStyle(
                          color: Nocturne.green,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          if (!verified) ...[
            const Text(
              'You must add and verify your bank account with Paystack before you can submit any withdrawal request.',
              style: TextStyle(
                color: Nocturne.textFaint,
                fontSize: 12,
                fontWeight: FontWeight.w500,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 14),
            GestureDetector(
              onTap: _goToAddBankAccount,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0x05FFFFFF),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: Nocturne.gold.withValues(alpha: 0.45)),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'Add Bank Account',
                  style: TextStyle(
                    color: Nocturne.goldLight,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ] else ...[
            Row(
              children: [
                Expanded(child: _buildBankDetailTile('Bank', bank.bankName)),
                const SizedBox(width: 10),
                Expanded(child: _buildBankDetailTile('Account no.', bank.accountNumberMasked)),
                const SizedBox(width: 10),
                Expanded(child: _buildBankDetailTile('Name', bank.accountName)),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0x05FFFFFF),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: Nocturne.borderCard),
              ),
              child: const Text(
                'A verified bank account is locked after saving and cannot be edited inside the app.',
                style: TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBankDetailTile(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: const Color(0x05FFFFFF),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildRequestCard() {
    final amount = _amount;
    final showBreakdown = amount > 0;
    final totalDebit = amount + _totalCharges;
    final insufficient = amount > 0 && amount + _totalCharges > _ngnBalance;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Request Withdrawal',
                style: TextStyle(
                  color: Nocturne.text,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '₦${walletFormatAmount(_ngnBalance)} available',
                style: const TextStyle(
                  color: Nocturne.gold,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
            decoration: BoxDecoration(
              color: Nocturne.surfaceDeep,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(
                color: insufficient
                    ? Nocturne.red.withValues(alpha: 0.55)
                    : Nocturne.borderCard,
              ),
            ),
            child: Row(
              children: [
                const Text(
                  '₦',
                  style: TextStyle(
                    color: Nocturne.goldLight,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                    ],
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                      border: InputBorder.none,
                      hintText: '0.00',
                      hintStyle: TextStyle(
                        color: Nocturne.textHint,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
          ),
          if (insufficient) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Nocturne.redSoft, size: 13),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Insufficient balance. Total debit will be ₦${walletFormatAmount(totalDebit)}.',
                    style: const TextStyle(
                      color: Nocturne.redSoft,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (showBreakdown) ...[
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
                  _breakdownRow(
                    'Requested amount',
                    '₦${walletFormatAmount(amount)}',
                    Nocturne.text,
                  ),
                  const SizedBox(height: 8),
                  _breakdownRow(
                    'Withdrawal fee',
                    '₦${walletFormatAmount(_totalFees)}',
                    Nocturne.textFaint,
                  ),
                  const SizedBox(height: 6),
                  _breakdownRow(
                    'VAT (7.5%)',
                    '₦${walletFormatAmount(_vatAmount)}',
                    Nocturne.textFaint,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 10),
                    child: Divider(color: Nocturne.borderCard, height: 1),
                  ),
                  _breakdownRow(
                    'Total debited',
                    '₦${walletFormatAmount(totalDebit)}',
                    Nocturne.gold,
                    bold: true,
                  ),
                ],
              ),
            ),
          ],
          if (_bankDetails == null) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Nocturne.gold.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Nocturne.gold.withValues(alpha: 0.25)),
              ),
              child: const Text(
                'Withdrawal is locked until you add a verified bank account above.',
                style: TextStyle(
                  color: Nocturne.goldLight,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _canSubmit ? () => _submitRequest() : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 15),
              decoration: BoxDecoration(
                gradient: _canSubmit ? Nocturne.goldCta : null,
                color: _canSubmit ? null : const Color(0x05FFFFFF),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                  color: _canSubmit ? Colors.transparent : Nocturne.border,
                ),
                boxShadow: _canSubmit
                    ? [
                        BoxShadow(
                          color: Nocturne.gold.withValues(alpha: 0.30),
                          blurRadius: 22,
                          offset: const Offset(0, 8),
                        ),
                      ]
                    : [],
              ),
              alignment: Alignment.center,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: Color(0xFF26170A),
                        strokeWidth: 2.5,
                      ),
                    )
                  : Text(
                      'Submit Request',
                      style: TextStyle(
                        color: _canSubmit ? const Color(0xFF26170A) : Nocturne.textHint,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _breakdownRow(
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

  Widget _buildHistoryCard() {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/withdrawal-history'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Nocturne.borderCard),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Nocturne.gold.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(11),
              ),
              child: const Icon(
                Icons.receipt_long_rounded,
                color: Nocturne.goldLight,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Withdrawal History',
                    style: TextStyle(
                      color: Nocturne.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _withdrawalCount > 0
                        ? '$_withdrawalCount request${_withdrawalCount == 1 ? '' : 's'}'
                        : 'No requests yet',
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              color: Nocturne.textFaint,
              size: 14,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: Nocturne.red,
              size: 48,
            ),
            const SizedBox(height: 16),
            const Text(
              'Failed to load withdrawals',
              style: TextStyle(
                color: Nocturne.text,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 20),
            GestureDetector(
              onTap: () {
                setState(() {
                  _loading = true;
                  _error = null;
                });
                _loadData();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
                decoration: BoxDecoration(
                  gradient: Nocturne.goldCta,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    color: Color(0xFF26170A),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
