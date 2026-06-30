import 'dart:io';

import '../../../core/api/api_service.dart';
import '../models/channel_library_models.dart';
import 'broadcast_service.dart';

class CreatorLibrarySeriesModel {
  final String id;
  final String channelId;
  final String title;
  final String? description;
  final String? coverAssetUrl;
  final int itemCount;

  const CreatorLibrarySeriesModel({
    required this.id,
    required this.channelId,
    required this.title,
    required this.description,
    required this.coverAssetUrl,
    required this.itemCount,
  });

  static int _toInt(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  factory CreatorLibrarySeriesModel.fromJson(Map<String, dynamic> json) {
    return CreatorLibrarySeriesModel(
      id: (json['id'] ?? '').toString(),
      channelId: (json['channelId'] ?? json['channel_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: json['description']?.toString(),
      coverAssetUrl:
          json['coverAssetUrl']?.toString() ??
          json['cover_asset_url']?.toString(),
      itemCount: _toInt(json['itemCount'] ?? json['item_count']),
    );
  }
}

class CreatorLibraryManifestModel {
  final String manifestUrl;
  final String? pdfUrl;
  final int totalPages;

  const CreatorLibraryManifestModel({
    required this.manifestUrl,
    required this.pdfUrl,
    required this.totalPages,
  });

  static int _toInt(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  factory CreatorLibraryManifestModel.fromJson(Map<String, dynamic> json) {
    return CreatorLibraryManifestModel(
      manifestUrl:
          (json['manifestUrl'] ?? json['manifest_url'] ?? '').toString(),
      pdfUrl: json['pdfUrl']?.toString() ?? json['pdf_url']?.toString(),
      totalPages: _toInt(json['totalPages'] ?? json['total_pages']),
    );
  }
}

class ChannelLibraryCreatorService {
  static Future<List<CreatorLibrarySeriesModel>> getSeries(
    String channelId,
  ) async {
    final data = await ApiService.get('/creator/channels/$channelId/library/series');
    final raw = data['data'];
    if (raw is! List) {
      return const <CreatorLibrarySeriesModel>[];
    }
    return raw
        .whereType<Map<String, dynamic>>()
        .map(CreatorLibrarySeriesModel.fromJson)
        .toList();
  }

  static Future<CreatorLibrarySeriesModel> createSeries(
    String channelId, {
    required String title,
    String? description,
    String? coverAssetUrl,
  }) async {
    final data = await ApiService.post('/creator/channels/$channelId/library/series', {
      'title': title,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      if (coverAssetUrl != null && coverAssetUrl.trim().isNotEmpty)
        'coverAssetUrl': coverAssetUrl.trim(),
    });
    final root = data['data'];
    if (root is Map<String, dynamic>) {
      return CreatorLibrarySeriesModel.fromJson(root);
    }
    return CreatorLibrarySeriesModel.fromJson(Map<String, dynamic>.from(data));
  }

  static Future<List<ChannelLibraryItemModel>> getItems(String channelId) async {
    final data = await ApiService.get('/creator/channels/$channelId/library/items');
    final raw = data['data'];
    if (raw is! List) {
      return const <ChannelLibraryItemModel>[];
    }
    return raw
        .whereType<Map<String, dynamic>>()
        .map(ChannelLibraryItemModel.fromJson)
        .toList();
  }

  static Future<Map<String, String>> getUploadUrl({
    required String channelId,
    required String assetType,
    required String contentType,
    String? fileName,
  }) async {
    final data = await ApiService.post(
      '/creator/channels/$channelId/library/upload-url',
      {
        'asset_type': assetType,
        'content_type': contentType,
        if (fileName != null && fileName.trim().isNotEmpty)
          'file_name': fileName.trim(),
      },
    );
    return {
      'signed_url': data['signed_url'] as String,
      'public_url': data['public_url'] as String,
      'filename': data['filename'] as String,
    };
  }

  static Future<void> uploadToGcs({
    required String signedUrl,
    required File file,
    required String contentType,
    void Function(int sent, int total)? onProgress,
  }) {
    return BroadcastService.uploadToGcs(
      signedUrl: signedUrl,
      file: file,
      contentType: contentType,
      onProgress: onProgress,
    );
  }

  static Future<CreatorLibraryManifestModel> generateManifest(
    String channelId, {
    String? pdfUrl,
    List<String>? pageImageUrls,
  }) async {
    final data = await ApiService.post(
      '/creator/channels/$channelId/library/reader-assets/manifest',
      {
        if (pdfUrl != null && pdfUrl.trim().isNotEmpty) 'pdf_url': pdfUrl.trim(),
        if (pageImageUrls != null && pageImageUrls.isNotEmpty)
          'page_image_urls': pageImageUrls,
      },
    );
    return CreatorLibraryManifestModel.fromJson(data);
  }

  static Future<ChannelLibraryItemModel> createItem(
    String channelId, {
    required String title,
    required String author,
    String? description,
    required String contentType,
    required int totalPages,
    String? coverAssetUrl,
    String? readerAssetManifestUrl,
    String? seriesId,
    required String status,
  }) async {
    final data = await ApiService.post('/creator/channels/$channelId/library/items', {
      'title': title,
      'author': author,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      'contentType': contentType,
      'totalPages': totalPages,
      if (coverAssetUrl != null && coverAssetUrl.trim().isNotEmpty)
        'coverAssetUrl': coverAssetUrl.trim(),
      if (readerAssetManifestUrl != null && readerAssetManifestUrl.isNotEmpty)
        'readerAssetManifestUrl': readerAssetManifestUrl,
      if (seriesId != null && seriesId.isNotEmpty) 'seriesId': seriesId,
      'status': status,
    });
    final root = data['data'];
    if (root is Map<String, dynamic>) {
      return ChannelLibraryItemModel.fromJson(root);
    }
    return ChannelLibraryItemModel.fromJson(Map<String, dynamic>.from(data));
  }

  static Future<ChannelLibraryItemModel> updateItem(
    String channelId,
    String itemId, {
    required String title,
    required String author,
    String? description,
    required String contentType,
    required int totalPages,
    String? coverAssetUrl,
    String? readerAssetManifestUrl,
    String? seriesId,
    required String status,
  }) async {
    final data = await ApiService.patch('/creator/channels/$channelId/library/items/$itemId', {
      'title': title,
      'author': author,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      'contentType': contentType,
      'totalPages': totalPages,
      if (coverAssetUrl != null && coverAssetUrl.trim().isNotEmpty)
        'coverAssetUrl': coverAssetUrl.trim(),
      if (readerAssetManifestUrl != null && readerAssetManifestUrl.isNotEmpty)
        'readerAssetManifestUrl': readerAssetManifestUrl,
      if (seriesId != null && seriesId.isNotEmpty) 'seriesId': seriesId,
      'status': status,
    });
    final root = data['data'];
    if (root is Map<String, dynamic>) {
      return ChannelLibraryItemModel.fromJson(root);
    }
    return ChannelLibraryItemModel.fromJson(Map<String, dynamic>.from(data));
  }

  static Future<void> publishItem(String channelId, String itemId) async {
    await ApiService.post('/creator/channels/$channelId/library/items/$itemId/publish', {});
  }

  static Future<void> deleteItem(String channelId, String itemId) async {
    await ApiService.delete('/creator/channels/$channelId/library/items/$itemId');
  }
}
