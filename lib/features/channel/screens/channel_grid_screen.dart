import '../../../core/ads/pangle_widgets.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/active_floating_player_banner.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

class ChannelGridScreen extends StatefulWidget {
  const ChannelGridScreen({super.key});

  @override
  State<ChannelGridScreen> createState() => _ChannelGridScreenState();
}

class _ChannelGridScreenState extends State<ChannelGridScreen>
    with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  String? _error;
  List<ChannelModel> _channels = const [];

  late final AnimationController _animCtrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _loadChannels();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadChannels() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final channels = await ChannelService.getPublicChannels();
      if (!mounted) return;
      setState(() {
        _channels = channels;
        _isLoading = false;
      });
      _animCtrl.forward(from: 0);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = 'Unable to load channels right now.';
      });
    }
  }

  String _accessLabel(ChannelModel c) {
    if (c.isExclusive) return 'EXCLUSIVE';
    if (c.requiresPayment) return 'PAID';
    if (c.isSubscriberOnly) return 'SUBSCRIBERS';
    return 'PUBLIC';
  }

  Widget _logo(ChannelModel c) {
    if (c.logoUrl != null && c.logoUrl!.isNotEmpty) {
      return Image.network(
        c.logoUrl!,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _logoFallback(c.name),
      );
    }
    return _logoFallback(c.name);
  }

  Widget _logoFallback(String name) {
    final letter = name.isEmpty ? '?' : name[0].toUpperCase();
    return Container(
      color: AppColors.inputFill,
      child: Center(
        child: Text(
          letter,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 26,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
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
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
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
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Channel Grid',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _loadChannels,
                      icon: const Icon(
                        Icons.refresh_rounded,
                        color: AppColors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const ActiveFloatingPlayerBanner(
                margin: EdgeInsets.fromLTRB(20, 0, 20, 10),
              ),
              const MarqueeTickerWidget(),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.lightOrange,
                        ),
                      )
                    : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.wifi_off_rounded,
                                color: AppColors.hintText,
                                size: 34,
                              ),
                              const SizedBox(height: 10),
                              Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 15,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : FadeTransition(
                        opacity: _fadeAnim,
                        child: SlideTransition(
                          position: _slideAnim,
                          child: CustomScrollView(
                            slivers: [
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(
                                  20,
                                  8,
                                  20,
                                  22,
                                ),
                                sliver: SliverGrid(
                                  gridDelegate:
                                      const SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 2,
                                        crossAxisSpacing: 12,
                                        mainAxisSpacing: 12,
                                        childAspectRatio: 0.86,
                                      ),
                                  delegate: SliverChildBuilderDelegate((
                                    context,
                                    i,
                                  ) {
                                    final channel = _channels[i];
                                    return GestureDetector(
                                      onTap: () => Navigator.pushNamed(
                                        context,
                                        '/channel-view',
                                        arguments: channel,
                                      ),
                                      child: Container(
                                        decoration: BoxDecoration(
                                          color: AppColors.cardBg,
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          border: Border.all(
                                            color: AppColors.inputBorder,
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            Expanded(
                                              child: ClipRRect(
                                                borderRadius:
                                                    const BorderRadius.vertical(
                                                      top: Radius.circular(16),
                                                    ),
                                                child: _logo(channel),
                                              ),
                                            ),
                                            Padding(
                                              padding:
                                                  const EdgeInsets.fromLTRB(
                                                    10,
                                                    10,
                                                    10,
                                                    12,
                                                  ),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    channel.name,
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: const TextStyle(
                                                      color: AppColors.white,
                                                      fontSize: 14,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 8),
                                                  Container(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 8,
                                                          vertical: 4,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: AppColors.orange
                                                          .withValues(
                                                            alpha: 0.14,
                                                          ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            8,
                                                          ),
                                                      border: Border.all(
                                                        color: AppColors.orange
                                                            .withValues(
                                                              alpha: 0.28,
                                                            ),
                                                      ),
                                                    ),
                                                    child: Text(
                                                      _accessLabel(channel),
                                                      style: const TextStyle(
                                                        color: AppColors
                                                            .lightOrange,
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        letterSpacing: 0.35,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }, childCount: _channels.length),
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
            ],
          ),
        ),
      ),
    );
  }
}
