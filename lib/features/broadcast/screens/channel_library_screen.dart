import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../models/channel_library_models.dart';
import '../services/channel_library_service.dart';

class ChannelLibraryScreen extends StatefulWidget {
  const ChannelLibraryScreen({super.key});

  @override
  State<ChannelLibraryScreen> createState() => _ChannelLibraryScreenState();
}

class _ChannelLibraryScreenState extends State<ChannelLibraryScreen>
    with SingleTickerProviderStateMixin {
  String? _channelId;
  bool _argsHandled = false;
  bool _loading = true;
  String? _error;
  List<ChannelLibraryItemModel> _items = <ChannelLibraryItemModel>[];

  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
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
    if (args is String) {
      _channelId = args;
    } else if (args is Map) {
      _channelId = args['channelId']?.toString() ?? args['id']?.toString();
    }

    if (_channelId == null || _channelId!.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'No channel was provided.';
      });
      return;
    }

    _loadItems();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadItems() async {
    if (_channelId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await ChannelLibraryService.getChannelLibrary(
        _channelId!,
      );
      if (!mounted) return;
      setState(() {
        _items = response.items;
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

  void _openItem(ChannelLibraryItemModel item) {
    if (_channelId == null) return;
    Navigator.pushNamed(
      context,
      '/channel-library/item',
      arguments: {'channelId': _channelId, 'itemId': item.id},
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
          const SizedBox(width: 16),
          const Expanded(
            child: Text(
              'Exclusive Library',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              _loading ? '--' : '${_items.length}',
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
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.white),
              ),
              const SizedBox(height: 14),
              ElevatedButton(onPressed: _loadItems, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    if (_items.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.menu_book_outlined,
                color: AppColors.hintText,
                size: 44,
              ),
              SizedBox(height: 12),
              Text(
                'No published library items yet.',
                style: TextStyle(color: AppColors.hintText),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: _loadItems,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: SlideTransition(
          position: _slideAnim,
          child: GridView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.64,
            ),
            itemCount: _items.length,
            itemBuilder: (_, index) {
              final item = _items[index];
              return GestureDetector(
                onTap: () => _openItem(item),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(14),
                            topRight: Radius.circular(14),
                          ),
                          child:
                              item.coverAssetUrl != null &&
                                  item.coverAssetUrl!.isNotEmpty
                              ? Image.network(
                                  item.coverAssetUrl!,
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) =>
                                      _coverPlaceholder(),
                                )
                              : _coverPlaceholder(),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.author,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.lightOrange,
                                fontSize: 11,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${item.totalPages} pages · ${item.estimatedReadMinutes}m',
                              style: const TextStyle(
                                color: AppColors.hintText,
                                fontSize: 10,
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
        ),
      ),
    );
  }

  Widget _coverPlaceholder() {
    return Container(
      width: double.infinity,
      color: AppColors.cardBg,
      child: const Center(
        child: Icon(
          Icons.menu_book_rounded,
          color: AppColors.hintText,
          size: 32,
        ),
      ),
    );
  }
}
