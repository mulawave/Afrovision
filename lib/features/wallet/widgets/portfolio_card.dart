import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../utils/wallet_format.dart';

class PortfolioCard extends StatelessWidget {
  final double portfolioValue;
  final double onChainVpt;
  final double offChainVpt;
  final double ravens;
  final double cash;
  final double vptPrice;
  final double ravenNgnRate;
  final bool isPremium;
  final bool hideBalances;
  final VoidCallback onTopUp;
  final VoidCallback onConvert;
  final VoidCallback onWithdraw;
  final void Function(String key) onBalanceTap;

  const PortfolioCard({
    super.key,
    required this.portfolioValue,
    required this.onChainVpt,
    required this.offChainVpt,
    required this.ravens,
    required this.cash,
    required this.vptPrice,
    required this.ravenNgnRate,
    required this.isPremium,
    required this.hideBalances,
    required this.onTopUp,
    required this.onConvert,
    required this.onWithdraw,
    required this.onBalanceTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: Nocturne.walletGradient,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Nocturne.gold.withValues(alpha: 0.2)),
        boxShadow: [
          ...Nocturne.cardShadow,
          BoxShadow(
            color: Nocturne.gold.withValues(alpha: 0.1),
            blurRadius: 26,
            spreadRadius: -8,
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'OFF-CHAIN PORTFOLIO VALUE',
                      style: TextStyle(
                        color: Nocturne.gold,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      hideBalances
                          ? '••••••'
                          : '₦${walletFormatAmount(portfolioValue)}',
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 29,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.02,
                      ),
                    ),
                  ],
                ),
              ),
              if (isPremium) _PremiumPill(),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'vPT ${walletFormatAmount(onChainVpt + offChainVpt)} × ₦${walletFormatAmount(vptPrice)} · '
            'Ravens ${walletFormatAmount(ravens)} × ₦${walletFormatAmount(ravenNgnRate)} · '
            'Cash ₦${walletFormatAmount(cash)}',
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 2.2,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            children: [
              _BalanceTile(
                label: 'On-chain vPT',
                value: hideBalances
                    ? '••••'
                    : walletFormatAmount(onChainVpt),
                sub: '≈ ₦${walletFormatAmount(onChainVpt * vptPrice)}',
                icon: Icons.token_rounded,
                tint: Nocturne.goldLight,
                onTap: () => onBalanceTap('onchain'),
              ),
              _BalanceTile(
                label: 'Off-chain vPT',
                value: hideBalances
                    ? '••••'
                    : walletFormatAmount(offChainVpt),
                sub: 'Gifts & rewards',
                icon: Icons.card_giftcard_rounded,
                tint: Nocturne.blue,
                onTap: () => onBalanceTap('offchain'),
              ),
              _BalanceTile(
                label: 'Ravens',
                value: hideBalances ? '••••' : walletFormatAmount(ravens),
                sub: '75 Ravens = 1 vPT',
                icon: Icons.flutter_dash_rounded,
                tint: Nocturne.goldLight,
                onTap: () => onBalanceTap('ravens'),
              ),
              _BalanceTile(
                label: 'Cash wallet',
                value: hideBalances ? '••••' : '₦${walletFormatAmount(cash)}',
                sub: 'Instant NGN',
                icon: Icons.account_balance_wallet_rounded,
                tint: Nocturne.green,
                onTap: () => onBalanceTap('cash'),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Row(
            children: [
              Expanded(
                child: _OutlineAction(
                  icon: Icons.add_circle_outline_rounded,
                  label: 'Top Up',
                  onTap: onTopUp,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _OutlineAction(
                  icon: Icons.swap_horiz_rounded,
                  label: 'Convert',
                  onTap: onConvert,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: _GoldCta(
                  icon: Icons.account_balance_rounded,
                  label: 'Withdraw',
                  onTap: onWithdraw,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PremiumPill extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0x292F9E6B),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: const Color(0x529FD39A),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified_rounded, color: Nocturne.green, size: 11),
          const SizedBox(width: 5),
          const Text(
            'PREMIUM',
            style: TextStyle(
              color: Nocturne.green,
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _BalanceTile extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;

  const _BalanceTile({
    required this.label,
    required this.value,
    required this.sub,
    required this.icon,
    required this.tint,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              tint.withValues(alpha: 0.14),
              tint.withValues(alpha: 0.03),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: tint.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(icon, size: 13, color: tint),
                const SizedBox(width: 7),
                Text(
                  label,
                  style: TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.9,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              value,
              style: const TextStyle(
                color: Nocturne.text,
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.01,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              sub,
              style: const TextStyle(
                color: Nocturne.textHint,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OutlineAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _OutlineAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          color: const Color(0x06FFFFFF),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Nocturne.borderStrong),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: Nocturne.textDim),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: Nocturne.textDim,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoldCta extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _GoldCta({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: const BoxDecoration(
          gradient: Nocturne.goldCta,
          borderRadius: BorderRadius.all(Radius.circular(11)),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: Color(0xFF26170A)),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: Color(0xFF26170A),
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
