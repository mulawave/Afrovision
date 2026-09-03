import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

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

  /// Current network classification.
  NetworkType get currentType => _currentType;

  /// Emits a new [NetworkType] whenever connectivity changes.
  Stream<NetworkType> get onTypeChanged => _controller.stream;

  /// Whether the active connection is on a metered link.
  bool get isMetered => _currentType == NetworkType.cellular;

  /// Maximum HLS bitrate in bits-per-second that should be requested for the
  /// current network. Returns `null` when no cap is wanted (unmetered Wi-Fi).
  int? get maxHlsBitrateBps {
    return switch (_currentType) {
      NetworkType.cellular => 1500000, // 1.5 Mbps
      NetworkType.unknown => 2500000, // conservative 2.5 Mbps
      NetworkType.wifi => null, // no artificial cap on Wi-Fi
    };
  }

  /// Optional ceiling for non-HLS progressive streams on cellular.
  /// Used as a hint for downstream bitrate / resolution selection.
  int? get maxAdaptiveBitrateBps => maxHlsBitrateBps;

  /// Start monitoring connectivity. Safe to call multiple times.
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

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
    return NetworkType.unknown;
  }
}
