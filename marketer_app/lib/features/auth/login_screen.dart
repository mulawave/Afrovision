import 'package:flutter/material.dart';
import 'package:afrovision_marketer/core/theme/app_colors.dart';
import 'package:afrovision_marketer/core/widgets/app_logo.dart';
import 'package:afrovision_marketer/core/widgets/app_text_field.dart';
import 'package:afrovision_marketer/core/widgets/app_button.dart';
import 'package:afrovision_marketer/core/services/api_service.dart';
import 'package:afrovision_marketer/features/home/home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _usernameController = TextEditingController();
  final _pinController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  bool _obscurePin = true;
  String? _error;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: Duration(milliseconds: 600));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _slideAnim = Tween<Offset>(begin: Offset(0, 0.08), end: Offset.zero).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOut),
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _pinController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await ApiService.login(
        _usernameController.text.trim().toLowerCase(),
        _pinController.text.trim(),
      );
      if (data['success'] == true) {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => HomeScreen()),
          );
        }
      } else {
        setState(() {
          _error = (data['message'] as String?) ?? (data['error'] as String?) ?? 'Login failed';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Network error. Check your connection and try again.';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(horizontal: 28, vertical: 40),
              child: FadeTransition(
                opacity: _fadeAnim,
                child: SlideTransition(
                  position: _slideAnim,
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AppLogo(size: 52),
                        SizedBox(height: 40),
                        Text(
                          'Sign in to your marketer account',
                          style: TextStyle(color: AppColors.lightOrange, fontSize: 13),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 28),
                        if (_error != null) ...[
                          Container(
                            width: double.infinity,
                            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: AppColors.errorRed.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
                            ),
                            child: Text(_error!, style: TextStyle(color: AppColors.errorRed, fontSize: 12)),
                          ),
                          SizedBox(height: 16),
                        ],
                        AppTextField(
                          label: 'Username',
                          controller: _usernameController,
                          hintText: 'e.g. john_doe',
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your username' : null,
                        ),
                        SizedBox(height: 16),
                        AppTextField(
                          label: 'PIN',
                          controller: _pinController,
                          obscureText: _obscurePin,
                          keyboardType: TextInputType.number,
                          hintText: '••••',
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your PIN' : null,
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePin ? Icons.visibility_off : Icons.visibility,
                              color: AppColors.hintText,
                              size: 20,
                            ),
                            onPressed: () => setState(() => _obscurePin = !_obscurePin),
                          ),
                        ),
                        SizedBox(height: 28),
                        AppButton(
                          label: 'Sign In',
                          onPressed: _isLoading ? null : _handleLogin,
                          isLoading: _isLoading,
                          icon: Icons.login,
                        ),
                        SizedBox(height: 24),
                        Text(
                          'Contact your distributor if you don\'t have credentials',
                          style: TextStyle(color: AppColors.hintText, fontSize: 11),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
