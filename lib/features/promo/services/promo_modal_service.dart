import '../../../core/api/api_service.dart';

class PromoModalData {
  final bool enabled;
  final String imageUrl;
  final String title;
  final String subtitle;
  final String bodyText;
  final String buttonText;
  final String buttonLink;
  final bool openInNewTab;

  PromoModalData({
    required this.enabled,
    required this.imageUrl,
    required this.title,
    required this.subtitle,
    required this.bodyText,
    required this.buttonText,
    required this.buttonLink,
    required this.openInNewTab,
  });

  factory PromoModalData.fromJson(Map<String, dynamic> json) {
    return PromoModalData(
      enabled: json['enabled'] == true,
      imageUrl: (json['image_url'] as String?) ?? '',
      title: (json['title'] as String?) ?? '',
      subtitle: (json['subtitle'] as String?) ?? '',
      bodyText: (json['body_text'] as String?) ?? '',
      buttonText: (json['button_text'] as String?) ?? '',
      buttonLink: (json['button_link'] as String?) ?? '',
      openInNewTab: json['open_in_new_tab'] == true,
    );
  }
}

class PromoModalService {
  /// Session flag — set to true once the modal has been shown this app session.
  static bool _shownThisSession = false;

  /// Fetch the promo modal config. Returns null if disabled or already shown.
  static Future<PromoModalData?> getIfAvailable() async {
    if (_shownThisSession) return null;
    try {
      final data = await ApiService.getPublic('/promo-modal');
      if (data is Map<String, dynamic>) {
        final modal = data['promo_modal'];
        if (modal == null) return null;
        final promo = PromoModalData.fromJson(modal as Map<String, dynamic>);
        if (!promo.enabled) return null;
        return promo;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Mark the modal as shown for this session.
  static void markShown() {
    _shownThisSession = true;
  }

  /// Reset for testing.
  static void reset() {
    _shownThisSession = false;
  }
}
