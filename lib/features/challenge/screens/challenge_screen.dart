import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/api/api_service.dart';
import '../models/challenge_model.dart';
import '../services/challenge_service.dart';
import '../../auth/services/auth_service.dart';

/// Public-facing Challenge page. Visible to all users (no auth required).
/// Shows challenge info, prize pool, rules, and a CTA that routes:
///   - Unauthenticated visitors → /login
///   - Authenticated users     → /challenge/audition
class ChallengeScreen extends StatefulWidget {
  const ChallengeScreen({super.key});

  @override
  State<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends State<ChallengeScreen>
    with SingleTickerProviderStateMixin {
  static const String _fallbackCopyVersion = 'challenge-coming-soon-v2';
  static final DateTime _fallbackCopyReviewedAt = DateTime.utc(2026, 5, 28);
  static const int _fallbackCopyMaxAgeDays = 45;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  ChallengeModel? _challenge;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _load();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ch = await ChallengeService.getActiveChallenge();
      if (!mounted) return;
      setState(() {
        _challenge = ch;
        _loading = false;
      });
      _animCtrl.forward(from: 0);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 404) {
        // No active challenge — show "coming soon" state
        setState(() => _loading = false);
      } else {
        setState(() {
          _loading = false;
          _error = e.message;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load challenge info.';
      });
    }
  }

  void _onJoinTap() async {
    // Check auth — route appropriately
    try {
      await AuthService.getCurrentUser();
      if (!mounted) return;
      Navigator.pushNamed(context, '/challenge/audition');
    } catch (_) {
      if (!mounted) return;
      Navigator.pushNamed(context, '/login');
    }
  }

  bool get _isFallbackCopyStale {
    final ageInDays = DateTime.now().toUtc().difference(
      _fallbackCopyReviewedAt,
    );
    return ageInDays.inDays > _fallbackCopyMaxAgeDays;
  }

  String get _fallbackReviewDateLabel {
    final dt = _fallbackCopyReviewedAt;
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  }

  String get _fallbackReviewDueLabel {
    final due = _fallbackCopyReviewedAt.add(
      const Duration(days: _fallbackCopyMaxAgeDays),
    );
    return '${due.day.toString().padLeft(2, '0')}/${due.month.toString().padLeft(2, '0')}/${due.year}';
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
              _buildAppBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _error != null
                    ? _buildErrorState()
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: RefreshIndicator(
                            color: AppColors.orange,
                            backgroundColor: AppColors.inputFill,
                            onRefresh: _load,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.only(bottom: 40),
                              child: _challenge == null
                                  ? _buildNoChallenge()
                                  : _buildContent(_challenge!),
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

  Widget _buildAppBar() {
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
                color: AppColors.white.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(12),
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
              'AfroVision Challenge',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_rounded, color: AppColors.hintText, size: 48),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.hintText, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: _load,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.orange.withValues(alpha: 0.35),
                  ),
                ),
                child: const Text(
                  'Try Again',
                  style: TextStyle(
                    color: AppColors.orange,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoChallenge() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: AppColors.orange,
              size: 40,
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Challenge Coming Soon',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            'The next AfroVision Challenge is being prepared.\nCheck back soon for the announcement.',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.55),
              fontSize: 14,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          _buildFallbackGovernanceCard(),
        ],
      ),
    );
  }

  Widget _buildFallbackGovernanceCard() {
    final stale = _isFallbackCopyStale;
    final checks = [
      ('Fallback copy version is fresh', !stale),
      ('Challenge rules destination is available', true),
      ('Challenge release checklist passed', false),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: stale
              ? AppColors.errorRed.withValues(alpha: 0.45)
              : AppColors.inputBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                stale ? Icons.warning_amber_rounded : Icons.verified_rounded,
                color: stale ? AppColors.errorRed : AppColors.successGreen,
                size: 18,
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Fallback Governance Guard',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Copy version: $_fallbackCopyVersion\nReviewed: $_fallbackReviewDateLabel\nNext review due: $_fallbackReviewDueLabel',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.7),
              fontSize: 11,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 10),
          ...checks.map((item) {
            final passed = item.$2;
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(
                    passed ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    color: passed ? AppColors.successGreen : AppColors.errorRed,
                    size: 14,
                  ),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      item.$1,
                      style: TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 4),
          Text(
            stale
                ? 'Fallback copy is stale. Review copy and complete the release checklist before using this state as final messaging.'
                : 'Fallback copy is current, but challenge release checklist remains a hard gate before launch.',
            style: TextStyle(
              color: stale
                  ? AppColors.errorRed.withValues(alpha: 0.95)
                  : AppColors.lightOrange,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(ChallengeModel ch) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero banner
        if (ch.bannerUrl != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: AspectRatio(
                aspectRatio: 16 / 7,
                child: Image.network(
                  ch.bannerUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => _buildBannerPlaceholder(ch),
                ),
              ),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildBannerPlaceholder(ch),
          ),
        const SizedBox(height: 24),

        // Title + phase badge
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _buildPhaseBadge(ch.phase),
                  const Spacer(),
                  Text(
                    'Season ${ch.season}',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.4),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                ch.title,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
              if (ch.subtitle.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  ch.subtitle,
                  style: TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Prize pool card
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _buildPrizeCard(ch),
        ),
        const SizedBox(height: 20),

        // Description
        if (ch.description.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildSectionCard(
              title: 'About the Challenge',
              icon: Icons.info_outline_rounded,
              child: Text(
                ch.description,
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.75),
                  fontSize: 14,
                  height: 1.65,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Rules
        if (ch.rules.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildSectionCard(
              title: 'Rules & Guidelines',
              icon: Icons.gavel_rounded,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: ch.rules.asMap().entries.map((entry) {
                  return Padding(
                    padding: EdgeInsets.only(top: entry.key == 0 ? 0 : 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          margin: const EdgeInsets.only(top: 1, right: 10),
                          decoration: BoxDecoration(
                            color: AppColors.orange.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Center(
                            child: Text(
                              '${entry.key + 1}',
                              style: TextStyle(
                                color: AppColors.orange,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            entry.value,
                            style: TextStyle(
                              color: AppColors.white.withValues(alpha: 0.72),
                              fontSize: 13,
                              height: 1.55,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: Align(
              alignment: Alignment.centerRight,
              child: GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/challenge/rules'),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(
                      color: AppColors.orange.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.menu_book_rounded,
                        color: AppColors.orange,
                        size: 14,
                      ),
                      SizedBox(width: 6),
                      Text(
                        'Open Full Rules',
                        style: TextStyle(
                          color: AppColors.orange,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Prizes breakdown
        if (ch.prizes.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildSectionCard(
              title: 'Prize Breakdown',
              icon: Icons.emoji_events_rounded,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: ch.prizes.asMap().entries.map((entry) {
                  final prize = entry.value.toString();
                  return Padding(
                    padding: EdgeInsets.only(top: entry.key == 0 ? 0 : 8),
                    child: Row(
                      children: [
                        Icon(
                          Icons.star_rounded,
                          color: AppColors.lightOrange,
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            prize,
                            style: TextStyle(
                              color: AppColors.white.withValues(alpha: 0.8),
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // CTA — public information note
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _buildCta(ch),
        ),
        const SizedBox(height: 8),

        // Legal note
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(
            'This is a public information page. No payment or registration '
            'is collected here. All audition controls are accessible after sign-in.',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.32),
              fontSize: 11,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildBannerPlaceholder(ChallengeModel ch) {
    return Container(
      height: 160,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          colors: [
            const Color(0xFF0E1A50),
            AppColors.lightBlue.withValues(alpha: 0.6),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: AppColors.lightOrange.withValues(alpha: 0.18),
        ),
      ),
      child: Stack(
        children: [
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.emoji_events_rounded,
                  color: AppColors.lightOrange.withValues(alpha: 0.5),
                  size: 48,
                ),
                const SizedBox(height: 8),
                Text(
                  ch.title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhaseBadge(String phase) {
    Color bg;
    Color fg;
    String label;
    switch (phase) {
      case 'registration':
        bg = AppColors.successGreen.withValues(alpha: 0.15);
        fg = AppColors.successGreen;
        label = 'Registration Open';
        break;
      case 'audition':
        bg = AppColors.orange.withValues(alpha: 0.15);
        fg = AppColors.orange;
        label = 'Audition Phase';
        break;
      case 'running':
        bg = AppColors.infoBlue.withValues(alpha: 0.15);
        fg = AppColors.infoBlue;
        label = 'Live & Running';
        break;
      case 'completed':
        bg = AppColors.hintText.withValues(alpha: 0.15);
        fg = AppColors.hintText;
        label = 'Completed';
        break;
      default:
        bg = AppColors.hintText.withValues(alpha: 0.1);
        fg = AppColors.hintText;
        label = phase;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildPrizeCard(ChallengeModel ch) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: [
            AppColors.orange.withValues(alpha: 0.18),
            AppColors.lightOrange.withValues(alpha: 0.08),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: AppColors.orange,
              size: 26,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total Prize Pool',
                  style: TextStyle(
                    color: AppColors.white.withValues(alpha: 0.55),
                    fontSize: 11,
                    letterSpacing: 0.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  ch.prizePool,
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'Up to',
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.4),
                  fontSize: 10,
                ),
              ),
              Text(
                '${ch.maxContestants}',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                'contestants',
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.4),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.white.withValues(alpha: 0.07)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.lightOrange, size: 16),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _buildCta(ChallengeModel ch) {
    final canAudition =
        ch.phase == 'registration-and-audition' ||
        ch.phase == 'registration' ||
        ch.phase == 'audition';
    final label = ch.phase == 'registration-and-audition'
        ? 'Register & Audition'
        : ch.phase == 'audition'
        ? 'Join the Audition'
        : ch.phase == 'registration'
        ? 'Register Interest'
        : ch.isCompleted
        ? 'Challenge Closed'
        : 'View Audition Details';

    return GestureDetector(
      onTap: canAudition ? _onJoinTap : null,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          gradient: canAudition
              ? LinearGradient(
                  colors: [AppColors.orange, AppColors.lightOrange],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                )
              : null,
          color: canAudition ? null : AppColors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          boxShadow: canAudition
              ? [
                  BoxShadow(
                    color: AppColors.orange.withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              canAudition
                  ? Icons.how_to_reg_rounded
                  : Icons.lock_outline_rounded,
              color: canAudition
                  ? AppColors.white
                  : AppColors.white.withValues(alpha: 0.35),
              size: 20,
            ),
            const SizedBox(width: 10),
            Text(
              label,
              style: TextStyle(
                color: canAudition
                    ? AppColors.white
                    : AppColors.white.withValues(alpha: 0.35),
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
