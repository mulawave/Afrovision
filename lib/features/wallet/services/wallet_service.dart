import '../../../core/api/api_service.dart';
import '../models/ledger_entry_model.dart';

class WalletService {
  static Future<Map<String, dynamic>> getBalance() async {
    return ApiService.get('/vpt/balance');
  }

  static Future<List<LedgerEntryModel>> getLedger() async {
    final data = await ApiService.get('/vpt/ledger');
    final list = data['ledger'] as List<dynamic>? ?? [];
    return list.map((e) => LedgerEntryModel.fromJson(e)).toList();
  }

  static Future<List<dynamic>> getQueue() async {
    final data = await ApiService.get('/vpt/queue');
    return data['queue'] as List<dynamic>? ?? [];
  }

  static Future<Map<String, dynamic>?> getMyWallet() async {
    try {
      final data = await ApiService.get('/wallet/me');
      return data['wallet'] as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }
}
