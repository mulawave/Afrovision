/// Hero banner shown at the top of the Media Center screen.
///
/// Populated from GET /media-center/heroes and cached via SectionCache.
/// Admins CRUD from /admin/media-center-heroes; see backend
/// media_center_heroes.controller.js for the source-of-truth shape.
class MediaCenterHero {
  final String id;
  final String title;
  final String? subtitle;
  final String imageUrl;

  /// One of: `movie` / `series` / `channel` / `url`.
  final String linkType;

  /// For `movie` / `series` / `channel` this is the entity id.
  /// For `url` this is the destination URL.
  final String linkTarget;

  final int priority;
  final bool isActive;
  final int? startsAt;
  final int? endsAt;

  const MediaCenterHero({
    required this.id,
    required this.title,
    this.subtitle,
    required this.imageUrl,
    required this.linkType,
    required this.linkTarget,
    this.priority = 0,
    this.isActive = true,
    this.startsAt,
    this.endsAt,
  });

  factory MediaCenterHero.fromJson(Map<String, dynamic> json) {
    return MediaCenterHero(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      subtitle: (json['subtitle'] as String?)?.trim().isEmpty == true
          ? null
          : (json['subtitle'] as String?),
      imageUrl: (json['image_url'] ?? '').toString(),
      linkType: (json['link_type'] ?? 'url').toString(),
      linkTarget: (json['link_target'] ?? '').toString(),
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      isActive: json['is_active'] == true,
      startsAt: (json['starts_at'] as num?)?.toInt(),
      endsAt: (json['ends_at'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'subtitle': subtitle,
        'image_url': imageUrl,
        'link_type': linkType,
        'link_target': linkTarget,
        'priority': priority,
        'is_active': isActive,
        'starts_at': startsAt,
        'ends_at': endsAt,
      };
}
