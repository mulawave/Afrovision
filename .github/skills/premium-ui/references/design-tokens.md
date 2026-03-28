# AfroVision Design Tokens

Complete reference of every design token used in the AfroVision Flutter app. **All values come from `lib/core/theme/app_colors.dart` — never hardcode.**

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `AppColors.darkBlue` | `#050A30` | Primary background, deepest tone |
| `AppColors.lightBlue` | `#173A6D` | Gradient top, secondary background |
| `AppColors.lightOrange` | `#F5C16C` | Labels, tags, secondary accent |
| `AppColors.orange` | `#F49617` | Primary accent, CTA, links, focus states |
| `AppColors.white` | `#FFFFFF` | Primary text, icons on dark |
| `AppColors.inputFill` | `#0D1442` | Input field background |
| `AppColors.inputBorder` | `#1E2A5A` | Default borders, dividers |
| `AppColors.inputFocusBorder` | `#F49617` | Focused input border (same as orange) |
| `AppColors.hintText` | `#5A6190` | Placeholder text, muted labels |
| `AppColors.errorRed` | `#FF4D6A` | Errors, destructive actions |
| `AppColors.cardBg` | `#0A1040` | Card/container background |

### Supplementary Colors (used in specific widgets)

| Value | Usage |
|-------|-------|
| `Color(0xFF00E676)` | Success green (password strength "superb", checkmarks) |
| `Color(0xFFFF4D4D)` | Weak indicator red |
| `Color(0xFFFFD700)` | Strong indicator gold |
| `Color(0xFF4CAF50)` | Creator badge green |
| `Color(0xFF3A3A5C)` | Disabled button start |
| `Color(0xFF2A2A4C)` | Disabled button end |

## Gradients

### Primary Gradient (Screen Background)
```dart
AppColors.primaryGradient  // LinearGradient
// lightBlue (#173A6D) → darkBlue (#050A30)
// Alignment.topCenter → Alignment.bottomCenter
```

### Button Gradient (Active CTA)
```dart
AppColors.buttonGradient  // LinearGradient
// orange (#F49617) → lightOrange (#F5C16C)
// Alignment.centerLeft → Alignment.centerRight
```

### Button Disabled Gradient
```dart
AppColors.buttonDisabledGradient  // LinearGradient
// #3A3A5C → #2A2A4C
// Alignment.centerLeft → Alignment.centerRight
```

## Spacing Scale

| Context | Value | Usage |
|---------|-------|-------|
| Screen horizontal padding | 28px | `EdgeInsets.symmetric(horizontal: 28)` |
| Screen vertical padding | 24px | `EdgeInsets.symmetric(vertical: 24)` |
| Card internal padding | 16–20px | `EdgeInsets.all(20)` |
| Section gap (large) | 32–40px | Between major sections |
| Field gap | 20px | Between form fields |
| Label-to-field gap | 8px | Label above input |
| Inner element gap (small) | 6–10px | Icon to text, row items |
| Tight gap | 4–5px | Badge padding, indicator spacing |

## Border Radius

| Component | Radius |
|-----------|--------|
| Cards, containers | 16px (standard) |
| Input fields | 14px |
| Buttons | 14px |
| Badges, pills | 20px |
| Small elements | 12px |
| Strength bars | 2px |

## Shadows

### Depth Shadow (cards, elevated elements)
```dart
BoxShadow(
  color: Colors.black.withValues(alpha: 0.3),
  blurRadius: 16,
  offset: const Offset(0, 6),
)
```

### Orange Glow (active buttons, focused inputs, accent cards)
```dart
BoxShadow(
  color: AppColors.orange.withValues(alpha: 0.35),  // buttons: 0.35, fields: 0.15, subtle: 0.06
  blurRadius: 16,  // buttons: 16, fields: 12, subtle: 20
  offset: const Offset(0, 6),  // buttons only; fields: Offset.zero
)
```

### Logo Glow
```dart
BoxShadow(
  color: AppColors.orange.withValues(alpha: 0.25),
  blurRadius: 24,
  spreadRadius: 2,
)
```

## Typography

### Font Family
`'SF Pro Display'` — set globally in `MaterialApp.theme.fontFamily`

### Text Styles by Role

| Role | Size | Weight | Color | Spacing | Example |
|------|------|--------|-------|---------|---------|
| Brand name | 28px | w800 | white | 4px | "AFROVISION" |
| Screen title | 22px | w700 | white | 0.5px | "Create Account" |
| Section header | 16–18px | w600–w700 | white | 0.3–1px | "Account Settings" |
| Body | 14–15px | w500 | white | 0–0.2px | Content paragraphs |
| Tagline | 13px | w600 | orange | 2px | "Africa's Digital Playground" |
| Subtitle | 14px | w600 | orange | 0px | "Welcome to the future" |
| Field label | 13px | w600 | lightOrange | 0.8px | "EMAIL", "PASSWORD" |
| Button label | 16px | w700 | darkBlue (on gradient) | 1px | "SIGN IN" |
| Link text | 13–14px | w500–w700 | orange | 0px | "Forgot Password?" |
| Hint text | 14px | w400 | hintText | 0px | Placeholder in fields |
| Error text | 12–13px | w500 | errorRed | 0px | Inline validation |
| Badge label | 12px | w600 | varies | 0.5px | "PREMIUM CREATOR" |
| Criteria item | 12px | w400→w600 | hintText→green | 0.2px | Password checklist |
| Strength label | 11px | w700 | varies | 1.2px | "Strong", "Superb" |
| Divider text | 12px | w600 | hintText alpha 0.7 | 1.5px | "OR" |

## Animation Durations

| Animation | Duration | Curve |
|-----------|----------|-------|
| Screen entry (fade+slide) | 800ms | `easeOut` / `easeOutCubic` |
| Splash entry (fade+scale) | 1500ms | `easeOut` / `easeOutBack` |
| Container state change | 200ms | default |
| Element swap | 250–350ms | `elasticOut` (in) / `easeIn` (out) |
| Size animation | 400ms | `easeInOut` |
| Text style change | 300ms | default |

## Opacity Scale

| Purpose | Alpha |
|---------|-------|
| Strong overlay | 0.35 |
| Badge/banner background | 0.12–0.15 |
| Subtle glow | 0.06 |
| Splash feedback | 0.1 |
| Border accent | 0.3–0.4 |
| Muted hint | 0.5–0.7 |
| Near-transparent | 0.9 |
