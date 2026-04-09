import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

class ChannelViewScreen extends StatefulWidget {
  const ChannelViewScreen({super.key});

  @override
  State<ChannelViewScreen> createState() => _ChannelViewScreenState();
}

class _ChannelViewScreenState extends State<ChannelViewScreen>
    with SingleTickerProviderStateMixin {
  ChannelModel? _channel;
  bool _loading = true;
  bool _followLoading = false;
  bool _isFollowing = false;
  int _followersCount = 0;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_channel == null && _loading) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is String) {
        _loadChannel(args);
      } else if (args is ChannelModel) {
        setState(() {
          _channel = args;
          _loading = false;
        });
        _animController.forward();
      }
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadChannel(String id) async {
    try {
      final channel = await ChannelService.getChannelById(id);
      FollowStatusModel? followStatus;
      try {
        followStatus = await ChannelService.getFollowStatus(channel.ownerId);
      } catch (e) {
        debugPrint('[ChannelView] follow status error: $e');
      }
      if (!mounted) return;
      setState(() {
        _channel = channel;
        _followersCount =
            followStatus?.followersCount ?? channel.followersCount;
        _isFollowing = followStatus?.followed ?? false;
        _loading = false;
      });
      _animController.forward();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _toggleFollow() async {
    final ch = _channel;
    if (ch == null) return;
    setState(() => _followLoading = true);
    try {
      final status = _isFollowing
          ? await ChannelService.unfollowCreator(ch.ownerId)
          : await ChannelService.followCreator(ch.ownerId);
      if (!mounted) return;
      setState(() {
        _isFollowing = status.followed;
        _followersCount = status.followersCount;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _followLoading = false);
    }
  }

  Future<void> _watchLive(ChannelModel ch) async {
    if (ch.requiresPayment) {
      final granted = await Navigator.pushNamed(
        context,
        '/premium-stream',
        arguments: ch,
      );
      if (granted != true || !mounted) return;
    }

    if (!mounted) return;
    Navigator.pushNamed(context, '/channel-player', arguments: ch.id);
  }

  Future<void> _deleteChannel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Disable Channel',
          style: TextStyle(color: AppColors.white),
        ),
        content: const Text(
          'This channel will be disabled and hidden.',
          style: TextStyle(color: AppColors.hintText),
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
              'Disable',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || _channel == null) return;

    try {
      await ChannelService.deleteChannel(_channel!.id);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    }
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
                    : _channel == null
                    ? const Center(
                        child: Text(
                          'Channel not found',
                          style: TextStyle(color: AppColors.white),
                        ),
                      )
                    : _buildContent(),
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
          Expanded(
            child: Text(
              _channel?.name ?? 'Channel',
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    final ch = _channel!;
    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: () => _loadChannel(ch.id),
      child: FadeTransition(
        opacity: _fadeAnim,
        child: SlideTransition(
          position: _slideAnim,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 16),
                // Banner
                if (ch.bannerUrl != null)
                  Container(
                    width: double.infinity,
                    height: 140,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.inputBorder),
                      image: DecorationImage(
                        image: NetworkImage(AppConfig.mediaUrl(ch.bannerUrl!)),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                // Channel logo
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: ch.logoUrl == null
                        ? LinearGradient(
                            colors: [
                              AppColors.orange.withValues(alpha: 0.25),
                              AppColors.lightOrange.withValues(alpha: 0.1),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    border: Border.all(
                      color: AppColors.orange.withValues(alpha: 0.4),
                      width: 2,
                    ),
                    image: ch.logoUrl != null
                        ? DecorationImage(
                            image: NetworkImage(
                              AppConfig.mediaUrl(ch.logoUrl!),
                            ),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: ch.logoUrl == null
                      ? Icon(
                          ch.isPrivate
                              ? Icons.lock_rounded
                              : Icons.live_tv_rounded,
                          color: AppColors.orange,
                          size: 36,
                        )
                      : null,
                ),
                const SizedBox(height: 16),
                Text(
                  ch.name,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                // Type badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: ch.isPrivate
                        ? AppColors.errorRed.withValues(alpha: 0.12)
                        : const Color(0xFF4CAF50).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: ch.isPrivate
                          ? AppColors.errorRed.withValues(alpha: 0.4)
                          : const Color(0xFF4CAF50).withValues(alpha: 0.4),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        ch.isPrivate
                            ? Icons.lock_rounded
                            : Icons.public_rounded,
                        color: ch.isPrivate
                            ? AppColors.errorRed
                            : const Color(0xFF4CAF50),
                        size: 14,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        ch.isPrivate ? 'PRIVATE' : 'PUBLIC',
                        style: TextStyle(
                          color: ch.isPrivate
                              ? AppColors.errorRed
                              : const Color(0xFF4CAF50),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Info cards
                _buildInfoCard(
                  icon: Icons.tag_rounded,
                  label: 'Channel Number',
                  value: '#${ch.channelNumber}',
                  valueColor: AppColors.lightOrange,
                  trailing: GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: ch.channelNumber));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: const Text('Channel number copied'),
                          backgroundColor: const Color(
                            0xFF4CAF50,
                          ).withValues(alpha: 0.9),
                          behavior: SnackBarBehavior.floating,
                          duration: const Duration(seconds: 2),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.orange.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.copy_rounded,
                        color: AppColors.orange,
                        size: 16,
                      ),
                    ),
                  ),
                ),
                if (ch.description != null)
                  _buildInfoCard(
                    icon: Icons.description_rounded,
                    label: 'Description',
                    value: ch.description!,
                  ),
                if (ch.category != null)
                  _buildInfoCard(
                    icon: Icons.category_rounded,
                    label: 'Category',
                    value: ch.category!,
                  ),
                if (!ch.isPrivate)
                  _buildInfoCard(
                    icon: Icons.person_rounded,
                    label: 'Creator',
                    value: ch.ownerName ?? 'Unknown',
                  ),
                _buildInfoCard(
                  icon: Icons.people_alt_rounded,
                  label: 'Followers',
                  value: '$_followersCount',
                ),
                if (ch.requiresPayment)
                  _buildInfoCard(
                    icon: Icons.lock_rounded,
                    label: 'Access',
                    value: ch.entryFeeType == 'ngn'
                        ? '₦${ch.entryFeeNgn.toStringAsFixed(0)} · ${ch.accessDurationMinutes}min'
                        : '${ch.entryFeeVptUnits} vPT · ${ch.accessDurationMinutes}min',
                    valueColor: AppColors.lightOrange,
                  ),
                _buildInfoCard(
                  icon: Icons.calendar_today_rounded,
                  label: 'Created',
                  value: _formatDate(ch.createdAt),
                ),

                const SizedBox(height: 24),

                GestureDetector(
                  onTap: _followLoading ? null : _toggleFollow,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      color: _isFollowing
                          ? AppColors.orange.withValues(alpha: 0.12)
                          : AppColors.inputFill,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _isFollowing
                            ? AppColors.orange.withValues(alpha: 0.35)
                            : AppColors.inputBorder,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isFollowing
                              ? Icons.notifications_active_rounded
                              : Icons.notifications_none_rounded,
                          color: _isFollowing
                              ? AppColors.orange
                              : AppColors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _followLoading
                              ? 'Updating...'
                              : _isFollowing
                              ? 'Following'
                              : 'Follow Creator',
                          style: TextStyle(
                            color: _isFollowing
                                ? AppColors.orange
                                : AppColors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Watch Live button
                GestureDetector(
                  onTap: () => _watchLive(ch),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.orange.withValues(alpha: 0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.play_circle_filled,
                          color: AppColors.white,
                          size: 22,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Watch Live',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Delete button (shown always — backend will enforce ownership)
                GestureDetector(
                  onTap: _deleteChannel,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      color: AppColors.errorRed.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: AppColors.errorRed.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.delete_rounded,
                          color: AppColors.errorRed,
                          size: 20,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Disable Channel',
                          style: TextStyle(
                            color: AppColors.errorRed,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
    Widget? trailing,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.orange, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.7),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: TextStyle(
                    color: valueColor ?? AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing],
        ],
      ),
    );
  }

  String _formatDate(String isoDate) {
    final date = DateTime.tryParse(isoDate);
    if (date == null) return isoDate;
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
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}
