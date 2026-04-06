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
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _sendGift(GiftModel gift) async {
    if (_sendingId != null) return;
    setState(() => _sendingId = gift.id);

    try {
      final result = await InteractionService.sendGift(
        channelId: widget.channelId,
        giftId: gift.id,
      );
      if (!mounted) return;

      widget.onGiftSent?.call();
      Navigator.pop(context, result);
    } catch (e) {
      if (!mounted) return;
      setState(() => _sendingId = null);

      ScaffoldMessenger.of(context).showSnackBar(
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
              color: AppColors.hintText.withValues(alpha: 0.4),
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
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.7),
                  fontSize: 14,
                ),
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
                  childAspectRatio: 0.75,
                ),
                itemCount: _gifts.length,
                itemBuilder: (_, i) => _buildGiftTile(_gifts[i]),
              ),
            ),

          SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
        ],
      ),
    );
  }

  Widget _buildGiftTile(GiftModel gift) {
    final isSending = _sendingId == gift.id;

    return GestureDetector(
      onTap: isSending ? null : () => _sendGift(gift),
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
        child: Column(
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
              Text(gift.icon, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: 6),
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
                color: AppColors.hintText.withValues(alpha: 0.8),
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
