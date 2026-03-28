class ChannelModel {
  final String id;
  final String ownerId;
  final String name;
  final String? description;
  final String? category;
  final String type;
  final String channelNumber;
  final String? logoUrl;
  final String? bannerUrl;
  final bool isActive;
  final String createdAt;
  final String? ownerName;

  ChannelModel({
    required this.id,
    required this.ownerId,
    required this.name,
    this.description,
    this.category,
    required this.type,
    required this.channelNumber,
    this.logoUrl,
    this.bannerUrl,
    required this.isActive,
    required this.createdAt,
    this.ownerName,
  });

  bool get isPrivate => type == 'private';
  bool get isPublic => type == 'public';

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
    return ChannelModel(
      id: json['id'] as String,
      ownerId: json['owner_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String?,
      type: json['type'] as String,
      channelNumber: json['channel_number'] as String,
      logoUrl: json['logo_url'] as String?,
      bannerUrl: json['banner_url'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      createdAt: json['created_at'] as String,
      ownerName: json['owner_name'] as String?,
    );
  }
}
