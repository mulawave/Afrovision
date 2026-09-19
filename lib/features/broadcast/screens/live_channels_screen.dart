import '../../../core/ads/pangle_widgets.dart';
import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';

class LiveChannelsScreen extends StatefulWidget {
  const LiveChannelsScreen({super.key});

  @override
  State<LiveChannelsScreen> createState() => _LiveChannelsScreenState();
}

class _LiveChannelsScreenState extends State<LiveChannelsScreen>
    with SingleTickerProviderStateMixin {
  static const int _channelsPerPage = 12;

  late final AnimationController _animCtrl;
  late final Animation<double> _fadeIn;
  late final Animation<Offset> _slideUp;

  bool _loading = true;
  String? _error;
  List<ChannelModel> _liveChannels = const [];
  int _currentPage = 1;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _fadeIn = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _loadLiveChannels();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadLiveChannels({bool forceRefresh = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final channels = await ChannelService.getPublicChannels(
        forceRefresh: forceRefresh,
      );
      if (!mounted) return;

      final all = channels.where((channel) => channel.isActive).toList()
        ..sort((a, b) => b.subscriberCount.compareTo(a.subscriberCount));

      setState(() {
        _liveChannels = all;
        _currentPage = 1;
        _loading = false;
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error =
            'Unable to load channels right now. Please check your internet connection and retry.';
        _loading = false;
      });
    }
  }

  int get _totalPages {
    if (_liveChannels.isEmpty) return 1;
    return (_liveChannels.length / _channelsPerPage).ceil();
  }

  List<ChannelModel> get _visibleChannels {
    final page = _currentPage.clamp(1, _totalPages);
    final start = (page - 1) * _channelsPerPage;
    final end = (start + _channelsPerPage).clamp(0, _liveChannels.length);
    return _liveChannels.sublist(start, end);
  }

  void _goToPreviousPage() {
    if (_currentPage <= 1) return;
    setState(() => _currentPage -= 1);
  }

  void _goToNextPage() {
    if (_currentPage >= _totalPages) return;
    setState(() => _currentPage += 1);
  }

  void _openChannelPlayer(String channelId) {
    Navigator.pushNamed(context, '/channel-player', arguments: channelId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              const MarqueeTickerWidget(),
              Expanded(child: _buildContent()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.35),
                ),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ALL CHANNELS',
                  style: TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Channels',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _loadLiveChannels(forceRefresh: true),
            child: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.35),
                ),
              ),
              child: const Icon(
                Icons.refresh_rounded,
                color: AppColors.lightOrange,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return _buildLoadingState();
    }

    if (_error != null) {
      return _buildErrorState();
    }

    if (_liveChannels.isEmpty) {
      return _buildEmptyState();
    }

    return FadeTransition(
      opacity: _fadeIn,
      child: SlideTransition(
        position: _slideUp,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  Text(
                    '${_liveChannels.length} channels',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.88),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Page $_currentPage/$_totalPages',
                    style: TextStyle(
                      color: AppColors.lightOrange.withValues(alpha: 0.9),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    sliver: SliverGrid(
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 12,
                            childAspectRatio: 0.82,
                          ),
                      delegate: SliverChildBuilderDelegate((context, index) {
                        final channel = _visibleChannels[index];
                        return _LiveChannelCard(
                          channel: channel,
                          onTap: () => _openChannelPlayer(channel.id),
                        );
                      }, childCount: _visibleChannels.length),
                    ),
                  ),
                  const SliverToBoxAdapter(child: PangleBigBanner()),
                ],
              ),
            ),
            _buildPaginationControls(),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.82,
      ),
      itemCount: 6,
      itemBuilder: (_, __) {
        return Container(
          decoration: BoxDecoration(
            color: AppColors.cardBg.withValues(alpha: 0.75),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.inputBorder.withValues(alpha: 0.35),
            ),
          ),
          child: Column(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(16),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Container(
                      height: 10,
                      decoration: BoxDecoration(
                        color: AppColors.inputBorder,
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 8,
                      width: 70,
                      decoration: BoxDecoration(
                        color: AppColors.inputBorder,
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.cardBg.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.wifi_tethering_off_rounded,
                  color: AppColors.lightOrange,
                  size: 34,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'No channels available right now',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Check back shortly or browse all channels.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.lightOrange.withValues(alpha: 0.9),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              AppButton(
                label: 'Browse Channels',
                onPressed: () => Navigator.pushNamed(context, '/channels'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.cardBg.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.errorRed.withValues(alpha: 0.45),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.wifi_off_rounded,
                color: AppColors.errorRed,
                size: 40,
              ),
              const SizedBox(height: 12),
              const Text(
                'Unable to load channels',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _error ?? 'Please try again.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.lightOrange.withValues(alpha: 0.9),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              AppButton(
                label: 'Retry',
                onPressed: () => _loadLiveChannels(forceRefresh: true),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPaginationControls() {
    final canGoPrev = _currentPage > 1;
    final canGoNext = _currentPage < _totalPages;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Row(
        children: [
          Expanded(
            child: _PaginationButton(
              label: 'Previous',
              icon: Icons.chevron_left_rounded,
              enabled: canGoPrev,
              onTap: _goToPreviousPage,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _PaginationButton(
              label: 'Next',
              icon: Icons.chevron_right_rounded,
              enabled: canGoNext,
              onTap: _goToNextPage,
              iconAtEnd: true,
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveChannelCard extends StatelessWidget {
  final ChannelModel channel;
  final VoidCallback onTap;

  const _LiveChannelCard({required this.channel, required this.onTap});

  String _formatViewerCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    }
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return '$count';
  }

  @override
  Widget build(BuildContext context) {
    final hasLogo = channel.logoUrl != null && channel.logoUrl!.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.4),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.22),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.lightBlue.withValues(alpha: 0.72),
                            AppColors.darkBlue,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(16),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.errorRed.withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _PulseDot(),
                          SizedBox(width: 4),
                          Text(
                            'LIVE',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.7,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg.withValues(alpha: 0.78),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: AppColors.inputBorder.withValues(alpha: 0.6),
                        ),
                      ),
                      child: Text(
                        '👁 ${_formatViewerCount(channel.viewerCount)}',
                        style: const TextStyle(
                          color: AppColors.lightOrange,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 10,
                    left: 10,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.cardBg.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.lightOrange.withValues(alpha: 0.4),
                        ),
                        image: hasLogo
                            ? DecorationImage(
                                image: NetworkImage(
                                  AppConfig.mediaUrl(channel.logoUrl!),
                                ),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      child: hasLogo
                          ? null
                          : const Icon(
                              Icons.live_tv_rounded,
                              color: AppColors.lightOrange,
                              size: 22,
                            ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    channel.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          channel.category?.isNotEmpty == true
                              ? channel.category!
                              : 'General',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.lightOrange.withValues(
                              alpha: 0.88,
                            ),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${channel.viewerCount} viewers',
                        style: TextStyle(
                          color: AppColors.white.withValues(alpha: 0.85),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaginationButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  final bool iconAtEnd;

  const _PaginationButton({
    required this.label,
    required this.icon,
    required this.enabled,
    required this.onTap,
    this.iconAtEnd = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 180),
        opacity: enabled ? 1 : 0.45,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: AppColors.inputBorder.withValues(alpha: 0.45),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: iconAtEnd
                ? [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(icon, color: AppColors.lightOrange, size: 16),
                  ]
                : [
                    Icon(icon, color: AppColors.lightOrange, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
          ),
        ),
      ),
    );
  }
}

class _PulseDot extends StatelessWidget {
  const _PulseDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 6,
      height: 6,
      decoration: const BoxDecoration(
        color: AppColors.white,
        shape: BoxShape.circle,
      ),
    );
  }
}
