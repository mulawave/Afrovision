import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../models/ledger_entry_model.dart';
import '../services/wallet_service.dart';

class DigitalAssetsScreen extends StatefulWidget {
  const DigitalAssetsScreen({super.key});

  @override
  State<DigitalAssetsScreen> createState() => _DigitalAssetsScreenState();
}

class _DigitalAssetsScreenState extends State<DigitalAssetsScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  static const double _vptPrice = 750; // 1 vPT = ₦750

  UserModel? _user;
  List<LedgerEntryModel> _ledger = [];
  Map<String, dynamic>? _wallet;
  Map<String, dynamic>? _blockchainPreflight;
  String? _blockchainPreflightError;
  bool _loading = true;
  String? _error;
  String _filter = 'all';

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
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final profile = await ProfileService.getProfile();
      final results = await Future.wait([
        WalletService.getLedger(),
        WalletService.getMyWallet(),
      ]);
      Map<String, dynamic>? blockchainPreflight;
      String? blockchainPreflightError;

      if (profile.isAdmin) {
        try {
          blockchainPreflight = await WalletService.getBlockchainPreflight();
        } catch (e) {
          blockchainPreflightError = e.toString();
        }
      }

      if (!mounted) return;
      setState(() {
        _user = profile;
        _ledger = results[0] as List<LedgerEntryModel>;
        _wallet = results[1] as Map<String, dynamic>?;
        _blockchainPreflight = blockchainPreflight;
        _blockchainPreflightError = blockchainPreflightError;
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

  List<LedgerEntryModel> get _filteredLedger {
    switch (_filter) {
      case 'payments':
        return _ledger.where((e) => e.isPayment).toList();
      case 'rewards':
        return _ledger.where((e) => e.isIncome || e.isQueue).toList();
      case 'splits':
        return _ledger.where((e) => e.isSplit).toList();
      default:
        return _ledger;
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
                                _buildBalanceCard(),
                                if (_user?.isAdmin ?? false) ...[
                                  const SizedBox(height: 16),
                                  _buildBlockchainPreflightCard(),
                                ],
                                const SizedBox(height: 16),
                                _buildWalletCard(),
                                const SizedBox(height: 16),
                                _buildEconomicBreakdown(),
                                const SizedBox(height: 20),
                                _buildFilterRow(),
                                const SizedBox(height: 12),
                                _buildTransactionList(),
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
    );
  }

  // ─── App Bar ──────────────────────────────────────────

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
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.3),
                ),
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
              'Digital Assets',
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

  // ─── Balance Hero Card ────────────────────────────────

  Widget _buildBalanceCard() {
    final user = _user!;
    final nairaEquiv = user.vptBalance * _vptPrice;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.orange.withValues(alpha: 0.15),
            AppColors.lightOrange.withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: AppColors.orange.withValues(alpha: 0.08),
            blurRadius: 24,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.token_rounded,
                  color: AppColors.orange,
                  size: 26,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'vPT BALANCE',
                      style: TextStyle(
                        color: AppColors.lightOrange.withValues(alpha: 0.8),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatAmount(user.vptBalance)} vPT',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '≈ ₦${_formatAmount(nairaEquiv)}',
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.7),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.darkBlue.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.diamond_rounded,
                  color: AppColors.lightOrange,
                  size: 16,
                ),
                const SizedBox(width: 8),
                Text(
                  user.subscriptionPlan?.toUpperCase() ?? 'NO PLAN',
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: user.hasActiveSubscription
                        ? const Color(0xFF4CAF50).withValues(alpha: 0.15)
                        : AppColors.errorRed.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    user.hasActiveSubscription ? 'ACTIVE' : 'INACTIVE',
                    style: TextStyle(
                      color: user.hasActiveSubscription
                          ? const Color(0xFF4CAF50)
                          : AppColors.errorRed,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.info_outline_rounded,
                color: AppColors.hintText.withValues(alpha: 0.5),
                size: 12,
              ),
              const SizedBox(width: 4),
              Text(
                '1 vPT = ₦${_vptPrice.toInt()}',
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.6),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Wallet Card ──────────────────────────────────────

  Widget _buildBlockchainPreflightCard() {
    final readiness = _blockchainPreflight;
    final ready = readiness?['ready'] == true;
    final environment = readiness?['environment'] as String? ?? 'staging';
    final missing = _stringList(readiness?['missing']);
    final invalid = _stringList(readiness?['invalid']);
    final chainId = readiness?['chain_id'] as String?;
    final expectedChainId = readiness?['expected_chain_id'] as String?;
    final chainLabel = readiness?['chain_label'] as String?;
    final treasuryAddress = readiness?['treasury_address'] as String?;
    final errorMessage =
        _blockchainPreflightError ?? readiness?['error'] as String?;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: ready
              ? AppColors.lightOrange.withValues(alpha: 0.35)
              : AppColors.orange.withValues(alpha: 0.4),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkBlue.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(
                  Icons.security_rounded,
                  color: AppColors.orange,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Blockchain Preflight',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Admin staging readiness for real swap execution',
                      style: TextStyle(
                        color: AppColors.hintText,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              _buildStatusChip(
                ready ? 'READY' : 'ACTION NEEDED',
                ready ? AppColors.lightOrange : AppColors.orange,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _preflightMetric(
                  'Environment',
                  environment.toUpperCase(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _preflightMetric(
                  'Chain',
                  chainLabel ?? (chainId != null ? 'ID $chainId' : 'Pending'),
                ),
              ),
            ],
          ),
          if (chainId != null || expectedChainId != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow(
              'Chain Validation',
              chainId == null && expectedChainId == null
                  ? 'Pending'
                  : 'Expected ${expectedChainId ?? 'unknown'} • Current ${chainId ?? 'unknown'}',
            ),
          ],
          if (treasuryAddress != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow('Treasury', treasuryAddress, monospace: true),
          ],
          if (missing.isNotEmpty) ...[
            const SizedBox(height: 14),
            _buildTagGroup('Missing Settings', missing),
          ],
          if (invalid.isNotEmpty) ...[
            const SizedBox(height: 14),
            _buildTagGroup('Invalid Values', invalid),
          ],
          if (errorMessage != null && errorMessage.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.35),
                ),
              ),
              child: Text(
                errorMessage,
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.9),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildWalletCard() {
    final address = _wallet?['bsc_address'] as String? ?? _user?.bscAddress;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF64B5F6).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: Color(0xFF64B5F6),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'BSC Wallet',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (address != null)
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: address));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text('Wallet address copied'),
                        backgroundColor: AppColors.cardBg,
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.copy_rounded,
                          color: AppColors.orange,
                          size: 12,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'Copy',
                          style: TextStyle(
                            color: AppColors.orange,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (address != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.2),
                ),
              ),
              child: Text(
                address,
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.8),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  fontFamily: 'monospace',
                  letterSpacing: 0.5,
                ),
              ),
            )
          else
            Text(
              'No wallet generated yet',
              style: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.5),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
        ],
      ),
    );
  }

  // ─── Economic Breakdown ───────────────────────────────

  Widget _buildEconomicBreakdown() {
    final payments = _ledger.where((e) => e.isPayment && e.isSuccess);
    final splits = _ledger.where((e) => e.isSplit && e.isSuccess);
    final distributions = _ledger.where(
      (e) => e.type == 'VPT_DISTRIBUTION' && e.isSuccess,
    );
    final queued = _ledger.where((e) => e.isQueue && e.isSuccess);

    final totalPaid = payments.fold<double>(0, (sum, e) => sum + e.amountNgn);

    double communityPoolNgn = 0;
    double extractedNgn = 0;
    for (final s in splits) {
      communityPoolNgn += (s.meta['community_pool'] as num?)?.toDouble() ?? 0;
      extractedNgn += s.amountNgn;
    }
    final poolRetainedNgn = communityPoolNgn - extractedNgn;
    final poolRetainedVpt = poolRetainedNgn / _vptPrice;

    final totalDistributedVpt = distributions.fold<double>(
      0,
      (sum, e) => sum + e.amountVpt,
    );
    final totalDistributedNgn = totalDistributedVpt * _vptPrice;

    final totalQueuedNgn = queued.fold<double>(
      0,
      (sum, e) => sum + e.amountNgn,
    );
    final totalQueuedVpt = totalQueuedNgn / _vptPrice;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
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
          const Row(
            children: [
              Icon(
                Icons.pie_chart_rounded,
                color: AppColors.lightOrange,
                size: 18,
              ),
              SizedBox(width: 8),
              Text(
                'Economic Breakdown',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _breakdownRow(
            'Total Subscription',
            '₦${_formatAmount(totalPaid)}',
            Icons.payment_rounded,
            AppColors.white,
          ),
          const SizedBox(height: 10),
          _breakdownRow(
            'Community Pool (70%)',
            '${_formatAmount(poolRetainedVpt)} vPT  (₦${_formatAmount(poolRetainedNgn)})',
            Icons.groups_rounded,
            const Color(0xFF81C784),
          ),
          const SizedBox(height: 10),
          _breakdownRow(
            'vPT Queued (30%)',
            '${_formatAmount(totalQueuedVpt)} vPT  (₦${_formatAmount(totalQueuedNgn)})',
            Icons.schedule_rounded,
            AppColors.lightOrange,
          ),
          const SizedBox(height: 10),
          _breakdownRow(
            'vPT Distributed',
            '${_formatAmount(totalDistributedVpt)} vPT  (₦${_formatAmount(totalDistributedNgn)})',
            Icons.token_rounded,
            AppColors.orange,
          ),
        ],
      ),
    );
  }

  Widget _breakdownRow(String label, String value, IconData icon, Color color) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.8),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Filter Row ───────────────────────────────────────

  Widget _buildFilterRow() {
    return Row(
      children: [
        const Text(
          'Earning History',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
        const Spacer(),
        _filterChip('All', 'all'),
        const SizedBox(width: 6),
        _filterChip('Payments', 'payments'),
        const SizedBox(width: 6),
        _filterChip('Rewards', 'rewards'),
      ],
    );
  }

  Widget _filterChip(String label, String value) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.orange.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.5)
                : AppColors.inputBorder.withValues(alpha: 0.3),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? AppColors.orange : AppColors.hintText,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  // ─── Transaction List ─────────────────────────────────

  Widget _buildTransactionList() {
    final entries = _filteredLedger;

    if (entries.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            Icon(
              Icons.receipt_long_rounded,
              color: AppColors.hintText.withValues(alpha: 0.3),
              size: 48,
            ),
            const SizedBox(height: 12),
            Text(
              'No transactions yet',
              style: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.6),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: entries.map((entry) => _buildTransactionTile(entry)).toList(),
    );
  }

  Widget _buildTransactionTile(LedgerEntryModel entry) {
    final iconData = _iconForType(entry.type);
    final color = _colorForType(entry.type);

    // vPT amounts → show as vPT primary + ₦ equiv secondary
    // NGN amounts → show as ₦ primary + vPT equiv secondary
    String primaryAmount;
    String? secondaryAmount;

    if (entry.amountVpt > 0) {
      primaryAmount = '${_formatAmount(entry.amountVpt)} vPT';
      secondaryAmount = '≈ ₦${_formatAmount(entry.amountVpt * _vptPrice)}';
    } else if (entry.amountNgn > 0) {
      primaryAmount = '₦${_formatAmount(entry.amountNgn)}';
      final vptEquiv = entry.amountNgn / _vptPrice;
      secondaryAmount = '≈ ${_formatAmount(vptEquiv)} vPT';
    } else {
      primaryAmount = '—';
      secondaryAmount = null;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(iconData, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.typeLabel,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                if (entry.description != null)
                  Text(
                    entry.description!,
                    style: TextStyle(
                      color: AppColors.hintText.withValues(alpha: 0.7),
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                primaryAmount,
                style: TextStyle(
                  color: entry.isIncome
                      ? const Color(0xFF4CAF50)
                      : AppColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (secondaryAmount != null) ...[
                const SizedBox(height: 1),
                Text(
                  secondaryAmount,
                  style: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.5),
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
              const SizedBox(height: 3),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: entry.isSuccess
                          ? const Color(0xFF4CAF50)
                          : entry.isPending
                          ? AppColors.lightOrange
                          : AppColors.errorRed,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    entry.timeAgo,
                    style: TextStyle(
                      color: AppColors.hintText.withValues(alpha: 0.6),
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Helpers ──────────────────────────────────────────

  IconData _iconForType(String type) {
    switch (type) {
      case 'PLAN_PAYMENT':
        return Icons.payment_rounded;
      case 'SPLIT':
        return Icons.pie_chart_rounded;
      case 'VPT_QUEUE':
        return Icons.schedule_rounded;
      case 'VPT_SWAP':
        return Icons.swap_horiz_rounded;
      case 'VPT_DISTRIBUTION':
        return Icons.token_rounded;
      case 'WALLET_CREATED':
        return Icons.account_balance_wallet_rounded;
      case 'SWAP_FAILED':
      case 'DISTRIBUTION_FAILED':
        return Icons.error_outline_rounded;
      default:
        return Icons.receipt_long_rounded;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'PLAN_PAYMENT':
        return AppColors.white;
      case 'SPLIT':
        return const Color(0xFF81C784);
      case 'VPT_QUEUE':
        return AppColors.lightOrange;
      case 'VPT_SWAP':
        return const Color(0xFF64B5F6);
      case 'VPT_DISTRIBUTION':
        return AppColors.orange;
      case 'WALLET_CREATED':
        return const Color(0xFF64B5F6);
      case 'SWAP_FAILED':
      case 'DISTRIBUTION_FAILED':
        return AppColors.errorRed;
      default:
        return AppColors.hintText;
    }
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed.withValues(alpha: 0.5),
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load data',
              style: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.7),
                fontSize: 14,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.4),
                  fontSize: 11,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                setState(() {
                  _loading = true;
                  _error = null;
                });
                _loadData();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    color: AppColors.white,
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

  Widget _buildStatusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }

  Widget _preflightMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.inputBorder.withValues(alpha: 0.24),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.8),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool monospace = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.hintText.withValues(alpha: 0.8),
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          value,
          style: TextStyle(
            color: AppColors.white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFamily: monospace ? 'monospace' : null,
          ),
        ),
      ],
    );
  }

  Widget _buildTagGroup(String title, List<String> values) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            color: AppColors.hintText.withValues(alpha: 0.85),
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: values
              .map(
                (value) => Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: AppColors.inputBorder.withValues(alpha: 0.28),
                    ),
                  ),
                  child: Text(
                    value,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }

  List<String> _stringList(dynamic values) {
    if (values is! List) return const [];
    return values
        .whereType<String>()
        .where((value) => value.isNotEmpty)
        .toList();
  }

  String _formatAmount(double amount) {
    if (amount == 0) return '0';
    if (amount < 1 && amount > 0) return amount.toStringAsFixed(4);
    final intAmount = amount.toInt();
    if (intAmount >= 1000) {
      final str = intAmount.toString();
      final buffer = StringBuffer();
      for (int i = 0; i < str.length; i++) {
        if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
        buffer.write(str[i]);
      }
      return buffer.toString();
    }
    if (amount == amount.roundToDouble()) return intAmount.toString();
    return amount.toStringAsFixed(2);
  }
}
