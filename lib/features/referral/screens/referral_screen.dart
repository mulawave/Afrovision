import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_pagination_controls.dart';
import '../../../core/api/api_service.dart';
import '../services/referral_service.dart';

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen>
    with SingleTickerProviderStateMixin {
  static const int _pageSize = 5;

  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  ReferralDashboard? _dashboard;
  bool _loading = true;
  String? _error;
  bool _copied = false;
  int _tabIndex = 0; // 0=earnings, 1=referrals, 2=upline
  int _earningsPage = 0;
  int _referralsPage = 0;
  int _uplinePage = 0;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _load();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final dashboard = await ReferralService.getDashboard();
      if (!mounted) return;
      setState(() {
        _dashboard = dashboard;
        _loading = false;
      });
      _animCtrl.forward();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Connection error. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _earningsPage = 0;
      _referralsPage = 0;
      _uplinePage = 0;
    });
    await _load();
  }

  Future<void> _copy() async {
    if (_dashboard == null) return;
    await Clipboard.setData(ClipboardData(text: _dashboard!.referralCode));
    if (!mounted) return;
    setState(() => _copied = true);
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => _copied = false);
  }

  String _timeAgo(int ts) {
    final diff = DateTime.now().millisecondsSinceEpoch - ts;
    final days = diff ~/ 86400000;
    if (days == 0) return 'Today';
    if (days == 1) return 'Yesterday';
    if (days < 7) return '${days}d ago';
    if (days < 30) return '${days ~/ 7}w ago';
    final d = DateTime.fromMillisecondsSinceEpoch(ts);
    return '${d.day}/${d.month}/${d.year}';
  }

  List<T> _paginate<T>(List<T> items, int page) {
    final start = page * _pageSize;
    return items.skip(start).take(_pageSize).toList();
  }

  int _pageCount(int length) =>
      length == 0 ? 1 : ((length - 1) ~/ _pageSize) + 1;

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
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _error != null
                    ? _buildError()
                    : _buildContent(),
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
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Refer & Earn',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.errorRed,
            size: 48,
          ),
          const SizedBox(height: 12),
          Text(
            _error ?? 'Failed to load referral info',
            style: const TextStyle(color: AppColors.white, fontSize: 15),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () {
              setState(() {
                _loading = true;
                _error = null;
              });
              _load();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    final d = _dashboard!;
    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: AppColors.orange,
          backgroundColor: AppColors.inputFill,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Column(
              children: [
                _buildHeroCard(d),
                const SizedBox(height: 16),
                _buildLedgerBalanceCard(d),
                const SizedBox(height: 16),
                _buildStatsRow(d),
                const SizedBox(height: 16),
                _buildLevelDistribution(d),
                const SizedBox(height: 16),
                _buildTabs(),
                const SizedBox(height: 12),
                _buildTabContent(d),
                const SizedBox(height: 16),
                _buildHowItWorks(),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeroCard(ReferralDashboard d) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              gradient: AppColors.buttonGradient,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.card_giftcard_rounded,
              color: AppColors.white,
              size: 32,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'YOUR REFERRAL CODE',
            style: TextStyle(
              color: AppColors.hintText,
              fontSize: 11,
              fontWeight: FontWeight.w500,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            d.referralCode,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: 4,
            ),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _copy,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
              decoration: BoxDecoration(
                gradient: _copied ? null : AppColors.buttonGradient,
                color: _copied ? AppColors.inputFill : null,
                borderRadius: BorderRadius.circular(12),
                border: _copied
                    ? Border.all(color: AppColors.orange.withValues(alpha: 0.4))
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _copied ? Icons.check_rounded : Icons.copy_rounded,
                    color: _copied ? AppColors.orange : AppColors.white,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _copied ? 'Copied!' : 'Copy Code',
                    style: TextStyle(
                      color: _copied ? AppColors.orange : AppColors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLedgerBalanceCard(ReferralDashboard d) {
    final ls = d.ledgerSummary;
    final totalVpt = ls.pendingVptUnits + ls.creditedVptUnits;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.account_balance_rounded,
                  color: AppColors.orange,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Referral Off-chain vPT',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // vPT Ledger Balance
          _balanceRow(
            'Off-chain vPT Balance',
            '${totalVpt.toStringAsFixed(0)} vPT',
            AppColors.lightOrange,
            Icons.diamond_rounded,
          ),
          const SizedBox(height: 10),
          Text(
            'Referral vPT that contributes to your off-chain vPT balance. Subscriber rewards, gifts and other asset activity appear in Digital Assets.',
            style: const TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _balanceRow(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(ReferralDashboard d) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _statTile('Invites', '${d.invitedCount}', Icons.people_rounded),
          const SizedBox(width: 10),
          _statTile(
            'Referral Cash',
            '₦${d.totalEarningsNgn.toStringAsFixed(0)}',
            Icons.account_balance_wallet_rounded,
          ),
          const SizedBox(width: 10),
          _statTile(
            'Referral vPT',
            '${d.totalEarningsVptUnits.toStringAsFixed(2)} vPT',
            Icons.diamond_rounded,
          ),
        ],
      ),
    );
  }

  Widget _statTile(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.inputBorder),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.orange, size: 20),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 10,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLevelDistribution(ReferralDashboard d) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Referral Levels',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: d.levelDistribution.map((lvl) {
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '${lvl.percentage}%',
                        style: const TextStyle(
                          color: AppColors.orange,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'L${lvl.level}',
                        style: const TextStyle(
                          color: AppColors.hintText,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          const Text(
            '1/3 of community pool · 50% cash + 50% vPT',
            style: TextStyle(color: AppColors.hintText, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    final tabs = ['Earnings', 'Referrals', 'Upline'];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: List.generate(tabs.length, (i) {
          final selected = _tabIndex == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() {
                _tabIndex = i;
              }),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  gradient: selected ? AppColors.buttonGradient : null,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Text(
                  tabs[i],
                  style: TextStyle(
                    color: selected ? AppColors.white : AppColors.hintText,
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildTabContent(ReferralDashboard d) {
    switch (_tabIndex) {
      case 0:
        return _buildEarningsTab(d);
      case 1:
        return _buildReferralsTab(d);
      case 2:
        return _buildUplineTab(d);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildEarningsTab(ReferralDashboard d) {
    if (d.earnings.isEmpty) {
      return _emptyState(
        'No earnings yet',
        'Share your code to start earning!',
      );
    }
    final pageCount = _pageCount(d.earnings.length);
    final items = _paginate(d.earnings, _earningsPage);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          ...items.map((e) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'L${e.level}',
                      style: const TextStyle(
                        color: AppColors.orange,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.sourceName ?? e.sourceEmail ?? 'Unknown',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _timeAgo(e.createdAt),
                          style: const TextStyle(
                            color: AppColors.goldText,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (e.amountNgn > 0)
                        Text(
                          '₦${e.amountNgn.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: AppColors.lightOrange,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      if (e.amountVptUnits > 0)
                        Text(
                          '${e.amountVptUnits.toStringAsFixed(0)} vPT',
                          style: const TextStyle(
                            color: AppColors.orange,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: e.isPending
                              ? AppColors.lightOrange.withValues(alpha: 0.15)
                              : Colors.green.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          e.isPending ? 'Pending' : 'Credited',
                          style: TextStyle(
                            color: e.isPending
                                ? AppColors.lightOrange
                                : Colors.green,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
          Padding(
            padding: const EdgeInsets.all(14),
            child: AppPaginationControls(
              currentPage: _earningsPage,
              totalPages: pageCount,
              onPrevious: _earningsPage > 0
                  ? () => setState(() => _earningsPage -= 1)
                  : null,
              onNext: _earningsPage < pageCount - 1
                  ? () => setState(() => _earningsPage += 1)
                  : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReferralsTab(ReferralDashboard d) {
    if (d.directReferrals.isEmpty) {
      return _emptyState(
        'No referrals yet',
        'Share your code to invite friends!',
      );
    }
    final pageCount = _pageCount(d.directReferrals.length);
    final items = _paginate(d.directReferrals, _referralsPage);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          ...items.map((r) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      (r.name ?? r.email ?? '?')[0].toUpperCase(),
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.name ?? 'Anonymous',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (r.email != null)
                          Text(
                            r.email!,
                            style: const TextStyle(
                              color: AppColors.goldText,
                              fontSize: 10,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  if (r.joinedAt != null)
                    Text(
                      _timeAgo(r.joinedAt!),
                      style: const TextStyle(
                        color: AppColors.goldText,
                        fontSize: 10,
                      ),
                    ),
                ],
              ),
            );
          }),
          Padding(
            padding: const EdgeInsets.all(14),
            child: AppPaginationControls(
              currentPage: _referralsPage,
              totalPages: pageCount,
              onPrevious: _referralsPage > 0
                  ? () => setState(() => _referralsPage -= 1)
                  : null,
              onNext: _referralsPage < pageCount - 1
                  ? () => setState(() => _referralsPage += 1)
                  : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUplineTab(ReferralDashboard d) {
    if (d.upline.isEmpty) {
      return _emptyState('No upline', 'You joined without a referral code.');
    }
    final pageCount = _pageCount(d.upline.length);
    final items = _paginate(d.upline, _uplinePage);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          ...items.map((u) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'L${u.level ?? '?'}',
                      style: const TextStyle(
                        color: AppColors.lightOrange,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          u.name ?? 'Anonymous',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (u.email != null)
                          Text(
                            u.email!,
                            style: const TextStyle(
                              color: AppColors.goldText,
                              fontSize: 10,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  Text(
                    'Level ${u.level ?? '?'} referrer',
                    style: const TextStyle(
                      color: AppColors.goldText,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            );
          }),
          Padding(
            padding: const EdgeInsets.all(14),
            child: AppPaginationControls(
              currentPage: _uplinePage,
              totalPages: pageCount,
              onPrevious: _uplinePage > 0
                  ? () => setState(() => _uplinePage -= 1)
                  : null,
              onNext: _uplinePage < pageCount - 1
                  ? () => setState(() => _uplinePage += 1)
                  : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyState(String title, String subtitle) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(color: AppColors.hintText, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildHowItWorks() {
    final steps = [
      (
        'Share your code',
        'Send your referral code to friends via WhatsApp, SMS, or social media.',
        Icons.share_rounded,
      ),
      (
        'Friends sign up',
        'When a friend registers using your code, they join your referral tree.',
        Icons.person_add_rounded,
      ),
      (
        'Earn from subscriptions',
        'When anyone in your 5-level tree subscribes to a creator, you earn a cut.',
        Icons.monetization_on_rounded,
      ),
      (
        '5-level deep',
        'L1: 40% · L2: 20% · L3: 15% · L4: 15% · L5: 10% of the referral pool.',
        Icons.trending_up_rounded,
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'How It Works',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          ...steps.map((step) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(step.$3, color: AppColors.white, size: 18),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step.$1,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          step.$2,
                          style: const TextStyle(
                            color: AppColors.hintText,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
