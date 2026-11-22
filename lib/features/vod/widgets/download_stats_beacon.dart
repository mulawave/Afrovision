import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../screens/downloads_screen.dart';
import '../services/vod_cache_service.dart';

/// Live download status beacon displayed on the Home screen and Media Center.
///
/// Reflects background downloads continuing across screen navigation, with
/// high-contrast visual pills (green = downloaded, orange = paused/resume,
/// red = failed, all with white text) and a full-width progress bar.
class DownloadStatsBeacon extends StatefulWidget {
  final EdgeInsetsGeometry margin;

  const DownloadStatsBeacon({
    super.key,
    this.margin = const EdgeInsets.fromLTRB(16, 8, 16, 8),
  });

  @override
  State<DownloadStatsBeacon> createState() => _DownloadStatsBeaconState();
}

class _DownloadStatsBeaconState extends State<DownloadStatsBeacon> {
  @override
  void initState() {
    super.initState();
    VodCacheService.instance.initialize();
  }

  Widget _badge(String text, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
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

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<DownloadBeaconState>(
      valueListenable: VodCacheService.instance.beaconNotifier,
      builder: (context, state, _) {
        if (!state.hasActivity) return const SizedBox.shrink();

        final isDownloading = state.activeCount > 0;
        final pct = state.overallPercent.clamp(0.0, 100.0);

        return GestureDetector(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const DownloadsScreen()),
            );
          },
          child: Container(
            margin: widget.margin,
            decoration: BoxDecoration(
              color: Nocturne.surfaceRaised,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDownloading
                    ? Nocturne.gold.withValues(alpha: 0.65)
                    : Nocturne.borderStrong,
                width: 1,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: isDownloading
                              ? const Color(0xFF1565C0)
                              : (state.failedCount > 0
                                  ? const Color(0xFFC62828)
                                  : const Color(0xFFEF6C00)),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          isDownloading
                              ? Icons.downloading_rounded
                              : (state.failedCount > 0
                                  ? Icons.error_outline_rounded
                                  : Icons.pause_circle_filled_rounded),
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isDownloading
                                  ? 'Downloading (${state.activeCount}): ${state.activeTitle ?? 'Episode'}'
                                  : (state.pendingCount > 0
                                      ? '${state.pendingCount} download${state.pendingCount == 1 ? '' : 's'} paused · Tap to resume'
                                      : '${state.failedCount} download${state.failedCount == 1 ? '' : 's'} failed · Tap to retry'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                if (isDownloading)
                                  _badge(
                                    '${pct.toInt()}% active',
                                    const Color(0xFF1565C0),
                                  ),
                                if (state.completedCount > 0)
                                  _badge(
                                    '${state.completedCount} Downloaded',
                                    const Color(0xFF2E7D32),
                                  ),
                                if (state.pendingCount > 0)
                                  _badge(
                                    '${state.pendingCount} Resume DL',
                                    const Color(0xFFEF6C00),
                                  ),
                                if (state.failedCount > 0)
                                  _badge(
                                    '${state.failedCount} Failed',
                                    const Color(0xFFC62828),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      if (isDownloading)
                        IconButton(
                          tooltip: 'Pause all downloads',
                          onPressed: () => VodCacheService.instance.pauseAll(),
                          icon: const Icon(
                            Icons.pause_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: Nocturne.textMuted,
                        size: 20,
                      ),
                    ],
                  ),
                ),
                if (isDownloading)
                  LinearProgressIndicator(
                    value: pct / 100.0,
                    minHeight: 4,
                    backgroundColor: Nocturne.border,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(Nocturne.gold),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Compact downloads icon button with live activity badge for AppBars/Headers.
class DownloadNavButton extends StatelessWidget {
  final Color iconColor;

  const DownloadNavButton({
    super.key,
    this.iconColor = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<DownloadBeaconState>(
      valueListenable: VodCacheService.instance.beaconNotifier,
      builder: (context, state, _) {
        final badgeCount = state.activeCount > 0
            ? state.activeCount
            : (state.pendingCount > 0
                ? state.pendingCount
                : state.completedCount);
        final badgeColor = state.activeCount > 0
            ? const Color(0xFF1565C0)
            : (state.failedCount > 0
                ? const Color(0xFFC62828)
                : (state.pendingCount > 0
                    ? const Color(0xFFEF6C00)
                    : const Color(0xFF2E7D32)));

        return IconButton(
          tooltip: 'Downloads',
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const DownloadsScreen()),
            );
          },
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(Icons.download_for_offline_outlined, color: iconColor),
              if (badgeCount > 0)
                Positioned(
                  right: -6,
                  top: -5,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: badgeColor,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '$badgeCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
