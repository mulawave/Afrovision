import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../models/notification_item.dart';
import '../services/notification_inbox_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with SingleTickerProviderStateMixin {
  String _scope = 'inbox';
  bool _unreadOnly = false;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  int _unreadCount = 0;
  List<NotificationItem> _notifications = [];
  List<String> _selectedIds = [];
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _loadNotifications();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await NotificationInboxService.getNotifications(
        scope: _scope,
        unreadOnly: _unreadOnly,
      );
      if (!mounted) return;
      setState(() {
        _notifications = response.notifications;
        _unreadCount = response.unreadCount;
        _selectedIds = _selectedIds
            .where((id) => _notifications.any((item) => item.id == id))
            .toList();
        _loading = false;
      });
      if (!_animController.isCompleted) {
        _animController.forward();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      await _loadNotifications();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  bool get _allVisibleSelected =>
      _notifications.isNotEmpty &&
      _notifications.every((item) => _selectedIds.contains(item.id));

  void _toggleSelection(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  void _toggleSelectAll() {
    setState(() {
      if (_allVisibleSelected) {
        _selectedIds.clear();
      } else {
        _selectedIds = _notifications.map((item) => item.id).toList();
      }
    });
  }

  String _formatTimestamp(int value) {
    final date = DateTime.fromMillisecondsSinceEpoch(value);
    return '${date.day}/${date.month}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _handleNotificationAction(
    String action,
    NotificationItem item,
  ) async {
    await _runAction(() async {
      if (action == 'read') await NotificationInboxService.markRead(item.id);
      if (action == 'unread') {
        await NotificationInboxService.markUnread(item.id);
      }
      if (action == 'archive') {
        await NotificationInboxService.archive(item.id);
      }
      if (action == 'unarchive') {
        await NotificationInboxService.unarchive(item.id);
      }
      if (action == 'delete') {
        await NotificationInboxService.delete(item.id);
      }
    });
  }

  Future<void> _handleBulkAction(String action) async {
    if (_selectedIds.isEmpty) return;
    await _runAction(() async {
      await NotificationInboxService.bulkAction(
        ids: _selectedIds,
        action: action,
      );
      _selectedIds.clear();
    });
  }

  Future<void> _openNotification(NotificationItem item) async {
    if (!item.isRead) {
      await _handleNotificationAction('read', item);
    }
    if (!mounted) return;

    final channelId = item.data['channel_id']?.toString();
    if (item.type == 'creator_live' &&
        channelId != null &&
        channelId.isNotEmpty) {
      Navigator.pushNamed(context, '/channel-player', arguments: channelId);
      return;
    }

    final link = item.link;
    if (link == '/profile') {
      Navigator.pushNamed(context, '/profile');
      return;
    }
    if (link == '/referrals') {
      Navigator.pushNamed(context, '/referral');
      return;
    }
    if (link == '/wallet') {
      Navigator.pushNamed(context, '/digital-assets');
      return;
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
                    : RefreshIndicator(
                        color: AppColors.orange,
                        backgroundColor: AppColors.inputFill,
                        onRefresh: _loadNotifications,
                        child: FadeTransition(
                          opacity: _fadeAnim,
                          child: SlideTransition(
                            position: _slideAnim,
                            child: ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                              children: [
                                _buildHeaderCard(),
                                const SizedBox(height: 16),
                                _buildFilters(),
                                const SizedBox(height: 16),
                                _buildBulkActions(),
                                const SizedBox(height: 16),
                                if (_error != null) _buildErrorCard(),
                                if (_error != null) const SizedBox(height: 16),
                                if (_notifications.isEmpty)
                                  _buildEmptyState()
                                else
                                  ..._notifications.map(_buildNotificationCard),
                              ],
                            ),
                          ),
                        ),
                      ),
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
            onTap: () => Navigator.pop(context, true),
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
              'Notifications',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '$_unreadCount unread',
              style: const TextStyle(
                color: AppColors.lightOrange,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Stay on top of live alerts, wallet updates, and admin messages.',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Unread notifications: $_unreadCount',
            style: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.9),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 16),
          AppButton(
            label: 'Mark All Read',
            onPressed: _busy || _unreadCount == 0
                ? null
                : () => _runAction(NotificationInboxService.markAllRead),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 10,
            children: [
              _FilterChip(
                label: 'Inbox',
                selected: _scope == 'inbox',
                onTap: () {
                  setState(() => _scope = 'inbox');
                  _loadNotifications();
                },
              ),
              _FilterChip(
                label: 'Archived',
                selected: _scope == 'archived',
                onTap: () {
                  setState(() => _scope = 'archived');
                  _loadNotifications();
                },
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Checkbox(
                value: _unreadOnly,
                activeColor: AppColors.orange,
                side: const BorderSide(color: AppColors.inputBorder),
                onChanged: (value) {
                  setState(() => _unreadOnly = value ?? false);
                  _loadNotifications();
                },
              ),
              const Expanded(
                child: Text(
                  'Show unread only',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              TextButton(
                onPressed: _toggleSelectAll,
                child: Text(
                  _allVisibleSelected ? 'Clear Selection' : 'Select All',
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBulkActions() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_selectedIds.length} selected',
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _ActionChip(
                label: _scope == 'inbox' ? 'Mark Read' : 'Mark Unread',
                color: AppColors.softBlue,
                onTap: _selectedIds.isEmpty || _busy
                    ? null
                    : () => _handleBulkAction(
                        _scope == 'inbox' ? 'read' : 'unread',
                      ),
              ),
              _ActionChip(
                label: _scope == 'inbox' ? 'Archive' : 'Unarchive',
                color: AppColors.orange,
                onTap: _selectedIds.isEmpty || _busy
                    ? null
                    : () => _handleBulkAction(
                        _scope == 'inbox' ? 'archive' : 'unarchive',
                      ),
              ),
              _ActionChip(
                label: 'Delete',
                color: AppColors.errorRed,
                onTap: _selectedIds.isEmpty || _busy
                    ? null
                    : () => _handleBulkAction('delete'),
              ),
              if (_scope == 'archived')
                _ActionChip(
                  label: 'Clear Archived',
                  color: AppColors.lightOrange,
                  onTap: _busy
                      ? null
                      : () =>
                            _runAction(NotificationInboxService.clearArchived),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.errorRed.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
      ),
      child: Text(
        _error!,
        style: const TextStyle(
          color: AppColors.errorRed,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.notifications_none_rounded,
              color: AppColors.orange,
              size: 36,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            _scope == 'archived'
                ? 'No archived notifications yet.'
                : 'Your notification inbox is clear.',
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(NotificationItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: item.isRead
              ? AppColors.inputBorder
              : AppColors.orange.withValues(alpha: 0.35),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Checkbox(
                value: _selectedIds.contains(item.id),
                activeColor: AppColors.orange,
                side: const BorderSide(color: AppColors.inputBorder),
                onChanged: (_) => _toggleSelection(item.id),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: BoxDecoration(
                            color: item.isRead
                                ? AppColors.hintText
                                : AppColors.orange,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            item.title,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.body,
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.88),
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _MetaPill(label: _formatTimestamp(item.createdAt)),
                        _MetaPill(label: item.type.replaceAll('_', ' ')),
                        if (item.source != null)
                          _MetaPill(label: item.source!.replaceAll('_', ' ')),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              if (_scope == 'inbox')
                _ActionChip(
                  label: item.isRead ? 'Mark Unread' : 'Mark Read',
                  color: AppColors.softBlue,
                  onTap: _busy
                      ? null
                      : () => _handleNotificationAction(
                          item.isRead ? 'unread' : 'read',
                          item,
                        ),
                ),
              _ActionChip(
                label: item.archived ? 'Unarchive' : 'Archive',
                color: AppColors.orange,
                onTap: _busy
                    ? null
                    : () => _handleNotificationAction(
                        item.archived ? 'unarchive' : 'archive',
                        item,
                      ),
              ),
              if ((item.link != null && item.link!.isNotEmpty) ||
                  item.type == 'creator_live')
                _ActionChip(
                  label: 'Open',
                  color: AppColors.lightOrange,
                  onTap: _busy ? null : () => _openNotification(item),
                ),
              _ActionChip(
                label: 'Delete',
                color: AppColors.errorRed,
                onTap: _busy
                    ? null
                    : () => _handleNotificationAction('delete', item),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.orange : AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppColors.orange : AppColors.inputBorder,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? AppColors.darkBlue : AppColors.white,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const _ActionChip({required this.label, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.45 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.28)),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  final String label;

  const _MetaPill({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.hintText,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
