import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_logo.dart';

class PakLoginScreen extends StatefulWidget {
  const PakLoginScreen({super.key});

  @override
  State<PakLoginScreen> createState() => _PakLoginScreenState();
}

class _PakLoginScreenState extends State<PakLoginScreen>
    with SingleTickerProviderStateMixin {
  final _pakController = TextEditingController();
  bool _loading = false;
  String? _error;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

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
    _animCtrl.forward();

    _pakController.addListener(_onFieldChanged);
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _pakController.dispose();
    super.dispose();
  }

  void _onFieldChanged() => setState(() {});

  bool get _canSubmit =>
      _pakController.text.trim().isNotEmpty &&
      _pakController.text.trim().length >= 5 &&
      !_loading;

  Future<void> _pakLogin() async {
    final pak = _pakController.text.trim();

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = await AuthService.pakLogin(pak);
      if (!mounted) return;
      final route = user.isAdmin ? '/admin-panel' : '/home';
      Navigator.pushNamedAndRemoveUntil(context, route, (_) => false);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
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
          child: FadeTransition(
            opacity: _fadeIn,
            child: SlideTransition(
              position: _slideUp,
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 28,
                  vertical: 24,
                ),
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    const AppLogo(size: 80, showTagline: true),
                    const SizedBox(height: 8),
                    const Text(
                      'Login with PAK',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Enter your Personal Access Key',
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.8),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 36),

                    // Error banner
                    if (_error != null)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 20),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.errorRed.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.errorRed.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline,
                              color: AppColors.errorRed,
                              size: 18,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: AppColors.errorRed,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                    AppTextField(
                      controller: _pakController,
                      label: 'PAK (PERSONAL ACCESS KEY)',
                      hint: '*****************',
                      obscureText: true,
                      prefixIcon: Icons.vpn_key_outlined,
                    ),

                    const SizedBox(height: 28),
                    AppButton(
                      label: 'SIGN IN',
                      loading: _loading,
                      enabled: _canSubmit,
                      onPressed: _pakLogin,
                    ),

                    const SizedBox(height: 32),

                    // Divider
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 1,
                            color: AppColors.inputBorder,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            'OR',
                            style: TextStyle(
                              color: AppColors.hintText.withValues(alpha: 0.7),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Container(
                            height: 1,
                            color: AppColors.inputBorder,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Back to email login
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Use email instead? ',
                          style: TextStyle(
                            color: AppColors.hintText,
                            fontSize: 14,
                          ),
                        ),
                        GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: const Text(
                            'Sign In',
                            style: TextStyle(
                              color: AppColors.orange,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
