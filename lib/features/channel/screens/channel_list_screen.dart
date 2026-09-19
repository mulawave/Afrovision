import '../../../core/ads/pangle_widgets.dart';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../../core/services/floating_player_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';
import '../utils/channels_gate.dart';
import '../../../core/widgets/nocturne_pagination.dart';
import '../widgets/channel_search_sheet.dart';
import '../widgets/channels_header.dart';

class ChannelListScreen extends StatefulWidget {
  const ChannelListScreen({super.key});

  @override
  State<ChannelListScreen> createState() => _ChannelListScreenState();
}

class _ChannelListScreenState extends State<ChannelListScreen>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  List<ChannelModel> _channels = [];
  List<ChannelModel> _filteredChannels = [];
  bool _loading = true;
  String? _channelsError;
  String _selectedCategory = 'All';
  String _selectedSort = 'trend';
  bool _liveDismissed = false;

  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  final ScrollController _scrollController = ScrollController();

  int _page = 1;
  static const int _perPage = 6;

  static const List<String> _categoryNames = [
    'All',
    'Kids',
    'Movie',
    'Comedy',
    'Reality',
    'Documentary',
    'Sports',
    'Music',
  ];

  static const Map<String, String> _sortLabels = {
    'trend': 'Trending',
    'new': 'Newest',
    'az': 'A–Z',
  };

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _loadChannels();
  }

  @override
  void dispose() {
    _animController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadChannels() async {
    setState(() {
      _loading = true;
      _channelsError = null;
    });

    try {
      final channels = await ChannelService.getPublicChannels();
      if (!mounted) return;
      setState(() {
        _channels = channels;
        _channelsError = null;
        _applyFilters();
        _loading = false;
      });
      _animController.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _channelsError =
            'Unable to load channels right now. Please check your connection and retry.';
      });
    }
  }

  void _applyFilters() {
    _filteredChannels = ChannelsGate.filterBrowse(_channels);

    if (_selectedCategory != 'All') {
      _filteredChannels = _filteredChannels
          .where(
            (c) =>
                (c.category ?? '').toLowerCase() ==
                _selectedCategory.toLowerCase(),
          )
          .toList();
    }

    switch (_selectedSort) {
      case 'new':
        _filteredChannels.sort((a, b) {
          final da = DateTime.tryParse(a.createdAt) ?? DateTime(0);
          final db = DateTime.tryParse(b.createdAt) ?? DateTime(0);
          return db.compareTo(da);
        });
      case 'az':
        _filteredChannels.sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
      default:
        _filteredChannels.sort((a, b) => b.viewerCount.compareTo(a.viewerCount));
    }

    _page = 1;
  }

  int get _totalCount => _filteredChannels.length;

  int get _totalPages => max(1, (_totalCount / _perPage).ceil());

  List<ChannelModel> get _pageItems {
    final total = _totalCount;
    if (total == 0) return [];

    final maxPage = _totalPages;
    if (_page > maxPage) _page = maxPage;
    if (_page < 1) _page = 1;

    final start = (_page - 1) * _perPage;
    final end = (start + _perPage).clamp(0, total);
    return _filteredChannels.sublist(start, end);
  }

  String get _pageRange {
    final items = _pageItems;
    if (items.isEmpty) return '';
    final start = (_page - 1) * _perPage + 1;
    final end = start + items.length - 1;
    return '$start–$end of $_totalCount';
  }

  void _goToPage(int target) {
    final maxPage = _totalPages;
    final p = target.clamp(1, maxPage);
    if (p == _page) return;

    setState(() => _page = p);
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  Future<void> _tuneIn(ChannelModel channel) async {
    await Navigator.pushNamed(
      context,
      '/channel-player',
      arguments: channel.id,
    );
    if (!mounted) return;
    _loadChannels();
  }

  Future<void> _visitProfile(ChannelModel channel) async {
    await Navigator.pushNamed(
      context,
      '/channel-view',
      arguments: channel,
    );
    if (!mounted) return;
    _loadChannels();
  }

  void _openSearch() {
    ChannelSearchSheet.show(context, channels: _channels);
  }

  void _openDial() {
    Navigator.pushNamed(context, '/channel-access').then((_) {
      if (mounted) _loadChannels();
    });
  }

  void _openCreate() {
    Navigator.pushNamed(context, '/create-channel').then((_) {
      if (mounted) _loadChannels();
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: Column(
          children: [
            ChannelsHeader(
              title: 'Channels',
              subtitle: '$_totalCount channels on AfroVision',
              onBack: () => Navigator.of(context).maybePop(),
              showSearch: true,
              onSearch: _openSearch,
              showDial: true,
              onDial: _openDial,
              showCreate: true,
              onCreate: _openCreate,
            ),
            _buildLiveBanner(),
            _buildCategoryChips(),
            _buildCountAndSort(),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(color: Nocturne.gold),
                    )
                  : _channelsError != null
                      ? _buildError()
                      : _totalCount == 0
                          ? _buildEmpty()
                          : _buildList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLiveBanner() {
    if (_liveDismissed) return const SizedBox.shrink();

    return ValueListenableBuilder<FloatingSessionSnapshot?>(
      valueListenable: FloatingPlayerService.instance.sessionListenable,
      builder: (context, session, _) {
        if (session == null) return const SizedBox.shrink();

        final name = session.channelName?.trim();
        final liveText = (name != null && name.isNotEmpty)
            ? '$name is live now'
            : 'A channel is live now';

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          padding: const EdgeInsets.fromLTRB(12, 9, 10, 9),
          decoration: BoxDecoration(
            color: Nocturne.surfaceRaised,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Nocturne.borderCard),
          ),
          child: Row(
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: Nocturne.green,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Nocturne.green.withValues(alpha: 0.18),
                      blurRadius: 6,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  liveText,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => FloatingPlayerService.instance.reopenActiveChannel(),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: Nocturne.goldCta,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Text(
                    'Return to Live',
                    style: TextStyle(
                      color: Color(0xFF26170A),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => setState(() => _liveDismissed = true),
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: const Icon(
                    Icons.close_rounded,
                    color: Nocturne.textHint,
                    size: 16,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCategoryChips() {
    return Container(
      margin: const EdgeInsets.fromLTRB(0, 14, 0, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: _categoryNames.map((label) {
              final selected = _selectedCategory == label;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedCategory = label;
                      _applyFilters();
                    });
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? Nocturne.gold.withValues(alpha: 0.13)
                          : Colors.white.withValues(alpha: 0.02),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: selected ? Nocturne.gold : Nocturne.border,
                      ),
                    ),
                    child: Text(
                      label,
                      style: TextStyle(
                        color: selected
                            ? Nocturne.goldLight
                            : Nocturne.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildCountAndSort() {
    final label = _selectedCategory == 'All'
        ? '$_totalCount channels'
        : '$_totalCount in $_selectedCategory';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 11),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 11.5,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Nocturne.border,
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Row(
            children: _sortLabels.entries.map((e) {
              final active = _selectedSort == e.key;
              return GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedSort = e.key;
                    _applyFilters();
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.only(left: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: active
                        ? Nocturne.gold.withValues(alpha: 0.1)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: active ? Nocturne.gold : Nocturne.border,
                    ),
                  ),
                  child: Text(
                    e.value,
                    style: TextStyle(
                      color: active ? Nocturne.goldLight : Nocturne.textFaint,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildList() {
    final items = _pageItems;
    final maxPage = _totalPages;

    return FadeTransition(
      opacity: _fadeAnim,
      child: RefreshIndicator(
        color: Nocturne.gold,
        backgroundColor: Nocturne.surface,
        onRefresh: _loadChannels,
        child: ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.fromLTRB(16, 2, 16, 20),
          itemCount: items.length + (maxPage > 1 ? 1 : 0) + 1,
          itemBuilder: (context, index) {
            if (index < items.length) {
              final channel = items[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 11),
                child: _buildCard(channel),
              );
            }
            if (maxPage > 1 && index == items.length) {
              return _buildPaginator(maxPage);
            }
            return const PangleBigBanner();
          },
        ),
      ),
    );
  }

  Widget _buildCard(ChannelModel channel) {
    return Container(
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Nocturne.borderCard),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Banner
          SizedBox(
            height: 112,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                GestureDetector(
                  onTap: () => _visitProfile(channel),
                  child: _buildBanner(channel),
                ),
                // Live pill
                if (channel.isStreamLive)
                  Positioned(
                    top: 9,
                    left: 9,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Nocturne.red.withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 4,
                            height: 4,
                            decoration: const BoxDecoration(
                              color: Nocturne.text,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'LIVE',
                            style: TextStyle(
                              color: Nocturne.text,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.7,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                // Type pill
                Positioned(
                  top: 9,
                  right: 9,
                  child: _buildTypePill(channel),
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(
              children: [
                GestureDetector(
                  onTap: () => _visitProfile(channel),
                  child: Row(
                    children: [
                      _buildLogo(channel),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              channel.name,
                              style: const TextStyle(
                                color: Nocturne.text,
                                fontSize: 14.5,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                            ),
                            const SizedBox(height: 2),
                            _buildMetaRow(channel),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: Nocturne.textHint,
                        size: 20,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 11),
                Row(
                  children: [
                    Expanded(
                      flex: 12,
                      child: GestureDetector(
                        onTap: () => _tuneIn(channel),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            gradient: Nocturne.goldCta,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.play_circle_fill_rounded,
                                color: Color(0xFF26170A),
                                size: 15,
                              ),
                              SizedBox(width: 7),
                              Text(
                                'Tune In',
                                style: TextStyle(
                                  color: Color(0xFF26170A),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 10,
                      child: GestureDetector(
                        onTap: () => _visitProfile(channel),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.02),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Nocturne.borderStrong),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.person_outline_rounded,
                                color: Nocturne.textDim,
                                size: 14,
                              ),
                              SizedBox(width: 7),
                              Text(
                                'Visit Profile',
                                style: TextStyle(
                                  color: Nocturne.textDim,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypePill(ChannelModel channel) {
    final isPublic = channel.isPublic;
    final icon = isPublic ? Icons.public_rounded : Icons.lock_rounded;
    final label = isPublic ? 'PUBLIC' : 'PRIVATE';
    final bgColor = isPublic
        ? const Color(0xFF2F9E6B).withValues(alpha: 0.9)
        : Nocturne.surface.withValues(alpha: 0.9);
    final fgColor = isPublic ? const Color(0xFFEAF6F3) : Nocturne.textDim;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: fgColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: fgColor,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.7,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBanner(ChannelModel channel) {
    final hasBanner = channel.bannerUrl != null && channel.bannerUrl!.isNotEmpty;
    if (hasBanner) {
      return Image.network(
        AppConfig.mediaUrl(channel.bannerUrl!),
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildFallbackBanner(channel.name),
      );
    }
    return _buildFallbackBanner(channel.name);
  }

  Widget _buildFallbackBanner(String name) {
    final wordmark = _wordmark(name);
    return Container(
      decoration: BoxDecoration(
        gradient: _bannerGradient(name),
      ),
      child: Center(
        child: Text(
          wordmark,
          style: const TextStyle(
            color: Nocturne.text,
            fontSize: 26,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.02,
            shadows: [
              Shadow(
                color: Color(0x73000000),
                blurRadius: 16,
                offset: Offset(0, 2),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogo(ChannelModel channel) {
    final hasLogo = channel.logoUrl != null && channel.logoUrl!.isNotEmpty;
    final mark = _markColor(channel.name);

    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: hasLogo ? null : mark,
        border: Border.all(color: Nocturne.borderStrong),
        image: hasLogo
            ? DecorationImage(
                image: NetworkImage(AppConfig.mediaUrl(channel.logoUrl!)),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: hasLogo
          ? null
          : Center(
              child: Text(
                _initials(channel.name),
                style: const TextStyle(
                  color: Nocturne.text,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
    );
  }

  Widget _buildMetaRow(ChannelModel channel) {
    return Row(
      children: [
        if (channel.ownerName != null && channel.ownerName!.trim().isNotEmpty) ...[
          Flexible(
            child: Text(
              'By ${channel.ownerName!}',
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 10.5,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
          _dot(),
        ],
        if (channel.category != null && channel.category!.isNotEmpty) ...[
          Flexible(
            child: Text(
              channel.category!,
              style: const TextStyle(
                color: Nocturne.goldLight,
                fontSize: 10.5,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
          _dot(),
        ],
        const Icon(
          Icons.people_alt_rounded,
          color: Nocturne.textFaint,
          size: 11,
        ),
        const SizedBox(width: 3),
        Text(
          '${channel.subscriberCount}',
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 10.5,
          ),
        ),
        _dot(),
        Text(
          '#${channel.channelNumber}',
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 10.5,
          ),
        ),
      ],
    );
  }

  Widget _dot() {
    return Container(
      width: 3,
      height: 3,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      decoration: const BoxDecoration(
        color: Nocturne.textHint,
        shape: BoxShape.circle,
      ),
    );
  }

  Widget _buildPaginator(int maxPage) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.borderCard),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _pageRange,
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 10.5,
                ),
              ),
              Text(
                '$_totalCount total',
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 10.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          NocturnePagination(
            currentPage: _page - 1,
            totalPages: maxPage,
            onPrevious: _page > 1 ? () => _goToPage(_page - 1) : null,
            onNext: _page < maxPage ? () => _goToPage(_page + 1) : null,
          ),
          const SizedBox(height: 10),
          const Text(
            '6 channels per page',
            style: TextStyle(
              color: Nocturne.textHint,
              fontSize: 10.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return RefreshIndicator(
      color: Nocturne.gold,
      backgroundColor: Nocturne.surface,
      onRefresh: _loadChannels,
      child: ListView(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.55,
            child: const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.tv_off_rounded,
                    color: Color(0xFF3D4D7D),
                    size: 48,
                  ),
                  SizedBox(height: 16),
                  Text(
                    'No channels in this category',
                    style: TextStyle(
                      color: Nocturne.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Try another category or search by name.',
                    style: TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 11.5,
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

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Nocturne.surfaceRaised,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Nocturne.borderCard),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: Nocturne.gold,
                    size: 40,
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Failed to load channels',
                    style: TextStyle(
                      color: Nocturne.text,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _channelsError ?? '',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 18),
                  GestureDetector(
                    onTap: _loadChannels,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: Nocturne.borderStrong),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text(
                        'Retry',
                        style: TextStyle(
                          color: Nocturne.goldLight,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  LinearGradient _bannerGradient(String name) {
    final gradients = [
      const LinearGradient(
        colors: [Color(0xFF8A2FBE), Color(0xFF3D1266)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      const LinearGradient(
        colors: [Color(0xFF1B63C4), Color(0xFF071C40)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      const LinearGradient(
        colors: [Color(0xFFC0271F), Color(0xFF5E0F0C)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      const LinearGradient(
        colors: [Color(0xFF2F9E6B), Color(0xFF0F3A29)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      const LinearGradient(
        colors: [Color(0xFFC9721F), Color(0xFF4A2708)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      const LinearGradient(
        colors: [Color(0xFF38507F), Color(0xFF111A30)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      const LinearGradient(
        colors: [Color(0xFF7A4A9C), Color(0xFF251432)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      const LinearGradient(
        colors: [Color(0xFFA8306F), Color(0xFF37102A)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ];
    final i = name.hashCode.abs() % gradients.length;
    return gradients[i];
  }

  Color _markColor(String name) {
    final palette = [
      const Color(0xFF8A2FBE),
      const Color(0xFF1B63C4),
      const Color(0xFFC0271F),
      const Color(0xFF2F9E6B),
      const Color(0xFFC9721F),
      const Color(0xFF38507F),
      const Color(0xFF7A4A9C),
      const Color(0xFFA8306F),
    ];
    final i = name.hashCode.abs() % palette.length;
    return palette[i];
  }

  String _wordmark(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts[0].toUpperCase();
    if (parts.length == 2) return parts.map((p) => p.toUpperCase()).join('\n');
    return '${parts[0].toUpperCase()}\n${parts[1].toUpperCase()}';
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return parts[0].take(2).toUpperCase();
    }
    return (parts[0].take(1) + parts[1].take(1)).toUpperCase();
  }
}

extension _StringX on String {
  String take(int n) => length <= n ? this : substring(0, n);
}
