import 'package:flutter/material.dart';

import '../../../core/api/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../models/challenge_model.dart';
import '../services/challenge_service.dart';

class ChallengeRulesScreen extends StatefulWidget {
  const ChallengeRulesScreen({super.key});

  @override
  State<ChallengeRulesScreen> createState() => _ChallengeRulesScreenState();
}

class _ChallengeRulesScreenState extends State<ChallengeRulesScreen>
    with SingleTickerProviderStateMixin {
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
      begin: const Offset(0, 0.06),
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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final challenge = await ChallengeService.getActiveChallenge();
      if (!mounted) return;
      setState(() {
        _challenge = challenge;
        _loading = false;
      });
      _animCtrl.forward(from: 0);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 404) {
        setState(() {
          _challenge = null;
          _loading = false;
        });
      } else {
        setState(() {
          _loading = false;
          _error = e.message;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load challenge rules.';
      });
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
                    ? _buildError()
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.orange,
                            backgroundColor: AppColors.inputFill,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(20, 8, 20, 30),
                              child: _challenge == null
                                  ? _buildNoChallenge()
                                  : _buildRulesContent(_challenge!),
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
              'Challenge Rules',
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

  Widget _buildRulesContent(ChallengeModel challenge) {
    return Column(
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                challenge.title,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Season ${challenge.season} • ${challenge.phaseLabel}',
                style: const TextStyle(
                  color: AppColors.goldText,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Video duration: ${challenge.videoMinSeconds}-${challenge.videoMaxSeconds} seconds • Max contestants: ${challenge.maxContestants}',
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.72),
                  fontSize: 11,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (challenge.rules.isEmpty)
          _buildNoRules()
        else
          ...challenge.rules.asMap().entries.map((entry) {
            return Container(
              margin: EdgeInsets.only(top: entry.key == 0 ? 0 : 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.7),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Center(
                      child: Text(
                        '${entry.key + 1}',
                        style: const TextStyle(
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
                        color: AppColors.white.withValues(alpha: 0.78),
                        fontSize: 13,
                        height: 1.55,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: const Text(
            'These rules are maintained from the active challenge configuration. Pull to refresh for updates.',
            style: TextStyle(
              color: AppColors.goldText,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNoRules() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: const Text(
        'No challenge rules are published yet. Please check again shortly.',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: AppColors.goldText,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildNoChallenge() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 44),
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
              Icons.menu_book_rounded,
              color: AppColors.orange,
              size: 38,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Rules Will Be Published Soon',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'There is no active challenge at the moment. Once a challenge is active, its official rules will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.58),
              fontSize: 13,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_rounded, color: AppColors.hintText, size: 46),
            const SizedBox(height: 14),
            Text(
              _error ?? 'Failed to load challenge rules.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 18),
            GestureDetector(
              onTap: _load,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.orange.withValues(alpha: 0.35),
                  ),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    color: AppColors.orange,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
