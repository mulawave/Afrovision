import '../../../core/ads/pangle_widgets.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/reputation_badge.dart';
import '../models/reputation_model.dart';
import '../services/reputation_service.dart';
import '../widgets/rep_progress_bar.dart';

class ReputationScreen extends StatefulWidget {
  const ReputationScreen({super.key});

  @override
  State<ReputationScreen> createState() => _ReputationScreenState();
}

class _ReputationScreenState extends State<ReputationScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  ReputationModel? _reputation;
  bool _loading = true;
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
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _load();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rep = await ReputationService.getMyReputation();
      if (mounted) {
        setState(() {
          _reputation = rep;
          _loading = false;
        });
        _animCtrl.forward();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
        _animCtrl.forward();
      }
    }
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
              _buildAppBar(context),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      )
                    : _error != null
                    ? _buildError()
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: _buildBody(),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputBorder.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Reputation',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              'Could not load reputation',
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () {
                setState(() {
                  _loading = true;
                  _error = null;
                });
                _load();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    color: AppColors.darkBlue,
                    fontWeight: FontWeight.w700,
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

  Widget _buildBody() {
    final rep = _reputation!;
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(rep),
          const SizedBox(height: 24),
          _buildProgressSection(rep),
          const SizedBox(height: 20),
          _buildAccountHealthCard(rep),
          const SizedBox(height: 16),
          _buildPopularityCard(rep),
          const SizedBox(height: 16),
          _buildCommunityPoolCard(rep),
          const SizedBox(height: 16),
          _buildHowToEarnCard(),
          const SizedBox(height: 24),
          _buildLeaderboardButton(),
          const PangleBigBanner(margin: EdgeInsets.only(top: 16)),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildHeader(ReputationModel rep) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.orange.withValues(alpha: 0.25),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: AppColors.orange.withValues(alpha: 0.12),
            blurRadius: 24,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        children: [
          // Badge hero
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: ReputationBadgeWidget(
              level: rep.level,
              size: 40,
              showTooltip: false,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            _formatReps(rep.totalReps),
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 36,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'REPUTATION POINTS',
            style: TextStyle(
              color: AppColors.lightOrange,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: _levelColor(rep.level).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _levelColor(rep.level).withValues(alpha: 0.4),
              ),
            ),
            child: Text(
              rep.level > 0 ? rep.levelName : 'No Badge Yet',
              style: TextStyle(
                color: _levelColor(rep.level),
                fontSize: 13,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressSection(ReputationModel rep) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PROGRESS TO NEXT LEVEL',
            style: TextStyle(
              color: AppColors.lightOrange,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 14),
          RepProgressBar(
            progress: rep.progressPercent,
            currentReps: rep.totalReps,
            targetReps: rep.nextLevelThreshold,
            level: rep.level,
          ),
          if (rep.nextLevelThreshold != null) ...[
            const SizedBox(height: 12),
            Text(
              '${_formatReps(rep.nextLevelThreshold! - rep.totalReps)} more Reps to ${_nextLevelName(rep.level)}',
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAccountHealthCard(ReputationModel rep) {
    final kycVerified = rep.communityPoolEligible || rep.level >= 1;
    String health;
    Color healthColor;
    IconData healthIcon;
    if (rep.level >= 2 && rep.communityPoolEligible) {
      health = 'Excellent';
      healthColor = AppColors.successGreen;
      healthIcon = Icons.verified_rounded;
    } else if (rep.communityPoolEligible) {
      health = 'Good';
      healthColor = AppColors.orange;
      healthIcon = Icons.thumb_up_rounded;
    } else {
      health = 'Building';
      healthColor = AppColors.hintText;
      healthIcon = Icons.trending_up_rounded;
    }
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration(),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: healthColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(healthIcon, color: healthColor, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Account Health',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  health,
                  style: TextStyle(
                    color: healthColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: (kycVerified ? AppColors.successGreen : AppColors.hintText)
                  .withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              kycVerified ? 'KYC Verified' : 'No KYC',
              style: TextStyle(
                color: kycVerified
                    ? AppColors.successGreen
                    : AppColors.hintText,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPopularityCard(ReputationModel rep) {
    final rank = rep.leaderboardRank;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration(),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.leaderboard_rounded,
              color: AppColors.orange,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Popularity Standing',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  rank != null ? '#$rank Globally' : 'Not Ranked Yet',
                  style: TextStyle(
                    color: rank != null
                        ? AppColors.lightOrange
                        : AppColors.hintText,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommunityPoolCard(ReputationModel rep) {
    final eligible = rep.communityPoolEligible;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: eligible
              ? AppColors.successGreen.withValues(alpha: 0.3)
              : AppColors.inputBorder.withValues(alpha: 0.3),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
          if (eligible)
            BoxShadow(
              color: AppColors.successGreen.withValues(alpha: 0.08),
              blurRadius: 20,
              spreadRadius: 0,
            ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color:
                      (eligible ? AppColors.successGreen : AppColors.hintText)
                          .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  eligible ? Icons.check_circle_rounded : Icons.lock_rounded,
                  color: eligible ? AppColors.successGreen : AppColors.hintText,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Community Pool',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      eligible ? 'You are eligible!' : 'Not eligible yet',
                      style: TextStyle(
                        color: eligible
                            ? AppColors.successGreen
                            : AppColors.hintText,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (!eligible) ...[
            const SizedBox(height: 14),
            const Divider(color: AppColors.inputBorder, height: 1),
            const SizedBox(height: 14),
            _requirementRow(
              Icons.verified_user_rounded,
              'Complete KYC verification',
              rep.communityPoolEligible,
            ),
            const SizedBox(height: 8),
            _requirementRow(
              Icons.shield_rounded,
              'Reach Level 1 (5,100 Reps)',
              rep.level >= 1,
            ),
          ],
        ],
      ),
    );
  }

  Widget _requirementRow(IconData icon, String label, bool met) {
    return Row(
      children: [
        Icon(
          met
              ? Icons.check_circle_rounded
              : Icons.radio_button_unchecked_rounded,
          color: met ? AppColors.successGreen : AppColors.hintText,
          size: 16,
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            color: met ? AppColors.white : AppColors.hintText,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildHowToEarnCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.lightbulb_rounded,
                  color: AppColors.orange,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              const Text(
                'How to Earn More Reps',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _earnRow('🎁', 'Send gifts to creators to earn Reps'),
          const SizedBox(height: 10),
          _earnRow('�', 'NGN gifts: 1 Rep per ₦1 spent'),
          const SizedBox(height: 10),
          _earnRow('🪙', 'vPT gifts: 1 vPT = ₦750 worth of Reps'),
          const SizedBox(height: 10),
          _earnRow('📈', 'Reps are permanent — they never decay'),
          const SizedBox(height: 10),
          _earnRow('🔓', 'Level up to unlock higher viewer plans'),
        ],
      ),
    );
  }

  Widget _earnRow(String emoji, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(emoji, style: const TextStyle(fontSize: 15)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: AppColors.hintText,
              fontSize: 13,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLeaderboardButton() {
    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed('/reputation/leaderboard'),
      child: Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: AppColors.buttonGradient,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: AppColors.orange.withValues(alpha: 0.35),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.leaderboard_rounded,
              color: AppColors.darkBlue,
              size: 20,
            ),
            SizedBox(width: 8),
            Text(
              'VIEW LEADERBOARD',
              style: TextStyle(
                color: AppColors.darkBlue,
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  BoxDecoration _cardDecoration() {
    return BoxDecoration(
      color: AppColors.cardBg,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.3),
          blurRadius: 16,
          offset: const Offset(0, 6),
        ),
        BoxShadow(
          color: AppColors.orange.withValues(alpha: 0.06),
          blurRadius: 20,
          spreadRadius: 0,
        ),
      ],
    );
  }

  Color _levelColor(int level) {
    switch (level) {
      case 1:
        return AppColors.reputationBlue;
      case 2:
        return AppColors.reputationPurple;
      case 3:
        return AppColors.orange;
      default:
        return AppColors.hintText;
    }
  }

  String _nextLevelName(int currentLevel) {
    switch (currentLevel) {
      case 0:
        return 'Level 1';
      case 1:
        return 'Level 2';
      case 2:
        return 'Level 3';
      default:
        return 'Max';
    }
  }

  String _formatReps(double v) {
    if (v >= 1000) {
      return '${(v / 1000).toStringAsFixed(v % 1000 == 0 ? 0 : 1)}K';
    }
    return v.toStringAsFixed(0);
  }
}
