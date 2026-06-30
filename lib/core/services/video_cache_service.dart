import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Service for caching video thumbnails and videos to device storage
/// Reduces network bandwidth and improves loading performance
class VideoCacheService {
  static const String _cacheVersionKey = 'video_cache_version';
  static const int _currentCacheVersion = 1;
  static const int _maxCacheSizeMB = 500; // 500MB max cache size
  static const int _maxCacheAgeDays = 7; // Cache expires after 7 days

  static VideoCacheService? _instance;
  VideoCacheService._();

  static VideoCacheService get instance {
    _instance ??= VideoCacheService._();
    return _instance!;
  }

  Directory? _cacheDir;
  SharedPreferences? _prefs;

  /// Initialize the cache service
  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    _cacheDir = await getTemporaryDirectory();
    
    // Check if cache version changed, clear cache if so
    final cachedVersion = _prefs!.getInt(_cacheVersionKey) ?? 0;
    if (cachedVersion < _currentCacheVersion) {
      await clearCache();
      await _prefs!.setInt(_cacheVersionKey, _currentCacheVersion);
    }
  }

  /// Get cached file path for a URL
  Future<File?> getCachedFile(String url) async {
    if (_cacheDir == null) return null;
    
    final fileName = _generateCacheKey(url);
    final file = File('${_cacheDir!.path}/$fileName');
    
    if (await file.exists()) {
      // Check if file is not too old
      final lastModified = await file.lastModified();
      final age = DateTime.now().difference(lastModified);
      if (age.inDays > _maxCacheAgeDays) {
        await file.delete();
        return null;
      }
      return file;
    }
    return null;
  }

  /// Cache a file from URL
  Future<File?> cacheFile(String url, List<int> bytes) async {
    if (_cacheDir == null) return null;
    
    final fileName = _generateCacheKey(url);
    final file = File('${_cacheDir!.path}/$fileName');
    
    try {
      await file.writeAsBytes(bytes);
      
      // Check cache size and clean if needed
      await _cleanCacheIfNeeded();
      
      return file;
    } catch (e) {
      // If caching fails, return null but don't crash
      return null;
    }
  }

  /// Generate a cache key from URL
  String _generateCacheKey(String url) {
    // Use hash of URL as filename
    return url.hashCode.toString();
  }

  /// Clean cache if it exceeds max size
  Future<void> _cleanCacheIfNeeded() async {
    if (_cacheDir == null) return;
    
    final cacheDir = _cacheDir!;
    final files = await cacheDir.list().toList();
    
    int totalSize = 0;
    final fileInfos = <FileSystemEntity, int>{};
    
    for (final file in files) {
      if (file is File) {
        final stat = await file.stat();
        totalSize += stat.size;
        fileInfos[file] = stat.modified.millisecondsSinceEpoch;
      }
    }
    
    // Convert to MB
    final totalSizeMB = totalSize / (1024 * 1024);
    
    if (totalSizeMB > _maxCacheSizeMB) {
      // Sort by last modified (oldest first)
      final sortedFiles = fileInfos.entries.toList()
        ..sort((a, b) => a.value.compareTo(b.value));
      
      // Delete oldest files until under limit
      int deletedSize = 0;
      final targetSize = (_maxCacheSizeMB * 0.8) * (1024 * 1024); // 80% of max
      
      for (final entry in sortedFiles) {
        if (totalSize - deletedSize <= targetSize) break;
        
        try {
          await entry.key.delete();
          final stat = await entry.key.stat();
          deletedSize += stat.size;
        } catch (e) {
          // Ignore deletion errors
        }
      }
    }
  }

  /// Clear all cached files
  Future<void> clearCache() async {
    if (_cacheDir == null) return;
    
    try {
      final files = await _cacheDir!.list().toList();
      for (final file in files) {
        if (file is File) {
          await file.delete();
        }
      }
    } catch (e) {
      // Ignore errors during cache clear
    }
  }

  /// Get cache size in MB
  Future<int> getCacheSizeMB() async {
    if (_cacheDir == null) return 0;
    
    int totalSize = 0;
    final files = await _cacheDir!.list().toList();
    
    for (final file in files) {
      if (file is File) {
        final stat = await file.stat();
        totalSize += stat.size;
      }
    }
    
    return totalSize ~/ (1024 * 1024);
  }
}
