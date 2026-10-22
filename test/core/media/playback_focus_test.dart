import 'package:afrovision/core/media/playback_focus.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final focus = PlaybackFocus.instance;

  setUp(() {
    final owner = focus.owner;
    if (owner != null) focus.abandon(owner);
  });

  test('acquiring stops the previous owner', () async {
    final a = Object();
    final b = Object();
    var aReleased = 0;

    await focus.acquire(a, () async => aReleased++);
    await focus.acquire(b, () async {});

    expect(aReleased, 1);
    expect(focus.isOwner(b), isTrue);
  });

  test('re-acquiring as the current owner swaps the release callback', () async {
    final player = Object();
    var screenReleased = 0;
    var miniPlayerReleased = 0;

    await focus.acquire(player, () async => screenReleased++);
    await focus.acquire(player, () async => miniPlayerReleased++);
    await focus.acquire(Object(), () async {});

    expect(screenReleased, 0);
    expect(miniPlayerReleased, 1);
  });

  test('abandon by a non-owner keeps the current owner', () async {
    final a = Object();
    final b = Object();
    var aReleased = 0;

    await focus.acquire(a, () async => aReleased++);
    focus.abandon(b);
    expect(focus.isOwner(a), isTrue);

    focus.abandon(a);
    await focus.acquire(b, () async {});
    expect(aReleased, 0);
  });

  test('a failing release still hands focus over', () async {
    final a = Object();
    final b = Object();

    await focus.acquire(a, () async => throw StateError('boom'));
    await focus.acquire(b, () async {});

    expect(focus.isOwner(b), isTrue);
  });
}
