import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../services/wallet_service.dart';

/// Bottom sheet for importing an external BSC wallet address.
/// Validates the address, scans BSC for vPT balance, and shows results.
class ImportWalletSheet extends StatefulWidget {
  final VoidCallback onImported;

  const ImportWalletSheet({super.key, required this.onImported});

  @override
  State<ImportWalletSheet> createState() => _ImportWalletSheetState();

  static Future<void> show(
    BuildContext context, {
    required VoidCallback onImported,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ImportWalletSheet(onImported: onImported),
    );
  }
}

class _ImportWalletSheetState extends State<ImportWalletSheet> {
  final _controller = TextEditingController();
  String? _error;
  bool _scanning = false;
  bool _importing = false;
  Map<String, dynamic>? _scanResult;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool _isValidBscAddress(String addr) {
    return RegExp(r'^0x[0-9a-fA-F]{40}$').hasMatch(addr.trim());
  }

  Future<void> _scanAddress() async {
    final address = _controller.text.trim();
    if (!_isValidBscAddress(address)) {
      setState(() => _error = 'Enter a valid BSC address (0x...)');
      return;
    }

    setState(() {
      _scanning = true;
      _error = null;
      _scanResult = null;
    });

    try {
      final result = await WalletService.scanBalance(address);
      if (!mounted) return;
      setState(() {
        _scanResult = result;
        _scanning = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _scanning = false;
      });
    }
  }

  Future<void> _confirmImport() async {
    final address = _controller.text.trim();
    setState(() {
      _importing = true;
      _error = null;
    });

    try {
      await WalletService.importAddress(address);
      if (!mounted) return;
      widget.onImported();
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _importing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.darkBlue,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: Color(0xFF8B5CF6), width: 1)),
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
                    color: const Color(0xFF7C3AED).withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.link_rounded,
                    color: Color(0xFFA78BFA),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Import Wallet Address',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Enter the BSC address that holds your vPT',
                        style: TextStyle(
                          color: AppColors.hintText,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Address input
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
                controller: _controller,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 13,
                  fontFamily: 'monospace',
                ),
                decoration: InputDecoration(
                  hintText: '0x...',
                  hintStyle: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.5),
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  suffixIcon: IconButton(
                    icon: const Icon(
                      Icons.paste_rounded,
                      color: AppColors.hintText,
                      size: 18,
                    ),
                    onPressed: () async {
                      final data = await Clipboard.getData('text/plain');
                      if (data?.text != null) {
                        _controller.text = data!.text!.trim();
                      }
                    },
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

            const SizedBox(height: 16),

            // Scan button (if no result yet)
            if (_scanResult == null)
              AppButton(
                label: 'Scan Wallet',
                loading: _scanning,
                onPressed: _scanAddress,
              ),

            // Scan results
            if (_scanResult != null) ...[
              _buildScanResults(),
              const SizedBox(height: 16),
              AppButton(
                label: 'Confirm & Import',
                loading: _importing,
                onPressed: _confirmImport,
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  setState(() => _scanResult = null);
                },
                child: const Text(
                  'Scan Different Address',
                  style: TextStyle(color: AppColors.hintText, fontSize: 13),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildScanResults() {
    final vptBalance = _scanResult?['vpt'] ?? 0;
    final bnbBalance = _scanResult?['bnb_balance'] ?? 0;
    final tokenConfigured = _scanResult?['token_configured'] == true;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF7C3AED).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.check_circle_rounded,
                color: AppColors.successGreen,
                size: 16,
              ),
              SizedBox(width: 8),
              Text(
                'On-Chain Balances Found',
                style: TextStyle(
                  color: AppColors.successGreen,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildBalanceRow(
            'vPT Balance',
            '${_formatNumber(vptBalance)} vPT',
            const Color(0xFFA78BFA),
            tokenConfigured ? null : 'Token contract not yet configured',
          ),
          const SizedBox(height: 10),
          _buildBalanceRow(
            'BNB Balance',
            '${_formatNumber(bnbBalance)} BNB',
            AppColors.lightOrange,
            null,
          ),
          if (!tokenConfigured) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.lightOrange.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.lightOrange,
                    size: 12,
                  ),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'vPT token contract is not yet deployed. Your BNB balance was detected. vPT balance will appear once the contract is live.',
                      style: TextStyle(
                        color: AppColors.lightOrange,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBalanceRow(
    String label,
    String value,
    Color color,
    String? note,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                color: color.withValues(alpha: 0.7),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (note != null)
              Text(
                note,
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.6),
                  fontSize: 10,
                ),
              ),
          ],
        ),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }

  String _formatNumber(dynamic value) {
    final d = (value is num) ? value.toDouble() : 0.0;
    if (d == 0) return '0';
    if (d < 0.0001) return d.toStringAsExponential(4);
    if (d == d.truncateToDouble()) return d.toInt().toString();
    return d.toStringAsFixed(4);
  }
}
