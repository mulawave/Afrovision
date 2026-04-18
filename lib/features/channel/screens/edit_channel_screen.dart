import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/app_button.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

class EditChannelScreen extends StatefulWidget {
  const EditChannelScreen({super.key});

  @override
  State<EditChannelScreen> createState() => _EditChannelScreenState();
}

class _EditChannelScreenState extends State<EditChannelScreen>
    with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final _categoryController = TextEditingController();
  bool _saving = false;
  String? _error;
  ChannelModel? _channel;
  bool _uploadingLogo = false;
  bool _uploadingBanner = false;
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
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_channel == null) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is ChannelModel) {
        _channel = args;
        _nameController.text = args.name;
        _descController.text = args.description ?? '';
        _categoryController.text = args.category ?? '';
        _animController.forward();
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _categoryController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Channel name is required');
      return;
    }
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await ChannelService.updateChannel(
        _channel!.id,
        name: name,
        description: _descController.text.trim().isNotEmpty
            ? _descController.text.trim()
            : null,
        category: _categoryController.text.trim().isNotEmpty
            ? _categoryController.text.trim()
            : null,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  Future<void> _pickAndUpload(String type) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: type == 'logo' ? 512 : 1920,
      maxHeight: type == 'logo' ? 512 : 1080,
      imageQuality: 85,
    );
    if (picked == null || _channel == null) return;
    setState(() {
      if (type == 'logo') _uploadingLogo = true;
      if (type == 'banner') _uploadingBanner = true;
    });
    try {
      final file = File(picked.path);
      final updated = type == 'logo'
          ? await ChannelService.uploadLogo(_channel!.id, file)
          : await ChannelService.uploadBanner(_channel!.id, file);
      if (!mounted) return;
      setState(() {
        _channel = updated;
        _uploadingLogo = false;
        _uploadingBanner = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _uploadingLogo = false;
        _uploadingBanner = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString(),
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
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
                      'Edit Channel',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
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
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 24),
                          if (_channel != null) ...[
                            Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.orange.withValues(
                                    alpha: 0.1,
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: AppColors.orange.withValues(
                                      alpha: 0.3,
                                    ),
                                  ),
                                ),
                                child: Text(
                                  '#${_channel!.channelNumber}',
                                  style: const TextStyle(
                                    color: AppColors.lightOrange,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            // Media upload section
                            _buildMediaUploadRow(),
                            const SizedBox(height: 24),
                          ],
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
                          AppTextField(
                            controller: _categoryController,
                            label: 'CATEGORY',
                            hint: 'e.g. Entertainment, Sports, News',
                            prefixIcon: Icons.category_rounded,
                          ),
                          const SizedBox(height: 24),
                          if (_error != null)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              margin: const EdgeInsets.only(bottom: 16),
                              decoration: BoxDecoration(
                                color: AppColors.errorRed.withValues(
                                  alpha: 0.1,
                                ),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: AppColors.errorRed.withValues(
                                    alpha: 0.3,
                                  ),
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
                          AppButton(
                            label: 'Save Changes',
                            onPressed: _save,
                            loading: _saving,
                            enabled: !_saving,
                          ),
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
    );
  }

  Widget _buildMediaUploadRow() {
    return Row(
      children: [
        // Logo upload
        Expanded(
          child: _buildMediaTile(
            label: 'Logo',
            imageUrl: _channel?.logoUrl,
            uploading: _uploadingLogo,
            icon: Icons.account_circle_rounded,
            onTap: () => _pickAndUpload('logo'),
          ),
        ),
        const SizedBox(width: 12),
        // Banner upload
        Expanded(
          flex: 2,
          child: _buildMediaTile(
            label: 'Banner',
            imageUrl: _channel?.bannerUrl,
            uploading: _uploadingBanner,
            icon: Icons.panorama_rounded,
            onTap: () => _pickAndUpload('banner'),
            height: 90,
          ),
        ),
      ],
    );
  }

  Widget _buildMediaTile({
    required String label,
    required String? imageUrl,
    required bool uploading,
    required IconData icon,
    required VoidCallback onTap,
    double height = 90,
  }) {
    return GestureDetector(
      onTap: uploading ? null : onTap,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.inputBorder),
          image: imageUrl != null
              ? DecorationImage(
                  image: NetworkImage('${AppConfig.baseUrl}$imageUrl'),
                  fit: BoxFit.cover,
                  colorFilter: ColorFilter.mode(
                    Colors.black.withValues(alpha: 0.3),
                    BlendMode.darken,
                  ),
                )
              : null,
        ),
        child: Center(
          child: uploading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
                  ),
                )
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      imageUrl != null ? Icons.edit_rounded : icon,
                      color: AppColors.orange.withValues(alpha: 0.8),
                      size: 22,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      imageUrl != null ? 'Change $label' : 'Add $label',
                      style: TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
