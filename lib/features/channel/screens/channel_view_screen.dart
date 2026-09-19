import '../../../core/ads/pangle_widgets.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/config/app_config.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../../../core/services/watch_history_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../../../core/widgets/wave_thumbnail.dart';
import '../../auth/services/auth_service.dart';
import '../../broadcast/services/channel_library_service.dart';
import '../../kyc/services/kyc_service.dart';
import '../../subscription/models/channel_subscription_model.dart';
import '../../subscription/services/channel_subscription_service.dart';
import '../../wave/models/wave_model.dart';
import '../../wave/services/wave_service.dart';
import '../../static_pages/static_pages_registry.dart';
import '../models/channel_model.dart';
import '../services/channel_content_service.dart';
import '../services/channel_service.dart';
import '../widgets/exclusive_requests_section.dart';
import 'media_player_screen.dart';

enum ChannelSection {
  about,
  streams,
  library,
  movies,
  series,
  waves,
  schedule,
  requests,
  manage,
}

extension ChannelSectionX on ChannelSection {
  String get label {
    switch (this) {
      case ChannelSection.about:
        return 'About';
      case ChannelSection.streams:
        return 'Past Streams';
      case ChannelSection.library:
        return 'Library';
      case ChannelSection.movies:
        return 'Movies';
      case ChannelSection.series:
        return 'Series';
      case ChannelSection.waves:
        return 'Waves';
      case ChannelSection.schedule:
        return 'Schedule';
      case ChannelSection.requests:
        return 'Requests';
      case ChannelSection.manage:
        return 'Manage';
    }
  }

  String get queryKey {
    switch (this) {
      case ChannelSection.about:
        return 'about';
      case ChannelSection.streams:
        return 'past-streams';
      case ChannelSection.library:
        return 'library';
      case ChannelSection.movies:
        return 'movies';
      case ChannelSection.series:
        return 'series';
      case ChannelSection.waves:
        return 'waves';
      case ChannelSection.schedule:
        return 'schedule';
      case ChannelSection.requests:
        return 'requests';
      case ChannelSection.manage:
        return 'manage';
    }
  }
}

class ChannelViewScreen extends StatefulWidget {
  const ChannelViewScreen({super.key});

  @override
  State<ChannelViewScreen> createState() => _ChannelViewScreenState();
}

class _ChannelViewScreenState extends State<ChannelViewScreen>
    with SingleTickerProviderStateMixin {
  ChannelModel? _channel;
  bool _loading = true;
  bool _argsHandled = false;
  bool _exclusiveBlocked = false;
  String? _blockedChannelId;
  bool _canManage = false;
  int _libraryUnreadCount = 0;
  bool _libraryUnreadLoading = false;
  bool _followLoading = false;
  bool _isFollowing = false;
  int _followersCount = 0;
  ChannelSection _activeSection = ChannelSection.about;
  List<WaveModel> _channelWaves = const <WaveModel>[];
  bool _wavesLoading = false;
  String? _wavesError;
  String? _waveActionId;

  // Movies / Series tabs (restored per wips_restoration.md Phase 4).
  List<ChannelMovie> _channelMovies = const <ChannelMovie>[];
  bool _moviesLoading = false;
  String? _moviesError;
  List<ChannelSeries> _channelSeries = const <ChannelSeries>[];
  bool _seriesLoading = false;
  String? _seriesError;

  // Channel subscription state
  bool _subLoading = false;
  ChannelSubscriptionModel? _subscription;

  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_argsHandled) return;
    _argsHandled = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    String? channelId;
    ChannelSection? section;

    if (args is ChannelModel) {
      setState(() {
        _channel = args;
        _loading = false;
      });
      _animController.forward();
      channelId = args.id;
    } else if (args is String) {
      if (args.contains('?')) {
        final uri = Uri.tryParse(args);
        if (uri != null) {
          channelId = uri.queryParameters['channelId'];
          section = _parseSection(uri.queryParameters['section']);
        }
      } else {
        channelId = args;
      }
    } else if (args is Map) {
      channelId = (args['channelId'] ?? args['id'])?.toString();
      section = _parseSection(args['section']?.toString());
      final channelArg = args['channel'];
      if (channelArg is ChannelModel) {
        setState(() {
          _channel = channelArg;
          _loading = false;
        });
        _animController.forward();
      }
    }

    if (section != null) {
      _activeSection = section;
    }

    if (channelId != null && channelId.isNotEmpty) {
      _loadChannel(channelId);
    }
  }

  ChannelSection? _parseSection(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    switch (raw.trim().toLowerCase()) {
      case 'about':
        return ChannelSection.about;
      case 'past-streams':
      case 'streams':
        return ChannelSection.streams;
      case 'library':
        return ChannelSection.library;
      case 'movies':
        return ChannelSection.movies;
      case 'series':
        return ChannelSection.series;
      case 'waves':
        return ChannelSection.waves;
      case 'schedule':
        return ChannelSection.schedule;
      case 'requests':
        return ChannelSection.requests;
      case 'manage':
        return ChannelSection.manage;
      default:
        debugPrint('[ChannelView] channel_section_fallback_invalid: $raw');
        return ChannelSection.about;
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadChannel(String id) async {
    try {
      final channel = await ChannelService.getChannelById(id);
      bool canManage = false;
      ChannelSubscriptionModel? sub;

      try {
        final me = await AuthService.getCurrentUser();
        canManage = me.id == channel.ownerId || me.role == 'admin';

        if (channel.isExclusive && !canManage) {
          var status = await ChannelService.getExclusiveAccessStatus(
            channel.id,
          );

          // If backend reports KYC ineligible but the local user is marked
          // verified (e.g. admin-updated KYC), retry once to allow for
          // eventual consistency between admin updates and access checks.
          final me = await AuthService.getCurrentUser();
          if (!status.eligibleByKyc && me.kycStatus == 'verified') {
            try {
              // Refresh any cached KYC record and re-query the access status.
              await KycService.getMe(forceRefresh: true);
              status = await ChannelService.getExclusiveAccessStatus(
                channel.id,
              );
            } catch (_) {
              // ignore and fall through to existing blocking behaviour
            }
          }

          if (!status.eligibleByKyc || !status.hasActiveEntitlement) {
            if (!mounted) return;
            setState(() {
              _exclusiveBlocked = true;
              _blockedChannelId = channel.id;
              _loading = false;
            });
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted || _blockedChannelId == null) return;
              Navigator.pushReplacementNamed(
                context,
                '/exclusive-access',
                arguments: _blockedChannelId!,
              );
            });
            return;
          }
        }

        final result = await ChannelSubscriptionService.check(id);
        if (result['success'] == true && result['subscription'] != null) {
          sub = result['subscription'] as ChannelSubscriptionModel;
        }
      } catch (_) {
        if (channel.isExclusive) {
          if (!mounted) return;
          setState(() {
            _exclusiveBlocked = true;
            _blockedChannelId = channel.id;
            _loading = false;
          });
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || _blockedChannelId == null) return;
            Navigator.pushReplacementNamed(
              context,
              '/exclusive-access',
              arguments: _blockedChannelId!,
            );
          });
          return;
        }
      }

      FollowStatusModel? followStatus;
      try {
        followStatus = await ChannelService.getChannelFollowStatus(channel.id);
      } catch (e) {
        debugPrint('[ChannelView] follow status error: $e');
      }

      if (!mounted) return;
      setState(() {
        _exclusiveBlocked = false;
        _blockedChannelId = null;
        _channel = channel;
        _canManage = canManage;
        _followersCount =
            followStatus?.followersCount ?? channel.followersCount;
        _isFollowing = followStatus?.followed ?? false;
        _subscription = sub;
        _loading = false;
      });

      _loadLibraryUnreadCount();
      _loadChannelWaves();
      _loadChannelMovies();
      _loadChannelSeries();

      if (_activeSection == ChannelSection.manage && !_canManage) {
        _activeSection = ChannelSection.about;
      }

      _animController.forward();
      // Record view for analytics (fire and forget)
      ChannelService.recordView(id).catchError((_) {});
      WatchHistoryService.record(
        channelId: channel.id,
        channelName: channel.name,
        channelLogo: channel.logoUrl,
        channelBanner: channel.bannerUrl,
      ).catchError((_) {});
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _loadChannelWaves() async {
    final ch = _channel;
    if (ch == null) return;

    // Only show the spinner if there's nothing to paint — a revisit with
    // any cached waves skips the flash of loading state entirely.
    setState(() {
      _wavesLoading = _channelWaves.isEmpty;
      _wavesError = null;
    });

    void applyWaves(List<WaveModel> waves) {
      if (!mounted) return;
      // Only show waves with thumbnails — matches the original filter so
      // partially-processed waves don't leave broken tiles in the grid.
      final filtered =
          waves.where((w) => w.thumbnailUrl.isNotEmpty).toList();
      setState(() {
        _channelWaves = filtered;
        _wavesLoading = false;
      });
    }

    try {
      final waves = await WaveService.getChannelWavesCached(
        ch.id,
        includeHidden: _canManage,
        onCached: (cached) => applyWaves(cached),
      );
      if (!mounted) return;
      applyWaves(waves);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _wavesLoading = false;
        _wavesError = e.toString();
      });
    }
  }

  Future<void> _loadChannelMovies() async {
    final ch = _channel;
    if (ch == null) return;
    setState(() {
      _moviesLoading = _channelMovies.isEmpty;
      _moviesError = null;
    });

    void apply(List<ChannelMovie> movies) {
      if (!mounted) return;
      setState(() {
        _channelMovies = movies;
        _moviesLoading = false;
      });
    }

    try {
      final movies = await ChannelContentService.getChannelMoviesCached(
        ch.id,
        onCached: apply,
      );
      if (!mounted) return;
      apply(movies);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _moviesLoading = false;
        _moviesError = e.toString();
      });
    }
  }

  Future<void> _loadChannelSeries() async {
    final ch = _channel;
    if (ch == null) return;
    setState(() {
      _seriesLoading = _channelSeries.isEmpty;
      _seriesError = null;
    });

    void apply(List<ChannelSeries> series) {
      if (!mounted) return;
      setState(() {
        _channelSeries = series;
        _seriesLoading = false;
      });
    }

    try {
      final series = await ChannelContentService.getChannelSeriesCached(
        ch.id,
        onCached: apply,
      );
      if (!mounted) return;
      apply(series);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _seriesLoading = false;
        _seriesError = e.toString();
      });
    }
  }

  void _openChannelMovie(ChannelMovie movie) {
    final url = movie.playableUrl;
    if (url == null || url.isEmpty) return;
    Navigator.pushNamed(
      context,
      '/media-player',
      arguments: MediaPlayerArgs(
        title: movie.title,
        items: [
          MediaPlayerItem(
            id: movie.id,
            title: movie.title,
            url: url,
            duration: movie.duration,
          ),
        ],
      ),
    );
  }

  Future<void> _openChannelSeries(ChannelSeries series) async {
    final channelId = _channel?.id;
    if (channelId == null) return;
    final detail = await ChannelContentService.getSeriesDetail(channelId, series.id);
    if (!mounted) return;
    final episodes = detail?.allEpisodes ?? const <ChannelEpisode>[];
    final playable = episodes.where((e) => e.hasVideo).toList();
    if (playable.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No playable episodes yet.')),
      );
      return;
    }
    Navigator.pushNamed(
      context,
      '/media-player',
      arguments: MediaPlayerArgs(
        title: series.title,
        items: playable
            .map((e) => MediaPlayerItem(
                  id: e.id,
                  title: e.title,
                  subtitle: 'Episode ${e.episodeNumber}',
                  url: e.playableUrl!,
                  duration: e.duration,
                ))
            .toList(),
      ),
    );
  }

  Future<void> _loadLibraryUnreadCount() async {
    final ch = _channel;
    if (ch == null || !ch.isExclusive) {
      if (!mounted) return;
      setState(() => _libraryUnreadCount = 0);
      return;
    }

    setState(() => _libraryUnreadLoading = true);
    try {
      final unread = await ChannelLibraryService.getLibraryUnreadCount(ch.id);
      if (!mounted) return;
      setState(() => _libraryUnreadCount = unread);
    } catch (_) {
      if (!mounted) return;
      setState(() => _libraryUnreadCount = 0);
    } finally {
      if (mounted) {
        setState(() => _libraryUnreadLoading = false);
      }
    }
  }

  Future<void> _markLibraryViewed() async {
    final ch = _channel;
    if (ch == null || !ch.isExclusive) return;

    try {
      await ChannelLibraryService.markLibraryViewed(ch.id);
      if (!mounted) return;
      setState(() => _libraryUnreadCount = 0);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Library notifications marked as viewed'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Unable to update notifications right now.'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
        ),
      );
    }
  }

  Future<void> _toggleSubscription() async {
    final ch = _channel;
    if (ch == null) return;
    if (!await KycGuard.ensureKycVerified(context)) return;
    setState(() => _subLoading = true);
    try {
      if (_subscription != null && _subscription!.isActive) {
        final result = await ChannelSubscriptionService.cancel(
          _subscription!.id,
        );
        if (!mounted) return;
        if (result['success'] == true) {
          setState(() {
            _subscription = null;
            _subLoading = false;
          });
          _showSnack('Unsubscribed from ${ch.name}');
        } else {
          setState(() => _subLoading = false);
          _showSnack(
            result['error'] as String? ?? 'Failed to unsubscribe',
            isError: true,
          );
        }
      } else {
        final result = await ChannelSubscriptionService.subscribe(ch.id);
        if (!mounted) return;
        if (result['success'] == true) {
          setState(() {
            _subscription = result['subscription'] as ChannelSubscriptionModel?;
            _subLoading = false;
          });
          _showSnack('Subscribed to ${ch.name}!');
        } else {
          setState(() => _subLoading = false);
          _showSnack(
            result['error'] as String? ?? 'Failed to subscribe',
            isError: true,
          );
        }
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _subLoading = false);
      _showSnack('Something went wrong. Please try again.', isError: true);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(color: AppColors.white)),
        backgroundColor: isError
            ? AppColors.errorRed.withValues(alpha: 0.9)
            : const Color(0xFF5FD39A).withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<void> _toggleFollow() async {
    final ch = _channel;
    if (ch == null) return;
    setState(() => _followLoading = true);
    try {
      final status = _isFollowing
          ? await ChannelService.unfollowChannel(ch.id)
          : await ChannelService.followChannel(ch.id);
      if (!mounted) return;
      setState(() {
        _isFollowing = status.followed;
        _followersCount = status.followersCount;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Unable to update follow status. Please try again.',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _followLoading = false);
    }
  }

  Future<void> _watchLive(ChannelModel ch) async {
    if (ch.isExclusive) {
      final granted = await Navigator.pushNamed(
        context,
        '/exclusive-access',
        arguments: ch,
      );
      if (granted != true || !mounted) return;
    }

    if (ch.requiresPayment) {
      final granted = await Navigator.pushNamed(
        context,
        '/premium-stream',
        arguments: ch,
      );
      if (granted != true || !mounted) return;
    }

    if (!mounted) return;
    Navigator.pushNamed(context, '/channel-player', arguments: ch.id);
  }

  // ── External stream helpers (AV-STR-006) ──────────────────────────────────

  /// True when the channel is safe to navigate into the player.
  /// Blocked channels still open the player (which shows the error state).
  bool _isStreamPlayable(ChannelModel ch) {
    if (!ch.hasExternalSource) return true;
    return ch.streamStatus != 'invalid' && ch.streamStatus != 'access_denied';
  }

  String _watchLiveLabel(ChannelModel ch) {
    if (!ch.hasExternalSource) return 'Watch Live';
    return switch (ch.streamStatus) {
      'live' => 'Watch Live Now',
      'offline' => 'Stream Offline',
      'invalid' => 'Stream Unavailable',
      'access_denied' => 'Stream Restricted',
      'scheduled' => 'Watch Channel',
      _ => 'Watch Live',
    };
  }

  Widget _buildStreamStatusIndicator(ChannelModel ch) {
    final status = ch.streamStatus;
    if (status == 'unknown') return const SizedBox(height: 6);

    final (color, label, icon) = switch (status) {
      'live' => (AppColors.successGreen, 'LIVE', Icons.fiber_manual_record),
      'valid' => (
        AppColors.infoBlue,
        'STREAM READY',
        Icons.check_circle_rounded,
      ),
      'scheduled' => (
        AppColors.lightOrange,
        'SCHEDULED',
        Icons.schedule_rounded,
      ),
      'offline' => (
        AppColors.errorRed,
        'STREAM OFFLINE',
        Icons.wifi_off_rounded,
      ),
      'invalid' => (
        AppColors.errorRed,
        'STREAM UNAVAILABLE',
        Icons.cancel_rounded,
      ),
      'access_denied' => (
        AppColors.errorRed,
        'ACCESS RESTRICTED',
        Icons.lock_rounded,
      ),
      _ => (AppColors.hintText, 'CHECKING...', Icons.hourglass_empty_rounded),
    };

    final providerLabel = switch (ch.streamSourceMode) {
      'external_youtube' => ' · YouTube',
      'external_hls' => ' · HLS',
      'external_dash' => ' · DASH',
      _ => '',
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 6),
          Text(
            '$label$providerLabel',
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          if (ch.lastCheckedAt != null) ...[
            const Spacer(),
            Text(
              _formatTimeAgo(ch.lastCheckedAt),
              style: TextStyle(color: AppColors.hintText, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTimeAgo(String? isoString) {
    if (isoString == null) return 'Never';
    final diff = DateTime.now().difference(DateTime.parse(isoString));
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Future<void> _deleteChannel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Disable Channel',
          style: TextStyle(color: AppColors.white),
        ),
        content: const Text(
          'This channel will be disabled and hidden.',
          style: TextStyle(color: AppColors.hintText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.white),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Disable',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || _channel == null) return;

    try {
      await ChannelService.deleteChannel(_channel!.id);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Unable to disable channel right now. Please retry.',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_exclusiveBlocked) {
      return Scaffold(
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
          child: const Center(
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _channel == null
                    ? const Center(
                        child: Text(
                          'Channel not found',
                          style: TextStyle(color: AppColors.white),
                        ),
                      )
                    : _buildContent(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Matches the design spec exactly (line 132–138 of AfroVision Channel
  // Page.dc.html): 36×36 icon chips, radius 11, border #2a3a6b, a near-
  // transparent white fill; 17px/600 title, 10.5px muted subtitle.
  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: Nocturne.borderStrong),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: Nocturne.textDim,
                size: 16,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _channel?.name ?? 'Channel',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (_channel != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    _channel!.category == null
                        ? 'Channel ${_channel!.channelNumber}'
                        : 'Channel ${_channel!.channelNumber} · ${_channel!.category}',
                    style: const TextStyle(
                      color: Nocturne.textFaint,
                      fontSize: 10.5,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          if (_channel != null) ...[
            const SizedBox(width: 10),
            GestureDetector(
              onTap: () => _showChannelOptionsSheet(_channel!),
              child: Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: Nocturne.borderStrong),
                ),
                child: const Icon(
                  Icons.more_horiz_rounded,
                  color: AppColors.orange,
                  size: 16,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showChannelOptionsSheet(ChannelModel ch) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.inputBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.link_rounded, color: AppColors.white),
                title: const Text(
                  'Copy channel link',
                  style: TextStyle(color: AppColors.white),
                ),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  final shareUrl =
                      '${StaticPagesRegistry.websiteBaseUrl}/live/${ch.id}';
                  await Clipboard.setData(ClipboardData(text: shareUrl));
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Channel link copied')),
                  );
                },
              ),
              ListTile(
                leading: Icon(
                  _isFollowing ? Icons.close_rounded : Icons.add_rounded,
                  color: AppColors.white,
                ),
                title: Text(
                  _isFollowing ? 'Unfollow channel' : 'Follow channel',
                  style: const TextStyle(color: AppColors.white),
                ),
                onTap: () {
                  Navigator.pop(sheetContext);
                  if (!_followLoading) _toggleFollow();
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  Widget _buildContent() {
    final ch = _channel!;
    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: () => _loadChannel(ch.id),
      child: FadeTransition(
        opacity: _fadeAnim,
        child: SlideTransition(
          position: _slideAnim,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 16),
                // Channel logo — a plain circle that stands alone when there's
                // no banner, or overlaps the bottom edge of the banner (half
                // in, half out) when there is one, matching the reference
                // design's overlapping avatar treatment instead of sitting
                // as a separate block far below the cover image.
                Builder(
                  builder: (context) {
                    final logo = Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: ch.logoUrl == null
                            ? (ch.isPremiumChannel
                                  ? const LinearGradient(
                                      colors: [
                                        Color(0xFFF5C266),
                                        Color(0xFFB8860B),
                                      ],
                                    )
                                  : LinearGradient(
                                      colors: [
                                        AppColors.orange.withValues(alpha: 0.25),
                                        AppColors.lightOrange.withValues(
                                          alpha: 0.1,
                                        ),
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ))
                            : null,
                        border: Border.all(
                          color: AppColors.darkBlue,
                          width: 3,
                        ),
                        image: ch.logoUrl != null
                            ? DecorationImage(
                                image: NetworkImage(
                                  AppConfig.mediaUrl(ch.logoUrl!),
                                ),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      child: ch.logoUrl == null
                          ? Icon(
                              ch.isPrivate
                                  ? Icons.lock_rounded
                                  : Icons.live_tv_rounded,
                              color: AppColors.orange,
                              size: 36,
                            )
                          : null,
                    );

                    if (ch.bannerUrl == null) return logo;

                    return Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.bottomCenter,
                      children: [
                        Container(
                          width: double.infinity,
                          height: 140,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: ch.isPremiumChannel
                                  ? const Color(0xFFF5C266).withAlpha(120)
                                  : AppColors.inputBorder,
                              width: ch.isPremiumChannel ? 1.5 : 1,
                            ),
                            image: DecorationImage(
                              image: NetworkImage(
                                AppConfig.mediaUrl(ch.bannerUrl!),
                              ),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        Positioned(bottom: -40, child: logo),
                      ],
                    );
                  },
                ),
                SizedBox(height: ch.bannerUrl != null ? 56 : 16),
                Text(
                  ch.name,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 7),
                // Badge row — the design (AfroVision Channel Page.dc.html,
                // line 149) puts EXCLUSIVE, MEMBER · ACTIVE and 18+ together
                // in one wrapped row, not stacked as separate lines.
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  alignment: WrapAlignment.center,
                  children: [
                    _buildBadgePill(
                      icon: ch.isExclusive
                          ? Icons.verified_rounded
                          : ch.isPrivate
                          ? Icons.lock_rounded
                          : Icons.public_rounded,
                      label: ch.isExclusive
                          ? 'EXCLUSIVE'
                          : ch.isPrivate
                          ? 'PRIVATE'
                          : 'PUBLIC',
                      color: ch.isExclusive
                          ? AppColors.lightOrange
                          : ch.isPrivate
                          ? AppColors.errorRed
                          : const Color(0xFF5FD39A),
                      background: ch.isExclusive
                          ? AppColors.orange.withValues(alpha: 0.12)
                          : ch.isPrivate
                          ? AppColors.errorRed.withValues(alpha: 0.12)
                          : const Color(0xFF5FD39A).withValues(alpha: 0.16),
                      borderColor: ch.isExclusive
                          ? const Color(0xFF4A3A1A)
                          : ch.isPrivate
                          ? AppColors.errorRed.withValues(alpha: 0.4)
                          : const Color(0xFF5FD39A).withValues(alpha: 0.3),
                    ),
                    // Membership state stated on the page (design: "EXCLUSIVE
                    // + MEMBER · ACTIVE sit together, so access is legible
                    // before Watch Live"). Reaching this screen for an
                    // exclusive channel already implies an active entitlement
                    // or ownership — the load guard above redirects to
                    // /exclusive-access otherwise.
                    if (ch.isExclusive && !_canManage)
                      _buildBadgePill(
                        icon: Icons.check_circle_rounded,
                        label: 'MEMBER · ACTIVE',
                        color: const Color(0xFF5FD39A),
                        background: const Color(0xFF5FD39A).withValues(alpha: 0.16),
                        borderColor: const Color(0xFF5FD39A).withValues(alpha: 0.3),
                      ),
                    // Derived from the real age_classification already set on
                    // this channel's published movies/series (not a
                    // fabricated flag) — shown once any of that content has
                    // loaded and is rated 'adult'.
                    if (_channelMovies.any((m) => m.ageClassification == 'adult') ||
                        _channelSeries.any((s) => s.ageClassification == 'adult'))
                      _buildBadgePill(label: '18+', color: Nocturne.textDim),
                  ],
                ),
                const SizedBox(height: 18),

                // Stat strip — the same followers/price data already shown
                // (buried) in the About tab, surfaced here so it reads
                // before the tabs rather than requiring a tap to find.
                // Boxed per the design (a bordered strip, not a bare row).
                // "Titles" is the real, live count of published movies +
                // series already fetched for the tabs below (both load
                // eagerly on channel open) — not a fabricated number, and it
                // updates in place once those loads resolve.
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.inputBorder),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _buildHeaderStat(
                          value: _formatCompactCount(_followersCount),
                          label: 'Members',
                        ),
                      ),
                      Container(width: 1, height: 30, color: AppColors.inputBorder),
                      Expanded(
                        child: _buildHeaderStat(
                          value: _formatCompactCount(
                            _channelMovies.length + _channelSeries.length,
                          ),
                          label: 'Titles',
                        ),
                      ),
                      if (ch.isExclusive) ...[
                        Container(width: 1, height: 30, color: AppColors.inputBorder),
                        Expanded(
                          child: _buildHeaderStat(
                            value: '₦${ch.exclusiveMonthlyFeeNgn.toStringAsFixed(0)}',
                            label: 'Per month',
                          ),
                        ),
                      ] else if (ch.requiresPayment) ...[
                        Container(width: 1, height: 30, color: AppColors.inputBorder),
                        Expanded(
                          child: _buildHeaderStat(
                            value: ch.entryFeeType == 'ngn'
                                ? '₦${ch.entryFeeNgn.toStringAsFixed(0)}'
                                : '${ch.entryFeeVptUnits} vPT',
                            label: 'Per access',
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: GestureDetector(
                        onTap: () => _watchLive(ch),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            // Same gold-CTA token used by other primary
                            // actions (e.g. the channel-number "Access
                            // Channel" button) so every gold CTA in the app
                            // reads as one consistent gradient.
                            gradient: _isStreamPlayable(ch)
                                ? Nocturne.goldCta
                                : null,
                            color: _isStreamPlayable(ch)
                                ? null
                                : AppColors.inputBorder,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: _isStreamPlayable(ch)
                                ? [
                                    BoxShadow(
                                      color: Nocturne.gold.withValues(alpha: 0.2),
                                      blurRadius: 22,
                                      offset: const Offset(0, 8),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              // Design source (line 163 of AfroVision Channel
                              // Page.dc.html) uses a single Phosphor
                              // "play-circle" fill icon that inherits the
                              // button's own dark text color — not a
                              // two-tone white-circle/black-triangle icon.
                              Icon(
                                Icons.play_circle_fill_rounded,
                                color: _isStreamPlayable(ch)
                                    ? const Color(0xFF26170A)
                                    : AppColors.hintText,
                                size: 17,
                              ),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  _watchLiveLabel(ch),
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: _isStreamPlayable(ch)
                                        ? const Color(0xFF26170A)
                                        : AppColors.hintText,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: GestureDetector(
                        onTap: _followLoading ? null : _toggleFollow,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: _isFollowing
                                ? AppColors.orange.withValues(alpha: 0.12)
                                : Colors.white.withValues(alpha: 0.02),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: _isFollowing
                                  ? const Color(0xFF5FD39A)
                                  : Nocturne.borderStrong,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _isFollowing
                                    ? Icons.check_circle_rounded
                                    : Icons.add_circle_outline_rounded,
                                color: _isFollowing
                                    ? const Color(0xFF5FD39A)
                                    : Nocturne.textDim,
                                size: 15,
                              ),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  _followLoading
                                      ? '...'
                                      : (_isFollowing ? 'Following' : 'Follow'),
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: _isFollowing
                                        ? const Color(0xFF5FD39A)
                                        : Nocturne.textDim,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                _buildSectionBar(ch),
                const SizedBox(height: 16),
                _buildSectionContent(ch),
                const PangleBigBanner(margin: EdgeInsets.only(top: 20)),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static IconData _sectionIcon(ChannelSection section) {
    switch (section) {
      case ChannelSection.about:
        return Icons.info_outline_rounded;
      case ChannelSection.streams:
        return Icons.history_rounded;
      case ChannelSection.library:
        return Icons.video_library_rounded;
      case ChannelSection.movies:
        return Icons.local_movies_rounded;
      case ChannelSection.series:
        return Icons.live_tv_rounded;
      case ChannelSection.waves:
        return Icons.waves_rounded;
      case ChannelSection.schedule:
        return Icons.calendar_today_rounded;
      case ChannelSection.requests:
        return Icons.mail_rounded;
      case ChannelSection.manage:
        return Icons.settings_rounded;
    }
  }

  Widget _buildSectionBar(ChannelModel ch) {
    // Order matches the design (About → Library → Movies → Series first,
    // since those are what most viewers want); Past Streams/Waves/Schedule
    // and management-only tabs follow rather than leading.
    final sections = <ChannelSection>[
      ChannelSection.about,
      if (ch.isExclusive) ChannelSection.library,
      ChannelSection.movies,
      ChannelSection.series,
      ChannelSection.streams,
      ChannelSection.waves,
      ChannelSection.schedule,
      if (_canManage && ch.isExclusive) ChannelSection.requests,
      if (_canManage) ChannelSection.manage,
    ];

    // Design (Channels page mock): "Tabs never clip — the tabs scroll in a
    // padded row so no pill is half cut at either edge." Previously this
    // scroll view had no padding of its own, so a pill could sit flush
    // against the screen edge at either end of the scroll range.
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: sections.map((section) {
          final selected = _activeSection == section;
          // Matches the design's tab-pill spec exactly (line 170 of
          // AfroVision Channel Page.dc.html): padding 8/14, fully rounded
          // (999px, not 12px), 12px/weight-500 text, 13px icon. The prior,
          // larger/less-rounded pills were why only ~3.5 tabs fit on screen
          // instead of the 4 the design shows.
          return GestureDetector(
            onTap: () => setState(() => _activeSection = section),
            child: Container(
              margin: const EdgeInsets.only(right: 7),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.orange.withValues(alpha: 0.13)
                    : Colors.white.withValues(alpha: 0.02),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: selected
                      ? AppColors.orange
                      : Nocturne.border,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _sectionIcon(section),
                    size: 13,
                    color: selected ? AppColors.lightOrange : Nocturne.textMuted,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    section == ChannelSection.library
                        ? '${section.label}${_libraryUnreadCount > 0 ? ' (${_libraryUnreadCount > 99 ? '99+' : _libraryUnreadCount})' : ''}'
                        : section.label,
                    style: TextStyle(
                      color: selected ? AppColors.lightOrange : Nocturne.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSectionContent(ChannelModel ch) {
    switch (_activeSection) {
      case ChannelSection.about:
        return _buildAboutSection(ch);
      case ChannelSection.streams:
        return _buildStreamsSection(ch);
      case ChannelSection.library:
        return _buildLibrarySection(ch);
      case ChannelSection.movies:
        return _buildMoviesSection(ch);
      case ChannelSection.series:
        return _buildSeriesSection(ch);
      case ChannelSection.waves:
        return _buildWavesSection(ch);
      case ChannelSection.schedule:
        return _buildScheduleSection(ch);
      case ChannelSection.requests:
        return ExclusiveRequestsSection(channel: ch);
      case ChannelSection.manage:
        return _buildManageSection(ch);
    }
  }

  Widget _buildAboutSection(ChannelModel ch) {
    return Column(
      children: [
        if (ch.isExclusive) ...[
          _buildInfoCard(
            icon: Icons.payments_rounded,
            label: 'Exclusive Monthly Fee',
            value: 'NGN ${ch.exclusiveMonthlyFeeNgn.toStringAsFixed(0)}',
            valueColor: AppColors.orange,
          ),
          const SizedBox(height: 12),
        ],
        _buildInfoCard(
          icon: Icons.tag_rounded,
          label: 'Channel Number',
          value: '#${ch.channelNumber}',
          valueColor: AppColors.lightOrange,
          trailing: GestureDetector(
            onTap: () {
              Clipboard.setData(ClipboardData(text: ch.channelNumber));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text(
                    'Channel number copied',
                    style: TextStyle(color: AppColors.white),
                  ),
                  backgroundColor: const Color(
                    0xFF5FD39A,
                  ).withValues(alpha: 0.9),
                  behavior: SnackBarBehavior.floating,
                  duration: const Duration(seconds: 2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.orange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.copy_rounded,
                color: AppColors.orange,
                size: 16,
              ),
            ),
          ),
        ),
        if (ch.description != null)
          _buildInfoCard(
            icon: Icons.description_rounded,
            label: 'Description',
            value: ch.description!,
          ),
        if (ch.category != null)
          _buildInfoCard(
            icon: Icons.category_rounded,
            label: 'Category',
            value: ch.category!,
          ),
        if (!ch.isPrivate)
          _buildInfoCard(
            icon: Icons.person_rounded,
            label: 'Creator',
            value: ch.ownerName ?? 'Unknown',
          ),
        _buildInfoCard(
          icon: Icons.people_alt_rounded,
          label: 'Followers',
          value: '$_followersCount',
        ),
        if (ch.requiresPayment)
          _buildInfoCard(
            icon: Icons.lock_rounded,
            label: 'Access',
            value: ch.entryFeeType == 'ngn'
                ? '₦${ch.entryFeeNgn.toStringAsFixed(0)} · ${ch.accessDurationMinutes}min'
                : '${ch.entryFeeVptUnits} vPT · ${ch.accessDurationMinutes}min',
            valueColor: AppColors.lightOrange,
          ),
        _buildInfoCard(
          icon: Icons.calendar_today_rounded,
          label: 'Created',
          value: _formatDate(ch.createdAt),
        ),
        const SizedBox(height: 18),
        GestureDetector(
          onTap: _followLoading ? null : _toggleFollow,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 15),
            decoration: BoxDecoration(
              color: _isFollowing
                  ? AppColors.orange.withValues(alpha: 0.12)
                  : AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: _isFollowing
                    ? AppColors.orange.withValues(alpha: 0.35)
                    : AppColors.inputBorder,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _isFollowing
                      ? Icons.notifications_active_rounded
                      : Icons.notifications_none_rounded,
                  color: _isFollowing ? AppColors.orange : AppColors.white,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  _followLoading
                      ? 'Updating...'
                      : _isFollowing
                      ? 'Following'
                      : 'Follow Channel',
                  style: TextStyle(
                    color: _isFollowing ? AppColors.orange : AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        GestureDetector(
          onTap: _subLoading ? null : _toggleSubscription,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 15),
            decoration: BoxDecoration(
              gradient:
                  ch.isPremiumChannel &&
                      !(_subscription != null && _subscription!.isActive)
                  ? const LinearGradient(
                      colors: [Color(0xFFF5C266), Color(0xFFB8860B)],
                    )
                  : (_subscription != null && _subscription!.isActive
                        ? LinearGradient(
                            colors: [
                              const Color(0xFF5FD39A).withValues(alpha: 0.25),
                              const Color(0xFF5FD39A).withValues(alpha: 0.1),
                            ],
                          )
                        : AppColors.buttonGradient),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color:
                      ch.isPremiumChannel &&
                          !(_subscription != null && _subscription!.isActive)
                      ? const Color(0xFFF5C266).withAlpha(80)
                      : AppColors.orange.withValues(alpha: 0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _subLoading
                      ? Icons.hourglass_top
                      : (_subscription != null && _subscription!.isActive
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded),
                  color:
                      ch.isPremiumChannel &&
                          !(_subscription != null && _subscription!.isActive)
                      ? AppColors.darkBlue
                      : AppColors.white,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  _subLoading
                      ? 'Updating...'
                      : (_subscription != null && _subscription!.isActive
                            ? (ch.isPremiumChannel
                                  ? 'Subscribed Premium'
                                  : 'Subscribed')
                            : (ch.isPremiumChannel
                                  ? 'Subscribe Premium'
                                  : 'Subscribe Free')),
                  style: TextStyle(
                    color:
                        ch.isPremiumChannel &&
                            !(_subscription != null && _subscription!.isActive)
                        ? AppColors.darkBlue
                        : AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStreamsSection(ChannelModel ch) {
    return Column(
      children: [
        _buildInfoCard(
          icon: Icons.history_toggle_off_rounded,
          label: 'Past Streams',
          value: 'Open channel player to browse past stream sessions.',
        ),
        if (ch.hasExternalSource) _buildStreamStatusIndicator(ch),
        GestureDetector(
          onTap: () => _watchLive(ch),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 15),
            decoration: BoxDecoration(
              gradient: _isStreamPlayable(ch) ? AppColors.buttonGradient : null,
              color: _isStreamPlayable(ch) ? null : AppColors.inputBorder,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.play_circle_filled,
                  color: _isStreamPlayable(ch)
                      ? AppColors.white
                      : AppColors.hintText,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Text(
                  _watchLiveLabel(ch),
                  style: TextStyle(
                    color: _isStreamPlayable(ch)
                        ? AppColors.white
                        : AppColors.hintText,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLibrarySection(ChannelModel ch) {
    if (!ch.isExclusive) {
      return _buildInfoCard(
        icon: Icons.lock_outline_rounded,
        label: 'Library',
        value: 'Library is available for exclusive channels only.',
      );
    }

    return Column(
      children: [
        _buildInfoCard(
          icon: Icons.menu_book_rounded,
          label: 'Exclusive Library',
          value: 'Read books, comics, and magazines for this channel.',
        ),
        if (_libraryUnreadCount > 0 || _libraryUnreadLoading) ...[
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.notifications_active_outlined,
                  color: AppColors.orange,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _libraryUnreadLoading
                        ? 'Checking unread updates...'
                        : '$_libraryUnreadCount unread library updates',
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: _libraryUnreadLoading ? null : _markLibraryViewed,
                  child: const Text('Mark viewed'),
                ),
              ],
            ),
          ),
        ],
        GestureDetector(
          onTap: () => Navigator.pushNamed(
            context,
            '/channel-library',
            arguments: {'channelId': ch.id},
          ),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              gradient: AppColors.buttonGradient,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: AppColors.orange.withValues(alpha: 0.28),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.menu_book_rounded, color: AppColors.white, size: 20),
                SizedBox(width: 8),
                Text(
                  'Open Library',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_canManage) ...[
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () =>
                Navigator.pushNamed(context, '/video-upload', arguments: ch.id),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.upload_rounded,
                    color: AppColors.lightOrange,
                    size: 18,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Upload / Manage Videos',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildMoviesSection(ChannelModel ch) {
    return Column(
      children: [
        _buildInfoCard(
          icon: Icons.movie_outlined,
          label: 'Movies',
          value: ch.isExclusive
              ? 'Movies published by this channel. Exclusive to active members.'
              : 'Movies published by this channel.',
        ),
        if (_moviesLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: CircularProgressIndicator(color: AppColors.orange),
          )
        else if (_moviesError != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Column(
              children: [
                const Text(
                  'Unable to load movies.',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _moviesError!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.hintText),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: _loadChannelMovies,
                  child: const Text('Retry'),
                ),
              ],
            ),
          )
        else if (_channelMovies.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: const Text(
              'This channel has no published movies yet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.hintText),
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 2 / 3,
            ),
            itemCount: _channelMovies.length,
            itemBuilder: (context, index) =>
                _buildMovieCard(_channelMovies[index]),
          ),
      ],
    );
  }

  Widget _buildMovieCard(ChannelMovie movie) {
    return GestureDetector(
      onTap: () => _openChannelMovie(movie),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (movie.posterUrl != null && movie.posterUrl!.isNotEmpty)
              Image.network(
                AppConfig.mediaUrl(movie.posterUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.inputFill,
                  child: const Icon(Icons.movie_outlined,
                      color: AppColors.hintText, size: 28),
                ),
              )
            else
              Container(
                color: AppColors.inputFill,
                child: const Icon(Icons.movie_outlined,
                    color: AppColors.hintText, size: 28),
              ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.85),
                  ],
                  stops: const [0.5, 1],
                ),
              ),
            ),
            if (movie.ageClassification == 'adult')
              const Positioned(left: 8, top: 8, child: _AgeRatingChip()),
            Positioned(
              left: 8,
              right: 8,
              bottom: 8,
              child: Text(
                movie.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSeriesSection(ChannelModel ch) {
    return Column(
      children: [
        _buildInfoCard(
          icon: Icons.tv_outlined,
          label: 'Series',
          value: ch.isExclusive
              ? 'Series published by this channel. Exclusive to active members.'
              : 'Series published by this channel.',
        ),
        if (_seriesLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: CircularProgressIndicator(color: AppColors.orange),
          )
        else if (_seriesError != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Column(
              children: [
                const Text(
                  'Unable to load series.',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _seriesError!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.hintText),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: _loadChannelSeries,
                  child: const Text('Retry'),
                ),
              ],
            ),
          )
        else if (_channelSeries.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: const Text(
              'This channel has no published series yet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.hintText),
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 2 / 3,
            ),
            itemCount: _channelSeries.length,
            itemBuilder: (context, index) =>
                _buildSeriesCard(_channelSeries[index]),
          ),
      ],
    );
  }

  Widget _buildSeriesCard(ChannelSeries series) {
    return GestureDetector(
      onTap: () => _openChannelSeries(series),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (series.coverUrl != null && series.coverUrl!.isNotEmpty)
              Image.network(
                AppConfig.mediaUrl(series.coverUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.inputFill,
                  child: const Icon(Icons.tv_outlined,
                      color: AppColors.hintText, size: 28),
                ),
              )
            else
              Container(
                color: AppColors.inputFill,
                child: const Icon(Icons.tv_outlined,
                    color: AppColors.hintText, size: 28),
              ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.85),
                  ],
                  stops: const [0.5, 1],
                ),
              ),
            ),
            if (series.ageClassification == 'adult')
              const Positioned(left: 8, top: 8, child: _AgeRatingChip()),
            Positioned(
              left: 8,
              right: 8,
              bottom: 8,
              child: Text(
                series.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWavesSection(ChannelModel ch) {
    return Column(
      children: [
        _buildInfoCard(
          icon: Icons.waves_rounded,
          label: 'Waves',
          value: _canManage
              ? 'Create, review, edit, hide, or delete your published waves from this channel profile.'
              : 'Explore published Waves from this channel and jump into the feed context.',
        ),
        GestureDetector(
          onTap: () => Navigator.pushNamed(
            context,
            '/wave',
            arguments: {'channelId': ch.id},
          ),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              gradient: AppColors.buttonGradient,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Center(
              child: Text(
                'Open Wave Feed',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
        if (_canManage) ...[
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () async {
              final result = await Navigator.pushNamed(
                context,
                '/wave-upload',
                arguments: ch.id,
              );
              if (result == true) {
                await _loadChannelWaves();
              }
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Center(
                child: Text(
                  'Create New Wave',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        if (_wavesLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: CircularProgressIndicator(color: AppColors.orange),
          )
        else if (_wavesError != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Column(
              children: [
                const Text(
                  'Unable to load channel waves.',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _wavesError!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.hintText),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: _loadChannelWaves,
                  child: const Text('Retry'),
                ),
              ],
            ),
          )
        else if (_channelWaves.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Text(
              _canManage
                  ? 'No waves published for this channel yet.'
                  : 'This channel has no published waves yet.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.hintText),
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 9 / 16,
            ),
            itemCount: _channelWaves.length,
            itemBuilder: (context, index) {
              return _buildWaveCard(ch, _channelWaves[index]);
            },
          ),
      ],
    );
  }

  Widget _buildWaveCard(ChannelModel ch, WaveModel wave) {
    final actionBusy = _waveActionId == wave.id;
    final isHidden = wave.status == 'hidden';

    return GestureDetector(
      onTap: actionBusy
          ? null
          : () => Navigator.pushNamed(
              context,
              '/wave',
              arguments: {'channelId': ch.id, 'waveId': wave.id},
            ),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.darkBlue,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isHidden
                ? AppColors.hintText.withValues(alpha: 0.35)
                : AppColors.inputBorder,
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            fit: StackFit.expand,
            children: [
              WaveThumbnail(
                thumbnailUrl: wave.thumbnailUrl,
                videoUrl: wave.videoUrl,
                waveId: wave.id,
                memCacheWidth: 400,
                memCacheHeight: 711,
                placeholder: _buildPlaceholder(),
              ),
              // Bottom gradient for text readability
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.7),
                      ],
                      stops: const [0.55, 1.0],
                    ),
                  ),
                ),
              ),
              const Center(
                child: Icon(
                  Icons.play_arrow_rounded,
                  color: AppColors.white,
                  size: 48,
                ),
              ),
              // Age badge top-left
              if (wave.ageClassification == 'adult')
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFB71C1C).withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: const Color(0xFFFF5252).withValues(alpha: 0.50),
                        width: 0.8,
                      ),
                    ),
                    child: const Text(
                      '18+',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              if (isHidden)
                Positioned(
                  top: 8,
                  left: wave.ageClassification == 'adult' ? 42 : 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.hintText.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'Hidden',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              // Duration top-right
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${wave.duration}s',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              // Bookmark badge
              if (wave.bookmarked)
                Positioned(
                  top: 8,
                  right: 52,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5C266).withValues(alpha: 0.85),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.bookmark_rounded,
                      color: Color(0xFF0A1E3A),
                      size: 12,
                    ),
                  ),
                ),
              // Bottom info bar
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        wave.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _statChip(
                            Icons.favorite_rounded,
                            _formatCount(wave.pulseCount),
                          ),
                          const SizedBox(width: 6),
                          _statChip(
                            Icons.comment_rounded,
                            _formatCount(wave.commentCount),
                          ),
                          const SizedBox(width: 6),
                          _statChip(
                            Icons.repeat_rounded,
                            _formatCount(wave.repeatPlayCount),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statChip(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 10,
          color: AppColors.white.withValues(alpha: 0.70),
        ),
        const SizedBox(width: 3),
        Text(
          value,
          style: TextStyle(
            color: AppColors.white.withValues(alpha: 0.85),
            fontSize: 9,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  String _formatCount(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }

  Widget _buildPlaceholder() {
    return Container(
      color: AppColors.darkBlue,
      child: Center(
        child: Icon(
          Icons.video_library_rounded,
          color: AppColors.orange.withValues(alpha: 0.5),
          size: 48,
        ),
      ),
    );
  }

  Widget _buildScheduleSection(ChannelModel ch) {
    return Column(
      children: [
        _buildInfoCard(
          icon: Icons.schedule_rounded,
          label: 'Schedule',
          value: 'Manage and view upcoming programs for this channel.',
        ),
        GestureDetector(
          onTap: () =>
              Navigator.pushNamed(context, '/schedule', arguments: ch.id),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: const Center(
              child: Text(
                'Open Schedule',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildManageSection(ChannelModel ch) {
    if (!_canManage) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.inputBorder),
        ),
        child: Column(
          children: [
            const Icon(Icons.lock_rounded, color: AppColors.errorRed),
            const SizedBox(height: 10),
            const Text(
              'Insufficient permissions for Manage section',
              style: TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () =>
                  setState(() => _activeSection = ChannelSection.about),
              child: const Text('Back to About'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        GestureDetector(
          onTap: () => Navigator.pushNamed(context, '/creator-studio'),
          child: _manageTile(Icons.dashboard_rounded, 'Open Creator Studio'),
        ),
        GestureDetector(
          onTap: () =>
              Navigator.pushNamed(context, '/edit-channel', arguments: ch),
          child: _manageTile(Icons.edit_rounded, 'Edit Channel Details'),
        ),
        GestureDetector(
          onTap: () => Navigator.pushNamed(
            context,
            '/channel-analytics',
            arguments: ch.id,
          ),
          child: _manageTile(Icons.bar_chart_rounded, 'Open Channel Analytics'),
        ),
        GestureDetector(
          onTap: _deleteChannel,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 15),
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: AppColors.errorRed.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.errorRed.withValues(alpha: 0.3),
              ),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.delete_rounded, color: AppColors.errorRed, size: 20),
                SizedBox(width: 8),
                Text(
                  'Disable Channel',
                  style: TextStyle(
                    color: AppColors.errorRed,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _manageTile(IconData icon, String label) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.lightOrange),
          const SizedBox(width: 10),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          const Icon(Icons.chevron_right_rounded, color: AppColors.hintText),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
    Widget? trailing,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.orange, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    color: AppColors.goldText,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: TextStyle(
                    color: valueColor ?? AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing],
        ],
      ),
    );
  }

  /// Matches the design's badge pill spec exactly (line 150–152 of
  /// AfroVision Channel Page.dc.html): 9.5px/700 weight text, a fully
  /// rounded pill, and — for the plain 18+ variant (no icon, no color) —
  /// just a border with no fill.
  Widget _buildBadgePill({
    IconData? icon,
    required String label,
    required Color color,
    Color? background,
    Color? borderColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor ?? Nocturne.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: color, size: 11),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.65,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderStat({required String value, required String label}) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(color: AppColors.hintText, fontSize: 11),
        ),
      ],
    );
  }

  String _formatCompactCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}K';
    return '$count';
  }

  String _formatDate(String isoDate) {
    final date = DateTime.tryParse(isoDate);
    if (date == null) return isoDate;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}

/// "18+" corner chip — shown only when the content's real backend
/// `age_classification` is `adult` (the same field creators set when
/// publishing a movie/series). Never shown speculatively.
class _AgeRatingChip extends StatelessWidget {
  const _AgeRatingChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(4),
      ),
      child: const Text(
        '18+',
        style: TextStyle(
          color: AppColors.lightOrange,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}