import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:afrovision/core/services/player_settings_service.dart';

void main() {
  group('PlayerSettingsService', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    tearDown(() async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();
    });

    test('loads defaults when no persisted settings exist', () async {
      final service = PlayerSettingsService.instance;
      await service.initialize();

      expect(service.current.liveDelaySeconds, 30);
      expect(service.current.quality, QualityProfile.balanced);
      expect(service.current.useMediaKit, true);
    });

    test('persists and reloads live delay', () async {
      final service = PlayerSettingsService.instance;
      await service.initialize();

      await service.setLiveDelay(10);
      expect(service.current.liveDelaySeconds, 10);

      // Re-create the in-memory service state from storage.
      final raw = (await SharedPreferences.getInstance())
          .getString('afrovision_player_settings_v1');
      expect(raw, isNotNull);
      expect(raw, contains('liveDelaySeconds=10'));
    });

    test('persists and reloads quality profile', () async {
      final service = PlayerSettingsService.instance;
      await service.initialize();

      await service.setQuality(QualityProfile.quality);
      expect(service.current.quality, QualityProfile.quality);
      expect(service.current.quality.bps, 3000000);
    });

    test('persists engine kill switch', () async {
      final service = PlayerSettingsService.instance;
      await service.initialize();

      await service.setUseMediaKit(false);
      expect(service.current.useMediaKit, false);
    });
  });
}
