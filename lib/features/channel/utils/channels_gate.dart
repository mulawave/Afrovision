import 'package:flutter/material.dart';
import '../../../core/services/kyc_guard_service.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

/// Small gate helper for the channel redesign.
/// Keeps exclusive-channel visibility rules and creation gating in one place.
class ChannelsGate {
  ChannelsGate._();

  /// Channels that should appear in browse and search.
  static List<ChannelModel> filterBrowse(List<ChannelModel> channels) {
    return channels.where((c) => !c.isExclusive).toList();
  }

  /// Whether the current user may watch the channel reached by number.
  /// Public and private are always reachable; exclusive needs an active
  /// membership (server is the source of truth).
  static Future<bool> canWatchByNumber(ChannelModel channel) async {
    if (!channel.isExclusive) return true;
    try {
      final status = await ChannelService.getExclusiveAccessStatus(channel.id);
      return status.hasActiveEntitlement;
    } catch (_) {
      return false;
    }
  }

  /// Screen-entry guard for any creation surface.
  static void enforceCreateEntry(BuildContext context) {
    KycGuard.enforceOnEntry(context);
  }
}
