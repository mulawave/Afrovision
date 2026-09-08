import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';

class WalletToast {
  static void show(BuildContext context, String message) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.info_rounded, color: Nocturne.goldLight, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Nocturne.textDim,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: Nocturne.surfaceInset,
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 94),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Nocturne.borderStrong),
        ),
        duration: const Duration(milliseconds: 2500),
      ),
    );
  }
}
