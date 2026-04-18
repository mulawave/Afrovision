// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM WEB UI/UX COLOR ENGINE — THE SINGLE FILE TO CUSTOMISE
// ═══════════════════════════════════════════════════════════════════════════════
//
//  Change the colors below → save → every component updates instantly.
//  Call PremiumTheme.configure({ ... }) at runtime for dynamic themes.
//  Call PremiumTheme.resetToDefaults() to revert to the AfroVision palette.
//
// ═══════════════════════════════════════════════════════════════════════════════

// ── DEFAULT PALETTE (AfroVision dark-premium) ─────────────────────────────

const DEFAULTS = Object.freeze({
  // Core brand
  darkBlue:       '#050A30',
  lightBlue:      '#173A6D',
  orange:         '#F49617',
  lightOrange:    '#F5C16C',
  white:          '#FFFFFF',

  // Surfaces
  inputFill:      '#0D1442',
  inputBorder:    '#1E2A5A',
  cardBg:         '#0A1040',
  surfaceFill:    'rgba(7, 17, 58, 0.78)',
  surfaceStrong:  'rgba(11, 26, 82, 0.92)',
  adminBorder:    'rgba(245, 193, 108, 0.18)',

  // Text
  hint:           '#5A6190',
  gold:           '#F5C16C',
  muted:          'rgba(255, 255, 255, 0.64)',
  soft:           'rgba(255, 255, 255, 0.08)',

  // Status
  error:          '#FF4D6A',
  success:        '#4CAF50',
  info:           '#2196F3',
  warning:        '#FF9800',

  // Accent variants
  purple:         '#7C4DFF',
  purpleDark:     '#311B92',
  emerald:        '#10B981',
  amber:          '#F59E0B',
  sky:            '#38BDF8',
});

// ── DERIVED VALUES (auto-computed from colors) ─────────────────────────────

function deriveGradients(c) {
  return {
    screenBg:        `linear-gradient(180deg, ${c.lightBlue}, ${c.darkBlue})`,
    adminBg:         `radial-gradient(circle at top left, ${hexToRgba(c.lightOrange, 0.14)}, transparent 30%), radial-gradient(circle at top right, ${hexToRgba(c.lightBlue, 0.52)}, transparent 35%), linear-gradient(180deg, ${c.lightBlue} 0%, ${c.darkBlue} 68%)`,
    ctaButton:       `linear-gradient(135deg, ${c.orange}, ${c.lightOrange})`,
    ctaButtonHover:  `linear-gradient(135deg, ${c.lightOrange}, ${c.orange})`,
    heroCard:        `linear-gradient(135deg, ${hexToRgba(c.orange, 0.22)}, ${hexToRgba(c.lightBlue, 0.3)})`,
    purpleCard:      `linear-gradient(135deg, ${hexToRgba(c.purple, 0.22)}, ${hexToRgba(c.purpleDark, 0.15)})`,
    orangeStatCard:  `linear-gradient(to bottom right, ${hexToRgba(c.orange, 0.18)}, ${hexToRgba(c.orange, 0.04)})`,
    blueStatCard:    `linear-gradient(to bottom right, ${hexToRgba(c.sky, 0.18)}, ${hexToRgba(c.sky, 0.04)})`,
    greenStatCard:   `linear-gradient(to bottom right, ${hexToRgba(c.emerald, 0.18)}, ${hexToRgba(c.emerald, 0.04)})`,
    amberStatCard:   `linear-gradient(to bottom right, ${hexToRgba(c.amber, 0.24)}, ${hexToRgba(c.amber, 0.06)})`,
    purpleStatCard:  `linear-gradient(to bottom right, ${hexToRgba(c.purple, 0.18)}, ${hexToRgba(c.purple, 0.04)})`,
    shimmer:         `linear-gradient(90deg, ${c.cardBg} 25%, ${c.inputBorder} 50%, ${c.cardBg} 75%)`,
  };
}

function deriveShadows(c) {
  return {
    ctaGlow:         `0 8px 24px ${hexToRgba(c.orange, 0.25)}`,
    cardDepth:       `0 18px 50px rgba(0, 0, 0, 0.22)`,
    sidebarDepth:    `0 24px 80px rgba(0, 0, 0, 0.34)`,
    purpleGlow:      `0 8px 24px ${hexToRgba(c.purple, 0.2)}`,
    errorGlow:       `0 8px 24px ${hexToRgba(c.error, 0.2)}`,
    none:            'none',
  };
}

function deriveBorders(c) {
  return {
    card:            `1px solid ${hexToRgba(c.inputBorder, 0.3)}`,
    input:           `1px solid ${hexToRgba(c.inputBorder, 0.4)}`,
    inputFocus:      `1px solid ${hexToRgba(c.orange, 0.6)}`,
    subtle:          `1px solid rgba(255, 255, 255, 0.08)`,
    subtleHover:     `1px solid rgba(255, 255, 255, 0.16)`,
    accent:          `1px solid ${hexToRgba(c.orange, 0.3)}`,
    accentHover:     `1px solid ${hexToRgba(c.orange, 0.6)}`,
    error:           `1px solid ${hexToRgba(c.error, 0.3)}`,
    success:         `1px solid ${hexToRgba(c.success, 0.3)}`,
    admin:           `1px solid ${c.adminBorder}`,
    activeSidebar:   `1px solid ${hexToRgba(c.lightOrange, 0.5)}`,
  };
}

function deriveRadii() {
  return {
    sm:   '8px',
    md:   '12px',
    lg:   '16px',
    xl:   '20px',
    '2xl': '28px',
    full: '9999px',
    input: '12px',
    card:  '16px',
    button: '12px',
    sidebar: '2.25rem',
  };
}

function deriveTypography(c) {
  return {
    fontSans: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontMono: '"JetBrains Mono", "Fira Code", monospace',
    fontAdmin: '"Aptos", "Bahnschrift", "Segoe UI", sans-serif',
    fontAdminHeading: '"Bahnschrift", "Aptos Display", "Segoe UI", sans-serif',
    heading: {
      fontSize: '2rem',
      fontWeight: 700,
      color: c.white,
      lineHeight: 1.2,
    },
    subheading: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: c.white,
    },
    body: {
      fontSize: '0.875rem',
      fontWeight: 400,
      color: c.white,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      color: c.hint,
    },
    label: {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: c.lightOrange,
      textTransform: 'none',
    },
    adminLabel: {
      fontSize: '0.625rem',
      fontWeight: 600,
      color: c.lightOrange,
      textTransform: 'uppercase',
      letterSpacing: '0.22em',
    },
    statValue: {
      fontSize: '1.875rem',
      fontWeight: 600,
      color: c.white,
    },
    badge: {
      fontSize: '0.75rem',
      fontWeight: 500,
      textTransform: 'capitalize',
    },
  };
}

function deriveAnimations() {
  return {
    fadeInUp: {
      keyframes: {
        from: { opacity: 0, transform: 'translateY(24px)' },
        to:   { opacity: 1, transform: 'translateY(0)' },
      },
      duration: '0.8s',
      easing: 'ease-out',
    },
    shimmer: {
      keyframes: {
        '0%':   { backgroundPosition: '-200% 0' },
        '100%': { backgroundPosition: '200% 0' },
      },
      duration: '1.5s',
      easing: 'linear',
      iteration: 'infinite',
    },
    spin: {
      keyframes: {
        from: { transform: 'rotate(0deg)' },
        to:   { transform: 'rotate(360deg)' },
      },
      duration: '0.72s',
      easing: 'linear',
      iteration: 'infinite',
    },
    pulse: {
      keyframes: {
        '0%, 100%': { opacity: 1 },
        '50%':      { opacity: 0.6 },
      },
      duration: '2s',
      easing: 'ease-in-out',
      iteration: 'infinite',
    },
    staggerDelay: 0.1, // seconds between children
    staggerCount: 6,   // how many children get staggered
    transition: {
      fast:   'all 0.15s ease',
      normal: 'all 0.3s ease',
      slow:   'all 0.5s ease',
    },
  };
}

// ── THEME SINGLETON ────────────────────────────────────────────────────────

let _colors = { ...DEFAULTS };
let _listeners = [];

const PremiumTheme = {
  // Current resolved theme
  get colors()      { return { ..._colors }; },
  get gradients()   { return deriveGradients(_colors); },
  get shadows()     { return deriveShadows(_colors); },
  get borders()     { return deriveBorders(_colors); },
  get radii()       { return deriveRadii(); },
  get typography()  { return deriveTypography(_colors); },
  get animations()  { return deriveAnimations(); },

  /**
   * Apply a partial or full custom palette.
   * Only changed keys need to be supplied.
   */
  configure(overrides = {}) {
    _colors = { ..._colors, ...overrides };
    _notify();
  },

  /** Reset to the AfroVision factory palette. */
  resetToDefaults() {
    _colors = { ...DEFAULTS };
    _notify();
  },

  /**
   * Subscribe to theme changes. Returns an unsubscribe function.
   * Useful for React hooks or vanilla JS listeners.
   */
  subscribe(fn) {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  },

  /**
   * Inject the current palette as CSS custom properties on :root.
   * Call once at app startup, and again after configure().
   */
  injectCSSVariables(target = document.documentElement) {
    const c = _colors;
    const g = deriveGradients(c);
    const s = deriveShadows(c);
    const b = deriveBorders(c);
    const r = deriveRadii();

    const vars = {
      // Colors
      '--av-dark-blue':       c.darkBlue,
      '--av-light-blue':      c.lightBlue,
      '--av-orange':          c.orange,
      '--av-light-orange':    c.lightOrange,
      '--av-white':           c.white,
      '--av-input-fill':      c.inputFill,
      '--av-input-border':    c.inputBorder,
      '--av-card-bg':         c.cardBg,
      '--av-surface':         c.surfaceFill,
      '--av-surface-strong':  c.surfaceStrong,
      '--av-admin-border':    c.adminBorder,
      '--av-hint':            c.hint,
      '--av-gold':            c.gold,
      '--av-muted':           c.muted,
      '--av-soft':            c.soft,
      '--av-error':           c.error,
      '--av-success':         c.success,
      '--av-info':            c.info,
      '--av-warning':         c.warning,
      '--av-purple':          c.purple,
      '--av-purple-dark':     c.purpleDark,
      '--av-emerald':         c.emerald,
      '--av-amber':           c.amber,
      '--av-sky':             c.sky,

      // Gradients
      '--av-gradient-screen':       g.screenBg,
      '--av-gradient-admin':        g.adminBg,
      '--av-gradient-cta':          g.ctaButton,
      '--av-gradient-cta-hover':    g.ctaButtonHover,
      '--av-gradient-hero-card':    g.heroCard,
      '--av-gradient-shimmer':      g.shimmer,

      // Shadows
      '--av-shadow-cta':            s.ctaGlow,
      '--av-shadow-card':           s.cardDepth,
      '--av-shadow-sidebar':        s.sidebarDepth,

      // Radii
      '--av-radius-sm':     r.sm,
      '--av-radius-md':     r.md,
      '--av-radius-lg':     r.lg,
      '--av-radius-xl':     r.xl,
      '--av-radius-2xl':    r['2xl'],
      '--av-radius-full':   r.full,
    };

    for (const [key, value] of Object.entries(vars)) {
      target.style.setProperty(key, value);
    }
  },

  /** Export current palette as a plain object (for serialization). */
  toJSON() {
    return { ..._colors };
  },
};

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(PremiumTheme); } catch (e) { console.error('Theme listener error:', e); }
  });
  // Auto-inject CSS vars if running in browser
  if (typeof document !== 'undefined') {
    PremiumTheme.injectCSSVariables();
  }
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha = 1) {
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── EXPORTS ────────────────────────────────────────────────────────────────

export { PremiumTheme, DEFAULTS, hexToRgba };
export default PremiumTheme;
