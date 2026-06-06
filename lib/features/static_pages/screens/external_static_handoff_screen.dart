import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../static_pages_registry.dart';

class ExternalStaticHandoffScreen extends StatefulWidget {
  final String routeName;

  const ExternalStaticHandoffScreen({super.key, required this.routeName});

  @override
  State<ExternalStaticHandoffScreen> createState() =>
      _ExternalStaticHandoffScreenState();
}

class _ExternalStaticHandoffScreenState
    extends State<ExternalStaticHandoffScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  StaticPageEntry? _entry;
  bool _launching = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));

    _entry = StaticPagesRegistry.webOnlyEntryForRoute(widget.routeName);
    _animCtrl.forward(from: 0);
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _openExternal() async {
    final entry = _entry;
    if (entry == null) {
      setState(() {
        _error = 'Web-only page is not configured for this route.';
      });
      return;
    }

    setState(() {
      _launching = true;
      _error = null;
    });

    try {
      final opened = await launchUrl(
        StaticPagesRegistry.uriForEntry(entry),
        mode: LaunchMode.externalApplication,
      );
      if (!mounted) return;

      setState(() {
        _launching = false;
        _error = opened ? null : 'Could not open external browser.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _launching = false;
        _error = 'External handoff failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final entry = _entry;

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(entry?.title ?? 'External Handoff'),
              Expanded(
                child: FadeTransition(
                  opacity: _fadeIn,
                  child: SlideTransition(
                    position: _slideUp,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildWebOnlyNotice(entry),
                          const SizedBox(height: 14),
                          if (_error != null)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.errorRed.withValues(
                                  alpha: 0.1,
                                ),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppColors.errorRed.withValues(
                                    alpha: 0.3,
                                  ),
                                ),
                              ),
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: AppColors.errorRed,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          if (_error != null) const SizedBox(height: 14),
                          _actionButton(
                            label: _launching
                                ? 'Opening Browser...'
                                : 'Continue To Website',
                            icon: Icons.open_in_new_rounded,
                            onTap: _launching ? null : _openExternal,
                            highlighted: true,
                          ),
                          const SizedBox(height: 10),
                          _actionButton(
                            label: 'Back To Legal Catalog',
                            icon: Icons.menu_book_rounded,
                            onTap: () => Navigator.pushNamedAndRemoveUntil(
                              context,
                              '/legal',
                              (route) =>
                                  route.settings.name == '/legal' ||
                                  route.isFirst,
                            ),
                            highlighted: false,
                          ),
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

  Widget _buildAppBar(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 40,
              height: 40,
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
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWebOnlyNotice(StaticPageEntry? entry) {
    final pageUrl = entry == null
        ? ''
        : StaticPagesRegistry.uriForEntry(entry).toString();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.language_rounded,
                color: AppColors.lightOrange,
                size: 16,
              ),
              SizedBox(width: 7),
              Expanded(
                child: Text(
                  'Web-Only Handoff',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            entry?.summary ?? 'This page is available on the website only.',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.74),
              fontSize: 12,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'You are leaving the app to continue this flow in your browser.',
            style: TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (pageUrl.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              pageUrl,
              style: const TextStyle(
                color: AppColors.goldText,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _actionButton({
    required String label,
    required IconData icon,
    required VoidCallback? onTap,
    required bool highlighted,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.6 : 1,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            gradient: highlighted ? AppColors.buttonGradient : null,
            color: highlighted ? null : AppColors.inputFill,
            borderRadius: BorderRadius.circular(12),
            border: highlighted
                ? null
                : Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.8),
                  ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                color: highlighted ? AppColors.darkBlue : AppColors.lightOrange,
                size: 16,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: highlighted
                      ? AppColors.darkBlue
                      : AppColors.lightOrange,
                  fontSize: 13,
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
