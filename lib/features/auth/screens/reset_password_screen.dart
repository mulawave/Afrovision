import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/password_strength.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen>
    with SingleTickerProviderStateMixin {
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _prefilled = false;

  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;

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
    _animCtrl.forward();

    _tokenController.addListener(_onFieldChanged);
    _passwordController.addListener(_onFieldChanged);
    _confirmController.addListener(_onFieldChanged);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_prefilled) {
      final token = ModalRoute.of(context)?.settings.arguments as String?;
      if (token != null) {
        _tokenController.text = token;
      }
      _prefilled = true;
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  void _onFieldChanged() => setState(() {});

  String _resolveToken(String input) {
    final trimmed = input.trim();
    if (trimmed.isEmpty) return '';

    try {
      final uri = Uri.parse(trimmed);
      final queryToken = uri.queryParameters['token'];
      if (queryToken != null && queryToken.isNotEmpty) {
        return queryToken;
      }
    } catch (_) {
      // Fall back to the raw token below.
    }

    return trimmed;
  }

  bool get _canSubmit =>
      _resolveToken(_tokenController.text).isNotEmpty &&
      _passwordController.text.isNotEmpty &&
      _confirmController.text.isNotEmpty &&
      !_loading;

  String? get _confirmError {
    if (_confirmController.text.isEmpty) return null;
    if (_passwordController.text != _confirmController.text) {
      return 'Passwords do not match';
    }
    return null;
  }

  Future<void> _reset() async {
    final token = _resolveToken(_tokenController.text);
    final password = _passwordController.text;

    if (_confirmError != null) {
      setState(() => _error = 'Passwords do not match');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await AuthService.resetPassword(token, password);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Password reset successful!',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: Colors.greenAccent.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
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
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Column(
                children: [
                  const SizedBox(height: 24),
                  // Back button
                  Align(
                    alignment: Alignment.centerLeft,
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.inputBorder),
                        ),
                        child: const Icon(
                          Icons.arrow_back_ios_new,
                          color: AppColors.white,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 40),

                  // Icon
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.orange.withValues(alpha: 0.12),
                    ),
                    child: const Icon(
                      Icons.vpn_key_rounded,
                      color: AppColors.orange,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Reset Password',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Paste your reset token or the full reset link from your email, then choose a new password.',
                    style: TextStyle(color: AppColors.goldText, fontSize: 14),
                  ),
                  const SizedBox(height: 40),

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
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                  AppTextField(
                    controller: _tokenController,
                    label: 'RESET TOKEN OR LINK',
                    hint: 'Paste your reset token or full reset URL',
                    prefixIcon: Icons.key_outlined,
                  ),
                  const SizedBox(height: 20),
                  AppTextField(
                    controller: _passwordController,
                    label: 'NEW PASSWORD',
                    hint: 'Enter new password',
                    obscureText: true,
                    prefixIcon: Icons.lock_outline,
                  ),

                  // Password strength indicator
                  if (_passwordController.text.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    PasswordStrengthIndicator(
                      password: _passwordController.text,
                    ),
                  ],

                  const SizedBox(height: 20),
                  AppTextField(
                    controller: _confirmController,
                    label: 'CONFIRM PASSWORD',
                    hint: 'Confirm new password',
                    obscureText: true,
                    prefixIcon: Icons.lock_outline,
                    errorText: _confirmError,
                  ),

                  const SizedBox(height: 32),
                  AppButton(
                    label: 'RESET PASSWORD',
                    loading: _loading,
                    enabled: _canSubmit && _confirmError == null,
                    onPressed: _reset,
                  ),

                  const SizedBox(height: 24),
                  GestureDetector(
                    onTap: () => Navigator.pushNamedAndRemoveUntil(
                      context,
                      '/login',
                      (_) => false,
                    ),
                    child: const Text(
                      'Back to Sign In',
                      style: TextStyle(
                        color: AppColors.lightOrange,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
