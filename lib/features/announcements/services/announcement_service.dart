import '../../../core/api/api_service.dart';

class Announcement {
  final String id;
  final String title;
  final String body;
  final String icon;
  final String color;
  final String priority;
  final bool isActive;
  final String createdAt;
  final String updatedAt;

  const Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.icon,
    required this.color,
    required this.priority,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      icon: json['icon'] as String? ?? 'campaign',
      color: json['color'] as String? ?? '#FF9800',
      priority: json['priority'] as String? ?? 'normal',
      isActive: json['is_active'] as bool? ?? true,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
    );
  }
}

class AnnouncementService {
  static Future<List<Announcement>> getActiveAnnouncements({int limit = 10}) async {
    final data = await ApiService.get('/announcements?limit=$limit');
    final items = data['items'] as List? ?? [];
    return items.map((item) => Announcement.fromJson(item as Map<String, dynamic>)).toList();
  }

  static Future<List<Announcement>> getAllAnnouncements() async {
    final data = await ApiService.get('/announcements?limit=100');
    final items = data['items'] as List? ?? [];
    return items.map((item) => Announcement.fromJson(item as Map<String, dynamic>)).toList();
  }
}
