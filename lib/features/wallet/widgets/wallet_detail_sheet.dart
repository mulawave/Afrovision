import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/ledger_entry_model.dart';
import '../models/withdrawal_model.dart';

class WalletDetailRow {
  final String label;
  final String value;

  const WalletDetailRow({required this.label, required this.value});
}

class WalletDetail {
  final String title;
  final String note;
  final IconData icon;
  final Color iconTint;
  final Color iconBg;
  final String amount;
  final String? approx;
  final Color amountColor;
  final List<WalletDetailRow> rows;
  final String explain;

  const WalletDetail({
    required this.title,
    required this.note,
    required this.icon,
    required this.iconTint,
    required this.iconBg,
    required this.amount,
    this.approx,
    required this.amountColor,
    required this.rows,
    required this.explain,
  });

  factory WalletDetail.fromLedgerEntry(
    LedgerEntryModel entry, {
    required double vptPrice,
    String? amount,
    String? approx,
  }) {
    final (icon, tint, bg) = _ledgerIcon(entry.type);
    final effectiveVpt = entry.amountVpt > 0
        ? entry.amountVpt
        : entry.amountVptUnits.toDouble();
    final (n, x) = _ledgerNoteAndExplain(entry);
    final primary = amount ?? _ledgerPrimaryAmount(entry, effectiveVpt);
    final secondary = approx ?? _ledgerApprox(entry, effectiveVpt, vptPrice);

    final rows = <WalletDetailRow>[
      WalletDetailRow(label: 'Status', value: entry.statusLabel),
      WalletDetailRow(label: 'Category', value: entry.typeLabel),
      if (entry.direction != null && entry.direction!.isNotEmpty)
        WalletDetailRow(
          label: 'Direction',
          value: entry.direction!.toUpperCase(),
        ),
      if (entry.referenceId != null && entry.referenceId!.isNotEmpty)
        WalletDetailRow(label: 'Reference', value: entry.referenceId!),
      if (entry.channelId != null && entry.channelId!.isNotEmpty)
        WalletDetailRow(label: 'Channel', value: entry.channelId!),
      if (effectiveVpt > 0)
        WalletDetailRow(
          label: 'vPT Amount',
          value: '${_formatNum(effectiveVpt)} vPT',
        ),
      if (entry.amountNgn > 0)
        WalletDetailRow(
          label: 'NGN Amount',
          value: '₦${_formatNum(entry.amountNgn)}',
        ),
      if (entry.txHash != null && entry.txHash!.isNotEmpty)
        WalletDetailRow(label: 'Transaction Hash', value: entry.txHash!),
      if (entry.description != null && entry.description!.isNotEmpty)
        WalletDetailRow(label: 'Description', value: entry.description!),
      WalletDetailRow(
        label: 'Recorded',
        value: _formatDate(entry.createdAt),
      ),
    ];

    return WalletDetail(
      title: entry.typeLabel,
      note: n,
      icon: icon,
      iconTint: tint,
      iconBg: bg,
      amount: primary,
      approx: secondary,
      amountColor: entry.isIncome ? Nocturne.green : Nocturne.text,
      rows: rows,
      explain: x,
    );
  }

  factory WalletDetail.fromWithdrawal(
    WithdrawalModel w, {
    required Color statusColor,
  }) {
    final rows = <WalletDetailRow>[
      WalletDetailRow(label: 'Status', value: w.statusLabel),
      const WalletDetailRow(label: 'Category', value: 'Withdrawal'),
      const WalletDetailRow(label: 'Direction', value: 'OUT'),
      if (w.bankName != null && w.bankName!.isNotEmpty)
        WalletDetailRow(label: 'Bank', value: w.bankName!),
      if (w.accountName != null && w.accountName!.isNotEmpty)
        WalletDetailRow(label: 'Account Name', value: w.accountName!),
      if (w.accountNumberMasked != null && w.accountNumberMasked!.isNotEmpty)
        WalletDetailRow(
          label: 'Account Number',
          value: w.accountNumberMasked!,
        ),
      if (w.totalFees > 0)
        WalletDetailRow(
          label: 'Fees',
          value: '₦${_formatNum(w.totalFees)}',
        ),
      if (w.vatAmount > 0)
        WalletDetailRow(
          label: 'VAT',
          value: '₦${_formatNum(w.vatAmount)}',
        ),
      if (w.totalDebit > 0)
        WalletDetailRow(
          label: 'Total Debited',
          value: '₦${_formatNum(w.totalDebit)}',
        ),
      WalletDetailRow(
        label: 'Recorded',
        value: _formatDate(w.createdAt),
      ),
    ];

    return WalletDetail(
      title: 'Withdrawal',
      note: 'Cash withdrawal to bank',
      icon: Icons.account_balance_rounded,
      iconTint: statusColor,
      iconBg: statusColor.withValues(alpha: 0.12),
      amount: '₦${_formatNum(w.amount)}',
      approx: null,
      amountColor: statusColor,
      rows: rows,
      explain:
          'A request to move cash from your wallet to your verified bank account. Status updates once the team reviews it.',
    );
  }

  static (String, String) _ledgerNoteAndExplain(LedgerEntryModel entry) {
    switch (entry.type) {
      case 'PLAN_PAYMENT':
        return (
          'Subscription or plan payment entering the AfroVision economy.',
          'This records a subscription or plan payment entering the AfroVision economy.'
        );
      case 'SPLIT':
        return (
          'Community-pool split derived from a processed payment.',
          'This is a community-pool split derived from a processed payment.'
        );
      case 'VPT_QUEUE':
        return (
          'Queued vPT waiting for blockchain distribution.',
          'This vPT reward has been queued and is waiting for blockchain distribution.'
        );
      case 'VPT_DISTRIBUTION':
        return (
          'Queued vPT distributed into your on-chain balance.',
          'This queued vPT has already been distributed into your main on-chain vPT balance.'
        );
      case 'GIFT_RECEIVED_VPT':
        return (
          'Off-chain vPT added from a received gift.',
          'This entry added off-chain gift-wallet vPT to your account from a received gift.'
        );
      case 'GIFT_SENT_VPT':
        return (
          'Off-chain vPT sent to another user.',
          'This entry reduced your gift-wallet vPT because you sent vPT to another user.'
        );
      case 'GIFT_RECEIVED_NGN':
        return (
          'Cash credited to your gift wallet in naira.',
          'This entry credited cash into your gift wallet in naira.'
        );
      case 'GIFT_SENT_NGN':
        return (
          'Naira debited from your gift wallet for a sent gift.',
          'This entry debited naira from your gift wallet for a sent gift.'
        );
      case 'WITHDRAWAL':
        return (
          'Cash withdrawal request from your wallet.',
          'This entry tracks a cash withdrawal request from your available wallet balance.'
        );
      case 'REFERRAL_EARNING':
        return (
          'Referral reward credited as off-chain vPT.',
          'This is a referral reward entry credited into your off-chain vPT balance.'
        );
      case 'SUBSCRIBER_VPT_REWARD':
        return (
          'Subscriber reward credited as off-chain vPT.',
          'This is a subscriber reward allocation credited into your off-chain vPT balance.'
        );
      case 'VIEWER_REWARD':
      case 'VIEWER_REWARD_BATCH':
        return (
          'Viewer reward credited through the reward engine.',
          'This entry came from viewer reward activity credited through the platform reward engine.'
        );
      case 'WALLET_FUND':
        return (
          'Direct wallet funding event.',
          'This entry reflects a direct wallet funding event recorded by the system.'
        );
      default:
        final desc = entry.description?.isNotEmpty == true
            ? entry.description!
            : 'Wallet activity entry.';
        return (desc, desc);
    }
  }

  static (IconData, Color, Color) _ledgerIcon(String type) {
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
        return (Icons.receipt_long_rounded, Nocturne.redSoft, const Color(0x25E2543F));
      default:
        return (Icons.receipt_long_rounded, Nocturne.textFaint, const Color(0x18FFFFFF));
    }
  }

  static String _ledgerPrimaryAmount(LedgerEntryModel entry, double effectiveVpt) {
    if (effectiveVpt > 0) {
      return '${_formatNum(effectiveVpt)} vPT';
    } else if (entry.amountNgn > 0) {
      return '₦${_formatNum(entry.amountNgn)}';
    }
    return '—';
  }

  static String _ledgerApprox(
    LedgerEntryModel entry,
    double effectiveVpt,
    double vptPrice,
  ) {
    if (effectiveVpt > 0) {
      return '≈ ₦${_formatNum(effectiveVpt * vptPrice)}';
    } else if (entry.amountNgn > 0) {
      final vptEquiv = entry.amountNgn / vptPrice;
      return '≈ ${_formatNum(vptEquiv)} vPT';
    }
    return '';
  }

  static String _formatDate(int ms) {
    final dt = DateTime.fromMillisecondsSinceEpoch(ms);
    final m = dt.minute.toString().padLeft(2, '0');
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour}:$m';
  }

  static String _formatNum(double value) {
    if (value == 0) return '0';
    if (value < 1 && value > 0) return value.toStringAsFixed(4);
    if (value == value.roundToDouble()) return value.toInt().toString();
    return value.toStringAsFixed(2);
  }

}

void showWalletDetailSheet(BuildContext context, WalletDetail detail) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => WalletDetailSheet(detail: detail),
  );
}

class WalletDetailSheet extends StatelessWidget {
  final WalletDetail detail;

  const WalletDetailSheet({super.key, required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Nocturne.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        boxShadow: [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 24,
            offset: Offset(0, -4),
          ),
        ],
        border: Border(
          top: BorderSide(color: Nocturne.borderStrong, width: 1),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 30),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: Nocturne.gold,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: detail.iconBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Icon(detail.icon, color: detail.iconTint, size: 19),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        detail.title,
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        detail.note,
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 11.5,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      detail.amount,
                      style: TextStyle(
                        color: detail.amountColor,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (detail.approx != null && detail.approx!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        detail.approx!,
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(
                color: const Color(0x06FFFFFF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Nocturne.border),
              ),
              child: Column(
                children: detail.rows.asMap().entries.map((e) {
                  final row = e.value;
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 13,
                      vertical: 11,
                    ),
                    decoration: BoxDecoration(
                      border: e.key != detail.rows.length - 1
                          ? const Border(
                              bottom: BorderSide(color: Nocturne.border),
                            )
                          : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          row.label,
                          style: const TextStyle(
                            color: Nocturne.textFaint,
                            fontSize: 12.5,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Flexible(
                          child: Text(
                            row.value,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Nocturne.text,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              detail.explain,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 11.5,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 18),
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: const Color(0x06FFFFFF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Nocturne.border),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'Close',
                  style: TextStyle(
                    color: Nocturne.textDim,
                    fontSize: 13,
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
