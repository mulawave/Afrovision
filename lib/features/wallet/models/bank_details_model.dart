class BankOptionModel {
  final String name;
  final String code;

  const BankOptionModel({required this.name, required this.code});

  factory BankOptionModel.fromJson(Map<String, dynamic> json) {
    return BankOptionModel(
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
    );
  }
}

class BankDetailsModel {
  final String bankName;
  final String bankCode;
  final String accountName;
  final String accountNumber;
  final String accountNumberMasked;
  final bool locked;
  final int? createdAt;

  const BankDetailsModel({
    required this.bankName,
    required this.bankCode,
    required this.accountName,
    required this.accountNumber,
    required this.accountNumberMasked,
    required this.locked,
    this.createdAt,
  });

  factory BankDetailsModel.fromJson(Map<String, dynamic> json) {
    return BankDetailsModel(
      bankName: json['bank_name'] as String? ?? '',
      bankCode: json['bank_code'] as String? ?? '',
      accountName: json['account_name'] as String? ?? '',
      accountNumber: json['account_number'] as String? ?? '',
      accountNumberMasked: json['account_number_masked'] as String? ?? '',
      locked: json['locked'] as bool? ?? true,
      createdAt: (json['created_at'] as num?)?.toInt(),
    );
  }
}

class ResolvedBankAccountModel {
  final String accountName;
  final String accountNumber;
  final String bankCode;

  const ResolvedBankAccountModel({
    required this.accountName,
    required this.accountNumber,
    required this.bankCode,
  });

  factory ResolvedBankAccountModel.fromJson(Map<String, dynamic> json) {
    return ResolvedBankAccountModel(
      accountName: json['account_name'] as String? ?? '',
      accountNumber: json['account_number'] as String? ?? '',
      bankCode: json['bank_code'] as String? ?? '',
    );
  }
}
