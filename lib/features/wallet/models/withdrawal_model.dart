class WithdrawalModel {
  final String id;
  final String uid;
  final double amount;
  final String currency;
  final String status;
  final int createdAt;
  final int? processedAt;
  final String? bankName;
  final String? accountName;
  final String? accountNumberMasked;
  final double transactionFee;
  final double serviceCharge;
  final double totalFees;
  final double vatAmount;
  final double vatRate;
  final double totalDebit;

  WithdrawalModel({
    required this.id,
    required this.uid,
    required this.amount,
    required this.currency,
    required this.status,
    required this.createdAt,
    this.processedAt,
    this.bankName,
    this.accountName,
    this.accountNumberMasked,
    this.transactionFee = 0,
    this.serviceCharge = 0,
    this.totalFees = 0,
    this.vatAmount = 0,
    this.vatRate = 0,
    this.totalDebit = 0,
  });

  factory WithdrawalModel.fromJson(Map<String, dynamic> json) {
    return WithdrawalModel(
      id: json['id'] as String? ?? '',
      uid: json['uid'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      currency: json['currency'] as String? ?? 'ngn',
      status: json['status'] as String? ?? 'pending',
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      processedAt: (json['processed_at'] as num?)?.toInt(),
      bankName:
          (json['bank_details'] as Map<String, dynamic>?)?['bank_name']
              as String?,
      accountName:
          (json['bank_details'] as Map<String, dynamic>?)?['account_name']
              as String?,
      accountNumberMasked:
          (json['bank_details']
                  as Map<String, dynamic>?)?['account_number_masked']
              as String?,
      transactionFee: (json['transaction_fee'] as num?)?.toDouble() ?? 0,
      serviceCharge: (json['service_charge'] as num?)?.toDouble() ?? 0,
      totalFees: (json['total_fees'] as num?)?.toDouble() ?? 0,
      vatAmount: (json['vat_amount'] as num?)?.toDouble() ?? 0,
      vatRate: (json['vat_rate'] as num?)?.toDouble() ?? 0,
      totalDebit: (json['total_debit'] as num?)?.toDouble() ?? 0,
    );
  }

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
  bool get isPaid => status == 'paid';

  String get statusLabel {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'paid':
        return 'Paid';
      default:
        return status;
    }
  }

  DateTime get dateTime => DateTime.fromMillisecondsSinceEpoch(createdAt);

  String get timeAgo {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
  }
}
