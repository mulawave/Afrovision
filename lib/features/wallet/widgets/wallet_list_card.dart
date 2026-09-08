import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/nocturne_theme.dart';
import 'wallet_toast.dart';

class WalletListItem {
  final String key;
  final String label;
  final String value;
  final String sub;
  final IconData icon;
  final Color tint;
  final Color bg;
  final Color border;
  final String? tag;
  final Color? tagColor;
  final String? address;
  final List<WalletLineItem>? lines;
  final List<WalletAction>? actions;

  const WalletListItem({
    required this.key,
    required this.label,
    required this.value,
    required this.sub,
    required this.icon,
    required this.tint,
    required this.bg,
    required this.border,
    this.tag,
    this.tagColor,
    this.address,
    this.lines,
    this.actions,
  });
}

class WalletLineItem {
  final String label;
  final String value;
  final IconData icon;
  final Color tint;
  final VoidCallback? onTap;

  const WalletLineItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.tint,
    this.onTap,
  });
}

class WalletAction {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const WalletAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });
}

class WalletListCard extends StatelessWidget {
  final List<WalletListItem> items;
  final bool hideBalances;

  const WalletListCard({
    super.key,
    required this.items,
    required this.hideBalances,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: items.map((w) => _WalletCard(item: w, hide: hideBalances)).toList(),
    );
  }
}

class _WalletCard extends StatelessWidget {
  final WalletListItem item;
  final bool hide;

  const _WalletCard({
    required this.item,
    required this.hide,
  });

  @override
  Widget build(BuildContext context) {
    final displayValue = hide ? _mask(item.value) : item.value;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: item.bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: item.border),
      ),
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: item.tint.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                alignment: Alignment.center,
                child: Icon(item.icon, color: item.tint, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          item.label.toUpperCase(),
                          style: TextStyle(
                            color: item.tint,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                        if (item.tag != null)
                          _Tag(label: item.tag!, color: item.tagColor ?? item.tint),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      displayValue,
                      style: const TextStyle(
                        color: Nocturne.text,
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.02,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.sub,
                      style: const TextStyle(
                        color: Nocturne.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (item.address != null && item.address!.isNotEmpty) ...[
            const SizedBox(height: 11),
            _AddressRow(address: item.address!),
          ],
          if (item.lines != null && item.lines!.isNotEmpty) ...[
            const SizedBox(height: 11),
            _LinesList(lines: item.lines!),
          ],
          if (item.actions != null && item.actions!.isNotEmpty) ...[
            const SizedBox(height: 11),
            _ActionRow(actions: item.actions!),
          ],
        ],
      ),
    );
  }

  static String _mask(String v) {
    if (v.startsWith('₦')) return '₦••••';
    if (v.toLowerCase().contains('ravens')) return '•••• Ravens';
    if (v.toLowerCase().contains('vpt')) return '•••• vPT';
    return '••••';
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;

  const _Tag({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.7,
        ),
      ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  final String address;

  const _AddressRow({required this.address});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0x38000000),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: const Color(0x12FFFFFF)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              address,
              style: const TextStyle(
                color: Color(0xFFC3CDE6),
                fontSize: 10.5,
                fontFamily: 'monospace',
                letterSpacing: 0.4,
              ),
            ),
          ),
          const SizedBox(width: 9),
          GestureDetector(
            onTap: () {
              Clipboard.setData(ClipboardData(text: address));
              WalletToast.show(context, 'Wallet address copied');
            },
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: const Color(0x10FFFFFF),
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.copy_rounded,
                  color: Nocturne.goldLight, size: 14),
            ),
          ),
        ],
      ),
    );
  }
}

class _LinesList extends StatelessWidget {
  final List<WalletLineItem> lines;

  const _LinesList({required this.lines});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: lines.map((l) => _LineItem(line: l)).toList(),
    );
  }
}

class _LineItem extends StatelessWidget {
  final WalletLineItem line;

  const _LineItem({required this.line});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: line.onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 7),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0x34000000),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: const Color(0x12FFFFFF)),
        ),
        child: Row(
          children: [
            Icon(line.icon, size: 14, color: line.tint),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                line.label,
                style: const TextStyle(
                  color: Nocturne.textDim,
                  fontSize: 12.5,
                ),
              ),
            ),
            Text(
              line.value,
              style: TextStyle(
                color: line.tint,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final List<WalletAction> actions;

  const _ActionRow({required this.actions});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: actions.map((a) {
        return Expanded(
          child: GestureDetector(
            onTap: a.onTap,
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0x08FFFFFF),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: a.color.withValues(alpha: 0.5)),
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(a.icon, size: 14, color: a.color),
                  const SizedBox(width: 6),
                  Text(
                    a.label,
                    style: TextStyle(
                      color: a.color,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
