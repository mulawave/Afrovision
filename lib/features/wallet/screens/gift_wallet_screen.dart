import 'package:flutter/material.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/app_colors.dart';
import '../models/ledger_entry_model.dart';
import '../services/wallet_service.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';

class GiftWalletScreen extends StatefulWidget {
  const GiftWalletScreen({super.key});

  @override
  State<GiftWalletScreen> createState() => _GiftWalletScreenState();
}

class _GiftWalletScreenState extends State<GiftWalletScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  Map<String, dynamic> _wallet = {};
  List<LedgerEntryModel> _ledger = [];
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
      final results = await Future.wait([
        WalletService.getGiftWalletBalance(),
        WalletService.getLedger(),
      ]);
      if (!mounted) return;
      setState(() {
        _wallet = results[0] as Map<String, dynamic>;
        final allLedger = results[1] as List<LedgerEntryModel>;
        _ledger = allLedger
            .where(
              (e) =>
                  e.type.startsWith('GIFT_') ||
                  e.type == 'WALLET_FUND' ||
                  e.type == 'WITHDRAWAL' ||
                  e.type == 'REVERSAL',
            )
            .toList();
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

  static double _safeDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  double get _vptUnits => _safeDouble(_wallet['vpt']);
  double get _ngnBalance => _safeDouble(_wallet['cash']);
  double get _ravensBalance => _safeDouble(_wallet['coins']);

  List<LedgerEntryModel> get _filteredLedger {
    switch (_filter) {
      case 'sent':
        return _ledger.where((e) => e.isExpense).toList();
      case 'received':
        return _ledger.where((e) => e.isIncome).toList();
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
              const MarqueeTickerWidget(),
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
                                const SizedBox(height: 16),
                                _buildSplitInfoCard(),
                                const SizedBox(height: 16),
                                _buildActionRow(),
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
              'Gift Wallet',
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
          // ── vPT Balance Row ──
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.card_giftcard_rounded,
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
                      'vPT GIFTS',
                      style: TextStyle(
                        color: AppColors.lightOrange.withValues(alpha: 0.8),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatAmount(_vptUnits)} units',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // ── NGN Balance Row ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.darkBlue.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.account_balance_rounded,
                    color: Color(0xFF4CAF50),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'NGN BALANCE',
                        style: TextStyle(
                          color: AppColors.goldText,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '₦${_formatAmount(_ngnBalance)}',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // ── Ravens Balance Row ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.darkBlue.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.lightOrange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.flutter_dash_rounded,
                    color: AppColors.lightOrange,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'RAVENS',
                        style: TextStyle(
                          color: AppColors.lightOrange,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${_formatAmount(_ravensBalance)} Ravens',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Settlement Split Info ────────────────────────────

  Widget _buildSplitInfoCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.info_outline_rounded,
                color: AppColors.hintText,
                size: 16,
              ),
              const SizedBox(width: 8),
              const Text(
                'Gift Settlement Distribution',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Every gift you send is split as follows:',
            style: TextStyle(
              color: AppColors.hintText,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _walletSplitChip('Creator', '50%', AppColors.lightOrange),
              const SizedBox(width: 8),
              _walletSplitChip('Operations', '30%', const Color(0xFF64B5F6)),
              const SizedBox(width: 8),
              _walletSplitChip('Community Pool', '20%', const Color(0xFF4CAF50)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _walletSplitChip(String label, String pct, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Text(
              pct,
              style: TextStyle(
                color: color,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.hintText,
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Action Row ───────────────────────────────────────

  Widget _buildActionRow() {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () async {
              if (!await KycGuard.ensureKycVerified(context)) return;
              final result = await Navigator.pushNamed(
                context,
                '/checkout',
                arguments: {
                  'purpose': 'wallet_topup',
                  'title': 'Wallet Top-Up',
                  'balanceType': 'ngn',
                },
              );

              if (result != null && mounted) {
                await _loadData();
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text(
                      'Wallet top-up verified successfully.',
                      style: TextStyle(color: AppColors.white),
                    ),
                    backgroundColor: const Color(
                      0xFF4CAF50,
                    ).withValues(alpha: 0.9),
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                );
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.orange.withValues(alpha: 0.28),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.add_card_rounded,
                    color: AppColors.orange,
                    size: 18,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Top Up',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/withdrawals'),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.orange.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.arrow_upward_rounded,
                    color: AppColors.white,
                    size: 18,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Withdraw',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
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
          'Gift History',
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
        _filterChip('Sent', 'sent'),
        const SizedBox(width: 6),
        _filterChip('Received', 'received'),
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
              Icons.card_giftcard_rounded,
              color: AppColors.goldText,
              size: 48,
            ),
            const SizedBox(height: 12),
            Text(
              'No gift transactions yet',
              style: TextStyle(
                color: AppColors.goldText,
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

    String primaryAmount;
    if (entry.amountVpt > 0 || entry.amountVptUnits > 0) {
      final units = entry.amountVptUnits > 0
          ? entry.amountVptUnits
          : entry.amountVpt;
      primaryAmount =
          '${entry.isExpense ? '-' : '+'}${_formatAmount(units.toDouble())} vPT';
    } else if (entry.amountNgn > 0) {
      primaryAmount =
          '${entry.isExpense ? '-' : '+'}₦${_formatAmount(entry.amountNgn)}';
    } else {
      primaryAmount = '—';
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
                      color: AppColors.goldText,
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
                      : entry.isExpense
                      ? AppColors.errorRed
                      : AppColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
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
                      color: AppColors.goldText,
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
      case 'GIFT_SENT_VPT':
      case 'GIFT_SENT_NGN':
        return Icons.arrow_upward_rounded;
      case 'GIFT_RECEIVED_VPT':
      case 'GIFT_RECEIVED_NGN':
        return Icons.arrow_downward_rounded;
      case 'WALLET_FUND':
        return Icons.add_circle_outline_rounded;
      case 'WITHDRAWAL':
        return Icons.account_balance_rounded;
      case 'REVERSAL':
        return Icons.replay_rounded;
      default:
        return Icons.receipt_long_rounded;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'GIFT_SENT_VPT':
      case 'GIFT_SENT_NGN':
        return AppColors.errorRed;
      case 'GIFT_RECEIVED_VPT':
      case 'GIFT_RECEIVED_NGN':
        return const Color(0xFF4CAF50);
      case 'WALLET_FUND':
        return AppColors.orange;
      case 'WITHDRAWAL':
        return const Color(0xFF64B5F6);
      case 'REVERSAL':
        return AppColors.lightOrange;
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
              'Failed to load wallet',
              style: TextStyle(color: AppColors.goldText, fontSize: 14),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.goldText, fontSize: 11),
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

  String _formatAmount(double val) {
    if (val == val.roundToDouble()) return val.toInt().toString();
    return val.toStringAsFixed(2);
  }
}
