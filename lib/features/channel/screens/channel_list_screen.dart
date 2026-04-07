import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

class ChannelListScreen extends StatefulWidget {
  const ChannelListScreen({super.key});

  @override
  State<ChannelListScreen> createState() => _ChannelListScreenState();
}

class _ChannelListScreenState extends State<ChannelListScreen>
    with SingleTickerProviderStateMixin {
  List<ChannelModel> _channels = [];
  bool _loading = true;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late PageController _pageController;
  int _currentPage = 0;
  static const int _perPage = 5;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _pageController = PageController();
    _loadChannels();
  }

  @override
  void dispose() {
    _animController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadChannels() async {
    try {
      final channels = await ChannelService.getPublicChannels();
      if (!mounted) return;
      setState(() {
        _channels = channels;
        _loading = false;
      });
      _animController.forward();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  int get _totalPages => (_channels.length / _perPage).ceil();

  List<ChannelModel> _pageChannels(int page) {
    final start = page * _perPage;
    final end = (start + _perPage).clamp(0, _channels.length);
    return _channels.sublist(start, end);
  }

  void _openSearch() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SearchModal(
        channels: _channels.where((c) => c.isPublic).toList(),
        onSelect: (channel) async {
          Navigator.pop(context);
          await Navigator.pushNamed(
            context,
            '/channel-player',
            arguments: channel.id,
          );
          _loadChannels();
        },
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
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _channels.isEmpty
                    ? _buildEmpty()
                    : _buildPaginatedList(),
              ),
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
          const Text(
            'Channels',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: _openSearch,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.search_rounded,
                color: AppColors.orange,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: () async {
              await Navigator.pushNamed(context, '/create-channel');
              _loadChannels();
            },
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.add_rounded,
                color: AppColors.orange,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: _loadChannels,
      child: ListView(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.tv_off_rounded,
                    color: AppColors.hintText.withValues(alpha: 0.5),
                    size: 56,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No channels yet',
                    style: TextStyle(
                      color: AppColors.hintText.withValues(alpha: 0.7),
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaginatedList() {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Column(
        children: [
          if (_totalPages > 1)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${_channels.length} channel${_channels.length == 1 ? '' : 's'}',
                    style: TextStyle(
                      color: AppColors.hintText.withValues(alpha: 0.7),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Row(
                    children: List.generate(_totalPages, (i) {
                      final isActive = i == _currentPage;
                      return GestureDetector(
                        onTap: () {
                          _pageController.animateToPage(
                            i,
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          width: isActive ? 24 : 8,
                          height: 8,
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          decoration: BoxDecoration(
                            color: isActive
                                ? AppColors.orange
                                : AppColors.hintText.withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              itemCount: _totalPages,
              onPageChanged: (page) => setState(() => _currentPage = page),
              itemBuilder: (context, pageIndex) {
                final pageItems = _pageChannels(pageIndex);
                return RefreshIndicator(
                  color: AppColors.orange,
                  backgroundColor: AppColors.inputFill,
                  onRefresh: _loadChannels,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 4,
                    ),
                    itemCount: pageItems.length,
                    itemBuilder: (context, index) =>
                        _buildChannelCard(pageItems[index]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChannelCard(ChannelModel channel) {
    final hasBanner = channel.bannerUrl != null;
    final hasLogo = channel.logoUrl != null;

    return GestureDetector(
      onTap: () async {
        await Navigator.pushNamed(
          context,
          '/channel-player',
          arguments: channel.id,
        );
        _loadChannels();
      },
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.lightOrange.withValues(alpha: 0.5),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.lightOrange.withValues(alpha: 0.08),
              blurRadius: 16,
              spreadRadius: 1,
              offset: const Offset(0, 2),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Banner area — reduced height
            SizedBox(
              height: 72,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  hasBanner
                      ? Image.network(
                          '${AppConfig.baseUrl}${channel.bannerUrl}',
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _buildDefaultBanner(),
                        )
                      : _buildDefaultBanner(),
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 36,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            AppColors.inputFill.withValues(alpha: 0.95),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.darkBlue.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: const Color(0xFF4CAF50).withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.public_rounded,
                            size: 9,
                            color: Color(0xFF4CAF50),
                          ),
                          const SizedBox(width: 3),
                          const Text(
                            'PUBLIC',
                            style: TextStyle(
                              color: Color(0xFF4CAF50),
                              fontSize: 8,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Info section — compact
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.inputFill,
                      border: Border.all(
                        color: AppColors.lightOrange.withValues(alpha: 0.5),
                        width: 1.5,
                      ),
                      image: hasLogo
                          ? DecorationImage(
                              image: NetworkImage(
                                '${AppConfig.baseUrl}${channel.logoUrl}',
                              ),
                              fit: BoxFit.cover,
                            )
                          : null,
                      gradient: !hasLogo
                          ? LinearGradient(
                              colors: [
                                AppColors.orange.withValues(alpha: 0.2),
                                AppColors.lightOrange.withValues(alpha: 0.08),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                    ),
                    child: !hasLogo
                        ? const Icon(
                            Icons.live_tv_rounded,
                            color: AppColors.orange,
                            size: 18,
                          )
                        : null,
                  ),
                  const SizedBox(width: 10),
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
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            if (channel.category != null) ...[
                              Flexible(
                                child: Text(
                                  channel.category!,
                                  style: const TextStyle(
                                    color: AppColors.lightOrange,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                ),
                                child: Container(
                                  width: 3,
                                  height: 3,
                                  decoration: BoxDecoration(
                                    color: AppColors.hintText.withValues(
                                      alpha: 0.4,
                                    ),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                            ],
                            Text(
                              '#${channel.channelNumber}',
                              style: TextStyle(
                                color: AppColors.lightOrange.withValues(
                                  alpha: 0.9,
                                ),
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.hintText.withValues(alpha: 0.4),
                    size: 20,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDefaultBanner() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.lightBlue.withValues(alpha: 0.6),
            AppColors.darkBlue.withValues(alpha: 0.9),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Icon(
          Icons.live_tv_rounded,
          color: AppColors.hintText.withValues(alpha: 0.15),
          size: 32,
        ),
      ),
    );
  }
}

// --------------- Search Modal ---------------

class _SearchModal extends StatefulWidget {
  final List<ChannelModel> channels;
  final void Function(ChannelModel) onSelect;

  const _SearchModal({required this.channels, required this.onSelect});

  @override
  State<_SearchModal> createState() => _SearchModalState();
}

class _SearchModalState extends State<_SearchModal> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  List<ChannelModel> _results = [];

  @override
  void initState() {
    super.initState();
    _results = widget.channels.take(5).toList();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onSearch(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      setState(() => _results = widget.channels.take(5).toList());
      return;
    }
    setState(() {
      _results = widget.channels
          .where(
            (ch) =>
                ch.name.toLowerCase().contains(q) ||
                (ch.category?.toLowerCase().contains(q) ?? false) ||
                ch.channelNumber.contains(q),
          )
          .take(10)
          .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.darkBlue,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(top: 12, bottom: 16),
            decoration: BoxDecoration(
              color: AppColors.hintText.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Search field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.orange.withValues(alpha: 0.3),
                ),
              ),
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                onChanged: _onSearch,
                style: const TextStyle(color: AppColors.white, fontSize: 15),
                decoration: InputDecoration(
                  hintText: 'Search channels...',
                  hintStyle: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.5),
                    fontSize: 15,
                  ),
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    color: AppColors.orange,
                    size: 22,
                  ),
                  suffixIcon: _controller.text.isNotEmpty
                      ? GestureDetector(
                          onTap: () {
                            _controller.clear();
                            _onSearch('');
                          },
                          child: Icon(
                            Icons.close_rounded,
                            color: AppColors.hintText.withValues(alpha: 0.5),
                            size: 20,
                          ),
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Label
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                _controller.text.isEmpty ? 'SUGGESTED' : 'RESULTS',
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.5),
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Results
          Expanded(
            child: _results.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.search_off_rounded,
                          color: AppColors.hintText.withValues(alpha: 0.3),
                          size: 40,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'No channels found',
                          style: TextStyle(
                            color: AppColors.hintText.withValues(alpha: 0.5),
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final ch = _results[index];
                      final hasLogo = ch.logoUrl != null;
                      return GestureDetector(
                        onTap: () => widget.onSelect(ch),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.inputFill,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.inputBorder),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.inputFill,
                                  border: Border.all(
                                    color: AppColors.lightOrange.withValues(
                                      alpha: 0.4,
                                    ),
                                  ),
                                  image: hasLogo
                                      ? DecorationImage(
                                          image: NetworkImage(
                                            '${AppConfig.baseUrl}${ch.logoUrl}',
                                          ),
                                          fit: BoxFit.cover,
                                        )
                                      : null,
                                  gradient: !hasLogo
                                      ? LinearGradient(
                                          colors: [
                                            AppColors.orange.withValues(
                                              alpha: 0.15,
                                            ),
                                            AppColors.lightOrange.withValues(
                                              alpha: 0.05,
                                            ),
                                          ],
                                        )
                                      : null,
                                ),
                                child: !hasLogo
                                    ? const Icon(
                                        Icons.live_tv_rounded,
                                        color: AppColors.orange,
                                        size: 16,
                                      )
                                    : null,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      ch.name,
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        if (ch.category != null) ...[
                                          Text(
                                            ch.category!,
                                            style: const TextStyle(
                                              color: AppColors.lightOrange,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                          Padding(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 5,
                                            ),
                                            child: Container(
                                              width: 3,
                                              height: 3,
                                              decoration: BoxDecoration(
                                                color: AppColors.hintText
                                                    .withValues(alpha: 0.4),
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                          ),
                                        ],
                                        Text(
                                          '#${ch.channelNumber}',
                                          style: TextStyle(
                                            color: AppColors.hintText
                                                .withValues(alpha: 0.7),
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.arrow_forward_ios_rounded,
                                color: AppColors.orange,
                                size: 14,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
