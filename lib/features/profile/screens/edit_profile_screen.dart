import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/services/profile_service.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen>
    with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  bool _saving = false;
  String? _nameError;
  String? _emailError;
  String? _avatarUrl;
  File? _pickedAvatar;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final user = await ProfileService.getProfile();
      if (!mounted) return;
      _nameController.text = user.name ?? '';
      _emailController.text = user.email;
      setState(() => _avatarUrl = user.avatarUrl);
      _animController.forward();
    } catch (_) {
      if (!mounted) return;
      _animController.forward();
    }
  }

  Future<void> _refresh() async {
    await _loadProfile();
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (picked != null && mounted) {
      setState(() => _pickedAvatar = File(picked.path));
    }
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    if (name.isEmpty) {
      setState(() => _nameError = 'Name cannot be empty');
      return;
    }
    if (email.isEmpty ||
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() => _emailError = 'Enter a valid email');
      return;
    }
    setState(() {
      _nameError = null;
      _emailError = null;
      _saving = true;
    });
    try {
      // Upload avatar first if picked
      if (_pickedAvatar != null) {
        final avatarUser = await ProfileService.uploadAvatar(_pickedAvatar!);
        setState(() {
          _avatarUrl = avatarUser.avatarUrl;
          _pickedAvatar = null;
        });
      }
      await ProfileService.updateProfile(name: name, email: email);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _emailError = e.toString().contains('409')
            ? 'Email already in use'
            : e.toString();
        _saving = false;
      });
    }
  }

  Widget _buildAvatar() {
    final hasImage =
        _pickedAvatar != null || (_avatarUrl != null && _avatarUrl!.isNotEmpty);
    return GestureDetector(
      onTap: _pickAvatar,
      child: Stack(
        children: [
          Container(
            width: 90,
            height: 90,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: hasImage
                  ? null
                  : LinearGradient(
                      colors: [
                        AppColors.orange.withValues(alpha: 0.3),
                        AppColors.lightOrange.withValues(alpha: 0.15),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.5),
                width: 2,
              ),
              image: _pickedAvatar != null
                  ? DecorationImage(
                      image: FileImage(_pickedAvatar!),
                      fit: BoxFit.cover,
                    )
                  : (_avatarUrl != null && _avatarUrl!.isNotEmpty)
                  ? DecorationImage(
                      image: NetworkImage(AppConfig.mediaUrl(_avatarUrl!)),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: hasImage
                ? null
                : const Icon(
                    Icons.person_rounded,
                    color: AppColors.orange,
                    size: 40,
                  ),
          ),
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.orange,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.darkBlue, width: 2),
              ),
              child: const Icon(
                Icons.camera_alt_rounded,
                color: AppColors.white,
                size: 14,
              ),
            ),
          ),
        ],
      ),
    );
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
              // App bar
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.inputBorder),
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
                      'Edit Profile',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),

              // Content
              Expanded(
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: SlideTransition(
                    position: _slideAnim,
                    child: RefreshIndicator(
                      onRefresh: _refresh,
                      color: AppColors.orange,
                      backgroundColor: AppColors.inputFill,
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 32),
                            // Avatar
                            Center(child: _buildAvatar()),
                            const SizedBox(height: 8),
                            Center(
                              child: Text(
                                'Tap to change photo',
                                style: TextStyle(
                                  color: AppColors.white.withValues(alpha: 0.5),
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            const SizedBox(height: 28),

                            AppTextField(
                              controller: _nameController,
                              label: 'DISPLAY NAME',
                              hint: 'Enter your name',
                              prefixIcon: Icons.person_outline_rounded,
                              errorText: _nameError,
                              onChanged: (_) {
                                if (_nameError != null) {
                                  setState(() => _nameError = null);
                                }
                              },
                            ),
                            const SizedBox(height: 20),

                            AppTextField(
                              controller: _emailController,
                              label: 'EMAIL ADDRESS',
                              hint: 'Enter your email',
                              prefixIcon: Icons.email_outlined,
                              keyboardType: TextInputType.emailAddress,
                              errorText: _emailError,
                              onChanged: (_) {
                                if (_emailError != null) {
                                  setState(() => _emailError = null);
                                }
                              },
                            ),
                            const SizedBox(height: 32),

                            AppButton(
                              label: 'Save Changes',
                              onPressed: _save,
                              loading: _saving,
                              enabled: !_saving,
                            ),
                          ],
                        ),
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
}
