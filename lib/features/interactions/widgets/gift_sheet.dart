import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/interaction_models.dart';
import '../services/interaction_service.dart';

class GiftSheet extends StatefulWidget {
  final String channelId;
  final VoidCallback? onGiftSent;

  const GiftSheet({super.key, required this.channelId, this.onGiftSent});

  static Future<Map<String, dynamic>?> show(
    BuildContext context,
    String channelId, {
    VoidCallback? onGiftSent,
  }) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => GiftSheet(channelId: channelId, onGiftSent: onGiftSent),
    );
  }

  @override
  State<GiftSheet> createState() => _GiftSheetState();
}

class _GiftSheetState extends State<GiftSheet> {
  List<GiftModel> _gifts = [];
  GiftWalletModel? _wallet;
  bool _loading = true;
  String? _sendingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        InteractionService.getGifts(),
        InteractionService.getMyGiftWallet(),
      ]);
      if (!mounted) return;
      setState(() {
        _gifts = results[0] as List<GiftModel>;
        _wallet = results[1] as GiftWalletModel;
        _loading = false;
      });
    } catch (e) {
      debugPrint('[GiftSheet] _load error: $e');
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _sendGift(GiftModel gift) async {
    if (_sendingId != null) return;
    setState(() => _sendingId = gift.id);
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final result = await InteractionService.sendGift(
        channelId: widget.channelId,
        giftId: gift.id,
      );
      if (!mounted) return;

      // Refresh wallet so the balance updates instantly
      try {
        final refreshedWallet = await InteractionService.getMyGiftWallet();
        if (mounted) {
          setState(() {
            _wallet = refreshedWallet as GiftWalletModel?;
          });
        }
      } catch (_) {
        // Non-fatal: wallet refresh failure should not block gift success
      }

      if (!mounted) return;
      widget.onGiftSent?.call();
      navigator.pop(result);
    } catch (e) {
      if (!mounted) return;
      setState(() => _sendingId = null);

      messenger.showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceAll('Exception: ', ''),
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.6,
      ),
      decoration: const BoxDecoration(
        color: AppColors.darkBlue,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: AppColors.inputBorder, width: 1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.goldText,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Header with balance
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Text(
                  'SEND A GIFT',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
                const Spacer(),
                if (_wallet != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.cardBg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppColors.inputBorder.withValues(alpha: 0.5),
                      ),
                    ),
                    child: Text(
                      _wallet!.vptLabel,
                      style: const TextStyle(
                        color: AppColors.lightOrange,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Gift grid
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(40),
              child: CircularProgressIndicator(color: AppColors.orange),
            )
          else if (_gifts.isEmpty)
            Padding(
              padding: const EdgeInsets.all(40),
              child: Text(
                'No gifts available',
                style: TextStyle(color: AppColors.goldText, fontSize: 14),
              ),
            )
          else
            Flexible(
              child: GridView.builder(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.85,
                ),
                itemCount: _gifts.length,
                itemBuilder: (_, i) => _buildGiftTile(_gifts[i]),
              ),
            ),

          // Settlement split info
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.cardBg.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.inputBorder.withValues(alpha: 0.3),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.info_outline_rounded,
                        color: AppColors.hintText,
                        size: 14,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Gift Distribution',
                        style: TextStyle(
                          color: AppColors.hintText,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _splitChip('Creator', '50%', AppColors.lightOrange),
                      const SizedBox(width: 6),
                      _splitChip('Operations', '30%', AppColors.softBlue),
                      const SizedBox(width: 6),
                      _splitChip('Community', '20%', AppColors.successGreen),
                    ],
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
        ],
      ),
    );
  }

  Widget _splitChip(String label, String pct, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Text(
              pct,
              style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: AppColors.hintText,
                fontSize: 9,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGiftTile(GiftModel gift) {
    final isSending = _sendingId == gift.id;
    final walletVpt = _wallet?.vpt ?? 0;
    final canAfford = walletVpt >= gift.vptUnits;

    // Tier badge (matches website: ultra ≥500, premium ≥50)
    final tierLabel = gift.currency == 'vpt' && gift.vptUnits >= 500
        ? 'ULTRA'
        : gift.currency == 'vpt' && gift.vptUnits >= 50
        ? 'PREMIUM'
        : null;
    final tierBg = gift.vptUnits >= 500 ? AppColors.errorRed : AppColors.orange;

    // Shrink long emoji strings to prevent overflow
    final iconFontSize = gift.icon.length > 3 ? 20.0 : 28.0;

    return GestureDetector(
      onTap: isSending || !canAfford ? null : () => _sendGift(gift),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isSending
              ? AppColors.orange.withValues(alpha: 0.1)
              : AppColors.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSending
                ? AppColors.orange.withValues(alpha: 0.5)
                : AppColors.inputBorder.withValues(alpha: 0.3),
          ),
        ),
        child: Opacity(
          opacity: canAfford ? 1.0 : 0.35,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (isSending)
                    const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: AppColors.orange,
                        strokeWidth: 2,
                      ),
                    )
                  else
                    Text(gift.icon, style: TextStyle(fontSize: iconFontSize)),
                  const SizedBox(height: 4),
                  Text(
                    gift.name,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    gift.priceLabel,
                    style: TextStyle(
                      color: AppColors.goldText,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              if (tierLabel != null)
                Positioned(
                  top: 4,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: tierBg.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      tierLabel,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 7,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
