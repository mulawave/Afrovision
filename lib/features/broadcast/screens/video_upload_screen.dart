import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../services/broadcast_service.dart';

class VideoUploadScreen extends StatefulWidget {
  const VideoUploadScreen({super.key});

  @override
  State<VideoUploadScreen> createState() => _VideoUploadScreenState();
}

class _VideoUploadScreenState extends State<VideoUploadScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  final _titleCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();
  File? _videoFile;
  String? _videoFileName;
  bool _uploading = false;
  String? _error;
  String? _channelId;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut),
    );
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _animCtrl.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _channelId ??=
        ModalRoute.of(context)?.settings.arguments as String?;
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _titleCtrl.dispose();
    _durationCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickVideo() async {
    final picker = ImagePicker();
    final picked = await picker.pickVideo(source: ImageSource.gallery);
    if (picked == null) return;
    setState(() {
      _videoFile = File(picked.path);
      _videoFileName = picked.name;
      _error = null;
    });
  }

  Future<void> _upload() async {
    if (_channelId == null) return;
    if (_videoFile == null) {
      setState(() => _error = 'Please select a video file');
      return;
    }
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Title is required');
      return;
    }
    final duration = int.tryParse(_durationCtrl.text.trim()) ?? 0;
    if (duration <= 0) {
      setState(() => _error = 'Duration must be a positive number (seconds)');
      return;
    }

    setState(() {
      _uploading = true;
      _error = null;
    });

    try {
      await BroadcastService.uploadVideo(
        channelId: _channelId!,
        title: title,
        duration: duration,
        videoFile: _videoFile!,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _uploading = false;
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header ──
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.cardBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: AppColors.inputBorder
                                    .withValues(alpha: 0.3),
                              ),
                            ),
                            child: const Icon(Icons.arrow_back_ios_new,
                                color: AppColors.white, size: 18),
                          ),
                        ),
                        const SizedBox(width: 16),
                        const Expanded(
                          child: Text(
                            'UPLOAD VIDEO',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 2,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    // ── Video picker ──
                    GestureDetector(
                      onTap: _uploading ? null : _pickVideo,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        height: 160,
                        decoration: BoxDecoration(
                          color: AppColors.cardBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: _videoFile != null
                                ? AppColors.orange.withValues(alpha: 0.6)
                                : AppColors.inputBorder.withValues(alpha: 0.3),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                            if (_videoFile != null)
                              BoxShadow(
                                color:
                                    AppColors.orange.withValues(alpha: 0.08),
                                blurRadius: 20,
                              ),
                          ],
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              _videoFile != null
                                  ? Icons.videocam
                                  : Icons.cloud_upload_outlined,
                              color: _videoFile != null
                                  ? AppColors.orange
                                  : AppColors.hintText,
                              size: 42,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _videoFileName ?? 'Tap to select video',
                              style: TextStyle(
                                color: _videoFile != null
                                    ? AppColors.white
                                    : AppColors.hintText,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (_videoFile == null) ...[
                              const SizedBox(height: 4),
                              Text(
                                'MP4, MOV, AVI, MKV, WEBM',
                                style: TextStyle(
                                  color: AppColors.lightOrange
                                      .withValues(alpha: 0.7),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // ── Title field ──
                    AppTextField(
                      controller: _titleCtrl,
                      label: 'Video Title',
                      hint: 'Enter a title for your video',
                    ),
                    const SizedBox(height: 20),

                    // ── Duration field ──
                    AppTextField(
                      controller: _durationCtrl,
                      label: 'Duration (seconds)',
                      hint: 'e.g. 300 for 5 minutes',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Enter the video length in seconds. This is used for schedule timing.',
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.7),
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                    const SizedBox(height: 28),

                    // ── Error ──
                    if (_error != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.errorRed.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.errorRed.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          _error!,
                          style: const TextStyle(
                            color: AppColors.errorRed,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // ── Upload button ──
                    AppButton(
                      label: _uploading ? 'Uploading...' : 'Upload Video',
                      onPressed: _uploading ? null : _upload,
                      loading: _uploading,
                    ),
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
