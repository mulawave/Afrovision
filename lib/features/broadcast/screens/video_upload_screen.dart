import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../channel/models/channel_model.dart';
import '../../channel/services/channel_service.dart';
import '../models/video_model.dart';
import '../services/broadcast_service.dart';

const Set<String> _supportedVideoExtensions = {'mp4', 'webm'};

/// Data class for each video in the upload queue.
class _VideoEntry {
  final File file;
  final String fileName;
  String title;
  String description;
  int? durationSec;
  bool detectingDuration;
  String? durationError;

  // Upload state
  String uploadStatus; // 'pending' | 'uploading' | 'done' | 'error'
  double uploadProgress;
  String? uploadError;
  String? videoId; // set after successful upload

  _VideoEntry({required this.file, required this.fileName, String? title})
    : title = title ?? _titleFromFileName(fileName),
      description = '',
      durationSec = null,
      detectingDuration = true,
      durationError = null,
      uploadStatus = 'pending',
      uploadProgress = 0,
      uploadError = null,
      videoId = null;

  static String _titleFromFileName(String name) {
    final dot = name.lastIndexOf('.');
    final base = dot > 0 ? name.substring(0, dot) : name;
    return base.replaceAll(RegExp(r'[_\-]+'), ' ').trim();
  }
}

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

  String? _channelId;
  String? _channelName;
  List<ChannelModel> _myChannels = [];
  bool _loadingChannels = false;
  bool _channelPromptShown = false;
  final List<_VideoEntry> _videos = [];
  final Set<int> _selectedQueueIndexes = {};
  bool _queueSelectionMode = false;

  List<VideoModel> _existingVideos = [];
  bool _loadingExisting = false;
  bool _uploading = false;
  bool _autoSchedule = true;
  DateTime _scheduleStart = DateTime.now().add(const Duration(minutes: 5));
  String? _globalError;

  // Summary after upload
  int _uploadedCount = 0;
  int _scheduledCount = 0;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _animCtrl.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _channelId ??= ModalRoute.of(context)?.settings.arguments as String?;
    if (_channelId != null && _existingVideos.isEmpty && !_loadingExisting) {
      _loadExistingVideos();
    } else if (_channelId == null && !_channelPromptShown) {
      _channelPromptShown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _promptForChannelSelection();
      });
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  // ─── File Picking ──────────────────────────────────────

  Future<void> _pickVideos() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: _supportedVideoExtensions.toList(),
      allowMultiple: true,
    );
    if (result == null || result.files.isEmpty) return;

    final newEntries = <_VideoEntry>[];
    for (final pf in result.files) {
      if (pf.path == null) continue;
      if (!_isSupportedVideoFile(pf.name)) {
        final entry = _VideoEntry(file: File(pf.path!), fileName: pf.name)
          ..detectingDuration = false
          ..uploadStatus = 'error'
          ..uploadError = 'Unsupported format. Upload MP4 or WebM.';
        newEntries.add(entry);
        continue;
      }
      newEntries.add(_VideoEntry(file: File(pf.path!), fileName: pf.name));
    }

    setState(() => _videos.addAll(newEntries));

    // Detect durations in parallel
    for (final entry in newEntries) {
      if (entry.uploadStatus == 'error') continue;
      _detectDuration(entry);
    }
  }

  bool _isSupportedVideoFile(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
    return _supportedVideoExtensions.contains(ext);
  }

  Future<void> _detectDuration(_VideoEntry entry) async {
    try {
      final ctrl = VideoPlayerController.file(entry.file);
      await ctrl.initialize();
      final dur = ctrl.value.duration.inSeconds;
      await ctrl.dispose();

      if (!mounted) return;
      setState(() {
        entry.durationSec = dur > 0 ? dur : null;
        entry.detectingDuration = false;
        if (dur <= 0) entry.durationError = 'Could not detect duration';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        entry.detectingDuration = false;
        entry.durationError = 'Detection failed';
      });
    }
  }

  void _removeVideo(int index) {
    setState(() {
      _videos.removeAt(index);
      _selectedQueueIndexes.remove(index);
      if (_selectedQueueIndexes.isEmpty) {
        _queueSelectionMode = false;
      }
    });
  }

  void _reorderVideo(int oldIndex, int newIndex) {
    setState(() {
      if (newIndex > oldIndex) newIndex--;
      final item = _videos.removeAt(oldIndex);
      _videos.insert(newIndex, item);
      _selectedQueueIndexes.clear();
      _queueSelectionMode = false;
    });
  }

  void _toggleQueueSelectionMode() {
    if (_uploading || _done || _videos.isEmpty) return;
    setState(() {
      _queueSelectionMode = !_queueSelectionMode;
      if (!_queueSelectionMode) {
        _selectedQueueIndexes.clear();
      }
    });
  }

  void _toggleQueueSelection(int index) {
    if (!_queueSelectionMode || _uploading || _done) return;
    setState(() {
      if (_selectedQueueIndexes.contains(index)) {
        _selectedQueueIndexes.remove(index);
      } else {
        _selectedQueueIndexes.add(index);
      }
      if (_selectedQueueIndexes.isEmpty) {
        _queueSelectionMode = false;
      }
    });
  }

  void _selectAllQueue() {
    if (_videos.isEmpty) return;
    setState(() {
      _queueSelectionMode = true;
      _selectedQueueIndexes
        ..clear()
        ..addAll(List.generate(_videos.length, (i) => i));
    });
  }

  void _removeSelectedQueue() {
    if (_selectedQueueIndexes.isEmpty) return;
    final indexes = _selectedQueueIndexes.toList()..sort((a, b) => b - a);
    setState(() {
      for (final idx in indexes) {
        if (idx >= 0 && idx < _videos.length) {
          _videos.removeAt(idx);
        }
      }
      _selectedQueueIndexes.clear();
      _queueSelectionMode = false;
    });
  }

  Future<void> _loadExistingVideos() async {
    if (_channelId == null) return;
    setState(() => _loadingExisting = true);
    try {
      final result = await BroadcastService.getChannelVideos(_channelId!);
      if (!mounted) return;
      setState(() => _existingVideos = result.videos);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Could not load existing videos: $e',
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _loadingExisting = false);
    }
  }

  Future<void> _openExistingVideosManager() async {
    if (_channelId == null) return;
    if (_existingVideos.isEmpty && !_loadingExisting) {
      await _loadExistingVideos();
    }
    if (!mounted) return;

    final selectedIds = <String>{};
    bool deleting = false;
    String? localError;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final hasVideos = _existingVideos.isNotEmpty;

            Future<void> deleteSelected() async {
              if (selectedIds.isEmpty || deleting) return;
              setSheetState(() {
                deleting = true;
                localError = null;
              });

              for (final id in selectedIds.toList()) {
                try {
                  await BroadcastService.deleteVideo(id);
                } catch (e) {
                  localError = e.toString();
                }
              }

              await _loadExistingVideos();
              selectedIds.clear();

              if (!mounted) return;
              setSheetState(() {
                deleting = false;
              });
            }

            return Container(
              height: MediaQuery.of(context).size.height * 0.78,
              decoration: const BoxDecoration(
                color: AppColors.darkBlue,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.goldText,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
                    child: Row(
                      children: [
                        const Text(
                          'MANAGE EXISTING VIDEOS',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: _loadExistingVideos,
                          child: const Icon(
                            Icons.refresh_rounded,
                            color: AppColors.goldText,
                            size: 20,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (localError != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        localError!,
                        style: const TextStyle(
                          color: AppColors.errorRed,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  const SizedBox(height: 6),
                  Expanded(
                    child: _loadingExisting
                        ? const Center(
                            child: CircularProgressIndicator(
                              color: AppColors.orange,
                            ),
                          )
                        : !hasVideos
                        ? Center(
                            child: Text(
                              'No uploaded videos yet',
                              style: TextStyle(
                                color: AppColors.goldText,
                                fontSize: 14,
                              ),
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                            itemCount: _existingVideos.length,
                            itemBuilder: (_, index) {
                              final video = _existingVideos[index];
                              final selected = selectedIds.contains(video.id);
                              return GestureDetector(
                                onTap: () {
                                  setSheetState(() {
                                    if (selected) {
                                      selectedIds.remove(video.id);
                                    } else {
                                      selectedIds.add(video.id);
                                    }
                                  });
                                },
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: selected
                                        ? AppColors.orange.withValues(
                                            alpha: 0.14,
                                          )
                                        : AppColors.inputFill,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: selected
                                          ? AppColors.orange.withValues(
                                              alpha: 0.55,
                                            )
                                          : AppColors.inputBorder,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(
                                        selected
                                            ? Icons.check_circle_rounded
                                            : Icons
                                                  .radio_button_unchecked_rounded,
                                        color: selected
                                            ? AppColors.orange
                                            : AppColors.hintText,
                                        size: 18,
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          video.title,
                                          style: const TextStyle(
                                            color: AppColors.white,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                  if (hasVideos)
                    Container(
                      padding: const EdgeInsets.fromLTRB(20, 10, 20, 18),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        border: Border(
                          top: BorderSide(
                            color: AppColors.inputBorder.withValues(alpha: 0.3),
                          ),
                        ),
                      ),
                      child: Row(
                        children: [
                          GestureDetector(
                            onTap: () {
                              setSheetState(() {
                                selectedIds
                                  ..clear()
                                  ..addAll(_existingVideos.map((v) => v.id));
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 9,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.inputFill,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: AppColors.inputBorder,
                                ),
                              ),
                              child: const Text(
                                'Select All',
                                style: TextStyle(
                                  color: AppColors.goldText,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: AppButton(
                              label: deleting
                                  ? 'Deleting...'
                                  : selectedIds.isEmpty
                                  ? 'Delete Selected'
                                  : 'Delete Selected (${selectedIds.length})',
                              onPressed: selectedIds.isEmpty || deleting
                                  ? null
                                  : deleteSelected,
                              loading: deleting,
                              enabled: selectedIds.isNotEmpty && !deleting,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ─── Content Type Helper ───────────────────────────────

  String _contentTypeForFile(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      default:
        return 'video/mp4';
    }
  }

  // ─── Upload + Schedule ─────────────────────────────────

  bool get _canUpload {
    final eligible = _videos.where((v) => v.uploadStatus != 'error').toList();
    if (eligible.isEmpty) return false;
    if (_uploading) return false;
    return eligible.every(
      (v) =>
          !v.detectingDuration &&
          v.durationSec != null &&
          v.durationSec! > 0 &&
          v.description.trim().isNotEmpty,
    );
  }

  Future<void> _startUpload() async {
    if (_channelId == null || !_canUpload) return;

    setState(() {
      _uploading = true;
      _globalError = null;
      _uploadedCount = 0;
      _scheduledCount = 0;
      _done = false;
    });

    final uploadedVideoIds = <String>[];

    for (int i = 0; i < _videos.length; i++) {
      final entry = _videos[i];
      if (!_isSupportedVideoFile(entry.fileName)) {
        setState(() {
          entry.uploadStatus = 'error';
          entry.uploadError = 'Unsupported format. Upload MP4 or WebM.';
          entry.detectingDuration = false;
        });
        continue;
      }
      setState(() {
        entry.uploadStatus = 'uploading';
        entry.uploadProgress = 0;
      });

      try {
        final contentType = _contentTypeForFile(entry.fileName);

        // Step 1: Get signed upload URL
        final urlData = await BroadcastService.getUploadUrl(
          contentType: contentType,
          fileName: entry.fileName,
        );
        setState(() => entry.uploadProgress = 0.1);

        // Step 2: Upload directly to GCS
        await BroadcastService.uploadToGcs(
          signedUrl: urlData['signed_url']!,
          file: entry.file,
          contentType: contentType,
          onProgress: (sent, total) {
            if (!mounted) return;
            final uploadFraction = total > 0 ? sent / total : 0.0;
            setState(() => entry.uploadProgress = 0.1 + 0.8 * uploadFraction);
          },
        );
        setState(() => entry.uploadProgress = 0.9);

        // Step 3: Register the uploaded video
        final video = await BroadcastService.registerUploadedVideo(
          channelId: _channelId!,
          title: entry.title,
          description: entry.description.trim(),
          duration: entry.durationSec!,
          videoUrl: urlData['public_url']!,
        );

        setState(() {
          entry.uploadStatus = 'done';
          entry.uploadProgress = 1.0;
          entry.videoId = video.id;
          _uploadedCount++;
        });
        uploadedVideoIds.add(video.id);
      } catch (e) {
        setState(() {
          entry.uploadStatus = 'error';
          entry.uploadError = e.toString();
        });
      }
    }

    // Auto-schedule if enabled and at least one video uploaded
    if (_autoSchedule && uploadedVideoIds.isNotEmpty) {
      try {
        final programs = await BroadcastService.scheduleSequential(
          channelId: _channelId!,
          videoIds: uploadedVideoIds,
          startTime: _scheduleStart.millisecondsSinceEpoch,
        );
        setState(() => _scheduledCount = programs.length);
      } catch (e) {
        setState(() => _globalError = 'Scheduling failed: $e');
      }
    }

    setState(() {
      _uploading = false;
      _done = true;
    });

    _loadExistingVideos();
  }

  Future<void> _pickScheduleTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _scheduleStart,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.orange,
            surface: AppColors.darkBlue,
          ),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_scheduleStart),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.orange,
            surface: AppColors.darkBlue,
          ),
        ),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;

    setState(() {
      _scheduleStart = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  // ─── Helpers ───────────────────────────────────────────

  String _formatDuration(int totalSeconds) {
    final h = totalSeconds ~/ 3600;
    final m = (totalSeconds % 3600) ~/ 60;
    final s = totalSeconds % 60;
    if (h > 0) {
      return '${h}h ${m.toString().padLeft(2, '0')}m ${s.toString().padLeft(2, '0')}s';
    }
    return '${m}m ${s.toString().padLeft(2, '0')}s';
  }

  String _formatDateTime(DateTime dt) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month - 1]} ${dt.day}, $hour:$minute';
  }

  int get _totalDuration {
    int total = 0;
    for (final v in _videos) {
      total += v.durationSec ?? 0;
    }
    return total;
  }

  // ─── Build ─────────────────────────────────────────────

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
              child: Column(
                children: [
                  _buildHeader(),
                  Expanded(
                    child: _channelId == null
                        ? _buildChannelGate()
                        : (_done ? _buildSummary() : _buildContent()),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: _uploading ? null : () => Navigator.pop(context, _done),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.3),
                ),
              ),
              child: Icon(
                Icons.arrow_back_ios_new,
                color: _uploading ? AppColors.goldText : AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'UPLOAD VIDEOS',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _channelName != null
                      ? 'Posting to $_channelName'
                      : 'Select a channel before uploading',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.white.withValues(alpha: 0.65),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (_videos.isNotEmpty && !_uploading && !_done)
            GestureDetector(
              onTap: _pickVideos,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.orange.withValues(alpha: 0.4),
                  ),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add, color: AppColors.orange, size: 16),
                    SizedBox(width: 4),
                    Text(
                      'Add More',
                      style: TextStyle(
                        color: AppColors.orange,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (!_uploading && _channelId != null) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _openExistingVideosManager,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.video_library_rounded,
                      size: 14,
                      color: AppColors.goldText,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Manage',
                      style: TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildChannelGate() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: AppColors.softBlue.withValues(alpha: 0.25),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.lightBlue.withValues(alpha: 0.55),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.waves_rounded,
                  color: AppColors.softBlue,
                  size: 34,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Choose a channel first',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _loadingChannels
                    ? 'Loading your channels...'
                    : 'Select the channel that should receive this wave, then continue to upload and publish.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: 0.7),
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 18),
              AppButton(
                label: _loadingChannels ? 'Loading...' : 'Choose Channel',
                onPressed: _loadingChannels ? null : _promptForChannelSelection,
              ),
              if (!_loadingChannels && _myChannels.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  '${_myChannels.length} channel${_myChannels.length == 1 ? '' : 's'} available',
                  style: TextStyle(
                    color: AppColors.lightOrange.withValues(alpha: 0.8),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _promptForChannelSelection() async {
    if (_loadingChannels) return;
    setState(() => _loadingChannels = true);
    try {
      _myChannels = await ChannelService.getMyChannels();
      if (!mounted) return;
      if (_myChannels.isEmpty) {
        setState(() => _loadingChannels = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Create a channel before uploading a wave.'),
          ),
        );
        return;
      }

      final selected = await showModalBottomSheet<ChannelModel>(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        builder: (context) {
          return Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            decoration: const BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: AppColors.inputBorder,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Select a target channel',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Waves are posted to one of your channels before publishing.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.7),
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _myChannels.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final channel = _myChannels[index];
                      return GestureDetector(
                        onTap: () => Navigator.pop(context, channel),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.inputFill,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: AppColors.inputBorder.withValues(
                                alpha: 0.45,
                              ),
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.lightBlue.withValues(
                                    alpha: 0.55,
                                  ),
                                ),
                                child: const Icon(
                                  Icons.live_tv_rounded,
                                  color: AppColors.softBlue,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      channel.name,
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '#${channel.channelNumber}',
                                      style: TextStyle(
                                        color: AppColors.lightOrange.withValues(
                                          alpha: 0.75,
                                        ),
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: AppColors.lightOrange,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          );
        },
      );

      if (!mounted) return;
      if (selected == null) {
        setState(() => _loadingChannels = false);
        return;
      }

      setState(() {
        _channelId = selected.id;
        _channelName = selected.name;
        _loadingChannels = false;
      });
      if (_existingVideos.isEmpty && !_loadingExisting) {
        _loadExistingVideos();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingChannels = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Unable to load channels: $e')));
    }
  }

  Widget _buildContent() {
    if (_videos.isEmpty) return _buildEmptyState();

    return Column(
      children: [
        _buildSummaryBar(),
        Expanded(
          child: ReorderableListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: _videos.length,
            onReorder: (_uploading || _queueSelectionMode)
                ? (a, b) {}
                : _reorderVideo,
            proxyDecorator: (child, index, animation) {
              return AnimatedBuilder(
                listenable: animation,
                builder: (context, child) => Material(
                  color: Colors.transparent,
                  elevation: 4,
                  child: child,
                ),
                child: child,
              );
            },
            itemBuilder: (context, index) => _buildVideoCard(index),
          ),
        ),
        _buildBottomControls(),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(
              onTap: _pickVideos,
              child: Container(
                width: double.infinity,
                height: 200,
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.3),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: AppColors.orange.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.video_library_outlined,
                        color: AppColors.orange,
                        size: 32,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Tap to select videos',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Select multiple videos at once\nMP4, WEBM',
                      style: TextStyle(
                        color: AppColors.goldText,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Videos will be auto-detected for duration\nand scheduled back-to-back like a TV channel',
              style: TextStyle(
                color: AppColors.lightOrange.withValues(alpha: 0.6),
                fontSize: 12,
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryBar() {
    final detecting = _videos.where((v) => v.detectingDuration).length;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                '${_videos.length} video${_videos.length != 1 ? 's' : ''}',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 12),
              Container(
                width: 1,
                height: 16,
                color: AppColors.inputBorder.withValues(alpha: 0.3),
              ),
              const SizedBox(width: 12),
              if (detecting > 0)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.5,
                        color: AppColors.lightOrange.withValues(alpha: 0.6),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Detecting $detecting...',
                      style: TextStyle(
                        color: AppColors.lightOrange.withValues(alpha: 0.7),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                )
              else
                Text(
                  'Total: ${_formatDuration(_totalDuration)}',
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
          if (!_uploading && !_done && _videos.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                GestureDetector(
                  onTap: _toggleQueueSelectionMode,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: _queueSelectionMode
                          ? AppColors.orange.withValues(alpha: 0.18)
                          : AppColors.inputFill,
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(
                        color: _queueSelectionMode
                            ? AppColors.orange.withValues(alpha: 0.5)
                            : AppColors.inputBorder.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      _queueSelectionMode ? 'Cancel Selection' : 'Select',
                      style: TextStyle(
                        color: _queueSelectionMode
                            ? AppColors.orange
                            : AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _selectAllQueue,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(
                        color: AppColors.inputBorder.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      'Select All',
                      style: TextStyle(
                        color: AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: _selectedQueueIndexes.isEmpty
                      ? null
                      : _removeSelectedQueue,
                  child: Opacity(
                    opacity: _selectedQueueIndexes.isEmpty ? 0.45 : 1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.errorRed.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(
                          color: AppColors.errorRed.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Text(
                        _selectedQueueIndexes.isEmpty
                            ? 'Delete Selected'
                            : 'Delete (${_selectedQueueIndexes.length})',
                        style: const TextStyle(
                          color: AppColors.errorRed,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildVideoCard(int index) {
    final entry = _videos[index];
    final isDone = entry.uploadStatus == 'done';
    final isError = entry.uploadStatus == 'error';
    final isUploading = entry.uploadStatus == 'uploading';
    final isSelected = _selectedQueueIndexes.contains(index);

    return GestureDetector(
      onTap: _queueSelectionMode ? () => _toggleQueueSelection(index) : null,
      child: Container(
        key: ValueKey('video_${entry.fileName}_$index'),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDone
                ? AppColors.successGreen.withValues(alpha: 0.4)
                : isError
                ? AppColors.errorRed.withValues(alpha: 0.4)
                : AppColors.inputBorder.withValues(alpha: 0.2),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 8, 0),
              child: Row(
                children: [
                  if (_queueSelectionMode) ...[
                    Icon(
                      isSelected
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked_rounded,
                      color: isSelected ? AppColors.orange : AppColors.hintText,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                  ],
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(
                          color: AppColors.orange,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _buildStatusIcon(entry),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (!_uploading && !_done)
                          GestureDetector(
                            onTap: () => _editTitle(index),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    entry.title,
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Icon(
                                  Icons.edit,
                                  color: AppColors.goldText,
                                  size: 14,
                                ),
                              ],
                            ),
                          )
                        else
                          Text(
                            entry.title,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            if (entry.detectingDuration) ...[
                              SizedBox(
                                width: 10,
                                height: 10,
                                child: CircularProgressIndicator(
                                  strokeWidth: 1.5,
                                  color: AppColors.lightOrange.withValues(
                                    alpha: 0.5,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'Detecting duration...',
                                style: TextStyle(
                                  color: AppColors.goldText,
                                  fontSize: 11,
                                ),
                              ),
                            ] else if (entry.durationError != null) ...[
                              Icon(
                                Icons.warning_amber_rounded,
                                color: AppColors.errorRed.withValues(
                                  alpha: 0.7,
                                ),
                                size: 12,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                entry.durationError!,
                                style: TextStyle(
                                  color: AppColors.errorRed.withValues(
                                    alpha: 0.7,
                                  ),
                                  fontSize: 11,
                                ),
                              ),
                            ] else ...[
                              Icon(
                                Icons.timer_outlined,
                                color: AppColors.goldText,
                                size: 12,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                _formatDuration(entry.durationSec ?? 0),
                                style: TextStyle(
                                  color: AppColors.goldText,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                entry.fileName,
                                style: TextStyle(
                                  color: AppColors.goldText,
                                  fontSize: 10,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (!_uploading && !_done)
                    IconButton(
                      onPressed: _queueSelectionMode
                          ? () => _toggleQueueSelection(index)
                          : () => _removeVideo(index),
                      icon: Icon(
                        _queueSelectionMode
                            ? (isSelected
                                  ? Icons.check_box_rounded
                                  : Icons.check_box_outline_blank_rounded)
                            : Icons.close_rounded,
                        color: _queueSelectionMode
                            ? (isSelected
                                  ? AppColors.orange
                                  : AppColors.goldText)
                            : AppColors.goldText,
                        size: 18,
                      ),
                      splashRadius: 18,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                        minWidth: 32,
                        minHeight: 32,
                      ),
                    ),
                  if (!_uploading && !_done)
                    _queueSelectionMode
                        ? const SizedBox(width: 6)
                        : ReorderableDragStartListener(
                            index: index,
                            child: Padding(
                              padding: const EdgeInsets.all(8),
                              child: Icon(
                                Icons.drag_handle,
                                color: AppColors.goldText,
                                size: 20,
                              ),
                            ),
                          ),
                ],
              ),
            ),
            // Description field
            if (!_uploading && !_done)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
                child: TextField(
                  maxLines: 2,
                  style: const TextStyle(color: AppColors.white, fontSize: 12),
                  decoration: InputDecoration(
                    hintText: 'Brief description (required)',
                    hintStyle: TextStyle(
                      color: AppColors.goldText,
                      fontSize: 12,
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    filled: true,
                    fillColor: AppColors.inputFill.withValues(alpha: 0.3),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: entry.description.trim().isEmpty
                            ? AppColors.orange.withValues(alpha: 0.4)
                            : AppColors.inputBorder.withValues(alpha: 0.2),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: entry.description.trim().isEmpty
                            ? AppColors.orange.withValues(alpha: 0.4)
                            : AppColors.inputBorder.withValues(alpha: 0.2),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: AppColors.orange.withValues(alpha: 0.6),
                      ),
                    ),
                  ),
                  onChanged: (val) => setState(() => entry.description = val),
                ),
              )
            else if (isDone && entry.description.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 0),
                child: Text(
                  entry.description,
                  style: TextStyle(color: AppColors.goldText, fontSize: 11),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            if (isUploading || isDone || isError)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
                child: Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: entry.uploadProgress,
                        backgroundColor: AppColors.inputBorder.withValues(
                          alpha: 0.2,
                        ),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          isDone
                              ? AppColors.successGreen
                              : isError
                              ? AppColors.errorRed
                              : AppColors.orange,
                        ),
                        minHeight: 3,
                      ),
                    ),
                    if (isError && entry.uploadError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          entry.uploadError!,
                          style: TextStyle(
                            color: AppColors.errorRed.withValues(alpha: 0.8),
                            fontSize: 10,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              )
            else
              const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusIcon(_VideoEntry entry) {
    if (entry.uploadStatus == 'done') {
      return Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: AppColors.successGreen.withValues(alpha: 0.15),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check, color: AppColors.successGreen, size: 14),
      );
    }
    if (entry.uploadStatus == 'error') {
      return Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: AppColors.errorRed.withValues(alpha: 0.15),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.close, color: AppColors.errorRed, size: 14),
      );
    }
    if (entry.uploadStatus == 'uploading') {
      return SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          value: entry.uploadProgress > 0 ? entry.uploadProgress : null,
          color: AppColors.orange,
        ),
      );
    }
    return Icon(Icons.videocam_outlined, color: AppColors.goldText, size: 22);
  }

  Widget _buildBottomControls() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      decoration: BoxDecoration(
        color: AppColors.darkBlue.withValues(alpha: 0.9),
        border: Border(
          top: BorderSide(color: AppColors.inputBorder.withValues(alpha: 0.15)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Auto-schedule toggle
          GestureDetector(
            onTap: _uploading
                ? null
                : () => setState(() => _autoSchedule = !_autoSchedule),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _autoSchedule
                    ? AppColors.orange.withValues(alpha: 0.08)
                    : AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _autoSchedule
                      ? AppColors.orange.withValues(alpha: 0.3)
                      : AppColors.inputBorder.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.schedule_rounded,
                    color: _autoSchedule
                        ? AppColors.orange
                        : AppColors.hintText,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Auto-Schedule Sequential',
                          style: TextStyle(
                            color: _autoSchedule
                                ? AppColors.white
                                : AppColors.hintText,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Play back-to-back like a TV channel',
                          style: TextStyle(
                            color: AppColors.goldText,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _autoSchedule,
                    onChanged: _uploading
                        ? null
                        : (v) => setState(() => _autoSchedule = v),
                    // ignore: deprecated_member_use
                    activeColor: AppColors.orange,
                    activeTrackColor: AppColors.orange.withValues(alpha: 0.3),
                    inactiveThumbColor: AppColors.hintText,
                    inactiveTrackColor: AppColors.inputBorder.withValues(
                      alpha: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Schedule start time
          if (_autoSchedule) ...[
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _uploading ? null : _pickScheduleTime,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.play_arrow_rounded,
                      color: AppColors.lightOrange.withValues(alpha: 0.7),
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Starts: ${_formatDateTime(_scheduleStart)}',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      Icons.edit_calendar,
                      color: AppColors.goldText,
                      size: 16,
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          if (_globalError != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: AppColors.errorRed.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.errorRed.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                _globalError!,
                style: const TextStyle(color: AppColors.errorRed, fontSize: 12),
              ),
            ),
          ],
          AppButton(
            label: _uploading
                ? 'Uploading ${_uploadedCount + 1} of ${_videos.length}...'
                : 'Upload ${_videos.length} Video${_videos.length != 1 ? 's' : ''}',
            onPressed: _canUpload ? _startUpload : null,
            loading: _uploading,
          ),
        ],
      ),
    );
  }

  // ─── Summary ───────────────────────────────────────────

  Widget _buildSummary() {
    final failedCount = _videos.where((v) => v.uploadStatus == 'error').length;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: failedCount == 0
                    ? AppColors.successGreen.withValues(alpha: 0.12)
                    : AppColors.orange.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                failedCount == 0 ? Icons.check_circle : Icons.info_outline,
                color: failedCount == 0
                    ? AppColors.successGreen
                    : AppColors.orange,
                size: 44,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              failedCount == 0 ? 'All Done!' : 'Upload Complete',
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '$_uploadedCount of ${_videos.length} videos uploaded',
              style: TextStyle(color: AppColors.goldText, fontSize: 14),
            ),
            if (_scheduledCount > 0) ...[
              const SizedBox(height: 6),
              Text(
                '$_scheduledCount programs scheduled',
                style: const TextStyle(
                  color: AppColors.lightOrange,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Starting ${_formatDateTime(_scheduleStart)}',
                style: TextStyle(color: AppColors.goldText, fontSize: 12),
              ),
            ],
            if (failedCount > 0) ...[
              const SizedBox(height: 12),
              Text(
                '$failedCount failed',
                style: TextStyle(
                  color: AppColors.errorRed.withValues(alpha: 0.8),
                  fontSize: 13,
                ),
              ),
            ],
            if (_globalError != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.errorRed.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.errorRed.withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  _globalError!,
                  style: TextStyle(
                    color: AppColors.errorRed.withValues(alpha: 0.8),
                    fontSize: 12,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
            const SizedBox(height: 28),
            AppButton(
              label: 'Done',
              onPressed: () => Navigator.pop(context, true),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Title Edit Dialog ─────────────────────────────────

  Future<void> _editTitle(int index) async {
    final entry = _videos[index];
    final controller = TextEditingController(text: entry.title);

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: AppColors.inputBorder.withValues(alpha: 0.3)),
        ),
        title: const Text(
          'Edit Title',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: AppColors.white, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.inputFill,
            hintText: 'Video title',
            hintStyle: TextStyle(color: AppColors.goldText),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                color: AppColors.inputBorder.withValues(alpha: 0.3),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                color: AppColors.inputBorder.withValues(alpha: 0.3),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.orange),
            ),
          ),
          onSubmitted: (val) => Navigator.pop(ctx, val),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: AppColors.goldText)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text(
              'Save',
              style: TextStyle(
                color: AppColors.orange,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );

    controller.dispose();
    if (result != null && result.trim().isNotEmpty && mounted) {
      setState(() => _videos[index].title = result.trim());
    }
  }
}

/// AnimatedBuilder for reorderable proxy decorator.
class AnimatedBuilder extends AnimatedWidget {
  final TransitionBuilder builder;
  final Widget? child;

  const AnimatedBuilder({
    super.key,
    required super.listenable,
    required this.builder,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    return builder(context, child);
  }
}
