import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Snapshot of global download activity for the Download Stats Beacon.
class DownloadBeaconState {
  final int activeCount;
  final int queuedCount;
  final int pendingCount;
  final int completedCount;
  final int failedCount;
  final double overallPercent;
  final String? activeTitle;

  const DownloadBeaconState({
    this.activeCount = 0,
    this.queuedCount = 0,
    this.pendingCount = 0,
    this.completedCount = 0,
    this.failedCount = 0,
    this.overallPercent = 0,
    this.activeTitle = '',
  });

  bool get hasActivity =>
      activeCount > 0 || queuedCount > 0 || pendingCount > 0 || failedCount > 0;
}

/// Generalized offline cache for VOD (movies and series episodes).
///
/// Supports:
///   - Direct MP4 / progressive files (`hosted_url`, `external_url`)
///   - HLS streams by downloading a selected variant's playlist + segments and
///     rewriting the playlist to point at local files.
///   - Pause, Resume, Cancel, batch operations, and strict serial episode
///     completion ordering per series.
///
/// Cache keys are `{mediaType}_{mediaId}` (e.g. `movie_uuid`, `episode_uuid`).
class VodCacheService {
  static const String _cacheVersionKey = 'vod_cache_version';
  static const int _currentCacheVersion = 1;
  static const int _maxCacheSizeMB = 1024;
  static const int _maxCacheAgeDays = 30;
  static const int _minValidFileBytes = 10 * 1024;

  static VodCacheService? _instance;
  VodCacheService._();

  static VodCacheService get instance {
    _instance ??= VodCacheService._();
    return _instance!;
  }

  Directory? _cacheDir;
  SharedPreferences? _prefs;
  bool _initialized = false;

  final Set<String> _cachedKeys = <String>{};
  final Set<String> _downloadingKeys = <String>{};
  final Set<String> _queuedKeys = <String>{};
  final Set<String> _pausedKeys = <String>{};
  final Set<String> _cancelledKeys = <String>{};
  final Map<String, String> _failedKeys = <String, String>{};
  final Map<String, http.Client> _activeClients = <String, http.Client>{};
  final Map<String, DownloadProgress> _latestProgress =
      <String, DownloadProgress>{};
  final Map<String, CachedVodItem> _activeItems = <String, CachedVodItem>{};
  final Map<String, String> _activeSeriesIds = <String, String>{};
  final Map<String, int> _activeEpisodeNumbers = <String, int>{};
  final List<Completer<void>> _orderWaiters = <Completer<void>>[];
  final Map<String, int> _remoteSizeCache = <String, int>{};
  final _progressControllers = <String, StreamController<DownloadProgress>>{};

  /// Live notifier for the Download Stats Beacon on Home, Media Center,
  /// Channel Profile, Episode List, and Player screens.
  final ValueNotifier<DownloadBeaconState> beaconNotifier =
      ValueNotifier<DownloadBeaconState>(const DownloadBeaconState());

  Future<void> initialize() async {
    if (_initialized) return;
    _prefs = await SharedPreferences.getInstance();

    try {
      final base = await getApplicationSupportDirectory();
      _cacheDir = Directory(p.join(base.path, 'vod_cache'));
    } catch (_) {
      _cacheDir = await getTemporaryDirectory();
      _cacheDir = Directory(p.join(_cacheDir!.path, 'vod_cache'));
    }

    if (!await _cacheDir!.exists()) {
      await _cacheDir!.create(recursive: true);
    }

    final cachedVersion = _prefs!.getInt(_cacheVersionKey) ?? 0;
    if (cachedVersion < _currentCacheVersion) {
      await _clearCacheDir();
      await _prefs!.setInt(_cacheVersionKey, _currentCacheVersion);
    }

    await _rebuildIndex();
    _initialized = true;
    unawaited(_refreshBeacon());
  }

  Future<void> _clearCacheDir() async {
    final dir = _cacheDir;
    if (dir == null || !await dir.exists()) return;
    try {
      await for (final entity in dir.list()) {
        if (entity is Directory) {
          await entity.delete(recursive: true);
        } else if (entity is File) {
          await entity.delete();
        }
      }
    } catch (e) {
      debugPrint('[VodCache] Clear cache failed: $e');
    }
  }

  Future<void> _rebuildIndex() async {
    _cachedKeys.clear();
    final dir = _cacheDir;
    if (dir == null || !await dir.exists()) return;

    await for (final entity in dir.list()) {
      if (entity is! Directory) continue;
      final key = p.basename(entity.path);
      final metaFile = File(p.join(entity.path, 'meta.json'));
      if (!await metaFile.exists()) continue;

      try {
        final stat = await entity.stat();
        final age = DateTime.now().difference(stat.modified);
        if (age.inDays > _maxCacheAgeDays) {
          await entity.delete(recursive: true);
          continue;
        }

        final raw = await metaFile.readAsString();
        final meta = jsonDecode(raw) as Map<String, dynamic>;
        final fileName = meta['local_file'] as String?;
        // Never mark partial 'video.part' files as completed downloads.
        if (fileName == null || fileName == 'video.part') continue;
        final localPath = p.join(entity.path, fileName);
        if (await File(localPath).exists()) {
          _cachedKeys.add(key);
        }
      } catch (e) {
        debugPrint('[VodCache] Index rebuild error for $key: $e');
      }
    }
  }

  Directory _folderFor(String key) => Directory(p.join(_cacheDir!.path, key));

  Future<String?> _localAssetPath(Directory folder) async {
    final metaFile = File(p.join(folder.path, 'meta.json'));
    if (!await metaFile.exists()) return null;
    try {
      final raw = await metaFile.readAsString();
      final meta = jsonDecode(raw) as Map<String, dynamic>;
      final fileName = meta['local_file'] as String?;
      if (fileName == null || fileName == 'video.part') return null;
      return p.join(folder.path, fileName);
    } catch (_) {
      return null;
    }
  }

  void _notifyOrderWaiters() {
    final waiters = List<Completer<void>>.from(_orderWaiters);
    _orderWaiters.clear();
    for (final c in waiters) {
      if (!c.isCompleted) c.complete();
    }
  }

  /// Returns true if another episode in the same series with a strictly lower
  /// episode number is currently downloading or queued.
  bool _hasPrecedingEpisodeDownloading(
      String currentKey, String? seriesId, int? episodeNumber) {
    if (seriesId == null ||
        seriesId.isEmpty ||
        episodeNumber == null ||
        episodeNumber <= 0) {
      return false;
    }
    for (final otherKey in _downloadingKeys) {
      if (otherKey == currentKey) continue;
      if (_activeSeriesIds[otherKey] == seriesId) {
        final otherEp = _activeEpisodeNumbers[otherKey];
        if (otherEp != null && otherEp > 0 && otherEp < episodeNumber) {
          return true;
        }
      }
    }
    return false;
  }

  /// Waits while any preceding episode in the same series is actively
  /// downloading so that Episode N+1 never downloads ahead of or completes
  /// before Episode N.
  Future<void> _waitForPrecedingEpisodes(
      String key, String? seriesId, int? episodeNumber) async {
    while (_hasPrecedingEpisodeDownloading(key, seriesId, episodeNumber)) {
      if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) {
        return;
      }
      _queuedKeys.add(key);
      unawaited(_refreshBeacon());
      final completer = Completer<void>();
      _orderWaiters.add(completer);
      await completer.future.timeout(
        const Duration(seconds: 3),
        onTimeout: () {},
      );
    }
    _queuedKeys.remove(key);
    unawaited(_refreshBeacon());
  }

  Future<void> _refreshBeacon() async {
    if (!_initialized) return;
    int pendingCount = 0;
    try {
      final pending = await getPendingResumeItems();
      pendingCount = pending.length;
    } catch (_) {}

    double sumPct = 0;
    int activeWithPct = 0;
    String? activeTitle;

    for (final k in _downloadingKeys) {
      final prog = _latestProgress[k];
      if (prog != null) {
        sumPct += prog.percent;
        activeWithPct++;
      }
      activeTitle ??= _activeItems[k]?.title ?? k;
    }

    final avgPct = activeWithPct > 0 ? (sumPct / activeWithPct) : 0.0;
    beaconNotifier.value = DownloadBeaconState(
      activeCount: _downloadingKeys.length,
      queuedCount: _queuedKeys.length,
      pendingCount: pendingCount,
      completedCount: _cachedKeys.length,
      failedCount: _failedKeys.length,
      overallPercent: avgPct.clamp(0.0, 100.0),
      activeTitle: activeTitle,
    );
  }

  /// Enumerate every VOD asset currently cached on this device.
  Future<List<CachedVodItem>> listAllCached() async {
    if (!_initialized) await initialize();
    final dir = _cacheDir;
    if (dir == null || !await dir.exists()) return const <CachedVodItem>[];
    final items = <CachedVodItem>[];
    await for (final entity in dir.list()) {
      if (entity is! Directory) continue;
      final key = p.basename(entity.path);
      if (!_cachedKeys.contains(key)) continue;
      final metaFile = File(p.join(entity.path, 'meta.json'));
      if (!await metaFile.exists()) continue;
      try {
        final raw = await metaFile.readAsString();
        final meta = jsonDecode(raw) as Map<String, dynamic>;
        final sep = key.indexOf('_');
        if (sep <= 0) continue;
        final mediaType = key.substring(0, sep);
        final mediaId = key.substring(sep + 1);
        items.add(CachedVodItem(
          mediaType: mediaType,
          mediaId: mediaId,
          title: (meta['title'] as String?) ?? 'Untitled',
          posterUrl: meta['poster_url'] as String?,
          duration: (meta['duration'] as num?)?.toInt() ?? 0,
          downloadedAt: (meta['downloaded_at'] as num?)?.toInt() ?? 0,
          originalUrl: (meta['original_url'] as String?) ?? '',
          seriesId: meta['series_id'] as String?,
          channelId: meta['channel_id'] as String?,
          seriesTitle: meta['series_title'] as String?,
          episodeNumber: (meta['episode_number'] as num?)?.toInt(),
          totalBytes: (meta['total_bytes'] as num?)?.toInt(),
        ));
      } catch (_) {}
    }
    items.sort((a, b) => b.downloadedAt.compareTo(a.downloadedAt));
    return items;
  }

  bool isCached(String mediaType, String mediaId) {
    final key = _key(mediaType, mediaId);
    if (!_initialized) return false;
    return _cachedKeys.contains(key);
  }

  bool isDownloading(String mediaType, String mediaId) {
    return _downloadingKeys.contains(_key(mediaType, mediaId));
  }

  bool isQueued(String mediaType, String mediaId) {
    return _queuedKeys.contains(_key(mediaType, mediaId));
  }

  bool isFailed(String mediaType, String mediaId) {
    final key = _key(mediaType, mediaId);
    return _failedKeys.containsKey(key) && !_downloadingKeys.contains(key);
  }

  String? lastError(String mediaType, String mediaId) {
    return _failedKeys[_key(mediaType, mediaId)];
  }

  DownloadProgress? currentProgress(String mediaType, String mediaId) {
    return _latestProgress[_key(mediaType, mediaId)];
  }

  CachedVodItem? activeItem(String key) => _activeItems[key];

  /// Pause an in-flight download so it can be resumed later from where it stopped.
  Future<void> pauseDownload(String mediaType, String mediaId) async {
    final key = _key(mediaType, mediaId);
    _pausedKeys.add(key);
    _queuedKeys.remove(key);
    _activeClients.remove(key)?.close();
    _downloadingKeys.remove(key);
    _failedKeys.remove(key);
    _notifyOrderWaiters();
    await _refreshBeacon();
  }

  /// Pause all active downloads.
  Future<void> pauseAll() async {
    final keys = _downloadingKeys.toList();
    for (final key in keys) {
      final sep = key.indexOf('_');
      if (sep <= 0) continue;
      await pauseDownload(key.substring(0, sep), key.substring(sep + 1));
    }
  }

  /// Cancel an active or partial download and remove its partial files.
  Future<void> cancelDownload(String mediaType, String mediaId) async {
    final key = _key(mediaType, mediaId);
    _cancelledKeys.add(key);
    _pausedKeys.remove(key);
    _queuedKeys.remove(key);
    _activeClients.remove(key)?.close();
    _downloadingKeys.remove(key);
    _failedKeys.remove(key);
    _latestProgress.remove(key);
    _activeItems.remove(key);
    _activeSeriesIds.remove(key);
    _activeEpisodeNumbers.remove(key);
    if (_cacheDir != null) {
      final folder = _folderFor(key);
      if (await folder.exists()) {
        try {
          await folder.delete(recursive: true);
        } catch (_) {}
      }
    }
    _cachedKeys.remove(key);
    _notifyOrderWaiters();
    await _refreshBeacon();
  }

  /// Cancel all active and pending downloads.
  Future<void> cancelAll() async {
    final keys = _downloadingKeys.toList();
    for (final key in keys) {
      final sep = key.indexOf('_');
      if (sep <= 0) continue;
      await cancelDownload(key.substring(0, sep), key.substring(sep + 1));
    }
    final pending = await getPendingResumeItems();
    for (final item in pending) {
      await cancelDownload(item.mediaType, item.mediaId);
    }
  }

  /// Returns the local file path to play, or null if not cached.
  Future<String?> getLocalPath(String mediaType, String mediaId) async {
    if (!_initialized) await initialize();
    final key = _key(mediaType, mediaId);
    final folder = _folderFor(key);
    if (!await folder.exists()) return null;
    final path = await _localAssetPath(folder);
    if (path == null || !await File(path).exists()) return null;
    return path;
  }

  /// Stream of download progress for a given media key.
  Stream<DownloadProgress>? progressStream(String mediaType, String mediaId) {
    final key = _key(mediaType, mediaId);
    var controller = _progressControllers[key];
    if (controller == null || controller.isClosed) {
      controller = StreamController<DownloadProgress>.broadcast();
      _progressControllers[key] = controller;
    }
    return controller.stream;
  }

  Future<void> _emitProgress(String key, DownloadProgress progress) async {
    _latestProgress[key] = progress;
    final controller = _progressControllers[key];
    if (controller != null && !controller.isClosed) {
      controller.add(progress);
    }
    unawaited(_refreshBeacon());
  }

  /// Delete a cached download.
  Future<void> delete(String mediaType, String mediaId) async {
    await cancelDownload(mediaType, mediaId);
  }

  String _key(String mediaType, String mediaId) => '${mediaType}_$mediaId';

  /// Public entry point: download a movie or episode for offline playback.
  Future<void> download({
    required String mediaType,
    required String mediaId,
    required String title,
    String? posterUrl,
    required String sourceMode,
    String? url,
    required int duration,
    int? targetBps,
    String? seriesId,
    String? channelId,
    String? seriesTitle,
    int? episodeNumber,
  }) async {
    if (!_initialized) await initialize();
    final key = _key(mediaType, mediaId);
    if (url == null || url.isEmpty) {
      _failedKeys[key] = 'No video URL available';
      await _refreshBeacon();
      return;
    }

    if (_cachedKeys.contains(key)) return;
    if (_downloadingKeys.contains(key)) return;

    _pausedKeys.remove(key);
    _cancelledKeys.remove(key);
    _failedKeys.remove(key);
    _downloadingKeys.add(key);

    if (seriesId != null && seriesId.isNotEmpty) {
      _activeSeriesIds[key] = seriesId;
    }
    if (episodeNumber != null && episodeNumber > 0) {
      _activeEpisodeNumbers[key] = episodeNumber;
    }

    _activeItems[key] = CachedVodItem(
      mediaType: mediaType,
      mediaId: mediaId,
      title: title,
      posterUrl: posterUrl,
      duration: duration,
      downloadedAt: DateTime.now().millisecondsSinceEpoch,
      originalUrl: url,
      seriesId: seriesId,
      channelId: channelId,
      seriesTitle: seriesTitle,
      episodeNumber: episodeNumber,
    );

    final folder = _folderFor(key);
    if (!await folder.exists()) await folder.create(recursive: true);

    // Write meta upfront so even queued/paused items persist for Pending Resume.
    await _writeMeta(
      folder: folder,
      title: title,
      posterUrl: posterUrl,
      sourceMode: sourceMode,
      localFile: 'video.part',
      originalUrl: url,
      duration: duration,
      seriesId: seriesId,
      channelId: channelId,
      seriesTitle: seriesTitle,
      episodeNumber: episodeNumber,
    );
    // Ensure a 0-byte video.part file exists immediately so pausing while queued
    // still registers as a resumable item.
    final partFile = _partialFile(folder);
    if (!await partFile.exists()) {
      await partFile.create(recursive: true);
    }

    await _refreshBeacon();

    try {
      // Enforce strict serial episode ordering per series: wait if any lower
      // episode number in the same series is currently downloading.
      await _waitForPrecedingEpisodes(key, seriesId, episodeNumber);

      if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) {
        return;
      }

      if (sourceMode == 'hls' || url.toLowerCase().endsWith('.m3u8')) {
        await _downloadHls(
          key: key,
          title: title,
          posterUrl: posterUrl,
          sourceMode: sourceMode,
          manifestUrl: url,
          folder: folder,
          duration: duration,
          targetBps: targetBps,
          seriesId: seriesId,
          channelId: channelId,
          seriesTitle: seriesTitle,
          episodeNumber: episodeNumber,
        );
      } else {
        await _downloadDirect(
          key: key,
          title: title,
          posterUrl: posterUrl,
          sourceMode: sourceMode,
          url: url,
          folder: folder,
          duration: duration,
          seriesId: seriesId,
          channelId: channelId,
          seriesTitle: seriesTitle,
          episodeNumber: episodeNumber,
        );
      }

      if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) {
        return;
      }

      _cachedKeys.add(key);
      _failedKeys.remove(key);
      await _cleanCacheIfNeeded();
    } catch (e) {
      if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) {
        debugPrint('[VodCache] Download paused/cancelled $key');
      } else {
        debugPrint('[VodCache] Download failed $key: $e');
        _failedKeys[key] = e.toString();
      }
    } finally {
      _downloadingKeys.remove(key);
      _queuedKeys.remove(key);
      _activeClients.remove(key);
      _activeSeriesIds.remove(key);
      _activeEpisodeNumbers.remove(key);
      _notifyOrderWaiters();
      await _refreshBeacon();
    }
  }

  /// Returns the total byte size of a cached item, or null if not cached.
  Future<int?> getCachedSize(String mediaType, String mediaId) async {
    if (!_initialized) await initialize();
    final key = _key(mediaType, mediaId);
    final folder = _folderFor(key);
    if (!await folder.exists()) return null;
    final localPath = await _localAssetPath(folder);
    if (localPath == null) return null;
    final file = File(localPath);
    if (!await file.exists()) return null;
    final stat = await file.stat();
    return stat.size;
  }

  /// Returns the cached size, or probes and caches the remote Content-Length
  /// so episode file sizes are always displayed under each episode row.
  Future<int?> getOrFetchFileSize(
    String mediaType,
    String mediaId,
    String? url,
  ) async {
    if (!_initialized) await initialize();
    final key = _key(mediaType, mediaId);

    // 1. Completed local file size
    final cached = await getCachedSize(mediaType, mediaId);
    if (cached != null && cached > 0) return cached;

    // 2. Active download totalBytes
    final prog = _latestProgress[key];
    if (prog != null && prog.totalBytes > 0) return prog.totalBytes;

    // 3. In-memory or SharedPreferences cache
    if (_remoteSizeCache.containsKey(key)) return _remoteSizeCache[key];
    final prefSize = _prefs?.getInt('vod_size_$key');
    if (prefSize != null && prefSize > 0) {
      _remoteSizeCache[key] = prefSize;
      return prefSize;
    }

    // 4. Saved meta.json total_bytes or partial file size
    final folder = _folderFor(key);
    if (await folder.exists()) {
      final metaFile = File(p.join(folder.path, 'meta.json'));
      if (await metaFile.exists()) {
        try {
          final meta =
              jsonDecode(await metaFile.readAsString()) as Map<String, dynamic>;
          final tb = (meta['total_bytes'] as num?)?.toInt();
          if (tb != null && tb > 0) {
            _remoteSizeCache[key] = tb;
            return tb;
          }
        } catch (_) {}
      }
    }

    if (url == null || url.isEmpty || url.toLowerCase().endsWith('.m3u8')) {
      return null;
    }

    // 5. Probe remote Content-Length via HEAD (or Range 0-0 GET fallback)
    final client = http.Client();
    try {
      final headRes = await client
          .head(Uri.parse(url), headers: {'User-Agent': _userAgent})
          .timeout(const Duration(seconds: 8));
      int len = int.tryParse(headRes.headers['content-length'] ?? '') ?? 0;
      if (len <= 0) {
        final rangeRes = await client.get(
          Uri.parse(url),
          headers: {'User-Agent': _userAgent, 'Range': 'bytes=0-0'},
        ).timeout(const Duration(seconds: 8));
        final cr = rangeRes.headers['content-range'] ?? '';
        final slash = cr.lastIndexOf('/');
        if (slash != -1 && slash + 1 < cr.length) {
          len = int.tryParse(cr.substring(slash + 1).trim()) ?? 0;
        }
        if (len <= 0) {
          len = int.tryParse(rangeRes.headers['content-length'] ?? '') ?? 0;
        }
      }
      if (len > 0) {
        _remoteSizeCache[key] = len;
        await _prefs?.setInt('vod_size_$key', len);
        return len;
      }
    } catch (_) {
    } finally {
      client.close();
    }
    return null;
  }

  /// Returns true when a partial (interrupted or paused) download exists.
  bool hasPartialDownload(String mediaType, String mediaId) {
    final key = _key(mediaType, mediaId);
    if (!_initialized) return false;
    if (_cachedKeys.contains(key)) return false;
    if (_downloadingKeys.contains(key)) return false;
    final folder = _folderFor(key);
    return _partialFile(folder).existsSync();
  }

  /// Returns the byte count downloaded so far for a partial download.
  int partialDownloadedBytes(String mediaType, String mediaId) {
    final key = _key(mediaType, mediaId);
    if (!_initialized) return 0;
    final folder = _folderFor(key);
    final f = _partialFile(folder);
    if (!f.existsSync()) return 0;
    try {
      return f.lengthSync();
    } catch (_) {
      return 0;
    }
  }

  File _partialFile(Directory folder) => File(p.join(folder.path, 'video.part'));

  /// Keys of media currently being downloaded.
  Iterable<String> get downloadingKeys =>
      _downloadingKeys.toList(growable: false);

  /// Returns cached items that have a partial download (interrupted/paused).
  Future<List<CachedVodItem>> getPendingResumeItems() async {
    if (!_initialized) await initialize();
    final dir = _cacheDir;
    if (dir == null || !await dir.exists()) return const <CachedVodItem>[];
    final items = <CachedVodItem>[];
    await for (final entity in dir.list()) {
      if (entity is! Directory) continue;
      final key = p.basename(entity.path);
      if (_cachedKeys.contains(key)) continue;
      if (_downloadingKeys.contains(key)) continue;
      final partial = _partialFile(entity);
      if (!await partial.exists()) continue;
      final metaFile = File(p.join(entity.path, 'meta.json'));
      if (!await metaFile.exists()) continue;
      try {
        final raw = await metaFile.readAsString();
        final meta = jsonDecode(raw) as Map<String, dynamic>;
        final sep = key.indexOf('_');
        if (sep <= 0) continue;
        final mediaType = key.substring(0, sep);
        final mediaId = key.substring(sep + 1);
        final partBytes = await partial.length();
        items.add(CachedVodItem(
          mediaType: mediaType,
          mediaId: mediaId,
          title: (meta['title'] as String?) ?? 'Untitled',
          posterUrl: meta['poster_url'] as String?,
          duration: (meta['duration'] as num?)?.toInt() ?? 0,
          downloadedAt: (meta['downloaded_at'] as num?)?.toInt() ?? 0,
          originalUrl: (meta['original_url'] as String?) ?? '',
          seriesId: meta['series_id'] as String?,
          channelId: meta['channel_id'] as String?,
          seriesTitle: meta['series_title'] as String?,
          episodeNumber: (meta['episode_number'] as num?)?.toInt(),
          downloadedBytes: partBytes,
          totalBytes: (meta['total_bytes'] as num?)?.toInt(),
        ));
      } catch (_) {}
    }
    return items;
  }

  static const String _userAgent = 'AfroVision/2.0 (Mobile; VOD Cache)';

  Future<void> _downloadDirect({
    required String key,
    required String title,
    String? posterUrl,
    required String sourceMode,
    required String url,
    required Directory folder,
    required int duration,
    String? seriesId,
    String? channelId,
    String? seriesTitle,
    int? episodeNumber,
  }) async {
    final tmpFile = File(p.join(folder.path, 'video.part'));
    final finalFile = File(p.join(folder.path, 'video.mp4'));

    int resumeFrom = 0;
    if (await tmpFile.exists()) {
      resumeFrom = await tmpFile.length();
    }

    final client = http.Client();
    _activeClients[key] = client;
    try {
      final headers = <String, String>{};
      if (resumeFrom > 0) {
        headers['Range'] = 'bytes=$resumeFrom-';
      }
      final streamedResp = await _getWithRetry(client, url, headers: headers);

      final statusCode = streamedResp.statusCode;
      final isPartial = statusCode == 206;
      final isOk = statusCode == 200;
      if (!isPartial && !isOk) {
        throw Exception('HTTP $statusCode');
      }

      final effectiveResume = isPartial ? resumeFrom : 0;
      final contentLength =
          int.tryParse(streamedResp.headers['content-length'] ?? '') ?? 0;
      final totalBytes =
          contentLength > 0 ? effectiveResume + contentLength : 0;

      if (totalBytes > 0) {
        _remoteSizeCache[key] = totalBytes;
        unawaited(_prefs?.setInt('vod_size_$key', totalBytes));
        await _writeMeta(
          folder: folder,
          title: title,
          posterUrl: posterUrl,
          sourceMode: sourceMode,
          localFile: 'video.part',
          originalUrl: url,
          duration: duration,
          seriesId: seriesId,
          channelId: channelId,
          seriesTitle: seriesTitle,
          episodeNumber: episodeNumber,
          totalBytes: totalBytes,
        );
      }

      final mode =
          isPartial && effectiveResume > 0 ? FileMode.append : FileMode.write;
      final sink = tmpFile.openWrite(mode: mode);
      int received = effectiveResume;

      try {
        await for (final chunk
            in streamedResp.stream.timeout(const Duration(minutes: 30))) {
          if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) {
            break;
          }
          sink.add(chunk);
          received += chunk.length;
          if (totalBytes > 0) {
            await _emitProgress(
              key,
              DownloadProgress(
                percent: (received / totalBytes) * 100,
                downloadedBytes: received,
                totalBytes: totalBytes,
              ),
            );
          }
        }
      } finally {
        await sink.flush();
        await sink.close();
      }

      if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) {
        return;
      }

      if (received < _minValidFileBytes) {
        throw Exception('Downloaded body too small ($received bytes)');
      }

      // Final serial completion gate: never complete before a preceding
      // actively downloading episode in the same series.
      await _waitForPrecedingEpisodes(key, seriesId, episodeNumber);
      if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) {
        return;
      }

      if (await finalFile.exists()) await finalFile.delete();
      await tmpFile.rename(finalFile.path);

      await _writeMeta(
        folder: folder,
        title: title,
        posterUrl: posterUrl,
        sourceMode: sourceMode,
        localFile: 'video.mp4',
        originalUrl: url,
        duration: duration,
        seriesId: seriesId,
        channelId: channelId,
        seriesTitle: seriesTitle,
        episodeNumber: episodeNumber,
        totalBytes: received,
      );

      await _emitProgress(
        key,
        DownloadProgress(
          percent: 100,
          downloadedBytes: received,
          totalBytes: received,
        ),
      );
    } finally {
      client.close();
    }
  }

  Future<void> _downloadHls({
    required String key,
    required String title,
    String? posterUrl,
    required String sourceMode,
    required String manifestUrl,
    required Directory folder,
    required int duration,
    int? targetBps,
    String? seriesId,
    String? channelId,
    String? seriesTitle,
    int? episodeNumber,
  }) async {
    final client = http.Client();
    _activeClients[key] = client;
    try {
      final masterText = await _fetchText(client, manifestUrl);
      final baseUrl = _baseUrl(manifestUrl);

      String mediaPlaylistText;
      String mediaPlaylistUrl;

      if (_isMasterPlaylist(masterText)) {
        final variantUrl =
            _selectVariant(masterText, baseUrl, targetBps: targetBps);
        if (variantUrl == null) {
          throw Exception('No playable HLS variant found in master playlist');
        }
        mediaPlaylistUrl = variantUrl;
        mediaPlaylistText = await _fetchText(client, mediaPlaylistUrl);
      } else {
        mediaPlaylistUrl = manifestUrl;
        mediaPlaylistText = masterText;
      }

      final mediaBaseUrl = _baseUrl(mediaPlaylistUrl);
      final lines = LineSplitter.split(mediaPlaylistText).toList();
      final segmentUrls = <String>[];
      final mapUrls = <int, String>{};

      for (int i = 0; i < lines.length; i++) {
        final line = lines[i].trim();
        if (line.isEmpty) continue;
        if (line.startsWith('#EXT-X-MAP')) {
          final uri = _extractUri(line, 'URI');
          if (uri != null) {
            mapUrls[i] = _resolveUrl(uri, mediaBaseUrl);
          }
        } else if (!line.startsWith('#')) {
          segmentUrls.add(_resolveUrl(line, mediaBaseUrl));
        }
      }

      if (segmentUrls.isEmpty) {
        throw Exception('HLS playlist contains no media segments');
      }

      final totalSegments = segmentUrls.length + mapUrls.length;
      int completedSegments = 0;
      int downloadedBytes = 0;
      int totalBytes = 0;

      if (segmentUrls.isNotEmpty) {
        final firstSegSize = await _headSize(client, segmentUrls.first);
        if (firstSegSize > 0) {
          totalBytes = firstSegSize * totalSegments;
        }
      }

      final localMapFiles = <int, String>{};
      for (final entry in mapUrls.entries) {
        if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) return;
        final localName = _mapFileName(entry.key);
        final segFile = File(p.join(folder.path, localName));
        if (!await segFile.exists()) {
          await _downloadFile(client, entry.value, segFile);
        }
        downloadedBytes += await segFile.length();
        localMapFiles[entry.key] = localName;
        completedSegments++;
        await _emitProgress(
          key,
          DownloadProgress(
            percent: (completedSegments / totalSegments) * 100,
            downloadedBytes: downloadedBytes,
            totalBytes:
                totalBytes > 0 ? totalBytes : downloadedBytes * totalSegments,
          ),
        );
      }

      final localSegmentNames = <String>[];
      for (int i = 0; i < segmentUrls.length; i++) {
        if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) return;
        final segUrl = segmentUrls[i];
        final ext = _segmentExtension(segUrl, i);
        final localName = 'seg_$i$ext';
        final segFile = File(p.join(folder.path, localName));
        if (!await segFile.exists()) {
          await _downloadFile(client, segUrl, segFile);
        }
        final segLen = await segFile.length();
        downloadedBytes += segLen;
        if (totalBytes == 0 && i == 0 && segLen > 0) {
          totalBytes = segLen * totalSegments;
        }
        localSegmentNames.add(localName);
        completedSegments++;
        await _emitProgress(
          key,
          DownloadProgress(
            percent: (completedSegments / totalSegments) * 100,
            downloadedBytes: downloadedBytes,
            totalBytes: totalBytes > downloadedBytes
                ? totalBytes
                : downloadedBytes,
          ),
        );
      }

      await _waitForPrecedingEpisodes(key, seriesId, episodeNumber);
      if (_pausedKeys.contains(key) || _cancelledKeys.contains(key)) return;

      final outLines = <String>[];
      int segIdx = 0;
      for (int i = 0; i < lines.length; i++) {
        final raw = lines[i];
        final line = raw.trim();
        if (line.startsWith('#EXT-X-MAP') && localMapFiles.containsKey(i)) {
          final oldUri = _extractUri(line, 'URI');
          if (oldUri != null) {
            outLines.add(_replaceUri(raw, oldUri, localMapFiles[i]!));
            continue;
          }
        } else if (line.isNotEmpty && !line.startsWith('#')) {
          outLines.add(localSegmentNames[segIdx++]);
          continue;
        }
        outLines.add(line);
      }

      final localPlaylist = File(p.join(folder.path, 'index.m3u8'));
      await localPlaylist.writeAsString(outLines.join('\n'));
      final partFile = _partialFile(folder);
      if (await partFile.exists()) await partFile.delete();

      await _writeMeta(
        folder: folder,
        title: title,
        posterUrl: posterUrl,
        sourceMode: sourceMode,
        localFile: 'index.m3u8',
        originalUrl: manifestUrl,
        duration: duration,
        seriesId: seriesId,
        channelId: channelId,
        seriesTitle: seriesTitle,
        episodeNumber: episodeNumber,
        totalBytes: downloadedBytes,
      );

      await _emitProgress(
        key,
        DownloadProgress(
          percent: 100,
          downloadedBytes: downloadedBytes,
          totalBytes: downloadedBytes,
        ),
      );
    } finally {
      client.close();
    }
  }

  Future<http.StreamedResponse> _getWithRetry(
    http.Client client,
    String url, {
    int maxAttempts = 3,
    Map<String, String>? headers,
  }) async {
    Object? lastError;
    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final req = http.Request('GET', Uri.parse(url));
        req.headers['User-Agent'] = _userAgent;
        req.headers['Accept'] = '*/*';
        if (headers != null) req.headers.addAll(headers);
        final resp =
            await client.send(req).timeout(const Duration(seconds: 30));
        if (resp.statusCode == 200 || resp.statusCode == 206) return resp;
        if (resp.statusCode >= 400 &&
            resp.statusCode < 500 &&
            resp.statusCode != 408 &&
            resp.statusCode != 429) {
          throw Exception('HTTP ${resp.statusCode} for $url');
        }
        lastError = Exception('HTTP ${resp.statusCode}');
      } catch (e) {
        lastError = e;
        if (attempt < maxAttempts) {
          await Future.delayed(Duration(seconds: attempt * 2));
          continue;
        }
      }
    }
    throw lastError ?? Exception('Request failed for $url');
  }

  Future<String> _fetchText(http.Client client, String url) async {
    final resp = await _getWithRetry(client, url);
    return resp.stream.bytesToString();
  }

  String _baseUrl(String url) {
    final qIdx = url.indexOf('?');
    final clean = qIdx == -1 ? url : url.substring(0, qIdx);
    final slash = clean.lastIndexOf('/');
    if (slash == -1) return clean;
    return clean.substring(0, slash + 1);
  }

  String _resolveUrl(String target, String baseUrl) {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      return target;
    }
    if (target.startsWith('/')) {
      final uri = Uri.parse(baseUrl);
      return '${uri.scheme}://${uri.authority}$target';
    }
    return '$baseUrl$target';
  }

  Future<void> _downloadFile(http.Client client, String url, File file) async {
    final resp = await _getWithRetry(client, url);
    final bytes = <int>[];
    await resp.stream.forEach(bytes.addAll);
    if (bytes.isEmpty) {
      throw Exception('Empty response from $url');
    }
    await file.writeAsBytes(bytes, flush: true);
  }

  Future<int> _headSize(http.Client client, String url) async {
    for (int attempt = 0; attempt < 2; attempt++) {
      try {
        final res = await client
            .head(Uri.parse(url))
            .timeout(const Duration(seconds: 15));
        if (res.statusCode == 200) {
          return int.tryParse(res.headers['content-length'] ?? '') ?? 0;
        }
      } catch (_) {}
    }
    return 0;
  }

  bool _isMasterPlaylist(String text) {
    return text.contains('#EXT-X-STREAM-INF');
  }

  String? _selectVariant(
    String masterText,
    String baseUrl, {
    int? targetBps,
  }) {
    final variants = <_HlsVariant>[];
    final lines = LineSplitter.split(masterText).toList();
    _HlsVariant? current;

    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
        final bw = _extractInt(trimmed, 'BANDWIDTH=');
        final res = _extractResolution(trimmed);
        current = _HlsVariant(bandwidth: bw, resolution: res);
      } else if (current != null &&
          trimmed.isNotEmpty &&
          !trimmed.startsWith('#')) {
        final absolute = _resolveUrl(trimmed, baseUrl);
        variants.add(_HlsVariant(
          bandwidth: current.bandwidth,
          resolution: current.resolution,
          url: absolute,
        ));
        current = null;
      }
    }

    if (variants.isEmpty) return null;
    variants.sort((a, b) => (a.bandwidth ?? 0).compareTo(b.bandwidth ?? 0));

    if (targetBps != null) {
      for (int i = variants.length - 1; i >= 0; i--) {
        final bw = variants[i].bandwidth ?? 0;
        if (bw <= targetBps) return variants[i].url;
      }
      return variants.first.url;
    }

    return variants[variants.length ~/ 2].url;
  }

  int? _extractInt(String text, String key) {
    final start = text.indexOf(key);
    if (start == -1) return null;
    final after = start + key.length;
    var end = text.indexOf(',', after);
    if (end == -1) end = text.length;
    final value = text.substring(after, end).trim();
    return int.tryParse(value);
  }

  String? _extractResolution(String text) {
    final match = RegExp(r'RESOLUTION=(\d+)x(\d+)').firstMatch(text);
    if (match == null) return null;
    return '${match.group(1)}x${match.group(2)}';
  }

  String? _extractUri(String text, String key) {
    final pattern = RegExp('$key=(?:"([^"]+)"|\'([^\']+)\'|([^,\\s]+))');
    final match = pattern.firstMatch(text);
    return match?.group(1) ?? match?.group(2) ?? match?.group(3);
  }

  String _replaceUri(String line, String oldUri, String newUri) {
    final q = line.contains('"$oldUri"')
        ? '"'
        : line.contains("'$oldUri'")
            ? "'"
            : '';
    return line.replaceFirst('$q$oldUri$q', '$q$newUri$q');
  }

  String _mapFileName(int index) => 'init_$index.mp4';

  String _segmentExtension(String url, int index) {
    try {
      final uri = Uri.parse(url);
      final ext = p.extension(uri.path).toLowerCase();
      if (ext.isNotEmpty) return ext;
    } catch (_) {}
    return '.ts';
  }

  Future<void> _writeMeta({
    required Directory folder,
    required String title,
    String? posterUrl,
    required String sourceMode,
    required String localFile,
    required String originalUrl,
    required int duration,
    String? seriesId,
    String? channelId,
    String? seriesTitle,
    int? episodeNumber,
    int? totalBytes,
  }) async {
    final meta = <String, dynamic>{
      'title': title,
      'poster_url': posterUrl,
      'source_mode': sourceMode,
      'local_file': localFile,
      'original_url': originalUrl,
      'duration': duration,
      'downloaded_at': DateTime.now().millisecondsSinceEpoch,
      if (seriesId != null) 'series_id': seriesId,
      if (channelId != null) 'channel_id': channelId,
      if (seriesTitle != null) 'series_title': seriesTitle,
      if (episodeNumber != null) 'episode_number': episodeNumber,
      if (totalBytes != null && totalBytes > 0) 'total_bytes': totalBytes,
    };
    final metaFile = File(p.join(folder.path, 'meta.json'));
    await metaFile.writeAsString(jsonEncode(meta), flush: true);
  }

  Future<void> _cleanCacheIfNeeded() async {
    final dir = _cacheDir;
    if (dir == null || !await dir.exists()) return;

    final folders = <Directory>[];
    int totalSize = 0;

    await for (final entity in dir.list()) {
      if (entity is Directory) {
        final stat = await entity.stat();
        final age = DateTime.now().difference(stat.modified);
        if (age.inDays > _maxCacheAgeDays) {
          await entity.delete(recursive: true);
          _cachedKeys.remove(p.basename(entity.path));
          continue;
        }
        final size = await _folderSize(entity);
        totalSize += size;
        folders.add(entity);
      }
    }

    final totalSizeMB = totalSize / (1024 * 1024);
    if (totalSizeMB <= _maxCacheSizeMB) return;

    folders.sort((a, b) {
      return a.statSync().modified.compareTo(b.statSync().modified);
    });

    for (final folder in folders) {
      final size = await _folderSize(folder);
      await folder.delete(recursive: true);
      _cachedKeys.remove(p.basename(folder.path));
      totalSize -= size;
      if (totalSize / (1024 * 1024) <= _maxCacheSizeMB * 0.8) break;
    }
  }

  Future<int> _folderSize(Directory folder) async {
    int size = 0;
    try {
      await for (final entity in folder.list(recursive: true)) {
        if (entity is File) {
          size += await entity.length();
        }
      }
    } catch (_) {}
    return size;
  }
}

class _HlsVariant {
  final int? bandwidth;
  final String? resolution;
  final String? url;

  const _HlsVariant({
    this.bandwidth,
    this.resolution,
    this.url,
  });
}

class DownloadProgress {
  final double percent;
  final int downloadedBytes;
  final int totalBytes;

  const DownloadProgress({
    required this.percent,
    required this.downloadedBytes,
    required this.totalBytes,
  });
}

/// One cached VOD asset, as surfaced by [VodCacheService.listAllCached].
class CachedVodItem {
  final String mediaType;
  final String mediaId;
  final String title;
  final String? posterUrl;
  final int duration;
  final int downloadedAt;
  final String originalUrl;
  final String? seriesId;
  final String? channelId;
  final String? seriesTitle;
  final int? episodeNumber;
  final int? downloadedBytes;
  final int? totalBytes;

  const CachedVodItem({
    required this.mediaType,
    required this.mediaId,
    required this.title,
    required this.posterUrl,
    required this.duration,
    required this.downloadedAt,
    required this.originalUrl,
    this.seriesId,
    this.channelId,
    this.seriesTitle,
    this.episodeNumber,
    this.downloadedBytes,
    this.totalBytes,
  });
}
