class CurrencyModel {
  final String code;
  final String name;
  final String symbol;
  final double rateToNgn;

  CurrencyModel({
    required this.code,
    required this.name,
    required this.symbol,
    required this.rateToNgn,
  });

  factory CurrencyModel.fromJson(Map<String, dynamic> json) {
    return CurrencyModel(
      code: json['code'] as String,
      name: json['name'] as String,
      symbol: json['symbol'] as String,
      rateToNgn: (json['rate_to_ngn'] as num).toDouble(),
    );
  }
}
