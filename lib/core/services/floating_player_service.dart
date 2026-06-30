import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../features/broadcast/widgets/floating_player_widget.dart';
import '../theme/app_colors.dart';

class FloatingSessionSnapshot {
  const FloatingSessionSnapshot({
    required this.channelId,
    this.channelName,
    required this.externalMode,
    this.isNativeOverlayActive = false,
  });

  final String channelId;
  final String? channelName;
  final String externalMode;
  final bool isNativeOverlayActive;

  FloatingSessionSnapshot copyWith({bool? isNativeOverlayActive}) {
    return FloatingSessionSnapshot(
      channelId: channelId,
      channelName: channelName,
      externalMode: externalMode,
      isNativeOverlayActive:
          isNativeOverlayActive ?? this.isNativeOverlayActive,
    );
  }
}

/// Manages the floating mini-player across all AfroVision screens.
///
/// **In-app mode** (app in foreground): Flutter `Overlay` widget floats above
/// every route. No permissions required.
///
/// **Cross-app mode** (app goes to background): Starts
/// `FloatingVideoOverlayService` — a native Android `WindowManager` window
/// that appears above all apps and the home screen.  Requires
/// `SYSTEM_ALERT_WINDOW` permission (requested automatically once).
class FloatingPlayerService with WidgetsBindingObserver {
  FloatingPlayerService._();
  static final FloatingPlayerService instance = FloatingPlayerService._();

  static const _overlayChannel = MethodChannel(
    'com.afrovision.afrovision/overlay',
  );

  static GlobalKey<NavigatorState>? navigatorKey;

  bool _lifecycleObserverRegistered = false;
  bool _skipNextBackgroundTransition = false;
  bool _overlayHandlerRegistered = false;

  /// Registers a handler so the native cross-app overlay can call back into
  /// Flutter — most importantly when the user taps Close on the overlay while
  /// the app is in the background. Without this, the paused in-app controller
  /// and session survive and resume on foreground (audio anomaly).
  void _setupOverlayHandler() {
    if (_overlayHandlerRegistered) return;
    _overlayHandlerRegistered = true;
    _overlayChannel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'onOverlayClosedByUser':
          // User dismissed the cross-app overlay — terminate everything so no
          // audio resumes when the app returns to the foreground.
          dismiss();
          break;
      }
      return null;
    });
  }

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
      // state. Skip it so the in-app floating overlay stays visible.
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

  // Stream info — used to rebuild playback in the native overlay service
  // when the app goes to the background.
  String? _streamHtml; // full HTML page to load in the service WebView
  String? _channelName;
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
    String? streamHtml, // pre-built HTML for the overlay service
    VoidCallback? onOpenChannelSurfer,
  }) {
    print('[FloatingPlayerService] show() called: channelId=$channelId, externalMode=$externalMode, streamHtml=${streamHtml?.length ?? 0} chars');
    _videoController = videoController;
    _ytController = ytController;
    _streamHtml = streamHtml;
    _channelName = channelName;
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
      print('[FloatingPlayerService] In-app overlay inserted');
    } catch (e) {
      print('[FloatingPlayerService] Error inserting overlay: $e');
      _entry = null;
      _sessionNotifier.value = null;
      return;
    }

    // Observe app lifecycle ourselves so the cross-app native overlay is
    // triggered even after the originating ChannelPlayerScreen is disposed.
    _registerLifecycleObserver();

    // Listen for native overlay callbacks (e.g. user-initiated close).
    _setupOverlayHandler();

    // Skip the next background transition so Navigator.pop on the channel
    // screen doesn't immediately hand off to the native overlay.
    _skipNextBackgroundTransition = true;

    // Proactively request the overlay permission while the app is still in the
    // foreground, so the native overlay can start instantly on backgrounding.
    // A prominent in-app disclosure dialog is shown first (Google Play policy
    // requirement for SYSTEM_ALERT_WINDOW).
    _ensureOverlayPermission(context);
  }

  Future<void> _ensureOverlayPermission(BuildContext context) async {
    if (_streamHtml == null || _streamHtml!.isEmpty) return;
    try {
      final canDraw =
          await _overlayChannel.invokeMethod<bool>('canDrawOverlays') ?? false;
      if (!canDraw) {
        final proceed = await _showOverlayRationaleDialog(context);
        if (!proceed) return;
        await _overlayChannel.invokeMethod('requestDrawOverlaysPermission');
      }
    } catch (_) {}
  }

  /// Prominent in-app disclosure dialog for SYSTEM_ALERT_WINDOW permission.
  /// Required by Google Play policy before requesting the permission.
  static Future<bool> _showOverlayRationaleDialog(BuildContext context) async {
    return await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => Dialog(
            backgroundColor: AppColors.cardBg,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(color: AppColors.orange.withValues(alpha: 0.25)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.picture_in_picture_alt_rounded,
                      color: AppColors.orange,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Floating Mini-Player',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'AfroVision can keep playing a mini-player on top of other apps so you never miss your favourite channels.\n\n'
                    'This requires permission to display over other apps. You can revoke this at any time in Settings.',
                    style: TextStyle(
                      color: AppColors.hintText,
                      fontSize: 14,
                      height: 1.6,
                    ),
                    textAlign: TextAlign.left,
                  ),
                  const SizedBox(height: 28),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: AppColors.inputBorder.withValues(
                                alpha: 0.4,
                              ),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            'Not Now',
                            style: TextStyle(
                              color: AppColors.goldText,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.orange,
                            foregroundColor: AppColors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Allow',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ) ??
        false;
  }

  // ── Background / foreground transitions ─────────────────────────────────

  /// Called when the host app goes to the background while floating is active.
  /// Starts the native system-overlay service so the video continues above
  /// all other apps.
  Future<void> onAppBackground() async {
    if (!isActive) return;

    final html = _streamHtml;
    if (html == null || html.isEmpty) {
      print('[FloatingPlayerService] onAppBackground: streamHtml is null or empty, skipping native overlay');
      return;
    }

    try {
      print('[FloatingPlayerService] onAppBackground: starting native overlay');
      // Ensure permission is granted before starting the service.
      final canDraw =
          await _overlayChannel.invokeMethod<bool>('canDrawOverlays') ?? false;
      if (!canDraw) {
        // Permission not granted — do NOT silently request here (can't show
        // the prominent disclosure dialog while the app is backgrounding).
        // The proactive request in show() handles disclosure. Playback stays
        // in the in-app overlay (no native cross-app overlay this time).
        print('[FloatingPlayerService] onAppBackground: overlay permission not granted, staying in-app');
        return;
      }

      // Pause in-app playback to avoid audio conflict with the service.
      print('[FloatingPlayerService] onAppBackground: pausing in-app playback');
      _videoController?.pause();
      _pauseYouTubePlayback();

      print('[FloatingPlayerService] onAppBackground: invoking startOverlay');
      await _overlayChannel.invokeMethod('startOverlay', {
        'streamHtml': html,
        'channelName': _channelName ?? '',
      });
      _sessionNotifier.value = _sessionNotifier.value?.copyWith(
        isNativeOverlayActive: true,
      );
      try {
        _entry?.remove();
      } catch (_) {
        // Entry may have been removed already
      }
      _entry = null;
      print('[FloatingPlayerService] onAppBackground: native overlay started successfully');
    } catch (e) {
      print('[FloatingPlayerService] onAppBackground error: $e');
      // If native overlay fails, keep in-app overlay active
    }
  }

  /// Called when the app returns to the foreground.
  /// Stops the native service overlay (if any), restores the in-app
  /// mini-player overlay, and resumes in-app playback.
  ///
  /// IMPORTANT: this never destroys the floating session — the mini-player
  /// must survive app minimization. The session is only ended via [dismiss],
  /// [removeWithoutStopping], or [onExpandToChannel].
  Future<void> onAppForeground() async {
    if (!isActive) return;

    print('[FloatingPlayerService] onAppForeground: restoring in-app overlay');

    // Always stop the native cross-app overlay — we are back in the app.
    try {
      await _overlayChannel.invokeMethod('stopOverlay');
      print('[FloatingPlayerService] onAppForeground: native overlay stopped');
    } catch (e) {
      print('[FloatingPlayerService] onAppForeground: error stopping native overlay: $e');
    }

    _sessionNotifier.value = _sessionNotifier.value?.copyWith(
      isNativeOverlayActive: false,
    );

    // Restore the in-app mini-player overlay so it keeps floating in-app.
    final ctx = navigatorKey?.currentContext;
    if (ctx != null && _sessionNotifier.value != null) {
      print('[FloatingPlayerService] onAppForeground: restoring in-app overlay widget');
      if (_entry != null) {
        try {
          _entry!.remove();
        } catch (_) {
          // Entry may have been removed already
        }
        _entry = null;
      }
      _entry = OverlayEntry(
        builder: (_) => FloatingPlayerWidget(
          videoController: _videoController,
          ytController: _ytController,
          channelName: _channelName ?? '',
          externalMode: _sessionNotifier.value!.externalMode,
          onClose: dismiss,
          onExpand: onExpandToChannel,
          onReturnToApp: removeOverlayOnly,
          onOpenChannelSurfer: null,
        ),
      );
      try {
        Overlay.of(ctx, rootOverlay: true).insert(_entry!);
        print('[FloatingPlayerService] onAppForeground: in-app overlay restored');
      } catch (e) {
        print('[FloatingPlayerService] onAppForeground: error inserting overlay: $e');
      }
    }

    // Resume playback — the in-app controllers are paused on backgrounding
    // (either by our hand-off or by the OS suspending the activity).
    print('[FloatingPlayerService] onAppForeground: resuming in-app playback');
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
    _streamHtml = null;
    _channelName = null;
    _channelId = null;
    _sessionNotifier.value = null;
    _stopNativeOverlay();
    _unregisterLifecycleObserver();
  }

  /// Remove overlay WITHOUT stopping playback (expand back to full player).
  void removeWithoutStopping() {
    _entry?.remove();
    _entry = null;
    _videoController = null;
    _ytController = null;
    _streamHtml = null;
    _channelName = null;
    _channelId = null;
    _sessionNotifier.value = null;
    _stopNativeOverlay();
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
    _stopNativeOverlay();
    _sessionNotifier.value = _sessionNotifier.value?.copyWith(isNativeOverlayActive: false);
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
    _stopNativeOverlay();
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

  void _stopNativeOverlay() {
    _overlayChannel.invokeMethod('stopOverlay').catchError((_) {});
  }
}
