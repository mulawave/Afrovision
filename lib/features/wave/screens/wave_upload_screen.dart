import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';
import '../services/wave_service.dart';

const Map<String, String> _waveMimeTypes = <String, String>{
  'mp4': 'video/mp4',
  'webm': 'video/webm',
};

class WaveUploadScreen extends StatefulWidget {
  const WaveUploadScreen({super.key});

  @override
  State<WaveUploadScreen> createState() => _WaveUploadScreenState();
}

class _WaveUploadScreenState extends State<WaveUploadScreen> {
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _descriptionCtrl = TextEditingController();

  List<ChannelModel> _channels = const <ChannelModel>[];
  String? _selectedChannelId;
  String _ageClassification = 'adult';
  bool _hasExplicitLanguage = false;
  bool _hasNudity = false;
  bool _hasViolence = false;
  bool _hasRevealingClothes = false;
  bool _hasPartialNudity = false;
  bool _hasExplicitContent = false;
  bool _hasParentalGuidance = false;
  bool _hasEroticDancing = false;
  bool _hasSexualNature = false;
  bool _hasSex = false;

  File? _videoFile;
  String? _videoName;
  String? _contentType;
  int _durationSeconds = 0;

  bool _loadingChannels = true;
  bool _detectingDuration = false;
  bool _publishing = false;
  String? _error;
  String _uploadStage = 'Waiting for file';
  double _uploadProgress = 0;

  @override
  void initState() {
    super.initState();
    _loadChannels();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadChannels() async {
    setState(() {
      _loadingChannels = true;
      _error = null;
    });

    try {
      final channels = await ChannelService.getMyChannels();
      if (!mounted) return;

      final args = ModalRoute.of(context)?.settings.arguments;
      final preferredChannelId = args is String ? args : null;
      final preferredExists = channels.any((c) => c.id == preferredChannelId);

      setState(() {
        _channels = channels;
        _selectedChannelId = preferredExists
            ? preferredChannelId
            : (channels.isNotEmpty ? channels.first.id : null);
        _loadingChannels = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingChannels = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _pickVideo() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: _waveMimeTypes.keys.toList(growable: false),
      allowMultiple: false,
    );

    if (result == null ||
        result.files.isEmpty ||
        result.files.first.path == null) {
      return;
    }

    final picked = result.files.first;
    final ext = picked.extension?.toLowerCase() ?? '';
    final mime = _waveMimeTypes[ext];
    if (mime == null) {
      _showSnack('Unsupported file format. Use MP4 or WebM.');
      return;
    }

    final file = File(picked.path!);

    setState(() {
      _videoFile = file;
      _videoName = picked.name;
      _contentType = mime;
      _durationSeconds = 0;
      _detectingDuration = true;
      _uploadProgress = 0;
      _uploadStage = 'File selected';
    });

    await _detectDuration(file);
  }

  Future<void> _detectDuration(File file) async {
    VideoPlayerController? controller;
    try {
      controller = VideoPlayerController.file(file);
      await controller.initialize().timeout(
        const Duration(seconds: 10),
        onTimeout: () {},
      );
      final duration = controller.value.duration.inSeconds;
      if (!mounted) return;

      setState(() {
        _durationSeconds = duration > 0 ? duration : 0;
        _detectingDuration = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _durationSeconds = 0;
        _detectingDuration = false;
      });
    } finally {
      controller?.dispose();
    }
  }

  Future<void> _publishWave() async {
    final channelId = _selectedChannelId;
    final videoFile = _videoFile;
    final contentType = _contentType;
    final title = _titleCtrl.text.trim();
    final description = _descriptionCtrl.text.trim();

    if (channelId == null || channelId.isEmpty) {
      _showSnack('Select a channel first.');
      return;
    }
    if (videoFile == null || contentType == null) {
      _showSnack('Select a video file first.');
      return;
    }
    if (title.isEmpty) {
      _showSnack('Title is required.');
      return;
    }
    if (_durationSeconds > 180) {
      _showSnack('Wave video must be 3 minutes or less.');
      return;
    }

    setState(() {
      _publishing = true;
      _uploadProgress = 0;
      _uploadStage = 'Requesting upload URL...';
    });

    try {
      final upload = await WaveService.getWaveUploadUrl(
        channelId: channelId,
        contentType: contentType,
      );

      if (!mounted) return;

      setState(() {
        _uploadStage = 'Uploading video...';
      });

      await WaveService.uploadWaveFileToSignedUrl(
        file: videoFile,
        signedUrl: upload.signedUrl,
        contentType: contentType,
        onProgress: (progress) {
          if (!mounted) return;
          setState(() {
            _uploadProgress = progress;
          });
        },
      );

      if (!mounted) return;
      setState(() {
        _uploadStage = 'Registering wave...';
      });

      await WaveService.registerWave(
        channelId: channelId,
        title: title,
        description: description,
        videoUrl: upload.publicUrl,
        duration: _durationSeconds,
        ageClassification: _ageClassification,
        hasExplicitLanguage: _hasExplicitLanguage,
        hasNudity: _hasNudity,
        hasViolence: _hasViolence,
        hasRevealingClothes: _hasRevealingClothes,
        hasPartialNudity: _hasPartialNudity,
        hasExplicitContent: _hasExplicitContent,
        hasParentalGuidance: _hasParentalGuidance,
        hasEroticDancing: _hasEroticDancing,
        hasSexualNature: _hasSexualNature,
        hasSex: _hasSex,
      );

      if (!mounted) return;
      _showSnack('Wave published successfully.');
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      _showSnack(e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _publishing = false;
          if (_uploadProgress >= 1) {
            _uploadStage = 'Completed';
          }
        });
      }
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: _loadingChannels
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      )
                    : _error != null
                    ? _buildErrorState()
                    : _buildForm(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded),
            color: AppColors.white,
            style: IconButton.styleFrom(
              backgroundColor: AppColors.inputFill,
              side: const BorderSide(color: AppColors.inputBorder),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Upload Wave',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.orange,
              size: 42,
            ),
            const SizedBox(height: 10),
            const Text(
              'Unable to load channels',
              style: TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'Try again.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.hintText),
            ),
            const SizedBox(height: 16),
            AppButton(label: 'Retry', onPressed: _loadChannels, width: 180),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    final hasFile = _videoFile != null;
    final canPublish =
        !_publishing &&
        _selectedChannelId != null &&
        hasFile &&
        _titleCtrl.text.trim().isNotEmpty;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionCard(
            title: 'Channel',
            child: DropdownButtonFormField<String>(
              initialValue: _selectedChannelId,
              dropdownColor: AppColors.cardBg,
              items: _channels
                  .map(
                    (c) => DropdownMenuItem<String>(
                      value: c.id,
                      child: Text(
                        c.name,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppColors.white),
                      ),
                    ),
                  )
                  .toList(growable: false),
              onChanged: _publishing
                  ? null
                  : (value) {
                      setState(() {
                        _selectedChannelId = value;
                      });
                    },
              decoration: _inputDecoration('Select channel'),
            ),
          ),
          const SizedBox(height: 12),
          _sectionCard(
            title: 'Video Upload',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppButton(
                  label: hasFile ? 'Change Video' : 'Choose MP4/WebM Video',
                  onPressed: _publishing ? null : _pickVideo,
                ),
                const SizedBox(height: 10),
                Text(
                  hasFile
                      ? (_videoName ?? 'Selected file')
                      : 'No video selected yet.',
                  style: const TextStyle(color: AppColors.white, fontSize: 13),
                ),
                const SizedBox(height: 6),
                if (_detectingDuration)
                  const Text(
                    'Detecting duration...',
                    style: TextStyle(color: AppColors.hintText, fontSize: 12),
                  )
                else
                  Text(
                    _durationSeconds > 0
                        ? 'Duration: ${_durationSeconds}s'
                        : 'Duration unavailable',
                    style: TextStyle(
                      color: _durationSeconds > 180
                          ? AppColors.errorRed
                          : AppColors.hintText,
                      fontSize: 12,
                    ),
                  ),
                const SizedBox(height: 12),
                LinearProgressIndicator(
                  value: _publishing ? _uploadProgress : 0,
                  minHeight: 8,
                  backgroundColor: AppColors.inputFill,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    AppColors.orange,
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
                const SizedBox(height: 6),
                Text(
                  _uploadStage,
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _sectionCard(
            title: 'Details',
            child: Column(
              children: [
                TextField(
                  controller: _titleCtrl,
                  enabled: !_publishing,
                  maxLength: 120,
                  style: const TextStyle(color: AppColors.white),
                  decoration: _inputDecoration(
                    'Wave title',
                  ).copyWith(counterText: ''),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _descriptionCtrl,
                  enabled: !_publishing,
                  maxLines: 4,
                  maxLength: 500,
                  style: const TextStyle(color: AppColors.white),
                  decoration: _inputDecoration(
                    'Description (optional)',
                  ).copyWith(counterText: ''),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _sectionCard(
            title: 'Safety Classification',
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _ageClassification,
                  dropdownColor: AppColors.cardBg,
                  items: const [
                    DropdownMenuItem(
                      value: 'minor_safe',
                      child: Text('Minor Safe'),
                    ),
                    DropdownMenuItem(value: 'teen', child: Text('Teen')),
                    DropdownMenuItem(value: 'adult', child: Text('Adult 18+')),
                  ],
                  onChanged: _publishing
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() {
                            _ageClassification = value;
                          });
                        },
                  decoration: _inputDecoration('Age classification'),
                ),
                const SizedBox(height: 10),
                _flagTile(
                  label: 'Contains explicit language',
                  value: _hasExplicitLanguage,
                  onChanged: (v) => setState(() => _hasExplicitLanguage = v),
                ),
                _flagTile(
                  label: 'Contains nudity',
                  value: _hasNudity,
                  onChanged: (v) => setState(() => _hasNudity = v),
                ),
                _flagTile(
                  label: 'Contains violence',
                  value: _hasViolence,
                  onChanged: (v) => setState(() => _hasViolence = v),
                ),
                _flagTile(
                  label: 'Contains revealing clothes',
                  value: _hasRevealingClothes,
                  onChanged: (v) => setState(() => _hasRevealingClothes = v),
                ),
                _flagTile(
                  label: 'Contains partial nudity',
                  value: _hasPartialNudity,
                  onChanged: (v) => setState(() => _hasPartialNudity = v),
                ),
                _flagTile(
                  label: 'Contains explicit content',
                  value: _hasExplicitContent,
                  onChanged: (v) => setState(() => _hasExplicitContent = v),
                ),
                _flagTile(
                  label: 'Contains parental guidance',
                  value: _hasParentalGuidance,
                  onChanged: (v) => setState(() => _hasParentalGuidance = v),
                ),
                _flagTile(
                  label: 'Contains erotic dancing',
                  value: _hasEroticDancing,
                  onChanged: (v) => setState(() => _hasEroticDancing = v),
                ),
                _flagTile(
                  label: 'Contains sexual nature',
                  value: _hasSexualNature,
                  onChanged: (v) => setState(() => _hasSexualNature = v),
                ),
                _flagTile(
                  label: 'Contains sex',
                  value: _hasSex,
                  onChanged: (v) => setState(() => _hasSex = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppButton(
            label: _publishing ? 'Publishing...' : 'Publish Wave',
            loading: _publishing,
            enabled: canPublish,
            onPressed: canPublish ? _publishWave : null,
          ),
          const SizedBox(height: 8),
          const Text(
            'Wave uploads support MP4/WebM and max duration of 3 minutes.',
            style: TextStyle(color: AppColors.hintText, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
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
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _flagTile({
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      title: Text(
        label,
        style: const TextStyle(color: AppColors.white, fontSize: 13),
      ),
      value: value,
      activeThumbColor: AppColors.orange,
      activeTrackColor: AppColors.orange.withValues(alpha: 0.35),
      onChanged: _publishing ? null : onChanged,
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.hintText),
      filled: true,
      fillColor: AppColors.cardBg.withValues(alpha: 0.9),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.inputBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.orange),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.inputBorder),
      ),
    );
  }
}
