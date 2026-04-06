class LedgerEntryModel {
  final String id;
  final String? uid;
  final String type;
  final String? direction;
  final String? currency;
  final double amountNgn;
  final double amountVpt;
  final int amountVptUnits;
  final double? balanceBefore;
  final double? balanceAfter;
  final String? referenceId;
  final String? channelId;
  final String? txHash;
  final String status;
  final Map<String, dynamic> meta;
  final String? description;
  final int createdAt;

  LedgerEntryModel({
    required this.id,
    this.uid,
    required this.type,
    this.direction,
    this.currency,
    required this.amountNgn,
    required this.amountVpt,
    this.amountVptUnits = 0,
    this.balanceBefore,
    this.balanceAfter,
    this.referenceId,
    this.channelId,
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
      direction: json['direction'] as String?,
      currency: json['currency'] as String?,
      amountNgn: (json['amount_ngn'] as num?)?.toDouble() ?? 0,
      amountVpt: (json['amount_vpt'] as num?)?.toDouble() ?? 0,
      amountVptUnits: (json['amount_vpt_units'] as num?)?.toInt() ?? 0,
      balanceBefore: (json['balance_before'] as num?)?.toDouble(),
      balanceAfter: (json['balance_after'] as num?)?.toDouble(),
      referenceId: json['reference_id'] as String?,
      channelId: json['channel_id'] as String?,
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
      case 'GIFT_SENT_VPT':
        return 'Gift Sent (vPT)';
      case 'GIFT_RECEIVED_VPT':
        return 'Gift Received (vPT)';
      case 'GIFT_SENT_NGN':
        return 'Gift Sent (NGN)';
      case 'GIFT_RECEIVED_NGN':
        return 'Gift Received (NGN)';
      case 'WALLET_FUND':
        return 'Wallet Funded';
      case 'WITHDRAWAL':
        return 'Withdrawal';
      case 'REVERSAL':
        return 'Reversal';
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
      type == 'VPT_DISTRIBUTION' ||
      type == 'VPT_SWAP' ||
      type == 'GIFT_RECEIVED_VPT' ||
      type == 'GIFT_RECEIVED_NGN' ||
      type == 'WALLET_FUND';

  bool get isExpense =>
      type == 'GIFT_SENT_VPT' ||
      type == 'GIFT_SENT_NGN' ||
      type == 'WITHDRAWAL';

  bool get isPayment => type == 'PLAN_PAYMENT';

  bool get isSplit => type == 'SPLIT';

  bool get isQueue => type == 'VPT_QUEUE';

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
