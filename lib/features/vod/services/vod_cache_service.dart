import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Generalized offline cache for VOD (movies and series episodes).
///
/// Supports:
///   - Direct MP4 / progressive files (`hosted_url`, `external_url`)
///   - HLS streams by downloading a selected variant's playlist + segments and
///     rewriting the playlist to point at local files.
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
  final Map<String, String> _failedKeys = <String, String>{};
  final _progressControllers = <String, StreamController<DownloadProgress>>{};

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

        final localPath = await _localAssetPath(entity);
        if (localPath != null && await File(localPath).exists()) {
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
      if (fileName == null) return null;
      return p.join(folder.path, fileName);
    } catch (_) {
      return null;
    }
  }

  bool isCached(String mediaType, String mediaId) {
    final key = _key(mediaType, mediaId);
    if (!_initialized) return false;
    return _cachedKeys.contains(key);
  }

  bool isDownloading(String mediaType, String mediaId) {
    return _downloadingKeys.contains(_key(mediaType, mediaId));
  }

  String? lastError(String mediaType, String mediaId) {
    return _failedKeys[_key(mediaType, mediaId)];
  }

  /// Returns the local file path to play, or null if not cached.
  Future<String?> getLocalPath(String mediaType, String mediaId) async {
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
    final controller = _progressControllers[key];
    if (controller != null && !controller.isClosed) {
      controller.add(progress);
    }
  }

  /// Delete a cached download.
  Future<void> delete(String mediaType, String mediaId) async {
    final key = _key(mediaType, mediaId);
    final folder = _folderFor(key);
    if (await folder.exists()) {
      await folder.delete(recursive: true);
    }
    _cachedKeys.remove(key);
    _failedKeys.remove(key);
  }

  String _key(String mediaType, String mediaId) => '${mediaType}_$mediaId';

  /// Public entry point: download a movie or episode for offline playback.
  /// [url] must be the resolved public playback URL.
  /// [sourceMode] is 'hosted', 'external_url', 'hls', or 'embed'.
  Future<void> download({
    required String mediaType,
    required String mediaId,
    required String title,
    String? posterUrl,
    required String sourceMode,
    String? url,
    required int duration,
    int? targetBps,
  }) async {
    if (_cacheDir == null) await initialize();
    if (url == null || url.isEmpty) {
      _failedKeys[_key(mediaType, mediaId)] = 'No video URL available';
      return;
    }

    final key = _key(mediaType, mediaId);
    if (_cachedKeys.contains(key)) return;
    if (_downloadingKeys.contains(key)) return;

    _downloadingKeys.add(key);
    _failedKeys.remove(key);

    final folder = _folderFor(key);
    if (!await folder.exists()) await folder.create(recursive: true);

    try {
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
        );
      }
      _cachedKeys.add(key);
      _failedKeys.remove(key);
      await _cleanCacheIfNeeded();
    } catch (e) {
      debugPrint('[VodCache] Download failed $key: $e');
      _failedKeys[key] = e.toString();
    } finally {
      _downloadingKeys.remove(key);
    }
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
  }) async {
    final tmpFile = File(p.join(folder.path, 'video.part'));
    final finalFile = File(p.join(folder.path, 'video.mp4'));

    final client = http.Client();
    try {
      final streamedResp = await _getWithRetry(client, url);

      if (streamedResp.statusCode != 200) {
        throw Exception('HTTP ${streamedResp.statusCode}');
      }

      final contentLength =
          int.tryParse(streamedResp.headers['content-length'] ?? '') ?? 0;
      final sink = tmpFile.openWrite();
      int received = 0;

      await streamedResp.stream.forEach((chunk) {
        sink.add(chunk);
        received += chunk.length;
        if (contentLength > 0) {
          _emitProgress(
            key,
            DownloadProgress(
              percent: (received / contentLength) * 100,
              downloadedBytes: received,
              totalBytes: contentLength,
            ),
          );
        }
      }).timeout(const Duration(minutes: 30));

      await sink.flush();
      await sink.close();

      if (received < _minValidFileBytes) {
        throw Exception('Downloaded body too small ($received bytes)');
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
      );

      _emitProgress(
        key,
        DownloadProgress(
          percent: 100,
          downloadedBytes: received,
          totalBytes: contentLength,
        ),
      );
    } finally {
      client.close();
      if (await tmpFile.exists()) await tmpFile.delete();
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
  }) async {
    final client = http.Client();
    try {
      final masterText = await _fetchText(client, manifestUrl);
      final baseUrl = _baseUrl(manifestUrl);

      String mediaPlaylistText;
      String mediaPlaylistUrl;

      if (_isMasterPlaylist(masterText)) {
        final variant = _selectVariant(masterText, baseUrl, targetBps: targetBps);
        if (variant == null) {
          throw Exception('Could not select HLS variant from master playlist');
        }
        mediaPlaylistUrl = variant;
        mediaPlaylistText = await _fetchText(client, mediaPlaylistUrl);
      } else {
        mediaPlaylistUrl = manifestUrl;
        mediaPlaylistText = masterText;
      }

      final playlistBase = _baseUrl(mediaPlaylistUrl);
      final lines = LineSplitter.split(mediaPlaylistText).toList();
      final outLines = <String>[];
      final fileMap = <String, String>{}; // absolute URL -> local file name
      int segmentIndex = 0;
      int totalBytes = 0;

      // First pass: estimate total bytes and discover map/key/segment URLs.
      final discoverUrls = <String>[];
      final mapUrls = <String>[];
      final keyUrls = <String>[];

      for (final line in lines) {
        final trimmed = line.trim();
        if (trimmed.startsWith('#EXT-X-MAP:URI=')) {
          final rawUri = _extractUri(trimmed, 'URI=');
          if (rawUri != null) {
            final absolute = _resolveUrl(rawUri, playlistBase);
            mapUrls.add(absolute);
          }
        } else if (trimmed.startsWith('#EXT-X-KEY')) {
          final rawUri = _extractUri(trimmed, 'URI=');
          if (rawUri != null) {
            final absolute = _resolveUrl(rawUri, playlistBase);
            keyUrls.add(absolute);
          }
        } else if (trimmed.isNotEmpty &&
                   !trimmed.startsWith('#') &&
                   !trimmed.toLowerCase().endsWith('.m3u8')) {
          final absolute = _resolveUrl(trimmed, playlistBase);
          discoverUrls.add(absolute);
        }
      }

      final allUrls = [...mapUrls, ...keyUrls, ...discoverUrls];

      // Estimate total size with HEAD requests.
      for (int i = 0; i < allUrls.length; i += 5) {
        final batch = allUrls.skip(i).take(5).toList();
        final sizes = await Future.wait(
          batch.map((u) => _headSize(client, u)),
        );
        totalBytes += sizes.fold(0, (a, b) => a + b);
      }

      int downloadedBytes = 0;

      for (final line in lines) {
        final trimmed = line.trim();
        if (trimmed.startsWith('#EXT-X-MAP:URI=')) {
          final rawUri = _extractUri(trimmed, 'URI=');
          if (rawUri != null) {
            final absolute = _resolveUrl(rawUri, playlistBase);
            final local = fileMap[absolute] ??= _mapFileName(segmentIndex++);
            await _downloadFile(client, absolute, File(p.join(folder.path, local)));
            downloadedBytes += await File(p.join(folder.path, local)).length();
            outLines.add(_replaceUri(line, rawUri, local));
            continue;
          }
        }

        if (trimmed.startsWith('#EXT-X-KEY')) {
          final rawUri = _extractUri(trimmed, 'URI=');
          if (rawUri != null) {
            final absolute = _resolveUrl(rawUri, playlistBase);
            final local = fileMap[absolute] ??= 'key_${segmentIndex++}.key';
            await _downloadFile(client, absolute, File(p.join(folder.path, local)));
            downloadedBytes += await File(p.join(folder.path, local)).length();
            outLines.add(_replaceUri(line, rawUri, local));
            continue;
          }
        }

        if (trimmed.isNotEmpty &&
            !trimmed.startsWith('#') &&
            !trimmed.toLowerCase().endsWith('.m3u8')) {
          final absolute = _resolveUrl(trimmed, playlistBase);
          final ext = _segmentExtension(absolute, segmentIndex);
          final local = fileMap[absolute] ??= 'segment_${segmentIndex++}$ext';
          final file = File(p.join(folder.path, local));
          await _downloadFile(client, absolute, file);
          final size = await file.length();
          downloadedBytes += size;
          outLines.add(local);

          if (totalBytes > 0) {
            _emitProgress(
              key,
              DownloadProgress(
                percent: (downloadedBytes / totalBytes) * 100,
                downloadedBytes: downloadedBytes,
                totalBytes: totalBytes,
              ),
            );
          }
          continue;
        }

        outLines.add(line);
      }

      final localPlaylist = File(p.join(folder.path, 'index.m3u8'));
      await localPlaylist.writeAsString(outLines.join('\n'));

      await _writeMeta(
        folder: folder,
        title: title,
        posterUrl: posterUrl,
        sourceMode: sourceMode,
        localFile: 'index.m3u8',
        originalUrl: manifestUrl,
        duration: duration,
      );

      _emitProgress(
        key,
        DownloadProgress(
          percent: 100,
          downloadedBytes: downloadedBytes,
          totalBytes: totalBytes,
        ),
      );
    } finally {
      client.close();
    }
  }

  String _baseUrl(String url) {
    final uri = Uri.parse(url);
    final lastSlash = uri.path.lastIndexOf('/');
    if (lastSlash == -1) return '${uri.scheme}://${uri.host}/';
    return uri.replace(path: uri.path.substring(0, lastSlash + 1)).toString();
  }

  String _resolveUrl(String raw, String base) {
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) {
      final baseUri = Uri.parse(base);
      return '${baseUri.scheme}://${baseUri.host}$raw';
    }
    return base + raw;
  }

  Future<http.StreamedResponse> _getWithRetry(http.Client client, String url) async {
    final uri = Uri.parse(url);
    Exception? lastError;
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        final req = http.Request('GET', uri)
          ..headers['User-Agent'] = _userAgent
          ..followRedirects = true;
        final resp = await client
            .send(req)
            .timeout(const Duration(seconds: 30));
        if (resp.statusCode >= 200 && resp.statusCode < 300) return resp;
        throw Exception('HTTP ${resp.statusCode}');
      } catch (e) {
        lastError = e is Exception ? e : Exception('$e');
        if (attempt < 2) await Future.delayed(Duration(seconds: attempt + 1));
      }
    }
    throw lastError ?? Exception('Download failed for $url');
  }

  Future<String> _fetchText(http.Client client, String url) async {
    final resp = await _getWithRetry(client, url);
    return await resp.stream.bytesToString();
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
      // Pick the highest variant that does not exceed the target.
      for (int i = variants.length - 1; i >= 0; i--) {
        final bw = variants[i].bandwidth ?? 0;
        if (bw <= targetBps) return variants[i].url;
      }
      return variants.first.url;
    }

    // Default to the median variant to balance quality/size.
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
    // The URI may be double-quoted, single-quoted, or unquoted.
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
  }) async {
    final meta = <String, dynamic>{
      'title': title,
      'poster_url': posterUrl,
      'source_mode': sourceMode,
      'local_file': localFile,
      'original_url': originalUrl,
      'duration': duration,
      'downloaded_at': DateTime.now().millisecondsSinceEpoch,
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

    // Evict oldest until under budget.
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
