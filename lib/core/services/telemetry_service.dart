import 'package:flutter/foundation.dart';

/// Simple telemetry facade for playback diagnostics and QA smoke events.
///
/// In debug builds events are printed to the console with a stable tag so
/// QA can grep logs. In release builds logging is a no-op by default to avoid
/// leaking diagnostics, but it can be enabled via [setEnabled] if needed.
class TelemetryService {
  TelemetryService._();

  static bool _enabled = !kReleaseMode;

  /// Enable or disable all telemetry output.
  static void setEnabled(bool enabled) => _enabled = enabled;

  /// Returns whether telemetry output is currently enabled.
  static bool get isEnabled => _enabled;

  /// Log a named telemetry event with optional key/value parameters.
  static void marker(
    String event, {
    Map<String, Object?> parameters = const {},
  }) {
    if (!_enabled) return;
    final buffer = StringBuffer();
    buffer.write('[AFROVISION_TELEMETRY][$event]');
    if (parameters.isNotEmpty) {
      final entries = parameters.entries
          .map((e) => '${e.key}=${e.value}')
          .join(', ');
      buffer.write(' $entries');
    }
    debugPrint(buffer.toString());
  }

  /// Log an error event with optional context.
  static void error(
    String event,
    dynamic error, {
    StackTrace? stackTrace,
    Map<String, Object?> parameters = const {},
  }) {
    if (!_enabled) return;
    final buffer = StringBuffer();
    buffer.write('[AFROVISION_TELEMETRY][ERROR][$event]');
    if (parameters.isNotEmpty) {
      final entries = parameters.entries
          .map((e) => '${e.key}=${e.value}')
          .join(', ');
      buffer.write(' $entries');
    }
    buffer.write(' | error=$error');
    debugPrint(buffer.toString());
    if (stackTrace != null) {
      debugPrint(stackTrace.toString());
    }
  }
}
