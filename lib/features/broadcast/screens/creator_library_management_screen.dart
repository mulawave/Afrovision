import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/video_model.dart';
import '../services/broadcast_service.dart';

class CreatorLibraryManagementScreen extends StatefulWidget {
  const CreatorLibraryManagementScreen({super.key});

  @override
  State<CreatorLibraryManagementScreen> createState() =>
      _CreatorLibraryManagementScreenState();
}

class _CreatorLibraryManagementScreenState
    extends State<CreatorLibraryManagementScreen>
    with SingleTickerProviderStateMixin {
  String? _channelId;
  bool _argsHandled = false;
  bool _loading = true;
  bool _deleting = false;
  bool _selectionMode = false;
  String? _error;
  List<VideoModel> _videos = [];
  String? _deletingVideoId;
  final Set<String> _selectedVideoIds = {};

  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_argsHandled) return;
    _argsHandled = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is String) {
      _channelId = args;
    } else if (args is Map) {
      _channelId = (args['channelId'] ?? args['id'])?.toString();
    }

    if (_channelId == null || _channelId!.isEmpty) {
      setState(() {
        _error = 'No channel selected.';
        _loading = false;
      });
      _animCtrl.forward();
      return;
    }

    _loadVideos();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadVideos() async {
    try {
      final videos = await BroadcastService.getChannelVideos(_channelId!);
      if (!mounted) return;
      setState(() {
        _videos = videos;
        _loading = false;
        _error = null;
        _selectedVideoIds.removeWhere(
          (id) => !_videos.any((video) => video.id == id),
        );
        if (_selectedVideoIds.isEmpty) {
          _selectionMode = false;
        }
      });
      _animCtrl.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load creator library. Pull to refresh.';
        _loading = false;
      });
      _animCtrl.forward();
    }
  }

  Future<void> _deleteVideo(VideoModel video) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete Video',
          style: TextStyle(color: AppColors.white),
        ),
        content: Text(
          'Delete "${video.title}" from the library? This cannot be undone.',
          style: const TextStyle(color: AppColors.hintText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.white),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _deleting = true;
      _deletingVideoId = video.id;
    });

    try {
      await BroadcastService.deleteVideo(video.id);
      if (!mounted) return;
      setState(() {
        _videos.removeWhere((item) => item.id == video.id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Deleted ${video.title}',
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.successGreen.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString(),
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _deleting = false;
          _deletingVideoId = null;
        });
      }
    }
  }

  void _toggleSelectionMode() {
    if (_loading || _deleting) return;
    setState(() {
      _selectionMode = !_selectionMode;
      if (!_selectionMode) {
        _selectedVideoIds.clear();
      }
    });
  }

  void _toggleVideoSelection(String videoId) {
    if (!_selectionMode || _loading || _deleting) return;
    setState(() {
      if (_selectedVideoIds.contains(videoId)) {
        _selectedVideoIds.remove(videoId);
      } else {
        _selectedVideoIds.add(videoId);
      }
      if (_selectedVideoIds.isEmpty) {
        _selectionMode = false;
      }
    });
  }

  void _selectAllVideos() {
    if (_videos.isEmpty || _loading || _deleting) return;
    setState(() {
      _selectionMode = true;
      _selectedVideoIds
        ..clear()
        ..addAll(_videos.map((video) => video.id));
    });
  }

  void _clearSelection() {
    if (_loading || _deleting) return;
    setState(() {
      _selectionMode = false;
      _selectedVideoIds.clear();
    });
  }

  Future<void> _deleteSelectedVideos() async {
    if (_selectedVideoIds.isEmpty || _deleting) return;
    final ids = _selectedVideoIds.toList();
    setState(() {
      _deleting = true;
      _deletingVideoId = ids.first;
    });

    String? errorMessage;
    for (final id in ids) {
      try {
        await BroadcastService.deleteVideo(id);
      } catch (e) {
        errorMessage = e.toString();
      }
    }

    await _loadVideos();

    if (!mounted) return;
    setState(() {
      _deleting = false;
      _deletingVideoId = null;
      _selectionMode = false;
      _selectedVideoIds.clear();
    });

    if (errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            errorMessage,
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    if (h > 0) {
      return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  String _formatDate(int epochMs) {
    final dt = DateTime.fromMillisecondsSinceEpoch(epochMs);
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
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
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
              Expanded(child: _buildBody()),
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
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Text(
              'Creator Library',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          GestureDetector(
            onTap: _loading || _deleting ? null : _toggleSelectionMode,
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _selectionMode
                    ? AppColors.orange.withValues(alpha: 0.18)
                    : AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _selectionMode
                      ? AppColors.orange.withValues(alpha: 0.35)
                      : AppColors.inputBorder,
                ),
              ),
              child: Icon(
                _selectionMode ? Icons.close_rounded : Icons.fact_check_rounded,
                color: _selectionMode ? AppColors.lightOrange : AppColors.white,
                size: 18,
              ),
            ),
          ),
          GestureDetector(
            onTap: _loading || _deleting
                ? null
                : () => Navigator.pushNamed(
                    context,
                    '/video-upload',
                    arguments: _channelId,
                  ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Upload',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                color: AppColors.errorRed,
                size: 48,
              ),
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(color: AppColors.white, fontSize: 15),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              GestureDetector(
                onTap: () {
                  setState(() {
                    _loading = true;
                    _error = null;
                  });
                  _loadVideos();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Retry',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_videos.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.video_library_outlined,
                  color: AppColors.orange,
                  size: 48,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'No videos uploaded yet',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Use Upload to add content to this channel library.',
                style: TextStyle(color: AppColors.hintText, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              GestureDetector(
                onTap: () => Navigator.pushNamed(
                  context,
                  '/video-upload',
                  arguments: _channelId,
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Upload Video',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        if (_selectionMode) _buildBulkActionBar(),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.orange,
            backgroundColor: AppColors.inputFill,
            onRefresh: _loadVideos,
            child: FadeTransition(
              opacity: _fadeAnim,
              child: SlideTransition(
                position: _slideAnim,
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  itemCount: _videos.length,
                  itemBuilder: (ctx, index) {
                    final video = _videos[index];
                    final selected = _selectedVideoIds.contains(video.id);
                    return GestureDetector(
                      onTap: _selectionMode
                          ? () => _toggleVideoSelection(video.id)
                          : () => Navigator.pushNamed(
                              context,
                              '/channel-library/item',
                              arguments: video,
                            ),
                      onLongPress: () {
                        if (!_selectionMode) {
                          setState(() => _selectionMode = true);
                        }
                        _toggleVideoSelection(video.id);
                      },
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 14),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: selected
                              ? AppColors.orange.withValues(alpha: 0.12)
                              : AppColors.inputFill,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: selected
                                ? AppColors.orange.withValues(alpha: 0.45)
                                : AppColors.inputBorder,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_selectionMode)
                              Padding(
                                padding: const EdgeInsets.only(right: 10),
                                child: Icon(
                                  selected
                                      ? Icons.check_circle_rounded
                                      : Icons.radio_button_unchecked_rounded,
                                  color: selected
                                      ? AppColors.orange
                                      : AppColors.hintText,
                                  size: 20,
                                ),
                              ),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                width: 96,
                                height: 68,
                                color: AppColors.cardBg,
                                child: video.fullThumbnailUrl != null
                                    ? Image.network(
                                        video.fullThumbnailUrl!,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) =>
                                            const Icon(
                                              Icons.movie_outlined,
                                              color: AppColors.hintText,
                                            ),
                                      )
                                    : const Icon(
                                        Icons.movie_outlined,
                                        color: AppColors.hintText,
                                      ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    video.title,
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 6),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      _miniChip(
                                        Icons.access_time_rounded,
                                        _formatDuration(video.duration),
                                      ),
                                      _miniChip(
                                        Icons.calendar_today_rounded,
                                        _formatDate(video.createdAt),
                                      ),
                                    ],
                                  ),
                                  if (video.description.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      video.description,
                                      style: const TextStyle(
                                        color: AppColors.hintText,
                                        fontSize: 12,
                                        height: 1.4,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              children: [
                                GestureDetector(
                                  onTap: () => Navigator.pushNamed(
                                    context,
                                    '/channel-library/item',
                                    arguments: video,
                                  ),
                                  child: const Icon(
                                    Icons.visibility_rounded,
                                    color: AppColors.lightOrange,
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                GestureDetector(
                                  onTap:
                                      _deleting || _deletingVideoId == video.id
                                      ? null
                                      : () => _deleteVideo(video),
                                  child: Icon(
                                    _deletingVideoId == video.id
                                        ? Icons.hourglass_top_rounded
                                        : Icons.delete_rounded,
                                    color: AppColors.errorRed,
                                    size: 18,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBulkActionBar() {
    final count = _selectedVideoIds.length;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: _selectAllVideos,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.inputBorder),
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
          GestureDetector(
            onTap: _clearSelection,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Text(
                'Clear',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const Spacer(),
          Text(
            count == 0 ? 'Select videos to delete' : '$count selected',
            style: const TextStyle(
              color: AppColors.hintText,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: count == 0 || _deleting ? null : _deleteSelectedVideos,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                gradient: count == 0 || _deleting
                    ? null
                    : LinearGradient(
                        colors: [
                          AppColors.errorRed.withValues(alpha: 0.95),
                          AppColors.orange.withValues(alpha: 0.95),
                        ],
                      ),
                color: count == 0 || _deleting ? AppColors.inputBorder : null,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _deleting ? 'Deleting...' : 'Delete',
                style: TextStyle(
                  color: count == 0 || _deleting
                      ? AppColors.hintText
                      : AppColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.orange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.lightOrange, size: 12),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.lightOrange,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
