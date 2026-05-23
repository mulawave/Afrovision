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
  final _externalUrlController = TextEditingController();
  final _exclusiveFeeController = TextEditingController();
  bool _saving = false;
  String? _error;
  ChannelModel? _channel;
  bool _uploadingLogo = false;
  bool _uploadingBanner = false;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  // External stream source state
  String _streamSourceMode = 'native';
  bool _validatingUrl = false;
  String? _urlValidationMessage;
  bool _urlValidationOk = false;
  bool _rechecking = false;

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
        _streamSourceMode = args.streamSourceMode;
        _externalUrlController.text = args.externalUrl ?? '';
        _exclusiveFeeController.text = args.exclusiveMonthlyFeeNgn > 0
            ? args.exclusiveMonthlyFeeNgn.toStringAsFixed(0)
            : '';
        _animController.forward();
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _categoryController.dispose();
    _externalUrlController.dispose();
    _exclusiveFeeController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Channel name is required');
      return;
    }
    if (_streamSourceMode != 'native' &&
        _externalUrlController.text.trim().isEmpty) {
      setState(
        () => _error = 'A stream URL is required for the selected source mode',
      );
      return;
    }
    if (_channel?.isExclusive == true) {
      final fee = double.tryParse(_exclusiveFeeController.text.trim()) ?? 0;
      if (fee <= 0) {
        setState(() => _error = 'Exclusive monthly fee must be greater than 0');
        return;
      }
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
      // Persist external source settings whenever the mode or URL may have changed.
      final urlChanged =
          _externalUrlController.text.trim() != (_channel?.externalUrl ?? '');
      final modeChanged =
          _streamSourceMode != (_channel?.streamSourceMode ?? 'native');
      if (modeChanged || urlChanged) {
        final updated = await ChannelService.updateExternalSource(
          _channel!.id,
          streamSourceMode: _streamSourceMode,
          externalUrl: _streamSourceMode != 'native'
              ? _externalUrlController.text.trim()
              : null,
        );
        if (!mounted) return;
        setState(() => _channel = updated);
      }

      if (_channel?.isExclusive == true) {
        final fee = double.tryParse(_exclusiveFeeController.text.trim()) ?? 0;
        if (fee > 0) {
          final updated = await ChannelService.updateExclusiveSettings(
            _channel!.id,
            monthlyFeeNgn: fee,
          );
          if (!mounted) return;
          setState(() => _channel = updated);
        }
      }

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
            'Valid ${_sourceModeLabel(mode)} • Status: $status';
        // Auto-select the detected mode
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

  Future<void> _recheckSource() async {
    if (_channel == null || !_channel!.hasExternalSource) return;
    setState(() => _rechecking = true);
    try {
      final updated = await ChannelService.recheckStreamHealth(_channel!.id);
      if (!mounted) return;
      setState(() => _channel = updated);
    } catch (e) {
      if (!mounted) return;
      // Non-fatal — surface as a transient validation message
      setState(() {
        _urlValidationOk = false;
        _urlValidationMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _rechecking = false);
    }
  }

  String _formatTimeAgo(String? isoString) {
    if (isoString == null) return 'Never';
    final diff = DateTime.now().difference(DateTime.parse(isoString));
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
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

                          if (_channel?.isExclusive == true) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(18),
                              decoration: BoxDecoration(
                                color: AppColors.orange.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: AppColors.orange.withValues(
                                    alpha: 0.25,
                                  ),
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
                                          color: AppColors.orange.withValues(
                                            alpha: 0.12,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                        ),
                                        child: const Icon(
                                          Icons.verified_user_rounded,
                                          color: AppColors.orange,
                                          size: 16,
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      const Text(
                                        'EXCLUSIVE ACCESS FEE',
                                        style: TextStyle(
                                          color: AppColors.goldText,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  AppTextField(
                                    controller: _exclusiveFeeController,
                                    label: 'MONTHLY FEE (NGN)',
                                    hint: 'Set the monthly entrance fee',
                                    prefixIcon: Icons.payments_rounded,
                                    keyboardType: TextInputType.number,
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    'This fee is charged every 30 days to keep access active.',
                                    style: TextStyle(
                                      color: AppColors.hintText,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 24),
                          ],

                          // ── External stream source section ────────────────
                          _buildSourceSection(),
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

  Widget _buildSourceSection() {
    final modes = [
      ('native', 'Native', Icons.videocam_rounded),
      ('external_youtube', 'YouTube', Icons.smart_display_rounded),
      ('external_hls', 'HLS', Icons.rss_feed_rounded),
      ('external_dash', 'DASH', Icons.stream_rounded),
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _streamSourceMode != 'native'
              ? AppColors.orange.withValues(alpha: 0.35)
              : AppColors.inputBorder,
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
                  color: AppColors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.link_rounded,
                  color: AppColors.orange,
                  size: 16,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'STREAM SOURCE',
                style: TextStyle(
                  color: AppColors.goldText,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              if (_channel?.streamStatus != null &&
                  _channel!.streamStatus != 'unknown')
                _buildStatusBadge(_channel!.streamStatus),
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

          // URL input — visible for all non-native modes
          if (_streamSourceMode != 'native') ...[
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: AppTextField(
                    controller: _externalUrlController,
                    label: _streamSourceMode == 'external_youtube'
                        ? 'YOUTUBE URL'
                        : _streamSourceMode == 'external_hls'
                        ? 'HLS MANIFEST URL (.m3u8)'
                        : 'DASH MANIFEST URL (.mpd)',
                    hint: _streamSourceMode == 'external_youtube'
                        ? 'https://youtube.com/watch?v=...'
                        : _streamSourceMode == 'external_hls'
                        ? 'https://example.com/stream.m3u8'
                        : 'https://example.com/stream.mpd',
                    prefixIcon: Icons.link_rounded,
                    onChanged: (_) {
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
                      gradient: _validatingUrl
                          ? AppColors.buttonDisabledGradient
                          : AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.orange.withValues(alpha: 0.25),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: _validatingUrl
                        ? const Center(
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  AppColors.white,
                                ),
                              ),
                            ),
                          )
                        : const Icon(
                            Icons.check_circle_outline_rounded,
                            color: AppColors.white,
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
                      color: _urlValidationOk
                          ? AppColors.successGreen
                          : AppColors.errorRed,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _urlValidationMessage!,
                        style: TextStyle(
                          color: _urlValidationOk
                              ? AppColors.successGreen
                              : AppColors.errorRed,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (_channel?.lastCheckedAt != null ||
                _channel?.hasExternalSource == true)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.access_time_rounded,
                      color: AppColors.hintText,
                      size: 12,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Last checked: ${_formatTimeAgo(_channel?.lastCheckedAt)}',
                      style: TextStyle(color: AppColors.hintText, fontSize: 11),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: _rechecking ? null : _recheckSource,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.orange.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: AppColors.orange.withValues(alpha: 0.3),
                          ),
                        ),
                        child: _rechecking
                            ? SizedBox(
                                width: 12,
                                height: 12,
                                child: CircularProgressIndicator(
                                  strokeWidth: 1.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    AppColors.orange,
                                  ),
                                ),
                              )
                            : Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.refresh_rounded,
                                    color: AppColors.orange,
                                    size: 12,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Recheck',
                                    style: TextStyle(
                                      color: AppColors.orange,
                                      fontSize: 11,
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
          ],
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
              ? AppColors.orange.withValues(alpha: 0.15)
              : AppColors.darkBlue.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.6)
                : AppColors.inputBorder,
            width: selected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: selected ? AppColors.orange : AppColors.hintText,
              size: 14,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: selected ? AppColors.lightOrange : AppColors.hintText,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final config = switch (status) {
      'live' => (AppColors.successGreen, Icons.circle, 'LIVE'),
      'valid' => (AppColors.infoBlue, Icons.check_circle_rounded, 'VALID'),
      'scheduled' => (
        AppColors.lightOrange,
        Icons.schedule_rounded,
        'SCHEDULED',
      ),
      'offline' => (AppColors.errorRed, Icons.wifi_off_rounded, 'OFFLINE'),
      'invalid' => (AppColors.errorRed, Icons.cancel_rounded, 'INVALID'),
      'access_denied' => (AppColors.errorRed, Icons.lock_rounded, 'BLOCKED'),
      _ => (AppColors.hintText, Icons.help_outline_rounded, 'UNKNOWN'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: config.$1.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: config.$1.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(config.$2, color: config.$1, size: 10),
          const SizedBox(width: 4),
          Text(
            config.$3,
            style: TextStyle(
              color: config.$1,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
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
