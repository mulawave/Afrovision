import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../../../core/services/app_preferences_service.dart';
import '../../../core/services/player_settings_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../channel/services/channel_service.dart';
import '../../subscription/widgets/exclusive_membership_sheets.dart';
import '../controllers/vod_player_controller.dart';
import '../models/series_model.dart';
import '../models/vod_playback_args.dart';
import '../services/vod_cache_service.dart';
import '../services/vod_service.dart';

/// VOD player for movies and series episodes.
///
/// Uses the same media_kit / MpvBufferConfig VOD profile as the channel player
/// and supports both streamed and downloaded (offline) content.
class VodPlayerScreen extends StatefulWidget {
  final VodPlaybackArgs args;

  const VodPlayerScreen({
    super.key,
    required this.args,
  });

  @override
  State<VodPlayerScreen> createState() => _VodPlayerScreenState();
}

class _VodPlayerScreenState extends State<VodPlayerScreen>
    with SingleTickerProviderStateMixin {
  late VodPlaybackArgs _args;
  VodPlayerController? _controller;
  WebViewController? _embedController;

  bool _loading = true;
  String? _error;
  bool _controlsVisible = true;
  Timer? _controlsTimer;
  Timer? _progressTimer;
  int _resumePosition = 0;
  bool _isDownloaded = false;
  bool _isDownloading = false;
  int _downloadPercent = 0;
  String? _downloadError;

  // Series autoplay
  EpisodeModel? _currentEpisode;
  SeriesModel? _series;
  String? _nextEpisodeId;
  bool _isAutoPlayEnabled = true;
  bool _autoAdvancing = false;

  @override
  void initState() {
    super.initState();
    _args = widget.args;
    _series = _args.series;
    _currentEpisode = _args.episode;
    _nextEpisodeId = _args.nextEpisodeId;
    _isAutoPlayEnabled = true;
    AppPreferencesService.autoplayNext.then((v) {
      if (mounted) setState(() => _isAutoPlayEnabled = v);
    });
    _initialize();
    _startControlsTimer();
  }

  @override
  void dispose() {
    _saveProgress();
    _progressTimer?.cancel();
    _controlsTimer?.cancel();
    unawaited(_controller?.disposeAsync() ?? Future.value());
    _embedController = null;
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  Future<void> _initialize() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    // Mid-session entitlement re-check. If this title belongs to an
    // exclusive channel and the user's membership has lapsed (or was
    // revoked) since discovery, block playback and surface the Gate
    // sheet with a Renew CTA instead of trying to stream. Cached items
    // pass an empty channelId and are exempt (they already downloaded).
    if (_args.channelId.isNotEmpty) {
      final gateBlocked = await _checkExclusiveEntitlement();
      if (gateBlocked) return;
    }

    // Load download state.
    await VodCacheService.instance.initialize();
    _isDownloaded = VodCacheService.instance.isCached(_args.mediaType, _args.mediaId);
    _isDownloading = VodCacheService.instance.isDownloading(_args.mediaType, _args.mediaId);

    // Resolve playback URL.
    String? videoUrl;
    String? localFilePath;

    if (_isDownloaded) {
      localFilePath = await VodCacheService.instance.getLocalPath(
        _args.mediaType,
        _args.mediaId,
      );
    }

    if (localFilePath == null) {
      videoUrl = _args.playbackUrl;
    }

    // Load resume progress from backend.
    try {
      final progress = await VodService.getProgress(_args.mediaType, _args.mediaId);
      if (progress != null) {
        _resumePosition = progress.positionSeconds;
      }
    } catch (_) {}

    // Embed/external mode.
    if (videoUrl != null && _isEmbedUrl(videoUrl)) {
      await _initEmbedPlayer(videoUrl);
      return;
    }

    if (videoUrl == null && localFilePath == null) {
      setState(() {
        _error = 'No video source available for this title.';
        _loading = false;
      });
      return;
    }

    _controller = VodPlayerController();
    _controller!.onCompleted = _onPlaybackCompleted;
    _controller!.addListener(_onControllerChanged);

    try {
      await PlayerSettingsService.instance.initialize();
      await _controller!.initialize(
        videoUrl: videoUrl,
        localFilePath: localFilePath,
        startPositionSeconds: _resumePosition,
        userHlsBps: PlayerSettingsService.instance.current.quality.bps,
      );
      // VodPlayerController swallows its own initialize() errors (logs and
      // returns) rather than rethrowing, so this try/catch alone never sees
      // a failed load — check the controller's own error state explicitly,
      // otherwise a failed VOD load renders a dead player with no message.
      if (_controller!.hasError) {
        _error = 'Unable to start playback. ${_controller!.errorMessage ?? 'Please try again.'}';
      }
    } catch (e) {
      _error = 'Unable to start playback. ${_sanitizeError(e)}';
    } finally {
      _startProgressTimer();
      setState(() => _loading = false);
    }
  }

  /// Returns true when the exclusive gate was shown and the caller should
  /// stop initializing playback. False otherwise (either not exclusive,
  /// or entitlement still valid, or the check failed open).
  Future<bool> _checkExclusiveEntitlement() async {
    try {
      final status =
          await ChannelService.getExclusiveAccessStatus(_args.channelId);
      // Not an exclusive channel → nothing to gate.
      if (status.monthlyFeeNgn <= 0) return false;
      // Entitled → proceed with playback.
      if (status.hasActiveEntitlement) return false;

      if (!mounted) return true;

      // Look up channel name for the sheet copy. Fall back silently.
      String channelName = 'this channel';
      try {
        final channel =
            await ChannelService.getChannelById(_args.channelId);
        channelName = channel.name;
      } catch (_) {}
      if (!mounted) return true;

      final expiryDate = _resolveExpiry(status.expiresAt);

      await showMembershipGateSheet(
        context,
        channelName: channelName,
        expiryDate: expiryDate,
        onRenew: () {
          if (!mounted) return;
          // Bounce to the paywall — it handles Xlounge vs request/renew.
          Navigator.of(context).pushReplacementNamed(
            '/exclusive-access',
            arguments: _args.channelId,
          );
        },
      );
      if (!mounted) return true;
      // If the user dismissed without Renew, back out of the player.
      Navigator.of(context).maybePop();
      return true;
    } catch (_) {
      // Fail open — a status-endpoint blip must not deny playback to a
      // user we can't confirm has lost entitlement.
      return false;
    }
  }

  /// The status endpoint returns `expiresAt` as a string that may be an
  /// ISO date, an epoch-seconds number, or null. Normalize to a human date
  /// for the sheet; fall back to em-dash on any parse failure.
  String _resolveExpiry(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final asInt = int.tryParse(raw);
    if (asInt != null) {
      return _formatDate(DateTime.fromMillisecondsSinceEpoch(asInt * 1000));
    }
    final parsed = DateTime.tryParse(raw);
    if (parsed != null) return _formatDate(parsed);
    return raw;
  }

  String _formatDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  bool _isEmbedUrl(String url) {
    final lower = url.toLowerCase();
    return lower.contains('youtube.com') ||
        lower.contains('youtube-nocookie.com') ||
        lower.contains('youtu.be') ||
        _args.videoSourceMode == 'embed';
  }

  String? _extractYouTubeVideoId(String rawUrl) {
    try {
      final parsed = Uri.parse(rawUrl);
      final host = parsed.host.toLowerCase();
      final segments = parsed.pathSegments;

      if (host.contains('youtu.be') && segments.isNotEmpty) {
        return segments.first;
      }

      final v = parsed.queryParameters['v'];
      if (v != null && v.isNotEmpty) return v;

      final embedIndex = segments.indexOf('embed');
      if (embedIndex >= 0 && embedIndex + 1 < segments.length) {
        return segments[embedIndex + 1];
      }

      if (segments.length >= 2 &&
          (segments[0] == 'live' || segments[0] == 'shorts')) {
        return segments[1];
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  bool _isYouTubeUrl(String url) {
    final lower = url.toLowerCase();
    return lower.contains('youtube.com') ||
        lower.contains('youtube-nocookie.com') ||
        lower.contains('youtu.be');
  }

  Future<void> _initEmbedPlayer(String url) async {
    final videoId = _isYouTubeUrl(url) ? _extractYouTubeVideoId(url) : null;
    final html = _buildEmbedHtml(url, videoId);

    late final PlatformWebViewControllerCreationParams creationParams;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      creationParams = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: <PlaybackMediaTypes>{},
      );
    } else {
      creationParams = const PlatformWebViewControllerCreationParams();
    }

    final ctrl = WebViewController.fromPlatformCreationParams(creationParams)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setUserAgent(
        'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
        ),
      );

    final platform = ctrl.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      await platform.setMediaPlaybackRequiresUserGesture(false);
    }

    await ctrl.loadHtmlString(
      html,
      baseUrl: 'https://www.youtube-nocookie.com',
    );

    _embedController = ctrl;
  }

  String _buildEmbedHtml(String url, String? videoId) {
    final lower = url.toLowerCase();
    final String src;

    if (videoId != null && videoId.isNotEmpty) {
      src = Uri.https('www.youtube-nocookie.com', '/embed/$videoId', {
        'autoplay': '1',
        'controls': '1',
        'mute': '0',
        'playsinline': '1',
        'enablejsapi': '1',
        'rel': '0',
        'iv_load_policy': '3',
        'modestbranding': '1',
        'origin': 'https://www.youtube-nocookie.com',
      }).toString();
    } else if (lower.contains('youtube.com/watch?v=')) {
      final id = Uri.parse(url).queryParameters['v'] ?? '';
      src = 'https://www.youtube-nocookie.com/embed/$id?autoplay=1&enablejsapi=1&rel=0&origin=https://www.youtube-nocookie.com';
    } else if (lower.contains('youtu.be/')) {
      final id = url.split('/').last.split('?').first;
      src = 'https://www.youtube-nocookie.com/embed/$id?autoplay=1&enablejsapi=1&rel=0&origin=https://www.youtube-nocookie.com';
    } else {
      src = url;
    }

    return '''<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe src="$src" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
</body>
</html>''';
  }

  void _onControllerChanged() {
    if (mounted) setState(() {});
  }

  void _onPlaybackCompleted() {
    _saveProgress();
    // Guard: only auto-advance if the video actually played for at least 10
    // seconds. Without this, a failed load (zero duration) can fire
    // "completed" immediately and cascade through every episode, landing on
    // the last one regardless of which the user selected.
    final played = _controller?.position.inSeconds ?? 0;
    if (played < 10) return;
    if (_args.mediaType == 'episode' && _nextEpisodeId != null && _isAutoPlayEnabled) {
      _autoAdvanceToNext();
    }
  }

  Future<void> _autoAdvanceToNext() async {
    if (!mounted || _nextEpisodeId == null || _series == null) return;
    setState(() => _autoAdvancing = true);

    try {
      final detail = await VodService.getEpisodeDetail(
        _args.channelId,
        _args.seriesId!,
        _nextEpisodeId!,
      );
      final next = detail.episode;
      final nav = detail.navigation;

      // Build args for next episode and swap.
      final nextArgs = VodPlaybackArgs.fromEpisode(
        _series!,
        next,
        nextEpisodeId: nav.nextEpisodeId,
        previousEpisodeId: nav.previousEpisodeId,
      );

      _args = nextArgs;
      _currentEpisode = next;
      _nextEpisodeId = nav.nextEpisodeId;
      _resumePosition = 0;

      _controller?.removeListener(_onControllerChanged);
      await _controller?.disposeAsync();
      _controller = null;

      if (mounted) await _initialize();
    } catch (e) {
      if (mounted) {
        setState(() {
          _autoAdvancing = false;
          _error = 'Failed to load next episode: ${_sanitizeError(e)}';
        });
      }
    } finally {
      if (mounted) setState(() => _autoAdvancing = false);
    }
  }

  void _startProgressTimer() {
    _progressTimer?.cancel();
    _progressTimer = Timer.periodic(const Duration(seconds: 5), (_) => _saveProgress());
  }

  Future<void> _saveProgress() async {
    final position = _controller?.position.inSeconds ?? 0;
    final duration = _controller?.duration.inSeconds ?? _args.duration;
    if (position <= 0) return;

    try {
      await VodService.saveProgress(
        _args.mediaType,
        _args.mediaId,
        position,
        duration,
      );
    } catch (_) {
      // Offline or unauthenticated — non-fatal.
    }
  }

  void _toggleControls() {
    setState(() => _controlsVisible = !_controlsVisible);
    _startControlsTimer();
  }

  void _startControlsTimer() {
    _controlsTimer?.cancel();
    if (_controlsVisible) {
      _controlsTimer = Timer(const Duration(seconds: 4), () {
        if (mounted) setState(() => _controlsVisible = false);
      });
    }
  }

  Future<void> _onDownloadTap() async {
    if (_isDownloaded) return;
    final url = _args.playbackUrl;
    if (url == null || url.isEmpty) return;

    setState(() {
      _isDownloading = true;
      _downloadPercent = 0;
      _downloadError = null;
    });

    // Subscribe to progress stream.
    VodCacheService.instance
        .progressStream(_args.mediaType, _args.mediaId)
        ?.listen((progress) {
      if (mounted) {
        setState(() => _downloadPercent = progress.percent.toInt());
      }
    });

    await VodCacheService.instance.download(
      mediaType: _args.mediaType,
      mediaId: _args.mediaId,
      title: _args.title,
      posterUrl: _args.posterUrl,
      sourceMode: _args.videoSourceMode,
      url: url,
      duration: _args.duration,
      targetBps: PlayerSettingsService.instance.current.quality.bps,
    );

    _isDownloaded = VodCacheService.instance.isCached(_args.mediaType, _args.mediaId);
    _isDownloading = false;

    if (!_isDownloaded) {
      _downloadError = VodCacheService.instance.lastError(
        _args.mediaType,
        _args.mediaId,
      );
    }

    if (mounted) setState(() {});
  }

  Future<void> _deleteDownload() async {
    await VodCacheService.instance.delete(_args.mediaType, _args.mediaId);
    setState(() => _isDownloaded = false);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) _saveProgress();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          fit: StackFit.expand,
          children: [
            _buildVideoArea(),
            if (_loading || _autoAdvancing) _buildLoadingOverlay(),
            if (_error != null) _buildErrorOverlay(_error!),
            if (!_loading && _error == null) _buildControls(),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoArea() {
    if (_embedController != null) {
      return WebViewWidget(controller: _embedController!);
    }

    final vc = _controller?.videoController;
    if (vc == null) {
      return Container(color: Colors.black);
    }

    final aspect = _controller!.aspectRatio > 0 ? _controller!.aspectRatio : 16 / 9;
    return GestureDetector(
      onTap: _toggleControls,
      child: Center(
        child: AspectRatio(
          aspectRatio: aspect,
          child: _controller!.buildVideo(fit: BoxFit.contain),
        ),
      ),
    );
  }

  Widget _buildLoadingOverlay() {
    return Container(
      color: Colors.black54,
      child: const Center(
        child: CircularProgressIndicator(color: AppColors.orange),
      ),
    );
  }

  Widget _buildErrorOverlay(String message) {
    return Container(
      color: Colors.black87,
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.videocam_off, color: AppColors.errorRed, size: 48),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.white, fontSize: 14),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _initialize,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.orange,
              foregroundColor: AppColors.darkBlue,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildControls() {
    return GestureDetector(
      onTap: _toggleControls,
      child: AnimatedOpacity(
        opacity: _controlsVisible ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 200),
        child: Container(
          color: _controlsVisible ? Colors.black38 : Colors.transparent,
          child: Column(
            children: [
              _buildTopBar(),
              const Spacer(),
              _buildBottomBar(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Container(
      padding: const EdgeInsets.only(top: 44, left: 8, right: 8, bottom: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.85),
            Colors.transparent,
          ],
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios, color: AppColors.white),
            onPressed: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Text(
              _args.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (_args.mediaType == 'episode')
            IconButton(
              icon: const Icon(Icons.playlist_play, color: AppColors.white),
              onPressed: _showEpisodesSheet,
            ),
          _buildDownloadButton(),
          IconButton(
            icon: const Icon(Icons.settings, color: AppColors.white),
            onPressed: _showSettingsSheet,
          ),
        ],
      ),
    );
  }

  Widget _buildDownloadButton() {
    if (!_args.downloadable || _args.playbackUrl == null) {
      return const SizedBox.shrink();
    }

    if (_isDownloaded) {
      return IconButton(
        icon: const Icon(Icons.offline_pin, color: AppColors.successGreen),
        onPressed: _deleteDownload,
      );
    }

    if (_isDownloading) {
      return SizedBox(
        width: 48,
        height: 48,
        child: Center(
          child: Text(
            '$_downloadPercent%',
            style: const TextStyle(color: AppColors.white, fontSize: 10),
          ),
        ),
      );
    }

    return IconButton(
      icon: const Icon(Icons.download_for_offline_outlined, color: AppColors.white),
      onPressed: _onDownloadTap,
      tooltip: _downloadError,
    );
  }

  Widget _buildBottomBar() {
    final position = _controller?.position ?? Duration.zero;
    final duration = _controller?.duration ?? Duration.zero;
    final max = duration.inSeconds.toDouble();
    final value = position.inSeconds.clamp(0, duration.inSeconds).toDouble();

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            Colors.black.withValues(alpha: 0.85),
            Colors.transparent,
          ],
        ),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildSeekBar(value, max),
            Row(
              children: [
                IconButton(
                  icon: Icon(
                    _controller?.isPlaying ?? false
                        ? Icons.pause
                        : Icons.play_arrow,
                    color: AppColors.white,
                  ),
                  onPressed: _controller?.togglePlayPause,
                ),
                Text(
                  '${_formatDuration(position)} / ${_formatDuration(duration)}',
                  style: const TextStyle(color: AppColors.white, fontSize: 12),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.replay_10, color: AppColors.white),
                  onPressed: () => _controller?.seekBackward(10),
                ),
                IconButton(
                  icon: const Icon(Icons.forward_10, color: AppColors.white),
                  onPressed: () => _controller?.seekForward(10),
                ),
                if (_nextEpisodeId != null)
                  IconButton(
                    icon: const Icon(Icons.skip_next, color: AppColors.white),
                    onPressed: _autoAdvanceToNext,
                  ),
                IconButton(
                  icon: const Icon(
                    Icons.fullscreen,
                    color: AppColors.white,
                  ),
                  onPressed: _toggleFullScreen,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSeekBar(double value, double max) {
    return SliderTheme(
      data: SliderThemeData(
        activeTrackColor: AppColors.orange,
        inactiveTrackColor: AppColors.inputBorder,
        thumbColor: AppColors.orange,
        overlayColor: AppColors.orange.withValues(alpha: 0.2),
        trackHeight: 3,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
      ),
      child: Slider(
        value: value,
        max: max > 0 ? max : 1,
        onChanged: (v) {
          _controller?.seekTo(Duration(seconds: v.toInt()));
        },
      ),
    );
  }

  String _formatDuration(Duration d) {
    final hours = d.inHours;
    final minutes = d.inMinutes.remainder(60);
    final seconds = d.inSeconds.remainder(60);
    final mm = minutes.toString().padLeft(2, '0');
    final ss = seconds.toString().padLeft(2, '0');
    if (hours > 0) return '$hours:$mm:$ss';
    return '$mm:$ss';
  }

  void _toggleFullScreen() {
    final isFull = MediaQuery.of(context).orientation == Orientation.landscape;
    if (isFull) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    } else {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  void _showEpisodesSheet() {
    if (_series == null) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardBg,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: _series!.seasons.expand((season) {
              return [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Text(
                    season.title,
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                ...season.episodes.map((ep) {
                  final isCurrent = ep.id == _currentEpisode?.id;
                  return ListTile(
                    leading: Text(
                      '${ep.episodeNumber}',
                      style: const TextStyle(color: AppColors.white),
                    ),
                    title: Text(
                      ep.title,
                      style: TextStyle(
                        color: isCurrent ? AppColors.orange : AppColors.white,
                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                    subtitle: ep.duration > 0
                      ? Text(
                          _formatDuration(Duration(seconds: ep.duration)),
                          style: const TextStyle(color: AppColors.hintText),
                        )
                      : null,
                    onTap: () {
                      Navigator.of(ctx).pop();
                      _playEpisode(ep);
                    },
                  );
                }),
              ];
            }).toList(),
          ),
        ),
      ),
    );
  }

  Future<void> _playEpisode(EpisodeModel ep) async {
    if (_series == null) return;

    _saveProgress();

    // Find next/previous in series order.
    final all = _series!.allEpisodes;
    final index = all.indexWhere((e) => e.id == ep.id);
    final nextId = index >= 0 && index < all.length - 1 ? all[index + 1].id : null;

    _args = VodPlaybackArgs.fromEpisode(
      _series!,
      ep,
      nextEpisodeId: nextId,
    );
    _currentEpisode = ep;
    _nextEpisodeId = nextId;
    _resumePosition = 0;

    _controller?.removeListener(_onControllerChanged);
    await _controller?.disposeAsync();
    _controller = null;

    if (mounted) await _initialize();
  }

  void _showSettingsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardBg,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text(
                'Autoplay next episode',
                style: TextStyle(color: AppColors.white),
              ),
              trailing: Switch(
                value: _isAutoPlayEnabled,
                activeThumbColor: AppColors.orange,
                onChanged: (v) {
                  setState(() => _isAutoPlayEnabled = v);
                  Navigator.of(ctx).pop();
                },
              ),
            ),
            ListTile(
              title: const Text(
                'Quality profile',
                style: TextStyle(color: AppColors.white),
              ),
              subtitle: Text(
                PlayerSettingsService.instance.current.quality.description,
                style: const TextStyle(color: AppColors.hintText),
              ),
              onTap: () {
                Navigator.of(ctx).pop();
                _showQualitySelector();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showQualitySelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardBg,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: QualityProfile.values.map((q) {
            return ListTile(
              title: Text(
                q.label,
                style: const TextStyle(color: AppColors.white),
              ),
              subtitle: Text(
                q.description,
                style: const TextStyle(color: AppColors.hintText),
              ),
              trailing: PlayerSettingsService.instance.current.quality == q
                  ? const Icon(Icons.check, color: AppColors.orange)
                  : null,
              onTap: () async {
                final newSettings = PlayerSettingsService.instance.current
                    .copyWith(quality: q);
                await PlayerSettingsService.instance.save(newSettings);
                if (ctx.mounted) Navigator.of(ctx).pop();
                _controller?.setQuality(q.bps);
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  String _sanitizeError(dynamic e) {
    final raw = e.toString().toLowerCase();
    if (raw.contains('network') ||
        raw.contains('socket') ||
        raw.contains('connection')) {
      return 'Check your connection and try again.';
    }
    return e.toString();
  }
}
