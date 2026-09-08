import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/bank_details_model.dart';
import '../services/wallet_service.dart';
import '../widgets/assets_header.dart';

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
        _accountError = e.toString().replaceFirst('Exception: ', '');
        _resolving = false;
      });
    }
  }

  Future<void> _saveBankDetails() async {
    if (!await KycGuard.ensureKycVerified(context)) return;
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
        _accountError = e.toString().replaceFirst('Exception: ', '');
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            const AssetsHeader(
              title: 'Add Bank',
              subtitle: 'Link a withdrawal account',
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
                          onRefresh: _refresh,
                          color: Nocturne.gold,
                          backgroundColor: Nocturne.surfaceRaised,
                          child: ListView(
                            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                            children: [
                              _buildWarningCard(),
                              const SizedBox(height: 14),
                              _buildBankForm(),
                              if (_resolvedAccount != null) ...[
                                const SizedBox(height: 14),
                                _buildVerifiedCard(),
                              ],
                              const SizedBox(height: 16),
                              _buildSaveButton(),
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
    );
  }

  Widget _buildWarningCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.gold.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.gold.withValues(alpha: 0.30)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Important',
            style: TextStyle(
              color: Nocturne.gold,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Your bank details will be saved permanently after verification and cannot be edited inside the app. If you need to change them later, you must contact AfroVision support.',
            style: TextStyle(
              color: Nocturne.goldLight,
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBankForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bank Details',
            style: TextStyle(
              color: Nocturne.text,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Select Bank',
            style: TextStyle(
              color: Nocturne.goldSoft,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 7),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
            decoration: BoxDecoration(
              color: Nocturne.surfaceDeep,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: Nocturne.borderCard),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<BankOptionModel>(
                value: _selectedBank,
                isExpanded: true,
                dropdownColor: Nocturne.surfaceRaised,
                icon: const Icon(Icons.arrow_drop_down, color: Nocturne.textFaint),
                hint: const Text(
                  'Choose your bank',
                  style: TextStyle(
                    color: Nocturne.textHint,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                items: _banks
                    .map(
                      (bank) => DropdownMenuItem<BankOptionModel>(
                        value: bank,
                        child: Text(
                          bank.name,
                          style: const TextStyle(
                            color: Nocturne.text,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
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
          const Text(
            'Account Number',
            style: TextStyle(
              color: Nocturne.goldSoft,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 7),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
            decoration: BoxDecoration(
              color: Nocturne.surfaceDeep,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(
                color: _accountError != null
                    ? Nocturne.red.withValues(alpha: 0.55)
                    : Nocturne.borderCard,
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.numbers_rounded,
                  color: Nocturne.textFaint,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _accountNumberCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    maxLength: 10,
                    buildCounter: (context,
                        {required currentLength,
                        required isFocused,
                        required maxLength}) {
                      return null;
                    },
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                      border: InputBorder.none,
                      hintText: 'Enter 10-digit account number',
                      hintStyle: TextStyle(
                        color: Nocturne.textHint,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    onChanged: (_) {
                      if (_resolvedAccount != null || _accountError != null) {
                        setState(() {
                          _resolvedAccount = null;
                          _accountError = null;
                        });
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
          if (_accountError != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Nocturne.redSoft, size: 13),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _accountError!,
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
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _canResolve ? () => _resolveAccount() : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                gradient: _canResolve ? Nocturne.goldCta : null,
                color: _canResolve ? null : const Color(0x05FFFFFF),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                  color: _canResolve ? Colors.transparent : Nocturne.border,
                ),
                boxShadow: _canResolve
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
              child: _resolving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: Color(0xFF26170A),
                        strokeWidth: 2.5,
                      ),
                    )
                  : Text(
                      'Verify Account Name',
                      style: TextStyle(
                        color: _canResolve ? const Color(0xFF26170A) : Nocturne.textHint,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerifiedCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.green.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.green.withValues(alpha: 0.30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Nocturne.green, size: 18),
              const SizedBox(width: 8),
              const Text(
                'Verified Account',
                style: TextStyle(
                  color: Nocturne.green,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
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
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildSaveButton() {
    return GestureDetector(
      onTap: _canSave ? () => _saveBankDetails() : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 15),
        decoration: BoxDecoration(
          gradient: _canSave ? Nocturne.goldCta : null,
          color: _canSave ? null : const Color(0x05FFFFFF),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
            color: _canSave ? Colors.transparent : Nocturne.border,
          ),
          boxShadow: _canSave
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
        child: _saving
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  color: Color(0xFF26170A),
                  strokeWidth: 2.5,
                ),
              )
            : Text(
                'Save Bank Account',
                style: TextStyle(
                  color: _canSave ? const Color(0xFF26170A) : Nocturne.textHint,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
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
              color: Nocturne.red,
              size: 44,
            ),
            const SizedBox(height: 12),
            Text(
              _error ?? 'Failed to load bank list',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: _loadBanks,
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
