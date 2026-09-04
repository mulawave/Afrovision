import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:video_thumbnail/video_thumbnail.dart';
import '../../features/wave/services/wave_service.dart';
import '../config/app_config.dart';
import '../theme/app_colors.dart';

/// In-memory cache of generated thumbnails keyed by video URL.
/// Survives widget rebuilds and tab switches within the same app session.
final Map<String, Uint8List> _thumbnailCache = {};

/// Reusable thumbnail widget for waves.
///
/// If [thumbnailUrl] is non-empty, uses [CachedNetworkImage] (network-cached).
/// If [thumbnailUrl] is empty and [waveId] is provided, the widget asks the
/// backend's thumbnail prefetch endpoint to generate / return a URL without
/// blocking the UI.  Only if neither a backend URL nor [waveId] is available
/// does it fall back to on-device [video_thumbnail] generation — matching the
/// website's `<video src={url}#t=0.1>` fallback behaviour.
class WaveThumbnail extends StatefulWidget {
  final String thumbnailUrl;
  final String videoUrl;
  final String? waveId;
  final double? memCacheWidth;
  final double? memCacheHeight;
  final Widget? placeholder;

  const WaveThumbnail({
    super.key,
    required this.thumbnailUrl,
    required this.videoUrl,
    this.waveId,
    this.memCacheWidth,
    this.memCacheHeight,
    this.placeholder,
  });

  @override
  State<WaveThumbnail> createState() => _WaveThumbnailState();
}

class _WaveThumbnailState extends State<WaveThumbnail> {
  Future<Uint8List?>? _generateFuture;
  String? _prefetchedUrl;

  @override
  void initState() {
    super.initState();
    _initGeneration();
  }

  @override
  void didUpdateWidget(covariant WaveThumbnail oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If the parent finally supplied a thumbnail URL, drop the prefetched one
    // and stop any pending on-device generation.
    if (widget.thumbnailUrl.isNotEmpty && oldWidget.thumbnailUrl.isEmpty) {
      setState(() {
        _prefetchedUrl = null;
        _generateFuture = null;
      });
    }
  }

  void _initGeneration() {
    if (widget.thumbnailUrl.isNotEmpty) return;
    if (widget.videoUrl.isEmpty) return;

    // Prefer the backend prefetch pipeline when we know the wave ID.  This
    // avoids heavy on-device ffmpeg runs for every visible wave tile.
    if (widget.waveId != null && widget.waveId!.isNotEmpty) {
      _prefetchBackendThumbnail(widget.waveId!);
      return;
    }

    // Legacy path: no wave ID, generate on-device from the video URL.
    final cacheKey = widget.videoUrl;
    if (_thumbnailCache.containsKey(cacheKey)) return;
    _generateFuture = _generateThumbnail(widget.videoUrl);
  }

  void _prefetchBackendThumbnail(String waveId) {
    WaveService.getWaveThumbnailUrl(waveId).then((url) {
      if (!mounted || url == null || url.isEmpty) return;
      setState(() => _prefetchedUrl = url);
    });
  }

  static Future<Uint8List?> _generateThumbnail(String videoUrl) async {
    String fullUrl = videoUrl;
    if (!fullUrl.startsWith('http')) {
      fullUrl = '${AppConfig.baseUrl}$fullUrl';
    }

    // HLS streams can't be processed by video_thumbnail — skip them.
    if (fullUrl.contains('.m3u8')) return null;

    try {
      final data = await VideoThumbnail.thumbnailData(
        video: fullUrl,
        imageFormat: ImageFormat.JPEG,
        maxWidth: 400,
        quality: 70,
        timeMs: 2000,
      );
      if (data != null && data.isNotEmpty) {
        _thumbnailCache[videoUrl] = data;
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveUrl = widget.thumbnailUrl.isNotEmpty
        ? widget.thumbnailUrl
        : _prefetchedUrl;

    // Case 1: thumbnail URL exists (from model or prefetched) — use network cache.
    if (effectiveUrl != null && effectiveUrl.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: effectiveUrl,
        fit: BoxFit.cover,
        memCacheWidth: widget.memCacheWidth?.toInt(),
        memCacheHeight: widget.memCacheHeight?.toInt(),
        placeholder: (_, __) => widget.placeholder ?? _defaultPlaceholder(),
        errorWidget: (_, __, ___) => widget.placeholder ?? _defaultPlaceholder(),
      );
    }

    // Case 2: no video URL — placeholder
    if (widget.videoUrl.isEmpty) {
      return widget.placeholder ?? _defaultPlaceholder();
    }

    // Case 3: backend prefetch is in flight for a known wave.  Don't fall back
    // to the heavy on-device generator; show the placeholder until the backend
    // either returns a URL or the next feed refresh supplies one.
    if (widget.waveId != null && widget.waveId!.isNotEmpty) {
      return widget.placeholder ?? _defaultPlaceholder();
    }

    // Case 4: legacy path (no wave ID): check in-memory cache first.
    final cached = _thumbnailCache[widget.videoUrl];
    if (cached != null) {
      return Image.memory(
        cached,
        fit: BoxFit.cover,
        gaplessPlayback: true,
      );
    }

    // Case 5: generate thumbnail from video URL on-device.
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
        return widget.placeholder ?? _defaultPlaceholder();
      },
    );
  }

  Widget _defaultPlaceholder() {
    return Container(
      color: AppColors.darkBlue,
      child: Center(
        child: Icon(
          Icons.video_library_rounded,
          color: AppColors.orange.withValues(alpha: 0.4),
          size: 32,
        ),
      ),
    );
  }
}
