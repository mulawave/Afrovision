import '../../../core/ads/pangle_widgets.dart';
import 'package:flutter/material.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../../reputation/models/reputation_model.dart';
import '../../reputation/services/reputation_service.dart';
import '../models/ledger_entry_model.dart';
import '../services/wallet_service.dart';
import '../utils/wallet_format.dart';
import '../widgets/activity_history_card.dart';
import '../widgets/assets_header.dart';
import '../widgets/portfolio_card.dart';
import '../widgets/reps_progress_card.dart';
import '../widgets/stake_wallet_card.dart';
import '../widgets/connect_wallet_sheet.dart';
import '../widgets/transfer_sheet.dart';
import '../widgets/wallet_list_card.dart';
import '../widgets/wallet_toast.dart';

class DigitalAssetsScreen extends StatefulWidget {
  const DigitalAssetsScreen({super.key});

  @override
  State<DigitalAssetsScreen> createState() => _DigitalAssetsScreenState();
}

class _DigitalAssetsScreenState extends State<DigitalAssetsScreen>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  // Owner instruction: the on-chain Stake card must always be shown. Never set
  // this to false or gate it behind another flag.
  static const bool _stakePositionEnabled = true;
  static const int _totalMintedVpt = 400000000;

  final GlobalKey _portfolioKey = GlobalKey();
  final GlobalKey _stakeKey = GlobalKey();
  final GlobalKey _walletsKey = GlobalKey();
  final GlobalKey _activityKey = GlobalKey();

  UserModel? _user;
  ReputationModel? _reputation;
  List<LedgerEntryModel> _ledger = [];
  Map<String, dynamic>? _wallet;
  Map<String, dynamic>? _giftWallet;
  Map<String, dynamic> _exchangeRates = {};
  Map<String, dynamic>? _connectedWallet;
  bool _loading = true;
  String? _error;
  bool _hideBalances = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut),
    );
    _slideUp = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic),
    );
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
        ReputationService.getMyReputation()
            .then<ReputationModel?>((v) => v)
            .catchError((_) => null),
        WalletService.getConnectedWallet().catchError((e) {
          debugPrint('[Wallet] getConnectedWallet error: $e');
          return null;
        }),
      ]);

      if (!mounted) return;
      final giftWallet = results[2] as Map<String, dynamic>?;
      final connectedFromApi = results[5] as Map<String, dynamic>?;

      setState(() {
        _user = profile;
        _ledger = results[0] as List<LedgerEntryModel>;
        _wallet = results[1] as Map<String, dynamic>?;
        _giftWallet = giftWallet;
        _exchangeRates = (results[3] as Map<String, dynamic>?) ?? {};
        _connectedWallet =
            connectedFromApi ?? giftWallet?['connected_wallet'] as Map<String, dynamic>?;
        _reputation = results[4] as ReputationModel?;
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

  double get _vptPrice =>
      _safeDouble(_exchangeRates['vpt_price_ngn']) > 0
          ? _safeDouble(_exchangeRates['vpt_price_ngn'])
          : 750;

  double get _ravenNgnRate =>
      _safeDouble(_exchangeRates['raven_ngn_rate']) > 0
          ? _safeDouble(_exchangeRates['raven_ngn_rate'])
          : 10;

  double get _onChainVptBalance => _user?.vpt ?? 0;

  double get _offChainVptBalance => _giftWalletVptBalance;

  double get _giftWalletVptBalance => _safeDouble(_giftWallet?['vpt']);

  double get _cashWalletBalance => _safeDouble(_giftWallet?['cash']);

  double get _ravensBalance => _safeDouble(_giftWallet?['coins']);

  double get _stakeWalletVpt {
    final raw = _giftWallet?['blockchain_tokens'] as String? ?? '';
    if (raw.isEmpty) return 0;
    return double.tryParse(raw) ?? 0;
  }

  double get _portfolioValue {
    return (_onChainVptBalance + _offChainVptBalance) * _vptPrice +
        _cashWalletBalance +
        _ravensBalance * _ravenNgnRate;
  }

  static double _safeDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  bool get _isPremium => _user?.hasActiveSubscription ?? false;

  void _scrollTo(GlobalKey key, {double alignment = 0.2}) {
    final ctx = key.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
      alignment: alignment,
    );
  }

  Future<void> _onTopUp() async {
    if (!await KycGuard.ensureKycVerified(context)) return;
    if (!mounted) return;
    await Navigator.pushNamed(
      context,
      '/checkout',
      arguments: {
        'purpose': 'wallet_topup',
        'title': 'Cash Wallet Top-Up',
        'balanceType': 'ngn',
      },
    );
    _loadData();
  }

  Future<void> _onConvert() async {
    if (!await KycGuard.ensureKycVerified(context)) return;
    if (!mounted) return;
    final changed = await Navigator.pushNamed(context, '/wallet/convert');
    if (changed == true && mounted) _loadData();
  }

  Future<void> _onWithdraw() async {
    final changed = await Navigator.pushNamed(context, '/withdrawals');
    if (changed == true && mounted) _loadData();
  }

  void _onOpenFullLedger() {
    Navigator.pushNamed(context, '/wallet/transactions');
  }

  void _onOpenReps() {
    Navigator.pushNamed(context, '/reputation');
  }

  void _onBalanceTap(String key) {
    switch (key) {
      case 'onchain':
      case 'offchain':
      case 'cash':
        _scrollTo(_walletsKey);
        break;
      case 'ravens':
        _onConvert();
        break;
    }
  }

  List<Widget> get _jumpChips {
    final chips = [
      _JumpChip(
        label: 'Portfolio',
        icon: Icons.pie_chart_rounded,
        onTap: () => _scrollTo(_portfolioKey),
      ),
      if (_stakePositionEnabled)
        _JumpChip(
          label: 'Stake',
          icon: Icons.pie_chart_rounded,
          onTap: () => _scrollTo(_stakeKey),
        ),
      _JumpChip(
        label: 'Wallets',
        icon: Icons.account_balance_wallet_rounded,
        onTap: () => _scrollTo(_walletsKey),
      ),
      _JumpChip(
        label: 'Activity',
        icon: Icons.history_rounded,
        onTap: () => _scrollTo(_activityKey),
      ),
    ];
    return chips;
  }

  List<WalletListItem> get _walletItems {
    final offChainValue = _hideBalances
        ? '•••• vPT'
        : '${walletFormatAmount(_offChainVptBalance)} vPT';
    final cashValue = _hideBalances
        ? '₦••••'
        : '₦${walletFormatAmount(_cashWalletBalance)}';
    final ravensValue = _hideBalances
        ? '•••• Ravens'
        : '${walletFormatAmount(_ravensBalance)} Ravens';

    final List<WalletListItem> items = [
      WalletListItem(
        key: 'offchain',
        label: 'Off-chain vPT',
        value: offChainValue,
        sub: 'Combined vPT from gifts, rewards and funding. Convertible to Ravens.',
        icon: Icons.card_giftcard_rounded,
        tint: Nocturne.blue,
        bg: Nocturne.surfaceRaised,
        border: Nocturne.borderCard,
      ),
      WalletListItem(
        key: 'cash',
        label: 'Cash balance',
        value: cashValue,
        sub: 'Instant NGN from referral cash, gifts, deals and other rewards.',
        icon: Icons.account_balance_wallet_rounded,
        tint: Nocturne.green,
        bg: const Color(0xFF101D43),
        border: const Color(0xFF25553F),
        actions: [
          WalletAction(
            label: 'Top Up',
            icon: Icons.add_circle_outline_rounded,
            color: Nocturne.green,
            onTap: _onTopUp,
          ),
          WalletAction(
            label: 'Withdraw',
            icon: Icons.account_balance_rounded,
            color: Nocturne.green,
            onTap: _onWithdraw,
          ),
        ],
      ),
      WalletListItem(
        key: 'ravens',
        label: 'Ravens',
        value: ravensValue,
        sub: '1 Raven ≈ ₦${_ravenNgnRate.toStringAsFixed(0)} · 75 Ravens = 1 vPT',
        icon: Icons.flutter_dash_rounded,
        tint: Nocturne.goldLight,
        bg: const Color(0xFF141A30),
        border: const Color(0xFF4A3A1A),
        actions: [
          WalletAction(
            label: 'Convert to vPT',
            icon: Icons.swap_horiz_rounded,
            color: Nocturne.goldLight,
            onTap: _onConvert,
          ),
        ],
      ),
    ];

    final connected = _connectedWallet;
    if (connected == null ||
        (connected['address'] as String? ?? '').isEmpty) {
      items.add(
        WalletListItem(
          key: 'connect',
          label: 'Connect external wallet',
          value: 'Not connected',
          sub: 'Connect MetaMask, Trust Wallet, or any BSC wallet for on-chain transfers.',
          icon: Icons.account_balance_wallet_rounded,
          tint: Nocturne.goldLight,
          bg: Nocturne.surfaceRaised,
          border: Nocturne.borderCard,
          tag: 'CONNECT',
          tagColor: Nocturne.gold,
          actions: [
            WalletAction(
              label: 'Connect',
              icon: Icons.link_rounded,
              color: Nocturne.goldLight,
              onTap: () => ConnectWalletSheet.show(
                context,
                onConnected: _loadData,
              ),
            ),
          ],
        ),
      );
    } else if ((connected['address'] as String? ?? '').isNotEmpty) {
      final address = connected['address'] as String;
      final type = connected['type'] as String? ?? 'manual';
      items.add(
        WalletListItem(
          key: 'external',
          label: 'External wallet',
          value: _walletTypeLabel(type),
          sub: 'Connected for on-chain transfers.',
          icon: Icons.link_rounded,
          tint: Nocturne.green,
          bg: Nocturne.surfaceRaised,
          border: Nocturne.borderCard,
          tag: 'CONNECTED',
          tagColor: Nocturne.green,
          address: address,
          actions: [
            WalletAction(
              label: 'Transfer',
              icon: Icons.swap_horiz_rounded,
              color: Nocturne.green,
              onTap: () async {
                final can = await KycGuard.ensureKycVerified(context);
                if (!can || !mounted) return;
                TransferSheet.show(
                  context,
                  connectedAddress: address,
                  connectedType: type,
                  balances: connected['balances'] as Map<String, dynamic>?,
                  onTransferred: _loadData,
                );
              },
            ),
            WalletAction(
              label: 'Disconnect',
              icon: Icons.link_off_rounded,
              color: Nocturne.redSoft,
              onTap: _disconnectWallet,
            ),
          ],
        ),
      );
    }

    final bscAddress =
        _wallet?['bsc_address'] as String? ?? _user?.bscAddress;
    if (bscAddress != null && bscAddress.isNotEmpty) {
      items.add(
        WalletListItem(
          key: 'bsc',
          label: 'BSC wallet',
          value: 'Binance Smart Chain',
          sub: 'Deposit address for on-chain vPT.',
          icon: Icons.currency_exchange_rounded,
          tint: Nocturne.blue,
          bg: Nocturne.surfaceRaised,
          border: Nocturne.borderCard,
          address: bscAddress,
        ),
      );
    }

    return items;
  }

  String _walletTypeLabel(String type) {
    switch (type) {
      case 'metamask':
        return 'MetaMask';
      case 'trust':
        return 'Trust Wallet';
      case 'walletconnect':
        return 'WalletConnect';
      case 'manual':
        return 'Connected';
      default:
        return type.isEmpty ? 'Connected' : type[0].toUpperCase() + type.substring(1);
    }
  }

  Future<void> _disconnectWallet() async {
    try {
      await WalletService.disconnectExternalWallet();
      if (!mounted) return;
      _loadData();
      WalletToast.show(context, 'Wallet disconnected');
    } catch (e) {
      if (!mounted) return;
      WalletToast.show(context, 'Failed to disconnect wallet');
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: Column(
          children: [
          AssetsHeader(
            title: 'Assets',
            subtitle: 'Snapshot, wallets and activity',
            trailing: HideBalancesButton(
              hidden: _hideBalances,
              onToggle: () => setState(() => _hideBalances = !_hideBalances),
            ),
          ),
          Expanded(
            child: _loading
                ? const _LoadingState()
                : _error != null
                    ? _ErrorState(error: _error!, onRetry: _loadData)
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: RefreshIndicator(
                            onRefresh: _loadData,
                            color: Nocturne.gold,
                            backgroundColor: Nocturne.surfaceInset,
                            displacement: 20,
                            child: CustomScrollView(
                              slivers: [
                                SliverToBoxAdapter(
                                  child: _JumpChipsRow(chips: _jumpChips),
                                ),
                                SliverPadding(
                                  padding:
                                      const EdgeInsets.fromLTRB(16, 2, 16, 12),
                                  sliver: SliverList(
                                    delegate: SliverChildListDelegate([
                                      _Section(
                                        key: _portfolioKey,
                                        child: PortfolioCard(
                                          portfolioValue: _portfolioValue,
                                          onChainVpt: _onChainVptBalance,
                                          offChainVpt: _offChainVptBalance,
                                          ravens: _ravensBalance,
                                          cash: _cashWalletBalance,
                                          vptPrice: _vptPrice,
                                          ravenNgnRate: _ravenNgnRate,
                                          isPremium: _isPremium,
                                          hideBalances: _hideBalances,
                                          onTopUp: _onTopUp,
                                          onConvert: _onConvert,
                                          onWithdraw: _onWithdraw,
                                          onBalanceTap: _onBalanceTap,
                                        ),
                                      ),
                                      if (_stakePositionEnabled) ...[
                                        _Section(
                                          key: _stakeKey,
                                          child: StakeWalletCard(
                                            stakedVpt: _stakeWalletVpt,
                                            totalMinted: _totalMintedVpt.toDouble(),
                                            hideBalances: _hideBalances,
                                          ),
                                        ),
                                        _Section(
                                          child: RepsProgressCard(
                                            reputation: _reputation,
                                            onTap: _onOpenReps,
                                          ),
                                        ),
                                      ],
                                      _Section(
                                        key: _walletsKey,
                                        child: WalletListCard(
                                          items: _walletItems,
                                          hideBalances: _hideBalances,
                                        ),
                                      ),
                                      _Section(
                                        key: _activityKey,
                                        child: ActivityHistoryCard(
                                          entries: _ledger,
                                          vptPrice: _vptPrice,
                                          hideBalances: _hideBalances,
                                          onOpenFullLedger: _onOpenFullLedger,
                                        ),
                                      ),
                                      const SizedBox(height: 24),
                                    ]),
                                  ),
                                ),
                                const SliverToBoxAdapter(
                                  child: PangleBigBanner(),
                                ),
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
}

class _JumpChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _JumpChip({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 7),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0x06FFFFFF),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Nocturne.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: Nocturne.textMuted),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: Nocturne.textMuted,
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _JumpChipsRow extends StatelessWidget {
  final List<Widget> chips;

  const _JumpChipsRow({required this.chips});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: chips),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final Widget child;

  const _Section({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: child,
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(
        color: Nocturne.gold,
        strokeWidth: 2.5,
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorState({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Nocturne.surfaceRaised,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Nocturne.borderCard),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                color: Nocturne.redSoft,
                size: 44,
              ),
              const SizedBox(height: 12),
              Text(
                error,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: onRetry,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
                  decoration: BoxDecoration(
                    color: Nocturne.goldWash,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(color: Nocturne.gold),
                  ),
                  child: const Text(
                    'Retry',
                    style: TextStyle(
                      color: Nocturne.goldLight,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
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
}
