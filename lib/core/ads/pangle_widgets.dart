import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'pangle_ads.dart';

enum _PangleView { spotlight, big, native, nativeWaves }

/// Shared plumbing: hosts the Android platform view at 1px until the native
/// side reports a loaded ad, then grows to [height]. A failed load collapses to
/// nothing, so a missing ad never leaves an empty gap in the layout.
class _PanglePlatformAd extends StatefulWidget {
  final _PangleView kind;
  final double height;
  final EdgeInsetsGeometry margin;
  final VoidCallback? onFailed;

  const _PanglePlatformAd({
    required this.kind,
    required this.height,
    required this.margin,
    this.onFailed,
  });

  @override
  State<_PanglePlatformAd> createState() => _PanglePlatformAdState();
}

class _PanglePlatformAdState extends State<_PanglePlatformAd> {
  bool _loaded = false;
  bool _failed = false;
  bool _visible = true;
  MethodChannel? _channel;

  String get _viewType => (widget.kind == _PangleView.native ||
          widget.kind == _PangleView.nativeWaves)
      ? 'com.afrovision.afrovision/pangle_native'
      : 'com.afrovision.afrovision/pangle_banner';

  Map<String, dynamic> get _params {
    switch (widget.kind) {
      case _PangleView.big:
        return {'size': 'big'};
      case _PangleView.spotlight:
        return {'size': 'spotlight'};
      case _PangleView.native:
        return {'placement': 'advanced'};
      case _PangleView.nativeWaves:
        return {'placement': 'waves'};
    }
  }

  void _apply(String state) {
    if (!mounted) return;
    if (state == 'loaded' && !_loaded) setState(() => _loaded = true);
    if (state == 'failed' && !_failed) {
      setState(() => _failed = true);
      widget.onFailed?.call();
    }
  }

  void _onCreated(int id) {
    final channel = MethodChannel('com.afrovision.afrovision/pangle_view_$id');
    _channel = channel;
    channel.setMethodCallHandler((call) async {
      _apply(call.method);
    });
    // The native side may have finished loading before this handler existed.
    channel.invokeMethod<String>('state').then((s) {
      if (s != null) _apply(s);
    }).catchError((_) {});
  }

  // Tabs live in an IndexedStack and covered routes stay mounted; both switch
  // tickers off. Only host the native ad while this subtree is actually
  // visible so hidden tabs never load (and never burn) impressions.
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = TickerMode.valuesOf(context).enabled;
    if (visible != _visible) {
      _visible = visible;
      if (!visible) {
        _channel?.setMethodCallHandler(null);
        _channel = null;
        _loaded = false;
        _failed = false;
      }
    }
  }

  @override
  void dispose() {
    _channel?.setMethodCallHandler(null);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!PangleAds.supported || _failed || !_visible) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: _loaded ? widget.margin : EdgeInsets.zero,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        height: _loaded ? widget.height : 1,
        width: double.infinity,
        child: AndroidView(
          viewType: _viewType,
          creationParams: _params,
          creationParamsCodec: const StandardMessageCodec(),
          onPlatformViewCreated: _onCreated,
        ),
      ),
    );
  }
}

/// 300x250 banner for the lower section of a screen.
class PangleBigBanner extends StatelessWidget {
  final EdgeInsetsGeometry margin;
  const PangleBigBanner({
    super.key,
    this.margin = const EdgeInsets.symmetric(vertical: 16),
  });

  @override
  Widget build(BuildContext context) => _PanglePlatformAd(
        kind: _PangleView.big,
        height: 250,
        margin: margin,
      );
}

/// 320x50 spotlight banner.
class PangleSpotlightBanner extends StatelessWidget {
  final EdgeInsetsGeometry margin;
  const PangleSpotlightBanner({
    super.key,
    this.margin = const EdgeInsets.symmetric(vertical: 8),
  });

  @override
  Widget build(BuildContext context) => _PanglePlatformAd(
        kind: _PangleView.spotlight,
        height: 50,
        margin: margin,
      );
}

/// Native ad card. Use [waves] for the waves-feed placement.
class PangleNativeAd extends StatelessWidget {
  final bool waves;
  final double height;
  final EdgeInsetsGeometry margin;
  final VoidCallback? onFailed;
  const PangleNativeAd({
    super.key,
    this.waves = false,
    this.height = 330,
    this.margin = const EdgeInsets.symmetric(vertical: 12, horizontal: 18),
    this.onFailed,
  });

  @override
  Widget build(BuildContext context) => _PanglePlatformAd(
        kind: waves ? _PangleView.nativeWaves : _PangleView.native,
        height: height,
        margin: margin,
        onFailed: onFailed,
      );
}
