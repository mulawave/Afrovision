import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../models/channel_library_models.dart';
import '../services/channel_library_service.dart';

const Color _readerScaffoldBg = Color(0xFF08091A);
const Color _readerReadingBg = Color(0xFF0E0A04);
const Color _readerToastBg = Color(0xFF0C0D22);
const Color _readerBorder = Color(0x12FFFFFF);
const Duration _readerFadeDuration = Duration(milliseconds: 200);
const double _readerZoomMin = 0.4;
const double _readerZoomMax = 3.0;
const double _readerTapEdgeRatio = 0.28;

class ChannelLibraryReaderScreen extends StatefulWidget {
  const ChannelLibraryReaderScreen({super.key});

  @override
  State<ChannelLibraryReaderScreen> createState() =>
      _ChannelLibraryReaderScreenState();
}

class _ChannelLibraryReaderScreenState
    extends State<ChannelLibraryReaderScreen> {
  String? _channelId;
  String? _itemId;
  String _title = 'Reader';
  String? _nextItemId;
  bool _argsHandled = false;

  bool _loading = true;
  String? _error;
  bool _saving = false;
  bool _bookmarksPanelOpen = false;

  List<ChannelLibraryManifestPage> _pages = <ChannelLibraryManifestPage>[];
  List<ChannelLibraryBookmarkModel> _bookmarks = <ChannelLibraryBookmarkModel>[];
  int _currentPageIndex = 0;
  double _zoom = 1.0;

  final PageController _pageController = PageController();
  final TransformationController _zoomController = TransformationController();

  @override
  void initState() {
    super.initState();
    _zoomController.addListener(_syncZoomFromController);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_argsHandled) return;
    _argsHandled = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map) {
      _channelId = args['channelId']?.toString();
      _itemId = args['itemId']?.toString();
      _title = args['title']?.toString() ?? 'Reader';
      _nextItemId = args['nextItemId']?.toString();
    }

    if (_channelId == null || _itemId == null) {
      setState(() {
        _loading = false;
        _error = 'Reader parameters are missing.';
      });
      return;
    }

    _loadReader();
  }

  @override
  void dispose() {
    _zoomController.removeListener(_syncZoomFromController);
    _zoomController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _syncZoomFromController() {
    final matrix = _zoomController.value;
    final storage = matrix.storage;
    final nextZoom = storage.isNotEmpty
        ? storage[0].clamp(_readerZoomMin, _readerZoomMax).toDouble()
        : 1.0;

    if ((nextZoom - _zoom).abs() < 0.01) {
      return;
    }

    if (!mounted) return;
    setState(() => _zoom = nextZoom);
  }

  void _setZoom(double value) {
    final nextZoom = value.clamp(_readerZoomMin, _readerZoomMax).toDouble();
    _zoomController.value = Matrix4.diagonal3Values(nextZoom, nextZoom, 1.0);
    if ((nextZoom - _zoom).abs() < 0.01) return;
    setState(() => _zoom = nextZoom);
  }

  void _resetZoom() => _setZoom(1.0);

  Future<void> _loadReader() async {
    final channelId = _channelId!;
    final itemId = _itemId!;

    setState(() {
      _loading = true;
      _error = null;
      _bookmarksPanelOpen = false;
    });

    try {
      final futures = await Future.wait<dynamic>([
        ChannelLibraryService.getReaderManifest(channelId, itemId),
        ChannelLibraryService.getProgress(channelId, itemId).catchError((_) {
          return const ChannelLibraryProgressModel(
            currentSpreadIndex: 0,
            currentPageLeft: null,
            currentPageRight: null,
            isCompleted: false,
          );
        }),
        ChannelLibraryService.getBookmarks(channelId, itemId).catchError((_) {
          return <ChannelLibraryBookmarkModel>[];
        }),
      ]);

      final manifest = futures[0] as ChannelLibraryManifestResponse;
      final progress = futures[1] as ChannelLibraryProgressModel;
      final bookmarks = futures[2] as List<ChannelLibraryBookmarkModel>;

      final payload = await ChannelLibraryService.fetchManifestPayload(
        manifest.manifestUrl,
      );

      if (!mounted) return;

      final initialPage =
          progress.currentPageRight ?? progress.currentPageLeft ?? 1;
      final initialIndex = payload.pages.indexWhere(
        (page) => page.pageNumber == initialPage,
      );

      setState(() {
        _pages = payload.pages;
        _bookmarks = bookmarks;
        _currentPageIndex = initialIndex >= 0 ? initialIndex : 0;
        _loading = false;
        _error = null;
      });

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _pages.isEmpty) return;
        if (_pageController.hasClients) {
          _pageController.jumpToPage(_currentPageIndex);
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _saveProgress() async {
    if (_channelId == null || _itemId == null || _pages.isEmpty) return;

    setState(() => _saving = true);
    try {
      final pageNumber = _pages[_currentPageIndex].pageNumber;
      await ChannelLibraryService.updateProgress(
        _channelId!,
        _itemId!,
        ChannelLibraryProgressModel(
          currentSpreadIndex: _currentPageIndex,
          currentPageLeft: pageNumber,
          currentPageRight: pageNumber,
          isCompleted: _currentPageIndex >= _pages.length - 1,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _addBookmark() async {
    if (_channelId == null || _itemId == null || _pages.isEmpty) return;

    final pageNumber = _pages[_currentPageIndex].pageNumber;
    await ChannelLibraryService.addBookmark(
      _channelId!,
      _itemId!,
      spreadIndex: _currentPageIndex,
      page: pageNumber,
    );

    final bookmarks = await ChannelLibraryService.getBookmarks(
      _channelId!,
      _itemId!,
    );

    if (!mounted) return;
    setState(() => _bookmarks = bookmarks);
    _showToast('Bookmark saved');
  }

  Future<void> _deleteBookmark(ChannelLibraryBookmarkModel bookmark) async {
    if (_channelId == null || _itemId == null) return;

    await ChannelLibraryService.deleteBookmark(
      _channelId!,
      _itemId!,
      bookmark.id,
    );

    final bookmarks = await ChannelLibraryService.getBookmarks(
      _channelId!,
      _itemId!,
    );

    if (!mounted) return;
    setState(() => _bookmarks = bookmarks);
  }

  void _jumpToBookmark(ChannelLibraryBookmarkModel bookmark) {
    final pageNumber = bookmark.page;
    if (pageNumber == null) return;

    final index = _pages.indexWhere((page) => page.pageNumber == pageNumber);
    if (index < 0) return;

    setState(() => _bookmarksPanelOpen = false);
    _pageController.jumpToPage(index);
  }

  void _showToast(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.transparent,
          elevation: 0,
          margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          padding: EdgeInsets.zero,
          duration: const Duration(seconds: 2),
          content: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: BoxDecoration(
              color: _readerToastBg,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.35),
              ),
            ),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.lightOrange,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      );
  }

  void _toggleBookmarksPanel() {
    setState(() => _bookmarksPanelOpen = !_bookmarksPanelOpen);
  }

  Future<void> _handleCompletion() async {
    final nextItemId = _nextItemId;
    if (nextItemId != null && nextItemId.isNotEmpty && _channelId != null) {
      _showToast('Up next…');
      if (!mounted) return;
      Navigator.pushReplacementNamed(
        context,
        '/channel-library/item',
        arguments: {'channelId': _channelId, 'itemId': nextItemId},
      );
      return;
    }

    _showToast('End of item');

    if (_channelId == null) return;

    List<ChannelLibraryItemModel> recommendations;
    try {
      recommendations = await ChannelLibraryService.getRecommendations(
        _channelId!,
        limit: 6,
      );
    } catch (_) {
      recommendations = const <ChannelLibraryItemModel>[];
    }

    if (!mounted) return;
    final result = await _showCompletionDialog(recommendations);
    if (!mounted) return;

    if (result is ChannelLibraryItemModel) {
      Navigator.pushReplacementNamed(
        context,
        '/channel-library/item',
        arguments: {'channelId': _channelId, 'itemId': result.id},
      );
      return;
    }

    if (result == true) {
      Navigator.pop(context);
    }
  }

  Future<Object?> _showCompletionDialog(
    List<ChannelLibraryItemModel> recommendations,
  ) {
    if (!mounted) return Future<Object?>.value(null);

    return showGeneralDialog<Object?>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Completion',
      barrierColor: Colors.black.withValues(alpha: 0.72),
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (dialogContext, animation, secondaryAnimation) {
        return Center(
          child: Material(
            color: Colors.transparent,
            child: Container(
              width: MediaQuery.of(dialogContext).size.width * 0.92,
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
              decoration: BoxDecoration(
                color: _readerScaffoldBg,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: _readerBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.55),
                    blurRadius: 30,
                    offset: const Offset(0, 16),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 46,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      '🎉',
                      style: TextStyle(fontSize: 34),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'You finished this item!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Pick another issue to keep reading.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.hintText,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                    if (recommendations.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: recommendations.length > 4
                            ? 4
                            : recommendations.length,
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 0.94,
                        ),
                        itemBuilder: (context, index) {
                          final recommendation = recommendations[index];
                          return InkWell(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () {
                              Navigator.pop(dialogContext, recommendation);
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.03),
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: _readerBorder),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.04),
                                        borderRadius: const BorderRadius.only(
                                          topLeft: Radius.circular(18),
                                          topRight: Radius.circular(18),
                                        ),
                                      ),
                                      child: ClipRRect(
                                        borderRadius: const BorderRadius.only(
                                          topLeft: Radius.circular(18),
                                          topRight: Radius.circular(18),
                                        ),
                                        child: recommendation.coverAssetUrl == null
                                            ? Center(
                                                child: Icon(
                                                  Icons.auto_stories_rounded,
                                                  color: AppColors.orange
                                                      .withValues(alpha: 0.65),
                                                  size: 28,
                                                ),
                                              )
                                            : Image.network(
                                                recommendation.coverAssetUrl!,
                                                fit: BoxFit.cover,
                                                width: double.infinity,
                                                height: double.infinity,
                                                errorBuilder: (
                                                  context,
                                                  error,
                                                  stackTrace,
                                                ) {
                                                  return Center(
                                                    child: Icon(
                                                      Icons.auto_stories_rounded,
                                                      color: AppColors.orange
                                                          .withValues(alpha: 0.65),
                                                      size: 28,
                                                    ),
                                                  );
                                                },
                                              ),
                                      ),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(10),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          recommendation.title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: AppColors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          recommendation.author,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: AppColors.lightOrange,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(dialogContext, false),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: BorderSide(
                                color: Colors.white.withValues(alpha: 0.12),
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                            child: const Text(
                              'Keep Reading',
                              style: TextStyle(
                                color: AppColors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: AppColors.buttonGradient,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                borderRadius: BorderRadius.circular(18),
                                onTap: () => Navigator.pop(dialogContext, true),
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 14),
                                  child: Center(
                                    child: Text(
                                      'Back to Channel',
                                      style: TextStyle(
                                        color: Color(0xFF050A30),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
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
            ),
          ),
        );
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        final scale = Tween<double>(begin: 0.96, end: 1.0).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        );
        return FadeTransition(
          opacity: animation,
          child: ScaleTransition(scale: scale, child: child),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final panelWidth =
        (MediaQuery.of(context).size.width * 0.88).clamp(280.0, 360.0).toDouble();

    return Scaffold(
      backgroundColor: _readerScaffoldBg,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        color: _readerScaffoldBg,
        child: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              Column(
                children: [
                  _buildTopBar(),
                  Expanded(child: _buildBody()),
                  if (!_loading && _error == null && _pages.isNotEmpty)
                    _buildBottomBar(),
                ],
              ),
              if (_bookmarksPanelOpen) ...[
                Positioned.fill(
                  child: GestureDetector(
                    onTap: () => setState(() => _bookmarksPanelOpen = false),
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.45),
                    ),
                  ),
                ),
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOutCubic,
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: panelWidth,
                  child: _buildBookmarksPanel(),
                ),
              ] else
                Positioned(
                  top: 0,
                  bottom: 0,
                  right: -panelWidth,
                  width: panelWidth,
                  child: IgnorePointer(
                    child: _buildBookmarksPanel(),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    final pageBadge = _pages.isEmpty
        ? '-- / --'
        : '${_currentPageIndex + 1} / ${_pages.length}';

    return Container(
      decoration: const BoxDecoration(
        color: _readerScaffoldBg,
        border: Border(bottom: BorderSide(color: _readerBorder)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      child: Row(
        children: [
          _TopPillButton(
            onTap: () => Navigator.pop(context),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.chevron_left_rounded,
                  color: AppColors.lightOrange,
                  size: 16,
                ),
                SizedBox(width: 1),
                Text(
                  'Back',
                  style: TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 8),
          _PageBadge(label: pageBadge),
          const SizedBox(width: 8),
          _ZoomControls(
            zoom: _zoom,
            onZoomOut: _zoom > _readerZoomMin ? () => _setZoom(_zoom - 0.2) : null,
            onReset: _resetZoom,
            onZoomIn: _zoom < _readerZoomMax ? () => _setZoom(_zoom + 0.2) : null,
          ),
          const SizedBox(width: 6),
          _TopIconButton(
            onTap: _addBookmark,
            child: const Icon(
              Icons.bookmark_add_outlined,
              color: AppColors.lightOrange,
              size: 18,
            ),
          ),
          const SizedBox(width: 4),
          _TopIconButton(
            onTap: _saving ? null : _saveProgress,
            child: _saving
                ? SizedBox(
                    width: 15,
                    height: 15,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        AppColors.lightOrange,
                      ),
                    ),
                  )
                : const Icon(
                    Icons.save_outlined,
                    color: AppColors.lightOrange,
                    size: 18,
                  ),
          ),
          const SizedBox(width: 4),
          _BookmarksToggleButton(
            count: _bookmarks.length,
            hasBookmarks: _bookmarks.isNotEmpty,
            open: _bookmarksPanelOpen,
            onTap: _toggleBookmarksPanel,
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
              ),
            ),
            SizedBox(height: 14),
            Text(
              'Opening your book…',
              style: TextStyle(
                color: AppColors.lightOrange,
                fontSize: 13,
              ),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 420),
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: _readerBorder),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  color: AppColors.errorRed,
                  size: 34,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Reader unavailable',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_pages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 420),
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: _readerBorder),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.auto_stories_outlined,
                  color: AppColors.orange.withValues(alpha: 0.8),
                  size: 34,
                ),
                const SizedBox(height: 12),
                const Text(
                  'No readable pages',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'This item does not contain image pages that can be opened in the Flutter reader.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  _title,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.lightOrange.withValues(alpha: 0.72),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (details) => _handleReadingTapUp(details, constraints.maxWidth),
          child: Stack(
            children: [
              Positioned.fill(
                child: Container(color: _readerReadingBg),
              ),
              Positioned.fill(
                child: PageView.builder(
                  controller: _pageController,
                  physics: _zoom > 1.01
                      ? const NeverScrollableScrollPhysics()
                      : const PageScrollPhysics(),
                  onPageChanged: _handlePageChanged,
                  itemCount: _pages.length,
                  itemBuilder: (context, index) {
                    final page = _pages[index];
                    return _buildPageViewPage(page);
                  },
                ),
              ),
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: IgnorePointer(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 12),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Opacity(
                        opacity: _currentPageIndex > 0 ? 0.22 : 0.06,
                        child: const Text(
                          '‹',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 36,
                            fontWeight: FontWeight.w400,
                            height: 1,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                child: IgnorePointer(
                  child: Padding(
                    padding: EdgeInsets.only(right: 12),
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: Opacity(
                        opacity: 0.22,
                        child: Text(
                          '›',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 36,
                            fontWeight: FontWeight.w400,
                            height: 1,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const Positioned(
                left: 0,
                right: 0,
                bottom: 12,
                child: IgnorePointer(
                  child: Center(
                    child: Text(
                      '← swipe or tap edges →',
                      style: TextStyle(
                        color: Colors.white54,
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        height: 1,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPageViewPage(ChannelLibraryManifestPage page) {
    return Container(
      color: _readerReadingBg,
      child: Center(
        child: AnimatedSwitcher(
          duration: _readerFadeDuration,
          switchInCurve: Curves.easeOut,
          switchOutCurve: Curves.easeIn,
          child: InteractiveViewer(
            key: ValueKey<int>(page.pageNumber),
            transformationController: _zoomController,
            minScale: _readerZoomMin,
            maxScale: _readerZoomMax,
            panEnabled: _zoom > 1.01,
            scaleEnabled: true,
            boundaryMargin: EdgeInsets.zero,
            clipBehavior: Clip.none,
            child: SizedBox(
              width: double.infinity,
              height: double.infinity,
              child: Center(
                child: Image.network(
                  page.imageUrl,
                  fit: BoxFit.contain,
                  alignment: Alignment.center,
                  filterQuality: FilterQuality.high,
                  gaplessPlayback: true,
                  loadingBuilder: (context, child, loadingProgress) {
                    if (loadingProgress == null) return child;
                    return SizedBox.expand(
                      child: Center(
                        child: SizedBox(
                          width: 36,
                          height: 36,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.3,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              AppColors.lightOrange.withValues(alpha: 0.9),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                  errorBuilder: (context, error, stackTrace) {
                    return SizedBox.expand(
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.broken_image_outlined,
                              color: AppColors.lightOrange.withValues(alpha: 0.65),
                              size: 28,
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Page failed to load',
                              style: TextStyle(
                                color: Colors.white54,
                                fontSize: 12,
                              ),
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
      ),
    );
  }

  Future<void> _handlePageChanged(int index) async {
    if (index < 0 || index >= _pages.length) return;

    setState(() => _currentPageIndex = index);
    await _saveProgress();
  }

  void _handleReadingTapUp(TapUpDetails details, double width) {
    if (_zoom > 1.01 || _pages.isEmpty) return;

    final x = details.localPosition.dx;
    if (x < width * _readerTapEdgeRatio) {
      _goPrev();
    } else if (x > width * (1 - _readerTapEdgeRatio)) {
      _goNext();
    }
  }

  void _goPrev() {
    if (_currentPageIndex <= 0) return;

    _pageController.previousPage(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  void _goNext() {
    if (_pages.isEmpty) return;

    if (_currentPageIndex < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
      return;
    }

    _handleCompletion();
  }

  Widget _buildBottomBar() {
    final isLastPage = _currentPageIndex >= _pages.length - 1;
    final progress = _pages.isEmpty
        ? 0.0
        : ((_currentPageIndex + 1) / _pages.length).clamp(0.0, 1.0);

    return Container(
      decoration: const BoxDecoration(
        color: _readerScaffoldBg,
        border: Border(top: BorderSide(color: _readerBorder)),
      ),
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 10,
        bottom: 10 + MediaQuery.of(context).padding.bottom,
      ),
      child: Row(
        children: [
          Expanded(
            child: _OutlinedActionButton(
              label: '← Previous',
              onTap: _currentPageIndex > 0 ? _goPrev : null,
              enabled: _currentPageIndex > 0,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Page ${_currentPageIndex + 1} of ${_pages.length}',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    height: 4,
                    width: double.infinity,
                    color: Colors.white.withValues(alpha: 0.1),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: FractionallySizedBox(
                        widthFactor: progress,
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [AppColors.orange, AppColors.lightOrange],
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _GradientActionButton(
              label: isLastPage ? 'Finish ✓' : 'Next →',
              onTap: _goNext,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBookmarksPanel() {
    return Container(
      decoration: BoxDecoration(
        color: _readerScaffoldBg,
        border: Border(
          left: BorderSide(color: Colors.white.withValues(alpha: 0.07)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 24,
            offset: const Offset(-10, 0),
          ),
        ],
      ),
      child: SafeArea(
        top: true,
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Bookmarks',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _addBookmark,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      foregroundColor: AppColors.lightOrange,
                    ),
                    child: const Text(
                      '+ Bookmark',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: 4),
                  _TopIconButton(
                    onTap: () => setState(() => _bookmarksPanelOpen = false),
                    child: const Icon(
                      Icons.close_rounded,
                      color: AppColors.lightOrange,
                      size: 18,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _bookmarks.isEmpty
                    ? Center(
                        child: Text(
                          'No bookmarks yet.',
                          style: TextStyle(
                            color: AppColors.hintText.withValues(alpha: 0.9),
                            fontSize: 13,
                          ),
                        ),
                      )
                    : ListView.separated(
                        itemCount: _bookmarks.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final bookmark = _bookmarks[index];
                          return Container(
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.03),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: _readerBorder),
                            ),
                            child: ListTile(
                              dense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 4,
                              ),
                              onTap: () => _jumpToBookmark(bookmark),
                              title: Text(
                                'Page ${bookmark.page ?? '-'}',
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                'Spread ${bookmark.spreadIndex + 1}',
                                style: const TextStyle(
                                  color: AppColors.hintText,
                                  fontSize: 12,
                                ),
                              ),
                              trailing: TextButton(
                                onPressed: () => _deleteBookmark(bookmark),
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  foregroundColor: AppColors.errorRed,
                                ),
                                child: const Text(
                                  'Remove',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopPillButton extends StatelessWidget {
  final VoidCallback onTap;
  final Widget child;

  const _TopPillButton({
    required this.onTap,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _readerBorder),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _PageBadge extends StatelessWidget {
  final String label;

  const _PageBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    final parts = label.split(' / ');
    final current = parts.isNotEmpty ? parts.first : '--';
    final total = parts.length > 1 ? parts[1] : '--';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _readerBorder),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: current,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const TextSpan(
              text: ' / ',
              style: TextStyle(
                color: AppColors.lightOrange,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            TextSpan(
              text: total,
              style: const TextStyle(
                color: AppColors.lightOrange,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ZoomControls extends StatelessWidget {
  final double zoom;
  final VoidCallback? onZoomOut;
  final VoidCallback onReset;
  final VoidCallback? onZoomIn;

  const _ZoomControls({
    required this.zoom,
    required this.onZoomOut,
    required this.onReset,
    required this.onZoomIn,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _readerBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ZoomButton(
            icon: Icons.remove_rounded,
            onTap: onZoomOut,
          ),
          _ZoomButton(
            label: '${(zoom * 100).round()}%',
            onTap: onReset,
            width: 42,
          ),
          _ZoomButton(
            icon: Icons.add_rounded,
            onTap: onZoomIn,
          ),
        ],
      ),
    );
  }
}

class _ZoomButton extends StatelessWidget {
  final IconData? icon;
  final String? label;
  final VoidCallback? onTap;
  final double width;

  const _ZoomButton({
    this.icon,
    this.label,
    required this.onTap,
    this.width = 28,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: width,
          height: 28,
          child: Center(
            child: label != null
                ? Text(
                    label!,
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  )
                : Icon(
                    icon,
                    color: AppColors.lightOrange,
                    size: 16,
                  ),
          ),
        ),
      ),
    );
  }
}

class _TopIconButton extends StatelessWidget {
  final VoidCallback? onTap;
  final Widget child;

  const _TopIconButton({
    required this.onTap,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 40,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _readerBorder),
          ),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _BookmarksToggleButton extends StatelessWidget {
  final int count;
  final bool hasBookmarks;
  final bool open;
  final VoidCallback onTap;

  const _BookmarksToggleButton({
    required this.count,
    required this.hasBookmarks,
    required this.open,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 42,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: open ? 0.08 : 0.04),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: open
                  ? AppColors.orange.withValues(alpha: 0.35)
                  : _readerBorder,
            ),
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              const Center(
                child: Icon(
                  Icons.collections_bookmark_outlined,
                  color: AppColors.lightOrange,
                  size: 18,
                ),
              ),
              if (hasBookmarks)
                Positioned(
                  right: 1,
                  top: 1,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 5,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.orange,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '$count',
                      style: const TextStyle(
                        color: Color(0xFF050A30),
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        height: 1,
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
}

class _OutlinedActionButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool enabled;

  const _OutlinedActionButton({
    required this.label,
    required this.onTap,
    required this.enabled,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: enabled ? 0.02 : 0.01),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: enabled
                  ? AppColors.lightOrange.withValues(alpha: 0.35)
                  : Colors.white.withValues(alpha: 0.05),
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: enabled
                    ? AppColors.lightOrange
                    : AppColors.lightOrange.withValues(alpha: 0.35),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GradientActionButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _GradientActionButton({
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: AppColors.buttonGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Center(
              child: Text(
                label,
                style: const TextStyle(
                  color: Color(0xFF050A30),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
