import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_pagination_controls.dart';
import '../models/withdrawal_model.dart';
import '../services/wallet_service.dart';

class WithdrawalHistoryScreen extends StatefulWidget {
  const WithdrawalHistoryScreen({super.key});

  @override
  State<WithdrawalHistoryScreen> createState() =>
      _WithdrawalHistoryScreenState();
}

class _WithdrawalHistoryScreenState extends State<WithdrawalHistoryScreen>
    with SingleTickerProviderStateMixin {
  static const int _pageSize = 5;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  List<WithdrawalModel> _withdrawals = [];
  bool _loading = true;
  String? _error;
  int _page = 0;
  String _filter = 'all'; // all, pending, approved, rejected

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
      final result = await WalletService.getMyWithdrawals();
      if (!mounted) return;
      setState(() {
        _withdrawals = result;
        _page = 0;
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
    };
    for (final w in _withdrawals) {
      counts[w.status] = (counts[w.status] ?? 0) + 1;
    }
    return counts;
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
                                _buildSummaryStats(),
                                const SizedBox(height: 16),
                                _buildFilterTabs(),
                                const SizedBox(height: 16),
                                _buildList(),
                                const SizedBox(height: 12),
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
              'Withdrawal History',
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

  Widget _buildSummaryStats() {
    final counts = _statusCounts;
    return Row(
      children: [
        _statChip('Total', counts['all'] ?? 0, AppColors.white),
        const SizedBox(width: 8),
        _statChip('Pending', counts['pending'] ?? 0, AppColors.lightOrange),
        const SizedBox(width: 8),
        _statChip('Approved', counts['approved'] ?? 0, AppColors.successGreen),
        const SizedBox(width: 8),
        _statChip('Rejected', counts['rejected'] ?? 0, AppColors.errorRed),
      ],
    );
  }

  Widget _statChip(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.inputBorder),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                color: color,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.goldText,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterTabs() {
    final filters = [
      ('all', 'All'),
      ('pending', 'Pending'),
      ('approved', 'Approved'),
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
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  gradient: isActive ? AppColors.buttonGradient : null,
                  color: isActive ? null : AppColors.cardBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isActive
                        ? Colors.transparent
                        : AppColors.inputBorder,
                  ),
                ),
                child: Text(
                  f.$2,
                  style: TextStyle(
                    color: isActive ? AppColors.darkBlue : AppColors.goldText,
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
    final entries = _paginated;
    if (_filtered.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 60),
        child: Column(
          children: [
            Icon(
              _filter == 'all'
                  ? Icons.receipt_long_rounded
                  : Icons.filter_list_off_rounded,
              color: AppColors.goldText,
              size: 48,
            ),
            const SizedBox(height: 12),
            Text(
              _filter == 'all'
                  ? 'No withdrawal requests yet'
                  : 'No $_filter withdrawals',
              style: const TextStyle(
                color: AppColors.goldText,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Column(children: entries.map((w) => _buildTile(w)).toList());
  }

  Widget _buildTile(WithdrawalModel withdrawal) {
    final statusColor = _colorForStatus(withdrawal.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
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
                      '₦${_formatAmount(withdrawal.amount)}',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      withdrawal.timeAgo,
                      style: const TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
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
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: statusColor.withValues(alpha: 0.25),
                  ),
                ),
                child: Text(
                  withdrawal.statusLabel,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),
          if (withdrawal.bankName != null ||
              withdrawal.accountNumberMasked != null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: Text(
                '${withdrawal.bankName ?? 'Bank'} • ${withdrawal.accountName ?? ''} ${withdrawal.accountNumberMasked ?? ''}'
                    .trim(),
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
          if (withdrawal.totalFees > 0) ...[
            const SizedBox(height: 8),
            Text(
              'Fees: ₦${_formatAmount(withdrawal.totalFees)} · '
              'VAT: ₦${_formatAmount(withdrawal.vatAmount)} · '
              'Total debited: ₦${_formatAmount(withdrawal.totalDebit)}',
              style: const TextStyle(
                color: AppColors.goldText,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _colorForStatus(String status) {
    switch (status) {
      case 'pending':
        return AppColors.lightOrange;
      case 'approved':
        return AppColors.successGreen;
      case 'rejected':
        return AppColors.errorRed;
      case 'paid':
        return AppColors.softBlue;
      default:
        return AppColors.goldText;
    }
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
              'Failed to load withdrawal history',
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
