import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../services/promo_modal_service.dart';

class PromoModalDialog extends StatefulWidget {
  final PromoModalData data;
  const PromoModalDialog({super.key, required this.data});

  static Future<void> checkAndShow(BuildContext context) async {
    final data = await PromoModalService.getIfAvailable();
    if (data == null || !context.mounted) return;
    PromoModalService.markShown();
    await Future.delayed(const Duration(milliseconds: 800));
    if (!context.mounted) return;
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Dismiss promo',
      barrierColor: Colors.black.withValues(alpha: 0.75),
      transitionDuration: const Duration(milliseconds: 350),
      transitionBuilder: (ctx, anim, secondaryAnim, child) {
        final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutBack);
        return FadeTransition(
          opacity: anim,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.9, end: 1.0).animate(curved),
            child: child,
          ),
        );
      },
      pageBuilder: (ctx, anim, secondaryAnim) {
        return PromoModalDialog(data: data);
      },
    );
  }

  @override
  State<PromoModalDialog> createState() => _PromoModalDialogState();
}

class _PromoModalDialogState extends State<PromoModalDialog> {
  String get _fullImageUrl {
    final url = widget.data.imageUrl;
    if (url.isEmpty) return '';
    if (url.startsWith('http')) return url;
    return '${AppConfig.baseUrl}$url';
  }

  void _handleCta() {
    Navigator.of(context).pop();
    final link = widget.data.buttonLink;
    if (link.isEmpty) return;

    if (link.startsWith('http')) {
      launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    } else {
      Navigator.of(context).pushNamed(link);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final hasImage = _fullImageUrl.isNotEmpty;
    final hasCta = data.buttonText.isNotEmpty && data.buttonLink.isNotEmpty;
    final screen = MediaQuery.of(context).size;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Material(
          color: Colors.transparent,
          child: Container(
            constraints: BoxConstraints(
              maxWidth: 420,
              maxHeight: screen.height * 0.92,
            ),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0E1A50), AppColors.darkBlue],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.6),
                  blurRadius: 48,
                  offset: const Offset(0, 20),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: Stack(
                children: [
                  SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // ── Image — full display, takes its own space ──
                        if (hasImage)
                          ConstrainedBox(
                            constraints: BoxConstraints(
                              maxHeight: screen.height * 0.42,
                            ),
                            child: Image.network(
                              _fullImageUrl,
                              width: double.infinity,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => Container(
                                height: 200,
                                color: AppColors.cardBg,
                                child: const Center(
                                  child: Icon(
                                    Icons.image_outlined,
                                    color: Colors.white24,
                                    size: 40,
                                  ),
                                ),
                              ),
                            ),
                          ),

                        // ── Content section ──
                        Padding(
                          padding: EdgeInsets.only(
                            left: 24,
                            right: 24,
                            top: hasImage ? 20 : 48,
                            bottom: 28,
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (data.title.isNotEmpty)
                                Text(
                                  data.title,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    height: 1.25,
                                  ),
                                ),
                              if (data.subtitle.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  data.subtitle,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.lightOrange,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                              if (data.bodyText.isNotEmpty) ...[
                                const SizedBox(height: 16),
                                Text(
                                  data.bodyText,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Colors.white.withValues(alpha: 0.7),
                                    height: 1.55,
                                  ),
                                ),
                              ],
                              if (hasCta) ...[
                                const SizedBox(height: 24),
                                SizedBox(
                                  width: double.infinity,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      gradient: AppColors.buttonGradient,
                                      borderRadius: BorderRadius.circular(16),
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppColors.orange.withValues(
                                            alpha: 0.3,
                                          ),
                                          blurRadius: 20,
                                          offset: const Offset(0, 8),
                                        ),
                                      ],
                                    ),
                                    child: Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        onTap: _handleCta,
                                        borderRadius: BorderRadius.circular(16),
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(
                                            vertical: 15,
                                          ),
                                          child: Text(
                                            data.buttonText,
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.darkBlue,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 16),
                              // ── Dismiss link — clearly visible ──
                              GestureDetector(
                                onTap: () => Navigator.of(context).pop(),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 10,
                                  ),
                                  child: Text(
                                    'No thanks, continue browsing',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: Colors.white.withValues(
                                        alpha: 0.55,
                                      ),
                                      decoration: TextDecoration.underline,
                                      decorationColor: Colors.white.withValues(
                                        alpha: 0.3,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Bold close button — always visible top-right ──
                  Positioned(
                    top: 12,
                    right: 12,
                    child: GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.darkBlue.withValues(alpha: 0.95),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.4),
                            width: 2.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.5),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.close_rounded,
                            color: Colors.white,
                            size: 24,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
