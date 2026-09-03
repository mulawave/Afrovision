import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Service for caching wave video files to device storage.
///
/// Design goals — see phase1-buffering-findings.md F6, F9, F13:
///   1. `hasCached(id)` MUST be synchronous so the wave preloader can gate
///      controller creation without a filesystem round-trip on the UI
///      thread. Backed by an in-memory `Set<String>` populated at
///      `initialize()` time.
///   2. Cache dir moved to app support dir — Android will not silently evict
///      it under storage pressure the way it does with `getTemporaryDirectory()`.
///   3. Downloads are streamed via `http.Client().send()` and pumped straight
///      to disk instead of buffering the full MP4 in the Dart heap. Prevents
///      OOM on 2 GB devices caching 100 MB movies.
///
/// Cache key is the wave ID (not the URL) because signed GCS URLs expire.
class VideoCacheService {
  static const String _cacheVersionKey = 'video_cache_version';
  // v3 = migration to app support dir. Bump this whenever cache layout
  // changes so old files are wiped on upgrade.
  static const int _currentCacheVersion = 3;
  static const int _maxCacheSizeMB = 500;
  static const int _maxCacheAgeDays = 7;
  static const int _minValidFileBytes = 10 * 1024;
  static const String _filePrefix = 'wave_cache_';
  static const String _fileSuffix = '.mp4';

  static VideoCacheService? _instance;
  VideoCacheService._();

  static VideoCacheService get instance {
    _instance ??= VideoCacheService._();
    return _instance!;
  }

  Directory? _cacheDir;
  SharedPreferences? _prefs;
  bool _initialized = false;

  /// In-memory index of wave IDs known to be cached on disk. Populated once
  /// at [initialize] time by listing [_cacheDir]. Kept in sync by [_markCached]
  /// and [_markEvicted] so [hasCached] can answer synchronously.
  final Set<String> _cachedIds = <String>{};
  final Set<String> _downloadingWaveIds = <String>{};
  final Map<String, String> _failedDownloadIds = <String, String>{};

  Future<void> initialize() async {
    if (_initialized) return;
    _prefs = await SharedPreferences.getInstance();

    // Prefer app support dir over temp dir — Android will evict tempDir under
    // storage pressure without warning, undermining the "no repeated
    // downloads" guarantee.
    try {
      _cacheDir = await getApplicationSupportDirectory();
    } catch (_) {
      _cacheDir = await getTemporaryDirectory();
    }
    final sub = Directory('${_cacheDir!.path}/wave_videos');
    if (!await sub.exists()) {
      await sub.create(recursive: true);
    }
    _cacheDir = sub;

    final cachedVersion = _prefs!.getInt(_cacheVersionKey) ?? 0;
    if (cachedVersion < _currentCacheVersion) {
      await _clearCacheDir();
      // Also try to nuke the old temp-dir cache from previous versions.
      try {
        final oldTemp = await getTemporaryDirectory();
        await for (final entity in oldTemp.list()) {
          if (entity is File && entity.path.contains(_filePrefix)) {
            try { await entity.delete(); } catch (_) {}
          }
        }
      } catch (_) {}
      await _prefs!.setInt(_cacheVersionKey, _currentCacheVersion);
    }

    // Populate the in-memory index. This is a one-time O(n) scan on startup,
    // vastly cheaper than one File.exists() JNI hop per preload check.
    await _rebuildIndex();

    _initialized = true;
  }

  Future<void> _rebuildIndex() async {
    _cachedIds.clear();
    final dir = _cacheDir;
    if (dir == null || !await dir.exists()) return;
    try {
      await for (final entity in dir.list()) {
        if (entity is! File) continue;
        final name = entity.uri.pathSegments.last;
        if (!name.startsWith(_filePrefix) || !name.endsWith(_fileSuffix)) {
          continue;
        }
        final id = name.substring(
          _filePrefix.length,
          name.length - _fileSuffix.length,
        );
        if (id.isEmpty) continue;
        // Cheap size + age gate — files that don't pass are deleted eagerly
        // so they never appear in the index.
        final stat = await entity.stat();
        final age = DateTime.now().difference(stat.modified);
        if (stat.size < _minValidFileBytes || age.inDays > _maxCacheAgeDays) {
          try { await entity.delete(); } catch (_) {}
          continue;
        }
        _cachedIds.add(id);
      }
    } catch (e) {
      debugPrint('[VideoCache] Index rebuild failed: $e');
    }
  }

  File _fileFor(String waveId) =>
      File('${_cacheDir!.path}/$_filePrefix$waveId$_fileSuffix');

  void _markCached(String id) => _cachedIds.add(id);
  void _markEvicted(String id) => _cachedIds.remove(id);

  bool get isInitialized => _initialized;

  /// SYNCHRONOUS existence check for the wave preloader hot path.
  ///
  /// Once [initialize] has built the on-disk index, this is a simple
  /// `Set.contains` with zero filesystem I/O.
  ///
  /// During the short window before the index is ready (for example, the
  /// first wave preloaded immediately after app start), this pessimistically
  /// returns `true`. The preload path then falls through to [getCachedFile],
  /// which verifies the file with a real `File.exists()` call, so a cache
  /// miss is still handled correctly. This avoids blocking preloads on index
  /// rebuild while still letting us skip I/O for the common warm-app case.
  bool hasCached(String waveId) {
    if (!_initialized) return true;
    return _cachedIds.contains(waveId);
  }

  /// Returns the cached video file for [waveId] if it exists and is not expired.
  /// Returns null if not cached, expired, or cache is not initialized.
  Future<File?> getCachedFile(String waveId) async {
    if (_cacheDir == null) return null;

    final file = _fileFor(waveId);
    if (!await file.exists()) {
      _markEvicted(waveId);
      return null;
    }

    final stat = await file.stat();
    final age = DateTime.now().difference(stat.modified);
    if (age.inDays > _maxCacheAgeDays || stat.size < _minValidFileBytes) {
      try { await file.delete(); } catch (_) {}
      _markEvicted(waveId);
      return null;
    }

    return file;
  }

  /// Downloads a video from [url] and caches it under [waveId].
  /// Streamed to disk — never buffers the full body in memory.
  /// Fire-and-forget; errors are logged but not propagated.
  /// Skips HLS streams (.m3u8) since they can't be cached as single files.
  Future<void> downloadAndCache(String waveId, String url) async {
    if (_cacheDir == null) return;
    if (url.contains('.m3u8')) return;
    if (_cachedIds.contains(waveId)) return;
    if (_downloadingWaveIds.contains(waveId)) return;

    _downloadingWaveIds.add(waveId);
    _failedDownloadIds.remove(waveId);

    final tmpFile = File('${_fileFor(waveId).path}.part');
    IOSink? sink;
    final client = http.Client();

    try {
      final req = http.Request('GET', Uri.parse(url));
      final streamedResp = await client.send(req).timeout(
        const Duration(seconds: 30),
      );

      if (streamedResp.statusCode != 200) {
        debugPrint(
          '[VideoCache] Download failed for wave $waveId: HTTP ${streamedResp.statusCode}',
        );
        _failedDownloadIds[waveId] = 'HTTP ${streamedResp.statusCode}';
        return;
      }

      sink = tmpFile.openWrite();
      int received = 0;
      await streamedResp.stream.forEach((chunk) {
        sink!.add(chunk);
        received += chunk.length;
      }).timeout(const Duration(minutes: 3));
      await sink.flush();
      await sink.close();
      sink = null;

      if (received < _minValidFileBytes) {
        try { await tmpFile.delete(); } catch (_) {}
        _failedDownloadIds[waveId] = 'body too small ($received bytes)';
        return;
      }

      // Atomic rename — makes half-written files impossible to observe.
      final finalFile = _fileFor(waveId);
      if (await finalFile.exists()) {
        try { await finalFile.delete(); } catch (_) {}
      }
      await tmpFile.rename(finalFile.path);
      _markCached(waveId);

      debugPrint('[VideoCache] Cached wave $waveId (${received ~/ 1024}KB)');
      await _cleanCacheIfNeeded();
    } catch (e) {
      debugPrint('[VideoCache] Download error for wave $waveId: $e');
      _failedDownloadIds[waveId] = e.toString();
      try { await sink?.close(); } catch (_) {}
      try { if (await tmpFile.exists()) await tmpFile.delete(); } catch (_) {}
    } finally {
      client.close();
      _downloadingWaveIds.remove(waveId);
    }
  }

  /// Check if a wave is currently being downloaded.
  bool isDownloading(String waveId) => _downloadingWaveIds.contains(waveId);

  /// Check if a wave's download previously failed.
  bool hasFailedDownload(String waveId) => _failedDownloadIds.containsKey(waveId);

  Future<void> _cleanCacheIfNeeded() async {
    if (_cacheDir == null) return;

    final cacheDir = _cacheDir!;
    final files = await cacheDir.list().toList();

    int totalSize = 0;
    final fileInfos = <File, int>{};

    for (final entity in files) {
      if (entity is File && entity.path.contains(_filePrefix)) {
        final stat = await entity.stat();
        totalSize += stat.size;
        fileInfos[entity] = stat.modified.millisecondsSinceEpoch;
      }
    }

    final totalSizeMB = totalSize / (1024 * 1024);
    if (totalSizeMB <= _maxCacheSizeMB) return;

    final sortedFiles = fileInfos.entries.toList()
      ..sort((a, b) => a.value.compareTo(b.value));

    int deletedSize = 0;
    final targetSize = (_maxCacheSizeMB * 0.8) * (1024 * 1024);

    for (final entry in sortedFiles) {
      if (totalSize - deletedSize <= targetSize) break;
      try {
        final stat = await entry.key.stat();
        await entry.key.delete();
        deletedSize += stat.size;
        // Reflect eviction in the in-memory index.
        final name = entry.key.uri.pathSegments.last;
        if (name.startsWith(_filePrefix) && name.endsWith(_fileSuffix)) {
          _markEvicted(name.substring(
            _filePrefix.length,
            name.length - _fileSuffix.length,
          ));
        }
      } catch (_) {}
    }
  }

  Future<void> _clearCacheDir() async {
    if (_cacheDir == null) return;
    try {
      await for (final file in _cacheDir!.list()) {
        if (file is File && file.path.contains(_filePrefix)) {
          try { await file.delete(); } catch (_) {}
        }
      }
    } catch (_) {}
    _cachedIds.clear();
  }

  Future<void> clearCache() async {
    await _clearCacheDir();
  }

  Future<int> getCacheSizeMB() async {
    if (_cacheDir == null) return 0;
    int totalSize = 0;
    await for (final file in _cacheDir!.list()) {
      if (file is File && file.path.contains(_filePrefix)) {
        final stat = await file.stat();
        totalSize += stat.size;
      }
    }
    return totalSize ~/ (1024 * 1024);
  }
}
