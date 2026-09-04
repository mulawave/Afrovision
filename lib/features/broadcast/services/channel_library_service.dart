import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/api/api_service.dart';
import '../../../core/services/section_cache.dart';
import '../models/channel_library_models.dart';

class ChannelLibraryListResponse {
  final List<ChannelLibraryItemModel> items;
  final int page;
  final int limit;
  final int total;
  final int pages;

  const ChannelLibraryListResponse({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.pages,
  });
}

class ChannelLibraryService {
  static String _libraryKey(String channelId) => 'lib_ch_$channelId';

  static Future<ChannelLibraryListResponse> getChannelLibrary(
    String channelId, {
    int page = 1,
    int limit = 24,
  }) async {
    final data = await ApiService.get(
      '/channels/$channelId/library?page=$page&limit=$limit',
    );
    if (page == 1) {
      // Cache only page 1 — that's what the profile Library tab paints first.
      await SectionCache.write(_libraryKey(channelId), jsonEncode(data));
    }
    return _parseLibrary(data, page: page, limit: limit);
  }

  /// Stale-while-revalidate wrapper for [getChannelLibrary].
  ///
  /// Paints the last-known page-1 items instantly via [onCached], then hits
  /// the network. Fixes the "loading afresh every visit" behaviour on the
  /// channel profile Library tab.
  static Future<ChannelLibraryListResponse> getChannelLibraryCached(
    String channelId, {
    int page = 1,
    int limit = 24,
    void Function(ChannelLibraryListResponse cached)? onCached,
  }) async {
    if (page == 1 && onCached != null) {
      final raw = await SectionCache.readStale(_libraryKey(channelId));
      if (raw != null) {
        try {
          onCached(_parseLibrary(
            jsonDecode(raw) as Map<String, dynamic>,
            page: page,
            limit: limit,
          ));
        } catch (_) {}
      }
    }
    return getChannelLibrary(channelId, page: page, limit: limit);
  }

  static ChannelLibraryListResponse _parseLibrary(
    Map<String, dynamic> data, {
    required int page,
    required int limit,
  }) {
    final root = (data['data'] as Map<String, dynamic>? ?? <String, dynamic>{});
    final rawItems = root['items'];
    final items = rawItems is List
        ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(ChannelLibraryItemModel.fromJson)
              .toList()
        : <ChannelLibraryItemModel>[];
    final pagination =
        root['pagination'] as Map<String, dynamic>? ?? <String, dynamic>{};
    return ChannelLibraryListResponse(
      items: items,
      page: (pagination['page'] as num?)?.toInt() ?? page,
      limit: (pagination['limit'] as num?)?.toInt() ?? limit,
      total: (pagination['total'] as num?)?.toInt() ?? items.length,
      pages: (pagination['pages'] as num?)?.toInt() ?? 1,
    );
  }

  static Future<ChannelLibraryItemDetailModel> getItemDetail(
    String channelId,
    String itemId,
  ) async {
    final data = await ApiService.get('/channels/$channelId/library/$itemId');
    final root = (data['data'] as Map<String, dynamic>? ?? <String, dynamic>{});
    return ChannelLibraryItemDetailModel.fromJson(root);
  }

  static Future<ChannelLibraryManifestResponse> getReaderManifest(
    String channelId,
    String itemId,
  ) async {
    final data = await ApiService.get(
      '/channels/$channelId/library/$itemId/reader-manifest',
    );
    final root = (data['data'] as Map<String, dynamic>? ?? <String, dynamic>{});
    return ChannelLibraryManifestResponse.fromJson(root);
  }

  static Future<List<ChannelLibraryItemModel>> getRecommendations(
    String channelId, {
    int limit = 6,
  }) async {
    final data = await ApiService.get(
      '/channels/$channelId/library/recommendations?limit=$limit',
    );
    final root = data['data'];
    final rawItems = root is List
        ? root
        : root is Map<String, dynamic>
        ? root['items'] ?? root['data']
        : const <dynamic>[];

    if (rawItems is! List) {
      return const <ChannelLibraryItemModel>[];
    }

    return rawItems
        .whereType<Map<String, dynamic>>()
        .map(ChannelLibraryItemModel.fromJson)
        .toList();
  }

  static Future<ChannelLibraryManifestPayload> fetchManifestPayload(
    String manifestUrl,
  ) async {
    final response = await http.get(Uri.parse(manifestUrl));
    if (response.statusCode >= 400) {
      throw Exception(
        'Failed to fetch reader manifest (${response.statusCode})',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Invalid reader manifest payload');
    }

    final pages = <ChannelLibraryManifestPage>[];

    final rawPages = decoded['pages'];
    if (rawPages is List) {
      for (final entry in rawPages) {
        if (entry is! Map<String, dynamic>) continue;
        final pageNumber = (entry['pageNumber'] ?? entry['page_number'] ?? 0)
            .toInt();
        final imageUrl = (entry['imageUrl'] ?? entry['image_url'] ?? '')
            .toString();
        if (pageNumber > 0 && imageUrl.isNotEmpty) {
          pages.add(
            ChannelLibraryManifestPage(
              pageNumber: pageNumber,
              imageUrl: imageUrl,
            ),
          );
        }
      }
    }

    if (pages.isEmpty) {
      final rawPageImageUrls =
          decoded['pageImageUrls'] ?? decoded['page_image_urls'];
      if (rawPageImageUrls is List) {
        for (var i = 0; i < rawPageImageUrls.length; i += 1) {
          final url = rawPageImageUrls[i]?.toString() ?? '';
          if (url.isNotEmpty) {
            pages.add(
              ChannelLibraryManifestPage(pageNumber: i + 1, imageUrl: url),
            );
          }
        }
      }
    }

    pages.sort((a, b) => a.pageNumber.compareTo(b.pageNumber));

    int totalPages = 0;
    final totalRaw = decoded['totalPages'] ?? decoded['total_pages'];
    if (totalRaw is num) {
      totalPages = totalRaw.toInt();
    } else if (totalRaw is String) {
      totalPages = int.tryParse(totalRaw) ?? 0;
    }

    return ChannelLibraryManifestPayload(
      pages: pages,
      pdfUrl: decoded['pdfUrl']?.toString() ?? decoded['pdf_url']?.toString(),
      totalPages: totalPages > 0 ? totalPages : pages.length,
    );
  }

  static Future<ChannelLibraryProgressModel> getProgress(
    String channelId,
    String itemId,
  ) async {
    final data = await ApiService.get(
      '/channels/$channelId/library/$itemId/progress',
    );
    final root = (data['data'] as Map<String, dynamic>? ?? <String, dynamic>{});
    return ChannelLibraryProgressModel.fromJson(root);
  }

  static Future<void> updateProgress(
    String channelId,
    String itemId,
    ChannelLibraryProgressModel progress,
  ) async {
    await ApiService.put(
      '/channels/$channelId/library/$itemId/progress',
      progress.toJson(),
    );
  }

  static Future<List<ChannelLibraryBookmarkModel>> getBookmarks(
    String channelId,
    String itemId,
  ) async {
    final data = await ApiService.get(
      '/channels/$channelId/library/$itemId/bookmarks',
    );
    final root = data['data'];
    if (root is! List) return const <ChannelLibraryBookmarkModel>[];
    return root
        .whereType<Map<String, dynamic>>()
        .map(ChannelLibraryBookmarkModel.fromJson)
        .toList();
  }

  static Future<void> addBookmark(
    String channelId,
    String itemId, {
    required int spreadIndex,
    int? page,
    String? note,
  }) async {
    await ApiService.post('/channels/$channelId/library/$itemId/bookmarks', {
      'spreadIndex': spreadIndex,
      'page': page,
      'note': note,
    });
  }

  static Future<void> deleteBookmark(
    String channelId,
    String itemId,
    String bookmarkId,
  ) async {
    await ApiService.delete(
      '/channels/$channelId/library/$itemId/bookmarks/$bookmarkId',
    );
  }

  static Future<void> addFavorite(String channelId, String itemId) async {
    await ApiService.post('/channels/$channelId/library/$itemId/favorite', {});
  }

  static Future<void> removeFavorite(String channelId, String itemId) async {
    await ApiService.delete('/channels/$channelId/library/$itemId/favorite');
  }

  static Future<int> getLibraryUnreadCount(String channelId) async {
    final data = await ApiService.get(
      '/notifications/unread-count?type=library&channel_id=$channelId',
    );
    return (data['unread_count'] as num?)?.toInt() ?? 0;
  }

  static Future<void> markLibraryViewed(String channelId) async {
    await ApiService.post(
      '/notifications/mark-all-read?type=library&channel_id=$channelId',
      {},
    );
  }
}
