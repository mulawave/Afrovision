import 'package:flutter/material.dart';
import '../theme/nocturne_theme.dart';

/// A single shimmering placeholder block — an animated highlight sweeps
/// left-to-right over a base tone, matching the industry-standard skeleton
/// loading pattern. Used to build screen-specific skeletons so a loading
/// screen shows the shape of its real content instead of a blank page with
/// a spinner in the middle.
class ShimmerBox extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;

  const ShimmerBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius,
  });

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return ClipRRect(
          borderRadius: widget.borderRadius ?? BorderRadius.circular(8),
          child: SizedBox(
            width: widget.width,
            height: widget.height,
            child: ShaderMask(
              blendMode: BlendMode.srcATop,
              shaderCallback: (rect) {
                final dx = _controller.value * 2 - 1; // -1 → 1
                return LinearGradient(
                  begin: Alignment(dx - 0.6, 0),
                  end: Alignment(dx + 0.6, 0),
                  colors: const [
                    Nocturne.surfaceRaised,
                    Nocturne.borderCard,
                    Nocturne.surfaceRaised,
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ).createShader(rect);
              },
              child: Container(color: Nocturne.surfaceRaised),
            ),
          ),
        );
      },
    );
  }
}
