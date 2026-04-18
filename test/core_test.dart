import 'package:flutter_test/flutter_test.dart';
import 'package:afrovision/core/theme/app_colors.dart';
import 'package:afrovision/core/config/app_config.dart';

void main() {
  group('AppColors', () {
    test('brand colors match spec', () {
      expect(AppColors.darkBlue.toARGB32(), 0xFF050A30);
      expect(AppColors.lightBlue.toARGB32(), 0xFF173A6D);
      expect(AppColors.lightOrange.toARGB32(), 0xFFF5C16C);
      expect(AppColors.orange.toARGB32(), 0xFFF49617);
      expect(AppColors.white.toARGB32(), 0xFFFFFFFF);
    });

    test('primaryGradient uses correct colors', () {
      final colors = AppColors.primaryGradient.colors;
      expect(colors.length, 2);
      expect(colors[0], AppColors.lightBlue);
      expect(colors[1], AppColors.darkBlue);
    });

    test('buttonGradient uses correct colors', () {
      final colors = AppColors.buttonGradient.colors;
      expect(colors.length, 2);
      expect(colors[0], AppColors.orange);
      expect(colors[1], AppColors.lightOrange);
    });
  });

  group('AppConfig', () {
    test('baseUrl is non-empty and uses HTTPS', () {
      expect(AppConfig.baseUrl, isNotEmpty);
      expect(AppConfig.baseUrl, startsWith('https://'));
    });

    test('mediaUrl returns absolute URLs unchanged', () {
      const abs = 'https://storage.googleapis.com/bucket/image.png';
      expect(AppConfig.mediaUrl(abs), abs);
    });

    test('mediaUrl prepends baseUrl for relative paths', () {
      const relative = '/uploads/image.png';
      expect(AppConfig.mediaUrl(relative), '${AppConfig.baseUrl}$relative');
    });
  });
}
