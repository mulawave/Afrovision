import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../models/ai_video_config_model.dart';
import '../services/ai_video_service.dart';

class AiVideoGeneratorScreen extends StatefulWidget {
  const AiVideoGeneratorScreen({super.key});

  @override
  State<AiVideoGeneratorScreen> createState() => _AiVideoGeneratorScreenState();
}

class _AiVideoGeneratorScreenState extends State<AiVideoGeneratorScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _fadeAnim;

  bool _loading = true;
  String? _error;
  AiVideoConfigResponseModel? _payload;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _load();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final payload = await AiVideoService.getConfig();
      if (!mounted) return;
      setState(() {
        _payload = payload;
        _loading = false;
      });
      _animController.forward(from: 0);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
                  ),
                )
              : _error != null
              ? _buildErrorState()
              : FadeTransition(opacity: _fadeAnim, child: _buildContent()),
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.lightOrange,
              size: 42,
            ),
            const SizedBox(height: 14),
            const Text(
              'AI Video Generator Unavailable',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              _error ?? 'Failed to load AI video generator config.',
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.7),
                fontSize: 14,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            AppButton(label: 'Retry', onPressed: _load),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final payload = _payload!;
    final config = payload.config;
    final eligibility = payload.eligibility;
    final provider = payload.provider;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        const Text(
          'AI Video Generator',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Phase 1 foundation is live. This screen now reads backend feature policy, provider readiness, and creator eligibility. Full generation, queue, history, and Post to Waves flows land in the next phases.',
          style: TextStyle(
            color: AppColors.white.withValues(alpha: 0.68),
            fontSize: 14,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 18),
        _infoCard(
          title: 'Eligibility',
          items: [
            'Status: ${eligibility.eligible ? 'Eligible' : 'Blocked'}',
            'Code: ${eligibility.code}',
            if (eligibility.reason != null) 'Reason: ${eligibility.reason}',
          ],
        ),
        const SizedBox(height: 12),
        _infoCard(
          title: 'Feature Policy',
          items: [
            'Mode: ${config.mode}',
            'Minimum creator plan: ${config.minimumCreatorPlan ?? 'none'}',
            'Text to video: ${config.allowTextToVideo ? 'Yes' : 'No'}',
            'Image to video: ${config.allowImageToVideo ? 'Yes' : 'No'}',
            'Post to Waves: ${config.allowPostToWaves ? 'Yes' : 'No'}',
          ],
        ),
        const SizedBox(height: 12),
        _infoCard(
          title: 'Provider',
          items: [
            'Provider: ${provider?.providerKey ?? 'n/a'}',
            'Model: ${provider?.modelName ?? 'n/a'}',
            'Max duration: ${config.maxDurationSeconds}s',
            'Max resolution: ${config.maxResolution}',
          ],
        ),
        const SizedBox(height: 18),
        AppButton(
          label: eligibility.eligible
              ? 'Generation Studio Coming Next'
              : 'Upgrade or Wait for Access',
          onPressed: () {},
        ),
      ],
    );
  }

  Widget _infoCard({required String title, required List<String> items}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.lightOrange,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 10),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Text(
                item,
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.78),
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
