import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/ledger_entry_model.dart';
import '../utils/wallet_format.dart';
import '../../../core/widgets/nocturne_pagination.dart';
import 'wallet_detail_sheet.dart';

class ActivityHistoryCard extends StatefulWidget {
  final List<LedgerEntryModel> entries;
  final double vptPrice;
  final bool hideBalances;
  final VoidCallback onOpenFullLedger;

  const ActivityHistoryCard({
    super.key,
    required this.entries,
    required this.vptPrice,
    required this.hideBalances,
    required this.onOpenFullLedger,
  });

  @override
  State<ActivityHistoryCard> createState() => _ActivityHistoryCardState();
}

class _ActivityHistoryCardState extends State<ActivityHistoryCard> {
  String _filter = 'all';
  int _page = 0;
  static const int _pageSize = 5;

  List<LedgerEntryModel> get _filtered {
    switch (_filter) {
      case 'payments':
        return widget.entries.where((e) => e.isPayment).toList();
      case 'rewards':
        return widget.entries.where((e) => e.isIncome || e.isQueue).toList();
      case 'splits':
        return widget.entries.where((e) => e.isSplit).toList();
      default:
        return widget.entries;
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

  void _nextPage() {
    if (_page < _totalPages - 1) setState(() => _page++);
  }

  void _prevPage() {
    if (_page > 0) setState(() => _page--);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: Nocturne.walletGradient,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Nocturne.borderCard),
        boxShadow: Nocturne.cardShadow,
      ),
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Activity History',
                style: TextStyle(
                  color: Nocturne.text,
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              GestureDetector(
                onTap: widget.onOpenFullLedger,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                  decoration: BoxDecoration(
                    color: Nocturne.goldWash,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: const Color(0xFF4A3A1A)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_rounded,
                          color: Nocturne.goldLight, size: 13),
                      SizedBox(width: 6),
                      Text(
                        'Open Full Ledger',
                        style: TextStyle(
                          color: Nocturne.goldLight,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          _FilterChips(
            selected: _filter,
            onSelected: _setFilter,
          ),
          const SizedBox(height: 10),
          if (_filtered.isEmpty)
            _buildEmpty()
          else
            Column(
              children: _paged
                  .map((e) => _ActivityRow(
                        entry: e,
                        vptPrice: widget.vptPrice,
                        hideBalances: widget.hideBalances,
                        onTap: () => _showDetail(context, e),
                      ))
                  .toList(),
            ),
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
              '5 entries per page · tap any entry for the full explanation',
              style: TextStyle(
                color: Nocturne.textHint,
                fontSize: 10.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 34),
      alignment: Alignment.center,
      child: Column(
        children: [
          Icon(Icons.receipt_long_rounded,
              color: Nocturne.textHint, size: 44),
          const SizedBox(height: 12),
          const Text(
            'No wallet activity yet',
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

  void _showDetail(BuildContext context, LedgerEntryModel entry) {
    final detail = WalletDetail.fromLedgerEntry(
      entry,
      vptPrice: widget.vptPrice,
    );
    showWalletDetailSheet(context, detail);
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
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
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

class _ActivityRow extends StatelessWidget {
  final LedgerEntryModel entry;
  final double vptPrice;
  final bool hideBalances;
  final VoidCallback onTap;

  const _ActivityRow({
    required this.entry,
    required this.vptPrice,
    required this.hideBalances,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final (icon, tint, bg) = _iconForType(entry.type);
    final amount = _primaryAmount();
    final approx = _approx();
    final isIn = entry.direction == 'in' || entry.isIncome;
    final dotColor = isIn ? Nocturne.green : Nocturne.goldLight;
    final amountColor = isIn ? Nocturne.green : Nocturne.text;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 11),
        decoration: BoxDecoration(
          color: const Color(0x06FFFFFF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Nocturne.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: tint, size: 15),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.typeLabel,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _note(),
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 10.5,
                      height: 1.3,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  hideBalances ? '••••' : amount,
                  style: TextStyle(
                    color: amountColor,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (approx.isNotEmpty && !hideBalances) ...[
                  const SizedBox(height: 2),
                  Text(
                    approx,
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 9.5,
                    ),
                  ),
                ],
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
                        fontSize: 9.5,
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

  String _note() {
    if (entry.description != null && entry.description!.isNotEmpty) {
      return entry.description!;
    }
    return _typeNote();
  }

  String _typeNote() {
    switch (entry.type) {
      case 'PLAN_PAYMENT':
        return 'Subscription or plan payment via wallet.';
      case 'SPLIT':
        return 'Community pool split processed.';
      case 'VPT_QUEUE':
        return 'vPT reward queued for distribution.';
      case 'VPT_DISTRIBUTION':
        return 'Queued vPT distributed to balance.';
      case 'WITHDRAWAL':
        return 'Cash withdrawal request.';
      case 'REFERRAL_EARNING':
        return 'Referral reward credited.';
      case 'SUBSCRIBER_VPT_REWARD':
        return 'Subscriber vPT reward.';
      case 'VIEWER_REWARD':
      case 'VIEWER_REWARD_BATCH':
        return 'Viewer reward from watch activity.';
      case 'GIFT_SENT_VPT':
      case 'GIFT_SENT_NGN':
        return 'Gift sent to a creator or user.';
      case 'GIFT_RECEIVED_VPT':
      case 'GIFT_RECEIVED_NGN':
        return 'Gift received into wallet.';
      default:
        return 'Wallet activity recorded.';
    }
  }

  String _primaryAmount() {
    final effectiveVpt = entry.amountVpt > 0
        ? entry.amountVpt
        : entry.amountVptUnits.toDouble();
    if (effectiveVpt > 0) {
      return '${walletFormatAmount(effectiveVpt)} vPT';
    } else if (entry.amountNgn > 0) {
      return '₦${walletFormatAmount(entry.amountNgn)}';
    }
    return '—';
  }

  String _approx() {
    final effectiveVpt = entry.amountVpt > 0
        ? entry.amountVpt
        : entry.amountVptUnits.toDouble();
    if (effectiveVpt > 0) {
      return '≈ ₦${walletFormatAmount(effectiveVpt * vptPrice)}';
    } else if (entry.amountNgn > 0) {
      return '≈ ${walletFormatAmount(entry.amountNgn / vptPrice)} vPT';
    }
    return '';
  }

  (IconData, Color, Color) _iconForType(String type) {
    switch (type) {
      case 'PLAN_PAYMENT':
        return (Icons.credit_card_rounded, Nocturne.text, const Color(0x18FFFFFF));
      case 'SPLIT':
        return (Icons.pie_chart_rounded, Nocturne.green, Nocturne.greenWash);
      case 'VPT_QUEUE':
        return (Icons.schedule_rounded, Nocturne.goldLight, Nocturne.goldWash);
      case 'VPT_SWAP':
        return (Icons.swap_horiz_rounded, Nocturne.blue, const Color(0x227FC4FF));
      case 'VPT_DISTRIBUTION':
        return (Icons.token_rounded, Nocturne.gold, Nocturne.goldWash);
      case 'WALLET_CREATED':
        return (Icons.account_balance_wallet_rounded, Nocturne.blue, const Color(0x227FC4FF));
      case 'SWAP_FAILED':
      case 'DISTRIBUTION_FAILED':
        return (Icons.error_outline_rounded, Nocturne.red, const Color(0x25E2543F));
      case 'REFERRAL_EARNING':
      case 'SUBSCRIBER_VPT_REWARD':
      case 'GIFT_RECEIVED_VPT':
      case 'GIFT_RECEIVED_NGN':
      case 'WALLET_FUND':
      case 'VIEWER_REWARD':
      case 'VIEWER_REWARD_BATCH':
        return (Icons.card_giftcard_rounded, Nocturne.green, Nocturne.greenWash);
      case 'GIFT_SENT_VPT':
      case 'GIFT_SENT_NGN':
      case 'WITHDRAWAL':
        return (Icons.receipt_long_rounded, Nocturne.redSoft, const Color(0x25E2543F));
      default:
        return (Icons.receipt_long_rounded, Nocturne.textFaint, const Color(0x18FFFFFF));
    }
  }
}
