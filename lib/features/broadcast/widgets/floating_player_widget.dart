import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../../core/theme/app_colors.dart';
import 'broadcast_player.dart';

/// Draggable, pinch-resizable floating mini-player.
///
/// • Single-finger drag   → move the window anywhere on screen.
/// • Two-finger pinch     → resize (0.5× min  ↔  2.5× max of base size).
/// • ⛶ top-left button   → expand back to the full player screen.
/// • ✕ top-right button  → stop playback and dismiss.
class FloatingPlayerWidget extends StatefulWidget {
  const FloatingPlayerWidget({
    super.key,
    this.broadcastPlayer,
    this.ytController,
    required this.channelName,
    required this.externalMode,
    required this.onClose,
    required this.onExpand,
    this.onReturnToApp,
    this.onOpenChannelSurfer,
  });

  final BroadcastPlayer? broadcastPlayer;
  final WebViewController? ytController;
  final String channelName;
  final String externalMode;
  final VoidCallback onClose;
  final VoidCallback onExpand;
  final VoidCallback? onReturnToApp;
  final VoidCallback? onOpenChannelSurfer;

  @override
  State<FloatingPlayerWidget> createState() => _FloatingPlayerWidgetState();
}

class _FloatingPlayerWidgetState extends State<FloatingPlayerWidget> {
  // ── Size / position state ─────────────────────────────────────────────────
  static const double _baseW = 192.0;
  static const double _baseH = 120.0; // ~16:9 + bottom label bar

  double _scale             = 1.0;
  double _scaleAtGestureStart = 1.0;
  Offset _position          = const Offset(double.infinity, double.infinity);
  bool   _positioned        = false;

  double get _w => (_baseW * _scale).clamp(_baseW * 0.5, _baseW * _maxScale);
  double get _h => (_baseH * _scale).clamp(_baseH * 0.5, _baseH * _maxScale);

  double _maxScale = 2.5;

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;

    // Calculate max scale based on screen dimensions for full-screen expansion
    final maxScaleW = screen.width / _baseW;
    final maxScaleH = screen.height / _baseH;
    _maxScale = (maxScaleW * maxScaleH).clamp(2.5, 5.0);

    // First frame: place bottom-right, clear of the system navigation bar.
    if (!_positioned) {
      _position = Offset(screen.width - _w - 12, screen.height - _h - 80);
      _positioned = true;
    }

    // Clamp so the window never goes off-screen after dragging or resizing.
    _position = Offset(
      _position.dx.clamp(0.0, (screen.width  - _w).clamp(0.0, screen.width)),
      _position.dy.clamp(0.0, (screen.height - _h).clamp(0.0, screen.height)),
    );

    return Stack(
      children: [
        Positioned(
          left: _position.dx,
          top:  _position.dy,
          child: GestureDetector(
            // ── onScaleStart/Update cover BOTH drag and pinch ──────────────
            // pointerCount == 1  → translate (drag)
            // pointerCount >= 2  → scale  (pinch)
            onScaleStart: (d) {
              _scaleAtGestureStart = _scale;
            },
            onScaleUpdate: (d) {
              setState(() {
                if (d.pointerCount >= 2) {
                  // Pinch: update scale around the focal point.
                  final newScale = (_scaleAtGestureStart * d.scale)
                      .clamp(0.5, _maxScale);
                  // Adjust position so the focal point stays fixed.
                  final oldW = _w;
                  final oldH = _h;
                  _scale = newScale;
                  _position = Offset(
                    _position.dx - (_w - oldW) / 2,
                    _position.dy - (_h - oldH) / 2,
                  );
                } else {
                  // Single-finger drag.
                  _position = _position.translate(
                    d.focalPointDelta.dx,
                    d.focalPointDelta.dy,
                  );
                }
              });
            },
            child: Material(
              elevation: 12,
              borderRadius: BorderRadius.circular(12),
              clipBehavior: Clip.antiAlias,
              child: SizedBox(
                width:  _w,
                height: _h,
                child: Stack(
                  children: [
                    // ── Video surface ──────────────────────────────────────
                    _buildVideoContent(),

                    // ── Bottom label ───────────────────────────────────────
                    Positioned(
                      bottom: 0, left: 0, right: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4,
                        ),
                        color: Colors.black.withValues(alpha: 0.65),
                        child: Text(
                          widget.channelName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),

                    // ── channel surfer button ─────────────────────────────
                    if (widget.onOpenChannelSurfer != null)
                      Positioned(
                        bottom: 24,
                        right: 4,
                        child: _PiPButton(
                          icon: Icons.swap_horiz_rounded,
                          iconSize: 13,
                          onTap: widget.onOpenChannelSurfer!,
                        ),
                      ),

                    // ── ✕ close ────────────────────────────────────────────
                    Positioned(
                      top: 4, right: 4,
                      child: _PiPButton(
                        icon: Icons.close_rounded,
                        onTap: widget.onClose,
                      ),
                    ),

                    // ── ⛶ expand ──────────────────────────────────────────
                    Positioned(
                      top: 4, left: 4,
                      child: _PiPButton(
                        icon: Icons.open_in_full_rounded,
                        iconSize: 13,
                        onTap: widget.onExpand,
                      ),
                    ),

                    // ── return to app (center) ─────────────────────────────
                    if (widget.onReturnToApp != null)
                      Positioned(
                        top: 4,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: _PiPButton(
                            icon: Icons.arrow_back_rounded,
                            iconSize: 13,
                            onTap: widget.onReturnToApp!,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildVideoContent() {
    if (widget.externalMode == 'youtube' && widget.ytController != null) {
      return SizedBox.expand(
        child: WebViewWidget(controller: widget.ytController!),
      );
    }
    final player = widget.broadcastPlayer;
    if (player != null && player.value.isInitialized) {
      return AnimatedBuilder(
        animation: player,
        builder: (_, __) {
          return Center(
            child: AspectRatio(
              aspectRatio: player.value.aspectRatio,
              child: player.buildVideo(fit: BoxFit.contain),
            ),
          );
        },
      );
    }
    return Container(
      color: Colors.black,
      child: const Center(
        child: CircularProgressIndicator(color: AppColors.orange, strokeWidth: 2),
      ),
    );
  }
}

// ── Small circular button used for the PiP controls ──────────────────────────

class _PiPButton extends StatelessWidget {
  const _PiPButton({
    required this.icon,
    required this.onTap,
    this.iconSize = 14,
  });

  final IconData icon;
  final VoidCallback onTap;
  final double iconSize;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.72),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: Colors.white, size: iconSize),
        ),
      );
}
