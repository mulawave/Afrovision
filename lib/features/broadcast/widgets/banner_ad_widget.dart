import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../services/broadcast_service.dart';

/// Reusable banner ad widget. Pass placement = 'home' or 'page'.
class BannerAdWidget extends StatefulWidget {
  final String placement;

  const BannerAdWidget({super.key, this.placement = 'home'});

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget>
    with WidgetsBindingObserver {
  Map<String, dynamic>? _ad;
  String? _lastImpressionAdId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadAd();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadAd();
    }
  }

  Future<void> _loadAd() async {
    try {
      final ad = await BroadcastService.getBannerAd(widget.placement);
      if (!mounted) return;
      setState(() => _ad = ad);
      if (ad != null) {
        final adId = ad['id'] as String? ?? '';
        // Only record impression when the ad changes to avoid duplicate billing
        if (adId.isNotEmpty && adId != _lastImpressionAdId) {
          _lastImpressionAdId = adId;
          BroadcastService.recordAdImpression(
            adId: adId,
          ).catchError((_) => <String, dynamic>{});
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_ad == null) return const SizedBox.shrink();

    final title = _ad!['title'] as String? ?? '';
    final description = _ad!['description'] as String? ?? '';
    final clickUrl = _ad!['click_url'] as String? ?? '';
    final mediaUrl = _ad!['media_url'] as String? ?? '';
    final fullMediaUrl = mediaUrl.startsWith('http')
        ? mediaUrl
        : '${AppConfig.baseUrl}$mediaUrl';
    final hasImage = mediaUrl.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: clickUrl.isNotEmpty
            ? () => launchUrl(
                Uri.parse(clickUrl),
                mode: LaunchMode.externalApplication,
              )
            : null,
        child: Container(
          width: double.infinity,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: AppColors.inputBorder.withValues(alpha: 0.15),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Ad content
              if (hasImage)
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    fullMediaUrl,
                    width: double.infinity,
                    height: 120,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        _buildTextFallback(title, description),
                  ),
                )
              else
                _buildTextFallback(title, description),

              // Sponsored label
              Positioned(
                top: 6,
                left: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Sponsored',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.5),
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
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

  Widget _buildTextFallback(String title, String description) {
    return Container(
      width: double.infinity,
      height: 90,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.lightBlue.withValues(alpha: 0.3),
            AppColors.darkBlue.withValues(alpha: 0.5),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (title.isNotEmpty)
              Text(
                title,
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.8),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                description,
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.5),
                  fontSize: 10,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
