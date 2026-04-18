import '../../../core/api/api_service.dart';
import '../models/bank_details_model.dart';
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

  // ─── Ravens ↔ vPT Exchange ──────────────────────────────

  static Future<Map<String, dynamic>> exchangeAssets({
    required String from,
    required String to,
    required double amount,
  }) async {
    return ApiService.post('/interactions/exchange', {
      'from': from,
      'to': to,
      'amount': amount,
    });
  }

  static Future<Map<String, dynamic>> getExchangeRates() async {
    final data = await ApiService.get('/interactions/exchange/rates');
    return data['rates'] as Map<String, dynamic>? ?? {};
  }

  static Future<BankDetailsModel?> getMyBankDetails() async {
    final data = await ApiService.get('/users/bank-details');
    final bankDetails = data['bank_details'] as Map<String, dynamic>?;
    if (bankDetails == null) return null;
    return BankDetailsModel.fromJson(bankDetails);
  }

  static Future<List<BankOptionModel>> getSupportedBanks() async {
    final data = await ApiService.get('/users/bank-details/banks');
    final list = data['banks'] as List<dynamic>? ?? [];
    return list
        .map((item) => BankOptionModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  static Future<ResolvedBankAccountModel> resolveBankAccount({
    required String bankCode,
    required String accountNumber,
  }) async {
    final data = await ApiService.post('/users/bank-details/resolve', {
      'bank_code': bankCode,
      'account_number': accountNumber,
    });
    return ResolvedBankAccountModel.fromJson(data);
  }

  static Future<BankDetailsModel> saveBankDetails({
    required String bankCode,
    required String bankName,
    required String accountNumber,
    required String accountName,
  }) async {
    final data = await ApiService.post('/users/bank-details', {
      'bank_code': bankCode,
      'bank_name': bankName,
      'account_number': accountNumber,
      'account_name': accountName,
    });
    return BankDetailsModel.fromJson(
      data['bank_details'] as Map<String, dynamic>,
    );
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

  // ─── External Wallet ──────────────────────────────────────

  /// Scan a BSC address for vPT and BNB balances.
  static Future<Map<String, dynamic>> scanBalance(String address) async {
    final data = await ApiService.get('/wallet/scan-balance/$address');
    return data['balances'] as Map<String, dynamic>? ?? {};
  }

  /// Import an external BSC address, scan chain, link to user profile.
  static Future<Map<String, dynamic>> importAddress(String address) async {
    return ApiService.post('/wallet/import-address', {'address': address});
  }

  /// Connect an external wallet (MetaMask, Trust Wallet, etc).
  static Future<Map<String, dynamic>> connectExternalWallet({
    required String address,
    required String type,
  }) async {
    return ApiService.post('/wallet/connect-external', {
      'address': address,
      'type': type,
    });
  }

  /// Disconnect external wallet.
  static Future<Map<String, dynamic>> disconnectExternalWallet() async {
    return ApiService.delete('/wallet/disconnect-external');
  }

  /// Get connected external wallet info with live balances.
  static Future<Map<String, dynamic>?> getConnectedWallet() async {
    final data = await ApiService.get('/wallet/connected');
    return data['connected'] as Map<String, dynamic>?;
  }

  /// Transfer BNB or vPT to an external address.
  static Future<Map<String, dynamic>> transferToExternal({
    required String asset,
    required double amount,
    required String toAddress,
  }) async {
    return ApiService.post('/wallet/transfer', {
      'asset': asset,
      'amount': amount,
      'to_address': toAddress,
    });
  }
}
