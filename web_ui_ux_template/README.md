# Premium Web UI/UX Template Kit

**A complete, reusable, dark-futuristic design system** extracted from AfroVision's website and admin panel. Available in both **React** and **pure HTML/CSS** versions.

One file controls all colors — change it, save, every component updates instantly.

---

## Quick Start

### React Version

```jsx
// 1. Import the theme engine
import { PremiumTheme, presets } from './web_ui_ux_template/react';

// 2. Customise colors (optional)
PremiumTheme.configure({ orange: '#E74C3C', darkBlue: '#1A0A0A' });

// 3. Or apply a preset
PremiumTheme.configure(presets.crimson);

// 4. Reset to defaults
PremiumTheme.resetToDefaults();

// 5. Use components
import LoginPage from './web_ui_ux_template/react/pages/LoginPage';
import { PremiumButton } from './web_ui_ux_template/react/components/PremiumButton';
import PremiumScaffold from './web_ui_ux_template/react/components/PremiumScaffold';
```

### HTML Version

```html
<!-- 1. Include the CSS and JS -->
<link rel="stylesheet" href="web_ui_ux_template/html/theme.css" />
<script src="web_ui_ux_template/html/theme.js"></script>

<!-- 2. Use CSS classes -->
<button class="av-btn">Primary Button</button>
<input class="av-input" placeholder="Enter text" />

<!-- 3. Switch themes at runtime -->
<script>
  PremiumTheme.applyPreset('crimson');   // Apply a preset
  PremiumTheme.apply({ orange: '#FF6B35' }); // Partial overrides
  PremiumTheme.reset();                   // Back to defaults
</script>
```

Open `html/index.html` in a browser to see all components with live preset switching.

---

## Directory Structure

```
web_ui_ux_template/
├── react/
│   ├── index.js                        # Barrel export — import everything
│   ├── theme/
│   │   ├── color-engine.js             # ★ THE FILE TO CUSTOMISE (React)
│   │   └── presets.js                  # 6 preset themes
│   ├── hooks/
│   │   └── useTheme.js                # React hook for theme subscription
│   ├── styles/
│   │   └── globals.css                # CSS custom properties + base styles
│   ├── components/
│   │   ├── PremiumScaffold.jsx        # Full-screen gradient background
│   │   ├── PremiumButton.jsx          # CTA, outline, text, pill buttons
│   │   ├── PremiumTextField.jsx       # Input with password toggle, strength
│   │   ├── PremiumCards.jsx           # Card, hero, stat, wallet, plan cards
│   │   ├── PremiumNavigation.jsx      # Navbar, sidebar, logo, badge counter
│   │   ├── PremiumFeedback.jsx        # Banner, modal, drawer, spinner, etc.
│   │   ├── PremiumDataTable.jsx       # Paginated data table
│   │   ├── PremiumProfile.jsx         # Avatar, profile header, user dropdown
│   │   └── PremiumFooter.jsx          # 4-column footer
│   └── pages/
│       ├── LoginPage.jsx              # Fully implemented login flow
│       ├── RegisterPage.jsx           # Register with password strength
│       ├── ForgotPasswordPage.jsx     # Forgot password with success state
│       ├── AdminDashboardPage.jsx     # Admin layout with sidebar + stat grid
│       ├── WalletPage.jsx             # Finance wallet page
│       └── PricingPage.jsx            # Subscription plans with toggles
│
├── html/
│   ├── theme.css                      # ★ THE FILE TO CUSTOMISE (HTML)
│   ├── theme.js                       # Runtime theme switching
│   ├── index.html                     # Component showcase with live presets
│   └── pages/
│       ├── login.html                 # Login with validation + loading
│       ├── register.html              # Register with strength indicator
│       ├── forgot-password.html       # Forgot password with success view
│       ├── dashboard.html             # Admin dashboard with sidebar + table
│       └── wallet.html                # Wallet page with navbar + ledger
│
└── README.md                          # This file
```

---

## Color Palette (Defaults)

| Token         | Value                             | Usage                    |
|---------------|-----------------------------------|--------------------------|
| `darkBlue`    | `#050A30`                        | Background, dark surfaces |
| `lightBlue`   | `#173A6D`                        | Gradient top, accents     |
| `orange`      | `#F49617`                        | Primary CTA, links        |
| `lightOrange` | `#F5C16C`                        | Secondary text, labels    |
| `white`       | `#FFFFFF`                        | Headings, primary text    |
| `inputFill`   | `#0D1442`                        | Input backgrounds         |
| `inputBorder` | `#1E2A5A`                        | Input borders, dividers   |
| `cardBg`      | `#0A1040`                        | Card backgrounds          |
| `error`       | `#FF4D6A`                        | Error states              |
| `success`     | `#4CAF50`                        | Success states            |
| `info`        | `#2196F3`                        | Info states               |
| `warning`     | `#FF9800`                        | Warning states            |
| `purple`      | `#7C4DFF`                        | Accent variant            |

---

## Presets

| Preset     | Vibe                          |
|------------|-------------------------------|
| `midnight` | Default AfroVision palette    |
| `crimson`  | Deep red, bold and dramatic   |
| `emerald`  | Green-tinted, nature-fresh    |
| `royal`    | Purple luxury, regal tones    |
| `sunset`   | Warm orange, fiery gradients  |
| `arctic`   | Cool blue, frosted glass      |

---

## React Components

### Layout
- **`PremiumScaffold`** — Full-screen gradient with optional decorative orbs
- **`PremiumNavbar`** — Fixed top nav with links, brand, mobile support
- **`PremiumSidebar`** — Admin sidebar with tone labels and active states
- **`PremiumFooter`** — 4-column footer with social links

### Inputs & Actions
- **`PremiumButton`** — Gradient CTA with loading spinner
- **`PremiumOutlineButton`** — Transparent bordered button
- **`PremiumTextButton`** — Ghost/link-style button
- **`PremiumPillButton`** — Small rounded action button (orange/purple/success)
- **`PremiumTextField`** — Input with label, error, password toggle, rightAction

### Data Display
- **`PremiumCard`** — Standard surface card
- **`PremiumHeroCard`** — Gradient-glow highlight card
- **`PremiumStatCard`** — Admin stat card (blue/green/purple/amber/orange accents)
- **`PremiumWalletStatCard`** — Website wallet-style stat card
- **`PremiumPlanCard`** — Pricing plan card with features list
- **`PremiumDataTable`** — Paginated table with admin styling

### Feedback
- **`PremiumBanner`** — Error/success/warning/info notification banner
- **`PremiumStatusBadge`** — Maps 15+ statuses to colored badges
- **`PremiumModal`** — Centred dialog with overlay
- **`PremiumConfirmDialog`** — Destructive/default confirmation
- **`PremiumDrawer`** — Slide-in right panel
- **`PremiumSpinner`** — Loading indicator (sm/md/lg)
- **`PremiumEmptyState`** — Icon + message placeholder

### User
- **`PremiumAvatar`** — Image or letter fallback (sm/md/lg)
- **`PremiumProfileHeader`** — Avatar + name + badge + actions
- **`PremiumUserDropdown`** — Avatar with dropdown menu

---

## HTML CSS Classes

All classes are prefixed with `av-` to avoid conflicts:

| Class                    | Description                    |
|--------------------------|--------------------------------|
| `.av-btn`                | Primary gradient button        |
| `.av-btn-outline`        | Outline button                 |
| `.av-btn-text`           | Ghost button                   |
| `.av-btn-pill--orange`   | Small pill button              |
| `.av-input`              | Styled text input              |
| `.av-card`               | Standard card                  |
| `.av-card-hero`          | Gradient hero card             |
| `.av-stat-card--blue`    | Blue stat card                 |
| `.av-badge--success`     | Status badge                   |
| `.av-banner--error`      | Notification banner            |
| `.av-table`              | Styled table                   |
| `.av-navbar`             | Fixed navigation bar           |
| `.av-sidebar`            | Admin sidebar                  |
| `.av-modal`              | Centred modal dialog           |
| `.av-drawer`             | Slide-in drawer                |
| `.av-spinner`            | Loading spinner                |
| `.av-animate-fade-in-up` | Fade + slide up animation      |
| `.av-stagger`            | Stagger children animation     |
| `.av-grid-2/3/4`         | Responsive grid layouts        |
| `.av-container`          | Max-width centered container   |

---

## Customisation

### Change the default palette

**React:** Edit `react/theme/color-engine.js` → modify the `DEFAULTS` object → save.

**HTML:** Edit `html/theme.css` → modify the `:root` CSS variables → save.

### Runtime theme switching

**React:**
```jsx
import { PremiumTheme, presets } from './web_ui_ux_template/react';

// Apply overrides
PremiumTheme.configure({ orange: '#E74C3C', darkBlue: '#1A0A0A' });

// Apply a full preset
PremiumTheme.configure(presets.royal);

// Reset
PremiumTheme.resetToDefaults();
```

**HTML:**
```javascript
PremiumTheme.applyPreset('royal');
PremiumTheme.apply({ orange: '#E74C3C' });
PremiumTheme.reset();
```

### Create a custom preset

**React:** Add to `react/theme/presets.js`:
```javascript
myTheme: {
  darkBlue: '#0A001A',
  lightBlue: '#2A0A4D',
  orange: '#FF6B99',
  lightOrange: '#FFB3CC',
  // ...
},
```

**HTML:** In your script:
```javascript
PremiumTheme.apply({
  darkBlue: '#0A001A',
  lightBlue: '#2A0A4D',
  orange: '#FF6B99',
  lightOrange: '#FFB3CC',
});
```

---

## License

Internal use — AfroVision.
