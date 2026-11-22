import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../../channel/screens/channel_series_detail_screen.dart';
import '../../channel/services/channel_content_service.dart';
import '../models/vod_playback_args.dart';
import '../services/vod_cache_service.dart';
import '../widgets/episode_thumbnail.dart';
import 'vod_player_screen.dart';

class DownloadsScreen extends StatefulWidget {
  const DownloadsScreen({super.key});

  @override
  State<DownloadsScreen> createState() => _DownloadsScreenState();
}

class _DownloadsScreenState extends State<DownloadsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _loading = true;
  int _totalDownloadedItems = 0;
  String _deviceSpaceLeft = '—';

  List<CachedVodItem> _cachedItems = const <CachedVodItem>[];
  List<String> _downloadingKeys = const <String>[];
  List<CachedVodItem> _pendingItems = const <CachedVodItem>[];

  final Map<String, double> _downloadPct = {};
  final Map<String, StreamSubscription<DownloadProgress>> _subs = {};
  static const int _pageSize = 20;
  int _downloadedPage = 0;
  int _downloadingPage = 0;
  int _pendingPage = 0;

  bool _selectionMode = false;
  final Set<String> _selectedKeys = <String>{};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    VodCacheService.instance.beaconNotifier.addListener(_onBeaconChanged);
    _refresh();
  }

  void _onBeaconChanged() {
    if (!mounted) return;
    _syncListsFromCache();
  }

  @override
  void dispose() {
    VodCacheService.instance.beaconNotifier.removeListener(_onBeaconChanged);
    for (final sub in _subs.values) {
      sub.cancel();
    }
    _subs.clear();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _syncListsFromCache() async {
    final cached = await VodCacheService.instance.listAllCached();
    final pending = await VodCacheService.instance.getPendingResumeItems();
    final downloading = VodCacheService.instance.downloadingKeys.toList();
    if (!mounted) return;
    setState(() {
      _cachedItems = cached;
      _pendingItems = pending;
      _downloadingKeys = downloading;
      _totalDownloadedItems = cached.length;
    });
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    setState(() => _loading = true);
    await VodCacheService.instance.initialize();
    final cached = await VodCacheService.instance.listAllCached();
    final pending = await VodCacheService.instance.getPendingResumeItems();
    final downloading = VodCacheService.instance.downloadingKeys.toList();

    for (final key in downloading) {
      final sep = key.indexOf('_');
      if (sep <= 0) continue;
      final mediaType = key.substring(0, sep);
      final mediaId = key.substring(sep + 1);
      final cur = VodCacheService.instance.currentProgress(mediaType, mediaId);
      if (cur != null) {
        _downloadPct[key] = cur.percent;
      }
      final stream =
          VodCacheService.instance.progressStream(mediaType, mediaId);
      if (stream != null && !_subs.containsKey(key)) {
        _subs[key] = stream.listen((p) {
          if (!mounted) return;
          setState(() => _downloadPct[key] = p.percent);
        });
      }
    }

    String spaceLeft;
    try {
      final base = await getApplicationSupportDirectory();
      spaceLeft = _formatFreeSpace(await _freeBytes(base.path));
    } catch (_) {
      spaceLeft = '—';
    }
    if (!mounted) return;
    setState(() {
      _cachedItems = cached;
      _pendingItems = pending;
      _downloadingKeys = downloading;
      _totalDownloadedItems = cached.length;
      _deviceSpaceLeft = spaceLeft;
      _loading = false;
    });
  }

  Future<int> _freeBytes(String path) async {
    try {
      final result = await Process.run('df', ['-k', path], runInShell: true);
      final lines = result.stdout.toString().trim().split('\n');
      if (lines.length >= 2) {
        final parts = lines[1].trim().split(RegExp(r'\s+'));
        if (parts.length >= 4) {
          final availKb = int.tryParse(parts[3]);
          if (availKb != null && availKb > 0) return availKb * 1024;
        }
      }
    } catch (_) {}
    return 0;
  }

  String _formatFreeSpace(int bytes) {
    if (bytes <= 0) return '—';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).round()} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  String _formatSize(int? bytes) {
    if (bytes == null || bytes <= 0) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  List<_DownloadedGroup> _buildDownloadedGroups() {
    final bySeries = <String, List<CachedVodItem>>{};
    final standalone = <CachedVodItem>[];
    for (final item in _cachedItems) {
      final sid = item.seriesId;
      if (sid != null && sid.isNotEmpty) {
        bySeries.putIfAbsent(sid, () => <CachedVodItem>[]).add(item);
      } else {
        standalone.add(item);
      }
    }

    final groups = <_DownloadedGroup>[];
    for (final entry in bySeries.entries) {
      groups.add(_DownloadedGroup(seriesId: entry.key, items: entry.value));
    }
    for (final item in standalone) {
      groups.add(_DownloadedGroup(seriesId: null, items: [item]));
    }
    return groups;
  }

  List<T> _paged<T>(List<T> items, int page) {
    final start = page * _pageSize;
    if (start >= items.length) return const [];
    return items.skip(start).take(_pageSize).toList();
  }

  int _totalPages(int length) =>
      length == 0 ? 1 : ((length - 1) ~/ _pageSize) + 1;

  void _openGroup(_DownloadedGroup group) {
    final first = group.items.first;
    final seriesId = group.seriesId;
    final channelId = first.channelId;

    if (seriesId != null && seriesId.isNotEmpty) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ChannelSeriesDetailScreen(
            channelId: channelId ?? '',
            series: ChannelSeries(
              id: seriesId,
              channelId: channelId ?? '',
              title: first.seriesTitle ?? first.title,
              coverUrl: first.posterUrl,
            ),
          ),
        ),
      );
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => VodPlayerScreen(
          args: VodPlaybackArgs(
            mediaType: first.mediaType,
            mediaId: first.mediaId,
            channelId: channelId ?? '',
            title: first.title,
            posterUrl: first.posterUrl,
            videoSourceMode: 'hosted',
            playbackUrl: null,
            duration: first.duration,
            downloadable: true,
          ),
        ),
      ),
    );
  }

  void _resumePending(CachedVodItem item) {
    if (item.originalUrl.isEmpty) return;
    final key = '${item.mediaType}_${item.mediaId}';
    VodCacheService.instance
        .download(
          mediaType: item.mediaType,
          mediaId: item.mediaId,
          title: item.title,
          posterUrl: item.posterUrl,
          sourceMode: item.originalUrl.toLowerCase().endsWith('.m3u8')
              ? 'hls'
              : 'hosted',
          url: item.originalUrl,
          duration: item.duration,
          seriesId: item.seriesId,
          channelId: item.channelId,
          seriesTitle: item.seriesTitle,
          episodeNumber: item.episodeNumber,
        )
        .whenComplete(() {
          _subs.remove(key)?.cancel();
          if (mounted) _refresh();
        });
    _refresh();
  }

  Future<void> _pauseKey(String key) async {
    final sep = key.indexOf('_');
    if (sep <= 0) return;
    await VodCacheService.instance
        .pauseDownload(key.substring(0, sep), key.substring(sep + 1));
    _subs.remove(key)?.cancel();
    await _refresh();
  }

  Future<void> _cancelKey(String key) async {
    final sep = key.indexOf('_');
    if (sep <= 0) return;
    await VodCacheService.instance
        .cancelDownload(key.substring(0, sep), key.substring(sep + 1));
    _subs.remove(key)?.cancel();
    _downloadPct.remove(key);
    await _refresh();
  }

  Future<void> _pauseSelected() async {
    for (final key in _selectedKeys.toList()) {
      await _pauseKey(key);
    }
    if (mounted) {
      setState(() {
        _selectionMode = false;
        _selectedKeys.clear();
      });
    }
  }

  Future<void> _resumeSelected() async {
    final toResume = _pendingItems
        .where((i) => _selectedKeys.contains('${i.mediaType}_${i.mediaId}'))
        .toList()
      ..sort((a, b) => (a.episodeNumber ?? 0).compareTo(b.episodeNumber ?? 0));
    for (final item in toResume) {
      _resumePending(item);
    }
    if (mounted) {
      setState(() {
        _selectionMode = false;
        _selectedKeys.clear();
      });
    }
  }

  Future<void> _cancelSelected() async {
    for (final key in _selectedKeys.toList()) {
      await _cancelKey(key);
    }
    if (mounted) {
      setState(() {
        _selectionMode = false;
        _selectedKeys.clear();
      });
    }
  }

  Widget _statusPill(String text, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildStatsBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Nocturne.border, width: 1),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  _statusPill(
                    '$_totalDownloadedItems Downloaded',
                    const Color(0xFF2E7D32),
                  ),
                  if (_pendingItems.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    _statusPill(
                      '${_pendingItems.length} Resume DL',
                      const Color(0xFFEF6C00),
                    ),
                  ],
                ],
              ),
              Row(
                children: [
                  const Icon(Icons.storage_rounded,
                      size: 15, color: Nocturne.textMuted),
                  const SizedBox(width: 5),
                  Text(
                    'Free: $_deviceSpaceLeft',
                    style: const TextStyle(
                      color: Nocturne.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (_downloadingKeys.isNotEmpty || _pendingItems.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (_downloadingKeys.isNotEmpty)
                  TextButton.icon(
                    onPressed: () async {
                      await VodCacheService.instance.pauseAll();
                      await _refresh();
                    },
                    icon: const Icon(Icons.pause_circle_filled_rounded,
                        size: 16, color: Color(0xFFEF6C00)),
                    label: const Text(
                      'Pause All',
                      style: TextStyle(
                          color: Color(0xFFEF6C00),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                if (_pendingItems.isNotEmpty)
                  TextButton.icon(
                    onPressed: () {
                      final sorted = List<CachedVodItem>.from(_pendingItems)
                        ..sort((a, b) => (a.episodeNumber ?? 0)
                            .compareTo(b.episodeNumber ?? 0));
                      for (final item in sorted) {
                        _resumePending(item);
                      }
                    },
                    icon: const Icon(Icons.play_circle_fill_rounded,
                        size: 16, color: Color(0xFF2E7D32)),
                    label: const Text(
                      'Resume All',
                      style: TextStyle(
                          color: Color(0xFF2E7D32),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                TextButton.icon(
                  onPressed: () async {
                    await VodCacheService.instance.cancelAll();
                    await _refresh();
                  },
                  icon: const Icon(Icons.cancel_rounded,
                      size: 16, color: Color(0xFFC62828)),
                  label: const Text(
                    'Cancel All',
                    style: TextStyle(
                        color: Color(0xFFC62828),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ],
          if (_selectionMode) ...[
            const Divider(color: Nocturne.border, height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                ElevatedButton(
                  onPressed: _selectedKeys.isEmpty ? null : _pauseSelected,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF6C00),
                    foregroundColor: Colors.white,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                  ),
                  child: const Text('Pause Selected',
                      style:
                          TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                ),
                ElevatedButton(
                  onPressed: _selectedKeys.isEmpty ? null : _resumeSelected,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2E7D32),
                    foregroundColor: Colors.white,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                  ),
                  child: const Text('Resume Selected',
                      style:
                          TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                ),
                ElevatedButton(
                  onPressed: _selectedKeys.isEmpty ? null : _cancelSelected,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC62828),
                    foregroundColor: Colors.white,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                  ),
                  child: const Text('Cancel / Delete Selected',
                      style:
                          TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPaginationBar({
    required int page,
    required int totalItems,
    required ValueChanged<int> onPageChanged,
  }) {
    final totalPages = _totalPages(totalItems);
    if (totalPages <= 1) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          TextButton.icon(
            onPressed: page > 0 ? () => onPageChanged(page - 1) : null,
            icon: const Icon(Icons.chevron_left_rounded, size: 18),
            label: const Text('Prev'),
          ),
          Text(
            'Page ${page + 1} of $totalPages',
            style: const TextStyle(color: Nocturne.textMuted, fontSize: 12),
          ),
          TextButton.icon(
            onPressed:
                page + 1 < totalPages ? () => onPageChanged(page + 1) : null,
            icon: const Icon(Icons.chevron_right_rounded, size: 18),
            label: const Text('Next'),
          ),
        ],
      ),
    );
  }

  Widget _buildDownloadingTab() {
    if (_downloadingKeys.isEmpty) {
      return _emptyTab(Icons.file_download_off_rounded, 'No active downloads');
    }
    final pageItems = _paged(_downloadingKeys, _downloadingPage);
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: Nocturne.gold,
            onRefresh: _refresh,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: pageItems.length,
              itemBuilder: (_, i) {
                final key = pageItems[i];
                final sep = key.indexOf('_');
                final mediaType = sep > 0 ? key.substring(0, sep) : 'episode';
                final mediaId = sep > 0 ? key.substring(sep + 1) : key;
                final activeItem = VodCacheService.instance.activeItem(key);
                final isQueued =
                    VodCacheService.instance.isQueued(mediaType, mediaId);
                final prog =
                    VodCacheService.instance.currentProgress(mediaType, mediaId);
                final pct =
                    (prog?.percent ?? _downloadPct[key] ?? 0).clamp(0.0, 100.0);

                return Container(
                  margin:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: Nocturne.surfaceRaised,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Nocturne.border, width: 1),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            if (_selectionMode)
                              Checkbox(
                                value: _selectedKeys.contains(key),
                                activeColor: Nocturne.gold,
                                checkColor: Colors.black,
                                onChanged: (v) {
                                  setState(() {
                                    if (v == true) {
                                      _selectedKeys.add(key);
                                    } else {
                                      _selectedKeys.remove(key);
                                    }
                                  });
                                },
                              ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    activeItem?.title ?? key,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Nocturne.text,
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Row(
                                    children: [
                                      _statusPill(
                                        isQueued
                                            ? 'Queued (Waiting for preceding ep)'
                                            : 'Downloading ${pct.toInt()}%',
                                        const Color(0xFF1565C0),
                                      ),
                                      if (prog != null &&
                                          prog.totalBytes > 0) ...[
                                        const SizedBox(width: 8),
                                        Text(
                                          '${_formatSize(prog.downloadedBytes)} / ${_formatSize(prog.totalBytes)}',
                                          style: const TextStyle(
                                            color: Nocturne.textFaint,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Pause download',
                              onPressed: () => _pauseKey(key),
                              icon: const Icon(
                                Icons.pause_circle_filled_rounded,
                                color: Color(0xFFEF6C00),
                                size: 26,
                              ),
                            ),
                            IconButton(
                              tooltip: 'Cancel download',
                              onPressed: () => _cancelKey(key),
                              icon: const Icon(
                                Icons.cancel_rounded,
                                color: Color(0xFFC62828),
                                size: 24,
                              ),
                            ),
                          ],
                        ),
                      ),
                      LinearProgressIndicator(
                        value: pct / 100.0,
                        minHeight: 4,
                        color: const Color(0xFF29B6F6),
                        backgroundColor: Nocturne.border,
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        _buildPaginationBar(
          page: _downloadingPage,
          totalItems: _downloadingKeys.length,
          onPageChanged: (p) => setState(() => _downloadingPage = p),
        ),
      ],
    );
  }

  Widget _buildDownloadedTab() {
    final groups = _buildDownloadedGroups();
    if (groups.isEmpty) {
      return _emptyTab(Icons.download_rounded, 'No downloaded items yet');
    }
    final pageItems = _paged(groups, _downloadedPage);
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: Nocturne.gold,
            onRefresh: _refresh,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: pageItems.length,
              itemBuilder: (_, i) {
                final group = pageItems[i];
                final first = group.items.first;
                final isSeries = group.seriesId != null;
                final title = isSeries
                    ? (first.seriesTitle ?? first.title)
                    : first.title;
                final subtitle = isSeries
                    ? '${group.items.length} episode${group.items.length == 1 ? '' : 's'} downloaded'
                    : 'Downloaded · ${first.mediaType}';
                final firstKey = '${first.mediaType}_${first.mediaId}';

                return InkWell(
                  onTap: () => _openGroup(group),
                  child: Container(
                    margin:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: Nocturne.surfaceRaised,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Nocturne.border, width: 1),
                    ),
                    child: Row(
                      children: [
                        if (_selectionMode)
                          Checkbox(
                            value: _selectedKeys.contains(firstKey),
                            activeColor: Nocturne.gold,
                            checkColor: Colors.black,
                            onChanged: (v) {
                              setState(() {
                                for (final it in group.items) {
                                  final k = '${it.mediaType}_${it.mediaId}';
                                  if (v == true) {
                                    _selectedKeys.add(k);
                                  } else {
                                    _selectedKeys.remove(k);
                                  }
                                }
                              });
                            },
                          ),
                        ClipRRect(
                          borderRadius: const BorderRadius.horizontal(
                            left: Radius.circular(10),
                          ),
                          child: SizedBox(
                            width: 96,
                            height: 74,
                            child: EpisodeThumbnail(
                              posterUrl: first.posterUrl,
                              videoUrl: first.originalUrl,
                              episodeNumber: first.episodeNumber ?? (i + 1),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Nocturne.text,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Row(
                                  children: [
                                    _statusPill(
                                      subtitle,
                                      const Color(0xFF2E7D32),
                                    ),
                                    if ((first.totalBytes ?? 0) > 0) ...[
                                      const SizedBox(width: 8),
                                      Text(
                                        _formatSize(first.totalBytes),
                                        style: const TextStyle(
                                          color: Nocturne.textFaint,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.only(right: 12),
                          child: Icon(
                            Icons.chevron_right_rounded,
                            color: Nocturne.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        _buildPaginationBar(
          page: _downloadedPage,
          totalItems: groups.length,
          onPageChanged: (p) => setState(() => _downloadedPage = p),
        ),
      ],
    );
  }

  Widget _buildPendingTab() {
    if (_pendingItems.isEmpty) {
      return _emptyTab(
        Icons.download_for_offline_rounded,
        'No paused or interrupted downloads',
      );
    }
    final pageItems = _paged(_pendingItems, _pendingPage);
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: Nocturne.gold,
            onRefresh: _refresh,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: pageItems.length,
              itemBuilder: (_, i) {
                final item = pageItems[i];
                final key = '${item.mediaType}_${item.mediaId}';
                final isFailed = VodCacheService.instance
                    .isFailed(item.mediaType, item.mediaId);
                final partBytes = item.downloadedBytes ?? 0;
                final totalBytes = item.totalBytes ?? 0;
                final pct = totalBytes > 0
                    ? ((partBytes / totalBytes) * 100).clamp(0.0, 100.0)
                    : 0.0;

                return Container(
                  margin:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: Nocturne.surfaceRaised,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Nocturne.border, width: 1),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            if (_selectionMode)
                              Checkbox(
                                value: _selectedKeys.contains(key),
                                activeColor: Nocturne.gold,
                                checkColor: Colors.black,
                                onChanged: (v) {
                                  setState(() {
                                    if (v == true) {
                                      _selectedKeys.add(key);
                                    } else {
                                      _selectedKeys.remove(key);
                                    }
                                  });
                                },
                              ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Nocturne.text,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 4,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      _statusPill(
                                        isFailed
                                            ? 'Failed download'
                                            : 'Resume download',
                                        isFailed
                                            ? const Color(0xFFC62828)
                                            : const Color(0xFFEF6C00),
                                      ),
                                      if (partBytes > 0)
                                        Text(
                                          totalBytes > 0
                                              ? '${_formatSize(partBytes)} / ${_formatSize(totalBytes)} (${pct.toInt()}%)'
                                              : '${_formatSize(partBytes)} saved',
                                          style: const TextStyle(
                                            color: Nocturne.textFaint,
                                            fontSize: 11,
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton(
                              onPressed: () => _resumePending(item),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isFailed
                                    ? const Color(0xFFC62828)
                                    : const Color(0xFFEF6C00),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                                minimumSize: Size.zero,
                              ),
                              child: Text(
                                isFailed ? 'Retry' : 'Resume',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            IconButton(
                              tooltip: 'Cancel and delete partial download',
                              onPressed: () => _cancelKey(key),
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                color: Nocturne.textMuted,
                                size: 20,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (pct > 0)
                        LinearProgressIndicator(
                          value: pct / 100.0,
                          minHeight: 4,
                          color: isFailed
                              ? const Color(0xFFC62828)
                              : const Color(0xFFEF6C00),
                          backgroundColor: Nocturne.border,
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        _buildPaginationBar(
          page: _pendingPage,
          totalItems: _pendingItems.length,
          onPageChanged: (p) => setState(() => _pendingPage = p),
        ),
      ],
    );
  }

  Widget _emptyTab(IconData icon, String message) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 52, color: Nocturne.textHint),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(color: Nocturne.textMuted, fontSize: 14),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      appBar: AppBar(
        backgroundColor: Nocturne.surface,
        iconTheme: const IconThemeData(color: Nocturne.text),
        elevation: 0,
        title: const Text(
          'Downloads',
          style: TextStyle(color: Nocturne.text, fontWeight: FontWeight.w600),
        ),
        actions: [
          TextButton.icon(
            onPressed: () {
              setState(() {
                _selectionMode = !_selectionMode;
                if (!_selectionMode) _selectedKeys.clear();
              });
            },
            icon: Icon(
              _selectionMode ? Icons.close_rounded : Icons.checklist_rounded,
              color: Nocturne.gold,
              size: 18,
            ),
            label: Text(
              _selectionMode ? 'Done' : 'Select',
              style: const TextStyle(
                color: Nocturne.gold,
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Nocturne.gold,
          labelColor: Nocturne.gold,
          unselectedLabelColor: Nocturne.textMuted,
          tabs: [
            Tab(text: 'Downloading (${_downloadingKeys.length})'),
            Tab(text: 'Downloaded (${_cachedItems.length})'),
            Tab(text: 'Pending (${_pendingItems.length})'),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Nocturne.gold),
            )
          : Column(
              children: [
                _buildStatsBanner(),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildDownloadingTab(),
                      _buildDownloadedTab(),
                      _buildPendingTab(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _DownloadedGroup {
  final String? seriesId;
  final List<CachedVodItem> items;

  const _DownloadedGroup({required this.seriesId, required this.items});
}
