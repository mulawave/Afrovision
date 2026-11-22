import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';

/// Local loopback HTTP streaming proxy that aggressively buffers VOD chunks
/// ahead of ExoPlayer's current read position.
///
/// Why this exists:
/// Android's `video_player` plugin uses ExoPlayer's default LoadControl with no
/// local read-ahead cache, causing frequent micro-buffering stalls on mobile
/// networks. By proxying direct MP4/MKV/WebM URLs through `127.0.0.1`, this
/// service pre-fetches up to 16 MB ahead of the active read offset in 2 MB
/// chunks and serves ExoPlayer at instant loopback speed.
class VodStreamProxy {
  VodStreamProxy._();
  static final VodStreamProxy instance = VodStreamProxy._();

  static const int _chunkSize = 2 * 1024 * 1024; // 2 MB per chunk
  static const int _readAheadChunks = 8; // 16 MB read-ahead window
  static const int _maxCachedChunks = 14; // 28 MB max RAM per session
  static const int _maxConcurrentPrefetch = 2;

  HttpServer? _server;
  final HttpClient _http = HttpClient()
    ..connectionTimeout = const Duration(seconds: 15)
    ..idleTimeout = const Duration(seconds: 30)
    ..maxConnectionsPerHost = 4;

  final Map<String, _ProxySession> _sessions = {};
  int _seq = 0;

  /// Returns whether [url] is eligible for local read-ahead proxying
  /// (direct progressive HTTP/HTTPS video files; excludes HLS/DASH playlists).
  static bool isEligibleUrl(String? url) {
    if (url == null || url.isEmpty) return false;
    final lower = url.toLowerCase();
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      return false;
    }
    if (lower.contains('.m3u8') || lower.contains('.mpd')) return false;
    return true;
  }

  Future<void> _ensureStarted() async {
    if (_server != null) return;
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server!.listen(_handleRequest);
    debugPrint('[VodStreamProxy] Listening on 127.0.0.1:${_server!.port}');
  }

  /// Registers [remoteUrl] and returns a local `http://127.0.0.1:<port>/s/<id>`
  /// URL for ExoPlayer to stream from.
  Future<({String localUrl, String sessionId})> register(String remoteUrl) async {
    await _ensureStarted();
    final id = 's${++_seq}_${DateTime.now().millisecondsSinceEpoch}';
    final session = _ProxySession(id: id, remoteUrl: remoteUrl);
    _sessions[id] = session;

    // Kick off metadata probe + initial chunk prefetch immediately so the first
    // frame and initial seconds are warm before ExoPlayer even connects.
    unawaited(_warmSession(session));

    final localUrl = 'http://127.0.0.1:${_server!.port}/s/$id';
    return (localUrl: localUrl, sessionId: id);
  }

  /// Highest contiguous buffered fraction (0.0 .. 1.0) for [sessionId].
  double bufferedFraction(String? sessionId) {
    if (sessionId == null) return 0.0;
    final session = _sessions[sessionId];
    if (session == null || session.totalBytes <= 0) return 0.0;
    return (session.highestBufferedByte / session.totalBytes).clamp(0.0, 1.0);
  }

  /// Releases memory and cancels prefetches for [sessionId].
  void release(String? sessionId) {
    if (sessionId == null) return;
    final session = _sessions.remove(sessionId);
    session?.dispose();
  }

  Future<void> _warmSession(_ProxySession session) async {
    try {
      await _ensureMetadata(session);
      if (!session.disposed && session.totalBytes > 0) {
        _scheduleReadAhead(session, 0);
      }
    } catch (_) {}
  }

  Future<void> _ensureMetadata(_ProxySession session) async {
    if (session.totalBytes > 0) return;
    if (session.metadataFuture != null) return session.metadataFuture!;

    final completer = Completer<void>();
    session.metadataFuture = completer.future;

    try {
      final req = await _http.getUrl(Uri.parse(session.remoteUrl));
      req.headers.set(HttpHeaders.rangeHeader, 'bytes=0-0');
      final res = await req.close().timeout(const Duration(seconds: 12));
      await res.drain<void>();

      session.contentType =
          res.headers.contentType?.mimeType ?? 'video/mp4';

      final contentRange = res.headers.value(HttpHeaders.contentRangeHeader);
      if (contentRange != null) {
        // Format: bytes 0-0/123456789
        final slash = contentRange.lastIndexOf('/');
        if (slash != -1) {
          final total = int.tryParse(contentRange.substring(slash + 1).trim());
          if (total != null && total > 0) {
            session.totalBytes = total;
            session.supportsRanges = true;
          }
        }
      }
      if (session.totalBytes <= 0 && res.contentLength > 0) {
        session.totalBytes = res.contentLength;
      }
    } catch (e) {
      debugPrint('[VodStreamProxy] Metadata probe failed: $e');
    } finally {
      if (!completer.isCompleted) completer.complete();
    }
  }

  Future<void> _handleRequest(HttpRequest request) async {
    final segments = request.uri.pathSegments;
    if (segments.length != 2 || segments[0] != 's') {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
      return;
    }

    final session = _sessions[segments[1]];
    if (session == null || session.disposed) {
      request.response.statusCode = HttpStatus.gone;
      await request.response.close();
      return;
    }

    try {
      await _ensureMetadata(session);
      if (session.totalBytes <= 0 || !session.supportsRanges) {
        // Fallback: direct passthrough if origin doesn't support byte ranges.
        await _passthrough(request, session);
        return;
      }

      final total = session.totalBytes;
      int start = 0;
      int end = total - 1;
      bool isRange = false;

      final rangeHeader = request.headers.value(HttpHeaders.rangeHeader);
      if (rangeHeader != null && rangeHeader.startsWith('bytes=')) {
        isRange = true;
        final spec = rangeHeader.substring(6).split(',').first.trim();
        final parts = spec.split('-');
        final parsedStart = int.tryParse(parts[0]);
        final parsedEnd =
            parts.length > 1 && parts[1].isNotEmpty ? int.tryParse(parts[1]) : null;
        if (parsedStart != null) {
          start = parsedStart.clamp(0, total - 1);
          end = (parsedEnd ?? (total - 1)).clamp(start, total - 1);
        }
      }

      final length = end - start + 1;
      request.response.statusCode =
          isRange ? HttpStatus.partialContent : HttpStatus.ok;
      request.response.headers
          .set(HttpHeaders.contentTypeHeader, session.contentType);
      request.response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');
      request.response.headers.contentLength = length;
      if (isRange) {
        request.response.headers
            .set(HttpHeaders.contentRangeHeader, 'bytes $start-$end/$total');
      }

      if (request.method == 'HEAD') {
        await request.response.close();
        return;
      }

      // Stream requested range chunk-by-chunk from cache while pre-fetching ahead.
      int cursor = start;
      while (cursor <= end && !session.disposed) {
        final chunkIndex = cursor ~/ _chunkSize;
        session.lastReadChunk = chunkIndex;
        _scheduleReadAhead(session, chunkIndex);

        final chunkBytes = await _getChunk(session, chunkIndex);
        if (chunkBytes == null || session.disposed) break;

        final chunkStart = chunkIndex * _chunkSize;
        final sliceStart = cursor - chunkStart;
        final remainingInRange = end - cursor + 1;
        final availableInChunk = chunkBytes.length - sliceStart;
        if (availableInChunk <= 0) break;

        final toWrite = remainingInRange < availableInChunk
            ? remainingInRange
            : availableInChunk;

        request.response.add(
          Uint8List.sublistView(chunkBytes, sliceStart, sliceStart + toWrite),
        );
        cursor += toWrite;

        // Flush periodically so ExoPlayer receives bytes immediately.
        await request.response.flush();
      }

      await request.response.close();
    } catch (_) {
      try {
        await request.response.close();
      } catch (_) {}
    }
  }

  Future<void> _passthrough(HttpRequest request, _ProxySession session) async {
    final req = await _http.getUrl(Uri.parse(session.remoteUrl));
    final rangeHeader = request.headers.value(HttpHeaders.rangeHeader);
    if (rangeHeader != null) {
      req.headers.set(HttpHeaders.rangeHeader, rangeHeader);
    }
    final res = await req.close();
    request.response.statusCode = res.statusCode;
    res.headers.forEach((name, values) {
      if (name.toLowerCase() != 'transfer-encoding') {
        request.response.headers.set(name, values);
      }
    });
    await res.pipe(request.response);
  }

  Future<Uint8List?> _getChunk(_ProxySession session, int chunkIndex) async {
    final cached = session.chunks[chunkIndex];
    if (cached != null) return cached;

    final inflight = session.inflight[chunkIndex];
    if (inflight != null) return inflight;

    final start = chunkIndex * _chunkSize;
    if (start >= session.totalBytes) return null;
    final end = (start + _chunkSize - 1).clamp(start, session.totalBytes - 1);

    final future = _fetchRange(session, chunkIndex, start, end);
    session.inflight[chunkIndex] = future;
    try {
      return await future;
    } finally {
      session.inflight.remove(chunkIndex);
    }
  }

  Future<Uint8List?> _fetchRange(
    _ProxySession session,
    int chunkIndex,
    int start,
    int end,
  ) async {
    if (session.disposed) return null;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final req = await _http.getUrl(Uri.parse(session.remoteUrl));
        req.headers.set(HttpHeaders.rangeHeader, 'bytes=$start-$end');
        final res = await req.close().timeout(const Duration(seconds: 20));
        if (res.statusCode != HttpStatus.partialContent &&
            res.statusCode != HttpStatus.ok) {
          await res.drain<void>();
          continue;
        }
        final builder = BytesBuilder(copy: false);
        await for (final part in res) {
          if (session.disposed) return null;
          builder.add(part);
        }
        final data = builder.takeBytes();
        if (!session.disposed && data.isNotEmpty) {
          session.chunks[chunkIndex] = data;
          final chunkEnd = start + data.length;
          if (chunkEnd > session.highestBufferedByte) {
            session.highestBufferedByte = chunkEnd;
          }
          _evictOldChunks(session);
        }
        return data;
      } catch (_) {
        if (attempt == 1) return null;
        await Future.delayed(const Duration(milliseconds: 250));
      }
    }
    return null;
  }

  void _scheduleReadAhead(_ProxySession session, int fromChunk) {
    if (session.disposed || session.totalBytes <= 0) return;
    final totalChunks = (session.totalBytes + _chunkSize - 1) ~/ _chunkSize;
    final maxChunk =
        (fromChunk + _readAheadChunks).clamp(0, totalChunks - 1);

    for (var idx = fromChunk + 1; idx <= maxChunk; idx++) {
      if (session.chunks.containsKey(idx) ||
          session.inflight.containsKey(idx)) {
        continue;
      }
      if (session.activePrefetches >= _maxConcurrentPrefetch) break;
      session.activePrefetches++;
      unawaited(
        _getChunk(session, idx).whenComplete(() {
          session.activePrefetches =
              (session.activePrefetches - 1).clamp(0, 100);
          if (!session.disposed) {
            // Continue chaining read-ahead as slots free up.
            _scheduleReadAhead(session, session.lastReadChunk);
          }
        }),
      );
    }
  }

  void _evictOldChunks(_ProxySession session) {
    if (session.chunks.length <= _maxCachedChunks) return;
    // Evict chunks furthest behind lastReadChunk first, keeping the
    // read-ahead window intact.
    final keys = session.chunks.keys.toList()..sort();
    for (final k in keys) {
      if (session.chunks.length <= _maxCachedChunks) break;
      if (k < session.lastReadChunk - 1) {
        session.chunks.remove(k);
      }
    }
    // If still over limit, trim farthest-ahead chunks.
    if (session.chunks.length > _maxCachedChunks) {
      final rev = session.chunks.keys.toList()..sort((a, b) => b.compareTo(a));
      for (final k in rev) {
        if (session.chunks.length <= _maxCachedChunks) break;
        if (k > session.lastReadChunk + _readAheadChunks) {
          session.chunks.remove(k);
        }
      }
    }
  }
}

class _ProxySession {
  final String id;
  final String remoteUrl;
  int totalBytes = 0;
  bool supportsRanges = false;
  String contentType = 'video/mp4';
  Future<void>? metadataFuture;
  final Map<int, Uint8List> chunks = {};
  final Map<int, Future<Uint8List?>> inflight = {};
  int lastReadChunk = 0;
  int highestBufferedByte = 0;
  int activePrefetches = 0;
  bool disposed = false;

  _ProxySession({required this.id, required this.remoteUrl});

  void dispose() {
    disposed = true;
    chunks.clear();
    inflight.clear();
  }
}
