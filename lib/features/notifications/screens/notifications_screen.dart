import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/notification_item.dart';
import '../services/notification_inbox_service.dart';
import '../../../core/widgets/marquee_ticker_widget.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with SingleTickerProviderStateMixin {
  String _scope = 'inbox';
  String _category = 'All';
  bool _unreadOnly = false;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  int _unreadCount = 0;
  List<NotificationItem> _notifications = [];
  final List<String> _selectedIds = [];
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  static const List<String> _categories = ['All', 'Channels', 'Wallet', 'System'];

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
        _selectedIds.removeWhere(
          (id) => !_notifications.any((item) => item.id == id),
        );
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

  /// Client-side grouping over the real `type`/`source` fields — purely a
  /// display filter layered on top of the real inbox/archived scope from
  /// the backend, matching the Channels/Wallet/System split from the design.
  String _categoryOf(NotificationItem item) {
    final key = '${item.type} ${item.source ?? ''}'.toLowerCase();
    if (key.contains('wallet') ||
        key.contains('reward') ||
        key.contains('vpt') ||
        key.contains('gift') ||
        key.contains('withdraw') ||
        key.contains('payout') ||
        key.contains('subscription')) {
      return 'Wallet';
    }
    if (key.contains('creator_live') ||
        key.contains('channel') ||
        key.contains('wave') ||
        key.contains('live') ||
        key.contains('reminder')) {
      return 'Channels';
    }
    return 'System';
  }

  ({IconData icon, Color tint}) _visualsFor(NotificationItem item) {
    switch (_categoryOf(item)) {
      case 'Wallet':
        return (icon: Icons.account_balance_wallet_rounded, tint: const Color(0xFF5FD39A));
      case 'Channels':
        return (icon: Icons.podcasts_rounded, tint: const Color(0xFFF1789A));
      default:
        return (icon: Icons.info_rounded, tint: AppColors.softBlue);
    }
  }

  List<NotificationItem> get _visibleNotifications {
    if (_category == 'All') return _notifications;
    return _notifications.where((n) => _categoryOf(n) == _category).toList();
  }

  bool get _allVisibleSelected =>
      _visibleNotifications.isNotEmpty &&
      _visibleNotifications.every((item) => _selectedIds.contains(item.id));

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
        _selectedIds.removeWhere((id) => _visibleNotifications.any((n) => n.id == id));
      } else {
        for (final n in _visibleNotifications) {
          if (!_selectedIds.contains(n.id)) _selectedIds.add(n.id);
        }
      }
    });
  }

  String _formatTimestamp(int value) {
    final date = DateTime.fromMillisecondsSinceEpoch(value);
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${date.day}/${date.month}/${date.year}';
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
        ids: List.of(_selectedIds),
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
      Navigator.pushNamed(context, '/channel-view', arguments: channelId);
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
    final visible = _visibleNotifications;
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              const MarqueeTickerWidget(),
              _buildCategoryTabs(),
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
                              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                              children: [
                                _buildToolbar(),
                                const SizedBox(height: 14),
                                if (_selectedIds.isNotEmpty) ...[
                                  _buildBulkActions(),
                                  const SizedBox(height: 14),
                                ],
                                if (_error != null) ...[
                                  _buildErrorCard(),
                                  const SizedBox(height: 14),
                                ],
                                if (visible.isEmpty)
                                  _buildEmptyState()
                                else
                                  ...visible.map(_buildNotificationCard),
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
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Notifications',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Your alerts inbox',
                  style: TextStyle(color: AppColors.hintText, fontSize: 12),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: _busy || _unreadCount == 0
                ? null
                : () => _runAction(NotificationInboxService.markAllRead),
            child: Opacity(
              opacity: _busy || _unreadCount == 0 ? 0.4 : 1,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.orange.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.done_all_rounded, color: AppColors.lightOrange, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      _unreadCount > 0 ? 'Mark all read' : 'All read',
                      style: const TextStyle(
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
    );
  }

  Widget _buildCategoryTabs() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: Row(
        children: _categories.map((c) {
          final selected = _category == c;
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: GestureDetector(
              onTap: () => setState(() => _category = c),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                decoration: BoxDecoration(
                  color: selected ? AppColors.orange.withValues(alpha: 0.14) : AppColors.inputFill,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: selected ? AppColors.orange : AppColors.inputBorder,
                  ),
                ),
                child: Text(
                  c,
                  style: TextStyle(
                    color: selected ? AppColors.lightOrange : AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildToolbar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          _ScopeToggle(
            label: 'Inbox',
            selected: _scope == 'inbox',
            onTap: () {
              setState(() => _scope = 'inbox');
              _loadNotifications();
            },
          ),
          const SizedBox(width: 8),
          _ScopeToggle(
            label: 'Archived',
            selected: _scope == 'archived',
            onTap: () {
              setState(() => _scope = 'archived');
              _loadNotifications();
            },
          ),
          const Spacer(),
          GestureDetector(
            onTap: () {
              setState(() => _unreadOnly = !_unreadOnly);
              _loadNotifications();
            },
            child: Row(
              children: [
                Icon(
                  _unreadOnly ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                  color: _unreadOnly ? AppColors.orange : AppColors.hintText,
                  size: 18,
                ),
                const SizedBox(width: 6),
                const Text(
                  'Unread only',
                  style: TextStyle(color: AppColors.white, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          if (_visibleNotifications.isNotEmpty) ...[
            const SizedBox(width: 10),
            GestureDetector(
              onTap: _toggleSelectAll,
              child: Text(
                _allVisibleSelected ? 'Clear' : 'Select all',
                style: const TextStyle(color: AppColors.lightOrange, fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBulkActions() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.orange.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Text(
            '${_selectedIds.length} selected',
            style: const TextStyle(color: AppColors.white, fontSize: 13, fontWeight: FontWeight.w700),
          ),
          const Spacer(),
          Wrap(
            spacing: 8,
            children: [
              _ActionChip(
                label: _scope == 'inbox' ? 'Mark Read' : 'Mark Unread',
                color: AppColors.softBlue,
                onTap: _busy ? null : () => _handleBulkAction(_scope == 'inbox' ? 'read' : 'unread'),
              ),
              _ActionChip(
                label: _scope == 'inbox' ? 'Archive' : 'Unarchive',
                color: AppColors.orange,
                onTap: _busy ? null : () => _handleBulkAction(_scope == 'inbox' ? 'archive' : 'unarchive'),
              ),
              _ActionChip(
                label: 'Delete',
                color: AppColors.errorRed,
                onTap: _busy ? null : () => _handleBulkAction('delete'),
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
                : _category == 'All'
                    ? 'Your notification inbox is clear.'
                    : 'No $_category notifications yet.',
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(NotificationItem item) {
    final visuals = _visualsFor(item);
    final selected = _selectedIds.contains(item.id);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: item.isRead ? AppColors.inputFill : AppColors.orange.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: item.isRead
              ? AppColors.inputBorder
              : AppColors.orange.withValues(alpha: 0.35),
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: _busy ? null : () => _openNotification(item),
        onLongPress: () => _toggleSelection(item.id),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: () => _toggleSelection(item.id),
                    child: Container(
                      width: 20,
                      height: 20,
                      margin: const EdgeInsets.only(right: 10, top: 2),
                      decoration: BoxDecoration(
                        color: selected ? AppColors.orange : Colors.transparent,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: selected ? AppColors.orange : AppColors.inputBorder,
                          width: 1.4,
                        ),
                      ),
                      child: selected
                          ? const Icon(Icons.check_rounded, size: 14, color: AppColors.darkBlue)
                          : null,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: visuals.tint.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(visuals.icon, color: visuals.tint, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                item.title,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            if (!item.isRead)
                              Container(
                                width: 8,
                                height: 8,
                                margin: const EdgeInsets.only(left: 8, top: 4),
                                decoration: const BoxDecoration(
                                  color: AppColors.orange,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.body,
                          style: TextStyle(
                            color: AppColors.white.withValues(alpha: 0.65),
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _formatTimestamp(item.createdAt),
                          style: const TextStyle(
                            color: AppColors.hintText,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
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
        ),
      ),
    );
  }
}

class _ScopeToggle extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ScopeToggle({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.orange : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? AppColors.darkBlue : AppColors.hintText,
            fontSize: 12,
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.28)),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
