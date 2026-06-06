import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../models/channel_library_models.dart';
import '../services/channel_library_service.dart';

class ChannelLibraryItemScreen extends StatefulWidget {
  const ChannelLibraryItemScreen({super.key});

  @override
  State<ChannelLibraryItemScreen> createState() =>
      _ChannelLibraryItemScreenState();
}

class _ChannelLibraryItemScreenState extends State<ChannelLibraryItemScreen>
    with SingleTickerProviderStateMixin {
  String? _channelId;
  String? _itemId;
  bool _argsHandled = false;

  bool _loading = true;
  bool _favoriteLoading = false;
  bool _favorite = false;
  String? _error;

  ChannelLibraryItemDetailModel? _detail;

  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
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
    } else if (args is String) {
      _itemId = args;
    }

    if (_channelId == null || _itemId == null) {
      setState(() {
        _loading = false;
        _error = 'Library item route arguments are missing.';
      });
      return;
    }

    _loadDetail();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDetail() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final detail = await ChannelLibraryService.getItemDetail(
        _channelId!,
        _itemId!,
      );
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _toggleFavorite() async {
    if (_detail == null || _favoriteLoading) return;

    setState(() => _favoriteLoading = true);
    try {
      if (_favorite) {
        await ChannelLibraryService.removeFavorite(_channelId!, _itemId!);
      } else {
        await ChannelLibraryService.addFavorite(_channelId!, _itemId!);
      }
      if (!mounted) return;
      setState(() => _favorite = !_favorite);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _favoriteLoading = false);
    }
  }

  void _openReader() {
    final detail = _detail;
    if (detail == null) return;

    Navigator.pushNamed(
      context,
      '/channel-library/reader',
      arguments: {
        'channelId': _channelId,
        'itemId': _itemId,
        'title': detail.item.title,
        'nextItemId': detail.nextItemId,
      },
    );
  }

  void _openNext() {
    final next = _detail?.nextItemId;
    if (next == null || next.isEmpty) return;
    Navigator.pushReplacementNamed(
      context,
      '/channel-library/item',
      arguments: {'channelId': _channelId, 'itemId': next},
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
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              _detail?.item.title ?? 'Library Item',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 18,
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
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.white),
              ),
              const SizedBox(height: 14),
              ElevatedButton(
                onPressed: _loadDetail,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final detail = _detail;
    if (detail == null) {
      return const Center(
        child: Text(
          'No library detail available.',
          style: TextStyle(color: AppColors.hintText),
        ),
      );
    }

    final item = detail.item;

    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: AspectRatio(
                  aspectRatio: 2 / 3,
                  child:
                      item.coverAssetUrl != null &&
                          item.coverAssetUrl!.isNotEmpty
                      ? Image.network(
                          item.coverAssetUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _coverPlaceholder(),
                        )
                      : _coverPlaceholder(),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                item.title,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                item.author,
                style: const TextStyle(
                  color: AppColors.lightOrange,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _chip('${item.totalPages} pages'),
                  _chip('${item.estimatedReadMinutes} min read'),
                  _chip(item.contentType.toUpperCase()),
                ],
              ),
              if (item.description.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  item.description,
                  style: const TextStyle(
                    color: AppColors.white,
                    height: 1.5,
                    fontSize: 14,
                  ),
                ),
              ],
              if ((item.tags).isNotEmpty) ...[
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: item.tags
                      .map((tag) => _chip('#$tag', subtle: true))
                      .toList(),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _openReader,
                  icon: const Icon(Icons.chrome_reader_mode_outlined),
                  label: Text(
                    detail.progress != null && !detail.progress!.isCompleted
                        ? 'Continue Reading'
                        : 'Read Now',
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _favoriteLoading ? null : _toggleFavorite,
                  icon: Icon(
                    _favorite
                        ? Icons.bookmark_added_rounded
                        : Icons.bookmark_add_outlined,
                  ),
                  label: Text(_favorite ? 'Saved' : 'Save'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: detail.nextItemId == null ? null : _openNext,
                  icon: const Icon(Icons.skip_next_rounded),
                  label: const Text('See Next'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String text, {bool subtle = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: subtle
            ? AppColors.inputFill
            : AppColors.orange.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: subtle
              ? AppColors.inputBorder
              : AppColors.orange.withValues(alpha: 0.28),
        ),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: subtle ? AppColors.hintText : AppColors.lightOrange,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _coverPlaceholder() {
    return Container(
      color: AppColors.cardBg,
      child: const Center(
        child: Icon(
          Icons.menu_book_outlined,
          color: AppColors.hintText,
          size: 42,
        ),
      ),
    );
  }
}
