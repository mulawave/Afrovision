import '../../../core/api/api_service.dart';
import '../models/notification_item.dart';

class NotificationInboxResponse {
  final List<NotificationItem> notifications;
  final int unreadCount;

  const NotificationInboxResponse({
    required this.notifications,
    required this.unreadCount,
  });
}

class NotificationInboxService {
  static Future<NotificationInboxResponse> getNotifications({
    String scope = 'inbox',
    bool unreadOnly = false,
    int limit = 100,
  }) async {
    final query = StringBuffer('/notifications/me?scope=$scope&limit=$limit');
    if (unreadOnly) query.write('&unread_only=1');
    final data = await ApiService.get(query.toString());
    final list = data['notifications'] as List<dynamic>? ?? [];
    return NotificationInboxResponse(
      notifications: list
          .map(
            (item) => NotificationItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      unreadCount: (data['unread_count'] as num?)?.toInt() ?? 0,
    );
  }

  static Future<int> getUnreadCount() async {
    final data = await ApiService.get('/notifications/unread-count');
    return (data['unread_count'] as num?)?.toInt() ?? 0;
  }

  static Future<void> markRead(String id) async {
    await ApiService.patch('/notifications/$id/read', {});
  }

  static Future<void> markUnread(String id) async {
    await ApiService.patch('/notifications/$id/unread', {});
  }

  static Future<void> archive(String id) async {
    await ApiService.patch('/notifications/$id/archive', {});
  }

  static Future<void> unarchive(String id) async {
    await ApiService.patch('/notifications/$id/unarchive', {});
  }

  static Future<void> delete(String id) async {
    await ApiService.delete('/notifications/$id');
  }

  static Future<void> markAllRead() async {
    await ApiService.post('/notifications/mark-all-read', {});
  }

  static Future<void> bulkAction({
    required List<String> ids,
    required String action,
  }) async {
    await ApiService.post('/notifications/bulk', {
      'ids': ids,
      'action': action,
    });
  }

  static Future<void> clearArchived() async {
    await ApiService.delete('/notifications/clear/archived');
  }
}
