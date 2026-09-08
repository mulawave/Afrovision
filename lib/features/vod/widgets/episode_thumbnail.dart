import 'dart:typed_data';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:video_thumbnail/video_thumbnail.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../../core/utils/image_cache_key.dart';

/// In-memory cache of generated episode thumbnails keyed by video URL.
/// Survives widget rebuilds and tab switches within the same app session.
final Map<String, Uint8List> _episodeThumbnailCache = {};

/// Thumbnail widget for episode tiles.
///
/// If [posterUrl] is non-empty, uses [CachedNetworkImage] (network-cached).
/// If [posterUrl] is empty and [videoUrl] is available, generates a thumbnail
/// on-device from the first frame of the video using [video_thumbnail] —
/// the same approach used for waves.
class EpisodeThumbnail extends StatefulWidget {
  final String? posterUrl;
  final String? videoUrl;
  final int episodeNumber;

  const EpisodeThumbnail({
    super.key,
    this.posterUrl,
    this.videoUrl,
    required this.episodeNumber,
  });

  @override
  State<EpisodeThumbnail> createState() => _EpisodeThumbnailState();
}

class _EpisodeThumbnailState extends State<EpisodeThumbnail> {
  Future<Uint8List?>? _generateFuture;

  @override
  void initState() {
    super.initState();
    _initGeneration();
  }

  void _initGeneration() {
    if ((widget.posterUrl ?? '').isNotEmpty) return;
    if ((widget.videoUrl ?? '').isEmpty) return;

    final fullUrl = _resolveUrl(widget.videoUrl!);
    if (fullUrl == null) return;

    // HLS streams can't be processed by video_thumbnail
    if (fullUrl.contains('.m3u8')) return;

    if (_episodeThumbnailCache.containsKey(fullUrl)) return;
    _generateFuture = _generateThumbnail(fullUrl);
  }

  static String? _resolveUrl(String url) {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return '${AppConfig.baseUrl}$url';
    return null;
  }

  static Future<Uint8List?> _generateThumbnail(String videoUrl) async {
    try {
      final data = await VideoThumbnail.thumbnailData(
        video: videoUrl,
        imageFormat: ImageFormat.JPEG,
        maxWidth: 400,
        quality: 70,
        timeMs: 2000,
      );
      if (data != null && data.isNotEmpty) {
        _episodeThumbnailCache[videoUrl] = data;
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Case 1: poster URL exists — use network cache.
    final posterUrl = widget.posterUrl;
    if (posterUrl != null && posterUrl.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: posterUrl,
        cacheKey: imageCacheKey(posterUrl),
        fit: BoxFit.cover,
        memCacheWidth: 128,
        placeholder: (_, __) => _loadingPlaceholder(),
        errorWidget: (_, __, ___) => _loadingPlaceholder(),
      );
    }

    // Case 2: no video URL — show loading placeholder (no fallback).
    final videoUrl = widget.videoUrl;
    if (videoUrl == null || videoUrl.isEmpty) {
      return _loadingPlaceholder();
    }

    final fullUrl = _resolveUrl(videoUrl);
    if (fullUrl == null) {
      return _loadingPlaceholder();
    }

    // Case 3: check in-memory cache first.
    final cached = _episodeThumbnailCache[fullUrl];
    if (cached != null) {
      return Image.memory(
        cached,
        fit: BoxFit.cover,
        gaplessPlayback: true,
      );
    }

    // Case 4: generate thumbnail from video URL on-device.
    return FutureBuilder<Uint8List?>(
      future: _generateFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.done &&
            snapshot.data != null &&
            snapshot.data!.isNotEmpty) {
          return Image.memory(
            snapshot.data!,
            fit: BoxFit.cover,
            gaplessPlayback: true,
          );
        }
        return _loadingPlaceholder();
      },
    );
  }

  Widget _loadingPlaceholder() {
    return Container(
      color: Nocturne.surfaceRaised,
      alignment: Alignment.center,
      child: SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Nocturne.gold.withValues(alpha: 0.5),
        ),
      ),
    );
  }
}
