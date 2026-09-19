import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/data/locations.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/services/profile_service.dart';

class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen>
    with SingleTickerProviderStateMixin {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  final _referralDetailController = TextEditingController();

  String? _avatarUrl;
  File? _pickedAvatar;
  String? _selectedCountry;
  String? _selectedState;
  String? _selectedCity;
  String? _selectedReferralSource;
  bool _saving = false;
  bool _loading = true;
  bool _success = false;
  String? _error;

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
    _firstNameController.dispose();
    _lastNameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _referralDetailController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final user = await ProfileService.getProfile();
      if (!mounted) return;
      _firstNameController.text = user.firstName ?? '';
      _lastNameController.text = user.lastName ?? '';
      _addressController.text = user.address ?? '';
      _phoneController.text = user.phoneNumber ?? '';
      _referralDetailController.text = user.referralSourceDetail ?? '';
      setState(() {
        _avatarUrl = user.avatarUrl;
        _selectedCountry = user.country;
        _selectedState = user.state;
        _selectedCity = user.city;
        _selectedReferralSource = user.referralSource;
        _loading = false;
      });
      _animController.forward();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      _animController.forward();
    }
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
    setState(() => _error = null);

    if (_firstNameController.text.trim().isEmpty) {
      setState(() => _error = 'First name is required');
      return;
    }
    if (_lastNameController.text.trim().isEmpty) {
      setState(() => _error = 'Last name is required');
      return;
    }
    if (_selectedCountry == null || _selectedCountry!.isEmpty) {
      setState(() => _error = 'Country is required');
      return;
    }
    if (_selectedState == null || _selectedState!.isEmpty) {
      setState(() => _error = 'State is required');
      return;
    }
    if (_selectedCity == null || _selectedCity!.isEmpty) {
      setState(() => _error = 'City is required');
      return;
    }
    if (_addressController.text.trim().isEmpty) {
      setState(() => _error = 'Address is required');
      return;
    }
    if (_phoneController.text.trim().isEmpty) {
      setState(() => _error = 'Phone number is required');
      return;
    }
    if (_selectedReferralSource == null || _selectedReferralSource!.isEmpty) {
      setState(() => _error = 'Please tell us how you heard about AfroVision');
      return;
    }
    if (_selectedReferralSource == 'Other, please specify' &&
        _referralDetailController.text.trim().isEmpty) {
      setState(() => _error = 'Please tell us how you heard about AfroVision');
      return;
    }
    if (_pickedAvatar == null && (_avatarUrl == null || _avatarUrl!.isEmpty)) {
      setState(() => _error = 'Profile picture is required');
      return;
    }

    setState(() => _saving = true);
    try {
      if (_pickedAvatar != null) {
        final avatarUser = await ProfileService.uploadAvatar(_pickedAvatar!);
        if (mounted) {
          setState(() {
            _avatarUrl = avatarUser.avatarUrl;
            _pickedAvatar = null;
          });
        }
      }

      final fullName =
          '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}';
      await ProfileService.updateProfile(
        name: fullName,
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        country: _selectedCountry,
        state: _selectedState,
        city: _selectedCity,
        address: _addressController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        referralSource: _selectedReferralSource,
        referralSourceDetail:
            _selectedReferralSource == 'Other, please specify'
                ? _referralDetailController.text.trim()
                : null,
      );

      if (!mounted) return;
      setState(() => _success = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Profile data updated successfully!',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: Color(0xFF5FD39A),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  Widget _buildAvatar() {
    final hasImage = _pickedAvatar != null ||
        (_avatarUrl != null && _avatarUrl!.isNotEmpty);
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

  Widget _buildDropdown({
    required String label,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
    bool enabled = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.lightOrange,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.inputBorder),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              hint: Text(
                'Select...',
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.4),
                  fontSize: 15,
                ),
              ),
              icon: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: AppColors.white.withValues(alpha: 0.5),
              ),
              isExpanded: true,
              items: enabled
                  ? items.map((item) {
                      return DropdownMenuItem<String>(
                        value: item,
                        child: Text(
                          item,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                          ),
                        ),
                      );
                    }).toList()
                  : [],
              onChanged: enabled ? onChanged : null,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _success,
      child: Scaffold(
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
          child: SafeArea(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: AppColors.orange,
                    ),
                  )
                : Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                        child: Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Complete Your Profile',
                                style: TextStyle(
                                  color: AppColors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: FadeTransition(
                          opacity: _fadeAnim,
                          child: SlideTransition(
                            position: _slideAnim,
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 16),
                                  Center(child: _buildAvatar()),
                                  const SizedBox(height: 8),
                                  Center(
                                    child: Text(
                                      'Upload profile photo *',
                                      style: TextStyle(
                                        color:
                                            AppColors.white.withValues(alpha: 0.5),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 24),

                                  AppTextField(
                                    controller: _firstNameController,
                                    label: 'FIRST NAME *',
                                    hint: 'John',
                                    prefixIcon: Icons.person_outline_rounded,
                                  ),
                                  const SizedBox(height: 20),

                                  AppTextField(
                                    controller: _lastNameController,
                                    label: 'LAST NAME *',
                                    hint: 'Doe',
                                    prefixIcon: Icons.person_outline_rounded,
                                  ),
                                  const SizedBox(height: 20),

                                  _buildDropdown(
                                    label: 'COUNTRY *',
                                    value: _selectedCountry,
                                    items: countries
                                        .map((c) => c.name)
                                        .toList(),
                                    onChanged: (val) {
                                      setState(() {
                                        _selectedCountry = val;
                                        _selectedState = null;
                                        _selectedCity = null;
                                      });
                                    },
                                  ),
                                  const SizedBox(height: 20),

                                  _buildDropdown(
                                    label: 'STATE *',
                                    value: _selectedState,
                                    items: _selectedCountry != null
                                        ? getStatesForCountry(
                                                _selectedCountry!)
                                            .map((s) => s.name)
                                            .toList()
                                        : [],
                                    onChanged: (val) {
                                      setState(() {
                                        _selectedState = val;
                                        _selectedCity = null;
                                      });
                                    },
                                    enabled: _selectedCountry != null,
                                  ),
                                  const SizedBox(height: 20),

                                  _buildDropdown(
                                    label: 'CITY *',
                                    value: _selectedCity,
                                    items: _selectedCountry != null &&
                                            _selectedState != null
                                        ? getCitiesForState(
                                                _selectedCountry!,
                                                _selectedState!)
                                            .toList()
                                        : [],
                                    onChanged: (val) {
                                      setState(() => _selectedCity = val);
                                    },
                                    enabled: _selectedState != null,
                                  ),
                                  const SizedBox(height: 20),

                                  AppTextField(
                                    controller: _addressController,
                                    label: 'ADDRESS *',
                                    hint: 'Street address, building, etc.',
                                    prefixIcon: Icons.location_on_outlined,
                                  ),
                                  const SizedBox(height: 20),

                                  AppTextField(
                                    controller: _phoneController,
                                    label: 'PHONE NUMBER *',
                                    hint: '+234 800 000 0000',
                                    prefixIcon: Icons.phone_outlined,
                                    keyboardType: TextInputType.phone,
                                  ),
                                  const SizedBox(height: 20),

                                  _buildDropdown(
                                    label:
                                        'HOW DID YOU HEAR ABOUT AFROVISION? *',
                                    value: _selectedReferralSource,
                                    items: referralSources.toList(),
                                    onChanged: (val) {
                                      setState(() {
                                        _selectedReferralSource = val;
                                      });
                                    },
                                  ),
                                  const SizedBox(height: 20),

                                  if (_selectedReferralSource ==
                                      'Other, please specify') ...[
                                    AppTextField(
                                      controller: _referralDetailController,
                                      label:
                                          'TELL US HOW YOU HEARD ABOUT AFROVISION *',
                                      hint: 'Please specify...',
                                    ),
                                    const SizedBox(height: 20),
                                  ],

                                  if (_error != null) ...[
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: AppColors.errorRed
                                            .withValues(alpha: 0.1),
                                        borderRadius:
                                            BorderRadius.circular(12),
                                        border: Border.all(
                                          color: AppColors.errorRed
                                              .withValues(alpha: 0.3),
                                        ),
                                      ),
                                      child: Text(
                                        _error!,
                                        style: const TextStyle(
                                          color: AppColors.errorRed,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                  ],

                                  AppButton(
                                    label: 'Complete Profile',
                                    onPressed: _save,
                                    loading: _saving,
                                    enabled: !_saving,
                                  ),
                                  if (_success) ...[
                                    const SizedBox(height: 24),
                                    Container(
                                      padding: const EdgeInsets.all(20),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF5FD39A)
                                            .withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                          color: const Color(0xFF5FD39A)
                                              .withValues(alpha: 0.3),
                                        ),
                                      ),
                                      child: Column(
                                        children: [
                                          const Icon(
                                            Icons.check_circle_rounded,
                                            color: Color(0xFF5FD39A),
                                            size: 40,
                                          ),
                                          const SizedBox(height: 12),
                                          const Text(
                                            'Profile Saved Successfully!',
                                            style: TextStyle(
                                              color: Color(0xFF5FD39A),
                                              fontSize: 16,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            'You may proceed to exploring the rest of the app or go to your home screen.',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              color: AppColors.white
                                                  .withValues(alpha: 0.7),
                                              fontSize: 13,
                                            ),
                                          ),
                                          const SizedBox(height: 16),
                                          Row(
                                            children: [
                                              Expanded(
                                                child: GestureDetector(
                                                  onTap: () =>
                                                      Navigator.pushNamedAndRemoveUntil(
                                                    context,
                                                    '/kyc',
                                                    (route) => false,
                                                  ),
                                                  child: Container(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                            vertical: 12),
                                                    decoration: BoxDecoration(
                                                      gradient: AppColors
                                                          .buttonGradient,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              12),
                                                    ),
                                                    child: const Text(
                                                      'Go to Home',
                                                      textAlign:
                                                          TextAlign.center,
                                                      style: TextStyle(
                                                        color: AppColors.white,
                                                        fontSize: 14,
                                                        fontWeight:
                                                            FontWeight.w600,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 32),
                                ],
                              ),
                            ),
                          ),
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
