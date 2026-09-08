import 'package:flutter/material.dart';
import '../theme/nocturne_theme.dart';

class NocturnePagination extends StatelessWidget {
  final int currentPage;
  final int totalPages;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  const NocturnePagination({
    super.key,
    required this.currentPage,
    required this.totalPages,
    this.onPrevious,
    this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    if (totalPages <= 1) return const SizedBox.shrink();

    final canPrev = currentPage > 0;
    final canNext = currentPage < totalPages - 1;

    return Row(
      children: [
        Expanded(
          flex: 10,
          child: _PageButton(
            label: 'Previous',
            enabled: canPrev,
            onTap: onPrevious,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          flex: 11,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0x06FFFFFF),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: Nocturne.border),
            ),
            alignment: Alignment.center,
            child: Text(
              'Page ${currentPage + 1} of $totalPages',
              style: const TextStyle(
                color: Nocturne.textDim,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          flex: 10,
          child: _NextButton(
            enabled: canNext,
            onTap: onNext,
          ),
        ),
      ],
    );
  }
}

class _PageButton extends StatelessWidget {
  final String label;
  final bool enabled;
  final VoidCallback? onTap;

  const _PageButton({
    required this.label,
    required this.enabled,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0x06FFFFFF),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: enabled ? Nocturne.border : Nocturne.borderMuted,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: enabled ? Nocturne.textDim : Nocturne.textHint,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _NextButton extends StatelessWidget {
  final bool enabled;
  final VoidCallback? onTap;

  const _NextButton({required this.enabled, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          gradient: enabled ? Nocturne.goldCta : null,
          color: enabled ? null : const Color(0x06FFFFFF),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: enabled ? Colors.transparent : Nocturne.borderMuted,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          'Next',
          style: TextStyle(
            color: enabled ? const Color(0xFF26170A) : Nocturne.textHint,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
