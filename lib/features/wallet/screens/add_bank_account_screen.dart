import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../models/bank_details_model.dart';
import '../services/wallet_service.dart';

class AddBankAccountScreen extends StatefulWidget {
  const AddBankAccountScreen({super.key});

  @override
  State<AddBankAccountScreen> createState() => _AddBankAccountScreenState();
}

class _AddBankAccountScreenState extends State<AddBankAccountScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  final _accountNumberCtrl = TextEditingController();
  List<BankOptionModel> _banks = const [];
  BankOptionModel? _selectedBank;
  ResolvedBankAccountModel? _resolvedAccount;
  bool _loading = true;
  bool _resolving = false;
  bool _saving = false;
  String? _error;
  String? _accountError;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _loadBanks();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _accountNumberCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBanks() async {
    try {
      final banks = await WalletService.getSupportedBanks();
      banks.sort((a, b) => a.name.compareTo(b.name));
      if (!mounted) return;
      setState(() {
        _banks = banks;
        _loading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _banks = const [];
      _selectedBank = null;
      _resolvedAccount = null;
      _error = null;
      _loading = true;
    });
    _animCtrl.reset();
    await _loadBanks();
  }

  String get _normalizedAccountNumber =>
      _accountNumberCtrl.text.replaceAll(RegExp(r'\D'), '');

  bool get _canResolve =>
      _selectedBank != null &&
      _normalizedAccountNumber.length == 10 &&
      !_resolving;

  bool get _canSave => _resolvedAccount != null && !_saving;

  Future<void> _resolveAccount() async {
    if (!_canResolve) {
      setState(() {
        _accountError =
            'Select a bank and enter a valid 10-digit account number.';
      });
      return;
    }

    setState(() {
      _resolving = true;
      _accountError = null;
      _resolvedAccount = null;
    });
    try {
      final resolved = await WalletService.resolveBankAccount(
        bankCode: _selectedBank!.code,
        accountNumber: _normalizedAccountNumber,
      );
      if (!mounted) return;
      setState(() {
        _resolvedAccount = resolved;
        _resolving = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _accountError = e.toString();
        _resolving = false;
      });
    }
  }

  Future<void> _saveBankDetails() async {
    if (!_canSave || _selectedBank == null || _resolvedAccount == null) return;
    setState(() => _saving = true);
    try {
      await WalletService.saveBankDetails(
        bankCode: _selectedBank!.code,
        bankName: _selectedBank!.name,
        accountNumber: _resolvedAccount!.accountNumber,
        accountName: _resolvedAccount!.accountName,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _accountError = e.toString();
        _saving = false;
      });
    }
  }

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
              _buildAppBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      )
                    : _error != null
                    ? _buildErrorState()
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: RefreshIndicator(
                            onRefresh: _refresh,
                            color: AppColors.orange,
                            backgroundColor: AppColors.inputFill,
                            child: ListView(
                              padding: const EdgeInsets.all(24),
                              children: [
                                _buildWarningCard(),
                                const SizedBox(height: 16),
                                _buildBankForm(),
                                const SizedBox(height: 16),
                                if (_resolvedAccount != null)
                                  _buildVerifiedCard(),
                                if (_resolvedAccount != null)
                                  const SizedBox(height: 16),
                                AppButton(
                                  label: 'Save Bank Account',
                                  loading: _saving,
                                  enabled: _canSave,
                                  onPressed: _canSave ? _saveBankDetails : null,
                                ),
                                const SizedBox(height: 20),
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
              'Add Bank Account',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 34),
        ],
      ),
    );
  }

  Widget _buildWarningCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.orange),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Important',
            style: TextStyle(
              color: AppColors.orange,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          SizedBox(height: 10),
          Text(
            'Your bank details will be saved permanently after verification and cannot be edited inside the app. If you need to change them later, you must contact AfroVision support by email.',
            style: TextStyle(
              color: AppColors.goldText,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBankForm() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bank Details',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Select Bank',
            style: TextStyle(
              color: AppColors.goldText,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<BankOptionModel>(
                value: _selectedBank,
                isExpanded: true,
                dropdownColor: AppColors.cardBg,
                hint: const Text(
                  'Choose your bank',
                  style: TextStyle(color: AppColors.goldText),
                ),
                items: _banks
                    .map(
                      (bank) => DropdownMenuItem<BankOptionModel>(
                        value: bank,
                        child: Text(
                          bank.name,
                          style: const TextStyle(color: AppColors.white),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (bank) {
                  setState(() {
                    _selectedBank = bank;
                    _resolvedAccount = null;
                    _accountError = null;
                  });
                },
              ),
            ),
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: _accountNumberCtrl,
            label: 'Account Number',
            hint: 'Enter 10-digit account number',
            keyboardType: TextInputType.number,
            prefixIcon: Icons.numbers_rounded,
            errorText: _accountError,
            onChanged: (_) {
              if (_resolvedAccount != null || _accountError != null) {
                setState(() {
                  _resolvedAccount = null;
                  _accountError = null;
                });
              }
            },
          ),
          const SizedBox(height: 14),
          AppButton(
            label: 'Verify Account Name',
            loading: _resolving,
            enabled: _canResolve,
            onPressed: _canResolve ? _resolveAccount : null,
          ),
        ],
      ),
    );
  }

  Widget _buildVerifiedCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.successGreen),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Verified Account',
            style: TextStyle(
              color: AppColors.successGreen,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          _infoRow('Bank', _selectedBank?.name ?? ''),
          const SizedBox(height: 10),
          _infoRow('Account Name', _resolvedAccount?.accountName ?? ''),
          const SizedBox(height: 10),
          _infoRow('Account Number', _resolvedAccount?.accountNumber ?? ''),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
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

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed,
              size: 44,
            ),
            const SizedBox(height: 12),
            Text(
              _error ?? 'Failed to load bank list',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.goldText,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),
            AppButton(label: 'Retry', onPressed: _loadBanks),
          ],
        ),
      ),
    );
  }
}
