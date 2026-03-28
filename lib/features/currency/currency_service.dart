import '../../core/api/api_service.dart';
import 'models/currency_model.dart';

class CurrencyService {
  static Future<List<CurrencyModel>> getCurrencies() async {
    final data = await ApiService.get('/currencies');
    return (data['currencies'] as List)
        .map((c) => CurrencyModel.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  static Future<Map<String, dynamic>> getConvertedPlans(String currency) async {
    return ApiService.get('/currencies/plans?currency=$currency');
  }

  static Future<void> updatePreferredCurrency(String currency) async {
    await ApiService.patch('/users/currency', {'currency': currency});
  }
}
