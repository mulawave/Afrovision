import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_pagination_controls.dart';
import '../models/ledger_entry_model.dart';
import '../services/wallet_service.dart';

class WalletTransactionsScreen extends StatefulWidget {
  const WalletTransactionsScreen({super.key});

  @override
  State<WalletTransactionsScreen> createState() =>
      _WalletTransactionsScreenState();
}

class _WalletTransactionsScreenState extends State<WalletTransactionsScreen>
    with SingleTickerProviderStateMixin {
  static const int _pageSize = 10;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  final List<LedgerEntryModel> _ledger = [];
  bool _loading = true;
  String? _error;
  String _filter = 'all';
  int _page = 0;

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
      begin: const Offset(0, 0.12),
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
      final entries = await WalletService.getLedger();
      if (!mounted) return;
      setState(() {
        _ledger
          ..clear()
          ..addAll(entries);
        _page = 0;
        _loading = false;
        _error = null;
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  List<LedgerEntryModel> get _filtered {
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

  List<LedgerEntryModel> get _paged {
    final start = _page * _pageSize;
    return _filtered.skip(start).take(_pageSize).toList();
  }

  int get _totalPages {
    if (_filtered.isEmpty) return 1;
    return ((_filtered.length - 1) ~/ _pageSize) + 1;
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
                            onRefresh: _loadData,
                            color: AppColors.orange,
                            child: ListView(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                              ),
                              children: [
                                const SizedBox(height: 8),
                                _buildParityMessage(),
                                const SizedBox(height: 16),
                                _buildFilterRow(),
                                const SizedBox(height: 14),
                                _buildList(),
                                const SizedBox(height: 14),
                                AppPaginationControls(
                                  currentPage: _page,
                                  totalPages: _totalPages,
                                  onPrevious: _page > 0
                                      ? () => setState(() => _page -= 1)
                                      : null,
                                  onNext: _page < _totalPages - 1
                                      ? () => setState(() => _page += 1)
                                      : null,
                                ),
                                const SizedBox(height: 30),
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
              'Wallet Transactions',
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

  Widget _buildParityMessage() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: const Text(
        'Full wallet ledger view. Tap any entry to inspect status, reference, and timeline details.',
        style: TextStyle(
          color: AppColors.goldText,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          height: 1.45,
        ),
      ),
    );
  }

  Widget _buildFilterRow() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _chip('All', 'all'),
        _chip('Payments', 'payments'),
        _chip('Rewards', 'rewards'),
        _chip('Splits', 'splits'),
      ],
    );
  }

  Widget _chip(String label, String value) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () {
        setState(() {
          _filter = value;
          _page = 0;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.orange.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.5)
                : AppColors.inputBorder.withValues(alpha: 0.4),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? AppColors.orange : AppColors.goldText,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildList() {
    if (_filtered.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 34),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.35),
          ),
        ),
        child: const Column(
          children: [
            Icon(
              Icons.receipt_long_rounded,
              color: AppColors.goldText,
              size: 44,
            ),
            SizedBox(height: 10),
            Text(
              'No transactions in this view yet',
              style: TextStyle(
                color: AppColors.goldText,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Column(children: _paged.map(_buildTile).toList());
  }

  Widget _buildTile(LedgerEntryModel entry) {
    final color = _colorForType(entry.type);
    final icon = _iconForType(entry.type);

    return GestureDetector(
      onTap: () => _showEntryDetails(entry),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.25),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 18),
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
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    entry.description ?? 'Wallet activity entry',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.goldText,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _entryAmount(entry),
                  style: TextStyle(
                    color: entry.isIncome
                        ? const Color(0xFF4CAF50)
                        : AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  entry.timeAgo,
                  style: const TextStyle(
                    color: AppColors.goldText,
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
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
            Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed.withValues(alpha: 0.55),
              size: 44,
            ),
            const SizedBox(height: 12),
            const Text(
              'Failed to load transactions',
              style: TextStyle(
                color: AppColors.goldText,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
            const SizedBox(height: 14),
            TextButton(
              onPressed: () {
                setState(() {
                  _loading = true;
                  _error = null;
                });
                _loadData();
              },
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: AppColors.lightOrange,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _entryAmount(LedgerEntryModel entry) {
    if (entry.amountVpt > 0) {
      return '${_formatAmount(entry.amountVpt)} vPT';
    }
    if (entry.amountVptUnits > 0) {
      return '${_formatAmount(entry.amountVptUnits)} vPT';
    }
    if (entry.amountNgn > 0) {
      return '₦${_formatAmount(entry.amountNgn)}';
    }
    return '—';
  }

  String _formatAmount(num value) {
    final asDouble = value.toDouble();
    if (asDouble % 1 == 0) {
      return asDouble.toStringAsFixed(0);
    }
    return asDouble.toStringAsFixed(2);
  }

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
      case 'REFERRAL_EARNING':
        return Icons.people_rounded;
      case 'SUBSCRIBER_VPT_REWARD':
        return Icons.card_giftcard_rounded;
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
      case 'REFERRAL_EARNING':
        return AppColors.lightOrange;
      case 'SUBSCRIBER_VPT_REWARD':
        return AppColors.orange;
      default:
        return AppColors.hintText;
    }
  }

  void _showEntryDetails(LedgerEntryModel entry) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.inputBorder,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  entry.typeLabel,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                _detailRow('Status', entry.statusLabel),
                if (entry.referenceId != null) ...[
                  const SizedBox(height: 10),
                  _detailRow('Reference', entry.referenceId!),
                ],
                if (entry.channelId != null) ...[
                  const SizedBox(height: 10),
                  _detailRow('Channel', entry.channelId!),
                ],
                if (entry.txHash != null) ...[
                  const SizedBox(height: 10),
                  _detailRow(
                    'Transaction Hash',
                    entry.txHash!,
                    monospace: true,
                  ),
                ],
                if (entry.description != null &&
                    entry.description!.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  _detailRow('Description', entry.description!),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value, {bool monospace = false}) {
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
}
