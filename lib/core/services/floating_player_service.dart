import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../features/broadcast/widgets/floating_player_widget.dart';

class FloatingSessionSnapshot {
  const FloatingSessionSnapshot({
    required this.channelId,
    this.channelName,
    required this.externalMode,
  });

  final String channelId;
  final String? channelName;
  final String externalMode;
}

/// Manages the in-app floating mini-player across all AfroVision screens.
///
/// A Flutter `Overlay` widget floats above every route so the user can keep
/// watching a channel while browsing the rest of the app. It reuses the
/// already-playing [VideoPlayerController] / [WebViewController] — there is no
/// second playback source — so returning to the player never leaves rogue
/// audio behind.
///
/// Cross-app playback (continuing the video on top of other apps / the home
/// screen) is handled exclusively by native Android Picture-in-Picture from
/// the player screen; this service never spawns a separate overlay window.
class FloatingPlayerService with WidgetsBindingObserver {
  FloatingPlayerService._();
  static final FloatingPlayerService instance = FloatingPlayerService._();

  static GlobalKey<NavigatorState>? navigatorKey;

  bool _lifecycleObserverRegistered = false;
  bool _skipNextBackgroundTransition = false;

  void _registerLifecycleObserver() {
    if (_lifecycleObserverRegistered) return;
    WidgetsBinding.instance.addObserver(this);
    _lifecycleObserverRegistered = true;
  }

  void _unregisterLifecycleObserver() {
    if (!_lifecycleObserverRegistered) return;
    WidgetsBinding.instance.removeObserver(this);
    _lifecycleObserverRegistered = false;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!isActive) return;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      // When entering float mode, Navigator.pop triggers a brief inactive
      // state. Skip it so the mini-player keeps playing.
      if (_skipNextBackgroundTransition) {
        _skipNextBackgroundTransition = false;
        return;
      }
      onAppBackground();
    } else if (state == AppLifecycleState.resumed) {
      _skipNextBackgroundTransition = false;
      onAppForeground();
    }
  }

  OverlayEntry? _entry;
  VideoPlayerController? _videoController;
  WebViewController? _ytController;

  String? _channelId;
  final ValueNotifier<FloatingSessionSnapshot?> _sessionNotifier =
      ValueNotifier<FloatingSessionSnapshot?>(null);

  bool get isActive => _entry != null || _sessionNotifier.value != null;
  ValueNotifier<FloatingSessionSnapshot?> get sessionListenable =>
      _sessionNotifier;
  FloatingSessionSnapshot? get activeSession => _sessionNotifier.value;

  // ── Show ─────────────────────────────────────────────────────────────────

  void show({
    required BuildContext context,
    VideoPlayerController? videoController,
    WebViewController? ytController,
    required String channelId,
    String? channelName,
    String? channelLogoUrl,
    required String externalMode,
    VoidCallback? onOpenChannelSurfer,
  }) {
    _videoController = videoController;
    _ytController = ytController;
    _channelId = channelId;
    _sessionNotifier.value = FloatingSessionSnapshot(
      channelId: channelId,
      channelName: channelName,
      externalMode: externalMode,
    );

    _entry?.remove();
    _entry = OverlayEntry(
      builder: (_) => FloatingPlayerWidget(
        videoController: _videoController,
        ytController: _ytController,
        channelName: channelName ?? '',
        externalMode: externalMode,
        onClose: dismiss,
        onExpand: onExpandToChannel,
        onReturnToApp: removeOverlayOnly,
        onOpenChannelSurfer: onOpenChannelSurfer,
      ),
    );

    try {
      Overlay.of(context, rootOverlay: true).insert(_entry!);
    } catch (_) {
      _entry = null;
      _sessionNotifier.value = null;
      return;
    }

    // Observe app lifecycle ourselves so playback is paused/resumed correctly
    // even after the originating ChannelPlayerScreen is disposed.
    _registerLifecycleObserver();

    // Skip the next background transition so Navigator.pop on the channel
    // screen doesn't immediately pause the mini-player.
    _skipNextBackgroundTransition = true;
  }

  // ── Background / foreground transitions ─────────────────────────────────

  /// Called when the host app goes to the background while the mini-player is
  /// active. Pauses the shared in-app controllers so no audio plays while the
  /// app has no visible UI. (Over-other-apps playback is handled by native PiP
  /// from the player screen, not here.)
  Future<void> onAppBackground() async {
    if (!isActive) return;
    _videoController?.pause();
    _pauseYouTubePlayback();
  }

  /// Called when the app returns to the foreground. Resumes the mini-player's
  /// playback. The in-app overlay itself is never removed on backgrounding, so
  /// there is nothing to restore.
  Future<void> onAppForeground() async {
    if (!isActive) return;
    _resumeInAppPlayback();
  }

  // ── Dismiss / remove ─────────────────────────────────────────────────────

  /// Remove overlay and stop playback.
  void dismiss() {
    try {
      _entry?.remove();
    } catch (_) {
      // Entry may already have been removed by a background transition.
    }
    _entry = null;
    _pauseYouTubePlayback();
    // Dispose the native video controller so it releases audio focus and
    // stops decoding. Pausing alone can leave audio holding focus, which
    // conflicts with the next channel and previously required an app restart.
    try {
      _videoController?.pause();
      _videoController?.dispose();
    } catch (_) {
      // Controller may already be disposed by the owning screen.
    }
    _videoController = null;
    _ytController = null;
    _channelId = null;
    _sessionNotifier.value = null;
    _unregisterLifecycleObserver();
  }

  /// Remove overlay WITHOUT stopping playback (expand back to full player).
  void removeWithoutStopping() {
    _entry?.remove();
    _entry = null;
    _videoController = null;
    _ytController = null;
    _channelId = null;
    _sessionNotifier.value = null;
    _unregisterLifecycleObserver();
  }

  /// Remove overlay WITHOUT stopping playback or clearing session (return to app).
  void removeOverlayOnly() {
    try {
      _entry?.remove();
    } catch (_) {
      // Entry may have been removed during background transition
    }
    _entry = null;
  }

  void onExpandToChannel() {
    final id = _channelId;
    if (id == null || id.isEmpty) {
      removeWithoutStopping();
      return;
    }

    try {
      _entry?.remove();
    } catch (_) {
      // Entry may have been removed during background transition
    }
    _entry = null;
    _sessionNotifier.value = null;

    final nav = navigatorKey?.currentState;
    if (nav == null) return;
    nav.pushNamed('/channel-player', arguments: id);
  }

  Future<void> reopenActiveChannel() async {
    onExpandToChannel();
  }

  void _pauseYouTubePlayback() {
    _ytController
        ?.runJavaScript(
          'try{document.getElementById("yt").contentWindow'
          '.postMessage(\'{"event":"command","func":"pauseVideo","args":[]}\', "*");}catch(e){}',
        )
        .catchError((_) {});
  }

  void _resumeYouTubePlayback() {
    _ytController
        ?.runJavaScript(
          'try{document.getElementById("yt").contentWindow'
          '.postMessage(\'{"event":"command","func":"playVideo","args":[]}\', "*");}catch(e){}',
        )
        .catchError((_) {});
  }

  /// Resume in-app playback (video + YouTube) for the floating mini-player.
  void _resumeInAppPlayback() {
    try {
      final c = _videoController;
      if (c != null && c.value.isInitialized && !c.value.isPlaying) {
        c.play();
      }
    } catch (_) {}
    _resumeYouTubePlayback();
  }
}
