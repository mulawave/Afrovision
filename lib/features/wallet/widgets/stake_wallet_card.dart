import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../utils/wallet_format.dart';

class StakeWalletCard extends StatelessWidget {
  final double stakedVpt;
  final double totalMinted;
  final bool hideBalances;

  const StakeWalletCard({
    super.key,
    required this.stakedVpt,
    required this.totalMinted,
    this.hideBalances = false,
  });

  @override
  Widget build(BuildContext context) {
    final progress = totalMinted > 0 ? stakedVpt / totalMinted : 0.0;
    final share = totalMinted > 0 ? (stakedVpt / totalMinted) * 100 : 0.0;

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2A1F52), Color(0xFF1A1436)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.all(Radius.circular(16)),
        border: const Border.fromBorderSide(
          BorderSide(color: Color(0xFF4B3A86)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: const Color(0xFF8B5CF6).withValues(alpha: 0.18),
            blurRadius: 28,
            spreadRadius: -8,
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0x29A77CFF),
                  borderRadius: BorderRadius.circular(11),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.pie_chart_rounded,
                  color: Color(0xFFC0A4FF),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'STAKE WALLET',
                      style: TextStyle(
                        color: Color(0xFFC0A4FF),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Token Equity Position',
                      style: TextStyle(
                        color: Nocturne.text,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0x08FFFFFF),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFF7A5FC4)),
                ),
                child: const Text(
                  'ON-CHAIN',
                  style: TextStyle(
                    color: Color(0xFFD5C4FF),
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            hideBalances ? '••••••' : walletFormatAmount(stakedVpt),
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 25,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.02,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'vPT tokens staked',
            style: TextStyle(
              color: Color(0xFFB3A3DD),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 11),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Container(
              height: 6,
              color: const Color(0x18FFFFFF),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: progress.clamp(0.0, 1.0),
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF8B5CF6), Color(0xFFC4A2FF)],
                    ),
                    borderRadius: BorderRadius.all(Radius.circular(4)),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'EQUITY SHARE',
                    style: TextStyle(
                      color: Color(0xFFB3A3DD),
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.9,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${walletFormatAmount(share)}%',
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'TOTAL MINTED',
                    style: TextStyle(
                      color: Color(0xFFB3A3DD),
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.9,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    walletFormatAmount(totalMinted),
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 11),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0x0DFFFFFF),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_rounded, color: Color(0xFFC0A4FF), size: 14),
                SizedBox(width: 9),
                Expanded(
                  child: Text(
                    'Your proportional equity in the entire vPT ecosystem against the total supply.',
                    style: TextStyle(
                      color: Color(0xFFCFC3EE),
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
