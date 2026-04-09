import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

/// A reusable section widget that displays channels from creators the
/// authenticated user subscribes to.  Drop it into any scrollable screen.
class SubscriberFeedSection extends StatefulWidget {
  /// Called when the user taps a channel card.
  final void Function(ChannelModel channel)? onChannelTap;

  const SubscriberFeedSection({super.key, this.onChannelTap});

  @override
  State<SubscriberFeedSection> createState() => _SubscriberFeedSectionState();
}

class _SubscriberFeedSectionState extends State<SubscriberFeedSection> {
  List<ChannelModel> _channels = [];
  bool _loading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final channels = await ChannelService.getSubscriberFeed();
      if (!mounted) return;
      setState(() {
        _channels = channels;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _hasError = true;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return _buildShimmer();
    }
    if (_hasError || _channels.isEmpty) {
      return const SizedBox.shrink();
    }
    return _buildSection();
  }

  Widget _buildShimmer() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 180,
            height: 16,
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 100,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 3,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, __) => Container(
                width: 130,
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 16,
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                '🔥 Subscriber-Only Live Now',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${_channels.length}',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 110,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: _channels.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) =>
                _buildChannelCard(_channels[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildChannelCard(ChannelModel channel) {
    return GestureDetector(
      onTap: () => widget.onChannelTap?.call(channel),
      child: Container(
        width: 140,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.orange.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                if (channel.logoUrl != null && channel.logoUrl!.isNotEmpty)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      AppConfig.mediaUrl(channel.logoUrl!),
                      width: 32,
                      height: 32,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildDefaultLogo(),
                    ),
                  )
                else
                  _buildDefaultLogo(),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.errorRed.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.circle, color: AppColors.errorRed, size: 6),
                      SizedBox(width: 3),
                      Text(
                        'LIVE',
                        style: TextStyle(
                          color: AppColors.errorRed,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              channel.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.3,
              ),
            ),
            if (channel.isSubscriberOnly) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(
                    Icons.lock_rounded,
                    color: AppColors.orange,
                    size: 10,
                  ),
                  const SizedBox(width: 3),
                  const Text(
                    'Subscribers only',
                    style: TextStyle(
                      color: AppColors.orange,
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDefaultLogo() {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        gradient: AppColors.buttonGradient,
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(Icons.tv_rounded, color: AppColors.white, size: 16),
    );
  }
}
