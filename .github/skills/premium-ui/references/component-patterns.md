# AfroVision Component Patterns

Reusable code patterns extracted from the existing codebase. Copy and adapt these — never build from scratch when a pattern exists.

## 1. Screen Scaffold with Entry Animation

The canonical screen wrapper. ALL screens use this exact pattern.

```dart
class _ScreenState extends State<Screen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut),
    );
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15), end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _animCtrl.forward();
  }

  @override
  void dispose() { _animCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity, height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeIn,
            child: SlideTransition(
              position: _slideUp,
              child: /* content */,
            ),
          ),
        ),
      ),
    );
  }
}
```

## 2. Premium Card

Standard elevated card for content sections.

```dart
Container(
  padding: const EdgeInsets.all(20),
  decoration: BoxDecoration(
    color: AppColors.cardBg,
    borderRadius: BorderRadius.circular(16),
    border: Border.all(
      color: AppColors.inputBorder.withValues(alpha: 0.3),
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.3),
        blurRadius: 16,
        offset: const Offset(0, 6),
      ),
      BoxShadow(
        color: AppColors.orange.withValues(alpha: 0.06),
        blurRadius: 20,
        spreadRadius: 0,
      ),
    ],
  ),
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      // Card header
      Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.star_rounded, color: AppColors.orange, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Card Title', style: TextStyle(
                  color: AppColors.white, fontSize: 16, fontWeight: FontWeight.w700,
                )),
                const SizedBox(height: 2),
                Text('Subtitle text', style: TextStyle(
                  color: AppColors.hintText, fontSize: 13, fontWeight: FontWeight.w400,
                )),
              ],
            ),
          ),
        ],
      ),
      // Card body content follows
    ],
  ),
)
```

## 3. Accent-Highlighted Card (Selected/Featured)

Card with orange accent border and stronger glow.

```dart
Container(
  padding: const EdgeInsets.all(20),
  decoration: BoxDecoration(
    color: AppColors.cardBg,
    borderRadius: BorderRadius.circular(16),
    border: Border.all(
      color: AppColors.orange.withValues(alpha: 0.4),
      width: 1.5,
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.3),
        blurRadius: 16,
        offset: const Offset(0, 6),
      ),
      BoxShadow(
        color: AppColors.orange.withValues(alpha: 0.15),
        blurRadius: 24,
        spreadRadius: 0,
      ),
    ],
  ),
  child: /* content */,
)
```

## 4. Stat Tile (Two-Column Grid)

For stats, quick-info displays, key-value pairs.

```dart
Row(
  children: [
    Expanded(child: _statTile(Icons.visibility_rounded, '12.5K', 'Views')),
    const SizedBox(width: 14),
    Expanded(child: _statTile(Icons.people_rounded, '3.2K', 'Subscribers')),
  ],
)

Widget _statTile(IconData icon, String value, String label) {
  return Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.cardBg,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
    ),
    child: Column(
      children: [
        Icon(icon, color: AppColors.orange, size: 24),
        const SizedBox(height: 10),
        Text(value, style: const TextStyle(
          color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700,
        )),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(
          color: AppColors.hintText, fontSize: 12, fontWeight: FontWeight.w500,
        )),
      ],
    ),
  );
}
```

## 5. Status Badge / Pill

Colored label with icon for status, roles, tags.

```dart
Container(
  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
  decoration: BoxDecoration(
    color: accentColor.withValues(alpha: 0.15),
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: accentColor.withValues(alpha: 0.4)),
  ),
  child: Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, color: accentColor, size: 14),
      const SizedBox(width: 5),
      Text(label, style: TextStyle(
        color: accentColor, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.5,
      )),
    ],
  ),
)
```

## 6. Error Banner

Inline error display with icon — use inside forms and content areas.

```dart
if (errorMessage != null)
  Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 20),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      color: AppColors.errorRed.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
    ),
    child: Row(
      children: [
        const Icon(Icons.error_outline, color: AppColors.errorRed, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Text(errorMessage!, style: const TextStyle(
            color: AppColors.errorRed, fontSize: 13, fontWeight: FontWeight.w500,
          )),
        ),
      ],
    ),
  ),
```

## 7. Section Divider with Label

"OR" style divider between sections.

```dart
Row(
  children: [
    Expanded(child: Container(height: 1, color: AppColors.inputBorder)),
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Text('OR', style: TextStyle(
        color: AppColors.hintText.withValues(alpha: 0.7),
        fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1.5,
      )),
    ),
    Expanded(child: Container(height: 1, color: AppColors.inputBorder)),
  ],
)
```

## 8. Icon Container (Decorative)

Rounded icon box used in card headers, list leading widgets.

```dart
Container(
  padding: const EdgeInsets.all(10),
  decoration: BoxDecoration(
    color: AppColors.orange.withValues(alpha: 0.15),
    borderRadius: BorderRadius.circular(12),
  ),
  child: Icon(Icons.rocket_launch_rounded, color: AppColors.orange, size: 22),
)
```

### Variant: Circular with Glow

```dart
Container(
  width: 48,
  height: 48,
  decoration: BoxDecoration(
    shape: BoxShape.circle,
    color: AppColors.orange.withValues(alpha: 0.15),
    boxShadow: [
      BoxShadow(
        color: AppColors.orange.withValues(alpha: 0.25),
        blurRadius: 16,
        spreadRadius: 1,
      ),
    ],
  ),
  child: Icon(Icons.diamond_rounded, color: AppColors.orange, size: 24),
)
```

## 9. Avatar with Gradient Border

Circle avatar with premium glow effect.

```dart
Container(
  decoration: BoxDecoration(
    shape: BoxShape.circle,
    border: Border.all(color: AppColors.orange.withValues(alpha: 0.4), width: 2),
    boxShadow: [
      BoxShadow(
        color: AppColors.orange.withValues(alpha: 0.25),
        blurRadius: 20,
        spreadRadius: 2,
      ),
    ],
  ),
  child: CircleAvatar(
    radius: 40,
    backgroundColor: AppColors.cardBg,
    child: Text('AV', style: TextStyle(
      color: AppColors.orange, fontSize: 24, fontWeight: FontWeight.w700,
    )),
  ),
)
```

## 10. Interactive List Item

Tappable row item with chevron — for settings, menus, navigation.

```dart
InkWell(
  onTap: onTap,
  borderRadius: BorderRadius.circular(14),
  splashColor: AppColors.white.withValues(alpha: 0.1),
  child: Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    decoration: BoxDecoration(
      color: AppColors.cardBg,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
    ),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.orange.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.orange, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Text(title, style: const TextStyle(
            color: AppColors.white, fontSize: 15, fontWeight: FontWeight.w600,
          )),
        ),
        Icon(Icons.chevron_right_rounded, color: AppColors.hintText, size: 22),
      ],
    ),
  ),
)
```

## 11. Bottom Sheet

Premium styled modal bottom sheet.

```dart
showModalBottomSheet(
  context: context,
  backgroundColor: Colors.transparent,
  isScrollControlled: true,
  builder: (_) => Container(
    padding: const EdgeInsets.fromLTRB(28, 16, 28, 32),
    decoration: const BoxDecoration(
      color: AppColors.cardBg,
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      border: Border(
        top: BorderSide(color: AppColors.inputBorder, width: 1),
        left: BorderSide(color: AppColors.inputBorder, width: 1),
        right: BorderSide(color: AppColors.inputBorder, width: 1),
      ),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Drag handle
        Container(
          width: 40, height: 4,
          decoration: BoxDecoration(
            color: AppColors.hintText.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(height: 24),
        // Sheet content
      ],
    ),
  ),
);
```

## 12. Confirmation Dialog

Premium styled alert dialog.

```dart
showDialog(
  context: context,
  builder: (_) => Dialog(
    backgroundColor: AppColors.cardBg,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(color: AppColors.inputBorder.withValues(alpha: 0.3)),
    ),
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon container at top
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.warning_amber_rounded, color: AppColors.orange, size: 32),
          ),
          const SizedBox(height: 20),
          Text('Dialog Title', style: TextStyle(
            color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w700,
          )),
          const SizedBox(height: 10),
          Text('Dialog message goes here.', textAlign: TextAlign.center, style: TextStyle(
            color: AppColors.hintText, fontSize: 14, fontWeight: FontWeight.w400,
          )),
          const SizedBox(height: 28),
          // Action buttons row
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: AppColors.inputBorder),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text('Cancel', style: TextStyle(
                    color: AppColors.hintText, fontWeight: FontWeight.w600,
                  )),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(child: AppButton(label: 'Confirm', onPressed: onConfirm)),
            ],
          ),
        ],
      ),
    ),
  ),
);
```

## 13. Empty State

Placeholder for screens/sections with no data.

```dart
Center(
  child: Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.orange.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(Icons.inbox_rounded, color: AppColors.orange.withValues(alpha: 0.6), size: 48),
      ),
      const SizedBox(height: 20),
      Text('No Items Yet', style: TextStyle(
        color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600,
      )),
      const SizedBox(height: 8),
      Text('Items will appear here once added.', style: TextStyle(
        color: AppColors.hintText, fontSize: 14, fontWeight: FontWeight.w400,
      )),
    ],
  ),
)
```

## 14. Loading Spinner (Inline)

Consistent loading indicator.

```dart
Center(
  child: SizedBox(
    width: 24, height: 24,
    child: CircularProgressIndicator(
      strokeWidth: 2,
      valueColor: AlwaysStoppedAnimation<Color>(AppColors.lightOrange),
    ),
  ),
)
```

## 15. Section Header with Action

Header row with title and optional trailing action link.

```dart
Row(
  mainAxisAlignment: MainAxisAlignment.spaceBetween,
  children: [
    Text('Section Title', style: const TextStyle(
      color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: 0.3,
    )),
    GestureDetector(
      onTap: onSeeAll,
      child: Text('See All', style: TextStyle(
        color: AppColors.orange, fontSize: 13, fontWeight: FontWeight.w600,
      )),
    ),
  ],
)
```
