import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart'
    hide DownloadProgress;
import 'package:flutter/material.dart';

import '../../../core/ads/pangle_widgets.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../../core/utils/image_cache_key.dart';
import '../models/catch_up_models.dart';
import '../models/movie_model.dart';
import '../models/vod_playback_args.dart';
import '../services/catch_up_service.dart';
import '../services/vod_cache_service.dart';
import '../services/vod_service.dart';
import '../widgets/download_stats_beacon.dart';
import 'vod_player_screen.dart';

/// Unified Movie Detail Screen with parity to ChannelSeriesDetailScreen:
/// - Rich TMDB metadata (ratings, release date, runtime, genres, overview, trailer)
/// - Cast circular photos with names and character roles
/// - Watch progress tracking (Stream / Resume / Replay / Play Offline) synced with Continue Watching
/// - Download manager controls (Download, Pause, Resume, Cancel, Delete, high-contrast status pills,
///   bottom progress bar, file size, DownloadStatsBeacon, DownloadNavButton)
/// - Similar movies from AfroVision collections (same channel + public catalog, never leaking other exclusive channels)
/// - Launches VodPlayerScreen (same ExoPlayer-first pipeline, gestures, settings, remaining time, orientation reset)
class MovieDetailScreen extends StatefulWidget {
  final MovieModel movie;

  const MovieDetailScreen({super.key, required this.movie});

  @override
  State<MovieDetailScreen> createState() => _MovieDetailScreenState();
}

class _MovieDetailScreenState extends State<MovieDetailScreen> {
  late MovieModel _movie;
  CatchUpItem? _tmdbInfo;
  WatchProgress? _progress;
  List<MovieModel> _similarMovies = const <MovieModel>[];
  bool _loadingSimilar = true;

  double? _downloadPercent;
  int? _fileSizeBytes;
  bool _downloadFailed = false;
  StreamSubscription<DownloadProgress>? _downloadSub;

  @override
  void initState() {
    super.initState();
    _movie = widget.movie;
    _progress = VodService.getCachedProgressSync('movie', _movie.id);

    VodCacheService.instance.initialize().then((_) {
      if (!mounted) return;
      _attachDownloadState();
      _probeFileSize();
      setState(() {});
    });
    VodCacheService.instance.beaconNotifier.addListener(_onBeaconChanged);

    _refreshMovieDetail();
    _loadWatchProgress();
    _loadTmdbMetadata();
    _loadSimilarMovies();
  }

  void _onBeaconChanged() {
    if (!mounted) return;
    _attachDownloadState();
    setState(() {});
  }

  @override
  void dispose() {
    VodCacheService.instance.beaconNotifier.removeListener(_onBeaconChanged);
    _downloadSub?.cancel();
    super.dispose();
  }

  Future<void> _refreshMovieDetail() async {
    try {
      final fresh = await VodService.getMovieById(_movie.id);
      if (!mounted) return;
      setState(() => _movie = fresh);
      _probeFileSize();
    } catch (_) {
      // Keep initial movie payload if offline or transient error
    }
  }

  Future<void> _loadWatchProgress() async {
    try {
      final p = await VodService.getProgress('movie', _movie.id);
      if (!mounted) return;
      if (p != null) {
        setState(() => _progress = p);
      }
    } catch (_) {}
  }

  Future<void> _loadTmdbMetadata() async {
    try {
      final info = await CatchUpService.lookupMovieByTitle(_movie.title);
      if (mounted && info != null) {
        setState(() => _tmdbInfo = info);
      }
    } catch (_) {}
  }

  Future<void> _loadSimilarMovies() async {
    try {
      final collected = <MovieModel>[];
      final seenIds = <String>{_movie.id};

      // 1. Same channel movies first (strictly respects channel isolation)
      if (_movie.channelId.isNotEmpty) {
        try {
          final channelMovies =
              await VodService.getChannelMoviesCached(_movie.channelId);
          for (final m in channelMovies) {
            if (seenIds.add(m.id)) collected.add(m);
          }
        } catch (_) {}
      }

      // 2. Supplement with public collection movies if needed
      if (collected.length < 10) {
        try {
          final pub = await VodService.getPublicMoviesCached(limit: 24);
          for (final m in pub.movies) {
            if (seenIds.add(m.id)) {
              collected.add(m);
              if (collected.length >= 12) break;
            }
          }
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        _similarMovies = collected.take(12).toList();
        _loadingSimilar = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingSimilar = false);
    }
  }

  void _attachDownloadState() {
    final cur = VodCacheService.instance.currentProgress('movie', _movie.id);
    if (cur != null) {
      _downloadPercent = cur.percent;
      if (cur.totalBytes > 0) _fileSizeBytes = cur.totalBytes;
    }
    if (VodCacheService.instance.isDownloading('movie', _movie.id)) {
      _listenToDownload();
    }
  }

  void _listenToDownload() {
    if (_downloadSub != null) return;
    final stream = VodCacheService.instance.progressStream('movie', _movie.id);
    if (stream == null) return;
    _downloadSub = stream.listen(
      (progress) {
        if (!mounted) return;
        setState(() {
          _downloadFailed = false;
          _downloadPercent = progress.percent;
          if (progress.totalBytes > 0) _fileSizeBytes = progress.totalBytes;
        });
      },
      onError: (_) {
        if (!mounted) return;
        setState(() {
          _downloadFailed = true;
          _downloadSub = null;
        });
      },
      onDone: () {
        if (!mounted) return;
        setState(() {
          _downloadSub = null;
          if (VodCacheService.instance.isCached('movie', _movie.id)) {
            _downloadPercent = 100.0;
          }
        });
        _probeFileSize();
      },
    );
  }

  Future<void> _probeFileSize() async {
    final size = await VodCacheService.instance
        .getOrFetchFileSize('movie', _movie.id, _downloadUrl);
    if (mounted && size != null && size > 0) {
      setState(() => _fileSizeBytes = size);
    }
  }

  String? get _downloadUrl {
    if (_movie.videoSourceMode == 'embed') return null;
    final url = _movie.hostedUrl ?? _movie.externalUrl ?? _movie.playbackUrl;
    if (url == null || url.isEmpty) return null;
    if (url.toLowerCase().contains('.m3u8')) return null;
    return url;
  }

  bool get _canDownload {
    final url = _downloadUrl;
    return url != null && url.isNotEmpty;
  }

  bool get _isDownloaded =>
      VodCacheService.instance.isCached('movie', _movie.id);

  bool get _isDownloading =>
      VodCacheService.instance.isDownloading('movie', _movie.id);

  bool get _hasPartialDownload =>
      !_isDownloaded &&
      !_isDownloading &&
      VodCacheService.instance.hasPartialDownload('movie', _movie.id);

  bool get _isCompletedWatched {
    final p = _progress;
    if (p == null) return false;
    final dur = p.durationSeconds > 0 ? p.durationSeconds : _movie.duration;
    if (dur <= 0) return false;
    return p.positionSeconds >= (dur * 0.9);
  }

  bool get _isPartiallyWatched {
    final p = _progress;
    if (p == null || p.positionSeconds <= 5) return false;
    return !_isCompletedWatched;
  }

  double get _watchProgressFraction {
    final p = _progress;
    if (p == null || p.positionSeconds <= 0) return 0;
    final dur = p.durationSeconds > 0 ? p.durationSeconds : _movie.duration;
    if (dur <= 0) return 0;
    return (p.positionSeconds / dur).clamp(0.0, 1.0);
  }

  Future<void> _startOrResumeDownload() async {
    final url = _downloadUrl;
    if (url == null || url.isEmpty) return;
    if (mounted) {
      setState(() {
        _downloadFailed = false;
        _downloadPercent = _downloadPercent ?? 0.0;
      });
    }
    try {
      final future = VodCacheService.instance.download(
        mediaType: 'movie',
        mediaId: _movie.id,
        url: url,
        title: _movie.title,
        posterUrl: _movie.posterUrl ?? _tmdbInfo?.posterUrl,
        sourceMode: _movie.videoSourceMode,
        duration: _movie.duration,
        channelId: _movie.channelId,
      );
      _listenToDownload();
      await future;
      if (mounted) {
        setState(() {
          _downloadFailed = false;
          _downloadPercent = 100.0;
        });
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().toLowerCase();
      if (!msg.contains('paused') && !msg.contains('cancelled')) {
        setState(() => _downloadFailed = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    }
  }

  Future<void> _pauseDownload() async {
    await VodCacheService.instance.pauseDownload('movie', _movie.id);
    if (mounted) setState(() {});
  }

  Future<void> _cancelDownload() async {
    await VodCacheService.instance.cancelDownload('movie', _movie.id);
    _downloadSub?.cancel();
    _downloadSub = null;
    if (mounted) {
      setState(() {
        _downloadPercent = null;
        _downloadFailed = false;
      });
    }
  }

  Future<void> _deleteDownload() async {
    await VodCacheService.instance.delete('movie', _movie.id);
    if (mounted) {
      setState(() {
        _downloadPercent = null;
        _downloadFailed = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Downloaded movie removed')),
      );
    }
  }

  Future<void> _play({bool forceRestart = false}) async {
    final url = _movie.playbackUrl;
    final localPath =
        await VodCacheService.instance.getLocalPath('movie', _movie.id);
    if (localPath == null && (url == null || url.isEmpty)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Playback source unavailable')),
      );
      return;
    }

    if (_movie.ageClassification.toLowerCase() == 'adult') {
      if (!mounted) return;
      final ok = await KycGuard.ensureKycVerified(context);
      if (!ok || !mounted) return;
    }

    if (forceRestart) {
      await VodService.saveProgress(
        'movie',
        _movie.id,
        0,
        _movie.duration > 0 ? _movie.duration : (_progress?.durationSeconds ?? 0),
      );
    }

    final args = VodPlaybackArgs(
      mediaType: 'movie',
      mediaId: _movie.id,
      channelId: _movie.channelId,
      title: _movie.title,
      synopsis: _effectiveSynopsis,
      posterUrl: _movie.posterUrl ?? _tmdbInfo?.posterUrl,
      videoSourceMode: _movie.videoSourceMode,
      playbackUrl: url ?? localPath ?? '',
      duration: _movie.duration,
      downloadable: _canDownload,
    );

    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => VodPlayerScreen(args: args)),
    );

    // Refresh progress & download status when returning from player
    await _loadWatchProgress();
    if (mounted) {
      _attachDownloadState();
      setState(() {});
    }
  }

  void _playTrailer() {
    final trailerUrl = _tmdbInfo?.trailerUrl;
    if (trailerUrl == null || trailerUrl.isEmpty) return;
    final args = VodPlaybackArgs(
      mediaType: 'trailer',
      mediaId: '${_movie.id}_trailer',
      channelId: _movie.channelId,
      title: '${_movie.title} · Trailer',
      synopsis: _effectiveSynopsis,
      posterUrl: _movie.posterUrl ?? _tmdbInfo?.posterUrl,
      videoSourceMode: 'embed',
      playbackUrl: trailerUrl,
      duration: 0,
      downloadable: false,
    );
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => VodPlayerScreen(args: args)),
    );
  }

  String? get _effectiveSynopsis {
    if (_movie.synopsis != null && _movie.synopsis!.trim().isNotEmpty) {
      return _movie.synopsis!.trim();
    }
    if (_tmdbInfo != null && _tmdbInfo!.overview.trim().isNotEmpty) {
      return _tmdbInfo!.overview.trim();
    }
    return null;
  }

  String? get _effectiveBackdrop =>
      (_tmdbInfo?.backdropUrl?.isNotEmpty == true ? _tmdbInfo!.backdropUrl : null) ??
      (_movie.posterUrl?.isNotEmpty == true ? _movie.posterUrl : null) ??
      _tmdbInfo?.posterUrl;

  String? get _effectivePoster =>
      (_movie.posterUrl?.isNotEmpty == true ? _movie.posterUrl : null) ??
      _tmdbInfo?.posterUrl;

  String? get _releaseYear {
    if (_tmdbInfo?.releaseDate != null && _tmdbInfo!.releaseDate!.length >= 4) {
      return _tmdbInfo!.releaseDate!.substring(0, 4);
    }
    if (_movie.releaseDate != null && _movie.releaseDate! > 0) {
      final ms = _movie.releaseDate! > 100000000000
          ? _movie.releaseDate!
          : _movie.releaseDate! * 1000;
      return DateTime.fromMillisecondsSinceEpoch(ms).year.toString();
    }
    return null;
  }

  String get _durationLabel {
    if (_movie.duration > 0) return _formatDuration(_movie.duration);
    final tmdbMin = _tmdbInfo?.runtime ?? 0;
    if (tmdbMin > 0) {
      final h = tmdbMin ~/ 60;
      final m = tmdbMin % 60;
      return h > 0 ? '${h}h ${m}m' : '${m}m';
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final hasSource =
        _isDownloaded || (_movie.playbackUrl != null && _movie.playbackUrl!.isNotEmpty);

    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildHero(context)),
            const SliverToBoxAdapter(child: DownloadStatsBeacon()),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildActionCard(hasSource: hasSource),
                    if (_effectiveSynopsis != null) ...[
                      const SizedBox(height: 18),
                      const Text(
                        'SYNOPSIS',
                        style: TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _effectiveSynopsis!,
                        style: const TextStyle(
                          color: Nocturne.textMuted,
                          fontSize: 13.5,
                          height: 1.5,
                        ),
                      ),
                    ],
                    if (_tmdbInfo != null && _tmdbInfo!.genres.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _tmdbInfo!.genres
                            .map((g) => Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: Nocturne.surfaceRaised,
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(
                                        color: Nocturne.borderStrong, width: 1),
                                  ),
                                  child: Text(
                                    g,
                                    style: const TextStyle(
                                      color: Nocturne.textMuted,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ))
                            .toList(),
                      ),
                    ],
                    if (_tmdbInfo != null && _tmdbInfo!.cast.isNotEmpty) ...[
                      const SizedBox(height: 22),
                      _buildCastSection(_tmdbInfo!.cast),
                    ],
                    const SizedBox(height: 22),
                    _buildDetailsSection(),
                  ],
                ),
              ),
            ),
            if (!_loadingSimilar && _similarMovies.isNotEmpty)
              SliverToBoxAdapter(child: _buildSimilarSection()),
            const SliverToBoxAdapter(child: PangleBigBanner()),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  Widget _buildHero(BuildContext context) {
    final backdrop = _effectiveBackdrop;
    final poster = _effectivePoster;
    final rating = _tmdbInfo?.rating ?? 0.0;
    final cert = _tmdbInfo?.certification;

    return Stack(
      children: [
        Container(
          height: 270,
          width: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF1C2C62), Color(0xFF0D1633)],
            ),
            border: Border(
              bottom: BorderSide(color: Nocturne.border, width: 1),
            ),
          ),
          child: backdrop != null && backdrop.isNotEmpty
              ? ShaderMask(
                  shaderCallback: (r) => LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.white,
                      Colors.white.withValues(alpha: 0.15),
                    ],
                    stops: const [0.35, 1.0],
                  ).createShader(r),
                  blendMode: BlendMode.dstIn,
                  child: CachedNetworkImage(
                    imageUrl: backdrop,
                    cacheKey: imageCacheKey(backdrop),
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: 270,
                    memCacheHeight: 540,
                    placeholder: (_, __) => const SizedBox.shrink(),
                    errorWidget: (_, __, ___) => const SizedBox.shrink(),
                  ),
                )
              : null,
        ),
        // Top navigation bar: Back + Downloads icon
        Positioned(
          left: 16,
          right: 16,
          top: 12,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _iconHeaderButton(
                icon: Icons.chevron_left_rounded,
                onTap: () => Navigator.of(context).maybePop(),
              ),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0B1533).withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Nocturne.borderStrong, width: 1),
                ),
                child: const DownloadNavButton(iconColor: Nocturne.text),
              ),
            ],
          ),
        ),
        // Poster + Title + Ratings / Meta overlay
        Positioned(
          left: 20,
          right: 20,
          bottom: 16,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (poster != null && poster.isNotEmpty) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 88,
                    height: 128,
                    decoration: BoxDecoration(
                      border: Border.all(color: Nocturne.borderStrong),
                      color: Nocturne.surfaceInset,
                    ),
                    child: CachedNetworkImage(
                      imageUrl: poster,
                      cacheKey: imageCacheKey(poster),
                      fit: BoxFit.cover,
                      memCacheWidth: 220,
                      errorWidget: (_, __, ___) => const Icon(
                        Icons.movie_creation_outlined,
                        color: Nocturne.textHint,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _movie.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (rating > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: Nocturne.gold.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                  color: Nocturne.gold.withValues(alpha: 0.5)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.star_rounded,
                                    color: Nocturne.gold, size: 13),
                                const SizedBox(width: 3),
                                Text(
                                  rating.toStringAsFixed(1),
                                  style: const TextStyle(
                                    color: Nocturne.goldLight,
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (_releaseYear != null)
                          Text(
                            _releaseYear!,
                            style: const TextStyle(
                              color: Nocturne.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        if (_durationLabel.isNotEmpty)
                          Text(
                            '· $_durationLabel',
                            style: const TextStyle(
                              color: Nocturne.textMuted,
                              fontSize: 12,
                            ),
                          ),
                        if (cert != null && cert.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Nocturne.borderStrong),
                            ),
                            child: Text(
                              cert,
                              style: const TextStyle(
                                color: Nocturne.textMuted,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          )
                        else if (_movie.ageClassification.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Nocturne.borderStrong),
                            ),
                            child: Text(
                              _movie.ageClassification.toUpperCase(),
                              style: const TextStyle(
                                color: Nocturne.textMuted,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _iconHeaderButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: const Color(0xFF0B1533).withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Nocturne.borderStrong, width: 1),
        ),
        alignment: Alignment.center,
        child: Icon(icon, color: Nocturne.text, size: 22),
      ),
    );
  }

  Widget _buildActionCard({required bool hasSource}) {
    final primaryLabel = _isDownloaded
        ? 'Play Offline'
        : _isCompletedWatched
            ? 'Replay'
            : _isPartiallyWatched
                ? 'Resume'
                : 'Stream';

    final primaryIcon = _isDownloaded
        ? Icons.offline_pin_rounded
        : _isCompletedWatched
            ? Icons.replay_rounded
            : Icons.play_arrow_rounded;

    final pct = (_downloadPercent ?? 0.0).clamp(0.0, 100.0);
    final showDownloadBar = _isDownloading || _hasPartialDownload;

    return Container(
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Nocturne.borderStrong, width: 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status pill + file size row
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (_isDownloaded)
                      _statusPill('Downloaded', const Color(0xFF16A34A)),
                    if (_isDownloading)
                      _statusPill(
                        'Downloading ${pct.toStringAsFixed(0)}%',
                        const Color(0xFF2563EB),
                      ),
                    if (_hasPartialDownload && !_downloadFailed)
                      _statusPill('Resume download', const Color(0xFFEA580C)),
                    if (_downloadFailed)
                      _statusPill('Failed download', const Color(0xFFDC2626)),
                    if (_fileSizeBytes != null && _fileSizeBytes! > 0)
                      Text(
                        _formatBytes(_fileSizeBytes!),
                        style: const TextStyle(
                          color: Nocturne.textFaint,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
                if (_isDownloaded ||
                    _isDownloading ||
                    _hasPartialDownload ||
                    _downloadFailed ||
                    (_fileSizeBytes != null && _fileSizeBytes! > 0))
                  const SizedBox(height: 12),

                // Primary action button + Download / Pause / Cancel controls
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: hasSource
                            ? () => _play(forceRestart: _isCompletedWatched)
                            : null,
                        icon: Icon(primaryIcon, size: 20),
                        label: Text(
                          hasSource ? primaryLabel : 'Unavailable',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Nocturne.gold,
                          foregroundColor: const Color(0xFF1A1205),
                          disabledBackgroundColor: Nocturne.surfaceInset,
                          disabledForegroundColor: Nocturne.textHint,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ),
                    if (_canDownload) ...[
                      const SizedBox(width: 8),
                      if (_isDownloading) ...[
                        _squareActionBtn(
                          icon: Icons.pause_rounded,
                          tooltip: 'Pause download',
                          color: const Color(0xFFEA580C),
                          onTap: _pauseDownload,
                        ),
                        const SizedBox(width: 6),
                        _squareActionBtn(
                          icon: Icons.close_rounded,
                          tooltip: 'Cancel download',
                          color: const Color(0xFFDC2626),
                          onTap: _cancelDownload,
                        ),
                      ] else if (_isDownloaded) ...[
                        _squareActionBtn(
                          icon: Icons.delete_outline_rounded,
                          tooltip: 'Delete download',
                          color: const Color(0xFFDC2626),
                          onTap: _deleteDownload,
                        ),
                      ] else if (_hasPartialDownload || _downloadFailed) ...[
                        _squareActionBtn(
                          icon: Icons.download_rounded,
                          tooltip: 'Resume download',
                          color: const Color(0xFFEA580C),
                          onTap: _startOrResumeDownload,
                        ),
                        const SizedBox(width: 6),
                        _squareActionBtn(
                          icon: Icons.close_rounded,
                          tooltip: 'Cancel download',
                          color: const Color(0xFFDC2626),
                          onTap: _cancelDownload,
                        ),
                      ] else ...[
                        _squareActionBtn(
                          icon: Icons.download_rounded,
                          tooltip: 'Download for offline viewing',
                          color: Nocturne.gold,
                          onTap: _startOrResumeDownload,
                        ),
                      ],
                    ],
                    if (_tmdbInfo?.trailerUrl != null &&
                        _tmdbInfo!.trailerUrl!.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      _squareActionBtn(
                        icon: Icons.theaters_rounded,
                        tooltip: 'Watch trailer',
                        color: Nocturne.textMuted,
                        onTap: _playTrailer,
                      ),
                    ],
                  ],
                ),

                // Watch progress indicator when partially watched
                if (_isPartiallyWatched && _watchProgressFraction > 0) ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Watched ${_formatDuration(_progress!.positionSeconds)}',
                        style: const TextStyle(
                          color: Nocturne.textMuted,
                          fontSize: 11,
                        ),
                      ),
                      if ((_progress!.durationSeconds > 0
                              ? _progress!.durationSeconds
                              : _movie.duration) >
                          0)
                        Text(
                          '${_formatDuration(((_progress!.durationSeconds > 0 ? _progress!.durationSeconds : _movie.duration) - _progress!.positionSeconds).clamp(0, 999999))} left',
                          style: const TextStyle(
                            color: Nocturne.goldLight,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: _watchProgressFraction,
                      minHeight: 4,
                      backgroundColor: Colors.white.withValues(alpha: 0.14),
                      valueColor:
                          const AlwaysStoppedAnimation<Color>(Nocturne.gold),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Full-width bottom download progress bar
          if (showDownloadBar)
            LinearProgressIndicator(
              value: (pct / 100.0).clamp(0.0, 1.0),
              minHeight: 4,
              backgroundColor: Colors.white.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation<Color>(
                _isDownloading
                    ? const Color(0xFF2563EB)
                    : const Color(0xFFEA580C),
              ),
            ),
        ],
      ),
    );
  }

  Widget _statusPill(String text, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _squareActionBtn({
    required IconData icon,
    required String tooltip,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: Nocturne.surfaceInset,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.55), width: 1),
          ),
          alignment: Alignment.center,
          child: Icon(icon, color: color, size: 20),
        ),
      ),
    );
  }

  Widget _buildCastSection(List<CatchUpCredit> cast) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'CAST & ACTORS',
          style: TextStyle(
            color: Nocturne.textFaint,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 114,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: cast.length,
            separatorBuilder: (_, __) => const SizedBox(width: 14),
            itemBuilder: (context, index) {
              final person = cast[index];
              return SizedBox(
                width: 78,
                child: Column(
                  children: [
                    Container(
                      width: 62,
                      height: 62,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Nocturne.surfaceRaised,
                        border: Border.all(
                          color: Nocturne.gold.withValues(alpha: 0.4),
                          width: 1.5,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: (person.profileUrl ?? '').isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: person.profileUrl!,
                              cacheKey: imageCacheKey(person.profileUrl),
                              fit: BoxFit.cover,
                              memCacheWidth: 160,
                              placeholder: (_, __) => const Icon(
                                Icons.person_rounded,
                                color: Nocturne.textHint,
                                size: 28,
                              ),
                              errorWidget: (_, __, ___) => const Icon(
                                Icons.person_rounded,
                                color: Nocturne.textHint,
                                size: 28,
                              ),
                            )
                          : const Icon(
                              Icons.person_rounded,
                              color: Nocturne.textHint,
                              size: 28,
                            ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      person.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if ((person.role ?? '').isNotEmpty)
                      Text(
                        person.role!,
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
    );
  }

  Widget _buildDetailsSection() {
    final rows = <MapEntry<String, String>>[];
    if (_tmdbInfo?.releaseDate != null && _tmdbInfo!.releaseDate!.isNotEmpty) {
      rows.add(MapEntry('Release Date', _tmdbInfo!.releaseDate!));
    } else if (_releaseYear != null) {
      rows.add(MapEntry('Release Year', _releaseYear!));
    }
    if (_durationLabel.isNotEmpty) {
      rows.add(MapEntry('Runtime', _durationLabel));
    }
    if (_tmdbInfo != null && _tmdbInfo!.rating > 0) {
      rows.add(MapEntry('TMDB Rating', '${_tmdbInfo!.rating.toStringAsFixed(1)} / 10'));
    }
    if (_movie.ageClassification.isNotEmpty) {
      rows.add(MapEntry('Classification', _movie.ageClassification.toUpperCase()));
    }
    if (_tmdbInfo != null && _tmdbInfo!.directors.isNotEmpty) {
      rows.add(MapEntry(
        'Director',
        _tmdbInfo!.directors.map((d) => d.name).join(', '),
      ));
    }
    if (_tmdbInfo != null && _tmdbInfo!.writers.isNotEmpty) {
      rows.add(MapEntry(
        'Writers',
        _tmdbInfo!.writers.take(3).map((w) => w.name).join(', '),
      ));
    }
    rows.add(MapEntry(
      'Offline Access',
      _isDownloaded
          ? 'Downloaded on device'
          : _canDownload
              ? 'Available for download'
              : 'Streaming only',
    ));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'DETAILS',
          style: TextStyle(
            color: Nocturne.textFaint,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 8),
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 7),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 112,
                  child: Text(
                    r.key,
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 12.5,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    r.value,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 12.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildSimilarSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Similar in Our Collection',
                style: TextStyle(
                  color: Nocturne.text,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '${_similarMovies.length} titles',
                style: const TextStyle(
                  color: Nocturne.textFaint,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 186,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _similarMovies.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final item = _similarMovies[index];
                return GestureDetector(
                  onTap: () {
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(
                        builder: (_) => MovieDetailScreen(movie: item),
                      ),
                    );
                  },
                  child: SizedBox(
                    width: 116,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            width: 116,
                            height: 146,
                            color: Nocturne.surfaceRaised,
                            child: (item.posterUrl ?? '').isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: item.posterUrl!,
                                    cacheKey: imageCacheKey(item.posterUrl),
                                    fit: BoxFit.cover,
                                    memCacheWidth: 240,
                                    errorWidget: (_, __, ___) => const Icon(
                                      Icons.movie_creation_outlined,
                                      color: Nocturne.textHint,
                                    ),
                                  )
                                : const Icon(
                                    Icons.movie_creation_outlined,
                                    color: Nocturne.textHint,
                                  ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Nocturne.text,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w500,
                            height: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  static String _formatDuration(int seconds) {
    if (seconds <= 0) return '0m';
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    if (h > 0) return '${h}h ${m}m';
    if (m > 0) return '${m}m';
    return '${s}s';
  }

  static String _formatBytes(int bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
    }
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    if (bytes >= 1024) {
      return '${(bytes / 1024).toStringAsFixed(0)} KB';
    }
    return '$bytes B';
  }
}
