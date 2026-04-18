import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../services/wallet_service.dart';

/// Bottom sheet for connecting an external wallet (MetaMask, Trust Wallet, etc).
class ConnectWalletSheet extends StatefulWidget {
  final VoidCallback onConnected;

  const ConnectWalletSheet({super.key, required this.onConnected});

  @override
  State<ConnectWalletSheet> createState() => _ConnectWalletSheetState();

  static Future<void> show(
    BuildContext context, {
    required VoidCallback onConnected,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ConnectWalletSheet(onConnected: onConnected),
    );
  }
}

class _ConnectWalletSheetState extends State<ConnectWalletSheet> {
  final _controller = TextEditingController();
  String _selectedType = 'metamask';
  String? _error;
  bool _connecting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool _isValidBscAddress(String addr) {
    return RegExp(r'^0x[0-9a-fA-F]{40}$').hasMatch(addr.trim());
  }

  Future<void> _connectWallet() async {
    final address = _controller.text.trim();
    if (!_isValidBscAddress(address)) {
      setState(() => _error = 'Enter a valid BSC address (0x...)');
      return;
    }

    setState(() {
      _connecting = true;
      _error = null;
    });

    try {
      await WalletService.connectExternalWallet(
        address: address,
        type: _selectedType,
      );
      if (!mounted) return;
      widget.onConnected();
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _connecting = false;
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
        border: Border(top: BorderSide(color: AppColors.orange, width: 1)),
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
                    color: AppColors.orange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.account_balance_wallet_rounded,
                    color: AppColors.orange,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Connect External Wallet',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Link your MetaMask, Trust Wallet, or any BSC wallet',
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

            // Wallet type selector
            Row(
              children: [
                _buildTypeChip('metamask', 'MetaMask', Icons.hexagon_rounded),
                const SizedBox(width: 8),
                _buildTypeChip(
                  'trust_wallet',
                  'Trust Wallet',
                  Icons.shield_rounded,
                ),
                const SizedBox(width: 8),
                _buildTypeChip('manual', 'Other', Icons.wallet_rounded),
              ],
            ),
            const SizedBox(height: 16),

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
                  hintText: 'Paste your wallet address (0x...)',
                  hintStyle: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.5),
                    fontSize: 12,
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

            const SizedBox(height: 12),

            // Info box
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.softBlue.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.softBlue.withValues(alpha: 0.15),
                ),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.softBlue,
                    size: 14,
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'All on-chain transactions (BNB and vPT) will use this connected wallet. You can disconnect at any time.',
                      style: TextStyle(color: AppColors.softBlue, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            AppButton(
              label: 'Connect Wallet',
              loading: _connecting,
              onPressed: _connectWallet,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeChip(String type, String label, IconData icon) {
    final selected = _selectedType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedType = type),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.12)
                : AppColors.inputFill,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? AppColors.orange.withValues(alpha: 0.5)
                  : AppColors.inputBorder.withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: selected ? AppColors.orange : AppColors.hintText,
                size: 18,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: selected ? AppColors.orange : AppColors.hintText,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
