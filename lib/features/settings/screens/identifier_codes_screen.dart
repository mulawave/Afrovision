import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/services/app_preferences_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../../referral/services/referral_service.dart';

/// Account, device and referral codes for this user — separate from the
/// per-channel "My Personal Identifier Codes" (PICs) that unlock purchased
/// exclusive channels; those still live under Profile → My PICs.
class IdentifierCodesScreen extends StatefulWidget {
  const IdentifierCodesScreen({super.key});

  @override
  State<IdentifierCodesScreen> createState() => _IdentifierCodesScreenState();
}

class _IdentifierCodesScreenState extends State<IdentifierCodesScreen> {
  bool _loading = true;
  String _accountId = '';
  String _deviceCode = '';
  String _referralCode = '';
  String _walletReference = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait<dynamic>([
      ProfileService.getProfile().then<UserModel?>((v) => v).catchError((_) => null),
      AppPreferencesService.deviceCode(),
      ReferralService.getMyCode().then<ReferralInfo?>((v) => v).catchError((_) => null),
    ]);
    if (!mounted) return;
    final user = results[0] as UserModel?;
    final referral = results[2] as ReferralInfo?;
    setState(() {
      _accountId = user != null ? _formatAccountId(user) : '';
      _deviceCode = results[1] as String;
      _referralCode = referral?.referralCode ?? '';
      _walletReference = user?.walletReference ?? '';
      _loading = false;
    });
  }

  String _formatAccountId(UserModel user) {
    final raw = user.id.replaceAll('-', '').toUpperCase();
    final short = raw.length >= 8 ? raw.substring(0, 8) : raw.padRight(8, '0');
    final initials = _initials(user);
    final year = DateTime.tryParse(user.createdAt)?.year ?? DateTime.now().year;
    return 'AV-$initials-$short-$year';
  }

  String _initials(UserModel user) {
    if (user.name != null && user.name!.trim().isNotEmpty) {
      final parts = user.name!.trim().split(RegExp(r'\s+'));
      if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    }
    return user.email.substring(0, user.email.length >= 2 ? 2 : 1).toUpperCase();
  }

  void _copy(String label, String value) {
    if (value.isEmpty) return;
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied', style: const TextStyle(color: AppColors.white)),
        backgroundColor: const Color(0xFF5FD39A),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(milliseconds: 1400),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      appBar: AppBar(
        backgroundColor: AppColors.cardBg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: AppColors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Personal Identifier Codes',
          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w600),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.orange.withValues(alpha: 0.25)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.lock_outline_rounded, color: AppColors.orange, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'These codes identify your account and device to AfroVision '
                          'support. Never share them in public channels or chats.',
                          style: TextStyle(color: AppColors.white, fontSize: 12.5),
                        ),
                      ),
                    ],
                  ),
                ),
                _codeCard(
                  label: 'ACCOUNT IDENTIFIER',
                  note: 'Your permanent AfroVision ID',
                  value: _accountId,
                  icon: Icons.badge_rounded,
                ),
                _codeCard(
                  label: 'DEVICE CODE',
                  note: 'This device only',
                  value: _deviceCode,
                  icon: Icons.smartphone_rounded,
                ),
                _codeCard(
                  label: 'REFERRAL CODE',
                  note: 'Share to earn across 5 levels',
                  value: _referralCode,
                  icon: Icons.card_giftcard_rounded,
                  onTapCard: () => Navigator.pushNamed(context, '/referral'),
                ),
                _codeCard(
                  label: 'WALLET REFERENCE',
                  note: 'Identifies you for inter-wallet transfers and financial tracking',
                  value: _walletReference,
                  icon: Icons.account_balance_wallet_rounded,
                ),
              ],
            ),
    );
  }

  Widget _codeCard({
    required String label,
    required String note,
    required String value,
    required IconData icon,
    VoidCallback? onTapCard,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: onTapCard,
            child: Row(
              children: [
                Icon(icon, color: AppColors.lightOrange, size: 16),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 3),
          Text(
            note,
            style: TextStyle(color: AppColors.white.withValues(alpha: 0.5), fontSize: 11.5),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value.isEmpty ? '—' : value,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => _copy(label, value),
                  icon: const Icon(Icons.copy_rounded, color: AppColors.lightOrange, size: 18),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
