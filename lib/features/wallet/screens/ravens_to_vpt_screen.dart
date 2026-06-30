import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../services/wallet_service.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';

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
  double _ravenNgnRate = 10; // Display only
  bool _ratesLoading = true;
  String? _ratesError;

  // Balances
  double _ravensBalance = 0;
  double _vptBalance = 0;
  bool _balancesLoading = true;

  // Derived
  double get _ravensInput => double.tryParse(_ravensCtrl.text.trim()) ?? 0;
  double get _vptPreview => _ravensInput > 0 ? _ravensInput / _vptRavenRate : 0;
  double get _vptNgnEquiv => _vptPreview * (_ravenNgnRate * _vptRavenRate);
  bool get _hasEnoughRavens => _ravensInput <= _ravensBalance;
  bool get _meetsMinimum => _ravensInput >= _vptRavenRate;
  bool get _canConvert =>
      _ravensInput > 0 && _hasEnoughRavens && _meetsMinimum && !_converting;

  // Submission state
  bool _converting = false;
  bool _success = false;
  double _convertedVpt = 0;
  double _usedRavens = 0;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.12),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));

    _ravensCtrl.addListener(_onInputChanged);
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
            'Could not load exchange rate. Using default (75 Ravens = 1 vPT).';
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

  String _fmt(double v) {
    if (v == v.truncateToDouble()) return v.toStringAsFixed(0);
    return v.toStringAsFixed(4).replaceAll(RegExp(r'0+$'), '');
  }

  void _setMax() {
    final maxConvertible = (_ravensBalance ~/ _vptRavenRate) * _vptRavenRate;
    if (maxConvertible <= 0) return;
    _ravensCtrl.text = maxConvertible.toStringAsFixed(0);
  }

  Future<void> _convert() async {
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
      _showSnack(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(color: AppColors.white)),
        backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _reset() {
    _ravensCtrl.clear();
    setState(() {
      _success = false;
      _convertedVpt = 0;
      _usedRavens = 0;
    });
    _loadBalances(); // refresh balances after conversion
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
              const MarqueeTickerWidget(),
              Expanded(
                child: _ratesLoading || _balancesLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                          strokeWidth: 2,
                        ),
                      )
                    : _success
                    ? _buildSuccessView()
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 8,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (_ratesError != null) _buildRatesWarning(),
                                const SizedBox(height: 8),
                                _buildRateCard(),
                                const SizedBox(height: 16),
                                _buildBalanceRow(),
                                const SizedBox(height: 20),
                                _buildInputCard(),
                                const SizedBox(height: 16),
                                if (_ravensInput > 0) _buildPreviewCard(),
                                const SizedBox(height: 24),
                                _buildConvertButton(),
                                const SizedBox(height: 12),
                                _buildDisclaimer(),
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

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context, _success),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 16,
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Convert Ravens → vPT',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
                Text(
                  'Exchange Ravens for off-chain vPT',
                  style: TextStyle(
                    color: AppColors.goldText,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRatesWarning() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.lightOrange.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.lightOrange.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: AppColors.lightOrange,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _ratesError!,
              style: const TextStyle(
                color: AppColors.lightOrange,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRateCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.lightOrange.withValues(alpha: 0.14),
            AppColors.orange.withValues(alpha: 0.06),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.lightOrange.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.lightOrange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.swap_horiz_rounded,
                  color: AppColors.lightOrange,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'LIVE CONVERSION RATE',
                      style: TextStyle(
                        color: AppColors.lightOrange,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_fmt(_vptRavenRate)} Ravens = 1 vPT',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '1 Raven ≈ ₦${_fmt(_ravenNgnRate)}  •  1 vPT ≈ ₦${_fmt(_ravenNgnRate * _vptRavenRate)}',
                      style: const TextStyle(
                        color: AppColors.goldText,
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
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.darkBlue.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.info_outline_rounded,
                  color: AppColors.goldText,
                  size: 13,
                ),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text(
                    'Rate is set by AfroVision admins and updates live. Ravens burned in conversion are non-refundable.',
                    style: TextStyle(
                      color: AppColors.goldText,
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

  Widget _buildBalanceRow() {
    return Row(
      children: [
        Expanded(
          child: _balanceTile(
            label: 'Ravens Available',
            value: '${_fmt(_ravensBalance)} Ravens',
            icon: Icons.flutter_dash_rounded,
            color: AppColors.lightOrange,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _balanceTile(
            label: 'Off-chain vPT',
            value: '${_fmt(_vptBalance)} vPT',
            icon: Icons.card_giftcard_rounded,
            color: const Color(0xFF64B5F6),
          ),
        ),
      ],
    );
  }

  Widget _balanceTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildInputCard() {
    final bool insufficientRavens = _ravensInput > 0 && !_hasEnoughRavens;
    final bool belowMinimum = _ravensInput > 0 && !_meetsMinimum;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ravens to Convert',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: insufficientRavens || belowMinimum
                    ? AppColors.errorRed.withValues(alpha: 0.6)
                    : _ravensFocus.hasFocus
                    ? AppColors.inputFocusBorder
                    : AppColors.inputBorder,
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.flutter_dash_rounded,
                  color: AppColors.lightOrange,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _ravensCtrl,
                    focusNode: _ravensFocus,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: false,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9]')),
                    ],
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                    decoration: InputDecoration(
                      hintText: 'e.g. ${_vptRavenRate.toStringAsFixed(0)}',
                      hintStyle: const TextStyle(
                        color: AppColors.hintText,
                        fontSize: 18,
                        fontWeight: FontWeight.w400,
                      ),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _setMax,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppColors.orange.withValues(alpha: 0.4),
                      ),
                    ),
                    child: const Text(
                      'MAX',
                      style: TextStyle(
                        color: AppColors.orange,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (insufficientRavens) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  color: AppColors.errorRed,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Text(
                  'Insufficient Ravens. You have ${_fmt(_ravensBalance)}.',
                  style: const TextStyle(
                    color: AppColors.errorRed,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ] else if (belowMinimum) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  color: AppColors.errorRed,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Text(
                  'Minimum ${_fmt(_vptRavenRate)} Ravens required for 1 vPT.',
                  style: const TextStyle(
                    color: AppColors.errorRed,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Text(
            'Minimum: ${_fmt(_vptRavenRate)} Ravens  •  Whole Ravens only',
            style: const TextStyle(
              color: AppColors.hintText,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewCard() {
    return AnimatedOpacity(
      opacity: _ravensInput > 0 ? 1 : 0,
      duration: const Duration(milliseconds: 250),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              const Color(0xFF64B5F6).withValues(alpha: 0.10),
              const Color(0xFF64B5F6).withValues(alpha: 0.03),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFF64B5F6).withValues(alpha: 0.25),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.preview_rounded, color: Color(0xFF64B5F6), size: 15),
                SizedBox(width: 6),
                Text(
                  'CONVERSION PREVIEW',
                  style: TextStyle(
                    color: Color(0xFF64B5F6),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _previewRow(
              'Ravens burned',
              '${_fmt(_ravensInput)} Ravens',
              AppColors.lightOrange,
            ),
            const SizedBox(height: 8),
            _previewRow(
              'vPT received',
              '${_fmt(_vptPreview)} vPT',
              const Color(0xFF64B5F6),
            ),
            const SizedBox(height: 8),
            _previewRow(
              'Estimated value',
              '≈ ₦${_fmt(_vptNgnEquiv)}',
              AppColors.goldText,
            ),
            const SizedBox(height: 12),
            // Visual arrow
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.lightOrange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.lightOrange.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Text(
                    '${_fmt(_ravensInput)} Ravens',
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10),
                  child: Icon(
                    Icons.arrow_forward_rounded,
                    color: AppColors.goldText,
                    size: 18,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF64B5F6).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFF64B5F6).withValues(alpha: 0.3),
                    ),
                  ),
                  child: Text(
                    '${_fmt(_vptPreview)} vPT',
                    style: const TextStyle(
                      color: Color(0xFF64B5F6),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _previewRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.goldText,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _buildConvertButton() {
    return GestureDetector(
      onTap: _canConvert ? _convert : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          gradient: _canConvert
              ? AppColors.buttonGradient
              : AppColors.buttonDisabledGradient,
          borderRadius: BorderRadius.circular(14),
          boxShadow: _canConvert
              ? [
                  BoxShadow(
                    color: AppColors.orange.withValues(alpha: 0.35),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ]
              : [],
        ),
        alignment: Alignment.center,
        child: _converting
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  color: AppColors.darkBlue,
                  strokeWidth: 2.5,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.swap_horiz_rounded,
                    color: _canConvert
                        ? AppColors.darkBlue
                        : AppColors.hintText,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Convert to vPT',
                    style: TextStyle(
                      color: _canConvert
                          ? AppColors.darkBlue
                          : AppColors.hintText,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildDisclaimer() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: const Row(
        children: [
          Icon(Icons.lock_outline_rounded, color: AppColors.hintText, size: 13),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Ravens are permanently burned upon conversion and cannot be refunded. vPT is credited to your off-chain balance.',
              style: TextStyle(
                color: AppColors.hintText,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Success View ─────────────────────────────────────

  Widget _buildSuccessView() {
    return FadeTransition(
      opacity: _fadeIn,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.orange.withValues(alpha: 0.2),
                      AppColors.lightOrange.withValues(alpha: 0.08),
                    ],
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.orange.withValues(alpha: 0.4),
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.orange,
                  size: 48,
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'Conversion Successful!',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                '${_fmt(_usedRavens)} Ravens have been converted to ${_fmt(_convertedVpt)} vPT.',
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              // Summary box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF64B5F6).withValues(alpha: 0.10),
                      const Color(0xFF64B5F6).withValues(alpha: 0.03),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFF64B5F6).withValues(alpha: 0.25),
                  ),
                ),
                child: Column(
                  children: [
                    _summaryRow(
                      'Ravens burned',
                      '${_fmt(_usedRavens)} Ravens',
                      AppColors.lightOrange,
                    ),
                    const SizedBox(height: 10),
                    _summaryRow(
                      'vPT credited',
                      '${_fmt(_convertedVpt)} vPT',
                      const Color(0xFF64B5F6),
                    ),
                    const SizedBox(height: 10),
                    _summaryRow(
                      'New Ravens balance',
                      '${_fmt(_ravensBalance)} Ravens',
                      AppColors.goldText,
                    ),
                    const SizedBox(height: 10),
                    _summaryRow(
                      'New vPT balance',
                      '${_fmt(_vptBalance)} vPT',
                      AppColors.white,
                    ),
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
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.inputBorder),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'Convert More',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
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
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          gradient: AppColors.buttonGradient,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.orange.withValues(alpha: 0.3),
                              blurRadius: 14,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'Done',
                          style: TextStyle(
                            color: AppColors.darkBlue,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
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

  Widget _summaryRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.goldText,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
