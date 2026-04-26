import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../services/wallet_service.dart';

/// Bottom sheet for transferring BNB or vPT to/from a connected external wallet.
class TransferSheet extends StatefulWidget {
  final String connectedAddress;
  final String connectedType;
  final Map<String, dynamic>? balances;
  final VoidCallback onTransferred;

  const TransferSheet({
    super.key,
    required this.connectedAddress,
    required this.connectedType,
    this.balances,
    required this.onTransferred,
  });

  @override
  State<TransferSheet> createState() => _TransferSheetState();

  static Future<void> show(
    BuildContext context, {
    required String connectedAddress,
    required String connectedType,
    Map<String, dynamic>? balances,
    required VoidCallback onTransferred,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TransferSheet(
        connectedAddress: connectedAddress,
        connectedType: connectedType,
        balances: balances,
        onTransferred: onTransferred,
      ),
    );
  }
}

class _TransferSheetState extends State<TransferSheet> {
  final _amountCtrl = TextEditingController();
  String _asset = 'vpt';
  String? _error;
  bool _sending = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final amountStr = _amountCtrl.text.trim();
    final amount = double.tryParse(amountStr);
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount greater than 0');
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      final result = await WalletService.transferToExternal(
        asset: _asset,
        amount: amount,
        toAddress: widget.connectedAddress,
      );
      if (!mounted) return;
      setState(() {
        _result = result;
        _sending = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _sending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final vptBal = widget.balances?['vpt'] ?? 0;
    final bnbBal = widget.balances?['bnb_balance'] ?? 0;

    return Container(
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.darkBlue,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: AppColors.successGreen, width: 1),
        ),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.hintText.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),

            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.successGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.swap_horiz_rounded,
                    color: AppColors.successGreen,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Transfer to Wallet',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Send to ${_truncateAddress(widget.connectedAddress)}',
                        style: const TextStyle(
                          color: AppColors.hintText,
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Success state
            if (_result != null) ...[
              _buildSuccessView(),
            ] else ...[
              // Asset selector
              Row(
                children: [
                  _buildAssetChip(
                    'vpt',
                    'vPT',
                    Icons.token_rounded,
                    const Color(0xFFA78BFA),
                  ),
                  const SizedBox(width: 10),
                  _buildAssetChip(
                    'bnb',
                    'BNB',
                    Icons.currency_bitcoin_rounded,
                    AppColors.lightOrange,
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Connected wallet balance
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.inputBorder.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Wallet Balance',
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.7),
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      _asset == 'vpt'
                          ? '${_formatNum(vptBal)} vPT'
                          : '${_formatNum(bnbBal)} BNB',
                      style: const TextStyle(
                        color: AppColors.goldText,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Amount input
              Container(
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _error != null
                        ? AppColors.errorRed.withValues(alpha: 0.5)
                        : AppColors.inputBorder.withValues(alpha: 0.3),
                  ),
                ),
                child: TextField(
                  controller: _amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    hintText: '0.00',
                    hintStyle: TextStyle(
                      color: AppColors.hintText.withValues(alpha: 0.4),
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    suffixText: _asset.toUpperCase(),
                    suffixStyle: const TextStyle(
                      color: AppColors.hintText,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onChanged: (_) {
                    if (_error != null) setState(() => _error = null);
                  },
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      color: AppColors.errorRed,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: AppColors.errorRed,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 10),

              // Warning
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.lightOrange.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppColors.lightOrange.withValues(alpha: 0.15),
                  ),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.warning_amber_rounded,
                      color: AppColors.lightOrange,
                      size: 14,
                    ),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'On-chain transfers are irreversible. Double-check the amount and destination address before confirming.',
                        style: TextStyle(
                          color: AppColors.lightOrange,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              AppButton(
                label: 'Send ${_asset.toUpperCase()}',
                loading: _sending,
                onPressed: _send,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSuccessView() {
    final transfer = _result?['transfer'] as Map<String, dynamic>? ?? _result!;
    final txHash = transfer['tx_hash'] as String? ?? '';
    final amount = transfer['amount'] ?? 0;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.successGreen.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.successGreen.withValues(alpha: 0.25),
            ),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.successGreen.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.successGreen,
                  size: 32,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Transfer Successful',
                style: TextStyle(
                  color: AppColors.successGreen,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '$amount ${_asset.toUpperCase()} sent',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (txHash.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'TX: ${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}',
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppButton(
          label: 'Done',
          onPressed: () {
            widget.onTransferred();
            Navigator.of(context).pop();
          },
        ),
      ],
    );
  }

  Widget _buildAssetChip(
    String asset,
    String label,
    IconData icon,
    Color color,
  ) {
    final selected = _asset == asset;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _asset = asset),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected
                ? color.withValues(alpha: 0.12)
                : AppColors.inputFill,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? color.withValues(alpha: 0.5)
                  : AppColors.inputBorder.withValues(alpha: 0.2),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                color: selected ? color : AppColors.hintText,
                size: 18,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: selected ? color : AppColors.hintText,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _truncateAddress(String addr) {
    if (addr.length <= 14) return addr;
    return '${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}';
  }

  String _formatNum(dynamic value) {
    final d = (value is num) ? value.toDouble() : 0.0;
    if (d == 0) return '0';
    if (d < 0.0001) return d.toStringAsExponential(4);
    if (d == d.truncateToDouble()) return d.toInt().toString();
    return d.toStringAsFixed(4);
  }
}
