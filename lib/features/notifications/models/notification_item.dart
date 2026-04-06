class NotificationItem {
  final String id;
  final String userId;
  final String title;
  final String body;
  final Map<String, dynamic> data;
  final String type;
  final String? link;
  final String? source;
  final bool isRead;
  final bool archived;
  final int createdAt;
  final int? readAt;
  final int? archivedAt;

  const NotificationItem({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    required this.data,
    required this.type,
    this.link,
    this.source,
    required this.isRead,
    required this.archived,
    required this.createdAt,
    this.readAt,
    this.archivedAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      userId: json['user_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      data: Map<String, dynamic>.from(json['data'] as Map? ?? const {}),
      type: json['type'] as String? ?? 'system',
      link: json['link'] as String?,
      source: json['source'] as String?,
      isRead: json['is_read'] as bool? ?? false,
      archived: json['archived'] as bool? ?? false,
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      readAt: (json['read_at'] as num?)?.toInt(),
      archivedAt: (json['archived_at'] as num?)?.toInt(),
    );
  }
}
