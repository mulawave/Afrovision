import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/ledger_entry_model.dart';
import '../services/wallet_service.dart';
import '../widgets/assets_header.dart';
import '../../../core/widgets/nocturne_pagination.dart';
import '../widgets/wallet_detail_sheet.dart';

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
  Map<String, dynamic> _exchangeRates = {};
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

  double get _vptPrice {
    final price = _exchangeRates['vpt_price_ngn'];
    if (price is num) return price.toDouble();
    return 750;
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        WalletService.getLedger(),
        WalletService.getExchangeRates().catchError((_) => <String, dynamic>{}),
      ]);
      if (!mounted) return;

      setState(() {
        _ledger
          ..clear()
          ..addAll(results[0] as List<LedgerEntryModel>);
        _exchangeRates = results[1] as Map<String, dynamic>;
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
    final count = _filtered.length;
    return count == 0 ? 1 : ((count - 1) ~/ _pageSize) + 1;
  }

  void _setFilter(String filter) {
    setState(() {
      _filter = filter;
      _page = 0;
    });
  }

  void _prevPage() {
    if (_page > 0) setState(() => _page--);
  }

  void _nextPage() {
    if (_page < _totalPages - 1) setState(() => _page++);
  }

  void _showDetail(LedgerEntryModel entry) {
    final detail = WalletDetail.fromLedgerEntry(entry, vptPrice: _vptPrice);
    showWalletDetailSheet(context, detail);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: Column(
        children: [
          AssetsHeader(
            title: 'Full Ledger',
            subtitle: 'Every wallet movement',
            onBack: () => Navigator.maybePop(context),
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
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                              children: [
                                _buildInfoBanner(),
                                const SizedBox(height: 11),
                                _buildFilterRow(),
                                const SizedBox(height: 12),
                                _buildList(),
                                const SizedBox(height: 12),
                                NocturnePagination(
                                  currentPage: _page,
                                  totalPages: _totalPages,
                                  onPrevious: _prevPage,
                                  onNext: _nextPage,
                                ),
                                const SizedBox(height: 8),
                                const Center(
                                  child: Text(
                                    '10 entries per page · tap any entry for the full explanation',
                                    style: TextStyle(
                                      color: Nocturne.textHint,
                                      fontSize: 10.5,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 18),
                              ],
                            ),
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.receipt_long_rounded,
              color: Nocturne.goldLight, size: 16),
          SizedBox(width: 9),
          Expanded(
            child: Text(
              'Full wallet ledger. Tap any entry to inspect status, reference and timeline details.',
              style: TextStyle(
                color: Nocturne.goldSoft,
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterRow() {
    return _FilterChips(
      selected: _filter,
      onSelected: _setFilter,
    );
  }

  Widget _buildList() {
    if (_filtered.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 34),
        alignment: Alignment.center,
        child: const Column(
          children: [
            Icon(Icons.receipt_long_rounded,
                color: Nocturne.textHint, size: 44),
            SizedBox(height: 12),
            Text(
              'No wallet activity in this view yet',
              style: TextStyle(
                color: Nocturne.textFaint,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _paged
          .map((e) => _LedgerRow(
                entry: e,
                vptPrice: _vptPrice,
                onTap: () => _showDetail(e),
              ))
          .toList(),
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
              color: Nocturne.red.withValues(alpha: 0.55),
              size: 44,
            ),
            const SizedBox(height: 12),
            const Text(
              'Failed to load transactions',
              style: TextStyle(
                color: Nocturne.text,
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
                  color: Nocturne.textFaint,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
            const SizedBox(height: 14),
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
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: const Color(0x08FFFFFF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Nocturne.border),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    color: Nocturne.goldLight,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
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

class _FilterChips extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelected;

  const _FilterChips({required this.selected, required this.onSelected});

  static const _filters = [
    ('all', 'All'),
    ('payments', 'Payments'),
    ('rewards', 'Rewards'),
    ('splits', 'Splits'),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _filters.map((f) {
          final active = selected == f.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: GestureDetector(
              onTap: () => onSelected(f.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: active ? const Color(0x22F0A52A) : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: active ? Nocturne.gold : Nocturne.border,
                  ),
                ),
                child: Text(
                  f.$2,
                  style: TextStyle(
                    color: active ? Nocturne.goldLight : Nocturne.textMuted,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _LedgerRow extends StatelessWidget {
  final LedgerEntryModel entry;
  final double vptPrice;
  final VoidCallback onTap;

  const _LedgerRow({
    required this.entry,
    required this.vptPrice,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final detail = WalletDetail.fromLedgerEntry(entry, vptPrice: vptPrice);
    final dotColor = detail.amountColor == Nocturne.green
        ? Nocturne.green
        : Nocturne.goldLight;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: Nocturne.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: detail.iconBg,
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(detail.icon, color: detail.iconTint, size: 16),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.title,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    detail.note,
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 11,
                      height: 1.35,
                    ),
                    maxLines: 2,
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
                  detail.amount,
                  style: TextStyle(
                    color: detail.amountColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: dotColor,
                        borderRadius: BorderRadius.circular(2.5),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      entry.timeAgo,
                      style: const TextStyle(
                        color: Nocturne.textFaint,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
