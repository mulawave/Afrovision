import '../../../core/api/api_service.dart';
import '../models/ledger_entry_model.dart';
import '../models/withdrawal_model.dart';

class WalletService {
  static Future<Map<String, dynamic>> getBalance() async {
    return ApiService.get('/vpt/balance');
  }

  static Future<Map<String, dynamic>> getBlockchainPreflight() async {
    final data = await ApiService.get('/vpt/admin/preflight');
    return data['readiness'] as Map<String, dynamic>? ?? <String, dynamic>{};
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

  // ─── Gift Wallet ─────────────────────────────────────────

  static Future<Map<String, dynamic>> getGiftWalletBalance() async {
    final data = await ApiService.get('/interactions/wallet');
    return data['wallet'] as Map<String, dynamic>? ?? {};
  }

  // ─── Withdrawals ─────────────────────────────────────────

  static Future<WithdrawalModel> requestWithdrawal(double amount) async {
    final data = await ApiService.post('/withdrawals/request', {
      'amount': amount,
    });
    return WithdrawalModel.fromJson(data['withdrawal'] as Map<String, dynamic>);
  }

  static Future<List<WithdrawalModel>> getMyWithdrawals() async {
    final data = await ApiService.get('/withdrawals');
    final list = data['withdrawals'] as List<dynamic>? ?? [];
    return list
        .map((e) => WithdrawalModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
