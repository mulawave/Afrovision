// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI/UX TEMPLATE KIT — TEXT FIELD
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/color_engine.dart';

/// A premium text field with animated focus glow, error state, and
/// optional prefix/suffix icons.
class PremiumTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String? hint;
  final bool obscureText;
  final TextInputType keyboardType;
  final IconData? prefixIcon;
  final Widget? suffixWidget;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final int maxLines;
  final bool enabled;

  const PremiumTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.prefixIcon,
    this.suffixWidget,
    this.errorText,
    this.onChanged,
    this.maxLines = 1,
    this.enabled = true,
  });

  @override
  State<PremiumTextField> createState() => _PremiumTextFieldState();
}

class _PremiumTextFieldState extends State<PremiumTextField> {
  bool _obscured = true;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final c = PremiumTheme.colors;
    final d = PremiumTheme.decorations;
    final ts = PremiumTheme.textStyles;
    final isPassword = widget.obscureText;
    final showText = isPassword ? _obscured : false;

    BoxDecoration decoration;
    if (widget.errorText != null) {
      decoration = d.inputError;
    } else if (_focused) {
      decoration = d.inputFocused;
    } else {
      decoration = d.inputDefault;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: ts.inputLabel),
        const SizedBox(height: 8),
        Focus(
          onFocusChange: (hasFocus) => setState(() => _focused = hasFocus),
          child: AnimatedContainer(
            duration: PremiumTheme.animations.stateTransition,
            decoration: decoration,
            child: TextField(
              controller: widget.controller,
              obscureText: showText,
              keyboardType: widget.keyboardType,
              onChanged: widget.onChanged,
              maxLines: widget.maxLines,
              enabled: widget.enabled,
              style: ts.inputText,
              cursorColor: c.accent,
              decoration: InputDecoration(
                hintText: widget.hint ?? widget.label,
                hintStyle: ts.inputHint,
                prefixIcon: widget.prefixIcon != null
                    ? Icon(
                        widget.prefixIcon,
                        color: _focused ? c.accent : c.textHint,
                        size: 20,
                      )
                    : null,
                suffixIcon:
                    widget.suffixWidget ??
                    (isPassword
                        ? GestureDetector(
                            onTap: () => setState(() => _obscured = !_obscured),
                            child: Icon(
                              _obscured
                                  ? Icons.visibility_off_rounded
                                  : Icons.visibility_rounded,
                              color: _focused ? c.accent : c.textHint,
                              size: 20,
                            ),
                          )
                        : null),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
              ),
            ),
          ),
        ),
        if (widget.errorText != null) ...[
          const SizedBox(height: 6),
          Text(widget.errorText!, style: ts.errorText),
        ],
      ],
    );
  }
}
