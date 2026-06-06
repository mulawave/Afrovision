import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../static_pages_registry.dart';

class StaticPageViewerScreen extends StatefulWidget {
  final String routeName;

  const StaticPageViewerScreen({super.key, required this.routeName});

  @override
  State<StaticPageViewerScreen> createState() => _StaticPageViewerScreenState();
}

class _StaticPageViewerScreenState extends State<StaticPageViewerScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  StaticPageEntry? _entry;
  bool _opening = true;
  bool _opened = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));

    _entry = StaticPagesRegistry.entryForRoute(widget.routeName);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _openInApp();
    });
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _openInApp() async {
    final entry = _entry;
    if (entry == null) {
      setState(() {
        _opening = false;
        _opened = false;
        _error = 'Static page is not configured for this route.';
      });
      _animCtrl.forward(from: 0);
      return;
    }

    setState(() {
      _opening = true;
      _error = null;
    });

    final uri = StaticPagesRegistry.uriForEntry(entry);
    try {
      final opened = await launchUrl(
        uri,
        mode: LaunchMode.inAppWebView,
        webViewConfiguration: const WebViewConfiguration(
          enableJavaScript: true,
          enableDomStorage: true,
        ),
      );

      if (!mounted) return;
      setState(() {
        _opening = false;
        _opened = opened;
        _error = opened ? null : 'Could not open in-app page.';
      });
      _animCtrl.forward(from: 0);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _opening = false;
        _opened = false;
        _error = 'Failed to launch in-app page.';
      });
      _animCtrl.forward(from: 0);
    }
  }

  Future<void> _openExternal() async {
    final entry = _entry;
    if (entry == null) return;
    final uri = StaticPagesRegistry.uriForEntry(entry);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
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
              _buildAppBar(entry?.title ?? 'Static Page'),
              Expanded(
                child: _opening
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      )
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: _buildBody(entry),
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

  Widget _buildBody(StaticPageEntry? entry) {
    final pageUrl = entry == null
        ? null
        : StaticPagesRegistry.uriForEntry(entry);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Text(
              _error == null
                  ? 'Opened in-app webview for this legal/static page. If you closed it, you can reopen it below.'
                  : _error!,
              style: TextStyle(
                color: _error == null ? AppColors.goldText : AppColors.errorRed,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (entry != null)
            Container(
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
                  Text(
                    entry.title,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    entry.summary,
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.72),
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    pageUrl.toString(),
                    style: const TextStyle(
                      color: AppColors.goldText,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          if (_opened)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.successGreen.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.successGreen.withValues(alpha: 0.35),
                ),
              ),
              child: const Text(
                'In-app page opened successfully.',
                style: TextStyle(
                  color: AppColors.successGreen,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          const SizedBox(height: 16),
          _actionButton(
            label: 'Open In-App Webview',
            icon: Icons.open_in_new_rounded,
            onTap: _openInApp,
            highlighted: true,
          ),
          const SizedBox(height: 10),
          _actionButton(
            label: 'Open In External Browser',
            icon: Icons.public_rounded,
            onTap: _openExternal,
            highlighted: false,
          ),
          const SizedBox(height: 10),
          _actionButton(
            label: 'Back To Legal Catalog',
            icon: Icons.menu_book_rounded,
            onTap: () => Navigator.pushNamedAndRemoveUntil(
              context,
              '/legal',
              (route) => route.settings.name == '/legal' || route.isFirst,
            ),
            highlighted: false,
          ),
        ],
      ),
    );
  }

  Widget _actionButton({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
    required bool highlighted,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          gradient: highlighted ? AppColors.buttonGradient : null,
          color: highlighted ? null : AppColors.inputFill,
          borderRadius: BorderRadius.circular(12),
          border: highlighted
              ? null
              : Border.all(color: AppColors.inputBorder.withValues(alpha: 0.8)),
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
                color: highlighted ? AppColors.darkBlue : AppColors.lightOrange,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
