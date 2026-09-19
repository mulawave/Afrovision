# Premium UI/UX Template Kit

A complete, reusable **dark futuristic premium Flutter UI/UX template kit** extracted from a production application. Every color, gradient, shadow, text style, and decoration is driven by a **single configuration file** — change the colors once, and the entire kit updates instantly.

---

## Quick Start

### 1. Copy the `ui_ux_template/lib/` folder into your project

```
your_app/
  lib/
    premium_kit/          ← paste here
      premium_kit.dart    ← barrel export
      theme/
        color_engine.dart ← THE single file to customise
        presets.dart       ← ready-made palettes
      widgets/
        premium_scaffold.dart
        premium_button.dart
        premium_text_field.dart
        premium_cards.dart
        premium_banners.dart
        premium_navigation.dart
        premium_profile.dart
        premium_wallet.dart
        premium_misc.dart
```

### 2. Import everything with one line

```dart
import 'premium_kit/premium_kit.dart';
```

### 3. Customise the theme

**Option A — Edit the defaults file directly:**

Open `theme/color_engine.dart`, scroll to the `_Defaults` class at the bottom, and change the color values. Save → hot reload → done.

**Option B — Apply a preset palette at startup:**

```dart
import 'premium_kit/premium_kit.dart';

void main() {
  PremiumTheme.configure(PremiumPresets.royal);   // deep purple + gold
  // PremiumTheme.configure(PremiumPresets.crimson);  // dark + red
  // PremiumTheme.configure(PremiumPresets.emerald);  // forest + green
  // PremiumTheme.configure(PremiumPresets.midnight); // indigo + blue
  // PremiumTheme.configure(PremiumPresets.sunset);   // warm + orange
  // PremiumTheme.configure(PremiumPresets.arctic);   // icy + cyan
  runApp(const MyApp());
}
```

**Option C — Supply a fully custom palette:**

```dart
PremiumTheme.configure(const PremiumColors(
  darkPrimary:        Color(0xFF050A30),
  lightPrimary:       Color(0xFF173A6D),
  accent:             Color(0xFFF49617),
  accentLight:        Color(0xFFF5C16C),
  textPrimary:        Color(0xFFFFFFFF),
  surfaceFill:        Color(0xFF0D1442),
  surfaceBorder:      Color(0xFF1E2A5A),
  surfaceFocusBorder: Color(0xFFF49617),
  textHint:           Color(0xFF5A6190),
  textGold:           Color(0xFFF5C16C),
  cardBackground:     Color(0xFF0A1040),
  error:              Color(0xFFFF4D6A),
  success:            Color(0xFF4CAF50),
  info:               Color(0xFF2196F3),
  softAccent:         Color(0xFF64B5F6),
  disabledStart:      Color(0xFF3A3A5C),
  disabledEnd:        Color(0xFF2A2A4C),
  purple:             Color(0xFF7C3AED),
  purpleDark:         Color(0xFF4C1D95),
));
```

**Reset to defaults:**

```dart
PremiumTheme.resetToDefaults();
```

---

## Architecture

```
PremiumTheme (singleton)
  ├── .colors        → PremiumColors          (19 named color slots)
  ├── .gradients     → PremiumGradients       (8 auto-derived gradients)
  ├── .shadows       → PremiumShadows         (5 auto-derived shadows)
  ├── .decorations   → PremiumDecorations     (14 pre-built BoxDecorations)
  ├── .textStyles    → PremiumTextStyles       (19 pre-built TextStyles)
  └── .animations    → PremiumAnimationConfig  (durations + curves)
```

When you call `PremiumTheme.configure(...)` or edit `_Defaults`, **every derived object rebuilds automatically**:

- Gradients are computed from the new colors
- Shadows adjust their glow color
- Decorations combine the new colors + gradients + shadows
- Text styles update their colors

Every widget reads from `PremiumTheme.*` — so one change propagates everywhere on the next hot reload.

---

## Widget Catalogue

### Screen & Navigation

| Widget | Description |
|--------|-------------|
| `PremiumScaffold` | Full-screen gradient background + fade/slide entry animation |
| `PremiumBackButton` | Styled back arrow in `surfaceFill` container |
| `PremiumBottomNavBar` | Bottom tab bar with accent highlights and badge counters |
| `PremiumAppBarAction` | App bar icon button with optional badge |
| `PremiumSegmentedControl` | Pill-style toggle between segments |
| `PremiumTabBar` | Gradient-indicator TabBar |

### Buttons

| Widget | Description |
|--------|-------------|
| `PremiumButton` | Gradient CTA button with loading state + glow shadow |
| `PremiumOutlineButton` | Accent-bordered outline button |
| `PremiumTextButton` | Minimal text-link button |

### Forms

| Widget | Description |
|--------|-------------|
| `PremiumTextField` | Animated input with focus glow, error/success states |
| `PremiumPasswordStrength` | Animated 4-bar strength indicator |
| `PremiumCheckbox` | Themed checkbox with optional label |
| `PremiumDropdown` | Styled dropdown selector |

### Cards

| Widget | Description |
|--------|-------------|
| `PremiumCard` | Standard rounded card with depth shadow |
| `PremiumHeroCard` | Gradient glow card for featured content |
| `PremiumStatCard` | Icon + label + large value stat card |
| `PremiumPurpleCard` | Purple-tinted gradient card |
| `PremiumAccentCard` | Accent-tinted gradient card |
| `PremiumTintedCard` | Custom-color tinted card |
| `PremiumPlanCard` | Subscription pricing card with "POPULAR" tag |

### Wallet & Finance

| Widget | Description |
|--------|-------------|
| `PremiumBalanceCard` | Hero balance display with gradient + glow |
| `PremiumTransactionItem` | Ledger row: icon + title + amount + timestamp |
| `PremiumWalletActions` | Row of circular quick-action buttons |

### Profile

| Widget | Description |
|--------|-------------|
| `PremiumAvatar` | Circular avatar with gradient glow |
| `PremiumProfileHeader` | Avatar + name + subtitle + badge + actions |
| `PremiumMenuItem` | Profile menu row with icon + chevron |
| `PremiumStatusBadge` | Small color-coded pill badge |

### Banners & Feedback

| Widget | Description |
|--------|-------------|
| `PremiumNotificationBanner` | Overlay banner that slides from top |
| `PremiumAlertBanner` | Inline error/success/info message bar |

### Miscellaneous

| Widget | Description |
|--------|-------------|
| `PremiumDivider` | Divider with optional "OR" label |
| `PremiumLoader` | Accent-colored circular spinner |
| `PremiumRefreshIndicator` | Themed pull-to-refresh wrapper |
| `PremiumLiveBadge` | "● LIVE" status dot |
| `PremiumEmptyState` | Centered empty-list placeholder |
| `PremiumLogo` | Branded logo circle with glow + title |
| `PremiumBottomSheet` | Themed modal bottom sheet |
| `PremiumBadgeCounter` | Notification count pill |

---

## Preset Themes

| Preset | Primary | Accent | Vibe |
|--------|---------|--------|------|
| **Default** | Dark Blue `#050A30` | Orange/Gold `#F49617` | AfroVision original |
| `midnight` | Deep Indigo | Electric Blue | Cool professional |
| `crimson` | Charcoal | Vibrant Red | Bold dramatic |
| `emerald` | Deep Forest | Neon Green | Nature tech |
| `royal` | Deep Purple | Gold | Luxurious regal |
| `sunset` | Warm Dark | Orange/Pink | Warm energetic |
| `arctic` | Near Black | Icy Cyan | Minimal clean |

---

## Customisation Depth

### Level 1 — Change colors only
Edit `_Defaults` in `color_engine.dart` or call `PremiumTheme.configure()`. Everything else auto-derives.

### Level 2 — Override animation timings
```dart
PremiumTheme.configureAnimations(const PremiumAnimationConfig(
  screenEntry: Duration(milliseconds: 600),
  stateTransition: Duration(milliseconds: 150),
  screenSlideOffset: 0.10,
));
```

### Level 3 — Use individual theme objects
Every widget reads from `PremiumTheme.colors`, `.gradients`, `.shadows`, `.decorations`, `.textStyles`. You can access any of these directly in your own custom widgets:

```dart
Container(
  decoration: PremiumTheme.decorations.heroCard,
  child: Text('Custom widget', style: PremiumTheme.textStyles.cardHeader),
)
```

### Level 4 — Extend with your own widgets
Create new widgets that read from `PremiumTheme` and they'll automatically follow theme changes.

---

## Design Rules (from the original app)

1. **Every screen** uses `PremiumTheme.gradients.screenBackground` as its background
2. **Border radius**: 14px standard, 20px for hero/feature cards
3. **Shadows**: Accent-colored glow shadows (not plain grey)
4. **Text**: Never use opacity below 100% — use `textHint` or `textGold` for secondary text
5. **Animations**: Fade-in + slide-up on every screen entry (800ms)
6. **Icons**: Always in a tinted container (`accent.withValues(alpha: 0.12-0.18)`)
7. **Borders**: Subtle (`surfaceBorder.withValues(alpha: 0.15-0.4)`)
