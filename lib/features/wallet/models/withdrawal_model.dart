class WithdrawalModel {
  final String id;
  final String uid;
  final double amount;
  final String currency;
  final String status;
  final int createdAt;
  final int? processedAt;

  WithdrawalModel({
    required this.id,
    required this.uid,
    required this.amount,
    required this.currency,
    required this.status,
    required this.createdAt,
    this.processedAt,
  });

  factory WithdrawalModel.fromJson(Map<String, dynamic> json) {
    return WithdrawalModel(
      id: json['id'] as String? ?? '',
      uid: json['uid'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      currency: json['currency'] as String? ?? 'ngn',
      status: json['status'] as String? ?? 'pending',
      createdAt: json['created_at'] as int? ?? 0,
      processedAt: json['processed_at'] as int?,
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
