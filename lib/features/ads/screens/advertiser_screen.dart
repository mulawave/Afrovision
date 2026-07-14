import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../services/ad_service.dart';

class AdvertiserScreen extends StatefulWidget {
  const AdvertiserScreen({super.key});
  @override
  State<AdvertiserScreen> createState() => _AdvertiserScreenState();
}

class _AdvertiserScreenState extends State<AdvertiserScreen>
    with TickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late TabController _tabCtrl;

  bool _loading = true;
  List<Map<String, dynamic>> _ads = [];
  Map<String, dynamic>? _analytics;
  String? _error;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _tabCtrl = TabController(length: 3, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ads = await AdService.getMyAds();
      Map<String, dynamic>? analytics;
      try {
        analytics = await AdService.getMyAnalytics();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _ads = ads;
        _analytics = analytics;
        _loading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
      _animCtrl.forward();
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeIn,
            child: Column(
              children: [
                _buildHeader(),
                _buildTabs(),
                Expanded(
                  child: _loading
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: AppColors.orange,
                          ),
                        )
                      : _error != null
                      ? _buildError()
                      : TabBarView(
                          controller: _tabCtrl,
                          children: [
                            _buildMyAdsTab(),
                            _buildSubmitTab(),
                            _buildAnalyticsTab(),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back,
                color: AppColors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Advertise',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Manage your ad campaigns',
                  style: TextStyle(color: AppColors.hintText, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 10, 20, 0),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: TabBar(
        controller: _tabCtrl,
        indicator: BoxDecoration(
          gradient: AppColors.buttonGradient,
          borderRadius: BorderRadius.circular(12),
        ),
        labelColor: AppColors.white,
        unselectedLabelColor: AppColors.hintText,
        dividerColor: Colors.transparent,
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        unselectedLabelStyle: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        tabs: const [
          Tab(text: 'My Ads'),
          Tab(text: 'Submit Ad'),
          Tab(text: 'Analytics'),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline,
              color: AppColors.errorRed,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.errorRed, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: _loadData,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(12),
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
      ),
    );
  }

  // ─── MY ADS TAB ─────────────────────────

  Widget _buildMyAdsTab() {
    if (_ads.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.campaign_outlined, color: AppColors.hintText, size: 56),
            SizedBox(height: 16),
            Text(
              'No ads yet',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Submit your first ad to get started',
              style: TextStyle(color: AppColors.hintText, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
        itemCount: _ads.length,
        itemBuilder: (context, index) {
          final ad = _ads[index];
          final status = ad['status'] as String? ?? 'pending';
          final title = ad['title'] as String? ?? 'Untitled';
          final category = ad['category'] as String? ?? '';
          final budget = (ad['budget'] as num?)?.toDouble() ?? 0;
          final spent = (ad['spent'] as num?)?.toDouble() ?? 0;
          final remaining = budget - spent;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.inputBorder.withValues(alpha: 0.3),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    _statusBadge(status),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  category.replaceAll('_', ' ').toUpperCase(),
                  style: TextStyle(
                    color: AppColors.goldText,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _statPill('Budget', '₦${budget.toStringAsFixed(0)}'),
                    const SizedBox(width: 8),
                    _statPill('Spent', '₦${spent.toStringAsFixed(0)}'),
                    const SizedBox(width: 8),
                    _statPill('Left', '₦${remaining.toStringAsFixed(0)}'),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (status == 'active')
                      _actionButton('Pause', Icons.pause, () async {
                        await AdService.pauseAd(ad['id']);
                        _loadData();
                      }),
                    if (status == 'paused')
                      _actionButton('Resume', Icons.play_arrow, () async {
                        await AdService.resumeAd(ad['id']);
                        _loadData();
                      }),
                    const Spacer(),
                    _actionButton('Top Up', Icons.add_circle_outline, () {
                      _showTopUpDialog(ad['id']);
                    }),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _statusBadge(String status) {
    final colors = {
      'active': const Color(0xFF4CAF50),
      'pending': AppColors.orange,
      'approved': AppColors.lightOrange,
      'paused': AppColors.hintText,
      'rejected': AppColors.errorRed,
      'expired': AppColors.hintText,
    };
    final color = colors[status] ?? AppColors.hintText;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _statPill(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: AppColors.lightOrange,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(color: AppColors.goldText, fontSize: 9),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionButton(String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.lightOrange.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: AppColors.lightOrange.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.lightOrange, size: 14),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.lightOrange,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showTopUpDialog(String adId) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Top Up Ad Budget',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: AppColors.white),
                decoration: InputDecoration(
                  hintText: 'Amount (₦)',
                  hintStyle: const TextStyle(color: AppColors.hintText),
                  filled: true,
                  fillColor: AppColors.inputFill,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.inputBorder),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(ctx),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: Text(
                            'Cancel',
                            style: TextStyle(
                              color: AppColors.hintText,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                        final amount =
                            double.tryParse(controller.text.trim()) ?? 0;
                        if (amount > 0) {
                          Navigator.pop(ctx);
                          await AdService.topUp(adId, amount);
                          _loadData();
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          gradient: AppColors.buttonGradient,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: Text(
                            'Top Up',
                            style: TextStyle(
                              color: AppColors.white,
                              fontWeight: FontWeight.w700,
                            ),
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

  // ─── SUBMIT AD TAB ─────────────────────────

  Widget _buildSubmitTab() {
    return _SubmitAdForm(onSubmitted: _loadData);
  }

  // ─── ANALYTICS TAB ─────────────────────────

  Widget _buildAnalyticsTab() {
    if (_analytics == null) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.bar_chart, color: AppColors.hintText, size: 56),
            SizedBox(height: 16),
            Text(
              'No analytics data yet',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Submit and run ads to see analytics',
              style: TextStyle(color: AppColors.hintText, fontSize: 13),
            ),
          ],
        ),
      );
    }

    final overview = _analytics!['overview'] as Map<String, dynamic>? ?? {};
    final perAd = List<Map<String, dynamic>>.from(_analytics!['per_ad'] ?? []);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Summary cards
          Row(
            children: [
              _analyticCard(
                'Total Impressions',
                '${overview['total_impressions'] ?? 0}',
                Icons.visibility,
              ),
              const SizedBox(width: 12),
              _analyticCard(
                'Total Spent',
                '₦${(overview['total_spent'] as num?)?.toStringAsFixed(0) ?? '0'}',
                Icons.payments,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _analyticCard(
                'Active Ads',
                '${overview['active_ads'] ?? 0}',
                Icons.campaign,
              ),
              const SizedBox(width: 12),
              _analyticCard(
                'Total Ads',
                '${overview['total_ads'] ?? 0}',
                Icons.inventory_2,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Per-ad breakdown
          if (perAd.isNotEmpty) ...[
            const Text(
              'Per Ad Breakdown',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            ...perAd.map(
              (ad) => Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            ad['title'] as String? ?? 'Untitled',
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${ad['impressions'] ?? 0} impressions · ₦${(ad['cost'] as num?)?.toStringAsFixed(0) ?? '0'} spent',
                            style: TextStyle(
                              color: AppColors.goldText,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _statusBadge(ad['status'] as String? ?? 'pending'),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _analyticCard(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.inputBorder.withValues(alpha: 0.3),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppColors.lightOrange, size: 22),
            const SizedBox(height: 10),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(color: AppColors.goldText, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── SUBMIT AD FORM (separate stateful widget for form state) ────

class _SubmitAdForm extends StatefulWidget {
  final VoidCallback onSubmitted;
  const _SubmitAdForm({required this.onSubmitted});

  @override
  State<_SubmitAdForm> createState() => _SubmitAdFormState();
}

class _SubmitAdFormState extends State<_SubmitAdForm> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _budgetCtrl = TextEditingController();
  final _clickUrlCtrl = TextEditingController();
  final _pricePerImpressionCtrl = TextEditingController(text: '1');
  String _category = 'banner_home';
  File? _mediaFile;
  String? _mediaFileName;
  String? _mediaContentType;
  bool _submitting = false;

  final _categories = [
    ('banner_home', 'Banner — Home Page'),
    ('banner_page', 'Banner — Other Pages'),
    ('in_stream_pre', 'In-Stream — Pre-roll'),
    ('in_stream_mid', 'In-Stream — Mid-roll'),
    ('in_stream_brief', 'In-Stream — Brief'),
  ];

  Future<void> _pickMediaFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'],
      allowMultiple: false,
    );
    final file = result?.files.single;
    final path = file?.path;
    if (file == null || path == null) return;

    final ext = (file.extension ?? '').toLowerCase();
    final contentType = switch (ext) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'gif' => 'image/gif',
      'webp' => 'image/webp',
      'mp4' => 'video/mp4',
      'webm' => 'video/webm',
      _ => null,
    };
    if (contentType == null) return;

    setState(() {
      _mediaFile = File(path);
      _mediaFileName = file.name;
      _mediaContentType = contentType;
    });
  }

  Future<void> _submit() async {
    final title = _titleCtrl.text.trim();
    final desc = _descCtrl.text.trim();
    final budget = double.tryParse(_budgetCtrl.text.trim()) ?? 0;
    final clickUrl = _clickUrlCtrl.text.trim();
    final pricePerImpression =
        double.tryParse(_pricePerImpressionCtrl.text.trim()) ?? 0;

    if (title.isEmpty ||
        budget <= 0 ||
        _mediaFile == null ||
        _mediaContentType == null ||
        pricePerImpression <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Title, media file, budget, and price per impression are required',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final upload = await AdService.getUploadUrl(
        contentType: _mediaContentType!,
        fileName: _mediaFileName,
      );
      await AdService.uploadToGcs(
        signedUrl: upload['signed_url'] as String,
        file: _mediaFile!,
        contentType: _mediaContentType!,
      );
      await AdService.submitAd({
        'title': title,
        'description': desc,
        'budget': budget,
        'category': _category,
        'media_url': upload['public_url'],
        if (clickUrl.isNotEmpty) 'click_url': clickUrl,
        'price_per_impression': pricePerImpression,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Ad submitted for review',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: const Color(0xFF4CAF50).withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      _titleCtrl.clear();
      _descCtrl.clear();
      _budgetCtrl.clear();
      _clickUrlCtrl.clear();
      _pricePerImpressionCtrl.text = '1';
      setState(() {
        _mediaFile = null;
        _mediaFileName = null;
        _mediaContentType = null;
      });
      widget.onSubmitted();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Error: $e',
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _budgetCtrl.dispose();
    _clickUrlCtrl.dispose();
    _pricePerImpressionCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Submit a New Ad',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Your ad will be reviewed by an admin before going live.',
            style: TextStyle(color: AppColors.goldText, fontSize: 12),
          ),
          const SizedBox(height: 20),

          _label('Ad Title'),
          _textField(_titleCtrl, 'Enter ad title'),
          const SizedBox(height: 14),

          _label('Description'),
          _textField(_descCtrl, 'Describe your ad', maxLines: 3),
          const SizedBox(height: 14),

          _label('Category'),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _category,
                dropdownColor: AppColors.cardBg,
                style: const TextStyle(color: AppColors.white, fontSize: 14),
                isExpanded: true,
                items: _categories
                    .map(
                      (c) => DropdownMenuItem(value: c.$1, child: Text(c.$2)),
                    )
                    .toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _category = v);
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          _label('Budget (₦)'),
          _textField(_budgetCtrl, 'e.g. 50000', keyboard: TextInputType.number),
          const SizedBox(height: 14),

          _label('Price Per Impression (₦)'),
          _textField(
            _pricePerImpressionCtrl,
            'e.g. 1',
            keyboard: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 14),

          _label('Click URL'),
          _textField(_clickUrlCtrl, 'https://...'),
          const SizedBox(height: 14),

          _label('Media File'),
          GestureDetector(
            onTap: _submitting ? null : _pickMediaFile,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: Row(
                children: [
                  const Icon(Icons.upload_file, color: AppColors.orange, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _mediaFileName ?? 'Choose image or video file',
                      style: TextStyle(
                        color: _mediaFileName == null ? AppColors.hintText : AppColors.white,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          GestureDetector(
            onTap: _submitting ? null : _submit,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                gradient: _submitting ? null : AppColors.buttonGradient,
                color: _submitting ? AppColors.inputFill : null,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'Submit Ad',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: TextStyle(
          color: AppColors.goldText,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _textField(
    TextEditingController ctrl,
    String hint, {
    int maxLines = 1,
    TextInputType? keyboard,
  }) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboard,
      style: const TextStyle(color: AppColors.white, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.hintText),
        filled: true,
        fillColor: AppColors.inputFill,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.inputBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.orange),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
      ),
    );
  }
}
