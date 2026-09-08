import 'package:flutter/material.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_pagination_controls.dart';
import '../models/channel_library_models.dart';
import '../models/video_model.dart';
import '../services/broadcast_service.dart';
import '../services/channel_library_creator_service.dart';

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
  CreatorLibraryTab _selectedTab = CreatorLibraryTab.watch;
  bool _readablesLoading = false;
  String? _readablesError;
  List<ChannelLibraryItemModel> _readables = [];

  // Pagination state
  static const int _pageLimit = 12;
  int _videosPage = 1;
  int _videosTotalPages = 1;
  int _readablesPage = 1;
  int _readablesTotalPages = 1;

  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    KycGuard.enforceOnEntry(context);
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
      final result = await BroadcastService.getChannelVideos(
        _channelId!,
        page: _videosPage,
        limit: _pageLimit,
      );
      if (!mounted) return;
      setState(() {
        _videos = result.videos;
        _videosTotalPages = result.totalPages ?? 1;
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

  Future<void> _loadReadables() async {
    if (_channelId == null) return;
    setState(() {
      _readablesLoading = true;
      _readablesError = null;
    });

    try {
      final result = await ChannelLibraryCreatorService.getItems(
        _channelId!,
        page: _readablesPage,
        limit: _pageLimit,
      );
      if (!mounted) return;
      setState(() {
        _readables = result.items;
        _readablesTotalPages = result.totalPages ?? 1;
        _readablesLoading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _readablesLoading = false;
        _readablesError = e.toString();
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
    final isReadables = _selectedTab == CreatorLibraryTab.readables;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
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
              if (!isReadables)
                GestureDetector(
                  onTap: _loading || _deleting || _readablesLoading
                      ? null
                      : _toggleSelectionMode,
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
                      _selectionMode
                          ? Icons.close_rounded
                          : Icons.fact_check_rounded,
                      color: _selectionMode
                          ? AppColors.lightOrange
                          : AppColors.white,
                      size: 18,
                    ),
                  ),
                ),
              GestureDetector(
                onTap: _loading || _deleting || _readablesLoading
                    ? null
                    : isReadables
                        ? () async {
                            final created = await Navigator.pushNamed(
                              context,
                              '/creator-studio/library/readable-upload',
                              arguments: _channelId,
                            );
                            if (created == true && mounted) {
                              _loadReadables();
                            }
                          }
                        : () => Navigator.pushNamed(
                            context,
                            '/video-upload',
                            arguments: _channelId,
                          ),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: _loading || _deleting || _readablesLoading
                        ? null
                        : AppColors.buttonGradient,
                    color: _loading || _deleting || _readablesLoading
                        ? AppColors.inputFill
                        : null,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: Text(
                    isReadables ? 'Add Readable' : 'Upload',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildTabToggle(),
        ],
      ),
    );
  }

  Widget _buildTabToggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildTabChip(
              label: 'Watch',
              selected: _selectedTab == CreatorLibraryTab.watch,
              onTap: () {
                if (_selectedTab == CreatorLibraryTab.watch) return;
                setState(() {
                  _selectedTab = CreatorLibraryTab.watch;
                  _videosPage = 1;
                });
              },
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _buildTabChip(
              label: 'Readables',
              selected: _selectedTab == CreatorLibraryTab.readables,
              onTap: () {
                if (_selectedTab == CreatorLibraryTab.readables) return;
                setState(() {
                  _selectedTab = CreatorLibraryTab.readables;
                  _selectionMode = false;
                  _readablesPage = 1;
                });
                if (_readables.isEmpty && !_readablesLoading) {
                  _loadReadables();
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.orange.withValues(alpha: 0.16)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.35)
                : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: selected ? AppColors.lightOrange : AppColors.hintText,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
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
      return _buildErrorState(
        title: 'Creator Library unavailable',
        message: _error!,
        onRetry: _loadVideos,
      );
    }

    if (_selectedTab == CreatorLibraryTab.readables) {
      return _buildReadablesBody();
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
                child: _videos.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(32),
                        children: [
                          const SizedBox(height: 80),
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
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Use Upload to add content to this channel library.',
                            style: TextStyle(
                              color: AppColors.hintText,
                              fontSize: 14,
                            ),
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
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
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
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
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
                                        Text(
                                          video.description.isNotEmpty
                                              ? video.description
                                              : 'No description provided',
                                          style: const TextStyle(
                                            color: AppColors.hintText,
                                            fontSize: 12,
                                            height: 1.4,
                                          ),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 10),
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          children: [
                                            _miniChip(
                                              Icons.schedule_rounded,
                                              _formatDuration(video.duration),
                                            ),
                                            _miniChip(
                                              Icons.calendar_month_rounded,
                                              _formatDate(video.createdAt),
                                            ),
                                          ],
                                        ),
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
        if (_videosTotalPages > 1)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: AppPaginationControls(
              currentPage: _videosPage - 1,
              totalPages: _videosTotalPages,
              onPrevious: _videosPage > 1
                  ? () {
                      setState(() => _videosPage--);
                      _loadVideos();
                    }
                  : null,
              onNext: _videosPage < _videosTotalPages
                  ? () {
                      setState(() => _videosPage++);
                      _loadVideos();
                    }
                  : null,
            ),
          ),
      ],
    );
  }

  Widget _buildReadablesBody() {
    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: _loadReadables,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: SlideTransition(
          position: _slideAnim,
          child: _readablesLoading && _readables.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(20),
                  children: const [
                    SizedBox(height: 90),
                    Center(
                      child: CircularProgressIndicator(
                        valueColor:
                            AlwaysStoppedAnimation<Color>(AppColors.orange),
                      ),
                    ),
                    SizedBox(height: 16),
                    Text(
                      'Loading readables…',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                )
              : _readablesError != null && _readables.isEmpty
                  ? _buildErrorState(
                      title: 'Could not load readables',
                      message: _readablesError!,
                      onRetry: _loadReadables,
                    )
                  : _readables.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                          children: [
                            Container(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.inputFill,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: AppColors.inputBorder),
                              ),
                              child: Column(
                                children: [
                                  const Icon(
                                    Icons.menu_book_rounded,
                                    color: AppColors.lightOrange,
                                    size: 52,
                                  ),
                                  const SizedBox(height: 14),
                                  const Text(
                                    'No readables yet',
                                    style: TextStyle(
                                      color: AppColors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.w700,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Create books, comics, and magazines for your channel.',
                                    style: TextStyle(
                                      color: AppColors.hintText,
                                      fontSize: 13,
                                      height: 1.4,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 16),
                                  AppButton(
                                    label: 'Add Readable',
                                    onPressed: () async {
                                      final created = await Navigator.pushNamed(
                                        context,
                                        '/creator-studio/library/readable-upload',
                                        arguments: _channelId,
                                      );
                                      if (created == true && mounted) {
                                        _loadReadables();
                                      }
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ],
                        )
                      : Column(
                          children: [
                            Expanded(
                              child: ListView.builder(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                                itemCount: _readables.length,
                                itemBuilder: (ctx, index) {
                            final item = _readables[index];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.inputFill,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: AppColors.inputBorder),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: Container(
                                      width: 82,
                                      height: 108,
                                      color: AppColors.cardBg,
                                      child: item.coverAssetUrl != null &&
                                              item.coverAssetUrl!.isNotEmpty
                                          ? Image.network(
                                              item.coverAssetUrl!,
                                              fit: BoxFit.cover,
                                              errorBuilder: (_, __, ___) =>
                                                  const Icon(
                                                    Icons.menu_book_rounded,
                                                    color: AppColors.hintText,
                                                  ),
                                            )
                                          : const Icon(
                                              Icons.menu_book_rounded,
                                              color: AppColors.hintText,
                                            ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                item.title,
                                                style: const TextStyle(
                                                  color: AppColors.white,
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            _statusPill(item.status),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          item.author,
                                          style: const TextStyle(
                                            color: AppColors.lightOrange,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 8),
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          children: [
                                            _miniChip(
                                              Icons.category_rounded,
                                              _contentTypeLabel(item.contentType),
                                            ),
                                            _miniChip(
                                              Icons.auto_stories_rounded,
                                              '${item.totalPages} pages',
                                            ),
                                            if (item.seriesId != null &&
                                                item.seriesId!.isNotEmpty)
                                              _miniChip(
                                                Icons.layers_rounded,
                                                'Series',
                                              ),
                                          ],
                                        ),
                                        if (item.description.isNotEmpty) ...[
                                          const SizedBox(height: 10),
                                          Text(
                                            item.description,
                                            style: const TextStyle(
                                              color: AppColors.hintText,
                                              fontSize: 12,
                                              height: 1.4,
                                            ),
                                            maxLines: 3,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                              ),
                            ),
                            if (_readablesTotalPages > 1)
                              Padding(
                                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                                child: AppPaginationControls(
                                  currentPage: _readablesPage - 1,
                                  totalPages: _readablesTotalPages,
                                  onPrevious: _readablesPage > 1
                                      ? () {
                                          setState(() => _readablesPage--);
                                          _loadReadables();
                                        }
                                      : null,
                                  onNext: _readablesPage < _readablesTotalPages
                                      ? () {
                                          setState(() => _readablesPage++);
                                          _loadReadables();
                                        }
                                      : null,
                                ),
                              ),
                          ],
                        ),
        ),
      ),
    );
  }

  Widget _buildErrorState({
    required String title,
    required String message,
    required Future<void> Function() onRetry,
  }) {
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
              title,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: const TextStyle(color: AppColors.hintText, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            AppButton(label: 'Retry', onPressed: () => onRetry()),
          ],
        ),
      ),
    );
  }

  Widget _statusPill(String status) {
    final color = status.toLowerCase() == 'published'
        ? AppColors.successGreen
        : status.toLowerCase() == 'archived'
            ? AppColors.hintText
            : AppColors.lightOrange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }

  String _contentTypeLabel(String value) {
    switch (value) {
      case 'comic':
        return 'Comic';
      case 'magazine':
        return 'Magazine';
      case 'other':
        return 'Other';
      case 'book':
      default:
        return 'Book';
    }
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

enum CreatorLibraryTab { watch, readables }
