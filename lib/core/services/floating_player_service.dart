import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../features/broadcast/widgets/floating_player_widget.dart';

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
class FloatingPlayerService {
  FloatingPlayerService._();
  static final FloatingPlayerService instance = FloatingPlayerService._();

  static const _overlayChannel = MethodChannel(
    'com.afrovision.afrovision/overlay',
  );

  static GlobalKey<NavigatorState>? navigatorKey;

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

  bool _pendingPermissionRetry = false;

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
  }) {
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
      ),
    );

    Overlay.of(context, rootOverlay: true).insert(_entry!);
  }

  // ── Background / foreground transitions ─────────────────────────────────

  /// Called when the host app goes to the background while floating is active.
  /// Starts the native system-overlay service so the video continues above
  /// all other apps.
  Future<void> onAppBackground() async {
    if (!isActive) return;

    final html = _streamHtml;
    if (html == null || html.isEmpty) return;

    try {
      // Ensure permission is granted before starting the service.
      final canDraw =
          await _overlayChannel.invokeMethod<bool>('canDrawOverlays') ?? false;
      if (!canDraw) {
        await _overlayChannel.invokeMethod('requestDrawOverlaysPermission');
        // User is taken to Settings — when they return, onAppForeground will retry.
        _pendingPermissionRetry = true;
        return;
      }

      // Pause in-app playback to avoid audio conflict with the service.
      _videoController?.pause();
      _pauseYouTubePlayback();

      await _overlayChannel.invokeMethod('startOverlay', {
        'streamHtml': html,
        'channelName': _channelName ?? '',
      });
      _sessionNotifier.value = _sessionNotifier.value?.copyWith(
        isNativeOverlayActive: true,
      );
      _entry?.remove();
      _entry = null;
    } catch (_) {}
  }

  /// Called when the app returns to the foreground.
  /// Stops the native service overlay and resumes in-app playback.
  Future<void> onAppForeground() async {
    bool wasOverlayRunning = false;
    try {
      wasOverlayRunning =
          await _overlayChannel.invokeMethod<bool>('isOverlayRunning') ?? false;
    } catch (_) {}

    try {
      await _overlayChannel.invokeMethod('stopOverlay');
    } catch (_) {}

    if (!wasOverlayRunning) {
      if (_pendingPermissionRetry) {
        _pendingPermissionRetry = false;
        // Permission may have been granted — retry starting the native overlay.
        final html = _streamHtml;
        if (html != null && html.isNotEmpty) {
          try {
            final canDraw =
                await _overlayChannel.invokeMethod<bool>('canDrawOverlays') ??
                false;
            if (canDraw) {
              _videoController?.pause();
              _pauseYouTubePlayback();
              await _overlayChannel.invokeMethod('startOverlay', {
                'streamHtml': html,
                'channelName': _channelName ?? '',
              });
              _sessionNotifier.value = _sessionNotifier.value?.copyWith(
                isNativeOverlayActive: true,
              );
              _entry?.remove();
              _entry = null;
              return;
            }
          } catch (_) {}
        }
      }
      _videoController?.pause();
      _pauseYouTubePlayback();
      _videoController = null;
      _ytController = null;
      _streamHtml = null;
      _channelName = null;
      _channelId = null;
      _sessionNotifier.value = null;
      return;
    }

    _sessionNotifier.value = _sessionNotifier.value?.copyWith(
      isNativeOverlayActive: false,
    );
  }

  // ── Dismiss / remove ─────────────────────────────────────────────────────

  /// Remove overlay and stop playback.
  void dismiss() {
    _entry?.remove();
    _entry = null;
    _videoController?.pause();
    _pauseYouTubePlayback();
    _videoController = null;
    _ytController = null;
    _streamHtml = null;
    _channelName = null;
    _channelId = null;
    _sessionNotifier.value = null;
    _stopNativeOverlay();
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
  }

  void onExpandToChannel() {
    final id = _channelId;
    if (id == null || id.isEmpty) {
      removeWithoutStopping();
      return;
    }

    _entry?.remove();
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

  void _stopNativeOverlay() {
    _overlayChannel.invokeMethod('stopOverlay').catchError((_) {});
  }
}
