import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../models/category_model.dart';
import '../services/channel_service.dart';
import '../utils/channels_gate.dart';
import '../widgets/channels_header.dart';

class CreateChannelScreen extends StatefulWidget {
  const CreateChannelScreen({super.key});

  @override
  State<CreateChannelScreen> createState() => _CreateChannelScreenState();
}

class _CreateChannelScreenState extends State<CreateChannelScreen>
    with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final _externalUrlController = TextEditingController();
  final _exclusiveFeeController = TextEditingController(text: '5000');

  String? _selectedCategory;
  String _type = 'public';
  bool _creating = false;
  UserModel? _user;
  bool _loadingUser = true;
  List<CategoryModel> _categories = [];
  bool _categoriesError = false;
  File? _logoFile;
  File? _bannerFile;

  String? _nameError;
  String? _descError;
  String? _categoryError;
  String? _generalError;

  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  // External stream source state
  String _streamSourceMode = 'native';
  bool _validatingUrl = false;
  String? _urlValidationMessage;
  bool _urlValidationOk = false;

  @override
  void initState() {
    super.initState();
    ChannelsGate.enforceCreateEntry(context);
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
    _externalUrlController.dispose();
    _exclusiveFeeController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final user = await ProfileService.getProfile();
      if (!mounted) return;
      setState(() => _user = user);
    } catch (e) {
      debugPrint('[CreateChannel] profile load error: $e');
    }

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

  Future<void> _refresh() async {
    await _loadData();
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

    setState(() {
      _nameError = null;
      _descError = null;
      _categoryError = null;
      _generalError = null;
    });

    if (name.isEmpty) {
      setState(() => _nameError = 'Channel name is required');
      return;
    }
    if (desc.isEmpty) {
      setState(() => _descError = 'Description is required');
      return;
    }
    if (_selectedCategory == null) {
      setState(() => _categoryError = 'Please select a category');
      return;
    }

    final canPremiumTypes =
        (_user?.hasActiveSubscription == true && _user?.isPremiumCreator == true) ||
            _user?.isAdmin == true;
    if ((_type == 'private' || _type == 'exclusive') && !canPremiumTypes) {
      setState(
        () => _generalError =
            'Premium creator subscription is required for private and exclusive channels',
      );
      return;
    }
    if (_type == 'exclusive') {
      final fee = double.tryParse(_exclusiveFeeController.text.trim()) ?? 0;
      if (fee <= 0) {
        setState(
          () => _generalError =
              'Exclusive monthly entrance fee must be greater than 0',
        );
        return;
      }
    }

    setState(() => _creating = true);
    try {
      final channel = await ChannelService.createChannel(
        name: name,
        description: desc,
        category: _selectedCategory!,
        type: _type,
      );

      if (_logoFile != null) {
        await ChannelService.uploadLogo(channel.id, _logoFile!);
      }
      if (_bannerFile != null) {
        await ChannelService.uploadBanner(channel.id, _bannerFile!);
      }

      if (_streamSourceMode != 'native' &&
          _externalUrlController.text.trim().isNotEmpty) {
        await ChannelService.updateExternalSource(
          channel.id,
          streamSourceMode: _streamSourceMode,
          externalUrl: _externalUrlController.text.trim(),
        );
      }

      if (_type == 'exclusive') {
        final fee = double.tryParse(_exclusiveFeeController.text.trim()) ?? 0;
        await ChannelService.updateExclusiveSettings(
          channel.id,
          monthlyFeeNgn: fee,
        );
      }

      if (!mounted) return;
      Navigator.pushReplacementNamed(
        context,
        '/channel-view',
        arguments: channel.id,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _generalError = e.toString();
        _creating = false;
      });
    }
  }

  Future<void> _validateUrl() async {
    final url = _externalUrlController.text.trim();
    if (url.isEmpty) return;
    setState(() {
      _validatingUrl = true;
      _urlValidationMessage = null;
      _urlValidationOk = false;
    });
    try {
      final result = await ChannelService.resolveSource(url);
      if (!mounted) return;
      final mode = result['stream_source_mode'] as String? ?? '';
      final status = result['stream_status'] as String? ?? 'unknown';
      setState(() {
        _validatingUrl = false;
        _urlValidationOk = true;
        _urlValidationMessage =
            'Valid ${_sourceModeLabel(mode)} \u2022 Status: $status';
        _streamSourceMode = mode;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _validatingUrl = false;
        _urlValidationOk = false;
        _urlValidationMessage = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  String _sourceModeLabel(String mode) {
    switch (mode) {
      case 'external_youtube':
        return 'YouTube';
      case 'external_hls':
        return 'HLS Stream';
      case 'external_dash':
        return 'DASH Stream';
      default:
        return 'Native';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: Column(
          children: [
            const ChannelsHeader(
              title: 'Create Channel',
              subtitle: 'Set up your own channel',
            ),
            Expanded(
              child: _loadingUser
                  ? const Center(
                      child: CircularProgressIndicator(color: Nocturne.gold),
                    )
                  : _user?.isMinor == true
                      ? _buildSubscriptionOverlay(
                          icon: Icons.block_rounded,
                          title: 'Not Available for Minors',
                          message:
                              'Channel creation is not available for users under 18. You can still enjoy general content and subscribe to viewer plans.',
                          buttonLabel: 'Back',
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
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 40),
            decoration: BoxDecoration(
              color: Nocturne.surfaceRaised,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: Nocturne.borderCard),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Nocturne.gold.withValues(alpha: 0.1),
                    border: Border.all(
                      color: Nocturne.gold.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                  ),
                  child: Icon(icon, color: Nocturne.gold, size: 32),
                ),
                const SizedBox(height: 22),
                Text(
                  title,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 19,
                    fontWeight: FontWeight.w600,
                    height: 1.3,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  style: const TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 13,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                GestureDetector(
                  onTap: () async {
                    if (buttonLabel == 'Back') {
                      Navigator.pop(context);
                      return;
                    }
                    await Navigator.pushNamed(context, '/plans');
                    if (!mounted) return;
                    setState(() => _loadingUser = true);
                    _loadData();
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      gradient: Nocturne.goldCta,
                      borderRadius: BorderRadius.circular(13),
                      boxShadow: [
                        BoxShadow(
                          color: Nocturne.gold.withValues(alpha: 0.22),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.rocket_launch_rounded,
                          color: Color(0xFF26170A),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          buttonLabel,
                          style: const TextStyle(
                            color: Color(0xFF26170A),
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
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
    final canPrivate =
        (_user?.hasActiveSubscription == true && _user?.isPremiumCreator == true) ||
            _user?.isAdmin == true;
    final canExclusive = canPrivate;

    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: Nocturne.gold,
          backgroundColor: Nocturne.surface,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 22),

                // Banner + overlapping logo
                _buildBannerUploader(),
                Transform.translate(
                  offset: const Offset(0, -22),
                  child: Column(
                    children: [
                      _buildLogoWell(),
                      const SizedBox(height: 6),
                      const Text(
                        'Channel logo',
                        style: TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 10),

                _buildTextField(
                  controller: _nameController,
                  kicker: 'Channel name',
                  hint: 'Enter channel name',
                  prefixIcon: Icons.tv_rounded,
                  error: _nameError,
                  maxLines: 1,
                  onErrorClear: () => setState(() => _nameError = null),
                ),
                const SizedBox(height: 18),
                _buildTextField(
                  controller: _descController,
                  kicker: 'Description',
                  hint: 'Describe your channel',
                  prefixIcon: Icons.description_rounded,
                  error: _descError,
                  maxLines: 3,
                  onErrorClear: () => setState(() => _descError = null),
                ),
                const SizedBox(height: 18),

                _buildCategoryPicker(),
                const SizedBox(height: 22),

                _buildTypeGrid(canPrivate: canPrivate, canExclusive: canExclusive),
                if (!canPrivate)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline_rounded,
                          color: Nocturne.gold,
                          size: 14,
                        ),
                        const SizedBox(width: 6),
                        const Expanded(
                          child: Text(
                            'Premium subscription required for private and exclusive channels',
                            style: TextStyle(
                              color: Nocturne.goldLight,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                if (_type == 'exclusive')
                  Padding(
                    padding: const EdgeInsets.only(top: 18),
                    child: _buildTextField(
                      controller: _exclusiveFeeController,
                      kicker: 'Exclusive monthly fee (NGN)',
                      hint: '5000',
                      prefixIcon: Icons.payments_rounded,
                      keyboardType: TextInputType.number,
                      maxLines: 1,
                      onErrorClear: () {},
                    ),
                  ),

                const SizedBox(height: 22),
                _buildSourceSection(),

                if (_generalError != null) ...[
                  const SizedBox(height: 18),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Nocturne.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(11),
                      border: Border.all(
                        color: Nocturne.red.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      _generalError!,
                      style: const TextStyle(
                        color: Nocturne.redSoft,
                        fontSize: 12.5,
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 22),

                // Create button
                GestureDetector(
                  onTap: _creating ? null : _create,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      gradient: Nocturne.goldCta,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: Nocturne.gold.withValues(alpha: 0.22),
                          blurRadius: 22,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: _creating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Color(0xFF26170A),
                              ),
                            ),
                          )
                        : const Text(
                            'Create Channel',
                            style: TextStyle(
                              color: Color(0xFF26170A),
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBannerUploader() {
    final hasFile = _bannerFile != null;
    const targetHeight = 132.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Channel banner',
          style: TextStyle(
            color: Nocturne.gold,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () => _pickImage(false),
          child: SizedBox(
            height: targetHeight,
            width: double.infinity,
            child: CustomPaint(
              painter: _DashedBorderPainter(
                color: Nocturne.borderStrong,
                radius: 14,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: hasFile ? null : const Color(0xFF0B1533),
                  borderRadius: BorderRadius.circular(14),
                  image: hasFile
                      ? DecorationImage(
                          image: FileImage(_bannerFile!),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: hasFile
                    ? Align(
                        alignment: Alignment.topRight,
                        child: Container(
                          margin: const EdgeInsets.all(8),
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: Nocturne.bg.withValues(alpha: 0.7),
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: const Icon(
                            Icons.edit_rounded,
                            color: Nocturne.gold,
                            size: 16,
                          ),
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.image_rounded,
                            color: Nocturne.textHint,
                            size: 30,
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Tap to upload banner image',
                            style: TextStyle(
                              color: Nocturne.textHint,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Recommended 1280 \u00d7 720',
                            style: TextStyle(
                              color: Nocturne.textFaint.withValues(alpha: 0.7),
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLogoWell() {
    final hasFile = _logoFile != null;
    return GestureDetector(
      onTap: () => _pickImage(true),
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF0E1A3D),
          border: Border.all(
            color: hasFile ? Nocturne.gold : Nocturne.borderStrong,
            width: hasFile ? 2 : 1.5,
          ),
          image: hasFile
              ? DecorationImage(
                  image: FileImage(_logoFile!),
                  fit: BoxFit.cover,
                )
              : null,
        ),
        child: hasFile
            ? Align(
                alignment: Alignment.bottomRight,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: Nocturne.gold,
                    shape: BoxShape.circle,
                    border: Border.all(color: Nocturne.bg, width: 2),
                  ),
                  child: const Icon(
                    Icons.edit_rounded,
                    color: Color(0xFF26170A),
                    size: 12,
                  ),
                ),
              )
            : const Icon(
                Icons.add_a_photo_rounded,
                color: Nocturne.textHint,
                size: 26,
              ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String kicker,
    required String hint,
    required IconData prefixIcon,
    String? error,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
    VoidCallback? onErrorClear,
  }) {
    final hasError = error != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          kicker.toUpperCase(),
          style: TextStyle(
            color: hasError ? Nocturne.redSoft : Nocturne.gold,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 7),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFF0E1A3D),
            borderRadius: BorderRadius.circular(13),
            border: Border.all(
              color: hasError ? Nocturne.redSoft : Nocturne.border,
            ),
          ),
          child: TextField(
            controller: controller,
            cursorColor: Nocturne.gold,
            keyboardType: keyboardType,
            maxLines: maxLines,
            minLines: maxLines == 1 ? 1 : 3,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 14,
            ),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(
                color: Nocturne.textHint,
                fontSize: 14,
              ),
              prefixIcon: Icon(prefixIcon, color: Nocturne.textHint, size: 19),
              prefixIconConstraints: const BoxConstraints(
                minWidth: 36,
                minHeight: 44,
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 13),
            ),
            onChanged: (_) {
              if (hasError) onErrorClear?.call();
            },
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 5),
          Text(
            error,
            style: const TextStyle(
              color: Nocturne.redSoft,
              fontSize: 11,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildCategoryPicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'CATEGORY',
          style: TextStyle(
            color: _categoryError != null ? Nocturne.redSoft : Nocturne.gold,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 7),
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
                color: const Color(0xFF0E1A3D),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                  color: Nocturne.redSoft.withValues(alpha: 0.4),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    color: Nocturne.redSoft.withValues(alpha: 0.8),
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Failed to load categories',
                      style: TextStyle(
                        color: Nocturne.redSoft,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.refresh_rounded,
                    color: Nocturne.redSoft,
                    size: 18,
                  ),
                ],
              ),
            ),
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFF0E1A3D),
              borderRadius: BorderRadius.circular(13),
              border: Border.all(
                color: _categoryError != null ? Nocturne.redSoft : Nocturne.border,
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.interests_rounded,
                  color: Nocturne.textHint,
                  size: 19,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedCategory,
                      isExpanded: true,
                      icon: const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: Nocturne.textHint,
                        size: 20,
                      ),
                      dropdownColor: Nocturne.surface,
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 14,
                      ),
                      hint: const Text(
                        'Select a category',
                        style: TextStyle(
                          color: Nocturne.textHint,
                          fontSize: 14,
                        ),
                      ),
                      items: _categories.map((cat) {
                        return DropdownMenuItem(
                          value: cat.name,
                          child: Text(cat.name),
                        );
                      }).toList(),
                      onChanged: (val) => setState(() {
                        _selectedCategory = val;
                        _categoryError = null;
                      }),
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (_categoryError != null) ...[
          const SizedBox(height: 5),
          Text(
            _categoryError!,
            style: const TextStyle(
              color: Nocturne.redSoft,
              fontSize: 11,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTypeGrid({
    required bool canPrivate,
    required bool canExclusive,
  }) {
    final types = [
      ('public', 'Public', Icons.public_rounded, true),
      ('private', 'Private', Icons.lock_rounded, canPrivate),
      ('exclusive', 'Exclusive', Icons.verified_user_rounded, canExclusive),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CHANNEL TYPE',
            style: TextStyle(
              color: Nocturne.gold,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: types.map((t) {
              final key = t.$1;
              final label = t.$2;
              final icon = t.$3;
              final enabled = t.$4;
              final selected = _type == key;
              final onTap = enabled
                  ? () => setState(() => _type = key)
                  : () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Premium creator subscription is required for this type',
                          ),
                        ),
                      );
                    };

              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  child: GestureDetector(
                    onTap: onTap,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: selected
                            ? Nocturne.gold.withValues(alpha: 0.12)
                            : Colors.white.withValues(alpha: 0.02),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: selected ? Nocturne.gold : Nocturne.border,
                          width: selected ? 1.5 : 1,
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            icon,
                            color: enabled
                                ? (selected ? Nocturne.gold : Nocturne.textFaint)
                                : Nocturne.textHint,
                            size: 24,
                          ),
                          const SizedBox(height: 5),
                          Text(
                            label,
                            style: TextStyle(
                              color: selected
                                  ? Nocturne.goldLight
                                  : (enabled ? Nocturne.text : Nocturne.textHint),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          Text(
            _typeHint(_type),
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 11.5,
            ),
          ),
        ],
      ),
    );
  }

  String _typeHint(String type) {
    switch (type) {
      case 'public':
        return 'Anyone on AfroVision can find and watch this channel.';
      case 'private':
        return 'Hidden from browse — reachable only by channel number.';
      case 'exclusive':
        return 'Members only, with paid membership and KYC verification required.';
      default:
        return '';
    }
  }

  Widget _buildSourceSection() {
    final modes = [
      ('native', 'Native', Icons.videocam_rounded),
      ('external_youtube', 'YouTube', Icons.smart_display_rounded),
      ('external_hls', 'HLS', Icons.rss_feed_rounded),
      ('external_dash', 'DASH', Icons.stream_rounded),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(
          color: _streamSourceMode != 'native'
              ? Nocturne.gold.withValues(alpha: 0.35)
              : Nocturne.borderCard,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: Nocturne.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.link_rounded,
                  color: Nocturne.gold,
                  size: 16,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'STREAM SOURCE',
                style: TextStyle(
                  color: Nocturne.gold,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Mode selector
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: modes
                .map((m) => _buildModeChip(mode: m.$1, label: m.$2, icon: m.$3))
                .toList(),
          ),

          // URL input for non-native
          if (_streamSourceMode != 'native') ...[
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: _buildTextField(
                    controller: _externalUrlController,
                    kicker: _streamSourceMode == 'external_youtube'
                        ? 'YouTube URL'
                        : _streamSourceMode == 'external_hls'
                            ? 'HLS manifest URL (.m3u8)'
                            : 'DASH manifest URL (.mpd)',
                    hint: _streamSourceMode == 'external_youtube'
                        ? 'https://youtube.com/watch?v=...'
                        : _streamSourceMode == 'external_hls'
                            ? 'https://example.com/stream.m3u8'
                            : 'https://example.com/stream.mpd',
                    prefixIcon: Icons.link_rounded,
                    maxLines: 1,
                    onErrorClear: () {
                      if (_urlValidationMessage != null) {
                        setState(() {
                          _urlValidationMessage = null;
                          _urlValidationOk = false;
                        });
                      }
                    },
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: _validatingUrl ? null : _validateUrl,
                  child: Container(
                    height: 52,
                    width: 52,
                    decoration: BoxDecoration(
                      color: _validatingUrl
                          ? Nocturne.gold.withValues(alpha: 0.2)
                          : null,
                      gradient: _validatingUrl ? null : Nocturne.goldCta,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: _validatingUrl
                        ? const Center(
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Color(0xFF26170A),
                                ),
                              ),
                            ),
                          )
                        : const Icon(
                            Icons.check_circle_outline_rounded,
                            color: Color(0xFF26170A),
                            size: 22,
                          ),
                  ),
                ),
              ],
            ),
            if (_urlValidationMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Icon(
                      _urlValidationOk
                          ? Icons.check_circle_rounded
                          : Icons.error_outline_rounded,
                      color: _urlValidationOk ? Nocturne.green : Nocturne.redSoft,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _urlValidationMessage!,
                        style: TextStyle(
                          color: _urlValidationOk
                              ? Nocturne.green
                              : Nocturne.redSoft,
                          fontSize: 11.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ] else
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                'Optional at creation. You can configure source later in Edit Channel or Creator Studio.',
                style: TextStyle(color: Nocturne.textFaint, fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildModeChip({
    required String mode,
    required String label,
    required IconData icon,
  }) {
    final selected = _streamSourceMode == mode;

    return GestureDetector(
      onTap: () => setState(() {
        _streamSourceMode = mode;
        _urlValidationMessage = null;
        _urlValidationOk = false;
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? Nocturne.gold.withValues(alpha: 0.15)
              : Colors.white.withValues(alpha: 0.02),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? Nocturne.gold : Nocturne.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: selected ? Nocturne.gold : Nocturne.textHint,
              size: 14,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: selected ? Nocturne.goldLight : Nocturne.textFaint,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double radius;

  _DashedBorderPainter({
    required this.color,
    this.radius = 14,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    const dashArray = [6.0, 4.0];

    for (final metric in path.computeMetrics()) {
      var start = 0.0;
      while (start < metric.length) {
        final end = start + dashArray[0];
        if (end > metric.length) break;
        canvas.drawPath(
          metric.extractPath(start, end),
          paint,
        );
        start = end + dashArray[1];
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
