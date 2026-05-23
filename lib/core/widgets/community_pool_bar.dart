import 'dart:async';
import 'package:flutter/material.dart';
import '../../features/auth/services/home_service.dart';
import '../theme/app_colors.dart';

class CommunityPoolBar extends StatefulWidget {
  const CommunityPoolBar({super.key});

  @override
  State<CommunityPoolBar> createState() => _CommunityPoolBarState();
}

class _CommunityPoolBarState extends State<CommunityPoolBar>
    with WidgetsBindingObserver {
  HomeCommunityPoolStats? _stats;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final stats = await HomeService.getCommunityPoolStats();
      if (mounted) setState(() => _stats = stats);
    } catch (_) {
      // silent — keep showing last data
    }
  }

  String _formatNum(double n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(2)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(2)}K';
    return n.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    if (_stats == null) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.darkBlue,
            AppColors.lightBlue.withValues(alpha: 0.3),
            AppColors.darkBlue,
          ],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        border: Border(
          bottom: BorderSide(
            color: AppColors.inputBorder.withValues(alpha: 0.15),
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            // Label
            Text(
              'COMMUNITY POOL',
              style: TextStyle(
                color: AppColors.orange,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(width: 16),
            _buildStat(
              Icons.account_balance_wallet_outlined,
              'Balance',
              '${_formatNum(_stats!.totalVpt)} vPT (₦${_formatNum(_stats!.totalNgn)})',
            ),
            const SizedBox(width: 16),
            _buildStat(
              Icons.payments_outlined,
              'Distributed',
              '${_formatNum(_stats!.totalDistributedVpt)} vPT (₦${_formatNum(_stats!.totalDistributedNgn)})',
            ),
            const SizedBox(width: 16),
            _buildStat(
              Icons.people_outline,
              'Beneficiaries',
              _stats!.totalBeneficiaries.toString(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(IconData icon, String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: AppColors.orange.withValues(alpha: 0.6), size: 14),
        const SizedBox(width: 4),
        Text(
          '$label: ',
          style: TextStyle(
            color: AppColors.hintText,
            fontSize: 10,
            fontWeight: FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
