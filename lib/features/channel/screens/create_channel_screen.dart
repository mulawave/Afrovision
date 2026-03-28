import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../models/category_model.dart';
import '../services/channel_service.dart';

class CreateChannelScreen extends StatefulWidget {
  const CreateChannelScreen({super.key});

  @override
  State<CreateChannelScreen> createState() => _CreateChannelScreenState();
}

class _CreateChannelScreenState extends State<CreateChannelScreen>
    with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  String? _selectedCategory;
  String _type = 'public';
  bool _creating = false;
  String? _error;
  UserModel? _user;
  bool _loadingUser = true;
  List<CategoryModel> _categories = [];
  bool _categoriesError = false;
  File? _logoFile;
  File? _bannerFile;
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
    _loadData();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final user = await ProfileService.getProfile();
      if (!mounted) return;
      setState(() => _user = user);
    } catch (_) {}

    try {
      final cats = await ChannelService.getCategories();
      if (!mounted) return;
      setState(() {
        _categories = cats;
        _categoriesError = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _categoriesError = true);
    }

    if (!mounted) return;
    setState(() => _loadingUser = false);
    _animController.forward();
  }

  bool get _needsSubscription {
    if (_user == null) return false;
    return _user!.isViewer;
  }

  bool get _subscriptionExpired {
    if (_user == null) return false;
    return _user!.isCreator && !_user!.hasActiveSubscription;
  }

  Future<void> _pickImage(bool isLogo) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: isLogo ? 512 : 1280,
      maxHeight: isLogo ? 512 : 720,
      imageQuality: 85,
    );
    if (picked == null) return;
    setState(() {
      if (isLogo) {
        _logoFile = File(picked.path);
      } else {
        _bannerFile = File(picked.path);
      }
    });
  }

  Future<void> _create() async {
    final name = _nameController.text.trim();
    final desc = _descController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Channel name is required');
      return;
    }
    if (desc.isEmpty) {
      setState(() => _error = 'Description is required');
      return;
    }
    if (_selectedCategory == null) {
      setState(() => _error = 'Please select a category');
      return;
    }
    setState(() {
      _error = null;
      _creating = true;
    });
    try {
      final channel = await ChannelService.createChannel(
        name: name,
        description: desc,
        category: _selectedCategory!,
        type: _type,
      );

      // Upload logo and banner if selected
      if (_logoFile != null) {
        await ChannelService.uploadLogo(channel.id, _logoFile!);
      }
      if (_bannerFile != null) {
        await ChannelService.uploadBanner(channel.id, _bannerFile!);
      }

      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/channel-view',
          arguments: channel.id);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _creating = false;
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
                child: _loadingUser
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor:
                              AlwaysStoppedAnimation<Color>(AppColors.orange),
                        ),
                      )
                    : _needsSubscription
                        ? _buildSubscriptionOverlay(
                            icon: Icons.lock_rounded,
                            title: "Creator's Subscription Required",
                            message:
                                'You need an active creator subscription to create channels and start broadcasting.',
                            buttonLabel: 'Get Started With a Plan',
                          )
                        : _subscriptionExpired
                            ? _buildSubscriptionOverlay(
                                icon: Icons.timer_off_rounded,
                                title: 'Your Subscription Has Expired!',
                                message:
                                    'Renew your plan to continue creating and managing channels.',
                                buttonLabel: 'Renew Plan',
                              )
                            : _buildForm(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
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
              child: const Icon(Icons.arrow_back_ios_new_rounded,
                  color: AppColors.white, size: 18),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Create Channel',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubscriptionOverlay({
    required IconData icon,
    required String title,
    required String message,
    required String buttonLabel,
  }) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 40),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                  color: AppColors.orange.withValues(alpha: 0.25)),
              boxShadow: [
                BoxShadow(
                  color: AppColors.orange.withValues(alpha: 0.08),
                  blurRadius: 40,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: [
                        AppColors.orange.withValues(alpha: 0.2),
                        AppColors.lightOrange.withValues(alpha: 0.08),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    border: Border.all(
                        color: AppColors.orange.withValues(alpha: 0.3),
                        width: 2),
                  ),
                  child: Icon(icon, color: AppColors.orange, size: 34),
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  style: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.8),
                    fontSize: 14,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                GestureDetector(
                  onTap: () async {
                    await Navigator.pushNamed(context, '/plans');
                    if (!mounted) return;
                    setState(() => _loadingUser = true);
                    _loadData();
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.orange.withValues(alpha: 0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.rocket_launch_rounded,
                            color: AppColors.white, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          buttonLabel,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
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

  Widget _buildForm() {
    final canPrivate = _user?.isPremiumCreator ?? false;

    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),

              // Banner upload
              _buildMediaTile(
                label: 'CHANNEL BANNER',
                hint: 'Tap to upload banner image',
                icon: Icons.panorama_rounded,
                file: _bannerFile,
                height: 140,
                borderRadius: 16,
                onTap: () => _pickImage(false),
              ),
              const SizedBox(height: 16),

              // Logo upload
              Center(
                child: _buildLogoTile(),
              ),
              const SizedBox(height: 24),

              AppTextField(
                controller: _nameController,
                label: 'CHANNEL NAME',
                hint: 'Enter channel name',
                prefixIcon: Icons.live_tv_rounded,
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _descController,
                label: 'DESCRIPTION',
                hint: 'Describe your channel',
                prefixIcon: Icons.description_rounded,
              ),
              const SizedBox(height: 16),

              // Category dropdown
              _buildCategoryDropdown(),
              const SizedBox(height: 24),

              // Type selector
              Text(
                'CHANNEL TYPE',
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.7),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildTypeOption(
                      label: 'Public',
                      icon: Icons.public_rounded,
                      selected: _type == 'public',
                      onTap: () => setState(() => _type = 'public'),
                      enabled: true,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTypeOption(
                      label: 'Private',
                      icon: canPrivate
                          ? Icons.lock_rounded
                          : Icons.lock_outline_rounded,
                      selected: _type == 'private',
                      onTap: canPrivate
                          ? () => setState(() => _type = 'private')
                          : null,
                      enabled: canPrivate,
                    ),
                  ),
                ],
              ),
              if (!canPrivate)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline_rounded,
                          color: AppColors.hintText.withValues(alpha: 0.5),
                          size: 14),
                      const SizedBox(width: 6),
                      Text(
                        'Premium subscription required for private channels',
                        style: TextStyle(
                          color: AppColors.hintText.withValues(alpha: 0.5),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),

              if (_error != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.errorRed.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: AppColors.errorRed.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                        color: AppColors.errorRed, fontSize: 13),
                  ),
                ),

              AppButton(
                label: 'Create Channel',
                onPressed: _create,
                loading: _creating,
                enabled: !_creating,
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMediaTile({
    required String label,
    required String hint,
    required IconData icon,
    required File? file,
    required double height,
    required double borderRadius,
    required VoidCallback onTap,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.hintText.withValues(alpha: 0.7),
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: onTap,
          child: Container(
            width: double.infinity,
            height: height,
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(borderRadius),
              border: Border.all(
                color: file != null
                    ? AppColors.orange.withValues(alpha: 0.4)
                    : AppColors.inputBorder,
              ),
              image: file != null
                  ? DecorationImage(
                      image: FileImage(file),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: file == null
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon,
                          color: AppColors.hintText.withValues(alpha: 0.4),
                          size: 32),
                      const SizedBox(height: 8),
                      Text(
                        hint,
                        style: TextStyle(
                          color: AppColors.hintText.withValues(alpha: 0.5),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  )
                : Align(
                    alignment: Alignment.topRight,
                    child: Container(
                      margin: const EdgeInsets.all(8),
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.darkBlue.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.edit_rounded,
                          color: AppColors.orange, size: 16),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildLogoTile() {
    return Column(
      children: [
        Text(
          'CHANNEL LOGO',
          style: TextStyle(
            color: AppColors.hintText.withValues(alpha: 0.7),
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () => _pickImage(true),
          child: Container(
            width: 90,
            height: 90,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.inputFill,
              border: Border.all(
                color: _logoFile != null
                    ? AppColors.orange.withValues(alpha: 0.5)
                    : AppColors.inputBorder,
                width: 2,
              ),
              image: _logoFile != null
                  ? DecorationImage(
                      image: FileImage(_logoFile!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: _logoFile == null
                ? Icon(Icons.add_a_photo_rounded,
                    color: AppColors.hintText.withValues(alpha: 0.4), size: 28)
                : Align(
                    alignment: Alignment.bottomRight,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.orange,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.darkBlue, width: 2),
                      ),
                      child: const Icon(Icons.edit_rounded,
                          color: AppColors.white, size: 12),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CATEGORY',
          style: TextStyle(
            color: AppColors.hintText.withValues(alpha: 0.7),
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        if (_categoriesError && _categories.isEmpty)
          GestureDetector(
            onTap: () async {
              setState(() => _categoriesError = false);
              try {
                final cats = await ChannelService.getCategories();
                if (!mounted) return;
                setState(() {
                  _categories = cats;
                  _categoriesError = false;
                });
              } catch (_) {
                if (!mounted) return;
                setState(() => _categoriesError = true);
              }
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: AppColors.errorRed.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline_rounded,
                      color: AppColors.errorRed.withValues(alpha: 0.7),
                      size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Failed to load categories',
                      style: TextStyle(
                        color: AppColors.errorRed.withValues(alpha: 0.8),
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const Icon(Icons.refresh_rounded,
                      color: AppColors.orange, size: 20),
                ],
              ),
            ),
          )
        else
          Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: Row(
            children: [
              Icon(Icons.category_rounded,
                  color: AppColors.hintText.withValues(alpha: 0.5), size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedCategory,
                    hint: Text(
                      'Select a category',
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.5),
                        fontSize: 14,
                      ),
                    ),
                    dropdownColor: AppColors.lightBlue,
                    icon: const Icon(Icons.keyboard_arrow_down_rounded,
                        color: AppColors.orange, size: 20),
                    isExpanded: true,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    items: _categories.map((cat) {
                      return DropdownMenuItem(
                        value: cat.name,
                        child: Text(cat.name),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedCategory = val),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTypeOption({
    required String label,
    required IconData icon,
    required bool selected,
    required VoidCallback? onTap,
    required bool enabled,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.orange.withValues(alpha: 0.12)
              : AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.5)
                : enabled
                    ? AppColors.inputBorder
                    : AppColors.inputBorder.withValues(alpha: 0.4),
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: selected
                  ? AppColors.orange
                  : enabled
                      ? AppColors.hintText
                      : AppColors.hintText.withValues(alpha: 0.3),
              size: 24,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                color: selected
                    ? AppColors.orange
                    : enabled
                        ? AppColors.white
                        : AppColors.hintText.withValues(alpha: 0.3),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
