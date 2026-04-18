import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../models/bank_details_model.dart';
import '../services/wallet_service.dart';
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
      ((_totalFees * _vatRate * 100).round() / 100); // 7.50
  static final double _totalCharges = _totalFees + _vatAmount; // 107.50

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  final _amountCtrl = TextEditingController();

  List<dynamic> _withdrawals = [];
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
      begin: const Offset(0, 0.15),
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
        _withdrawals = results[0] as List<dynamic>;
        _wallet = results[1] as Map<String, dynamic>;
        _bankDetails = results[2] as BankDetailsModel?;
        _loading = false;
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

  Future<void> _goToAddBankAccount() async {
    final saved = await Navigator.pushNamed(context, '/add-bank-account');
    if (!mounted) return;
    if (saved == true) {
      _showSnack('Bank account saved successfully.', isSuccess: true);
      setState(() => _loading = true);
      await _loadData();
    }
  }

  Future<void> _submitRequest() async {
    if (_bankDetails == null) {
      _showSnack('Add and verify your bank account before withdrawing.');
      return;
    }

    final amount = double.tryParse(_amountCtrl.text.trim());
    if (amount == null || amount <= 0) {
      _showSnack('Enter a valid amount.');
      return;
    }
    if (amount < 100) {
      _showSnack('Minimum withdrawal is ₦100.');
      return;
    }
    if (amount + _totalCharges > _ngnBalance) {
      _showSnack(
        'Insufficient balance. You need ₦${_formatAmount(amount + _totalCharges)} '
        '(₦${_formatAmount(amount)} + ₦${_formatAmount(_totalFees)} fees + ₦${_formatAmount(_vatAmount)} VAT) '
        'but you only have ₦${_formatAmount(_ngnBalance)}.',
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
      // Reload data in background
      _loadData();
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showSnack(e.toString());
    }
  }

  void _showSnack(String msg, {bool isSuccess = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(color: AppColors.white)),
        backgroundColor: isSuccess
            ? AppColors.successGreen
            : AppColors.errorRed.withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Container(
            width: double.infinity,
            height: double.infinity,
            decoration: const BoxDecoration(
              gradient: AppColors.primaryGradient,
            ),
            child: SafeArea(
              child: Column(
                children: [
                  _buildAppBar(),
                  Expanded(
                    child: _loading
                        ? const Center(
                            child: CircularProgressIndicator(
                              color: AppColors.orange,
                              strokeWidth: 2,
                            ),
                          )
                        : _error != null
                        ? _buildError()
                        : FadeTransition(
                            opacity: _fadeIn,
                            child: SlideTransition(
                              position: _slideUp,
                              child: RefreshIndicator(
                                onRefresh: _loadData,
                                color: AppColors.orange,
                                child: ListView(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 24,
                                  ),
                                  children: [
                                    const SizedBox(height: 8),
                                    _buildBankDetailsCard(),
                                    const SizedBox(height: 16),
                                    _buildRequestCard(),
                                    const SizedBox(height: 20),
                                    _buildHistoryButton(),
                                    const SizedBox(height: 32),
                                  ],
                                ),
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
          if (_showSuccessModal)
            WithdrawalSuccessModal(
              amount: _successAmount,
              totalDebit: _successAmount + _totalCharges,
              transactionFee: _transactionFee,
              serviceCharge: _serviceCharge,
              vatAmount: _vatAmount,
              bankName: _bankDetails?.bankName ?? 'Your bank',
              onClose: () => setState(() => _showSuccessModal = false),
            ),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const Expanded(
            child: Text(
              'Withdrawals',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 34),
        ],
      ),
    );
  }

  Widget _buildBankDetailsCard() {
    final bank = _bankDetails;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: bank == null ? AppColors.orange : AppColors.inputBorder,
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
                  color: AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.account_balance_rounded,
                  color: AppColors.orange,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Withdrawal Bank Account',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              // Verified badge — shown when bank is saved
              if (bank != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.successGreen.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.successGreen.withValues(alpha: 0.30),
                    ),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.successGreen,
                        size: 13,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'VERIFIED',
                        style: TextStyle(
                          color: AppColors.successGreen,
                          fontSize: 10,
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
          if (bank == null) ...[
            const Text(
              'You must add and verify your bank account with Paystack before you can submit any withdrawal request.',
              style: TextStyle(
                color: AppColors.goldText,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 14),
            AppButton(
              label: 'Add Bank Account',
              onPressed: _goToAddBankAccount,
            ),
          ] else ...[
            _bankInfoRow('Bank', bank.bankName),
            const SizedBox(height: 10),
            _bankInfoRow('Account Name', bank.accountName),
            const SizedBox(height: 10),
            _bankInfoRow('Account Number', bank.accountNumberMasked),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Text(
                'This verified bank account is locked after saving and cannot be edited inside the app.',
                style: TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _bankInfoRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.goldText,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _buildRequestCard() {
    final parsedAmount = double.tryParse(_amountCtrl.text.trim()) ?? 0;
    final showBreakdown = parsedAmount > 0;
    final totalDebit = parsedAmount + _totalCharges;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Request Withdrawal',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Available balance: ₦${_formatAmount(_ngnBalance)}',
            style: const TextStyle(
              color: AppColors.goldText,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          AppTextField(
            controller: _amountCtrl,
            label: 'Withdrawal Amount',
            hint: 'Enter amount in naira',
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            prefixIcon: Icons.payments_rounded,
            onChanged: (_) => setState(() {}),
          ),
          if (showBreakdown) ...[
            const SizedBox(height: 14),
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
                  _chargeRow(
                    'You will receive',
                    '₦${_formatAmount(parsedAmount)}',
                    AppColors.successGreen,
                  ),
                  const SizedBox(height: 8),
                  _chargeRow(
                    'Transaction fee',
                    '₦${_formatAmount(_transactionFee)}',
                    AppColors.goldText,
                  ),
                  const SizedBox(height: 6),
                  _chargeRow(
                    'Service charge',
                    '₦${_formatAmount(_serviceCharge)}',
                    AppColors.goldText,
                  ),
                  const SizedBox(height: 6),
                  _chargeRow(
                    'VAT (7.5%)',
                    '₦${_formatAmount(_vatAmount)}',
                    AppColors.goldText,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Divider(color: AppColors.inputBorder, height: 1),
                  ),
                  _chargeRow(
                    'Total to be debited',
                    '₦${_formatAmount(totalDebit)}',
                    AppColors.orange,
                    bold: true,
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          if (_bankDetails == null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.orange),
              ),
              child: const Text(
                'Withdrawal is locked until you add a verified bank account above.',
                style: TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          if (_bankDetails == null) const SizedBox(height: 14),
          AppButton(
            label: 'Submit Request',
            loading: _submitting,
            enabled: _bankDetails != null,
            onPressed: _bankDetails != null ? _submitRequest : null,
          ),
        ],
      ),
    );
  }

  Widget _chargeRow(
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

  Widget _buildHistoryButton() {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/withdrawal-history'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.inputBorder),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.lightOrange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.receipt_long_rounded,
                color: AppColors.lightOrange,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Withdrawal History',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _withdrawalCount > 0
                        ? '$_withdrawalCount request${_withdrawalCount == 1 ? '' : 's'}'
                        : 'No requests yet',
                    style: const TextStyle(
                      color: AppColors.goldText,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              color: AppColors.goldText,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed,
              size: 48,
            ),
            const SizedBox(height: 16),
            const Text(
              'Failed to load withdrawals',
              style: TextStyle(
                color: AppColors.goldText,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 16),
            AppButton(
              label: 'Retry',
              onPressed: () {
                setState(() {
                  _loading = true;
                  _error = null;
                });
                _loadData();
              },
            ),
          ],
        ),
      ),
    );
  }

  String _formatAmount(double val) {
    if (val == 0) return '0';
    if (val == val.roundToDouble()) return val.toInt().toString();
    return val.toStringAsFixed(2);
  }
}
