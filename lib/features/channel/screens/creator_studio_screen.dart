import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

class CreatorStudioScreen extends StatefulWidget {
  const CreatorStudioScreen({super.key});

  @override
  State<CreatorStudioScreen> createState() => _CreatorStudioScreenState();
}

class _CreatorStudioScreenState extends State<CreatorStudioScreen>
    with SingleTickerProviderStateMixin {
  List<ChannelModel> _channels = [];
  bool _loading = true;
  String? _togglingId;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _loadChannels();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadChannels() async {
    try {
      final channels = await ChannelService.getMyChannels();
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
                  channel.isPrivate
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
                          channel.isPrivate ? 'Private' : 'Public',
                          channel.isPrivate
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
                  label: 'View',
                  color: AppColors.lightOrange,
                  onTap: () async {
                    final result = await Navigator.pushNamed(
                      context,
                      '/channel-player',
                      arguments: channel.id,
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
                  label: 'Videos',
                  color: AppColors.orange,
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
              const SizedBox(width: 8),
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
            ],
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
