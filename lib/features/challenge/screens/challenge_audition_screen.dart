import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/api/api_service.dart';
import '../models/challenge_model.dart';
import '../services/challenge_service.dart';
import '../services/audition_payment_service.dart';
import '../../auth/services/auth_service.dart';
import '../../auth/models/user_model.dart';

// ---------------------------------------------------------------------------
// Colour constants local to this file — all derived from brand palette.
// ---------------------------------------------------------------------------
const Color _kGold = AppColors.lightOrange; // #F5C16C
const Color _kOrange = AppColors.orange; // #F49617
const Color _kWhite = AppColors.white;
const Color _kDark = AppColors.darkBlue; // #050A30

/// Auth-gated Challenge Audition page — "The Amazons" edition.
/// Accessible only to signed-in users. Full editorial experience with
/// manifesto, gauntlet breakdown, transformation arc, and audition CTA.
/// Payment integration: AV-CHL-007.
class ChallengeAuditionScreen extends StatefulWidget {
  const ChallengeAuditionScreen({super.key});

  @override
  State<ChallengeAuditionScreen> createState() =>
      _ChallengeAuditionScreenState();
}

class _ChallengeAuditionScreenState extends State<ChallengeAuditionScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  // ── Animations ─────────────────────────────────────────────────────────
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  // ── Page data ───────────────────────────────────────────────────────────
  ChallengeModel? _challenge;
  UserModel? _user;
  bool _loading = true;
  String? _error;

  // ── Payment state (AV-CHL-007) ──────────────────────────────────────────
  AuditionSignupStatus? _signupStatus;
  AuditionPricing? _pricing;

  /// true while the initiate API call is in-flight
  bool _initiating = false;

  /// true while the verify API call is in-flight
  bool _verifying = false;

  /// set after a successful initiate; used to verify after browser return
  String? _pendingPaymentId;

  /// non-null when an error occurs in the payment flow
  String? _paymentError;

  /// Shown after successful verification — spam/whitelist guidance (AV-CHL)
  String? _emailDeliveryNotice;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
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
    WidgetsBinding.instance.removeObserver(this);
    _animCtrl.dispose();
    super.dispose();
  }

  // ── App lifecycle: auto-verify when user returns from gateway browser ───
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _pendingPaymentId != null &&
        !_verifying) {
      _onVerifyTap();
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────
  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ChallengeService.getActiveChallenge(),
        AuthService.getCurrentUser(),
        AuditionPaymentService.getPricing(),
      ]);
      if (!mounted) return;
      final challenge = results[0] as ChallengeModel?;
      final user = results[1] as UserModel?;
      final pricing = results[2] as AuditionPricing;

      // Load signup status if we have a challenge
      AuditionSignupStatus? status;
      if (challenge != null) {
        status = await AuditionPaymentService.getMyStatus(challenge.id);
      }

      if (!mounted) return;
      setState(() {
        _challenge = challenge;
        _user = user;
        _pricing = pricing;
        _signupStatus = status;
        _loading = false;
      });
      _animCtrl.forward(from: 0);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 401 || e.statusCode == 403) {
        Navigator.pushReplacementNamed(context, '/login');
        return;
      }
      setState(() {
        _loading = false;
        _error = e.statusCode == 404 ? null : e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load challenge info.';
      });
    }
  }

  // ── Payment: initiate ────────────────────────────────────────────────────
  Future<void> _onRegisterTap() async {
    if (_challenge == null || _initiating) return;
    setState(() {
      _initiating = true;
      _paymentError = null;
    });
    try {
      final result = await AuditionPaymentService.initiate(
        challengeId: _challenge!.id,
        provider: 'paystack',
      );
      if (!mounted) return;

      setState(() {
        _pendingPaymentId = result.paymentId;
        _initiating = false;
      });

      final uri = Uri.parse(result.checkoutUrl);
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        if (!mounted) return;
        setState(() {
          _paymentError = 'Could not open the payment page. Please try again.';
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _initiating = false;
        _paymentError = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _initiating = false;
        _paymentError = 'Failed to start payment. Please try again.';
      });
    }
  }

  // ── Payment: verify ──────────────────────────────────────────────────────
  Future<void> _onVerifyTap() async {
    final pid = _pendingPaymentId;
    if (pid == null || _verifying) return;
    setState(() {
      _verifying = true;
      _paymentError = null;
    });
    try {
      final status = await AuditionPaymentService.verify(pid);
      if (!mounted) return;
      setState(() {
        _signupStatus = status;
        _verifying = false;
        if (status.isEnrolled) _pendingPaymentId = null;
        if (status.isEnrolled) {
          _emailDeliveryNotice =
              'Your enrollment confirmation email is on its way. '
              'If you do not see it in your inbox within a few minutes, '
              'check your spam or junk folder and mark AfroVision as a trusted sender '
              'so future emails land in your inbox.';
        }
      });
      if (status.isEnrolled) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'You\'re enrolled! Your vPT reward has been credited.',
            ),
            backgroundColor: AppColors.successGreen,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _paymentError = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _paymentError =
            'Verification failed. If you completed payment, try verifying again.';
      });
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────
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
                          valueColor: AlwaysStoppedAnimation<Color>(_kOrange),
                        ),
                      )
                    : _error != null
                    ? _buildErrorState()
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: RefreshIndicator(
                            color: _kOrange,
                            backgroundColor: AppColors.inputFill,
                            onRefresh: _load,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.only(bottom: 56),
                              child: _challenge == null
                                  ? _buildNoChallenge()
                                  : _buildEditorialContent(_challenge!, _user),
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

  // ── App bar ──────────────────────────────────────────────────────────────
  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _kWhite.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: _kWhite,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'THE AMAZONS',
              style: TextStyle(
                color: _kGold,
                fontSize: 13,
                fontWeight: FontWeight.w800,
                letterSpacing: 2.5,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.successGreen.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.successGreen.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.lock_open_rounded,
                  color: AppColors.successGreen,
                  size: 12,
                ),
                const SizedBox(width: 4),
                Text(
                  'Signed In',
                  style: TextStyle(
                    color: AppColors.successGreen,
                    fontSize: 11,
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

  // ── Error state ──────────────────────────────────────────────────────────
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
                  color: _kOrange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kOrange.withValues(alpha: 0.35)),
                ),
                child: const Text(
                  'Try Again',
                  style: TextStyle(
                    color: _kOrange,
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

  // ── No active challenge ──────────────────────────────────────────────────
  Widget _buildNoChallenge() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 56),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: _kOrange.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: _kOrange,
              size: 40,
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'No Active Challenge',
            style: TextStyle(
              color: _kWhite,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            'There is no active challenge accepting auditions right now.\nCheck back soon.',
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.55),
              fontSize: 14,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ========================================================================
  // EDITORIAL CONTENT
  // ========================================================================

  Widget _buildEditorialContent(ChallengeModel ch, UserModel? user) {
    // ── Post-audition: enrolled users see confirmation only ────────────────
    if (_signupStatus != null && _signupStatus!.isEnrolled) {
      return _buildPostAuditionConfirmation();
    }

    final auditionOpen =
        ch.phase == 'registration-and-audition' ||
        ch.phase == 'registration' ||
        ch.phase == 'audition';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Hero
        _buildHero(ch, user),
        // 2. Payment state card (enrolled / pending / idle)
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
          child: _buildPaymentStateCard(ch),
        ),
        const SizedBox(height: 16),
        // 3. Manifesto (THE TRUTH section - now the first card)
        _buildManifesto(),
        const SizedBox(height: 40),
        // 4. The Gauntlet
        _buildGauntlet(),
        const SizedBox(height: 40),
        // 5. Transformation arc
        _buildTransformationArc(),
        const SizedBox(height: 40),
        // 6. The Prize
        _buildPrizeSection(),
        const SizedBox(height: 40),
        // 7. Fee breakdown
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: _buildFeeBreakdownCard(),
        ),
        const SizedBox(height: 24),
        // 8. Eligibility pills
        _buildEligibilityRow(),
        const SizedBox(height: 40),
        // 9. Final CTA section
        _buildFinalCTA(auditionOpen),
        const SizedBox(height: 32),
        // 10. Footer
        _buildFooter(),
        const SizedBox(height: 16),
      ],
    );
  }

  // ========================================================================
  // POST-AUDITION CONFIRMATION (shown when enrolled)
  // ========================================================================

  Widget _buildPostAuditionConfirmation() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── HERO CONFIRMATION ──────────────────────────────────────────────
        Container(
          width: double.infinity,
          decoration: const BoxDecoration(color: AppColors.darkBlue),
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                'AFROVISION CHALLENGE · THE AMAZONS',
                style: TextStyle(
                  color: _kGold.withValues(alpha: 0.7),
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              // Trophy circle
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.successGreen.withValues(alpha: 0.12),
                  border: Border.all(
                    color: AppColors.successGreen.withValues(alpha: 0.45),
                    width: 2,
                  ),
                ),
                child: const Center(
                  child: Text('🏆', style: TextStyle(fontSize: 40)),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                "YOU'RE IN.",
                style: TextStyle(
                  color: _kWhite,
                  fontSize: 44,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                  height: 1.0,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.successGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: AppColors.successGreen.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.check_circle_rounded,
                      color: AppColors.successGreen,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Audition Signup Complete',
                      style: TextStyle(
                        color: AppColors.successGreen,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.8,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Your audition signup for AfroVision Challenge: The Amazons has been received and confirmed. Your slot is locked. Your journey starts here.',
                style: TextStyle(
                  fontSize: 15,
                  height: 1.65,
                  color: _kWhite.withValues(alpha: 0.7),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),

        // ── WHAT WAS CONFIRMED ─────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 0),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.successGreen.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: AppColors.successGreen.withValues(alpha: 0.25),
              ),
            ),
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                for (final item in [
                  (
                    Icons.how_to_reg_rounded,
                    AppColors.successGreen,
                    'Audition Slot Secured',
                    'Your registration record has been created and your spot is reserved in the selection pool.',
                  ),
                  (
                    Icons.account_balance_wallet_rounded,
                    _kGold,
                    'vPT Reward Credited',
                    'Your vPT reward has been credited to your AfroVision wallet as a thank-you for signing up.',
                  ),
                  (
                    Icons.mark_email_read_rounded,
                    AppColors.infoBlue,
                    'Confirmation Email Sent',
                    'A confirmation email is on its way. Check your spam/junk folder and whitelist AfroVision if needed.',
                  ),
                ]) ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: item.$2.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(item.$1, color: item.$2, size: 16),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.$3,
                              style: const TextStyle(
                                color: _kWhite,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              item.$4,
                              style: TextStyle(
                                color: _kWhite.withValues(alpha: 0.55),
                                fontSize: 12,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
              ],
            ),
          ),
        ),

        // ── WATCH THIS SPACE ───────────────────────────────────────────────
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: _kGold.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: _kGold.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('📡', style: TextStyle(fontSize: 12)),
                    const SizedBox(width: 6),
                    Text(
                      'Watch This Space',
                      style: TextStyle(
                        color: _kGold,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 2,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Pre-Audition Materials\nComing to This Page',
                style: TextStyle(
                  color: _kWhite,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'All challenge briefings, preparation guides, audition instructions, contestant resources, and pre-audition content will be added right here. This is your dedicated challenger hub - bookmark it and check back regularly.',
                style: TextStyle(
                  color: _kWhite.withValues(alpha: 0.6),
                  fontSize: 14,
                  height: 1.65,
                ),
              ),
              const SizedBox(height: 20),
              for (final item in [
                (
                  '📋',
                  'Challenge Briefing',
                  'Full rules, judging criteria, and what to expect.',
                ),
                (
                  '🎤',
                  'Audition Guide',
                  'Step-by-step instructions to prepare and submit your audition.',
                ),
                (
                  '📚',
                  'Preparation Materials',
                  'Resources and study content to help you perform at your best.',
                ),
                (
                  '📅',
                  'Timeline & Dates',
                  'Key dates, deadlines, and schedule for the challenge phases.',
                ),
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Container(
                    decoration: BoxDecoration(
                      color: _kWhite.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _kWhite.withValues(alpha: 0.08),
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    child: Row(
                      children: [
                        Text(item.$1, style: const TextStyle(fontSize: 22)),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.$2,
                                style: const TextStyle(
                                  color: _kWhite,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                item.$3,
                                style: TextStyle(
                                  color: _kWhite.withValues(alpha: 0.5),
                                  fontSize: 12,
                                  height: 1.45,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.lock_clock_rounded,
                          color: _kWhite.withValues(alpha: 0.2),
                          size: 16,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),

        // ── WHAT HAPPENS NEXT ──────────────────────────────────────────────
        const SizedBox(height: 36),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'WHAT HAPPENS NEXT',
                style: TextStyle(
                  color: _kOrange,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Your Audition Journey',
                style: TextStyle(
                  color: _kWhite,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 20),
              for (final item in [
                (
                  _isStepDone('signup_received'),
                  '1',
                  'Signup Received',
                  'Your audition record is created and your slot is in the queue.',
                ),
                (
                  _isStepDone('shortlisted'),
                  '2',
                  'Shortlisting',
                  'The AfroVision team reviews all applicants and shortlists challengers.',
                ),
                (
                  _isStepDone('audition_submitted'),
                  '3',
                  'Audition Submission',
                  'Selected participants receive instructions to submit their audition content.',
                ),
                (
                  _isStepDone('final_selected'),
                  '4',
                  'Final Selection',
                  'Finalists are announced and the challenge officially begins.',
                ),
              ])
                _buildNextStep(
                  done: item.$1,
                  step: item.$2,
                  title: item.$3,
                  desc: item.$4,
                  isLast: item.$2 == '4',
                ),
            ],
          ),
        ),

        const SizedBox(height: 40),
        // ── Footer ─────────────────────────────────────────────────────────
        _buildFooter(),
        const SizedBox(height: 16),
      ],
    );
  }

  bool _isStepDone(String step) {
    final currentStep = _signupStatus?.journeyStep;
    if (currentStep == null) return false;

    final stepOrder = [
      'signup_received',
      'shortlisted',
      'audition_submitted',
      'final_selected',
    ];

    final currentIndex = stepOrder.indexOf(currentStep);
    final stepIndex = stepOrder.indexOf(step);

    return currentIndex >= stepIndex;
  }

  Widget _buildNextStep({
    required bool done,
    required String step,
    required String title,
    required String desc,
    bool isLast = false,
  }) {
    final stepColor = done
        ? AppColors.successGreen
        : _kWhite.withValues(alpha: 0.3);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done
                    ? AppColors.successGreen.withValues(alpha: 0.14)
                    : _kWhite.withValues(alpha: 0.05),
                border: Border.all(color: stepColor.withValues(alpha: 0.5)),
              ),
              child: Center(
                child: done
                    ? Icon(
                        Icons.check_rounded,
                        color: AppColors.successGreen,
                        size: 16,
                      )
                    : Text(
                        step,
                        style: TextStyle(
                          color: _kWhite.withValues(alpha: 0.35),
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 32,
                color: _kWhite.withValues(alpha: 0.08),
                margin: const EdgeInsets.symmetric(vertical: 3),
              ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 28, top: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: done ? _kWhite : _kWhite.withValues(alpha: 0.55),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  desc,
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.4),
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ========================================================================
  // PAYMENT STATE CARD (AV-CHL-007)
  // ========================================================================

  Widget _buildPaymentStateCard(ChallengeModel ch) {
    // ── Already enrolled ──────────────────────────────────────────────
    if (_signupStatus != null && _signupStatus!.isEnrolled) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _stateCard(
            color: AppColors.successGreen,
            icon: Icons.verified_rounded,
            title: 'You\'re Enrolled!',
            body:
                'Your audition spot is secured. Your vPT reward has been credited to your wallet. Good luck, Amazon.',
            trailing: _statusPill('ENROLLED', AppColors.successGreen),
          ),
          if (_emailDeliveryNotice != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _kWhite.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _kGold.withValues(alpha: 0.25)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.mark_email_read_outlined, color: _kGold, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _emailDeliveryNotice!,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.5,
                        color: _kWhite.withValues(alpha: 0.7),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      );
    }

    // ── Post-initiate: waiting for user to complete browser payment ────
    if (_pendingPaymentId != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _stateCard(
            color: _kGold,
            icon: Icons.open_in_browser_rounded,
            title: 'Payment Opened',
            body:
                'Complete your ₦${_pricing?.feeNgn.toStringAsFixed(0) ?? '2,500'} payment in the browser. Once done, tap the button below to confirm your enrollment.',
          ),
          const SizedBox(height: 12),
          // Verify / "I've Paid" button
          GestureDetector(
            onTap: _verifying ? null : _onVerifyTap,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                gradient: _verifying
                    ? null
                    : const LinearGradient(
                        colors: [_kOrange, _kGold],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                color: _verifying ? _kWhite.withValues(alpha: 0.05) : null,
                borderRadius: BorderRadius.circular(14),
                boxShadow: _verifying
                    ? null
                    : [
                        BoxShadow(
                          color: _kOrange.withValues(alpha: 0.35),
                          blurRadius: 20,
                          offset: const Offset(0, 7),
                        ),
                      ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_verifying)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(_kGold),
                      ),
                    )
                  else
                    const Icon(
                      Icons.check_circle_outline_rounded,
                      color: _kWhite,
                      size: 20,
                    ),
                  const SizedBox(width: 10),
                  Text(
                    _verifying
                        ? 'Confirming...'
                        : 'I\'ve Paid — Confirm Enrollment',
                    style: const TextStyle(
                      color: _kWhite,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: GestureDetector(
              onTap: () => setState(() {
                _pendingPaymentId = null;
                _paymentError = null;
              }),
              child: Text(
                'Cancel — I didn\'t pay',
                style: TextStyle(
                  color: _kWhite.withValues(alpha: 0.35),
                  fontSize: 12,
                  decoration: TextDecoration.underline,
                  decorationColor: _kWhite.withValues(alpha: 0.2),
                ),
              ),
            ),
          ),
          if (_paymentError != null) ...[
            const SizedBox(height: 10),
            _errorBanner(_paymentError!),
          ],
        ],
      );
    }

    // ── Payment error (before initiate completes) ─────────────────────
    if (_paymentError != null) {
      return Column(
        children: [_errorBanner(_paymentError!), const SizedBox(height: 10)],
      );
    }

    // ── Phase-specific status ─────────────────────────────────────────
    final open = ch.phase == 'audition';
    final registrationOnly = ch.phase == 'registration';
    if (open || registrationOnly) {
      final vptValueNgn = (_pricing?.vptAllocated ?? 0) * (_pricing?.vptPriceAtSignup ?? 0);
      return _stateCard(
        color: open ? _kOrange : AppColors.successGreen,
        icon: open
            ? Icons.mic_external_on_rounded
            : Icons.event_available_rounded,
        title: open ? 'Auditions Are Open' : 'Registration Phase',
        body: open
            ? 'Pay ₦${_pricing?.feeNgn.toStringAsFixed(0) ?? '2,500'} to secure your slot and receive ₦${vptValueNgn.toStringAsFixed(0)} worth of vPT.'
            : 'The challenge is in registration phase. Audition signups open when the audition phase begins.',
      );
    }

    if (ch.phase == 'running') {
      return _stateCard(
        color: AppColors.infoBlue,
        icon: Icons.live_tv_rounded,
        title: 'Challenge Is Live',
        body:
            'This challenge is currently running. Audition registration is closed.',
      );
    }

    return const SizedBox.shrink();
  }

  Widget _stateCard({
    required Color color,
    required IconData icon,
    required String title,
    required String body,
    Widget? trailing,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: color,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.6),
                    fontSize: 12,
                    height: 1.55,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing],
        ],
      ),
    );
  }

  Widget _statusPill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _errorBanner(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.errorRed.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.error_outline_rounded,
            color: AppColors.errorRed,
            size: 16,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: AppColors.errorRed.withValues(alpha: 0.9),
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Fee breakdown card ────────────────────────────────────────────────────
  Widget _buildFeeBreakdownCard() {
    final p = _pricing;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _kWhite.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kWhite.withValues(alpha: 0.07)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.receipt_long_rounded, color: _kGold, size: 16),
              const SizedBox(width: 8),
              const Text(
                'Audition Fee & Rewards',
                style: TextStyle(
                  color: _kWhite,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _breakdownRow(
            icon: Icons.payments_rounded,
            label: 'Audition Fee',
            value: '₦${p?.feeNgn.toStringAsFixed(0) ?? '2,500'}',
            highlight: true,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Divider(color: _kWhite.withValues(alpha: 0.08), height: 1),
          ),
          Text(
            'Audition Bonus Reward: ',
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.4),
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 10),
          _breakdownRow(
            icon: Icons.account_balance_wallet_rounded,
            iconColor: AppColors.successGreen,
            label: 'vPT Reward',
            value: p != null
                ? '${p.vptAllocated.toStringAsFixed(2)} vPT'
                : '≡ ₦${((_pricing?.vptAllocated ?? 0) * (_pricing?.vptPriceAtSignup ?? 0)).toStringAsFixed(0)} in vPT',
            sublabel: 'Credited to your off-chain wallet',
          ),
          const SizedBox(height: 10),
         // _breakdownRow(
          //  icon: Icons.groups_rounded,
          //  iconColor: AppColors.infoBlue,
          //  label: 'Community Pool',
           // value: p != null
          //      ? '${p.communityPoolAllocated.toStringAsFixed(2)} vPT'
          //      : '≡ ₦500 in vPT',
          //  sublabel: 'Contributed to the AfroVision community pool',
        //  ),
       //   const SizedBox(height: 10),
        //  _breakdownRow(
        //    icon: Icons.settings_rounded,
        //    iconColor: AppColors.hintText,
        //    label: 'Operations',
       //     value: p != null
      //          ? '${p.opsPoolAllocated.toStringAsFixed(2)} vPT'
       //         : '≡ ₦1,000 in vPT',
       //     sublabel: 'Challenge production and operations',
       //   ),
          if (p != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: _kGold.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _kGold.withValues(alpha: 0.2)),
              ),
              child: Text(
                'Live vPT price: ₦${p.vptPriceAtSignup.toStringAsFixed(0)} per vPT',
                style: TextStyle(
                  color: _kGold.withValues(alpha: 0.8),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _breakdownRow({
    required IconData icon,
    required String label,
    required String value,
    String? sublabel,
    Color? iconColor,
    bool highlight = false,
  }) {
    final color = iconColor ?? _kGold;
    return Row(
      crossAxisAlignment: sublabel != null
          ? CrossAxisAlignment.start
          : CrossAxisAlignment.center,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(icon, color: color, size: 15),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: highlight ? _kWhite : _kWhite.withValues(alpha: 0.7),
                  fontSize: highlight ? 14 : 13,
                  fontWeight: highlight ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
              if (sublabel != null) ...[
                const SizedBox(height: 2),
                Text(
                  sublabel,
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.35),
                    fontSize: 11,
                    height: 1.4,
                  ),
                ),
              ],
            ],
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: highlight ? _kGold : _kWhite,
            fontSize: highlight ? 16 : 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  // ── 1. HERO ──────────────────────────────────────────────────────────────
  Widget _buildHero(ChallengeModel ch, UserModel? user) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: AppColors.darkBlue),
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'AFROVISION CHALLENGE',
            style: TextStyle(
              color: _kGold.withValues(alpha: 0.75),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          const Text(
            'THE AMAZONS',
            style: TextStyle(
              color: _kWhite,
              fontSize: 42,
              fontWeight: FontWeight.w900,
              letterSpacing: 3,
              height: 1.0,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        _kGold.withValues(alpha: 0),
                        _kGold.withValues(alpha: 0.6),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Icon(Icons.bolt_rounded, color: _kGold, size: 18),
              ),
              Expanded(
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        _kGold.withValues(alpha: 0.6),
                        _kGold.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'Where Warriors Are Forged',
            style: TextStyle(
              color: _kGold,
              fontSize: 17,
              fontWeight: FontWeight.w600,
              fontStyle: FontStyle.italic,
              letterSpacing: 0.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            'A high-intensity reality program designed to discover and\ntransform young African women into elite business leaders.\nFrom complete novices to battle-tested strategists —\nwe build, test, and elevate.',
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.65),
              fontSize: 14,
              height: 1.7,
              letterSpacing: 0.2,
            ),
            textAlign: TextAlign.center,
          ),
          if (user != null) ...[
            const SizedBox(height: 20),
            _buildWelcomeChip(user),
          ],
        ],
      ),
    );
  }

  Widget _buildWelcomeChip(UserModel user) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: _kWhite.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kGold.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.person_rounded, color: _kGold, size: 14),
          const SizedBox(width: 6),
          Text(
            user.name ?? user.email,
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.75),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ── CTA Button ───────────────────────────────────────────────────────────
  Widget _buildRegisterCTA(bool active) {
    final isEnrolled = _signupStatus != null && _signupStatus!.isEnrolled;
    final isPending = _pendingPaymentId != null;
    final canTap = active && !isEnrolled && !isPending && !_initiating;

    String label;
    IconData icon;
    if (isEnrolled) {
      label = 'ENROLLED ✓';
      icon = Icons.verified_rounded;
    } else if (isPending) {
      label = 'AWAITING CONFIRMATION';
      icon = Icons.hourglass_bottom_rounded;
    } else if (_initiating) {
      label = 'OPENING PAYMENT...';
      icon = Icons.hourglass_top_rounded;
    } else if (active) {
      label = 'REGISTER FOR AUDITION';
      icon = Icons.how_to_reg_rounded;
    } else {
      label = 'SIGNUPS NOT AVAILABLE';
      icon = Icons.lock_outline_rounded;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: canTap ? _onRegisterTap : null,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 19),
          decoration: BoxDecoration(
            gradient: canTap
                ? const LinearGradient(
                    colors: [_kOrange, _kGold],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: canTap
                ? null
                : isEnrolled
                ? AppColors.successGreen.withValues(alpha: 0.12)
                : _kWhite.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(14),
            boxShadow: canTap
                ? [
                    BoxShadow(
                      color: _kOrange.withValues(alpha: 0.35),
                      blurRadius: 22,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
            border: canTap
                ? null
                : Border.all(
                    color: isEnrolled
                        ? AppColors.successGreen.withValues(alpha: 0.3)
                        : _kWhite.withValues(alpha: 0.1),
                  ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_initiating)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(_kGold),
                  ),
                )
              else
                Icon(
                  icon,
                  color: isEnrolled
                      ? AppColors.successGreen
                      : canTap
                      ? _kWhite
                      : _kWhite.withValues(alpha: 0.3),
                  size: 20,
                ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(
                    color: isEnrolled
                        ? AppColors.successGreen
                        : canTap
                        ? _kWhite
                        : _kWhite.withValues(alpha: 0.3),
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── 3. ELIGIBILITY ROW ───────────────────────────────────────────────────
  Widget _buildEligibilityRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        runSpacing: 8,
        children: [
          _eligibilityPill(Icons.female_rounded, 'STRICTLY FOR WOMEN ONLY'),
          _eligibilityPill(Icons.cake_rounded, 'AGES 18 — 30'),
          _eligibilityPill(Icons.public_rounded, "AFRICA'S ELITE AWAIT"),
        ],
      ),
    );
  }

  Widget _eligibilityPill(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: _kGold.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kGold.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: _kGold, size: 13),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: _kGold,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }

  // ── 4. MANIFESTO ─────────────────────────────────────────────────────────
  Widget _buildManifesto() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('THE TRUTH'),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: _kWhite.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _kWhite.withValues(alpha: 0.07)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'This Is Not\nAbout Popularity.',
                  style: TextStyle(
                    color: _kWhite,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    height: 1.15,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 24),
                ...[
                  'This is about resilience.',
                  'This is about raw intelligence.',
                  'This is about logical intuition.',
                  'This is about execution under pressure.',
                ].map((line) => _manifestoLine(line)),
                const SizedBox(height: 20),
                _dividerLine(),
                const SizedBox(height: 20),
                ...[
                  ('We don\'t seek followers.', 'We forge leaders.'),
                  ('We don\'t reward noise.', 'We reward results.'),
                ].map((pair) => _manifestoDualLine(pair.$1, pair.$2)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _manifestoLine(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 4,
            margin: const EdgeInsets.only(right: 12, top: 2),
            decoration: const BoxDecoration(
              color: _kGold,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: _kWhite.withValues(alpha: 0.8),
                fontSize: 15,
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _manifestoDualLine(String soft, String bold) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(fontSize: 14, height: 1.5),
          children: [
            TextSpan(
              text: '$soft  ',
              style: TextStyle(
                color: _kWhite.withValues(alpha: 0.45),
                fontWeight: FontWeight.w400,
              ),
            ),
            TextSpan(
              text: bold,
              style: const TextStyle(
                color: _kGold,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 5. THE GAUNTLET ──────────────────────────────────────────────────────
  Widget _buildGauntlet() {
    const challenges = [
      (
        '01',
        '⚡',
        'DECISION-MAKING\nUNDER UNCERTAINTY',
        'High-stakes scenarios with incomplete information. Split-second calls that separate the decisive from the paralyzed. Your intuition will be tested. Your judgment will be judged.',
      ),
      (
        '02',
        '🎯',
        'LEADERSHIP\nUNDER TENSION',
        'Command when chaos reigns. Rally teams when morale breaks. The true measure of leadership isn\'t comfort — it\'s the fire. Can you hold the line when everything demands you fold?',
      ),
      (
        '03',
        '🔥',
        'CREATIVE\nPROBLEM-SOLVING',
        'Impossible constraints. Limited resources. Unforgiving deadlines. Innovation isn\'t a luxury here — it\'s survival. We don\'t want ideas. We want solutions that work.',
      ),
      (
        '04',
        '⏱️',
        'EXECUTION\nSPEED',
        'Strategy without execution is hallucination. Move fast. Ship faster. In the real world, the swift outrun the perfect. Velocity is a weapon. Wield it.',
      ),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('THE GAUNTLET'),
          const SizedBox(height: 6),
          Text(
            'Stress-Based Challenges. Real-World Pressure. Zero Mercy.',
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.45),
              fontSize: 13,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 20),
          ...challenges.map((c) => _gauntletCard(c.$1, c.$2, c.$3, c.$4)),
        ],
      ),
    );
  }

  Widget _gauntletCard(String num, String emoji, String title, String body) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kWhite.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kWhite.withValues(alpha: 0.07)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Text(
                num,
                style: TextStyle(
                  color: _kGold.withValues(alpha: 0.4),
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 6),
              Text(emoji, style: const TextStyle(fontSize: 22)),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: _kWhite,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    height: 1.25,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  body,
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.55),
                    fontSize: 13,
                    height: 1.65,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── 6. TRANSFORMATION ARC ────────────────────────────────────────────────
  Widget _buildTransformationArc() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Column(
              children: [
                _sectionLabel('FROM NOVICE'),
                Text(
                  'TO STRATEGIST',
                  style: TextStyle(
                    color: _kGold,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.lightBlue.withValues(alpha: 0.3),
                  _kDark.withValues(alpha: 0.6),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _kGold.withValues(alpha: 0.15)),
            ),
            child: Column(
              children: [
                Text(
                  'Every participant enters as a contender. Those who survive the crucible exit as something far more valuable: co-founders.',
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.7),
                    fontSize: 14,
                    height: 1.7,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'This is not a competition for a crown. This is a transformation into ownership. The journey breaks you down to build you back — sharper, stronger, ready to command boardrooms and markets.',
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.5),
                    fontSize: 13,
                    height: 1.7,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                Row(
                  children: [
                    Expanded(
                      child: _journeyNode(
                        'START',
                        'CONTESTANT',
                        'Raw potential.\nUnproven. Hungry.',
                        isStart: true,
                      ),
                    ),
                    Column(
                      children: [
                        const SizedBox(height: 4),
                        ...List.generate(
                          5,
                          (i) => Container(
                            width: 2,
                            height: 6,
                            margin: const EdgeInsets.only(bottom: 3),
                            color: _kGold.withValues(alpha: 0.3 + i * 0.08),
                          ),
                        ),
                        Icon(Icons.south_rounded, color: _kGold, size: 16),
                      ],
                    ),
                    Expanded(
                      child: _journeyNode(
                        'FINISH',
                        'CO-FOUNDER',
                        'Battle-tested.\nProven. Elite.',
                        isStart: false,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _journeyNode(
    String label,
    String title,
    String sub, {
    required bool isStart,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: isStart
            ? _kWhite.withValues(alpha: 0.04)
            : _kGold.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isStart
              ? _kWhite.withValues(alpha: 0.08)
              : _kGold.withValues(alpha: 0.35),
        ),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              color: isStart
                  ? _kWhite.withValues(alpha: 0.35)
                  : _kGold.withValues(alpha: 0.7),
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: TextStyle(
              color: isStart ? _kWhite : _kGold,
              fontSize: 13,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            sub,
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.45),
              fontSize: 11,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ── 7. THE PRIZE ─────────────────────────────────────────────────────────
  Widget _buildPrizeSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('THE PRIZE'),
          const SizedBox(height: 6),
          Text(
            'Not Winners. Co-Founders.',
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.45),
              fontSize: 13,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  _kOrange.withValues(alpha: 0.18),
                  _kGold.withValues(alpha: 0.06),
                  _kDark.withValues(alpha: 0.4),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: _kOrange.withValues(alpha: 0.3)),
              boxShadow: [
                BoxShadow(
                  color: _kOrange.withValues(alpha: 0.08),
                  blurRadius: 24,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '5',
                      style: TextStyle(
                        color: _kGold,
                        fontSize: 80,
                        fontWeight: FontWeight.w900,
                        height: 0.9,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12, left: 6),
                      child: Icon(
                        Icons.emoji_events_rounded,
                        color: _kGold,
                        size: 30,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Co-Founders Selected',
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.9),
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Text(
                  'At the end of the journey, 5 outstanding women will emerge — not as contestants, but as co-founders. Equity. Ownership. A seat at the table.',
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.6),
                    fontSize: 14,
                    height: 1.7,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                const Text(
                  'This is the real prize.',
                  style: TextStyle(
                    color: _kGold,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    fontStyle: FontStyle.italic,
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

  // ── 8. FINAL CTA ─────────────────────────────────────────────────────────
  Widget _buildFinalCTA(bool auditionOpen) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: _kWhite.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: _kWhite.withValues(alpha: 0.07)),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: auditionOpen ? _kOrange : AppColors.hintText,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Sign up for audition below',
                  style: TextStyle(
                    color: _kWhite.withValues(alpha: 0.45),
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'DO YOU HAVE\nWHAT IT TAKES?',
              style: TextStyle(
                color: _kWhite,
                fontSize: 28,
                fontWeight: FontWeight.w900,
                height: 1.1,
                letterSpacing: 1,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Text(
              'The arena is set. The pressure is real. The opportunity is singular.\n\nIf you are a woman aged 18–30, ready to be forged in fire — step forward.',
              style: TextStyle(
                color: _kWhite.withValues(alpha: 0.55),
                fontSize: 14,
                height: 1.7,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            _buildRegisterCTA(auditionOpen),
            const SizedBox(height: 16),
            Text(
              'By proceeding, you agree to the AfroVision Challenge terms.\n'
              'The ₦${_pricing?.feeNgn.toStringAsFixed(0) ?? '2,500'} audition fee is non-refundable once payment is confirmed.',
              style: TextStyle(
                color: _kWhite.withValues(alpha: 0.25),
                fontSize: 11,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  // ── 9. FOOTER ─────────────────────────────────────────────────────────────
  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          _dividerLine(),
          const SizedBox(height: 20),
          Text(
            'AFROVISION CHALLENGE',
            style: TextStyle(
              color: _kGold.withValues(alpha: 0.5),
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 3,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            '© 2026 AfroVision Challenge — The Amazons Edition.\nAll rights reserved.',
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.2),
              fontSize: 11,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            "Building Africa's next generation of elite women leaders.",
            style: TextStyle(
              color: _kWhite.withValues(alpha: 0.25),
              fontSize: 11,
              fontStyle: FontStyle.italic,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ── Shared helpers ────────────────────────────────────────────────────────
  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: _kGold,
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 3.5,
      ),
    );
  }

  Widget _dividerLine() {
    return Container(
      height: 1,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            _kGold.withValues(alpha: 0),
            _kGold.withValues(alpha: 0.3),
            _kGold.withValues(alpha: 0),
          ],
        ),
      ),
    );
  }
}
