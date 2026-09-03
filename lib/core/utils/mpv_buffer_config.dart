import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:media_kit/media_kit.dart';

import '../services/network_profile_service.dart';

/// Centralized MPV buffer / network configuration for media_kit players.
///
/// The live (broadcast) values mirror the known-stable configuration that has
/// been validated for 4+ minutes of smooth HLS playback without buffering,
/// skip-forward, or "Tuning In" flashing. VOD values are scaled down to keep
/// memory usage reasonable on low-end devices.
class MpvBufferConfig {
  // Live buffer matches the validated 4+ minute smooth-playback baseline.
  // VOD stays small to keep memory pressure low on low-end devices.
  static const int liveBufferSize = 200 * 1024 * 1024; // 200 MiB
  static const int vodBufferSize = 32 * 1024 * 1024; // 32 MiB

  /// Apply buffer / reconnection / bitrate settings to an existing [Player].
  ///
  /// [isLive] selects the validated 120s / 200 MiB live-HLS baseline; VOD gets
  /// a tighter 15s / 32 MiB profile.
  /// [networkType] caps the HLS bitrate on cellular/unknown to conserve data.
  static Future<void> apply(
    Player player, {
    required bool isLive,
    NetworkType? networkType,
  }) async {
    final platform = player.platform;
    if (platform == null) return;
    final native = platform as dynamic;

    final profile = NetworkProfileService.instance;
    final type = networkType ?? profile.currentType;
    final bitrateCap = profile.maxHlsBitrateBps;

    // HLS variant selection:
    //   * cellular or unknown → numeric bitrate cap (avoids underruns + saves data)
    //   * unmetered Wi-Fi → `max` so MPV selects the best sustainable variant.
    // MPV only accepts 'no', 'min', 'max' or a numeric bits-per-second value.
    // 'average' is NOT a valid option and will cause every HLS open to fail.
    final hlsBitrate = _resolveHlsBitrate(type, bitrateCap);

    try {
      // Core cache toggle.
      await _setProperty(native, 'cache', 'yes');

      // On-disk cache is disabled; we manage wave / movie downloads ourselves
      // in VideoCacheService to avoid double writes and scope-storage issues.
      await _setProperty(native, 'cache-on-disk', 'no');

      // 16 MiB I/O stream buffer — matches the known-stable broadcast config.
      await _setProperty(native, 'stream-buffer-size', '16777216');

      // Network resiliency.
      await _setProperty(native, 'network-timeout', '30'); // seconds
      await _setProperty(native, 'access-retries', '10');
      // Some mobile networks / CDNs have broken IPv6 AAAA records or no IPv6
      // route. Force IPv4 so MPV doesn't fail with "No address associated with
      // hostname" while the system browser / ExoPlayer can still reach the host.
      await _setProperty(native, 'ip_version', '4');
      // libavformat reconnect options, primarily used by HLS.
      //   * reconnect_streamed=1  — reconnect for streamed sources (HLS)
      //   * reconnect_at_eof=1    — retry when the server closes prematurely
      //   * reconnect_on_http_error=4xx,5xx — reconnect on transient HTTP errors
      // Without these the demuxer will fail permanently after the first
      // 5xx from a CDN edge or a mid-segment connection reset, producing
      // an indefinite buffering stall on the client.
      await _setProperty(native, 
        'stream-lavf-o',
        'reconnect=1,reconnect_streamed=1,reconnect_at_eof=1,'
            'reconnect_on_http_error=4xx\\,5xx,'
            'reconnect_delay_max=5,network_timeout=30000000',
      );

      // HLS variant selection. 'max' on unmetered lets the adaptive logic
      // pick the best sustainable variant; on cellular we force a ceiling
      // to reduce data use and buffer underruns.
      await _setProperty(native, 'hls-bitrate', hlsBitrate);

      // Validated baseline: fill the live cache before starting playback.
      // The previous stalls attributed to `cache-pause-initial=yes` were
      // actually caused by the invalid `hls-bitrate` value; with a valid
      // bitrate and a 200 MiB live cache, the 2s pre-roll fills reliably
      // and prevents the start-up rebuffer loop.
      await _setProperty(native, 'cache-pause-initial', 'yes');
      await _setProperty(native, 'cache-pause-wait', '2');

      if (isLive) {
        // Validated live-HLS baseline (4+ minutes smooth playback).
        await _setProperty(native, 'demuxer-max-bytes', '209715200'); // 200 MiB
        await _setProperty(native, 'demuxer-readahead-secs', '120');
        await _setProperty(native, 'cache-secs', '120');
      } else {
        // VOD / catch-up: 15s window keeps memory low and start-up fast.
        await _setProperty(native, 'demuxer-max-bytes', '33554432'); // 32 MiB
        await _setProperty(native, 'demuxer-readahead-secs', '15');
        await _setProperty(native, 'cache-secs', '15');
      }
    } catch (e, st) {
      // Non-fatal: defaults are still usable; media_kit may not expose the
      // native interface on some platforms (e.g. unit-test mocks).
      debugPrint('[MpvBufferConfig] setProperty failed: $e');
      debugPrint('[MpvBufferConfig] $st');
    }
  }

  /// Set a single MPV property and log the value for diagnostics.
  static Future<void> _setProperty(dynamic native, String key, String value) async {
    debugPrint('[MpvBufferConfig] $key = $value');
    await native.setProperty(key, value);
  }

  /// Resolve the MPV `hls-bitrate` value from the current network type.
  ///
  /// MPV's `hls-bitrate` option is `OPT_CHOICE` with the valid keywords `no`,
  /// `min`, `max`, or a numeric bits-per-second ceiling. We use the numeric cap
  /// on metered/unknown networks and `max` on unmetered Wi-Fi. Never return the
  /// invalid `average` string that was causing the "Signal lost" failures.
  static String _resolveHlsBitrate(NetworkType? type, int? cap) {
    if ((type == NetworkType.cellular || type == NetworkType.unknown) &&
        cap != null) {
      return '${cap.clamp(500000, 8000000)}';
    }
    return 'max';
  }

  /// Convenience helper for applying a user-selected bitrate / quality ceiling
  /// on top of the current network profile.
  ///
  /// [profileBps] is the current network-based cap (e.g. 1.5 Mbps on cellular).
  /// [userBps] is the user-selected quality ceiling (e.g. 500000 for Data Saver).
  /// We return the more restrictive of the two, or `max` when both are null.
  static String resolveHlsBitrateWithUserCap({
    NetworkType? type,
    int? profileBps,
    int? userBps,
  }) {
    final base = _resolveHlsBitrate(type, profileBps);
    if (userBps == null || userBps <= 0) return base;
    // If base is a number and user cap is lower, use user cap.
    final baseNumber = int.tryParse(base);
    if (baseNumber != null) {
      return '${userBps.clamp(500000, 8000000).clamp(500000, baseNumber)}';
    }
    // base is 'max' or 'no'/'min' — numeric user cap is meaningful.
    if (base == 'max') return '${userBps.clamp(500000, 8000000)}';
    return base;
  }

  /// Update only the HLS bitrate cap when the network type changes while a
  /// player is already running. This avoids resetting the whole buffer pipeline.
  static Future<void> applyHlsBitrateCap(
    Player player, {
    NetworkType? networkType,
    int? userBps,
  }) async {
    final platform = player.platform;
    if (platform == null) return;
    final native = platform as dynamic;

    final profile = NetworkProfileService.instance;
    final type = networkType ?? profile.currentType;
    final profileCap = profile.maxHlsBitrateBps;
    final hlsBitrate = resolveHlsBitrateWithUserCap(
      type: type,
      profileBps: profileCap,
      userBps: userBps,
    );

    try {
      await _setProperty(native, 'hls-bitrate', hlsBitrate);
    } catch (e, st) {
      debugPrint('[MpvBufferConfig] applyHlsBitrateCap failed: $e');
      debugPrint('[MpvBufferConfig] $st');
    }
  }

  /// Convenience helper for short-lived re-apply calls triggered by a
  /// connectivity change.
  static Future<void> applyForLive(Player player) => apply(player, isLive: true);
  static Future<void> applyForVod(Player player) => apply(player, isLive: false);
}
