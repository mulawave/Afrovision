import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../models/withdrawal_model.dart';
import '../services/wallet_service.dart';
import '../utils/wallet_format.dart';
import '../widgets/assets_header.dart';
import '../../../core/widgets/nocturne_pagination.dart';
import '../widgets/wallet_detail_sheet.dart';

class WithdrawalHistoryScreen extends StatefulWidget {
  const WithdrawalHistoryScreen({super.key});

  @override
  State<WithdrawalHistoryScreen> createState() =>
      _WithdrawalHistoryScreenState();
}

class _WithdrawalHistoryScreenState extends State<WithdrawalHistoryScreen>
    with SingleTickerProviderStateMixin {
  static const int _pageSize = 10;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  List<WithdrawalModel> _withdrawals = [];
  bool _loading = true;
  String? _error;
  int _page = 0;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut),
    );
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
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
      final result = await WalletService.getMyWithdrawals();
      if (!mounted) return;
      setState(() {
        _withdrawals = result;
        _page = 0;
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

  List<WithdrawalModel> get _filtered {
    if (_filter == 'all') return _withdrawals;
    return _withdrawals.where((w) => w.status == _filter).toList();
  }

  List<WithdrawalModel> get _paginated {
    final start = _page * _pageSize;
    return _filtered.skip(start).take(_pageSize).toList();
  }

  int get _totalPages {
    final total = _filtered.length;
    return total == 0 ? 1 : ((total - 1) ~/ _pageSize) + 1;
  }

  Map<String, int> get _statusCounts {
    final counts = <String, int>{
      'all': _withdrawals.length,
      'pending': 0,
      'approved': 0,
      'rejected': 0,
      'paid': 0,
    };
    for (final w in _withdrawals) {
      counts[w.status] = (counts[w.status] ?? 0) + 1;
    }
    return counts;
  }

  Color _colorForStatus(String status) {
    switch (status) {
      case 'pending':
        return Nocturne.goldLight;
      case 'approved':
        return Nocturne.green;
      case 'rejected':
        return Nocturne.redSoft;
      case 'paid':
        return Nocturne.blue;
      default:
        return Nocturne.textFaint;
    }
  }

  void _showDetail(WithdrawalModel w) {
    showWalletDetailSheet(
      context,
      WalletDetail.fromWithdrawal(
        w,
        statusColor: _colorForStatus(w.status),
      ),
    );
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
              title: 'Withdrawal History',
              subtitle: 'Requests and payouts',
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
                              _buildStatsGrid(),
                              const SizedBox(height: 14),
                              _buildFilterChips(),
                              const SizedBox(height: 14),
                              _buildList(),
                              const SizedBox(height: 12),
                              NocturnePagination(
                                currentPage: _page,
                                totalPages: _totalPages,
                                onPrevious: _page > 0
                                  ? () => setState(() => _page -= 1)
                                  : null,
                                onNext: _page < _totalPages - 1
                                  ? () => setState(() => _page += 1)
                                  : null,
                              ),
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

  Widget _buildStatsGrid() {
    final counts = _statusCounts;
    return Row(
      children: [
        _buildStatTile('Total', counts['all'] ?? 0, Nocturne.text),
        const SizedBox(width: 8),
        _buildStatTile('Approved', counts['approved'] ?? 0, Nocturne.green),
        const SizedBox(width: 8),
        _buildStatTile('Pending', counts['pending'] ?? 0, Nocturne.goldLight),
        const SizedBox(width: 8),
        _buildStatTile('Rejected', counts['rejected'] ?? 0, Nocturne.redSoft),
      ],
    );
  }

  Widget _buildStatTile(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Nocturne.borderCard),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                color: color,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      ('all', 'All'),
      ('approved', 'Approved'),
      ('pending', 'Pending'),
      ('rejected', 'Rejected'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((f) {
          final isActive = _filter == f.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() {
                _filter = f.$1;
                _page = 0;
              }),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  gradient: isActive ? Nocturne.goldCta : null,
                  color: isActive ? null : const Color(0x05FFFFFF),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isActive
                        ? Colors.transparent
                        : Nocturne.border,
                  ),
                ),
                child: Text(
                  f.$2,
                  style: TextStyle(
                    color: isActive
                        ? const Color(0xFF26170A)
                        : Nocturne.textDim,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildList() {
    if (_filtered.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 60),
        child: Column(
          children: [
            const Icon(
              Icons.receipt_long_rounded,
              color: Nocturne.goldLight,
              size: 48,
            ),
            const SizedBox(height: 12),
            Text(
              _filter == 'all'
                  ? 'No withdrawal requests yet'
                  : 'No $_filter withdrawals',
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _paginated.map((w) => _buildHistoryCard(w)).toList(),
    );
  }

  Widget _buildHistoryCard(WithdrawalModel w) {
    final statusColor = _colorForStatus(w.status);

    return GestureDetector(
      onTap: () => _showDetail(w),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Nocturne.borderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Icon(
                    Icons.account_balance_rounded,
                    color: statusColor,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '₦${walletFormatAmount(w.amount)}',
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        w.timeAgo,
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.32),
                    ),
                  ),
                  child: Text(
                    w.statusLabel,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            if (w.bankName != null || w.accountNumberMasked != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: const Color(0x05FFFFFF),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: Nocturne.borderCard),
                ),
                child: Text(
                  '${w.bankName ?? 'Bank'} • ${w.accountName ?? ''} ${w.accountNumberMasked ?? ''}'
                      .trim(),
                  style: const TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
            if (w.totalFees > 0 || w.vatAmount > 0 || w.totalDebit > 0) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildMetaPill(
                    'Fees',
                    '₦${walletFormatAmount(w.totalFees)}',
                  ),
                  _buildMetaPill(
                    'VAT',
                    '₦${walletFormatAmount(w.vatAmount)}',
                  ),
                  _buildMetaPill(
                    'Total',
                    '₦${walletFormatAmount(w.totalDebit)}',
                    highlight: true,
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMetaPill(
    String label,
    String value, {
    bool highlight = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: highlight
            ? Nocturne.gold.withValues(alpha: 0.10)
            : const Color(0x05FFFFFF),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: highlight
              ? Nocturne.gold.withValues(alpha: 0.25)
              : Nocturne.borderCard,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            value,
            style: TextStyle(
              color: highlight ? Nocturne.gold : Nocturne.text,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
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
              'Failed to load withdrawal history',
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
