import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../services/wallet_service.dart';
import '../utils/wallet_format.dart';
import '../widgets/assets_header.dart';
import '../widgets/wallet_toast.dart';

class RavensToVptScreen extends StatefulWidget {
  const RavensToVptScreen({super.key});

  @override
  State<RavensToVptScreen> createState() => _RavensToVptScreenState();
}

class _RavensToVptScreenState extends State<RavensToVptScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  final TextEditingController _ravensCtrl = TextEditingController();
  final FocusNode _ravensFocus = FocusNode();

  // Rates fetched from backend
  double _vptRavenRate = 75; // Ravens per 1 vPT
  double _ravenNgnRate = 10; // NGN per Raven
  bool _ratesLoading = true;
  bool _balancesLoading = true;
  String? _ratesError;

  // Balances
  double _ravensBalance = 0;
  double _vptBalance = 0;

  // Submission state
  bool _converting = false;
  bool _success = false;
  double _convertedVpt = 0;
  double _usedRavens = 0;

  // Derived
  double get _ravensInput => double.tryParse(_ravensCtrl.text.trim()) ?? 0;
  double get _vptPreview => _ravensInput > 0 ? _ravensInput / _vptRavenRate : 0;
  bool get _hasEnoughRavens => _ravensInput <= _ravensBalance;
  bool get _meetsMinimum => _ravensInput >= _vptRavenRate;
  bool get _canConvert =>
      _ravensInput > 0 && _hasEnoughRavens && _meetsMinimum && !_converting;

  @override
  void initState() {
    super.initState();
    _ravensCtrl.addListener(_onInputChanged);
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _loadAll();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _ravensCtrl.dispose();
    _ravensFocus.dispose();
    super.dispose();
  }

  void _onInputChanged() => setState(() {});

  Future<void> _loadAll() async {
    await Future.wait([_loadRates(), _loadBalances()]);
    if (mounted) _animCtrl.forward(from: 0);
  }

  Future<void> _loadRates() async {
    try {
      final rates = await WalletService.getExchangeRates();
      if (!mounted) return;
      setState(() {
        _vptRavenRate = (rates['vpt_raven_rate'] as num?)?.toDouble() ?? 75;
        _ravenNgnRate = (rates['raven_ngn_rate'] as num?)?.toDouble() ?? 10;
        _ratesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _ratesError =
            'Could not load exchange rate. Using default ($_vptRavenRate Ravens = 1 vPT).';
        _ratesLoading = false;
      });
    }
  }

  Future<void> _loadBalances() async {
    try {
      final wallet = await WalletService.getGiftWalletBalance();
      if (!mounted) return;
      setState(() {
        _ravensBalance = _safeDouble(wallet['coins']);
        _vptBalance = _safeDouble(wallet['vpt']);
        _balancesLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _balancesLoading = false);
    }
  }

  static double _safeDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  void _setMax() {
    final maxConvertible = (_ravensBalance ~/ _vptRavenRate) * _vptRavenRate;
    if (maxConvertible <= 0) return;
    _ravensCtrl.text = maxConvertible.toStringAsFixed(0);
  }

  Future<void> _convert() async {
    if (!await KycGuard.ensureKycVerified(context)) return;
    if (!_canConvert) return;
    FocusScope.of(context).unfocus();
    setState(() => _converting = true);
    try {
      await WalletService.exchangeAssets(
        from: 'ravens',
        to: 'vpt',
        amount: _ravensInput,
      );
      if (!mounted) return;
      setState(() {
        _convertedVpt = _vptPreview;
        _usedRavens = _ravensInput;
        _converting = false;
        _success = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _converting = false);
      WalletToast.show(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  void _reset() {
    _ravensCtrl.clear();
    setState(() {
      _success = false;
      _convertedVpt = 0;
      _usedRavens = 0;
    });
    _loadBalances();
  }

  void _onBack() => Navigator.pop(context, _success);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            AssetsHeader(
              title: 'Convert',
              subtitle: 'Ravens to vPT',
              onBack: _onBack,
            ),
            Expanded(
              child: _ratesLoading || _balancesLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Nocturne.gold,
                        strokeWidth: 3,
                      ),
                    )
                  : _success
                  ? _buildSuccessView()
                  : FadeTransition(
                      opacity: _fadeIn,
                      child: SlideTransition(
                        position: _slideUp,
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_ratesError != null) _buildRatesWarning(),
                              _buildRateCard(),
                              const SizedBox(height: 14),
                              _buildBalanceGrid(),
                              const SizedBox(height: 18),
                              _buildInputCard(),
                              const SizedBox(height: 22),
                              _buildConvertButton(),
                              const SizedBox(height: 14),
                              _buildBurnWarning(),
                              const SizedBox(height: 24),
                            ],
                          ),
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRatesWarning() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Nocturne.gold.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: Nocturne.gold.withValues(alpha: 0.30)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: Nocturne.goldLight, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _ratesError!,
              style: const TextStyle(
                color: Nocturne.goldLight,
                fontSize: 11,
                fontWeight: FontWeight.w500,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRateCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B2A5C), Color(0xFF101C40)],
        ),
        border: Border.all(color: const Color(0xFF2F4483)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Nocturne.blue.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Nocturne.blue.withValues(alpha: 0.28)),
                ),
                child: const Icon(
                  Icons.swap_horiz_rounded,
                  color: Nocturne.blue,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'LIVE CONVERSION RATE',
                      style: TextStyle(
                        color: Nocturne.gold,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${walletFormatAmount(_vptRavenRate)} Ravens = 1 vPT',
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 23,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.02,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '1 Raven ≈ ₦${walletFormatAmount(_ravenNgnRate)} · 1 vPT ≈ ₦${walletFormatAmount(_ravenNgnRate * _vptRavenRate)}',
                      style: const TextStyle(
                        color: Nocturne.textFaint,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0x05FFFFFF),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: Nocturne.borderCard),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded, color: Nocturne.textFaint, size: 13),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Rate is set by AfroVision admins and updates live. Ravens burned in conversion are non-refundable.',
                    style: TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 10.5,
                      height: 1.35,
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

  Widget _buildBalanceGrid() {
    return Row(
      children: [
        Expanded(
          child: _buildBalanceTile(
            label: 'Ravens available',
            value: '${walletFormatAmount(_ravensBalance)} Ravens',
            icon: Icons.flutter_dash_rounded,
            color: Nocturne.gold,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildBalanceTile(
            label: 'Off-chain vPT',
            value: '${walletFormatAmount(_vptBalance)} vPT',
            icon: Icons.card_giftcard_rounded,
            color: Nocturne.blue,
          ),
        ),
      ],
    );
  }

  Widget _buildBalanceTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 15),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildInputCard() {
    final insufficient = _ravensInput > 0 && !_hasEnoughRavens;
    final belowMin = _ravensInput > 0 && !_meetsMinimum;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ravens to convert',
            style: TextStyle(
              color: Nocturne.goldSoft,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
            decoration: BoxDecoration(
              color: Nocturne.surfaceDeep,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(
                color: insufficient || belowMin
                    ? Nocturne.red.withValues(alpha: 0.55)
                    : _ravensFocus.hasFocus
                        ? Nocturne.gold.withValues(alpha: 0.45)
                        : Nocturne.borderCard,
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.flutter_dash_rounded,
                  color: Nocturne.goldLight,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _ravensCtrl,
                    focusNode: _ravensFocus,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                      border: InputBorder.none,
                      hintText: _vptRavenRate.toStringAsFixed(0),
                      hintStyle: const TextStyle(
                        color: Nocturne.textHint,
                        fontSize: 18,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _setMax,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    decoration: BoxDecoration(
                      color: Nocturne.gold.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Nocturne.gold.withValues(alpha: 0.35)),
                    ),
                    child: const Text(
                      'MAX',
                      style: TextStyle(
                        color: Nocturne.goldLight,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (insufficient) ...[
                const Icon(Icons.error_outline_rounded, color: Nocturne.redSoft, size: 13),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Insufficient Ravens. You have ${walletFormatAmount(_ravensBalance)}.',
                    style: const TextStyle(
                      color: Nocturne.redSoft,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ] else if (belowMin) ...[
                const Icon(Icons.error_outline_rounded, color: Nocturne.redSoft, size: 13),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Minimum ${walletFormatAmount(_vptRavenRate)} Ravens required',
                    style: const TextStyle(
                      color: Nocturne.redSoft,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ] else ...[
                Expanded(
                  child: Text(
                    'Minimum ${walletFormatAmount(_vptRavenRate)} Ravens · whole Ravens only',
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
              if (_ravensInput > 0 && _meetsMinimum)
                Text(
                  '≈ ${walletFormatAmount(_vptPreview)} vPT',
                  style: const TextStyle(
                    color: Nocturne.goldLight,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildConvertButton() {
    return GestureDetector(
      onTap: _canConvert ? () => _convert() : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 15),
        decoration: BoxDecoration(
          gradient: _canConvert ? Nocturne.goldCta : null,
          color: _canConvert ? null : const Color(0x05FFFFFF),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
            color: _canConvert ? Colors.transparent : Nocturne.border,
          ),
          boxShadow: _canConvert
              ? [
                  BoxShadow(
                    color: Nocturne.gold.withValues(alpha: 0.30),
                    blurRadius: 22,
                    offset: const Offset(0, 8),
                  ),
                ]
              : [],
        ),
        alignment: Alignment.center,
        child: _converting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  color: Color(0xFF26170A),
                  strokeWidth: 2.5,
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.swap_horiz_rounded,
                    color: _canConvert ? const Color(0xFF26170A) : Nocturne.textHint,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Convert to vPT',
                    style: TextStyle(
                      color: _canConvert ? const Color(0xFF26170A) : Nocturne.textHint,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildBurnWarning() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: const Row(
        children: [
          Icon(Icons.lock_outline_rounded, color: Nocturne.textFaint, size: 13),
          SizedBox(width: 9),
          Expanded(
            child: Text(
              'Ravens are permanently burned upon conversion and cannot be refunded. vPT is credited to your off-chain balance.',
              style: TextStyle(
                color: Nocturne.textFaint,
                fontSize: 10.5,
                height: 1.35,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView() {
    return FadeTransition(
      opacity: _fadeIn,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0x24F0A52A), Color(0x08F0A52A)],
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Nocturne.gold.withValues(alpha: 0.35),
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: Nocturne.gold,
                  size: 44,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Conversion Successful!',
                style: TextStyle(
                  color: Nocturne.text,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.01,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                '${walletFormatAmount(_usedRavens)} Ravens converted to ${walletFormatAmount(_convertedVpt)} vPT.',
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Nocturne.surfaceRaised,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Nocturne.borderCard),
                ),
                child: Column(
                  children: [
                    _buildSummaryRow('Ravens burned', '${walletFormatAmount(_usedRavens)} Ravens', Nocturne.gold),
                    const SizedBox(height: 10),
                    _buildSummaryRow('vPT credited', '${walletFormatAmount(_convertedVpt)} vPT', Nocturne.blue),
                    const SizedBox(height: 10),
                    _buildSummaryRow('New Ravens balance', '${walletFormatAmount(_ravensBalance)} Ravens', Nocturne.text),
                    const SizedBox(height: 10),
                    _buildSummaryRow('New vPT balance', '${walletFormatAmount(_vptBalance)} vPT', Nocturne.text),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: _reset,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: const Color(0x05FFFFFF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Nocturne.borderCard),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'Convert More',
                          style: TextStyle(
                            color: Nocturne.text,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context, true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          gradient: Nocturne.goldCta,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: Nocturne.gold.withValues(alpha: 0.30),
                              blurRadius: 18,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'Done',
                          style: TextStyle(
                            color: Color(0xFF26170A),
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
