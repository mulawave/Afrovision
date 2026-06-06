import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../models/channel_library_models.dart';
import '../services/channel_library_service.dart';

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

  List<ChannelLibraryManifestPage> _pages = <ChannelLibraryManifestPage>[];
  List<ChannelLibraryBookmarkModel> _bookmarks =
      <ChannelLibraryBookmarkModel>[];
  int _currentPageIndex = 0;

  final PageController _pageController = PageController();

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
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadReader() async {
    final channelId = _channelId!;
    final itemId = _itemId!;

    setState(() {
      _loading = true;
      _error = null;
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
      });

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _pages.isEmpty) return;
        _pageController.jumpToPage(_currentPageIndex);
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

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Bookmark saved'),
        behavior: SnackBarBehavior.floating,
      ),
    );
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
    final idx = _pages.indexWhere((page) => page.pageNumber == bookmark.page);
    if (idx < 0) return;
    Navigator.pop(context);
    _pageController.animateToPage(
      idx,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOut,
    );
  }

  void _openBookmarksSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) {
        return Container(
          decoration: const BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.inputBorder,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Bookmarks',
                    style: TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_bookmarks.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'No bookmarks yet.',
                        style: TextStyle(color: AppColors.hintText),
                      ),
                    )
                  else
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: _bookmarks.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, index) {
                          final bookmark = _bookmarks[index];
                          return Container(
                            decoration: BoxDecoration(
                              color: AppColors.inputFill,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.inputBorder),
                            ),
                            child: ListTile(
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
                              trailing: IconButton(
                                onPressed: () => _deleteBookmark(bookmark),
                                icon: const Icon(
                                  Icons.delete_outline_rounded,
                                  color: AppColors.errorRed,
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
      },
    );
  }

  Future<void> _handlePageChanged(int index) async {
    setState(() => _currentPageIndex = index);
    await _saveProgress();
  }

  void _handleNextAction() {
    if (_currentPageIndex < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
      return;
    }

    final nextItemId = _nextItemId;
    if (nextItemId != null && nextItemId.isNotEmpty && _channelId != null) {
      Navigator.pushReplacementNamed(
        context,
        '/channel-library/item',
        arguments: {'channelId': _channelId, 'itemId': nextItemId},
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('You reached the end of this item.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
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
              if (!_loading && _error == null && _pages.isNotEmpty)
                _buildBottomBar(),
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
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _title,
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Text(
              _pages.isEmpty
                  ? '--/--'
                  : '${_currentPageIndex + 1}/${_pages.length}',
              style: const TextStyle(
                color: AppColors.lightOrange,
                fontWeight: FontWeight.w700,
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
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                color: AppColors.errorRed,
                size: 44,
              ),
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: AppColors.white),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadReader,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_pages.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'No readable pages are available for this item.',
            style: TextStyle(color: AppColors.hintText),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return PageView.builder(
      controller: _pageController,
      itemCount: _pages.length,
      onPageChanged: _handlePageChanged,
      itemBuilder: (_, index) {
        final page = _pages[index];
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF7F2E8),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                page.imageUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Center(
                  child: Text(
                    'Failed to load page image',
                    style: TextStyle(color: Colors.black54),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildBottomBar() {
    final isLast = _currentPageIndex >= _pages.length - 1;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        border: Border(top: BorderSide(color: AppColors.inputBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _addBookmark,
              icon: const Icon(Icons.bookmark_add_outlined),
              label: const Text('Bookmark'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _openBookmarksSheet,
              icon: const Icon(Icons.collections_bookmark_outlined),
              label: const Text('Saved'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: _saving ? null : _handleNextAction,
              icon: Icon(
                isLast ? Icons.check_rounded : Icons.arrow_forward_rounded,
              ),
              label: Text(isLast ? 'Finish' : 'Next'),
            ),
          ),
        ],
      ),
    );
  }
}
