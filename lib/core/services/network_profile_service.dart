import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import 'player_settings_service.dart';

/// Describes the effective network the device is currently using.
enum NetworkType {
  /// Unmetered high-bandwidth connection (Wi-Fi, Ethernet).
  wifi,

  /// Metered cellular network.
  cellular,

  /// Other or unknown connection.
  unknown,
}

/// Lightweight service that translates [ConnectivityPlus] results into the
/// player / buffer configuration values the app cares about.
///
/// Callers listen to [onTypeChanged] to react to network switches in real time.
class NetworkProfileService {
  static final NetworkProfileService _instance = NetworkProfileService._();
  static NetworkProfileService get instance => _instance;

  NetworkProfileService._();

  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  NetworkType _currentType = NetworkType.unknown;
  final _controller = StreamController<NetworkType>.broadcast();

  bool _initialized = false;
  Future<void>? _initFuture;

  /// Current network classification.
  NetworkType get currentType => _currentType;

  /// Emits a new [NetworkType] whenever connectivity changes.
  Stream<NetworkType> get onTypeChanged => _controller.stream;

  /// Whether the active connection is on a metered link.
  bool get isMetered => _currentType == NetworkType.cellular;

  /// Maximum HLS bitrate in bits-per-second that should be requested for the
  /// current network. Returns `null` when no cap is wanted (unmetered Wi-Fi).
  ///
  /// When Watch Settings' "Data saver on cellular" is enabled, cellular and
  /// unknown connections are capped at the Data Saver tier's bitrate instead
  /// of the looser defaults below — this was previously applied invisibly
  /// with no user control at all.
  int? get maxHlsBitrateBps {
    if (_currentType != NetworkType.wifi &&
        PlayerSettingsService.instance.current.dataSaverOnCellular) {
      return QualityProfile.dataSaver.bps;
    }
    return switch (_currentType) {
      NetworkType.cellular => 1500000, // 1.5 Mbps
      NetworkType.unknown => 2500000, // conservative 2.5 Mbps
      NetworkType.wifi => null, // no artificial cap on Wi-Fi
    };
  }

  /// Optional ceiling for non-HLS progressive streams on cellular.
  /// Used as a hint for downstream bitrate / resolution selection.
  int? get maxAdaptiveBitrateBps => maxHlsBitrateBps;

  /// Start monitoring connectivity. Safe to call multiple times — concurrent
  /// callers await the same in-flight initialization instead of one
  /// returning immediately with `_currentType` still `unknown` (which
  /// applies the conservative 2.5 Mbps cap even on Wi-Fi).
  Future<void> initialize() {
    if (_initialized) return Future.value();
    return _initFuture ??= _doInitialize();
  }

  Future<void> _doInitialize() async {
    try {
      final result = await _connectivity.checkConnectivity();
      _updateList(result);
    } catch (e) {
      debugPrint('[NetworkProfile] Connectivity check failed: $e');
      _currentType = NetworkType.unknown;
    }

    try {
      _subscription = _connectivity.onConnectivityChanged.listen(
        _updateList,
        onError: (Object e) {
          debugPrint('[NetworkProfile] Connectivity stream error: $e');
        },
      );
    } catch (e) {
      debugPrint('[NetworkProfile] Connectivity listener failed: $e');
    }

    _initialized = true;
  }

  void _updateList(List<ConnectivityResult> results) {
    final type = _fromResults(results);
    if (type == _currentType) return;
    _currentType = type;
    if (!_controller.isClosed) {
      _controller.add(type);
    }
  }

  /// Stop monitoring. Called automatically on app shutdown.
  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
    if (!_controller.isClosed) {
      await _controller.close();
    }
  }

  /// Map connectivity-plus result list to a single network classification.
  ///
  /// A list containing [ConnectivityResult.mobile] or [ConnectivityResult.bluetooth]
  /// is treated as metered. [ConnectivityResult.vpn] is ignored for classification
  /// because the underlying bearer (Wi-Fi vs cellular) is what matters for
  /// data cost / bitrate decisions.
  static NetworkType _fromResults(List<ConnectivityResult> results) {
    if (results.contains(ConnectivityResult.none)) {
      return NetworkType.unknown;
    }
    if (results.contains(ConnectivityResult.bluetooth) ||
        results.contains(ConnectivityResult.mobile)) {
      return NetworkType.cellular;
    }
    if (results.contains(ConnectivityResult.wifi) ||
        results.contains(ConnectivityResult.ethernet)) {
      return NetworkType.wifi;
    }
    // A VPN alone (no wifi/mobile/ethernet alongside it) doesn't tell us the
    // underlying bearer. Some platforms report `[vpn]` in isolation even on
    // an unmetered Wi-Fi connection — treating that as `unknown` silently
    // caps an unmetered user at 2.5 Mbps. Assume the common case (VPN over
    // Wi-Fi) rather than penalizing it; a VPN over cellular still gets
    // capped because `mobile` is reported alongside `vpn` on those platforms.
    if (results.contains(ConnectivityResult.vpn)) {
      return NetworkType.wifi;
    }
    return NetworkType.unknown;
  }
}
