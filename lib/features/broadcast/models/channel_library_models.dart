class ChannelLibraryItemModel {
  final String id;
  final String channelId;
  final String? seriesId;
  final int seriesOrderIndex;
  final String contentType;
  final String title;
  final String? subtitle;
  final String author;
  final String description;
  final List<String> tags;
  final String? coverAssetUrl;
  final String? readerAssetManifestUrl;
  final int totalPages;
  final int estimatedReadMinutes;
  final String status;

  const ChannelLibraryItemModel({
    required this.id,
    required this.channelId,
    required this.seriesId,
    required this.seriesOrderIndex,
    required this.contentType,
    required this.title,
    required this.subtitle,
    required this.author,
    required this.description,
    required this.tags,
    required this.coverAssetUrl,
    required this.readerAssetManifestUrl,
    required this.totalPages,
    required this.estimatedReadMinutes,
    required this.status,
  });

  static int _toInt(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  static List<String> _toStringList(dynamic value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }
    return const <String>[];
  }

  factory ChannelLibraryItemModel.fromJson(Map<String, dynamic> json) {
    return ChannelLibraryItemModel(
      id: (json['id'] ?? '').toString(),
      channelId: (json['channelId'] ?? json['channel_id'] ?? '').toString(),
      seriesId: json['seriesId']?.toString() ?? json['series_id']?.toString(),
      seriesOrderIndex: _toInt(
        json['seriesOrderIndex'] ?? json['series_order_index'],
      ),
      contentType: (json['contentType'] ?? json['content_type'] ?? 'other')
          .toString(),
      title: (json['title'] ?? 'Untitled').toString(),
      subtitle: json['subtitle']?.toString(),
      author: (json['author'] ?? 'Unknown').toString(),
      description: (json['description'] ?? '').toString(),
      tags: _toStringList(json['tags']),
      coverAssetUrl:
          json['coverAssetUrl']?.toString() ??
          json['cover_asset_url']?.toString(),
      readerAssetManifestUrl:
          json['readerAssetManifestUrl']?.toString() ??
          json['reader_asset_manifest_url']?.toString(),
      totalPages: _toInt(json['totalPages'] ?? json['total_pages']),
      estimatedReadMinutes: _toInt(
        json['estimatedReadMinutes'] ?? json['estimated_read_minutes'],
      ),
      status: (json['status'] ?? 'draft').toString(),
    );
  }
}

class ChannelLibraryProgressModel {
  final int currentSpreadIndex;
  final int? currentPageLeft;
  final int? currentPageRight;
  final bool isCompleted;

  const ChannelLibraryProgressModel({
    required this.currentSpreadIndex,
    required this.currentPageLeft,
    required this.currentPageRight,
    required this.isCompleted,
  });

  static int? _toNullableInt(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }

  factory ChannelLibraryProgressModel.fromJson(Map<String, dynamic> json) {
    return ChannelLibraryProgressModel(
      currentSpreadIndex:
          (json['currentSpreadIndex'] ?? json['current_spread_index'] ?? 0)
              .toInt(),
      currentPageLeft: _toNullableInt(
        json['currentPageLeft'] ?? json['current_page_left'],
      ),
      currentPageRight: _toNullableInt(
        json['currentPageRight'] ?? json['current_page_right'],
      ),
      isCompleted: json['isCompleted'] == true || json['is_completed'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'currentSpreadIndex': currentSpreadIndex,
      'currentPageLeft': currentPageLeft,
      'currentPageRight': currentPageRight,
      'isCompleted': isCompleted,
    };
  }
}

class ChannelLibraryBookmarkModel {
  final String id;
  final int spreadIndex;
  final int? page;
  final String? note;

  const ChannelLibraryBookmarkModel({
    required this.id,
    required this.spreadIndex,
    required this.page,
    required this.note,
  });

  static int? _toNullableInt(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }

  factory ChannelLibraryBookmarkModel.fromJson(Map<String, dynamic> json) {
    return ChannelLibraryBookmarkModel(
      id: (json['id'] ?? '').toString(),
      spreadIndex: (json['spreadIndex'] ?? json['spread_index'] ?? 0).toInt(),
      page: _toNullableInt(json['page']),
      note: json['note']?.toString(),
    );
  }
}

class ChannelLibraryItemDetailModel {
  final ChannelLibraryItemModel item;
  final ChannelLibraryProgressModel? progress;
  final String? previousItemId;
  final String? nextItemId;

  const ChannelLibraryItemDetailModel({
    required this.item,
    required this.progress,
    required this.previousItemId,
    required this.nextItemId,
  });

  factory ChannelLibraryItemDetailModel.fromJson(Map<String, dynamic> json) {
    final itemJson =
        (json['item'] as Map<String, dynamic>? ?? <String, dynamic>{});
    final progressJson = json['progress'];
    final navigation =
        json['navigation'] as Map<String, dynamic>? ?? <String, dynamic>{};

    return ChannelLibraryItemDetailModel(
      item: ChannelLibraryItemModel.fromJson(itemJson),
      progress: progressJson is Map<String, dynamic>
          ? ChannelLibraryProgressModel.fromJson(progressJson)
          : null,
      previousItemId:
          navigation['previousItemId']?.toString() ??
          navigation['previous_item_id']?.toString(),
      nextItemId:
          navigation['nextItemId']?.toString() ??
          navigation['next_item_id']?.toString(),
    );
  }
}

class ChannelLibraryManifestResponse {
  final String manifestUrl;
  final String itemId;
  final int totalPages;

  const ChannelLibraryManifestResponse({
    required this.manifestUrl,
    required this.itemId,
    required this.totalPages,
  });

  factory ChannelLibraryManifestResponse.fromJson(Map<String, dynamic> json) {
    return ChannelLibraryManifestResponse(
      manifestUrl: (json['manifestUrl'] ?? json['manifest_url'] ?? '')
          .toString(),
      itemId: (json['itemId'] ?? json['item_id'] ?? '').toString(),
      totalPages: (json['totalPages'] ?? json['total_pages'] ?? 0).toInt(),
    );
  }
}

class ChannelLibraryManifestPage {
  final int pageNumber;
  final String imageUrl;

  const ChannelLibraryManifestPage({
    required this.pageNumber,
    required this.imageUrl,
  });
}

class ChannelLibraryManifestPayload {
  final List<ChannelLibraryManifestPage> pages;
  final String? pdfUrl;
  final int totalPages;

  const ChannelLibraryManifestPayload({
    required this.pages,
    required this.pdfUrl,
    required this.totalPages,
  });
}
