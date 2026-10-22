import 'package:flutter/widgets.dart';

/// App-wide single owner of audible playback.
///
/// Every player that can make sound (channel player, mini-player, VOD, Waves,
/// media player, YouTube embeds) calls [acquire] before it starts playing.
/// The previous owner's release callback runs first, so two sources can never
/// play over each other regardless of which screen or service started them.
class PlaybackFocus {
  PlaybackFocus._();
  static final PlaybackFocus instance = PlaybackFocus._();

  Object? _owner;
  Future<void> Function()? _release;

  Object? get owner => _owner;

  bool isOwner(Object owner) => identical(_owner, owner);

  /// Makes [owner] the active player. Re-acquiring as the current owner only
  /// swaps the release callback (used when the mini-player adopts a player).
  Future<void> acquire(Object owner, Future<void> Function() release) async {
    if (identical(_owner, owner)) {
      _release = release;
      return;
    }
    final previousRelease = _release;
    _owner = owner;
    _release = release;
    if (previousRelease != null) {
      try {
        await previousRelease();
      } catch (e) {
        debugPrint('[PlaybackFocus] release failed: $e');
      }
    }
  }

  /// Clears focus if [owner] still holds it. Call from the owner's dispose.
  void abandon(Object owner) {
    if (!identical(_owner, owner)) return;
    _owner = null;
    _release = null;
  }
}

/// Lets screens pause their players while another page covers them. Typed to
/// [PageRoute] so bottom sheets and dialogs over the player don't pause it.
final RouteObserver<PageRoute<dynamic>> playbackRouteObserver =
    RouteObserver<PageRoute<dynamic>>();
