import 'package:flutter/material.dart';
import '../../../core/theme/nocturne_theme.dart';

/// Shared Nocturne header for the Channels surface.
///
/// Left: 36 px rounded back button (defaults to [Navigator.maybePop]).
/// Center: title + subtitle.
/// Right: optional 36 px search / dial / create icon buttons.
class ChannelsHeader extends StatelessWidget {
  const ChannelsHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.onBack,
    this.showSearch = false,
    this.showDial = false,
    this.showCreate = false,
    this.onSearch,
    this.onDial,
    this.onCreate,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onBack;
  final bool showSearch;
  final bool showDial;
  final bool showCreate;
  final VoidCallback? onSearch;
  final VoidCallback? onDial;
  final VoidCallback? onCreate;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: Nocturne.headerGradient),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Row(
        children: [
          _IconButton(
            icon: Icons.arrow_back_ios_new_rounded,
            onTap: onBack ?? () => Navigator.of(context).maybePop(),
            gold: false,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.01,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 10.5,
                  ),
                ),
              ],
            ),
          ),
          if (showSearch) ...[
            const SizedBox(width: 7),
            _IconButton(
              icon: Icons.search_rounded,
              onTap: onSearch,
              gold: false,
            ),
          ],
          if (showDial) ...[
            const SizedBox(width: 7),
            _IconButton(
              icon: Icons.apps_rounded,
              onTap: onDial,
              gold: false,
            ),
          ],
          if (showCreate) ...[
            const SizedBox(width: 7),
            _IconButton(
              icon: Icons.add_rounded,
              onTap: onCreate,
              gold: true,
            ),
          ],
        ],
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({
    required this.icon,
    required this.onTap,
    this.gold = false,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final borderColor = gold ? const Color(0xFF4A3A1A) : Nocturne.borderStrong;
    final bgColor = gold
        ? Nocturne.gold.withValues(alpha: 0.13)
        : Colors.white.withValues(alpha: 0.03);
    final iconColor = gold ? Nocturne.goldLight : Nocturne.textMuted;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: borderColor),
        ),
        child: Icon(icon, color: iconColor, size: 18),
      ),
    );
  }
}
