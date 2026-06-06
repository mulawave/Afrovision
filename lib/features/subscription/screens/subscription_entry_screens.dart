import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';

class MyPlanDetailsScreen extends StatefulWidget {
  const MyPlanDetailsScreen({super.key});

  @override
  State<MyPlanDetailsScreen> createState() => _MyPlanDetailsScreenState();
}

class _MyPlanDetailsScreenState extends State<MyPlanDetailsScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _fadeAnim;

  bool _loading = true;
  String? _error;
  UserModel? _profile;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _loadProfile();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await ProfileService.getProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _loading = false;
      });
      _animController.forward(from: 0);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to load your plan details right now.';
        _loading = false;
      });
      _animController.forward(from: 0);
    }
  }

  int? _daysLeft(String? expiry) {
    if (expiry == null || expiry.isEmpty) return null;
    final parsed = DateTime.tryParse(expiry);
    if (parsed == null) return null;
    final remaining = parsed.difference(DateTime.now());
    if (remaining.isNegative) return 0;
    final days = remaining.inDays;
    return remaining.inSeconds.remainder(86400) > 0 ? days + 1 : days;
  }

  String _formatDate(String value) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.orange),
                )
              : FadeTransition(
                  opacity: _fadeAnim,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildHeader(),
                        const SizedBox(height: 20),
                        if (_error != null) _buildError() else _buildBody(),
                      ],
                    ),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        _roundIconButton(
          icon: Icons.arrow_back_ios_new_rounded,
          onTap: () => Navigator.pop(context),
        ),
        const SizedBox(width: 14),
        const Expanded(
          child: Text(
            'My Plan',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
            ),
          ),
        ),
        _roundIconButton(icon: Icons.refresh_rounded, onTap: _loadProfile),
      ],
    );
  }

  Widget _roundIconButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.inputBorder),
        ),
        child: Icon(icon, color: AppColors.white, size: 20),
      ),
    );
  }

  Widget _buildBody() {
    final profile = _profile;
    final hasPlan = profile?.hasActiveSubscription == true;
    final daysLeft = _daysLeft(profile?.subscriptionExpiry);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: hasPlan
                  ? AppColors.successGreen.withValues(alpha: 0.35)
                  : AppColors.lightOrange.withValues(alpha: 0.35),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color:
                          (hasPlan ? AppColors.successGreen : AppColors.orange)
                              .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      hasPlan
                          ? Icons.workspace_premium_rounded
                          : Icons.launch_rounded,
                      color: hasPlan
                          ? AppColors.successGreen
                          : AppColors.orange,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          hasPlan ? 'Your current plan' : 'Start here',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          hasPlan
                              ? 'You are active and ready to go.'
                              : 'Choose the path that fits you best.',
                          style: const TextStyle(
                            color: AppColors.hintText,
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _pill(
                    icon: Icons.badge_rounded,
                    label: profile?.subscriptionPlanDisplay ?? 'NONE',
                    color: hasPlan ? AppColors.successGreen : AppColors.orange,
                  ),
                  _pill(
                    icon: Icons.person_rounded,
                    label: profile?.role.toUpperCase() ?? 'VIEWER',
                    color: AppColors.softBlue,
                  ),
                  _pill(
                    icon: Icons.timer_rounded,
                    label: hasPlan
                        ? '${daysLeft ?? 0} day${(daysLeft ?? 0) == 1 ? '' : 's'} left'
                        : 'Start here',
                    color: hasPlan ? AppColors.lightOrange : AppColors.infoBlue,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (hasPlan) ...[
                _detailRow(
                  'Status',
                  profile?.subscriptionStatus.toUpperCase() ?? 'ACTIVE',
                ),
                _detailRow(
                  'Renewal date',
                  _formatDate(profile!.subscriptionExpiry!),
                ),
                _detailRow(
                  'Plan type',
                  profile.subscriptionPlanType?.toUpperCase() ?? 'UNKNOWN',
                ),
                const SizedBox(height: 18),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/plans'),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Center(
                      child: Text(
                        'Manage Plan',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
              ] else ...[
                const Text(
                  'You do not have an active plan yet. Start here to see the two activation paths and pick the one that fits you.',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 18),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/choose-options'),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.launch_rounded,
                          color: AppColors.darkBlue,
                          size: 20,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Start Here',
                          style: TextStyle(
                            color: AppColors.darkBlue,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _pill({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 15),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.hintText, fontSize: 13),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.errorRed.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.35)),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.errorRed,
            size: 42,
          ),
          const SizedBox(height: 12),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _loadProfile,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ChooseYourOptionsScreen extends StatelessWidget {
  const ChooseYourOptionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.inputBorder),
                        ),
                        child: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          color: AppColors.white,
                          size: 20,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Text(
                        'Select Your Options',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                const Text(
                  'Pick the path that matches what you want to do. Each option leads to the correct plan screen.',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 18),
                _OptionCard(
                  title: 'Creator Activation',
                  icon: Icons.video_camera_back_rounded,
                  accent: AppColors.successGreen,
                  description:
                      'This is for people who want to make their own channel, share videos, post waves, and build an audience. It is like having your own little TV station where you decide what people watch.',
                  audience:
                      'Best for creators, channel owners, and anyone who wants to broadcast.',
                  ctaLabel: 'Choose Creator',
                  onTap: () => Navigator.pushNamed(
                    context,
                    '/plans',
                    arguments: {'tab': 'creator'},
                  ),
                ),
                const SizedBox(height: 16),
                _OptionCard(
                  title: 'Viewer Activation',
                  icon: Icons.tv_rounded,
                  accent: AppColors.softBlue,
                  description:
                      'This is for people who want to watch channels, enjoy special content, and support the creators they like. It is like getting a ticket that opens more doors to watch and enjoy.',
                  audience:
                      'Best for viewers, fans, and people who want to subscribe to watch more.',
                  ctaLabel: 'Choose Viewer',
                  onTap: () => Navigator.pushNamed(
                    context,
                    '/plans',
                    arguments: {'tab': 'viewer'},
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color accent;
  final String description;
  final String audience;
  final String ctaLabel;
  final VoidCallback onTap;

  const _OptionCard({
    required this.title,
    required this.icon,
    required this.accent,
    required this.description,
    required this.audience,
    required this.ctaLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: accent, size: 26),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            description,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            audience,
            style: TextStyle(
              color: accent,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: onTap,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.launch_rounded,
                    color: AppColors.darkBlue,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    ctaLabel,
                    style: const TextStyle(
                      color: AppColors.darkBlue,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
