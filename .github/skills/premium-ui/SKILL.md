---
name: premium-ui
description: "Build sophisticated, royal-level premium Flutter UI/UX components, cards, screens, layouts, and design structures for AfroVision. Use when: creating new screens, cards, widgets, list items, dialogs, bottom sheets, stat displays, subscription cards, channel tiles, profile sections, dashboards, or any visual component. Produces dark futuristic premium-styled Flutter widgets following AfroVision's brand system."
argument-hint: 'Describe the component, card, screen, or layout you need'
---

# Premium UI/UX Component Builder

Build world-class, royal-level premium Flutter components that match AfroVision's dark futuristic visual identity. Every output must feel like a luxury digital product — polished, animated, consistent, and brand-aligned.

## When to Use

- Creating any new screen, page, or route
- Building cards: info cards, stat cards, subscription cards, channel tiles, profile cards, pricing cards
- Designing list items, grid tiles, or collection views
- Creating dialogs, bottom sheets, snackbars, or overlays
- Building dashboard sections, stat displays, or summary widgets
- Designing any interactive UI element (toggles, selectors, sliders)
- Refactoring existing screens for premium consistency

## Mandatory Design Rules

**NEVER violate these — they are the law of the codebase.**

1. **Background Gradient**: Every screen MUST wrap content in `AppColors.primaryGradient` (lightBlue → darkBlue, top → bottom)
2. **Brand Colors Only**: Import and use exclusively from `lib/core/theme/app_colors.dart` — NEVER hardcode hex values
3. **Reusable Widgets First**: Use `AppButton`, `AppTextField`, `AppLogo`, `PasswordStrengthIndicator`, `RoleBadge` from `lib/core/widgets/` before building custom
4. **New shared widgets** go in `lib/core/widgets/` when a pattern repeats across 2+ screens
5. **Feature widgets** go in `lib/features/<domain>/widgets/` when scoped to one feature

## Design Token Reference

Load [design tokens](./references/design-tokens.md) for the full color palette, gradients, spacing, typography, border radius, and shadow specifications.

## Component Pattern Reference

Load [component patterns](./references/component-patterns.md) for reusable code patterns: cards, containers, animations, badges, error banners, dividers, and layout structures.

## Procedure

### Step 1: Determine Component Type & Placement

| Type | Location | Example |
|------|----------|---------|
| Shared reusable widget | `lib/core/widgets/` | `AppCard`, `StatTile`, `PremiumBadge` |
| Feature-specific widget | `lib/features/<domain>/widgets/` | `ChannelTile`, `PlanCard` |
| Full screen | `lib/features/<domain>/screens/` | `DashboardScreen`, `SettingsScreen` |
| Dialog/Sheet | `lib/features/<domain>/widgets/` or inline | `ConfirmDialog`, `FilterSheet` |

### Step 2: Apply Screen Scaffold (for full screens)

Every screen MUST follow this exact scaffold pattern:

```dart
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class ExampleScreen extends StatefulWidget {
  const ExampleScreen({super.key});
  @override
  State<ExampleScreen> createState() => _ExampleScreenState();
}

class _ExampleScreenState extends State<ExampleScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut),
    );
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeIn,
            child: SlideTransition(
              position: _slideUp,
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
                child: Column(
                  children: [
                    // Screen content here
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

### Step 3: Apply Card/Container Styling

Every card or container component MUST use these styling layers:

```dart
Container(
  padding: const EdgeInsets.all(20),
  decoration: BoxDecoration(
    color: AppColors.cardBg,                        // Dark card background
    borderRadius: BorderRadius.circular(16),        // 12–20px range
    border: Border.all(
      color: AppColors.inputBorder.withValues(alpha: 0.3),  // Subtle border
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.3),  // Depth shadow
        blurRadius: 16,
        offset: const Offset(0, 6),
      ),
      BoxShadow(
        color: AppColors.orange.withValues(alpha: 0.06),  // Subtle orange glow
        blurRadius: 20,
        spreadRadius: 0,
      ),
    ],
  ),
  child: /* content */,
)
```

### Step 4: Apply Typography Hierarchy

| Role | Size | Weight | Color | Letter Spacing |
|------|------|--------|-------|----------------|
| Hero / Title | 22–28px | w700–w800 | `AppColors.white` | 0.5–4px |
| Section Header | 16–18px | w600–w700 | `AppColors.white` | 0.3–1px |
| Body Text | 14–15px | w500 | `AppColors.white` | 0–0.2px |
| Label / Caption | 11–13px | w600 | `AppColors.lightOrange` | 0.5–1.2px |
| Hint / Muted | 12–13px | w400 | `AppColors.hintText` | 0.2px |
| Error | 12–13px | w500 | `AppColors.errorRed` | 0px |

### Step 5: Apply Animations

**Entry animations** (screens and major sections):
- `FadeTransition` + `SlideTransition` — 800ms, `Curves.easeOutCubic`
- Slide offset: `Offset(0, 0.15)` → `Offset.zero`

**State transitions** (interactive elements):
- `AnimatedContainer` — 200ms for border, shadow, color changes
- `AnimatedSwitcher` — 250ms for element replacements
- `AnimatedSize` — 400ms, `Curves.easeInOut` for expand/collapse
- `AnimatedDefaultTextStyle` — 300ms for text property changes

**Feedback animations** (buttons, taps):
- `InkWell` with `splashColor: AppColors.white.withValues(alpha: 0.1)`
- Buttons: orange glow shadow on active, no shadow on disabled

### Step 6: Apply Interactive States

Every interactive component MUST have distinct visual states:

| State | Border | Shadow | Gradient/Color |
|-------|--------|--------|----------------|
| Default | `inputBorder` | None or subtle | `cardBg` |
| Focused | `inputFocusBorder` (orange) | Orange glow (`alpha: 0.15`) | `cardBg` |
| Active/Selected | Orange | Orange glow (`alpha: 0.35`) | `buttonGradient` |
| Disabled | Muted | None | `buttonDisabledGradient` |
| Error | `errorRed` | Red glow (`alpha: 0.12`) | Red-tinted bg |
| Loading | Same as active | Same as active | Spinner replaces content |

### Step 7: Validate Premium Quality

Before finishing, verify:
- [ ] Uses `AppColors.primaryGradient` as background (screens) or `AppColors.cardBg` (cards)
- [ ] All colors from `AppColors` — zero hardcoded hex values
- [ ] Entry animation present (fade + slide-up for screens)
- [ ] Interactive states styled (focus, active, disabled, error)
- [ ] Typography follows the hierarchy table
- [ ] Border radius 12–20px consistently
- [ ] Box shadows use multi-layer pattern (depth + glow)
- [ ] Padding is generous (16–28px) for premium spacing
- [ ] `const` constructors used where possible
- [ ] Widget is responsive (uses `MediaQuery` or flexible layouts where needed)
- [ ] Matches the sophistication of existing auth screens
