class PlanModel {
  final String id;
  final String name;
  final String type;
  final double price;
  final double? yearlyPrice;
  final String currency;
  final List<String> features;
  final Map<String, String> displayLabels;
  final String? badge;
  final double? rewardMultiplier;
  final bool isActive;

  PlanModel({
    required this.id,
    required this.name,
    this.type = 'creator',
    required this.price,
    this.yearlyPrice,
    this.currency = 'NGN',
    required this.features,
    this.displayLabels = const {},
    this.badge,
    this.rewardMultiplier,
    required this.isActive,
  });

  bool get isViewer => type == 'viewer';
  bool get isCreator => type == 'creator';

  String featureLabel(String feature) {
    return displayLabels[feature] ??
        feature
            .split('_')
            .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
            .join(' ');
  }

  factory PlanModel.fromJson(Map<String, dynamic> json) {
    final rawLabels = json['display_labels'] as Map<String, dynamic>? ?? {};
    return PlanModel(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String? ?? 'creator',
      price: (json['price'] as num).toDouble(),
      yearlyPrice: (json['yearly_price'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'NGN',
      features: (json['features'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      displayLabels: rawLabels.map((k, v) => MapEntry(k, v.toString())),
      badge: json['badge'] as String?,
      rewardMultiplier: (json['reward_multiplier'] as num?)?.toDouble(),
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
