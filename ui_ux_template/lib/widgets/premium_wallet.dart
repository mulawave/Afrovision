// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — WALLET & FINANCE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  BALANCE HERO CARD — large balance display with gradient & glow.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumBalanceCard extends StatelessWidget {
  final String title;
  final String balance;
  final String? subtitle;
  final IconData icon;
  final Color? accentColor;
  final List<Widget>? actions;

  const PremiumBalanceCard({
    super.key,
    required this.title,
    required this.balance,
    this.subtitle,
    this.icon = Icons.account_balance_wallet_rounded,
    this.accentColor,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final s = PremiumTheme.shadows;
    final color = accentColor ?? c.accent;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.15),
            color.withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.25)),
        boxShadow: [s.heroCardGlow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title.toUpperCase(),
                      style: ts.caption.copyWith(
                        color: color.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(balance, style: ts.largeAmount),
                  ],
                ),
              ),
            ],
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Text(subtitle!, style: ts.bodySecondary),
          ],
          if (actions != null) ...[
            const SizedBox(height: 20),
            Row(
              children:
                  actions!
                      .expand(
                        (w) => [Expanded(child: w), const SizedBox(width: 12)],
                      )
                      .toList()
                    ..removeLast(),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSACTION / LEDGER ITEM — row with icon, title, amount, and timestamp.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumTransactionItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? description;
  final String amount;
  final bool isPositive;
  final String? timestamp;
  final VoidCallback? onTap;

  const PremiumTransactionItem({
    super.key,
    required this.icon,
    required this.title,
    this.description,
    required this.amount,
    this.isPositive = true,
    this.timestamp,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final amountColor = isPositive ? c.success : c.error;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: amountColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: amountColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: ts.body),
                  if (description != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      description!,
                      style: ts.bodySecondary.copyWith(fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${isPositive ? '+' : '-'}$amount',
                  style: ts.body.copyWith(
                    color: amountColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (timestamp != null) ...[
                  const SizedBox(height: 2),
                  Text(timestamp!, style: ts.tiny),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET ACTION ROW — a row of quick-action circle buttons.
// ─────────────────────────────────────────────────────────────────────────────

class PremiumWalletActions extends StatelessWidget {
  final List<PremiumWalletAction> actions;

  const PremiumWalletActions({super.key, required this.actions});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: actions.map((a) => _ActionButton(action: a)).toList(),
    );
  }
}

class PremiumWalletAction {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;

  const PremiumWalletAction({
    required this.icon,
    required this.label,
    this.onTap,
    this.color,
  });
}

class _ActionButton extends StatelessWidget {
  final PremiumWalletAction action;

  const _ActionButton({required this.action});

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final ts = PremiumTheme.textStyles;
    final color = action.color ?? c.accent;

    return GestureDetector(
      onTap: action.onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
              border: Border.all(color: color.withValues(alpha: 0.25)),
            ),
            child: Icon(action.icon, color: color, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            action.label,
            style: ts.tiny.copyWith(
              color: c.textPrimary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
