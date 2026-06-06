import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../services/announcement_service.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<Announcement> _announcements = [];
  bool _loading = true;
  bool _loadingMore = false;
  final int _pageSize = 10;
  bool _hasMore = true;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadAnnouncements();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadMoreAnnouncements();
    }
  }

  Future<void> _loadAnnouncements() async {
    setState(() {
      _loading = true;
      _hasMore = true;
    });

    try {
      final announcements = await AnnouncementService.getAllAnnouncements();
      if (mounted) {
        setState(() {
          _announcements = announcements;
          _loading = false;
          _hasMore = announcements.length >= _pageSize;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadMoreAnnouncements() async {
    if (_loadingMore || !_hasMore) return;

    setState(() {
      _loadingMore = true;
    });

    try {
      // For now, we'll just load all announcements since the API doesn't support pagination yet
      // In the future, we can add pagination to the backend API
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) {
        setState(() {
          _loadingMore = false;
          _hasMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingMore = false;
        });
      }
    }
  }

  IconData _getIconForString(String iconName) {
    switch (iconName) {
      case 'campaign':
        return Icons.campaign_rounded;
      case 'celebration':
        return Icons.celebration_rounded;
      case 'verified':
        return Icons.verified_rounded;
      case 'shield':
        return Icons.shield_rounded;
      case 'info':
        return Icons.info_rounded;
      case 'warning':
        return Icons.warning_rounded;
      case 'error':
        return Icons.error_rounded;
      case 'star':
        return Icons.star_rounded;
      case 'check_circle':
        return Icons.check_circle_rounded;
      default:
        return Icons.campaign_rounded;
    }
  }

  Color _getColorFromString(String colorString) {
    try {
      return Color(int.parse(colorString.replaceAll('#', '0xFF')));
    } catch (_) {
      return AppColors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      appBar: AppBar(
        backgroundColor: AppColors.darkBlue,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Updates & Announcements',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.orange),
            )
          : _announcements.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.campaign_rounded,
                        size: 64,
                        color: AppColors.hintText,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'No updates yet',
                        style: TextStyle(
                          color: AppColors.hintText,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadAnnouncements,
                  color: AppColors.orange,
                  backgroundColor: AppColors.inputFill,
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(20),
                    itemCount: _announcements.length + (_hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _announcements.length) {
                        return _loadingMore
                            ? const Padding(
                                padding: EdgeInsets.all(20),
                                child: Center(
                                  child: CircularProgressIndicator(color: AppColors.orange),
                                ),
                              )
                            : const SizedBox.shrink();
                      }

                      final announcement = _announcements[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.inputBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: _getColorFromString(announcement.color)
                                        .withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    _getIconForString(announcement.icon),
                                    color: _getColorFromString(announcement.color),
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        announcement.title,
                                        style: const TextStyle(
                                          color: AppColors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _formatDate(announcement.createdAt),
                                        style: const TextStyle(
                                          color: AppColors.hintText,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (announcement.priority != 'normal')
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: announcement.priority == 'urgent'
                                          ? Colors.red.withValues(alpha: 0.2)
                                          : Colors.amber.withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      announcement.priority.toUpperCase(),
                                      style: TextStyle(
                                        color: announcement.priority == 'urgent'
                                            ? Colors.red.shade300
                                            : Colors.amber.shade300,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              announcement.body,
                              style: const TextStyle(
                                color: AppColors.lightOrange,
                                fontSize: 14,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  String _formatDate(String dateString) {
    try {
      final date = DateTime.parse(dateString);
      return '${date.day}/${date.month}/${date.year}';
    } catch (_) {
      return dateString;
    }
  }
}
