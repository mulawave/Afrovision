import 'dart:math' show max;
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/api/api_service.dart';
import '../models/channel_model.dart';

final Map<String, Map<String, dynamic>> _analyticsCache = {};

class ChannelAnalyticsScreen extends StatefulWidget {
  const ChannelAnalyticsScreen({super.key});

  @override
  State<ChannelAnalyticsScreen> createState() => _ChannelAnalyticsScreenState();
}

class _ChannelAnalyticsScreenState extends State<ChannelAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _anim;
  late Animation<double> _fade;

  ChannelModel? _channel;
  String _period = '30d';
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;

  final _periods = [
    {'value': '7d', 'label': '7 Days'},
    {'value': '30d', 'label': '30 Days'},
    {'value': '90d', 'label': '90 Days'},
    {'value': '365d', 'label': '1 Year'},
  ];

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fade = CurvedAnimation(parent: _anim, curve: Curves.easeOut);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _channel != null) return;
      final arg = ModalRoute.of(context)?.settings.arguments;
      if (arg is! ChannelModel) {
        setState(() {
          _error = 'Channel not found';
          _loading = false;
        });
        return;
      }

      setState(() => _channel = arg);
      _loadAnalytics();
    });
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  String get _cacheKey => '${_channel!.id}_$_period';

  Future<void> _loadAnalytics({bool forceRefresh = false}) async {
    if (_channel == null) return;

    if (!forceRefresh && _analyticsCache.containsKey(_cacheKey)) {
      setState(() {
        _data = _analyticsCache[_cacheKey];
        _loading = false;
        _error = null;
      });
      _anim.forward(from: 0);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    _anim.reset();
    try {
      final result = await ApiService.get(
        '/analytics/creator/channel?channel_id=${_channel!.id}&period=$_period',
      );
      if (mounted) {
        _analyticsCache[_cacheKey] = result;
        setState(() {
          _data = result;
          _loading = false;
        });
        _anim.forward();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _loading = false;
        });
      }
    }
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
          child: Column(
            children: [
              _buildHeader(),
              _buildPeriodSelector(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
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

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.4),
                ),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CHANNEL ANALYTICS',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                  ),
                ),
                if (_channel != null)
                  Text(
                    _channel!.name,
                    style: TextStyle(color: AppColors.goldText, fontSize: 12),
                  ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _loadAnalytics(forceRefresh: true),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.4),
                ),
              ),
              child: const Icon(
                Icons.refresh_rounded,
                color: AppColors.orange,
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodSelector() {
    return Padding(
      padding: const EdgeInsets.only(left: 20, right: 20, bottom: 12),
      child: Row(
        children: _periods.map((p) {
          final selected = _period == p['value'];
          return Expanded(
            child: GestureDetector(
              onTap: () {
                if (!selected) {
                  setState(() => _period = p['value']!);
                  _loadAnalytics();
                }
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.orange.withValues(alpha: 0.18)
                      : AppColors.cardBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: selected
                        ? AppColors.orange.withValues(alpha: 0.6)
                        : AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
                child: Center(
                  child: Text(
                    p['label']!,
                    style: TextStyle(
                      color: selected ? AppColors.orange : AppColors.hintText,
                      fontSize: 11,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
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
              onTap: _loadAnalytics,
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

  Widget _buildContent() {
    final overview = _data?['overview'] as Map<String, dynamic>? ?? {};
    final hourlyActivity =
        (_data?['viewer_activity_by_hour'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        [];
    final timeline =
        (_data?['timeline'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
        [];
    final demographics = _data?['demographics'] as Map<String, dynamic>? ?? {};

    return FadeTransition(
      opacity: _fade,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildOverviewGrid(overview),
            const SizedBox(height: 20),
            _buildHourlyChart(hourlyActivity, overview),
            const SizedBox(height: 20),
            _buildTimelineChart(timeline),
            const SizedBox(height: 20),
            _buildPeriodHighs(overview),
            const SizedBox(height: 20),
            _buildDemographics(demographics),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // ── Overview Grid ──────────────────────────────────────────────────

  Widget _buildOverviewGrid(Map<String, dynamic> ov) {
    final stats = [
      {
        'label': 'Total Views',
        'value': _fmt(ov['total_views'] ?? 0),
        'icon': Icons.visibility_rounded,
        'color': AppColors.orange,
      },
      {
        'label': 'Unique Viewers',
        'value': _fmt(ov['unique_viewers'] ?? 0),
        'icon': Icons.people_rounded,
        'color': AppColors.lightOrange,
      },
      {
        'label': 'Peak Viewers',
        'value': _fmt(ov['peak_viewers'] ?? 0),
        'icon': Icons.trending_up_rounded,
        'color': const Color(0xFF4CAF50),
      },
      {
        'label': 'Peak Hour',
        'value': '${ov['peak_hour'] ?? '--'}',
        'icon': Icons.access_time_rounded,
        'color': const Color(0xFF2196F3),
      },
      {
        'label': 'Reactions',
        'value': _fmt(ov['total_reactions'] ?? 0),
        'icon': Icons.favorite_rounded,
        'color': const Color(0xFFE91E63),
      },
      {
        'label': 'Comments',
        'value': _fmt(ov['total_comments'] ?? 0),
        'icon': Icons.chat_bubble_rounded,
        'color': const Color(0xFF9C27B0),
      },
      {
        'label': 'Gifts Sent',
        'value': _fmt(ov['total_gifts_count'] ?? 0),
        'icon': Icons.card_giftcard_rounded,
        'color': AppColors.lightOrange,
      },
      {
        'label': 'Gift Revenue (₦)',
        'value': '₦${_fmt(ov['total_gifts_ngn'] ?? 0)}',
        'icon': Icons.monetization_on_rounded,
        'color': AppColors.orange,
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Overview'),
        const SizedBox(height: 12),
        GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 1.8,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemCount: stats.length,
          itemBuilder: (_, i) => _buildStatCard(stats[i]),
        ),
      ],
    );
  }

  Widget _buildStatCard(Map<String, dynamic> stat) {
    final color = stat['color'] as Color;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkBlue.withValues(alpha: 0.4),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(stat['icon'] as IconData, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    stat['value'] as String,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    stat['label'] as String,
                    style: TextStyle(color: AppColors.hintText, fontSize: 10),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Hourly Activity Chart ──────────────────────────────────────────

  Widget _buildHourlyChart(
    List<Map<String, dynamic>> hourlyData,
    Map<String, dynamic> ov,
  ) {
    if (hourlyData.isEmpty) return const SizedBox.shrink();

    final maxEvents = hourlyData
        .map((h) => (h['events'] as num).toDouble())
        .reduce(max);
    final peakHour = ov['peak_hour'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _sectionTitle('Activity by Hour of Day'),
              const Spacer(),
              if (peakHour.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Peak: $peakHour',
                    style: const TextStyle(
                      color: AppColors.orange,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 80,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: hourlyData.map((h) {
                final val = (h['events'] as num).toDouble();
                final heightPct = maxEvents > 0 ? val / maxEvents : 0.0;
                final isPeak = heightPct >= 0.9;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1.5),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          height: 8 + (heightPct * 60),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: isPeak
                                  ? [AppColors.lightOrange, AppColors.orange]
                                  : [
                                      AppColors.orange.withValues(alpha: 0.5),
                                      AppColors.orange.withValues(alpha: 0.3),
                                    ],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                '12am',
                style: TextStyle(color: AppColors.hintText, fontSize: 9),
              ),
              const Spacer(),
              Text(
                '6am',
                style: TextStyle(color: AppColors.hintText, fontSize: 9),
              ),
              const Spacer(),
              Text(
                '12pm',
                style: TextStyle(color: AppColors.hintText, fontSize: 9),
              ),
              const Spacer(),
              Text(
                '6pm',
                style: TextStyle(color: AppColors.hintText, fontSize: 9),
              ),
              const Spacer(),
              Text(
                '11pm',
                style: TextStyle(color: AppColors.hintText, fontSize: 9),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Timeline Chart ─────────────────────────────────────────────────

  Widget _buildTimelineChart(List<Map<String, dynamic>> timeline) {
    if (timeline.isEmpty) return const SizedBox.shrink();

    final maxViews = timeline
        .map((d) => (d['views'] as num).toDouble())
        .reduce(max);

    // Show only last 30 entries max for readability
    final visible = timeline.length > 30
        ? timeline.sublist(timeline.length - 30)
        : timeline;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Daily Viewer Trend'),
          const SizedBox(height: 14),
          SizedBox(
            height: 80,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: visible.map((d) {
                final val = (d['views'] as num).toDouble();
                final heightPct = maxViews > 0 ? val / maxViews : 0.0;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          height: 4 + (heightPct * 70),
                          decoration: BoxDecoration(
                            color: AppColors.lightOrange.withValues(
                              alpha: 0.3 + heightPct * 0.7,
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 6),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Oldest',
                style: TextStyle(color: AppColors.hintText, fontSize: 9),
              ),
              Text(
                'Today',
                style: TextStyle(color: AppColors.hintText, fontSize: 9),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Period Highs ───────────────────────────────────────────────────

  Widget _buildPeriodHighs(Map<String, dynamic> ov) {
    final bestDayViews = ov['best_day_views'] ?? 0;
    final bestDayDate = ov['best_day_date'] as String? ?? '--';
    final weeklyViews = ov['weekly_views'] ?? 0;
    final monthlyViews = ov['monthly_views'] ?? 0;
    final yearlyViews = ov['yearly_views'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Viewing Milestones'),
          const SizedBox(height: 14),
          _buildHighRow(
            'Best Single Day',
            '$bestDayViews views',
            bestDayDate,
            const Color(0xFF4CAF50),
          ),
          _buildHighRow(
            'Last 7 Days',
            '$weeklyViews views',
            'Weekly total',
            AppColors.lightOrange,
          ),
          _buildHighRow(
            'Last 30 Days',
            '$monthlyViews views',
            'Monthly total',
            AppColors.orange,
          ),
          _buildHighRow(
            'This Period',
            '$yearlyViews views',
            'Overall total',
            const Color(0xFF2196F3),
          ),
        ],
      ),
    );
  }

  Widget _buildHighRow(String label, String value, String sub, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.bar_chart_rounded, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(color: AppColors.hintText, fontSize: 11),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          Text(
            sub,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  // ── Demographics ───────────────────────────────────────────────────

  Widget _buildDemographics(Map<String, dynamic> demo) {
    final gender =
        (demo['gender'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
    final ageGroups =
        (demo['age_groups'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
        [];
    final topCountries =
        (demo['top_countries'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        [];
    final totalIdentified = (demo['total_identified'] as num?)?.toInt() ?? 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _sectionTitle('Viewer Demographics'),
              const Spacer(),
              if (totalIdentified > 0)
                Text(
                  'From $totalIdentified identified viewers',
                  style: TextStyle(color: AppColors.hintText, fontSize: 10),
                ),
            ],
          ),
          if (totalIdentified == 0) ...[
            const SizedBox(height: 16),
            Center(
              child: Text(
                'Demographics available once viewers with KYC data are recorded.',
                style: TextStyle(
                  color: AppColors.hintText,
                  fontSize: 12,
                  height: 1.6,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ] else ...[
            if (gender.isNotEmpty) ...[
              const SizedBox(height: 16),
              _demoSubtitle('Gender Breakdown'),
              const SizedBox(height: 10),
              ...gender.map(
                (g) => _demoBar(
                  g['label'] as String,
                  g['pct'] as int,
                  g['count'] as int,
                  _genderColor(g['label'] as String),
                ),
              ),
            ],
            if (ageGroups.isNotEmpty) ...[
              const SizedBox(height: 16),
              _demoSubtitle('Age Groups'),
              const SizedBox(height: 10),
              ...ageGroups.map(
                (a) => _demoBar(
                  a['label'] as String,
                  a['pct'] as int,
                  a['count'] as int,
                  AppColors.lightOrange,
                ),
              ),
            ],
            if (topCountries.isNotEmpty) ...[
              const SizedBox(height: 16),
              _demoSubtitle('Top Locations'),
              const SizedBox(height: 10),
              ...topCountries
                  .take(5)
                  .map(
                    (c) => _demoBar(
                      c['country'] as String,
                      c['pct'] as int,
                      c['count'] as int,
                      AppColors.orange,
                    ),
                  ),
            ],
          ],
        ],
      ),
    );
  }

  Color _genderColor(String label) {
    switch (label.toLowerCase()) {
      case 'male':
        return const Color(0xFF2196F3);
      case 'female':
        return const Color(0xFFE91E63);
      default:
        return AppColors.hintText;
    }
  }

  Widget _demoSubtitle(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: AppColors.hintText,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _demoBar(String label, int pct, int count, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        children: [
          Row(
            children: [
              SizedBox(
                width: 100,
                child: Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Stack(
                    children: [
                      Container(
                        height: 8,
                        color: AppColors.inputBorder.withValues(alpha: 0.3),
                      ),
                      FractionallySizedBox(
                        widthFactor: pct / 100,
                        child: Container(
                          height: 8,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [color.withValues(alpha: 0.6), color],
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '$pct%',
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                '($count)',
                style: TextStyle(color: AppColors.hintText, fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: AppColors.white,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  String _fmt(dynamic value) {
    final n = (value as num?)?.toInt() ?? 0;
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }
}
