import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/config/app_config.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';
import '../../auth/services/auth_service.dart';
import '../../subscription/models/channel_subscription_model.dart';
import '../../subscription/services/channel_subscription_service.dart';

class ChannelViewScreen extends StatefulWidget {
  const ChannelViewScreen({super.key});

  @override
  State<ChannelViewScreen> createState() => _ChannelViewScreenState();
}

class _ChannelViewScreenState extends State<ChannelViewScreen>
    with SingleTickerProviderStateMixin {
  ChannelModel? _channel;
  bool _loading = true;
  bool _exclusiveBlocked = false;
  String? _blockedChannelId;
  bool _followLoading = false;
  bool _isFollowing = false;
  int _followersCount = 0;

  // Channel subscription state
  bool _subLoading = false;
  ChannelSubscriptionModel? _subscription;

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

      if (channel.isExclusive) {
        try {
          final me = await AuthService.getCurrentUser();
          final isOwner = me.id == channel.ownerId;
          if (!isOwner) {
            final status = await ChannelService.getExclusiveAccessStatus(
              channel.id,
            );
            if (!status.eligibleByKyc || !status.hasActiveEntitlement) {
              if (!mounted) return;
              setState(() {
                _exclusiveBlocked = true;
                _blockedChannelId = channel.id;
                _loading = false;
              });
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted || _blockedChannelId == null) return;
                Navigator.pushReplacementNamed(
                  context,
                  '/exclusive-access',
                  arguments: _blockedChannelId!,
                );
              });
              return;
            }
          }
        } catch (_) {
          if (!mounted) return;
          setState(() {
            _exclusiveBlocked = true;
            _blockedChannelId = channel.id;
            _loading = false;
          });
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || _blockedChannelId == null) return;
            Navigator.pushReplacementNamed(
              context,
              '/exclusive-access',
              arguments: _blockedChannelId!,
            );
          });
          return;
        }
      }

      FollowStatusModel? followStatus;
      try {
        followStatus = await ChannelService.getFollowStatus(channel.ownerId);
      } catch (e) {
        debugPrint('[ChannelView] follow status error: $e');
      }
      // Check channel subscription status
      ChannelSubscriptionModel? sub;
      try {
        final result = await ChannelSubscriptionService.check(id);
        if (result['success'] == true && result['subscription'] != null) {
          sub = result['subscription'] as ChannelSubscriptionModel;
        }
      } catch (e) {
        debugPrint('[ChannelView] subscription check error: $e');
      }
      if (!mounted) return;
      setState(() {
        _exclusiveBlocked = false;
        _blockedChannelId = null;
        _channel = channel;
        _followersCount =
            followStatus?.followersCount ?? channel.followersCount;
        _isFollowing = followStatus?.followed ?? false;
        _subscription = sub;
        _loading = false;
      });
      _animController.forward();
      // Record view for analytics (fire and forget)
      ChannelService.recordView(id).catchError((_) {});
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _toggleSubscription() async {
    final ch = _channel;
    if (ch == null) return;
    setState(() => _subLoading = true);
    try {
      if (_subscription != null && _subscription!.isActive) {
        final result = await ChannelSubscriptionService.cancel(
          _subscription!.id,
        );
        if (!mounted) return;
        if (result['success'] == true) {
          setState(() {
            _subscription = null;
            _subLoading = false;
          });
          _showSnack('Unsubscribed from ${ch.name}');
        } else {
          setState(() => _subLoading = false);
          _showSnack(
            result['error'] as String? ?? 'Failed to unsubscribe',
            isError: true,
          );
        }
      } else {
        final result = await ChannelSubscriptionService.subscribe(ch.id);
        if (!mounted) return;
        if (result['success'] == true) {
          setState(() {
            _subscription = result['subscription'] as ChannelSubscriptionModel?;
            _subLoading = false;
          });
          _showSnack('Subscribed to ${ch.name}!');
        } else {
          setState(() => _subLoading = false);
          _showSnack(
            result['error'] as String? ?? 'Failed to subscribe',
            isError: true,
          );
        }
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _subLoading = false);
      _showSnack('Something went wrong. Please try again.', isError: true);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(color: AppColors.white)),
        backgroundColor: isError
            ? AppColors.errorRed.withValues(alpha: 0.9)
            : const Color(0xFF4CAF50).withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
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
          content: Text(
            e.toString(),
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _followLoading = false);
    }
  }

  Future<void> _watchLive(ChannelModel ch) async {
    if (ch.isExclusive) {
      final granted = await Navigator.pushNamed(
        context,
        '/exclusive-access',
        arguments: ch,
      );
      if (granted != true || !mounted) return;
    }

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

  // ── External stream helpers (AV-STR-006) ──────────────────────────────────

  /// True when the channel is safe to navigate into the player.
  /// Blocked channels still open the player (which shows the error state).
  bool _isStreamPlayable(ChannelModel ch) {
    if (!ch.hasExternalSource) return true;
    return ch.streamStatus != 'invalid' && ch.streamStatus != 'access_denied';
  }

  String _watchLiveLabel(ChannelModel ch) {
    if (!ch.hasExternalSource) return 'Watch Live';
    return switch (ch.streamStatus) {
      'live' => 'Watch Live Now',
      'offline' => 'Stream Offline',
      'invalid' => 'Stream Unavailable',
      'access_denied' => 'Stream Restricted',
      'scheduled' => 'Watch Channel',
      _ => 'Watch Live',
    };
  }

  Widget _buildStreamStatusIndicator(ChannelModel ch) {
    final status = ch.streamStatus;
    if (status == 'unknown') return const SizedBox(height: 6);

    final (color, label, icon) = switch (status) {
      'live' => (AppColors.successGreen, 'LIVE', Icons.fiber_manual_record),
      'valid' => (
        AppColors.infoBlue,
        'STREAM READY',
        Icons.check_circle_rounded,
      ),
      'scheduled' => (
        AppColors.lightOrange,
        'SCHEDULED',
        Icons.schedule_rounded,
      ),
      'offline' => (
        AppColors.errorRed,
        'STREAM OFFLINE',
        Icons.wifi_off_rounded,
      ),
      'invalid' => (
        AppColors.errorRed,
        'STREAM UNAVAILABLE',
        Icons.cancel_rounded,
      ),
      'access_denied' => (
        AppColors.errorRed,
        'ACCESS RESTRICTED',
        Icons.lock_rounded,
      ),
      _ => (AppColors.hintText, 'CHECKING...', Icons.hourglass_empty_rounded),
    };

    final providerLabel = switch (ch.streamSourceMode) {
      'external_youtube' => ' · YouTube',
      'external_hls' => ' · HLS',
      'external_dash' => ' · DASH',
      _ => '',
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 6),
          Text(
            '$label$providerLabel',
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          if (ch.lastCheckedAt != null) ...[
            const Spacer(),
            Text(
              _formatTimeAgo(ch.lastCheckedAt),
              style: TextStyle(color: AppColors.hintText, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTimeAgo(String? isoString) {
    if (isoString == null) return 'Never';
    final diff = DateTime.now().difference(DateTime.parse(isoString));
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
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
          content: Text(
            e.toString(),
            style: const TextStyle(color: AppColors.white),
          ),
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
    if (_exclusiveBlocked) {
      return Scaffold(
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
          child: const Center(
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
            ),
          ),
        ),
      );
    }

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
                      border: Border.all(
                        color: ch.isPremiumChannel
                            ? const Color(0xFFFFD700).withAlpha(120)
                            : AppColors.inputBorder,
                        width: ch.isPremiumChannel ? 1.5 : 1,
                      ),
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
                        ? (ch.isPremiumChannel
                              ? const LinearGradient(
                                  colors: [
                                    Color(0xFFFFD700),
                                    Color(0xFFB8860B),
                                  ],
                                )
                              : LinearGradient(
                                  colors: [
                                    AppColors.orange.withValues(alpha: 0.25),
                                    AppColors.lightOrange.withValues(
                                      alpha: 0.1,
                                    ),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ))
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
                    color: ch.isExclusive
                        ? AppColors.orange.withValues(alpha: 0.12)
                        : ch.isPrivate
                        ? AppColors.errorRed.withValues(alpha: 0.12)
                        : const Color(0xFF4CAF50).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: ch.isExclusive
                          ? AppColors.orange.withValues(alpha: 0.4)
                          : ch.isPrivate
                          ? AppColors.errorRed.withValues(alpha: 0.4)
                          : const Color(0xFF4CAF50).withValues(alpha: 0.4),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        ch.isExclusive
                            ? Icons.verified_user_rounded
                            : ch.isPrivate
                            ? Icons.lock_rounded
                            : Icons.public_rounded,
                        color: ch.isExclusive
                            ? AppColors.orange
                            : ch.isPrivate
                            ? AppColors.errorRed
                            : const Color(0xFF4CAF50),
                        size: 14,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        ch.isExclusive
                            ? 'EXCLUSIVE'
                            : ch.isPrivate
                            ? 'PRIVATE'
                            : 'PUBLIC',
                        style: TextStyle(
                          color: ch.isExclusive
                              ? AppColors.orange
                              : ch.isPrivate
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

                if (ch.isExclusive) ...[
                  _buildInfoCard(
                    icon: Icons.payments_rounded,
                    label: 'Exclusive Monthly Fee',
                    value:
                        'NGN ${ch.exclusiveMonthlyFeeNgn.toStringAsFixed(0)}',
                    valueColor: AppColors.orange,
                  ),
                  const SizedBox(height: 12),
                ],

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
                          content: const Text(
                            'Channel number copied',
                            style: TextStyle(color: AppColors.white),
                          ),
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

                // Subscribe / Unsubscribe button
                GestureDetector(
                  onTap: _subLoading ? null : _toggleSubscription,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      gradient:
                          ch.isPremiumChannel &&
                              !(_subscription != null &&
                                  _subscription!.isActive)
                          ? const LinearGradient(
                              colors: [Color(0xFFFFD700), Color(0xFFB8860B)],
                            )
                          : (_subscription != null && _subscription!.isActive
                                ? LinearGradient(
                                    colors: [
                                      const Color(
                                        0xFF4CAF50,
                                      ).withValues(alpha: 0.25),
                                      const Color(
                                        0xFF4CAF50,
                                      ).withValues(alpha: 0.1),
                                    ],
                                  )
                                : AppColors.buttonGradient),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color:
                              ch.isPremiumChannel &&
                                  !(_subscription != null &&
                                      _subscription!.isActive)
                              ? const Color(0xFFFFD700).withAlpha(80)
                              : AppColors.orange.withValues(alpha: 0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _subLoading
                              ? Icons.hourglass_top
                              : (_subscription != null &&
                                        _subscription!.isActive
                                    ? Icons.favorite_rounded
                                    : Icons.favorite_border_rounded),
                          color:
                              ch.isPremiumChannel &&
                                  !(_subscription != null &&
                                      _subscription!.isActive)
                              ? AppColors.darkBlue
                              : AppColors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _subLoading
                              ? 'Updating...'
                              : (_subscription != null &&
                                        _subscription!.isActive
                                    ? (ch.isPremiumChannel
                                          ? 'Subscribed Premium'
                                          : 'Subscribed')
                                    : (ch.isPremiumChannel
                                          ? 'Subscribe Premium'
                                          : 'Subscribe Free')),
                          style: TextStyle(
                            color:
                                ch.isPremiumChannel &&
                                    !(_subscription != null &&
                                        _subscription!.isActive)
                                ? AppColors.darkBlue
                                : AppColors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // External stream status indicator (AV-STR-006)
                if (ch.hasExternalSource) _buildStreamStatusIndicator(ch),

                // Watch Live button
                GestureDetector(
                  onTap: () => _watchLive(ch),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      gradient: _isStreamPlayable(ch)
                          ? AppColors.buttonGradient
                          : null,
                      color: _isStreamPlayable(ch)
                          ? null
                          : AppColors.inputBorder,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: _isStreamPlayable(ch)
                          ? [
                              BoxShadow(
                                color: AppColors.orange.withValues(alpha: 0.3),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          ch.hasExternalSource &&
                                  (ch.streamStatus == 'offline' ||
                                      ch.streamStatus == 'invalid' ||
                                      ch.streamStatus == 'access_denied')
                              ? Icons.tv_off_rounded
                              : Icons.play_circle_filled,
                          color: _isStreamPlayable(ch)
                              ? AppColors.white
                              : AppColors.hintText,
                          size: 22,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _watchLiveLabel(ch),
                          style: TextStyle(
                            color: _isStreamPlayable(ch)
                                ? AppColors.white
                                : AppColors.hintText,
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
                    color: AppColors.goldText,
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
