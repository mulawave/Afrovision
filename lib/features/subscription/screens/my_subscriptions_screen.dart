import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/channel_subscription_model.dart';
import '../services/channel_subscription_service.dart';

class MySubscriptionsScreen extends StatefulWidget {
  const MySubscriptionsScreen({super.key});

  @override
  State<MySubscriptionsScreen> createState() => _MySubscriptionsScreenState();
}

class _MySubscriptionsScreenState extends State<MySubscriptionsScreen>
    with SingleTickerProviderStateMixin {
  bool _loading = true;
  String? _error;
  List<ChannelSubscriptionModel> _subscriptions = [];
  int _currentPage = 0;
  static const int _perPage = 5;

  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _load();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final result = await ChannelSubscriptionService.getMine();
      if (!mounted) return;
      if (result['success'] == true) {
        final list = (result['subscriptions'] as List<dynamic>)
            .cast<ChannelSubscriptionModel>()
            .where((s) => s.isActive)
            .toList();
        setState(() {
          _subscriptions = list;
          _currentPage = 0;
          _loading = false;
          _error = null;
        });
        _animController.forward(from: 0);
      } else {
        final errMsg =
            result['error'] as String? ?? 'Failed to load subscriptions';
        setState(() {
          _error = errMsg;
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load subscriptions';
        _loading = false;
      });
    }
  }

  Future<void> _cancel(ChannelSubscriptionModel sub) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text(
          'Cancel subscription?',
          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'You will lose access to ${sub.channelName}.',
          style: const TextStyle(color: AppColors.hintText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Keep',
              style: TextStyle(color: AppColors.orange),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Cancel subscription',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    _showSnack('Cancellingâ€¦', success: true);
    try {
      final result = await ChannelSubscriptionService.cancel(sub.id);
      if (!mounted) return;
      if (result['success'] == true) {
        _showSnack('Unsubscribed from ${sub.channelName}', success: true);
        setState(() {
          _subscriptions.removeWhere((s) => s.id == sub.id);
          _error = null;
          final totalPages = (_subscriptions.length / _perPage).ceil().clamp(
            1,
            9999,
          );
          if (_currentPage >= totalPages) _currentPage = totalPages - 1;
        });
      } else {
        _showSnack(
          result['error'] as String? ?? 'Failed to cancel subscription',
          success: false,
        );
      }
    } catch (_) {
      if (!mounted) return;
      _showSnack('Failed to cancel. Please try again.', success: false);
    }
  }

  void _showSnack(String msg, {required bool success}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(color: AppColors.white)),
        backgroundColor: success
            ? const Color(0xFF4CAF50).withValues(alpha: 0.9)
            : AppColors.errorRed.withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  int get _totalPages =>
      (_subscriptions.isEmpty ? 1 : (_subscriptions.length / _perPage).ceil());

  List<ChannelSubscriptionModel> get _pageItems {
    final start = _currentPage * _perPage;
    final end = (start + _perPage).clamp(0, _subscriptions.length);
    return _subscriptions.sublist(start, end);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 16, 20, 8),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(
                        Icons.arrow_back_ios_new,
                        color: AppColors.white,
                        size: 20,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    const Expanded(
                      child: Text(
                        'My Subscriptions',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.3,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.refresh_rounded,
                        color: AppColors.orange.withValues(alpha: 0.8),
                        size: 22,
                      ),
                      onPressed: _loading ? null : _load,
                    ),
                  ],
                ),
              ),

              // â”€â”€ Active count badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
              if (!_loading && _subscriptions.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF4CAF50,
                          ).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(
                              0xFF4CAF50,
                            ).withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: const BoxDecoration(
                                color: Color(0xFF4CAF50),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${_subscriptions.length} active subscription${_subscriptions.length == 1 ? '' : 's'}',
                              style: const TextStyle(
                                color: Color(0xFF4CAF50),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

              // â”€â”€ Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      )
                    : _error != null && _subscriptions.isEmpty
                    ? _buildError()
                    : _subscriptions.isEmpty
                    ? _buildEmpty()
                    : FadeTransition(
                        opacity: _fadeAnim,
                        child: Column(
                          children: [
                            Expanded(
                              child: RefreshIndicator(
                                onRefresh: _load,
                                color: AppColors.orange,
                                backgroundColor: AppColors.inputFill,
                                child: ListView.builder(
                                  padding: const EdgeInsets.fromLTRB(
                                    16,
                                    4,
                                    16,
                                    16,
                                  ),
                                  itemCount: _pageItems.length,
                                  itemBuilder: (_, index) {
                                    final sub = _pageItems[index];
                                    return _SubscriptionCard(
                                      subscription: sub,
                                      onCancel: () => _cancel(sub),
                                      onWatchNow: () => Navigator.pushNamed(
                                        context,
                                        '/channel-view',
                                        arguments: sub.channelId,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
                            if (_totalPages > 1) _buildPagination(),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPagination() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.darkBlue.withValues(alpha: 0.6),
        border: Border(
          top: BorderSide(color: AppColors.inputBorder.withValues(alpha: 0.4)),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _pageBtn(
            label: 'Prev',
            icon: Icons.chevron_left_rounded,
            leading: true,
            enabled: _currentPage > 0,
            onTap: () => setState(() => _currentPage--),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(_totalPages, (i) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: i == _currentPage ? 18 : 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(
                  color: i == _currentPage
                      ? AppColors.orange
                      : AppColors.hintText.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
          _pageBtn(
            label: 'Next',
            icon: Icons.chevron_right_rounded,
            leading: false,
            enabled: _currentPage < _totalPages - 1,
            onTap: () => setState(() => _currentPage++),
          ),
        ],
      ),
    );
  }

  Widget _pageBtn({
    required String label,
    required IconData icon,
    required bool leading,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: enabled
              ? AppColors.inputFill
              : AppColors.inputFill.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: enabled
                ? AppColors.lightOrange.withValues(alpha: 0.35)
                : AppColors.inputBorder.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: leading
              ? [
                  Icon(
                    icon,
                    color: enabled ? AppColors.lightOrange : AppColors.hintText,
                    size: 18,
                  ),
                  const SizedBox(width: 2),
                  Text(
                    label,
                    style: TextStyle(
                      color: enabled
                          ? AppColors.lightOrange
                          : AppColors.hintText,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ]
              : [
                  Text(
                    label,
                    style: TextStyle(
                      color: enabled
                          ? AppColors.lightOrange
                          : AppColors.hintText,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(
                    icon,
                    color: enabled ? AppColors.lightOrange : AppColors.hintText,
                    size: 18,
                  ),
                ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline,
            color: AppColors.errorRed.withValues(alpha: 0.7),
            size: 48,
          ),
          const SizedBox(height: 12),
          Text(
            _error!,
            style: const TextStyle(color: AppColors.hintText, fontSize: 14),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: _load,
            child: const Text(
              'Retry',
              style: TextStyle(
                color: AppColors.orange,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.inputBorder.withValues(alpha: 0.4),
              ),
            ),
            child: const Icon(
              Icons.subscriptions_outlined,
              color: AppColors.hintText,
              size: 48,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'No active subscriptions',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Subscribe to channels to see them here.',
            style: TextStyle(color: AppColors.hintText, fontSize: 14),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/channels'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'Browse Channels',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// â”€â”€ Premium palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const Color _kGold = Color(0xFFFFD700);
const Color _kGoldLight = Color(0xFFFFE98A);
const Color _kGoldDeep = Color(0xFFB8860B);

// â”€â”€ Compact Subscription Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _SubscriptionCard extends StatelessWidget {
  final ChannelSubscriptionModel subscription;
  final VoidCallback onCancel;
  final VoidCallback onWatchNow;

  const _SubscriptionCard({
    required this.subscription,
    required this.onCancel,
    required this.onWatchNow,
  });

  String _fmtDate(int? ts) {
    if (ts == null) return 'N/A';
    final d = DateTime.fromMillisecondsSinceEpoch(ts);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final sub = subscription;
    final hasLogo = (sub.channelLogoUrl ?? '').isNotEmpty;
    final isPremium = sub.isPremium;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isPremium
              ? const [Color(0xFF0F0D07), Color(0xFF060A2E)]
              : [AppColors.cardBg, AppColors.darkBlue],
        ),
        border: Border.all(
          width: isPremium ? 1.2 : 1.0,
          color: isPremium
              ? _kGold.withValues(alpha: 0.35)
              : AppColors.inputBorder.withValues(alpha: 0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: isPremium
                ? _kGoldDeep.withValues(alpha: 0.12)
                : Colors.black.withValues(alpha: 0.25),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // â”€â”€ Row 1: logo + name + type badge â”€â”€
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Channel logo / avatar
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: isPremium
                        ? const LinearGradient(
                            colors: [_kGoldLight, _kGold, _kGoldDeep],
                          )
                        : AppColors.buttonGradient,
                    boxShadow: [
                      BoxShadow(
                        color: isPremium
                            ? _kGoldDeep.withValues(alpha: 0.35)
                            : Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(2),
                  child: ClipOval(
                    child: Container(
                      color: isPremium
                          ? const Color(0xFF1B1205)
                          : AppColors.darkBlue,
                      child: hasLogo
                          ? Image.network(
                              sub.channelLogoUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  _fallbackLetter(sub, isPremium),
                            )
                          : _fallbackLetter(sub, isPremium),
                    ),
                  ),
                ),

                const SizedBox(width: 12),

                // Name + category
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        sub.channelName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isPremium ? _kGoldLight : AppColors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.1,
                        ),
                      ),
                      if ((sub.channelCategory ?? '').isNotEmpty)
                        Text(
                          sub.channelCategory!.toUpperCase(),
                          style: TextStyle(
                            color: (isPremium ? _kGold : AppColors.orange)
                                .withValues(alpha: 0.85),
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.0,
                          ),
                        ),
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                // Premium / Free badge
                if (isPremium)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [_kGoldLight, _kGold, _kGoldDeep],
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.star_rounded,
                          color: Color(0xFF1B1205),
                          size: 11,
                        ),
                        SizedBox(width: 3),
                        Text(
                          'PREMIUM',
                          style: TextStyle(
                            color: Color(0xFF1B1205),
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4CAF50).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Text(
                      'FREE',
                      style: TextStyle(
                        color: Color(0xFF4CAF50),
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 10),

            // â”€â”€ Row 2: compact meta strip â”€â”€
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: AppColors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: (isPremium ? _kGold : AppColors.lightOrange)
                      .withValues(alpha: 0.08),
                ),
              ),
              child: Row(
                children: [
                  _metaChip(
                    Icons.event_available_rounded,
                    _fmtDate(sub.subscribedAt),
                    isPremium,
                  ),
                  if (isPremium && sub.amount > 0) ...[
                    _metaDivider(),
                    _metaChip(
                      Icons.payments_rounded,
                      'â‚¦${sub.amount.toInt()}/${sub.intervalUnit[0]}',
                      isPremium,
                    ),
                  ],
                  if (isPremium && sub.nextBilling != null) ...[
                    _metaDivider(),
                    _metaChip(
                      Icons.autorenew_rounded,
                      _fmtDate(sub.nextBilling),
                      isPremium,
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 10),

            // â”€â”€ Row 3: Watch Now + Cancel â”€â”€
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: GestureDetector(
                    onTap: onWatchNow,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        gradient: isPremium
                            ? const LinearGradient(colors: [_kGold, _kGoldDeep])
                            : AppColors.buttonGradient,
                        borderRadius: BorderRadius.circular(11),
                        boxShadow: [
                          BoxShadow(
                            color: (isPremium ? _kGoldDeep : AppColors.orange)
                                .withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.play_circle_filled_rounded,
                            color: isPremium
                                ? const Color(0xFF1B1205)
                                : AppColors.white,
                            size: 16,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'Watch Now',
                            style: TextStyle(
                              color: isPremium
                                  ? const Color(0xFF1B1205)
                                  : AppColors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: onCancel,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.errorRed.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(11),
                      border: Border.all(
                        color: AppColors.errorRed.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.cancel_outlined,
                          color: AppColors.errorRed.withValues(alpha: 0.85),
                          size: 15,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Unsubscribe',
                          style: TextStyle(
                            color: AppColors.errorRed.withValues(alpha: 0.85),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
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

  Widget _fallbackLetter(ChannelSubscriptionModel sub, bool isPremium) {
    return Center(
      child: Text(
        sub.channelName.isNotEmpty ? sub.channelName[0].toUpperCase() : '?',
        style: TextStyle(
          color: isPremium ? _kGoldLight : AppColors.white,
          fontSize: 18,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  Widget _metaChip(IconData icon, String text, bool isPremium) {
    return Expanded(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 11,
            color: (isPremium ? _kGold : AppColors.hintText).withValues(
              alpha: 0.8,
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isPremium ? _kGoldLight : AppColors.white,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaDivider() {
    return Container(
      width: 1,
      height: 14,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      color: AppColors.inputBorder.withValues(alpha: 0.4),
    );
  }
}
