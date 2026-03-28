class LedgerEntryModel {
  final String id;
  final String? uid;
  final String type;
  final double amountNgn;
  final double amountVpt;
  final String? txHash;
  final String status;
  final Map<String, dynamic> meta;
  final String? description;
  final int createdAt;

  LedgerEntryModel({
    required this.id,
    this.uid,
    required this.type,
    required this.amountNgn,
    required this.amountVpt,
    this.txHash,
    required this.status,
    required this.meta,
    this.description,
    required this.createdAt,
  });

  factory LedgerEntryModel.fromJson(Map<String, dynamic> json) {
    return LedgerEntryModel(
      id: json['id'] as String? ?? '',
      uid: json['uid'] as String?,
      type: json['type'] as String? ?? '',
      amountNgn: (json['amount_ngn'] as num?)?.toDouble() ?? 0,
      amountVpt: (json['amount_vpt'] as num?)?.toDouble() ?? 0,
      txHash: json['tx_hash'] as String?,
      status: json['status'] as String? ?? 'pending',
      meta: json['meta'] as Map<String, dynamic>? ?? {},
      description: json['description'] as String?,
      createdAt: json['created_at'] as int? ?? 0,
    );
  }

  String get typeLabel {
    switch (type) {
      case 'PLAN_PAYMENT':
        return 'Subscription Payment';
      case 'SPLIT':
        return 'Community Pool Split';
      case 'VPT_QUEUE':
        return 'vPT Reward Queued';
      case 'VPT_SWAP':
        return 'vPT Market Purchase';
      case 'VPT_DISTRIBUTION':
        return 'vPT Distributed';
      case 'WALLET_CREATED':
        return 'Wallet Created';
      case 'SWAP_FAILED':
        return 'Swap Failed';
      case 'DISTRIBUTION_FAILED':
        return 'Distribution Failed';
      default:
        return type;
    }
  }

  String get statusLabel {
    switch (status) {
      case 'success':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  }

  bool get isSuccess => status == 'success';
  bool get isPending => status == 'pending';
  bool get isFailed => status == 'failed';

  bool get isIncome =>
      type == 'VPT_DISTRIBUTION' || type == 'VPT_SWAP';

  bool get isPayment => type == 'PLAN_PAYMENT';

  bool get isSplit => type == 'SPLIT';

  bool get isQueue => type == 'VPT_QUEUE';

  DateTime get dateTime =>
      DateTime.fromMillisecondsSinceEpoch(createdAt);

  String get timeAgo {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
  }
}
