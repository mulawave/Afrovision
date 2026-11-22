import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart'
    hide DownloadProgress;
import 'package:flutter/material.dart';

import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../../core/utils/image_cache_key.dart';
import '../../vod/models/catch_up_models.dart';
import '../../vod/models/vod_playback_args.dart';
import '../../vod/screens/vod_player_screen.dart';
import '../../vod/services/catch_up_service.dart';
import '../../vod/services/vod_cache_service.dart';
import '../../vod/services/vod_service.dart';
import '../../vod/widgets/download_stats_beacon.dart';
import '../../vod/widgets/episode_thumbnail.dart';
import '../services/channel_content_service.dart';

enum _EpisodeViewMode { list, grid, bigCards }

enum _EpisodeSortOrder { epAsc, epDesc, titleAsc, durationDesc }

/// Unified Series & Episodes listing screen used across Channel Profile,
/// Media Center (Home/Catch-Up Continue Watching, Series Tab Continue Watching,
/// Public & Exclusive Series shelves), Search, Watch History, and Downloads.
class ChannelSeriesDetailScreen extends StatefulWidget {
  final String channelId;
  final ChannelSeries series;
  final ChannelSeriesDetail? initialDetail;

  const ChannelSeriesDetailScreen({
    super.key,
    required this.channelId,
    required this.series,
    this.initialDetail,
  });

  @override
  State<ChannelSeriesDetailScreen> createState() =>
      _ChannelSeriesDetailScreenState();
}

class _ChannelSeriesDetailScreenState extends State<ChannelSeriesDetailScreen> {
  static const int _pageSize = 10;

  bool _loading = true;
  String? _error;
  ChannelSeriesDetail? _detail;
  CatchUpItem? _tmdbInfo;

  /// Per-episode watch progress (position + duration), keyed by episode id.
  final Map<String, WatchProgress> _episodeProgress = {};

  /// Per-episode download progress (0-100), keyed by episode id.
  final Map<String, double> _downloadProgress = {};

  /// Cached or probed file sizes (bytes), keyed by episode id.
  final Map<String, int> _episodeSizes = {};

  /// Subscriptions to download progress streams, keyed by episode id.
  final Map<String, StreamSubscription<DownloadProgress>> _downloadSubs = {};

  _EpisodeViewMode _viewMode = _EpisodeViewMode.list;
  _EpisodeSortOrder _sortOrder = _EpisodeSortOrder.epAsc;
  int _currentPage = 0;

  /// Group selection state
  bool _selectionMode = false;
  final Set<String> _selectedEpisodeIds = <String>{};

  @override
  void initState() {
    super.initState();
    if (widget.initialDetail != null) {
      _detail = widget.initialDetail;
      _loading = false;
    }
    VodCacheService.instance.initialize().then((_) {
      if (mounted) {
        _attachExistingDownloadStreams();
        setState(() {});
      }
    });
    VodCacheService.instance.beaconNotifier.addListener(_onBeaconChanged);
    _loadDetail();
    _loadTmdbMetadata();
  }

  void _onBeaconChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    VodCacheService.instance.beaconNotifier.removeListener(_onBeaconChanged);
    // Note: cancelling stream subscriptions here ONLY detaches UI listeners;
    // downloads continue running in VodCacheService.instance singleton!
    for (final sub in _downloadSubs.values) {
      sub.cancel();
    }
    _downloadSubs.clear();
    super.dispose();
  }

  Future<void> _loadTmdbMetadata() async {
    try {
      final info = await CatchUpService.lookupSeriesByTitle(widget.series.title);
      if (mounted && info != null) {
        setState(() => _tmdbInfo = info);
      }
    } catch (_) {}
  }

  Future<void> _loadDetail() async {
    try {
      ChannelSeriesDetail? detail;
      if (widget.channelId.isNotEmpty) {
        detail = await ChannelContentService.getSeriesDetail(
          widget.channelId,
          widget.series.id,
        );
      }
      if (detail == null || detail.allEpisodes.isEmpty) {
        // Fallback to standalone /series/:id endpoint used by Media Center
        try {
          final sm = await VodService.getSeriesById(widget.series.id);
          detail = _seriesModelToChannelDetail(sm);
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        if (detail != null) _detail = detail;
        _loading = false;
      });
      final activeDetail = _detail;
      if (activeDetail != null) {
        _attachExistingDownloadStreams();
        await _loadEpisodeProgress(activeDetail);
        _prefetchEpisodeSizes(activeDetail);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  ChannelSeriesDetail _seriesModelToChannelDetail( dynamic sm) {
    final seasons = <ChannelSeason>[];
    for (final s in sm.seasons) {
      final eps = <ChannelEpisode>[];
      for (final e in s.episodes) {
        eps.add(
          ChannelEpisode(
            id: e.id,
            seasonId: e.seasonId,
            title: e.title,
            episodeNumber: e.episodeNumber,
            videoUrl: e.playbackUrl,
            hostedUrl: e.hostedUrl,
            externalUrl: e.externalUrl,
            hlsUrl: e.hlsUrl,
            embedUrl: e.embedUrl,
            videoSourceMode: e.videoSourceMode,
            duration: e.duration,
            status: e.status,
          ),
        );
      }
      seasons.add(
        ChannelSeason(
          id: s.id,
          seriesId: sm.id,
          seasonNumber: s.seasonNumber,
          title: s.title,
          episodes: eps,
        ),
      );
    }
    return ChannelSeriesDetail(
      id: sm.id,
      channelId: sm.channelId.isNotEmpty ? sm.channelId : widget.channelId,
      title: sm.title,
      description: sm.description ?? widget.series.description,
      coverUrl: sm.coverUrl ?? widget.series.coverUrl,
      status: sm.status,
      seasons: seasons,
    );
  }

  void _attachExistingDownloadStreams() {
    final episodes = _detail?.allEpisodes ?? const <ChannelEpisode>[];
    for (final ep in episodes) {
      final cur = VodCacheService.instance.currentProgress('episode', ep.id);
      if (cur != null) {
        _downloadProgress[ep.id] = cur.percent;
      }
      if (VodCacheService.instance.isDownloading('episode', ep.id)) {
        _listenToEpisodeDownload(ep.id);
      }
    }
  }

  void _listenToEpisodeDownload(String episodeId) {
    if (_downloadSubs.containsKey(episodeId)) return;
    final stream = VodCacheService.instance.progressStream('episode', episodeId);
    if (stream == null) return;
    _downloadSubs[episodeId] = stream.listen(
      (progress) {
        if (!mounted) return;
        setState(() {
          _downloadProgress[episodeId] = progress.percent;
          if (progress.totalBytes > 0) {
            _episodeSizes[episodeId] = progress.totalBytes;
          }
        });
      },
      onError: (_) {},
    );
  }

  /// Uses the exact same Continue Watching source as Media Center PLUS
  /// per-episode progress lookup so playback positions are always unified.
  Future<void> _loadEpisodeProgress(ChannelSeriesDetail detail) async {
    final episodes = detail.allEpisodes;
    if (episodes.isEmpty) return;

    // 1. Seed synchronously from VodService memory cache
    for (final ep in episodes) {
      final syncProg = VodService.getCachedProgressSync('episode', ep.id);
      if (syncProg != null && syncProg.positionSeconds > 0) {
        _episodeProgress[ep.id] = syncProg;
      }
    }
    if (mounted) setState(() {});

    // 2. Load from Media Center's Continue Watching feed (/progress/me)
    try {
      final cwItems = await VodService.getContinueWatchingCached(
        onCached: (cached) {
          for (final item in cached) {
            if (item.mediaType == 'episode' &&
                item.episodeId != null &&
                item.positionSeconds > 0) {
              _episodeProgress[item.episodeId!] = WatchProgress(
                positionSeconds: item.positionSeconds,
                durationSeconds: item.durationSeconds,
                updatedAt: item.updatedAt,
              );
            }
          }
          if (mounted) setState(() {});
        },
      );
      for (final item in cwItems) {
        if (item.mediaType == 'episode' &&
            item.episodeId != null &&
            item.positionSeconds > 0) {
          _episodeProgress[item.episodeId!] = WatchProgress(
            positionSeconds: item.positionSeconds,
            durationSeconds: item.durationSeconds,
            updatedAt: item.updatedAt,
          );
        }
      }
      if (mounted) setState(() {});
    } catch (_) {}

    // 3. Query per-episode progress for any episode (covers completed >=90% episodes too)
    await Future.wait(episodes.map((ep) async {
      try {
        final progress = await VodService.getProgress('episode', ep.id);
        if (progress != null && progress.positionSeconds > 0 && mounted) {
          setState(() {
            _episodeProgress[ep.id] = progress;
          });
        }
      } catch (_) {}
    }));
  }

  void _prefetchEpisodeSizes(ChannelSeriesDetail detail) {
    for (final ep in detail.allEpisodes) {
      VodCacheService.instance
          .getOrFetchFileSize('episode', ep.id, ep.playableUrl)
          .then((bytes) {
        if (bytes != null && bytes > 0 && mounted) {
          setState(() => _episodeSizes[ep.id] = bytes);
        }
      });
    }
  }

  int _progressSeconds(String episodeId) =>
      _episodeProgress[episodeId]?.positionSeconds ?? 0;

  int _effectiveDuration(ChannelEpisode ep) {
    final savedDur = _episodeProgress[ep.id]?.durationSeconds ?? 0;
    if (savedDur > 0) return savedDur;
    return ep.duration;
  }

  bool _isWatchedToEnd(ChannelEpisode ep) {
    final pos = _progressSeconds(ep.id);
    if (pos <= 0) return false;
    final dur = _effectiveDuration(ep);
    if (dur <= 0) return false;
    return pos >= dur * 0.9;
  }

  bool _isPartiallyWatched(ChannelEpisode ep) {
    final pos = _progressSeconds(ep.id);
    if (pos <= 0) return false;
    final dur = _effectiveDuration(ep);
    // Even if channel metadata had duration == 0, any saved position > 0 is partially watched!
    if (dur <= 0) return true;
    return pos < dur * 0.9;
  }

  double _watchProgressFraction(ChannelEpisode ep) {
    final pos = _progressSeconds(ep.id);
    if (pos <= 0) return 0.0;
    final dur = _effectiveDuration(ep);
    if (dur <= 0) return 0.35;
    return (pos / dur).clamp(0.0, 1.0);
  }

  bool _isDownloaded(ChannelEpisode ep) =>
      VodCacheService.instance.isCached('episode', ep.id);

  bool _isDownloading(ChannelEpisode ep) =>
      VodCacheService.instance.isDownloading('episode', ep.id);

  bool _isQueued(ChannelEpisode ep) =>
      VodCacheService.instance.isQueued('episode', ep.id);

  bool _isFailed(ChannelEpisode ep) =>
      VodCacheService.instance.isFailed('episode', ep.id);

  bool _hasPartialDownload(ChannelEpisode ep) =>
      VodCacheService.instance.hasPartialDownload('episode', ep.id);

  String _primaryButtonLabel(ChannelEpisode ep) {
    if (_isDownloaded(ep)) return 'Play Offline';
    if (_isWatchedToEnd(ep)) return 'Replay';
    if (_isPartiallyWatched(ep)) {
      final pos = _progressSeconds(ep.id);
      return 'Resume (${_formatClock(pos)})';
    }
    return 'Stream';
  }

  Color _primaryButtonColor(ChannelEpisode ep) {
    if (_isDownloaded(ep)) return const Color(0xFF2E7D32);
    if (_isWatchedToEnd(ep)) return Nocturne.goldLight;
    if (_isPartiallyWatched(ep)) return Nocturne.gold;
    return Nocturne.gold;
  }

  Color _primaryButtonTextColor(ChannelEpisode ep) {
    if (_isDownloaded(ep)) return Colors.white;
    return Colors.black;
  }

  IconData _primaryButtonIcon(ChannelEpisode ep) {
    if (_isDownloaded(ep)) return Icons.offline_pin_rounded;
    if (_isWatchedToEnd(ep)) return Icons.replay_rounded;
    if (_isPartiallyWatched(ep)) return Icons.play_circle_fill_rounded;
    return Icons.play_arrow_rounded;
  }

  void _onPrimaryTap(ChannelEpisode ep) async {
    final isDownloaded = _isDownloaded(ep);
    final url = ep.playableUrl;
    if (!isDownloaded && (url == null || url.isEmpty)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No playable source for this episode.')),
      );
      return;
    }

    final isAdult = widget.series.ageClassification.toLowerCase() == 'adult';
    if (isAdult) {
      KycGuard.ensureKycVerified(
        context,
        onComplete: () => _playEpisode(ep),
      );
      return;
    }
    _playEpisode(ep);
  }

  Future<void> _playEpisode(ChannelEpisode ep) async {
    final isDownloaded = _isDownloaded(ep);
    final startSeconds = _isWatchedToEnd(ep)
        ? 0
        : (_isPartiallyWatched(ep) ? _progressSeconds(ep.id) : null);

    final all = _detail?.allEpisodes ?? const <ChannelEpisode>[];
    final idx = all.indexWhere((e) => e.id == ep.id);
    final nextId = idx >= 0 && idx < all.length - 1 ? all[idx + 1].id : null;
    final prevId = idx > 0 ? all[idx - 1].id : null;

    final effChannelId = (_detail?.channelId ?? '').isNotEmpty
        ? _detail!.channelId
        : widget.channelId;

    final args = VodPlaybackArgs(
      mediaType: 'episode',
      mediaId: ep.id,
      seriesId: widget.series.id,
      channelId: effChannelId,
      title: '${widget.series.title} · Ep ${ep.episodeNumber}: ${ep.title}',
      synopsis: _tmdbInfo?.overview.isNotEmpty == true
          ? _tmdbInfo!.overview
          : widget.series.description,
      posterUrl: widget.series.coverUrl ?? _tmdbInfo?.posterUrl,
      videoSourceMode: ep.videoSourceMode,
      playbackUrl: isDownloaded ? null : ep.playableUrl,
      duration: _effectiveDuration(ep),
      downloadable: true,
      nextEpisodeId: nextId,
      previousEpisodeId: prevId,
      startPositionSeconds: startSeconds,
    );

    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => VodPlayerScreen(args: args)),
    );
    final detail = _detail;
    if (mounted && detail != null) {
      await _loadEpisodeProgress(detail);
    }
  }

  void _startEpisodeDownload(ChannelEpisode ep) {
    if (_isDownloaded(ep)) return;
    if (_isDownloading(ep)) return;

    final url = ep.playableUrl;
    if (url == null || url.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No downloadable source for this episode.'),
        ),
      );
      return;
    }

    final effChannelId = (_detail?.channelId ?? '').isNotEmpty
        ? _detail!.channelId
        : widget.channelId;

    setState(() {
      _downloadProgress[ep.id] =
          VodCacheService.instance.currentProgress('episode', ep.id)?.percent ??
              0;
    });

    _listenToEpisodeDownload(ep.id);

    VodCacheService.instance
        .download(
          mediaType: 'episode',
          mediaId: ep.id,
          title: 'Ep ${ep.episodeNumber}: ${ep.title}',
          posterUrl: widget.series.coverUrl ?? _tmdbInfo?.posterUrl,
          sourceMode: ep.videoSourceMode,
          url: url,
          duration: _effectiveDuration(ep),
          seriesId: widget.series.id,
          channelId: effChannelId,
          seriesTitle: widget.series.title,
          episodeNumber: ep.episodeNumber > 0 ? ep.episodeNumber : 1,
        )
        .whenComplete(() {
          _downloadSubs.remove(ep.id)?.cancel();
          if (mounted) {
            _prefetchEpisodeSizes(_detail!);
            setState(() {});
          }
        });
  }

  Future<void> _pauseEpisodeDownload(ChannelEpisode ep) async {
    await VodCacheService.instance.pauseDownload('episode', ep.id);
    _downloadSubs.remove(ep.id)?.cancel();
    if (mounted) setState(() {});
  }

  Future<void> _cancelEpisodeDownload(ChannelEpisode ep) async {
    await VodCacheService.instance.cancelDownload('episode', ep.id);
    _downloadSubs.remove(ep.id)?.cancel();
    _downloadProgress.remove(ep.id);
    if (mounted) setState(() {});
  }

  void _downloadAllEpisodes() {
    final all = List<ChannelEpisode>.from(
        _detail?.allEpisodes ?? const <ChannelEpisode>[]);
    if (all.isEmpty) return;
    // Sort strictly by ascending episodeNumber so Episode 1 is queued first
    // and VodCacheService enforces serial episode completion.
    all.sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));
    int count = 0;
    for (final ep in all) {
      if (!_isDownloaded(ep) && !_isDownloading(ep)) {
        _startEpisodeDownload(ep);
        count++;
      }
    }
    if (mounted && count > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Queued $count episode${count == 1 ? '' : 's'} for serial download (Ep 1 → N).'),
        ),
      );
    }
  }

  void _downloadSelected() {
    final all = (_detail?.allEpisodes ?? const <ChannelEpisode>[])
        .where((e) => _selectedEpisodeIds.contains(e.id))
        .toList()
      ..sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));
    for (final ep in all) {
      _startEpisodeDownload(ep);
    }
    setState(() {
      _selectionMode = false;
      _selectedEpisodeIds.clear();
    });
  }

  Future<void> _pauseSelected() async {
    for (final id in _selectedEpisodeIds.toList()) {
      await VodCacheService.instance.pauseDownload('episode', id);
      _downloadSubs.remove(id)?.cancel();
    }
    if (!mounted) return;
    setState(() {
      _selectionMode = false;
      _selectedEpisodeIds.clear();
    });
  }

  Future<void> _cancelSelected() async {
    for (final id in _selectedEpisodeIds.toList()) {
      await VodCacheService.instance.cancelDownload('episode', id);
      _downloadSubs.remove(id)?.cancel();
      _downloadProgress.remove(id);
    }
    if (!mounted) return;
    setState(() {
      _selectionMode = false;
      _selectedEpisodeIds.clear();
    });
  }

  List<ChannelEpisode> _sortedEpisodes(List<ChannelEpisode> raw) {
    final list = List<ChannelEpisode>.from(raw);
    switch (_sortOrder) {
      case _EpisodeSortOrder.epAsc:
        list.sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));
        break;
      case _EpisodeSortOrder.epDesc:
        list.sort((a, b) => b.episodeNumber.compareTo(a.episodeNumber));
        break;
      case _EpisodeSortOrder.titleAsc:
        list.sort(
            (a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
        break;
      case _EpisodeSortOrder.durationDesc:
        list.sort(
            (a, b) => _effectiveDuration(b).compareTo(_effectiveDuration(a)));
        break;
    }
    return list;
  }

  /// High-contrast status pills with white text:
  ///   - Green: Downloaded
  ///   - Orange: Resume download (paused/partial)
  ///   - Red: Failed download
  ///   - Blue: Downloading / Queued
  Widget _buildDownloadStateChip(ChannelEpisode ep) {
    if (_isDownloaded(ep)) {
      return _statusPill(
        Icons.download_done_rounded,
        'Downloaded',
        const Color(0xFF2E7D32),
      );
    }
    if (_isDownloading(ep)) {
      final queued = _isQueued(ep);
      final pct = (_downloadProgress[ep.id] ??
              VodCacheService.instance
                  .currentProgress('episode', ep.id)
                  ?.percent ??
              0)
          .clamp(0.0, 100.0);
      return _statusPill(
        queued ? Icons.hourglass_top_rounded : Icons.downloading_rounded,
        queued ? 'Queued (Waiting)' : 'Downloading ${pct.toInt()}%',
        const Color(0xFF1565C0),
      );
    }
    if (_isFailed(ep)) {
      return _statusPill(
        Icons.error_outline_rounded,
        'Failed download',
        const Color(0xFFC62828),
      );
    }
    if (_hasPartialDownload(ep)) {
      return _statusPill(
        Icons.pause_circle_filled_rounded,
        'Resume download',
        const Color(0xFFEF6C00),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _statusPill(IconData icon, String label, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: Colors.white),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrimaryButton(ChannelEpisode ep) {
    final label = _primaryButtonLabel(ep);
    final bgColor = _primaryButtonColor(ep);
    final fgColor = _primaryButtonTextColor(ep);
    return SizedBox(
      height: 32,
      child: ElevatedButton.icon(
        onPressed: () => _onPrimaryTap(ep),
        icon: Icon(_primaryButtonIcon(ep), size: 15),
        label: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: bgColor,
          foregroundColor: fgColor,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }

  Widget _buildDownloadControls(ChannelEpisode ep) {
    final isDownloaded = _isDownloaded(ep);
    if (isDownloaded) return const SizedBox.shrink();

    final downloading = _isDownloading(ep);
    if (downloading) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 30,
            child: OutlinedButton.icon(
              onPressed: () => _pauseEpisodeDownload(ep),
              icon: const Icon(Icons.pause_rounded, size: 14),
              label: const Text('Pause', style: TextStyle(fontSize: 10)),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                backgroundColor: const Color(0xFFEF6C00),
                side: BorderSide.none,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          ),
          const SizedBox(width: 6),
          SizedBox(
            height: 30,
            width: 30,
            child: IconButton(
              tooltip: 'Cancel download',
              padding: EdgeInsets.zero,
              onPressed: () => _cancelEpisodeDownload(ep),
              icon: const Icon(
                Icons.cancel_rounded,
                color: Color(0xFFEF5350),
                size: 20,
              ),
            ),
          ),
        ],
      );
    }

    final hasPartial = _hasPartialDownload(ep);
    final isFailed = _isFailed(ep);
    final btnColor = isFailed
        ? const Color(0xFFC62828)
        : (hasPartial ? const Color(0xFFEF6C00) : Nocturne.surfaceInset);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 30,
          child: OutlinedButton.icon(
            onPressed: () => _startEpisodeDownload(ep),
            icon: Icon(
              isFailed
                  ? Icons.refresh_rounded
                  : (hasPartial
                      ? Icons.play_for_work_rounded
                      : Icons.download_rounded),
              size: 15,
              color: Colors.white,
            ),
            label: Text(
              isFailed
                  ? 'Retry DL'
                  : (hasPartial ? 'Resume DL' : 'Download'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              backgroundColor: btnColor,
              side: BorderSide(
                color: (hasPartial || isFailed)
                    ? Colors.transparent
                    : Nocturne.borderStrong,
                width: 1,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ),
        if (hasPartial || isFailed) ...[
          const SizedBox(width: 4),
          SizedBox(
            height: 28,
            width: 28,
            child: IconButton(
              tooltip: 'Discard partial download',
              padding: EdgeInsets.zero,
              onPressed: () => _cancelEpisodeDownload(ep),
              icon: const Icon(
                Icons.delete_outline_rounded,
                color: Nocturne.textMuted,
                size: 17,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildCardBottomProgressBar(ChannelEpisode ep) {
    final downloading = _isDownloading(ep);
    final hasPartial = _hasPartialDownload(ep);
    if (downloading || hasPartial) {
      double pct = _downloadProgress[ep.id] ??
          VodCacheService.instance
              .currentProgress('episode', ep.id)
              ?.percent ??
          0;
      if (!downloading && hasPartial && pct <= 0) {
        final partBytes =
            VodCacheService.instance.partialDownloadedBytes('episode', ep.id);
        final total = _episodeSizes[ep.id] ?? 0;
        if (total > 0 && partBytes > 0) {
          pct = (partBytes / total) * 100;
        }
      }
      return LinearProgressIndicator(
        value: (pct.clamp(0.0, 100.0)) / 100.0,
        minHeight: 4,
        backgroundColor: Nocturne.border,
        valueColor: AlwaysStoppedAnimation<Color>(
          downloading ? const Color(0xFF29B6F6) : const Color(0xFFEF6C00),
        ),
      );
    }

    final watchFrac = _watchProgressFraction(ep);
    if (watchFrac > 0) {
      return LinearProgressIndicator(
        value: watchFrac,
        minHeight: 3,
        backgroundColor: Nocturne.border,
        valueColor: AlwaysStoppedAnimation<Color>(
          _isWatchedToEnd(ep) ? const Color(0xFF2E7D32) : Nocturne.gold,
        ),
      );
    }

    return const SizedBox.shrink();
  }

  String _formatDuration(int seconds) {
    final d = Duration(seconds: seconds);
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    if (h > 0) return '${h}h ${m.toString().padLeft(2, '0')}m';
    if (m > 0) return '${m}m';
    return '${d.inSeconds}s';
  }

  String _formatClock(int seconds) {
    final d = Duration(seconds: seconds);
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (h > 0) return '$h:$m:$s';
    return '$m:$s';
  }

  String _formatSize(int? bytes) {
    if (bytes == null || bytes <= 0) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  String _episodeMetaText(ChannelEpisode ep) {
    final parts = <String>['Ep ${ep.episodeNumber}'];
    final dur = _effectiveDuration(ep);
    if (dur > 0) parts.add(_formatDuration(dur));

    final totalSize = _episodeSizes[ep.id];
    if (_hasPartialDownload(ep)) {
      final partBytes =
          VodCacheService.instance.partialDownloadedBytes('episode', ep.id);
      if (partBytes > 0 && totalSize != null && totalSize > 0) {
        parts.add('${_formatSize(partBytes)} / ${_formatSize(totalSize)}');
      } else if (partBytes > 0) {
        parts.add('${_formatSize(partBytes)} downloaded');
      } else if (totalSize != null && totalSize > 0) {
        parts.add(_formatSize(totalSize));
      }
    } else if (totalSize != null && totalSize > 0) {
      parts.add(_formatSize(totalSize));
    }
    return parts.join(' · ');
  }

  Widget _buildSeriesHeader(ChannelSeriesDetail? detail) {
    final seasonsCount = detail?.seasons.length ?? 0;
    final episodesCount = detail?.allEpisodes.length ?? 0;
    final coverUrl = _tmdbInfo?.backdropUrl ??
        detail?.coverUrl ??
        widget.series.coverUrl ??
        _tmdbInfo?.posterUrl;
    final posterUrl =
        detail?.coverUrl ?? widget.series.coverUrl ?? _tmdbInfo?.posterUrl;
    final description = (detail?.description ?? '').trim().isNotEmpty
        ? detail!.description
        : (widget.series.description.trim().isNotEmpty
            ? widget.series.description
            : (_tmdbInfo?.overview ?? ''));

    final metaBadges = <String>[];
    if (seasonsCount > 0) {
      metaBadges.add('$seasonsCount Season${seasonsCount == 1 ? '' : 's'}');
    }
    if (episodesCount > 0) {
      metaBadges.add('$episodesCount Episode${episodesCount == 1 ? '' : 's'}');
    }
    if ((_tmdbInfo?.releaseDate ?? '').isNotEmpty) {
      metaBadges.add(_tmdbInfo!.releaseDate!);
    }
    if ((_tmdbInfo?.rating ?? 0) > 0) {
      metaBadges.add('${_tmdbInfo!.rating.toStringAsFixed(1)} ★');
    }
    if ((_tmdbInfo?.certification ?? '').isNotEmpty) {
      metaBadges.add(_tmdbInfo!.certification!);
    }

    final cast = _tmdbInfo?.cast ?? const <CatchUpCredit>[];
    final genres = _tmdbInfo?.genres ?? const <String>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Cover banner + poster overlay
        Stack(
          children: [
            Container(
              height: 210,
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF1C2C62), Color(0xFF0B1533)],
                ),
              ),
              child: coverUrl != null && coverUrl.isNotEmpty
                  ? ShaderMask(
                      shaderCallback: (r) => LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.white,
                          Colors.white.withValues(alpha: 0.08),
                        ],
                        stops: const [0.45, 1.0],
                      ).createShader(r),
                      blendMode: BlendMode.dstIn,
                      child: CachedNetworkImage(
                        imageUrl: coverUrl,
                        cacheKey: imageCacheKey(coverUrl),
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: 210,
                        errorWidget: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    )
                  : null,
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 12,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (posterUrl != null && posterUrl.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        width: 78,
                        height: 112,
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Nocturne.borderStrong,
                            width: 1,
                          ),
                        ),
                        child: CachedNetworkImage(
                          imageUrl: posterUrl,
                          cacheKey: imageCacheKey(posterUrl),
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) =>
                              Container(color: Nocturne.surfaceRaised),
                        ),
                      ),
                    ),
                  if (posterUrl != null && posterUrl.isNotEmpty)
                    const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.series.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 21,
                            fontWeight: FontWeight.w700,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: metaBadges
                              .map(
                                (m) => Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color:
                                        Nocturne.surfaceRaised.withValues(alpha: 0.9),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                        color: Nocturne.borderStrong, width: 1),
                                  ),
                                  child: Text(
                                    m,
                                    style: const TextStyle(
                                      color: Nocturne.goldLight,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),

        // Genres
        if (genres.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: genres
                  .map(
                    (g) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: Nocturne.surfaceInset,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        g,
                        style: const TextStyle(
                          color: Nocturne.textDim,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),

        // Description
        if (description.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text(
              description,
              style: const TextStyle(
                color: Nocturne.textMuted,
                fontSize: 13,
                height: 1.45,
              ),
            ),
          ),

        // Cast / Actors circular photos + names + character roles
        if (cast.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text(
              'Cast & Actors',
              style: TextStyle(
                color: Nocturne.text,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          SizedBox(
            height: 106,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: cast.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final c = cast[i];
                return SizedBox(
                  width: 72,
                  child: Column(
                    children: [
                      ClipOval(
                        child: Container(
                          width: 56,
                          height: 56,
                          color: Nocturne.surfaceRaised,
                          child: (c.profileUrl ?? '').isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: c.profileUrl!,
                                  cacheKey: imageCacheKey(c.profileUrl),
                                  fit: BoxFit.cover,
                                  memCacheWidth: 160,
                                  errorWidget: (_, __, ___) => const Icon(
                                    Icons.person_rounded,
                                    color: Nocturne.textHint,
                                  ),
                                )
                              : const Icon(
                                  Icons.person_rounded,
                                  color: Nocturne.textHint,
                                ),
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if ((c.role ?? '').isNotEmpty)
                        Text(
                          c.role!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Nocturne.textFaint,
                            fontSize: 9.5,
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],

        // Live Download Stats Beacon
        const DownloadStatsBeacon(
          margin: EdgeInsets.fromLTRB(16, 10, 16, 4),
        ),

        // Toolbar: Sort, View Mode (List / Grid / Big Cards), Download All, Group Select
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Episodes ($episodesCount)',
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  SizedBox(
                    height: 30,
                    child: ElevatedButton.icon(
                      onPressed: _downloadAllEpisodes,
                      icon: const Icon(Icons.download_for_offline_rounded,
                          size: 15),
                      label: const Text(
                        'Download All',
                        style: TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Nocturne.gold,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        minimumSize: Size.zero,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 30,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        setState(() {
                          _selectionMode = !_selectionMode;
                          if (!_selectionMode) _selectedEpisodeIds.clear();
                        });
                      },
                      icon: Icon(
                        _selectionMode
                            ? Icons.close_rounded
                            : Icons.checklist_rounded,
                        size: 15,
                      ),
                      label: Text(
                        _selectionMode ? 'Done' : 'Select',
                        style: const TextStyle(fontSize: 11),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Nocturne.text,
                        side: const BorderSide(color: Nocturne.borderStrong),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        minimumSize: Size.zero,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  // Sort selector
                  Container(
                    height: 32,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: Nocturne.surfaceRaised,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Nocturne.border, width: 1),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<_EpisodeSortOrder>(
                        value: _sortOrder,
                        dropdownColor: Nocturne.surfaceRaised,
                        icon: const Icon(Icons.sort_rounded,
                            size: 16, color: Nocturne.gold),
                        style: const TextStyle(
                            color: Nocturne.text,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600),
                        onChanged: (v) {
                          if (v != null) {
                            setState(() {
                              _sortOrder = v;
                              _currentPage = 0;
                            });
                          }
                        },
                        items: const [
                          DropdownMenuItem(
                            value: _EpisodeSortOrder.epAsc,
                            child: Text('Sort: Ep 1 → N'),
                          ),
                          DropdownMenuItem(
                            value: _EpisodeSortOrder.epDesc,
                            child: Text('Sort: Ep N → 1'),
                          ),
                          DropdownMenuItem(
                            value: _EpisodeSortOrder.titleAsc,
                            child: Text('Sort: Title A → Z'),
                          ),
                          DropdownMenuItem(
                            value: _EpisodeSortOrder.durationDesc,
                            child: Text('Sort: Longest'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(),
                  _viewModeBtn(
                      _EpisodeViewMode.list, Icons.view_list_rounded, 'List'),
                  const SizedBox(width: 6),
                  _viewModeBtn(
                      _EpisodeViewMode.grid, Icons.grid_view_rounded, 'Grid'),
                  const SizedBox(width: 6),
                  _viewModeBtn(_EpisodeViewMode.bigCards,
                      Icons.view_agenda_rounded, 'Big'),
                ],
              ),
              if (_selectionMode) ...[
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Nocturne.surfaceInset,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Nocturne.gold, width: 1),
                  ),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      TextButton(
                        onPressed: () {
                          final allIds = (_detail?.allEpisodes ?? const [])
                              .map((e) => e.id)
                              .toList();
                          setState(() {
                            if (_selectedEpisodeIds.length == allIds.length) {
                              _selectedEpisodeIds.clear();
                            } else {
                              _selectedEpisodeIds.addAll(allIds);
                            }
                          });
                        },
                        child: Text(
                          'Select All (${_selectedEpisodeIds.length})',
                          style: const TextStyle(
                              color: Nocturne.goldLight, fontSize: 11.5),
                        ),
                      ),
                      ElevatedButton(
                        onPressed: _selectedEpisodeIds.isEmpty
                            ? null
                            : _downloadSelected,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Nocturne.gold,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                        ),
                        child: const Text('Download',
                            style: TextStyle(
                                fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                      ElevatedButton(
                        onPressed:
                            _selectedEpisodeIds.isEmpty ? null : _pauseSelected,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEF6C00),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                        ),
                        child: const Text('Pause',
                            style: TextStyle(
                                fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                      ElevatedButton(
                        onPressed: _selectedEpisodeIds.isEmpty
                            ? null
                            : _cancelSelected,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFC62828),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                        ),
                        child: const Text('Cancel/Delete',
                            style: TextStyle(
                                fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _viewModeBtn(_EpisodeViewMode mode, IconData icon, String tooltip) {
    final active = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 9),
        decoration: BoxDecoration(
          color: active ? Nocturne.gold : Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? Nocturne.gold : Nocturne.border,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: active ? Colors.black : Nocturne.textMuted,
            ),
            const SizedBox(width: 4),
            Text(
              tooltip,
              style: TextStyle(
                color: active ? Colors.black : Nocturne.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSelectionCheckbox(ChannelEpisode ep) {
    if (!_selectionMode) return const SizedBox.shrink();
    final checked = _selectedEpisodeIds.contains(ep.id);
    return Checkbox(
      value: checked,
      activeColor: Nocturne.gold,
      checkColor: Colors.black,
      visualDensity: VisualDensity.compact,
      onChanged: (v) {
        setState(() {
          if (v == true) {
            _selectedEpisodeIds.add(ep.id);
          } else {
            _selectedEpisodeIds.remove(ep.id);
          }
        });
      },
    );
  }

  Widget _buildEpisodeListRow(ChannelEpisode ep) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Nocturne.border, width: 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSelectionCheckbox(ep),
              SizedBox(
                width: 110,
                height: 84,
                child: EpisodeThumbnail(
                  posterUrl: widget.series.coverUrl ?? _tmdbInfo?.posterUrl,
                  videoUrl: ep.playableUrl,
                  episodeNumber: ep.episodeNumber,
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              ep.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Nocturne.text,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          _buildDownloadStateChip(ep),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _episodeMetaText(ep),
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _buildPrimaryButton(ep)),
                          const SizedBox(width: 8),
                          _buildDownloadControls(ep),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          _buildCardBottomProgressBar(ep),
        ],
      ),
    );
  }

  Widget _buildEpisodeBigCard(ChannelEpisode ep) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.borderStrong, width: 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              SizedBox(
                width: double.infinity,
                height: 165,
                child: EpisodeThumbnail(
                  posterUrl: widget.series.coverUrl ?? _tmdbInfo?.backdropUrl,
                  videoUrl: ep.playableUrl,
                  episodeNumber: ep.episodeNumber,
                ),
              ),
              Positioned(
                top: 10,
                right: 10,
                child: _buildDownloadStateChip(ep),
              ),
              if (_selectionMode)
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: _buildSelectionCheckbox(ep),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ep.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _episodeMetaText(ep),
                  style: const TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _buildPrimaryButton(ep)),
                    const SizedBox(width: 8),
                    _buildDownloadControls(ep),
                  ],
                ),
              ],
            ),
          ),
          _buildCardBottomProgressBar(ep),
        ],
      ),
    );
  }

  Widget _buildEpisodeGridCard(ChannelEpisode ep) {
    return Container(
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Nocturne.border, width: 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              SizedBox(
                width: double.infinity,
                height: 96,
                child: EpisodeThumbnail(
                  posterUrl: widget.series.coverUrl ?? _tmdbInfo?.posterUrl,
                  videoUrl: ep.playableUrl,
                  episodeNumber: ep.episodeNumber,
                ),
              ),
              Positioned(
                top: 6,
                right: 6,
                child: _buildDownloadStateChip(ep),
              ),
              if (_selectionMode)
                Positioned(
                  top: 2,
                  left: 2,
                  child: _buildSelectionCheckbox(ep),
                ),
            ],
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ep.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _episodeMetaText(ep),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 10.5,
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    child: _buildPrimaryButton(ep),
                  ),
                  const SizedBox(height: 6),
                  Align(
                    alignment: Alignment.centerRight,
                    child: _buildDownloadControls(ep),
                  ),
                ],
              ),
            ),
          ),
          _buildCardBottomProgressBar(ep),
        ],
      ),
    );
  }

  Widget _buildPaginationFooter(int totalItems) {
    final totalPages =
        totalItems == 0 ? 1 : ((totalItems - 1) ~/ _pageSize) + 1;
    if (totalPages <= 1) return const SizedBox(height: 24);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          OutlinedButton.icon(
            onPressed:
                _currentPage > 0 ? () => setState(() => _currentPage--) : null,
            icon: const Icon(Icons.chevron_left_rounded, size: 18),
            label: const Text('Prev'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Nocturne.text,
              side: const BorderSide(color: Nocturne.borderStrong),
            ),
          ),
          Text(
            'Page ${_currentPage + 1} of $totalPages ($totalItems eps)',
            style: const TextStyle(
              color: Nocturne.textMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          OutlinedButton.icon(
            onPressed: _currentPage + 1 < totalPages
                ? () => setState(() => _currentPage++)
                : null,
            icon: const Icon(Icons.chevron_right_rounded, size: 18),
            label: const Text('Next'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Nocturne.text,
              side: const BorderSide(color: Nocturne.borderStrong),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.ondemand_video_rounded,
              size: 56,
              color: Nocturne.textHint,
            ),
            const SizedBox(height: 12),
            Text(
              _error ?? 'No episodes available yet',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Nocturne.textMuted, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    final sorted =
        _sortedEpisodes(detail?.allEpisodes ?? const <ChannelEpisode>[]);
    final totalPages =
        sorted.isEmpty ? 1 : ((sorted.length - 1) ~/ _pageSize) + 1;
    final safePage = _currentPage.clamp(0, totalPages - 1);
    final pageEpisodes = sorted.skip(safePage * _pageSize).take(_pageSize).toList();

    return Scaffold(
      backgroundColor: Nocturne.bg,
      appBar: AppBar(
        title: Text(
          widget.series.title,
          style: const TextStyle(
            color: Nocturne.text,
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
        backgroundColor: Nocturne.surface,
        iconTheme: const IconThemeData(color: Nocturne.text),
        elevation: 0,
        centerTitle: false,
        actions: const [
          DownloadNavButton(iconColor: Nocturne.text),
          SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: Nocturne.gold,
        onRefresh: _loadDetail,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildSeriesHeader(detail)),
            if (_loading && detail == null)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: CircularProgressIndicator(color: Nocturne.gold),
                  ),
                ),
              )
            else if (sorted.isEmpty)
              SliverToBoxAdapter(child: _buildEmpty())
            else if (_viewMode == _EpisodeViewMode.grid)
              SliverPadding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.74,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) =>
                        _buildEpisodeGridCard(pageEpisodes[index]),
                    childCount: pageEpisodes.length,
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => _viewMode == _EpisodeViewMode.bigCards
                      ? _buildEpisodeBigCard(pageEpisodes[index])
                      : _buildEpisodeListRow(pageEpisodes[index]),
                  childCount: pageEpisodes.length,
                ),
              ),
            if (sorted.isNotEmpty)
              SliverToBoxAdapter(child: _buildPaginationFooter(sorted.length)),
          ],
        ),
      ),
    );
  }
}
