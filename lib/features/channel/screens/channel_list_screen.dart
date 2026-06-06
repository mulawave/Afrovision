import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../../../core/widgets/active_floating_player_banner.dart';
import '../models/channel_model.dart';
import '../models/category_model.dart';
import '../services/channel_service.dart';
import '../../broadcast/widgets/banner_ad_widget.dart';

class ChannelListScreen extends StatefulWidget {
  const ChannelListScreen({super.key});

  @override
  State<ChannelListScreen> createState() => _ChannelListScreenState();
}

class _ChannelListScreenState extends State<ChannelListScreen>
    with SingleTickerProviderStateMixin {
  List<ChannelModel> _channels = [];
  List<ChannelModel> _filteredChannels = [];
  List<CategoryModel> _categories = [];
  bool _loading = true;
  bool _loadingCategories = false;
  bool _categoriesError = false;
  String? _channelsError;
  String _selectedCategory = 'All';
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
    setState(() {
      _loading = true;
      _loadingCategories = true;
      _categoriesError = false;
    });

    try {
      final channels = await ChannelService.getPublicChannels();
      List<CategoryModel> categories = [];
      bool categoriesError = false;

      try {
        categories = await ChannelService.getCategories();
      } catch (_) {
        categoriesError = true;
      }

      if (!mounted) return;
      setState(() {
        _channels = channels;
        _channelsError = null;
        _categories = categories;
        _categoriesError = categoriesError;
        _loadingCategories = false;
        _applyCategoryFilter();
        _loading = false;
      });
      _animController.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingCategories = false;
        _channelsError =
            'Unable to load channels right now. Please check your connection and retry.';
      });
    }
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
    await Navigator.pushNamed(context, '/channel-view', arguments: channel);
    if (!mounted) return;
    _loadChannels();
  }

  void _applyCategoryFilter() {
    if (_selectedCategory == 'All') {
      _filteredChannels = List<ChannelModel>.from(_channels);
    } else {
      _filteredChannels = _channels
          .where(
            (ch) =>
                (ch.category ?? '').toLowerCase() ==
                _selectedCategory.toLowerCase(),
          )
          .toList();
    }

    if (_currentPage != 0) {
      _currentPage = 0;
      if (_pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
    }
  }

  int get _totalPages => (_filteredChannels.length / _perPage).ceil();

  List<ChannelModel> _pageChannels(int page) {
    final start = page * _perPage;
    final end = (start + _perPage).clamp(0, _filteredChannels.length);
    return _filteredChannels.sublist(start, end);
  }

  void _openSearch() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SearchModal(
        channels: _channels.where((c) => c.isPublic || c.isExclusive).toList(),
        onSelect: (channel) async {
          Navigator.pop(context);
          await Navigator.pushNamed(
            context,
            '/channel-view',
            arguments: channel,
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
              const ActiveFloatingPlayerBanner(
                margin: EdgeInsets.fromLTRB(20, 0, 20, 8),
              ),
              const BannerAdWidget(placement: 'page'),
              const SizedBox(height: 8),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _channelsError != null
                    ? _buildChannelsError()
                    : _channels.isEmpty
                    ? _buildEmpty()
                    : _filteredChannels.isEmpty
                    ? _buildEmpty(
                        icon: Icons.filter_list_off_rounded,
                        message: 'No channels in this category',
                      )
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
            onTap: () => Navigator.pushNamed(context, '/channel-access'),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.dialpad_rounded,
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

  Widget _buildChannelsError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.orange,
              size: 48,
            ),
            const SizedBox(height: 16),
            const Text(
              'Failed to load channels',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _channelsError ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.white, fontSize: 12),
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: _loadChannels,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.orange,
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

  Widget _buildEmpty({IconData? icon, String? message}) {
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
                    icon ?? Icons.tv_off_rounded,
                    color: AppColors.goldText,
                    size: 56,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    message ?? 'No channels yet',
                    style: TextStyle(color: AppColors.goldText, fontSize: 16),
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
          _buildCategoryStrip(),
          if (_totalPages > 1)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${_filteredChannels.length} channel${_filteredChannels.length == 1 ? '' : 's'}',
                    style: TextStyle(
                      color: AppColors.goldText,
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
                                : AppColors.goldText,
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

  Widget _buildCategoryStrip() {
    final chips = <String>['All', ..._categories.map((e) => e.name)];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 6),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                'Categories',
                style: TextStyle(
                  color: AppColors.goldText,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (_loadingCategories)
                const SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.orange,
                  ),
                )
              else if (_categoriesError)
                GestureDetector(
                  onTap: _loadChannels,
                  child: Text(
                    'Retry',
                    style: TextStyle(
                      color: AppColors.orange,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: chips.map((label) {
                final selected = _selectedCategory == label;
                return GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedCategory = label;
                      _applyCategoryFilter();
                    });
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.orange.withValues(alpha: 0.2)
                          : AppColors.inputFill,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: selected
                            ? AppColors.orange.withValues(alpha: 0.7)
                            : AppColors.inputBorder,
                      ),
                    ),
                    child: Text(
                      label,
                      style: TextStyle(
                        color: selected
                            ? AppColors.lightOrange
                            : AppColors.goldText,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChannelCard(ChannelModel channel) {
    final hasBanner = channel.bannerUrl != null;
    final hasLogo = channel.logoUrl != null;
    final badgeLabel = channel.isExclusive ? 'EXCLUSIVE' : 'PUBLIC';
    final badgeColor = channel.isExclusive
        ? AppColors.orange
        : AppColors.successGreen;
    final badgeIcon = channel.isExclusive
        ? Icons.verified_user_rounded
        : Icons.public_rounded;

    return Container(
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
                        AppConfig.mediaUrl(channel.bannerUrl!),
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
                        color: badgeColor.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(badgeIcon, size: 9, color: badgeColor),
                        const SizedBox(width: 3),
                        Text(
                          badgeLabel,
                          style: TextStyle(
                            color: badgeColor,
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
                              AppConfig.mediaUrl(channel.logoUrl!),
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
                          if (channel.ownerName != null &&
                              channel.ownerName!.trim().isNotEmpty) ...[
                            Flexible(
                              child: Text(
                                'By ${channel.ownerName!}',
                                style: TextStyle(
                                  color: AppColors.goldText.withValues(
                                    alpha: 0.8,
                                  ),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
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
                                  color: AppColors.goldText,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                          ],
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
                                  color: AppColors.goldText,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.people_alt_rounded,
                            color: AppColors.goldText,
                            size: 11,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            '${channel.followersCount}',
                            style: TextStyle(
                              color: AppColors.goldText,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Container(
                              width: 3,
                              height: 3,
                              decoration: BoxDecoration(
                                color: AppColors.goldText,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
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
                  color: AppColors.goldText,
                  size: 20,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => _tuneIn(channel),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        gradient: AppColors.buttonGradient,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.play_circle_fill_rounded,
                            color: AppColors.white,
                            size: 16,
                          ),
                          SizedBox(width: 6),
                          Text(
                            'Tune In',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () => _visitProfile(channel),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.inputBorder),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.person_outline_rounded,
                            color: AppColors.lightOrange,
                            size: 16,
                          ),
                          SizedBox(width: 6),
                          Text(
                            'Visit Profile',
                            style: TextStyle(
                              color: AppColors.lightOrange,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
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
        child: Icon(Icons.live_tv_rounded, color: AppColors.goldText, size: 32),
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
                (ch.ownerName?.toLowerCase().contains(q) ?? false) ||
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
              color: AppColors.goldText,
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
                  hintStyle: TextStyle(color: AppColors.goldText, fontSize: 15),
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
                            color: AppColors.goldText,
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
                  color: AppColors.goldText,
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
                          color: AppColors.goldText,
                          size: 40,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'No channels found',
                          style: TextStyle(
                            color: AppColors.goldText,
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
                                            AppConfig.mediaUrl(ch.logoUrl!),
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
                                        if (ch.ownerName != null &&
                                            ch.ownerName!
                                                .trim()
                                                .isNotEmpty) ...[
                                          Flexible(
                                            child: Text(
                                              'By ${ch.ownerName!}',
                                              style: TextStyle(
                                                color: AppColors.hintText
                                                    .withValues(alpha: 0.7),
                                                fontSize: 10,
                                              ),
                                              overflow: TextOverflow.ellipsis,
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
                                        const Icon(
                                          Icons.people_alt_rounded,
                                          color: AppColors.goldText,
                                          size: 11,
                                        ),
                                        const SizedBox(width: 3),
                                        Text(
                                          '${ch.followersCount}',
                                          style: TextStyle(
                                            color: AppColors.hintText
                                                .withValues(alpha: 0.7),
                                            fontSize: 11,
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
