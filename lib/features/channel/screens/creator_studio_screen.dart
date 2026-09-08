import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/services/auth_service.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';

class CreatorStudioScreen extends StatefulWidget {
  const CreatorStudioScreen({super.key});

  @override
  State<CreatorStudioScreen> createState() => _CreatorStudioScreenState();
}

class _CreatorStudioScreenState extends State<CreatorStudioScreen>
    with SingleTickerProviderStateMixin {
  List<ChannelModel> _channels = [];
  bool _loading = true;
  String? _error;
  String? _togglingId;
  bool _creatorPlanActive = true;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    KycGuard.enforceOnEntry(context);
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _checkPlanAndLoad();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _checkPlanAndLoad() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = await AuthService.getCurrentUser();
      if (!mounted) return;
      if (!user.hasCreatorPlan) {
        setState(() {
          _creatorPlanActive = false;
          _loading = false;
        });
        return;
      }
      setState(() => _creatorPlanActive = true);
    } catch (_) {
      // If plan check fails, proceed anyway so creators aren't locked out by a network hiccup
    }
    await _loadChannels();
  }

  Future<void> _loadChannels() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final channels = await ChannelService.getMyChannels();
      if (!mounted) return;
      setState(() {
        _channels = channels;
        _loading = false;
      });
      _animController.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _toggleStatus(ChannelModel channel) async {
    if (_togglingId != null) return;
    setState(() => _togglingId = channel.id);
    try {
      if (channel.isActive) {
        await ChannelService.deleteChannel(channel.id);
      } else {
        await ChannelService.enableChannel(channel.id);
      }
      _loadChannels();
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
    } finally {
      if (mounted) setState(() => _togglingId = null);
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
              const MarqueeTickerWidget(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : !_creatorPlanActive
                    ? _buildPlanExpired()
                    : _error != null
                    ? _buildError()
                    : _channels.isEmpty
                    ? _buildEmpty()
                    : _buildList(),
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
            'Creator Studio',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: () async {
              final result = await Navigator.pushNamed(
                context,
                '/create-channel',
              );
              if (result == true || result == null) _loadChannels();
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

  Widget _buildPlanExpired() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.orange.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.orange.withValues(alpha: 0.3),
                  width: 1.5,
                ),
              ),
              child: const Icon(
                Icons.workspace_premium_rounded,
                color: AppColors.orange,
                size: 38,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Creator Plan Required',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            const Text(
              'Your creator subscription is inactive or has expired.\nRenew to access Creator Studio and manage your channels.',
              style: TextStyle(
                color: AppColors.hintText,
                fontSize: 14,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.orange.withAlpha(70),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await Navigator.pushNamed(context, '/plans');
                    _checkPlanAndLoad();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  icon: const Icon(
                    Icons.refresh_rounded,
                    color: AppColors.darkBlue,
                    size: 20,
                  ),
                  label: const Text(
                    'Renew Creator Plan',
                    style: TextStyle(
                      color: AppColors.darkBlue,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Go back',
                style: TextStyle(color: AppColors.hintText),
              ),
            ),
          ],
        ),
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
              _error ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.6),
                fontSize: 12,
              ),
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

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.video_library_rounded,
            color: AppColors.goldText,
            size: 56,
          ),
          const SizedBox(height: 16),
          Text(
            'No channels created yet',
            style: TextStyle(color: AppColors.goldText, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'Tap + to create your first channel',
            style: TextStyle(color: AppColors.goldText, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildList() {
    return FadeTransition(
      opacity: _fadeAnim,
      child: RefreshIndicator(
        color: AppColors.orange,
        backgroundColor: AppColors.inputFill,
        onRefresh: _loadChannels,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          itemCount: _channels.length,
          itemBuilder: (context, index) => _buildChannelCard(_channels[index]),
        ),
      ),
    );
  }

  Widget _buildChannelCard(ChannelModel channel) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: channel.isActive
              ? AppColors.inputBorder
              : AppColors.errorRed.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: channel.isActive
                      ? AppColors.orange.withValues(alpha: 0.12)
                      : AppColors.goldText,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  channel.isExclusive
                      ? Icons.verified_user_rounded
                      : channel.isPrivate
                      ? Icons.lock_rounded
                      : Icons.live_tv_rounded,
                  color: channel.isActive
                      ? AppColors.orange
                      : AppColors.goldText,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      channel.name,
                      style: TextStyle(
                        color: channel.isActive
                            ? AppColors.white
                            : AppColors.goldText,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _buildMiniTag(
                          channel.isExclusive
                              ? 'Exclusive'
                              : channel.isPrivate
                              ? 'Private'
                              : 'Public',
                          channel.isExclusive
                              ? AppColors.orange
                              : channel.isPrivate
                              ? AppColors.errorRed
                              : const Color(0xFF4CAF50),
                        ),
                        const SizedBox(width: 6),
                        _buildMiniTag(
                          channel.isActive ? 'Active' : 'Disabled',
                          channel.isActive
                              ? const Color(0xFF4CAF50)
                              : AppColors.hintText,
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () {
                            Clipboard.setData(
                              ClipboardData(text: channel.channelNumber),
                            );
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
                          child: Text(
                            '#${channel.channelNumber}',
                            style: TextStyle(
                              color: AppColors.lightOrange.withValues(
                                alpha: 0.8,
                              ),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (channel.isExclusive &&
                        channel.exclusiveMonthlyFeeNgn > 0) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Monthly fee: NGN ${channel.exclusiveMonthlyFeeNgn.toStringAsFixed(0)}',
                        style: TextStyle(
                          color: AppColors.lightOrange.withValues(alpha: 0.85),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Action buttons
          Row(
            children: [
              Expanded(
                child: _buildActionButton(
                  icon: Icons.edit_rounded,
                  label: 'Edit',
                  color: AppColors.orange,
                  onTap: () async {
                    final result = await Navigator.pushNamed(
                      context,
                      '/edit-channel',
                      arguments: channel,
                    );
                    if (result == true) _loadChannels();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildActionButton(
                  icon: channel.isActive
                      ? Icons.pause_circle_rounded
                      : Icons.play_circle_rounded,
                  label: channel.isActive ? 'Disable' : 'Enable',
                  color: channel.isActive
                      ? AppColors.hintText
                      : const Color(0xFF4CAF50),
                  onTap: () => _toggleStatus(channel),
                  isLoading: _togglingId == channel.id,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildActionButton(
                  icon: Icons.visibility_rounded,
                  label: 'Profile',
                  color: AppColors.lightOrange,
                  onTap: () async {
                    final result = await Navigator.pushNamed(
                      context,
                      '/channel-view',
                      arguments: {
                        'channel': channel,
                        'channelId': channel.id,
                        'section': 'waves',
                      },
                    );
                    if (result == true) _loadChannels();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Broadcast actions
          Row(
            children: [
              Expanded(
                child: _buildActionButton(
                  icon: Icons.video_library_rounded,
                  label: 'Library',
                  color: AppColors.orange,
                  onTap: () async {
                    final result = await Navigator.pushNamed(
                      context,
                      '/creator-studio/library',
                      arguments: channel.id,
                    );
                    if (result == true) _loadChannels();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildActionButton(
                  icon: Icons.upload_rounded,
                  label: 'Upload',
                  color: AppColors.lightOrange,
                  onTap: () async {
                    final result = await Navigator.pushNamed(
                      context,
                      '/video-upload',
                      arguments: channel.id,
                    );
                    if (result == true) _loadChannels();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildActionButton(
                  icon: Icons.schedule_rounded,
                  label: 'Schedule',
                  color: AppColors.lightOrange,
                  onTap: () {
                    Navigator.pushNamed(
                      context,
                      '/schedule',
                      arguments: channel.id,
                    );
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _buildActionButton(
                  icon: Icons.bar_chart_rounded,
                  label: 'Analytics',
                  color: const Color(0xFF4CAF50),
                  onTap: () {
                    Navigator.pushNamed(
                      context,
                      '/channel-analytics',
                      arguments: channel,
                    );
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildActionButton(
                  icon: Icons.bolt_rounded,
                  label: 'Create Wave',
                  color: AppColors.lightOrange,
                  onTap: () async {
                    final result = await Navigator.pushNamed(
                      context,
                      '/wave-upload',
                      arguments: channel.id,
                    );
                    if (result == true) _loadChannels();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _buildActionButton(
            icon: Icons.auto_awesome_rounded,
            label: 'AI Video Generator',
            color: const Color(0xFF9C6BFF),
            onTap: () {
              Navigator.pushNamed(context, '/ai-video');
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMiniTag(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
    bool isLoading = false,
  }) {
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: AnimatedOpacity(
        opacity: isLoading ? 0.6 : 1.0,
        duration: const Duration(milliseconds: 200),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (isLoading)
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                  ),
                )
              else
                Icon(icon, color: color, size: 15),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: color,
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
}
