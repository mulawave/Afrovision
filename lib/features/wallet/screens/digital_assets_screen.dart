import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_pagination_controls.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../models/ledger_entry_model.dart';
import '../services/wallet_service.dart';
import '../widgets/import_wallet_sheet.dart';
import '../widgets/connect_wallet_sheet.dart';
import '../widgets/transfer_sheet.dart';
import 'ravens_to_vpt_screen.dart';

class DigitalAssetsScreen extends StatefulWidget {
  const DigitalAssetsScreen({super.key});

  @override
  State<DigitalAssetsScreen> createState() => _DigitalAssetsScreenState();
}

class _DigitalAssetsScreenState extends State<DigitalAssetsScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  static const int _pageSize = 5;

  UserModel? _user;
  List<LedgerEntryModel> _ledger = [];
  Map<String, dynamic>? _wallet;
  Map<String, dynamic>? _blockchainPreflight;
  String? _blockchainPreflightError;
  Map<String, dynamic>? _giftWallet;
  Map<String, dynamic> _exchangeRates = {};
  Map<String, dynamic>? _connectedWallet;
  bool _loading = true;
  String? _error;
  String _filter = 'all';
  int _activityPage = 0;

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
      final profile = await ProfileService.getProfile();
      final results = await Future.wait([
        WalletService.getLedger(),
        WalletService.getMyWallet(),
        WalletService.getGiftWalletBalance(),
        WalletService.getExchangeRates().catchError((_) => <String, dynamic>{}),
      ]);
      Map<String, dynamic>? blockchainPreflight;
      String? blockchainPreflightError;

      if (profile.isAdmin) {
        try {
          blockchainPreflight = await WalletService.getBlockchainPreflight();
        } catch (e) {
          blockchainPreflightError = e.toString();
        }
      }

      if (!mounted) return;
      final giftWallet = results[2] as Map<String, dynamic>?;
      setState(() {
        _user = profile;
        _ledger = results[0] as List<LedgerEntryModel>;
        _wallet = results[1] as Map<String, dynamic>?;
        _giftWallet = giftWallet;
        _exchangeRates = (results[3] as Map<String, dynamic>?) ?? {};
        _connectedWallet =
            giftWallet?['connected_wallet'] as Map<String, dynamic>?;
        _blockchainPreflight = blockchainPreflight;
        _blockchainPreflightError = blockchainPreflightError;
        _activityPage = 0;
        _loading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  // ─── Live exchange rate getters (fall back to known defaults) ───────────
  double get _vptPrice => _safeDouble(_exchangeRates['vpt_price_ngn']) > 0
      ? _safeDouble(_exchangeRates['vpt_price_ngn'])
      : 750;
  double get _ravenNgnRate => _safeDouble(_exchangeRates['raven_ngn_rate']) > 0
      ? _safeDouble(_exchangeRates['raven_ngn_rate'])
      : 10;
  double get _vptRavenRate => _safeDouble(_exchangeRates['vpt_raven_rate']) > 0
      ? _safeDouble(_exchangeRates['vpt_raven_rate'])
      : 75;

  List<LedgerEntryModel> get _filteredLedger {
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

  static double _safeDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  double get _onChainVptBalance => _user?.vptBalance ?? 0;

  /// Off-chain vPT is the single ledger-facing vPT bucket shown to users.
  double get _offChainVptBalance => _giftWalletVptBalance;

  double get _giftWalletVptBalance => _safeDouble(_giftWallet?['vpt']);

  double get _cashWalletBalance => _safeDouble(_giftWallet?['cash']);

  double get _ravensBalance => _safeDouble(_giftWallet?['coins']);

  /// Stake wallet — reads strictly from blockchain_tokens only.
  String? get _stakeWalletRaw => _giftWallet?['blockchain_tokens'] as String?;

  static const int _totalMintedVpt = 400000000; // 400 million vPT

  /// vPT balance as a number.
  double get _stakeWalletVptNum {
    final raw = _stakeWalletRaw;
    if (raw == null || raw.isEmpty) return 0;
    return double.tryParse(raw) ?? 0;
  }

  /// Equity percentage of total 400M minted vPT.
  double get _stakeEquityPercent {
    final vpt = _stakeWalletVptNum;
    if (vpt <= 0) return 0;
    return (vpt / _totalMintedVpt) * 100;
  }

  /// Formatted stake balance string — human-readable with commas.
  String get _stakeWalletFormatted {
    final vpt = _stakeWalletVptNum;
    if (vpt <= 0) return '0';
    final intVpt = vpt.toInt();
    final str = intVpt.toString();
    final buf = StringBuffer();
    for (var i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buf.write(',');
      buf.write(str[i]);
    }
    return buf.toString();
  }

  double _entryVptAmount(LedgerEntryModel entry) {
    if (entry.amountVpt > 0) return entry.amountVpt;
    return entry.amountVptUnits;
  }

  List<LedgerEntryModel> get _pagedFilteredLedger {
    final start = _activityPage * _pageSize;
    return _filteredLedger.skip(start).take(_pageSize).toList();
  }

  int get _activityPageCount => _filteredLedger.isEmpty
      ? 1
      : ((_filteredLedger.length - 1) ~/ _pageSize) + 1;

  double _sumSuccessfulVptForTypes(List<String> types) {
    return _ledger
        .where((entry) => entry.isSuccess && types.contains(entry.type))
        .fold(0.0, (sum, entry) => sum + _entryVptAmount(entry));
  }

  double get _giftReceivedVpt =>
      _sumSuccessfulVptForTypes(['GIFT_RECEIVED_VPT']);

  double get _walletFundedVpt => _sumSuccessfulVptForTypes(['WALLET_FUND']);

  double get _viewerRewardVpt =>
      _sumSuccessfulVptForTypes(['VIEWER_REWARD', 'VIEWER_REWARD_BATCH']);

  double get _giftSentVpt => _sumSuccessfulVptForTypes(['GIFT_SENT_VPT']);

  double get _trackedGiftWalletNetVpt =>
      _giftReceivedVpt + _walletFundedVpt + _viewerRewardVpt - _giftSentVpt;

  double get _unclassifiedGiftWalletVpt =>
      _giftWalletVptBalance - _trackedGiftWalletNetVpt;

  List<_GiftWalletBreakdownItem> get _giftWalletBreakdown {
    final items = <_GiftWalletBreakdownItem>[];
    if (_giftReceivedVpt > 0) {
      items.add(
        _GiftWalletBreakdownItem(
          label: 'Received Gifts',
          value: _giftReceivedVpt,
          icon: Icons.card_giftcard_rounded,
          color: Color(0xFF64B5F6),
        ),
      );
    }
    if (_walletFundedVpt > 0) {
      items.add(
        _GiftWalletBreakdownItem(
          label: 'Wallet Funding',
          value: _walletFundedVpt,
          icon: Icons.add_card_rounded,
          color: AppColors.orange,
        ),
      );
    }
    if (_viewerRewardVpt > 0) {
      items.add(
        _GiftWalletBreakdownItem(
          label: 'Viewer Rewards',
          value: _viewerRewardVpt,
          icon: Icons.ondemand_video_rounded,
          color: AppColors.lightOrange,
        ),
      );
    }
    if (_giftSentVpt > 0) {
      items.add(
        _GiftWalletBreakdownItem(
          label: 'Sent Out',
          value: -_giftSentVpt,
          icon: Icons.north_east_rounded,
          color: AppColors.errorRed,
        ),
      );
    }
    if (_unclassifiedGiftWalletVpt.abs() >= 0.01) {
      items.add(
        _GiftWalletBreakdownItem(
          label: _unclassifiedGiftWalletVpt >= 0
              ? 'Unclassified Residual'
              : 'Net Adjustment Gap',
          value: _unclassifiedGiftWalletVpt,
          icon: Icons.manage_search_rounded,
          color: AppColors.goldText,
        ),
      );
    }
    return items;
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
                                _buildAssetSnapshotCard(),
                                const SizedBox(height: 16),
                                _buildBalanceCard(),
                                const SizedBox(height: 16),
                                _stakeWalletRaw != null
                                    ? _buildStakeWalletCard()
                                    : _buildEmptyStakeWalletCard(),
                                const SizedBox(height: 16),
                                _buildConnectedWalletCard(),
                                const SizedBox(height: 16),
                                _buildGiftWalletVptCard(),
                                const SizedBox(height: 16),
                                _buildCashBalanceCard(),
                                const SizedBox(height: 16),
                                _buildRavensCard(),
                                if (_user?.isAdmin ?? false) ...[
                                  const SizedBox(height: 16),
                                  _buildBlockchainPreflightCard(),
                                ],
                                const SizedBox(height: 16),
                                _buildWalletCard(),
                                if (_user?.isAdmin ?? false) ...[
                                  const SizedBox(height: 16),
                                  _buildEconomicBreakdown(),
                                ],
                                const SizedBox(height: 20),
                                _buildFilterRow(),
                                const SizedBox(height: 12),
                                _buildTransactionList(),
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

  // ─── App Bar ──────────────────────────────────────────

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
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.3),
                ),
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
              'Digital Assets',
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

  // ─── Stake Wallet Card ──────────────────────────────────

  Widget _buildStakeWalletCard() {
    final equity = _stakeEquityPercent;
    final equityStr = equity >= 0.01
        ? equity.toStringAsFixed(2)
        : equity > 0
        ? equity.toStringAsFixed(6)
        : '0';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF7C3AED).withValues(alpha: 0.18),
            const Color(0xFF4C1D95).withValues(alpha: 0.08),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF7C3AED).withValues(alpha: 0.10),
            blurRadius: 24,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF7C3AED).withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.pie_chart_rounded,
                  color: Color(0xFFA78BFA),
                  size: 26,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'STAKE WALLET',
                      style: TextStyle(
                        color: Color(0xFFA78BFA),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Token Equity Position',
                      style: TextStyle(
                        color: Color(0xFFDDD6FE),
                        fontSize: 12,
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
                  color: const Color(0xFF7C3AED).withValues(alpha: 0.20),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.40),
                  ),
                ),
                child: const Text(
                  'ON-CHAIN',
                  style: TextStyle(
                    color: Color(0xFFA78BFA),
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Token balance
          Text(
            _stakeWalletFormatted,
            style: const TextStyle(
              color: Color(0xFFEDE9FE),
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'vPT tokens staked',
            style: TextStyle(
              color: Color(0xFFA78BFA),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 16),
          // Equity bar
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (equity / 100).clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: const Color(0xFF4C1D95).withValues(alpha: 0.40),
              valueColor: const AlwaysStoppedAnimation<Color>(
                Color(0xFF8B5CF6),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'EQUITY SHARE',
                      style: TextStyle(
                        color: Color(0xFFA78BFA),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$equityStr%',
                      style: const TextStyle(
                        color: Color(0xFFEDE9FE),
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'of 400M total minted vPT',
                      style: TextStyle(
                        color: Color(0xFFDDD6FE),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'TOTAL MINTED',
                    style: TextStyle(
                      color: Color(0xFFA78BFA),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    '400,000,000',
                    style: TextStyle(
                      color: Color(0xFFEDE9FE),
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'vPT',
                    style: TextStyle(
                      color: Color(0xFFA78BFA),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF2E1065).withValues(alpha: 0.45),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: const Color(0xFF7C3AED).withValues(alpha: 0.25),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.info_outline_rounded,
                  color: Color(0xFFA78BFA),
                  size: 12,
                ),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text(
                    'Stake wallet represents your proportional equity in the entire vPT ecosystem against the 400M total supply.',
                    style: TextStyle(
                      color: Color(0xFFDDD6FE),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
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

  // ─── Empty Stake Wallet Card ───────────────────────────

  Widget _buildEmptyStakeWalletCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF7C3AED).withValues(alpha: 0.10),
            const Color(0xFF4C1D95).withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.25),
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF7C3AED).withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.pie_chart_outline_rounded,
              color: Color(0xFFA78BFA),
              size: 32,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Stake Wallet',
            style: TextStyle(
              color: Color(0xFFEDE9FE),
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Import a wallet that already holds vPT on the BSC chain, or generate a new AfroVision wallet address.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFFDDD6FE),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          // Import Wallet button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () =>
                  ImportWalletSheet.show(context, onImported: _loadData),
              icon: const Icon(Icons.link_rounded, size: 18),
              label: const Text('Import Wallet Address'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(
                  0xFF7C3AED,
                ).withValues(alpha: 0.25),
                foregroundColor: const Color(0xFFEDE9FE),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.4),
                  ),
                ),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Generate Wallet button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                try {
                  await WalletService.getMyWallet();
                  if (!mounted) return;
                  _loadData();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text(
                        'Wallet generated',
                        style: TextStyle(color: AppColors.white),
                      ),
                      backgroundColor: AppColors.successGreen.withValues(
                        alpha: 0.9,
                      ),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  );
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        e.toString(),
                        style: const TextStyle(color: AppColors.white),
                      ),
                      backgroundColor: AppColors.errorRed.withValues(
                        alpha: 0.9,
                      ),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.add_circle_outline_rounded, size: 18),
              label: const Text('Generate New Wallet'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFA78BFA),
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: BorderSide(
                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.30),
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Connected Wallet Card ────────────────────────────

  Widget _buildConnectedWalletCard() {
    final connected = _connectedWallet;
    final hasConnection =
        connected != null &&
        connected['address'] != null &&
        (connected['address'] as String).isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasConnection
              ? AppColors.successGreen.withValues(alpha: 0.3)
              : AppColors.inputBorder.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: hasConnection
                      ? AppColors.successGreen.withValues(alpha: 0.12)
                      : AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  hasConnection ? Icons.link_rounded : Icons.link_off_rounded,
                  color: hasConnection
                      ? AppColors.successGreen
                      : AppColors.orange,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'External Wallet',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (hasConnection)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.successGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: AppColors.successGreen,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _walletTypeLabel(
                          connected['type'] as String? ?? 'manual',
                        ),
                        style: const TextStyle(
                          color: AppColors.successGreen,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (hasConnection) ...[
            // Connected address
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      connected['address'] as String,
                      style: const TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'monospace',
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(
                        ClipboardData(text: connected['address'] as String),
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: const Text(
                            'Address copied',
                            style: TextStyle(color: AppColors.white),
                          ),
                          backgroundColor: const Color(
                            0xFF4CAF50,
                          ).withValues(alpha: 0.9),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    },
                    child: const Icon(
                      Icons.copy_rounded,
                      color: AppColors.orange,
                      size: 14,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: _buildConnectedAction(
                    'Transfer',
                    Icons.swap_horiz_rounded,
                    AppColors.successGreen,
                    () => TransferSheet.show(
                      context,
                      connectedAddress: connected['address'] as String,
                      connectedType: connected['type'] as String? ?? 'manual',
                      balances: connected['balances'] as Map<String, dynamic>?,
                      onTransferred: _loadData,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildConnectedAction(
                    'Disconnect',
                    Icons.link_off_rounded,
                    AppColors.errorRed,
                    () => _disconnectWallet(),
                  ),
                ),
              ],
            ),
          ] else ...[
            // Not connected — show connect button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () =>
                    ConnectWalletSheet.show(context, onConnected: _loadData),
                icon: const Icon(
                  Icons.account_balance_wallet_rounded,
                  size: 16,
                ),
                label: const Text('Connect Wallet'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.orange.withValues(alpha: 0.12),
                  foregroundColor: AppColors.orange,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(
                      color: AppColors.orange.withValues(alpha: 0.3),
                    ),
                  ),
                  elevation: 0,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.softBlue.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.softBlue,
                    size: 12,
                  ),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Connect MetaMask, Trust Wallet, or any BSC wallet to transfer BNB and vPT directly.',
                      style: TextStyle(color: AppColors.softBlue, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildConnectedAction(
    String label,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _disconnectWallet() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.darkBlue,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Disconnect Wallet?',
          style: TextStyle(color: AppColors.white, fontSize: 16),
        ),
        content: const Text(
          'Your external wallet will be unlinked. You can reconnect at any time.',
          style: TextStyle(color: AppColors.hintText, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.hintText),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Disconnect',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await WalletService.disconnectExternalWallet();
      if (!mounted) return;
      _loadData();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString(),
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    }
  }

  String _walletTypeLabel(String type) {
    switch (type) {
      case 'metamask':
        return 'MetaMask';
      case 'trust_wallet':
        return 'Trust Wallet';
      case 'walletconnect':
        return 'WalletConnect';
      default:
        return 'Connected';
    }
  }

  // ─── Balance Hero Card ────────────────────────────────

  Widget _buildBalanceCard() {
    final user = _user!;
    final nairaEquiv = _onChainVptBalance * _vptPrice;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.orange.withValues(alpha: 0.15),
            AppColors.lightOrange.withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: AppColors.orange.withValues(alpha: 0.08),
            blurRadius: 24,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.token_rounded,
                  color: AppColors.orange,
                  size: 26,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ON-CHAIN vPT',
                      style: const TextStyle(
                        color: AppColors.lightOrange,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatAmount(_onChainVptBalance)} vPT',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '≈ ₦${_formatAmount(nairaEquiv)}',
                      style: const TextStyle(
                        color: AppColors.goldText,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.darkBlue.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.diamond_rounded,
                  color: AppColors.lightOrange,
                  size: 16,
                ),
                const SizedBox(width: 8),
                Text(
                  user.subscriptionPlan?.toUpperCase() ?? 'NO PLAN',
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: user.hasActiveSubscription
                        ? const Color(0xFF4CAF50).withValues(alpha: 0.15)
                        : AppColors.errorRed.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    user.hasActiveSubscription ? 'ACTIVE' : 'INACTIVE',
                    style: TextStyle(
                      color: user.hasActiveSubscription
                          ? const Color(0xFF4CAF50)
                          : AppColors.errorRed,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.info_outline_rounded,
                color: AppColors.goldText,
                size: 12,
              ),
              const SizedBox(width: 4),
              const Expanded(
                child: Text(
                  'Distributed to your main vPT balance. Off-chain vPT, Ravens, and Cash are shown below.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.goldText,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAssetSnapshotCard() {
    final trackedValueNgn =
        ((_onChainVptBalance + _offChainVptBalance) * _vptPrice) +
        _cashWalletBalance +
        (_ravensBalance * _ravenNgnRate);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Asset Snapshot',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Where each balance lives across AfroVision.',
            style: const TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _assetMetricTile(
                  'On-chain vPT',
                  '${_formatAmount(_onChainVptBalance)} vPT',
                  Icons.token_rounded,
                  AppColors.orange,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _assetMetricTile(
                  'Off-chain vPT',
                  '${_formatAmount(_offChainVptBalance)} vPT',
                  Icons.card_giftcard_rounded,
                  const Color(0xFF64B5F6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _assetMetricTile(
                  'Ravens',
                  _formatAmount(_ravensBalance),
                  Icons.flutter_dash_rounded,
                  AppColors.lightOrange,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _assetMetricTile(
                  'Cash Wallet',
                  '₦${_formatAmount(_cashWalletBalance)}',
                  Icons.account_balance_wallet_rounded,
                  const Color(0xFF4CAF50),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // ── Off-Chain Portfolio Value ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFFE8890C),
                  Color(0xFFF49617),
                  Color(0xFFF5C16C),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFF49617).withValues(alpha: 0.25),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.work_rounded,
                      color: const Color(0xFF2D1600),
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Off-Chain Portfolio Value ≈ ₦${_formatAmount(trackedValueNgn)}',
                      style: const TextStyle(
                        color: Color(0xFF2D1600),
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'vPT (${_formatAmount(_onChainVptBalance + _offChainVptBalance)} × ₦${_formatAmount(_vptPrice)} = ₦${_formatAmount((_onChainVptBalance + _offChainVptBalance) * _vptPrice)})  •  Ravens (${_formatAmount(_ravensBalance)} × ₦${_formatAmount(_ravenNgnRate)} = ₦${_formatAmount(_ravensBalance * _ravenNgnRate)})  •  Cash (₦${_formatAmount(_cashWalletBalance)})',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: const Color(0xFF2D1600).withValues(alpha: 0.7),
                    fontSize: 9,
                    fontWeight: FontWeight.w500,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () async {
                    final result = await Navigator.pushNamed(
                      context,
                      '/checkout',
                      arguments: {
                        'purpose': 'wallet_topup',
                        'title': 'Cash Wallet Top-Up',
                        'balanceType': 'ngn',
                      },
                    );
                    if (result != null && mounted) {
                      await _loadData();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFF4CAF50).withValues(alpha: 0.45),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Top Up Cash',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () async {
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const RavensToVptScreen(),
                      ),
                    );
                    if (result == true && mounted) {
                      await _loadData();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFF64B5F6).withValues(alpha: 0.45),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(
                          Icons.swap_horiz_rounded,
                          color: AppColors.white,
                          size: 14,
                        ),
                        SizedBox(width: 6),
                        Text(
                          'Rav → vPT',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/withdrawals'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Withdraw Cash',
                      style: TextStyle(
                        color: AppColors.darkBlue,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: const Text(
              'Tap any activity entry for the full explanation.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.goldText,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _assetMetricTile(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.inputBorder.withValues(alpha: 0.24),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 10),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Wallet Card ──────────────────────────────────────

  Widget _buildBlockchainPreflightCard() {
    final readiness = _blockchainPreflight;
    final ready = readiness?['ready'] == true;
    final environment = readiness?['environment'] as String? ?? 'staging';
    final missing = _stringList(readiness?['missing']);
    final invalid = _stringList(readiness?['invalid']);
    final chainId = readiness?['chain_id'] as String?;
    final expectedChainId = readiness?['expected_chain_id'] as String?;
    final chainLabel = readiness?['chain_label'] as String?;
    final treasuryAddress = readiness?['treasury_address'] as String?;
    final errorMessage =
        _blockchainPreflightError ?? readiness?['error'] as String?;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: ready
              ? AppColors.lightOrange.withValues(alpha: 0.35)
              : AppColors.orange.withValues(alpha: 0.4),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkBlue.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(
                  Icons.security_rounded,
                  color: AppColors.orange,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Blockchain Preflight',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Admin staging readiness for real swap execution',
                      style: TextStyle(
                        color: AppColors.hintText,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              _buildStatusChip(
                ready ? 'READY' : 'ACTION NEEDED',
                ready ? AppColors.lightOrange : AppColors.orange,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _preflightMetric(
                  'Environment',
                  environment.toUpperCase(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _preflightMetric(
                  'Chain',
                  chainLabel ?? (chainId != null ? 'ID $chainId' : 'Pending'),
                ),
              ),
            ],
          ),
          if (chainId != null || expectedChainId != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow(
              'Chain Validation',
              chainId == null && expectedChainId == null
                  ? 'Pending'
                  : 'Expected ${expectedChainId ?? 'unknown'} • Current ${chainId ?? 'unknown'}',
            ),
          ],
          if (treasuryAddress != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow('Treasury', treasuryAddress, monospace: true),
          ],
          if (missing.isNotEmpty) ...[
            const SizedBox(height: 14),
            _buildTagGroup('Missing Settings', missing),
          ],
          if (invalid.isNotEmpty) ...[
            const SizedBox(height: 14),
            _buildTagGroup('Invalid Values', invalid),
          ],
          if (errorMessage != null && errorMessage.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.35),
                ),
              ),
              child: Text(
                errorMessage,
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildWalletCard() {
    final address = _wallet?['bsc_address'] as String? ?? _user?.bscAddress;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF64B5F6).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: Color(0xFF64B5F6),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'BSC Wallet',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (address != null)
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: address));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text(
                          'Wallet address copied',
                          style: TextStyle(color: AppColors.white),
                        ),
                        backgroundColor: const Color(
                          0xFF4CAF50,
                        ).withValues(alpha: 0.9),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.copy_rounded,
                          color: AppColors.orange,
                          size: 12,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'Copy',
                          style: TextStyle(
                            color: AppColors.orange,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (address != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.2),
                ),
              ),
              child: Text(
                address,
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'monospace',
                  letterSpacing: 0.5,
                ),
              ),
            )
          else
            const Text(
              'No wallet generated yet',
              style: TextStyle(
                color: AppColors.goldText,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }

  // ─── Cash Balance Card ─────────────────────────────────

  Widget _buildGiftWalletVptCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF64B5F6).withValues(alpha: 0.12),
            const Color(0xFF64B5F6).withValues(alpha: 0.04),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFF64B5F6).withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF64B5F6).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.card_giftcard_rounded,
                  color: Color(0xFF64B5F6),
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'OFF-CHAIN vPT',
                      style: TextStyle(
                        color: Color(0xFF64B5F6),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatAmount(_offChainVptBalance)} vPT',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Combined vPT from gifts, rewards, and funding. Convertible to Ravens.',
                      style: TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_giftWalletBreakdown.isNotEmpty) ...[
            const SizedBox(height: 14),
            ..._giftWalletBreakdown.map(_buildGiftBreakdownRow),
          ],
        ],
      ),
    );
  }

  Widget _buildGiftBreakdownRow(_GiftWalletBreakdownItem item) {
    final isNegative = item.value < 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Icon(item.icon, color: item.color, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              item.label,
              style: const TextStyle(
                color: AppColors.goldText,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            '${isNegative ? '-' : '+'}${_formatAmount(item.value.abs())} vPT',
            style: TextStyle(
              color: item.color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCashBalanceCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF4CAF50).withValues(alpha: 0.12),
            const Color(0xFF4CAF50).withValues(alpha: 0.04),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFF4CAF50).withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF4CAF50).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.account_balance_wallet_rounded,
              color: Color(0xFF4CAF50),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CASH BALANCE',
                  style: const TextStyle(
                    color: Color(0xFF4CAF50),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '₦${_formatAmount(_cashWalletBalance)}',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Instant NGN from referral cash, gifts, deals and other rewards',
                  style: const TextStyle(
                    color: AppColors.goldText,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Ravens Card ──────────────────────────────────────

  Widget _buildRavensCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.lightOrange.withValues(alpha: 0.12),
            AppColors.lightOrange.withValues(alpha: 0.04),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.lightOrange.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.lightOrange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.flutter_dash_rounded,
              color: AppColors.lightOrange,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'RAVENS',
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_formatAmount(_ravensBalance)} Ravens',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '1 Raven ≈ ₦${_formatAmount(_ravenNgnRate)}  •  ${_formatAmount(_vptRavenRate)} Ravens = 1 vPT',
                  style: const TextStyle(
                    color: AppColors.goldText,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Economic Breakdown ───────────────────────────────

  Widget _buildEconomicBreakdown() {
    final payments = _ledger.where((e) => e.isPayment && e.isSuccess);
    final splits = _ledger.where((e) => e.isSplit && e.isSuccess);
    final distributions = _ledger.where(
      (e) => e.type == 'VPT_DISTRIBUTION' && e.isSuccess,
    );
    final queued = _ledger.where((e) => e.isQueue && e.isSuccess);

    final totalPaid = payments.fold<double>(0, (sum, e) => sum + e.amountNgn);

    double communityPoolNgn = 0;
    double extractedNgn = 0;
    for (final s in splits) {
      communityPoolNgn += (s.meta['community_pool'] as num?)?.toDouble() ?? 0;
      extractedNgn += s.amountNgn;
    }
    final poolRetainedNgn = communityPoolNgn - extractedNgn;
    final poolRetainedVpt = poolRetainedNgn / _vptPrice;

    final totalDistributedVpt = distributions.fold<double>(
      0,
      (sum, e) => sum + e.amountVpt,
    );
    final totalDistributedNgn = totalDistributedVpt * _vptPrice;

    final totalQueuedNgn = queued.fold<double>(
      0,
      (sum, e) => sum + e.amountNgn,
    );
    final totalQueuedVpt = totalQueuedNgn / _vptPrice;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.pie_chart_rounded,
                color: AppColors.lightOrange,
                size: 18,
              ),
              SizedBox(width: 8),
              Text(
                'Economic Breakdown',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _breakdownRow(
            'Total Subscription',
            '₦${_formatAmount(totalPaid)}',
            Icons.payment_rounded,
            AppColors.white,
          ),
          const SizedBox(height: 10),
          _breakdownRow(
            'Community Pool (70%)',
            '${_formatAmount(poolRetainedVpt)} vPT  (₦${_formatAmount(poolRetainedNgn)})',
            Icons.groups_rounded,
            const Color(0xFF81C784),
          ),
          const SizedBox(height: 10),
          _breakdownRow(
            'vPT Queued (30%)',
            '${_formatAmount(totalQueuedVpt)} vPT  (₦${_formatAmount(totalQueuedNgn)})',
            Icons.schedule_rounded,
            AppColors.lightOrange,
          ),
          const SizedBox(height: 10),
          _breakdownRow(
            'vPT Distributed',
            '${_formatAmount(totalDistributedVpt)} vPT  (₦${_formatAmount(totalDistributedNgn)})',
            Icons.token_rounded,
            AppColors.orange,
          ),
        ],
      ),
    );
  }

  Widget _breakdownRow(String label, String value, IconData icon, Color color) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Filter Row ───────────────────────────────────────

  Widget _buildFilterRow() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Activity History',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _filterChip('All', 'all'),
            _filterChip('Payments', 'payments'),
            _filterChip('Rewards', 'rewards'),
            _filterChip('Splits', 'splits'),
          ],
        ),
      ],
    );
  }

  Widget _filterChip(String label, String value) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() {
        _filter = value;
        _activityPage = 0;
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.orange.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.5)
                : AppColors.inputBorder.withValues(alpha: 0.3),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? AppColors.orange : AppColors.goldText,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  // ─── Transaction List ─────────────────────────────────

  Widget _buildTransactionList() {
    final entries = _pagedFilteredLedger;

    if (_filteredLedger.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: const Column(
          children: [
            Icon(
              Icons.receipt_long_rounded,
              color: AppColors.goldText,
              size: 48,
            ),
            SizedBox(height: 12),
            Text(
              'No transactions yet',
              style: TextStyle(
                color: AppColors.goldText,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        ...entries.map((entry) => _buildTransactionTile(entry)),
        const SizedBox(height: 12),
        AppPaginationControls(
          currentPage: _activityPage,
          totalPages: _activityPageCount,
          onPrevious: _activityPage > 0
              ? () => setState(() => _activityPage -= 1)
              : null,
          onNext: _activityPage < _activityPageCount - 1
              ? () => setState(() => _activityPage += 1)
              : null,
        ),
      ],
    );
  }

  Widget _buildTransactionTile(LedgerEntryModel entry) {
    final iconData = _iconForType(entry.type);
    final color = _colorForType(entry.type);

    // vPT amounts → show as vPT primary + ₦ equiv secondary
    // NGN amounts → show as ₦ primary + vPT equiv secondary
    String primaryAmount;
    String? secondaryAmount;

    final effectiveVpt = entry.amountVpt > 0
        ? entry.amountVpt
        : entry.amountVptUnits.toDouble();

    if (effectiveVpt > 0) {
      primaryAmount = '${_formatAmount(effectiveVpt)} vPT';
      secondaryAmount = '≈ ₦${_formatAmount(effectiveVpt * _vptPrice)}';
    } else if (entry.amountNgn > 0) {
      primaryAmount = '₦${_formatAmount(entry.amountNgn)}';
      final vptEquiv = entry.amountNgn / _vptPrice;
      secondaryAmount = '≈ ${_formatAmount(vptEquiv)} vPT';
    } else {
      primaryAmount = '—';
      secondaryAmount = null;
    }

    return GestureDetector(
      onTap: () => _showEntryDetails(entry),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(iconData, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.typeLabel,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    entry.description ?? _activityExplanation(entry),
                    style: const TextStyle(
                      color: AppColors.goldText,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
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
                  primaryAmount,
                  style: TextStyle(
                    color: entry.isIncome
                        ? const Color(0xFF4CAF50)
                        : AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (secondaryAmount != null) ...[
                  const SizedBox(height: 1),
                  Text(
                    secondaryAmount,
                    style: const TextStyle(
                      color: AppColors.goldText,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: entry.isSuccess
                            ? const Color(0xFF4CAF50)
                            : entry.isPending
                            ? AppColors.lightOrange
                            : AppColors.errorRed,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      entry.timeAgo,
                      style: const TextStyle(
                        color: AppColors.goldText,
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
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

  void _showEntryDetails(LedgerEntryModel entry) {
    final effectiveVpt = _entryVptAmount(entry);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.cardBg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.inputBorder,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  entry.typeLabel,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _activityExplanation(entry),
                  style: const TextStyle(
                    color: AppColors.goldText,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                _detailRow('Status', entry.statusLabel),
                const SizedBox(height: 10),
                _detailRow('Recorded', _dateTimeLabel(entry.createdAt)),
                if (effectiveVpt > 0) ...[
                  const SizedBox(height: 10),
                  _detailRow(
                    'vPT Amount',
                    '${_formatAmount(effectiveVpt)} vPT',
                  ),
                ],
                if (entry.amountNgn > 0) ...[
                  const SizedBox(height: 10),
                  _detailRow(
                    'NGN Amount',
                    '₦${_formatAmount(entry.amountNgn)}',
                  ),
                ],
                if (entry.referenceId != null) ...[
                  const SizedBox(height: 10),
                  _detailRow('Reference', entry.referenceId!),
                ],
                if (entry.channelId != null) ...[
                  const SizedBox(height: 10),
                  _detailRow('Channel', entry.channelId!),
                ],
                if (entry.txHash != null) ...[
                  const SizedBox(height: 10),
                  _detailRow(
                    'Transaction Hash',
                    entry.txHash!,
                    monospace: true,
                  ),
                ],
                if (entry.description != null &&
                    entry.description!.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  _detailRow('Description', entry.description!),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value, {bool monospace = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.goldText,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: AppColors.white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFamily: monospace ? 'monospace' : null,
          ),
        ),
      ],
    );
  }

  String _activityExplanation(LedgerEntryModel entry) {
    switch (entry.type) {
      case 'PLAN_PAYMENT':
        return 'This records a subscription or plan payment entering the AfroVision economy.';
      case 'SPLIT':
        return 'This is a community-pool split derived from a processed payment.';
      case 'VPT_QUEUE':
        return 'This vPT reward has been queued and is waiting for blockchain distribution.';
      case 'VPT_DISTRIBUTION':
        return 'This queued vPT has already been distributed into your main on-chain vPT balance.';
      case 'GIFT_RECEIVED_VPT':
        return 'This entry added off-chain gift-wallet vPT to your account from a received gift.';
      case 'GIFT_SENT_VPT':
        return 'This entry reduced your gift-wallet vPT because you sent vPT to another user.';
      case 'GIFT_RECEIVED_NGN':
        return 'This entry credited cash into your gift wallet in naira.';
      case 'GIFT_SENT_NGN':
        return 'This entry debited naira from your gift wallet for a sent gift.';
      case 'WITHDRAWAL':
        return 'This entry tracks a cash withdrawal request from your available wallet balance.';
      case 'REFERRAL_EARNING':
        return 'This is a referral reward entry credited into your off-chain vPT balance.';
      case 'SUBSCRIBER_VPT_REWARD':
        return 'This is a subscriber reward allocation credited into your off-chain vPT balance.';
      case 'VIEWER_REWARD':
      case 'VIEWER_REWARD_BATCH':
        return 'This entry came from viewer reward activity credited through the platform reward engine.';
      case 'WALLET_FUND':
        return 'This entry reflects a direct wallet funding event recorded by the system.';
      default:
        return entry.description ??
            'This activity was recorded in your asset ledger.';
    }
  }

  String _dateTimeLabel(int timestamp) {
    final dt = DateTime.fromMillisecondsSinceEpoch(timestamp);
    final minute = dt.minute.toString().padLeft(2, '0');
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour}:$minute';
  }

  // ─── Helpers ──────────────────────────────────────────

  IconData _iconForType(String type) {
    switch (type) {
      case 'PLAN_PAYMENT':
        return Icons.payment_rounded;
      case 'SPLIT':
        return Icons.pie_chart_rounded;
      case 'VPT_QUEUE':
        return Icons.schedule_rounded;
      case 'VPT_SWAP':
        return Icons.swap_horiz_rounded;
      case 'VPT_DISTRIBUTION':
        return Icons.token_rounded;
      case 'WALLET_CREATED':
        return Icons.account_balance_wallet_rounded;
      case 'SWAP_FAILED':
      case 'DISTRIBUTION_FAILED':
        return Icons.error_outline_rounded;
      case 'REFERRAL_EARNING':
        return Icons.people_rounded;
      case 'SUBSCRIBER_VPT_REWARD':
        return Icons.card_giftcard_rounded;
      default:
        return Icons.receipt_long_rounded;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'PLAN_PAYMENT':
        return AppColors.white;
      case 'SPLIT':
        return const Color(0xFF81C784);
      case 'VPT_QUEUE':
        return AppColors.lightOrange;
      case 'VPT_SWAP':
        return const Color(0xFF64B5F6);
      case 'VPT_DISTRIBUTION':
        return AppColors.orange;
      case 'WALLET_CREATED':
        return const Color(0xFF64B5F6);
      case 'SWAP_FAILED':
      case 'DISTRIBUTION_FAILED':
        return AppColors.errorRed;
      case 'REFERRAL_EARNING':
        return AppColors.lightOrange;
      case 'SUBSCRIBER_VPT_REWARD':
        return AppColors.orange;
      default:
        return AppColors.hintText;
    }
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed.withValues(alpha: 0.5),
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load data',
              style: const TextStyle(
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
                  horizontal: 24,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    color: AppColors.white,
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

  Widget _buildStatusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }

  Widget _preflightMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.inputBorder.withValues(alpha: 0.24),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool monospace = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.goldText,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          value,
          style: TextStyle(
            color: AppColors.white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFamily: monospace ? 'monospace' : null,
          ),
        ),
      ],
    );
  }

  Widget _buildTagGroup(String title, List<String> values) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: AppColors.goldText,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: values
              .map(
                (value) => Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: AppColors.inputBorder.withValues(alpha: 0.28),
                    ),
                  ),
                  child: Text(
                    value,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }

  List<String> _stringList(dynamic values) {
    if (values is! List) return const [];
    return values
        .whereType<String>()
        .where((value) => value.isNotEmpty)
        .toList();
  }

  String _formatAmount(double amount) {
    if (amount == 0) return '0';
    if (amount < 1 && amount > 0) return amount.toStringAsFixed(4);
    final intAmount = amount.toInt();
    if (intAmount >= 1000) {
      final str = intAmount.toString();
      final buffer = StringBuffer();
      for (int i = 0; i < str.length; i++) {
        if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
        buffer.write(str[i]);
      }
      return buffer.toString();
    }
    if (amount == amount.roundToDouble()) return intAmount.toString();
    return amount.toStringAsFixed(2);
  }
}

class _GiftWalletBreakdownItem {
  final String label;
  final double value;
  final IconData icon;
  final Color color;

  const _GiftWalletBreakdownItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  _GiftWalletBreakdownItem copyWith({double? value}) {
    return _GiftWalletBreakdownItem(
      label: label,
      value: value ?? this.value,
      icon: icon,
      color: color,
    );
  }
}
