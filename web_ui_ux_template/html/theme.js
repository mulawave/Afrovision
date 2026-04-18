// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM HTML UI/UX TEMPLATE — THEME JS (runtime switching)
// ═══════════════════════════════════════════════════════════════════════════════
//
//  Include this AFTER theme.css.  Usage:
//    <script src="theme.js"></script>
//    <script>
//      PremiumTheme.apply({ darkBlue: '#1A0A30', orange: '#E74C3C' });
//      PremiumTheme.applyPreset('crimson');
//      PremiumTheme.reset();
//    </script>
//
// ═══════════════════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  /* ── Default palette (mirrors theme.css :root) ─────────────────────────── */

  var DEFAULTS = {
    darkBlue:      '#050A30',
    lightBlue:     '#173A6D',
    orange:        '#F49617',
    lightOrange:   '#F5C16C',
    white:         '#FFFFFF',
    inputFill:     '#0D1442',
    inputBorder:   '#1E2A5A',
    cardBg:        '#0A1040',
    hint:          '#5A6190',
    gold:          '#F5C16C',
    error:         '#FF4D6A',
    success:       '#4CAF50',
    info:          '#2196F3',
    warning:       '#FF9800',
    purple:        '#7C4DFF',
    purpleDark:    '#311B92',
    emerald:       '#10B981',
    amber:         '#F59E0B',
    sky:           '#38BDF8',
  };

  /* ── Presets ────────────────────────────────────────────────────────────── */

  var PRESETS = {
    midnight: {}, // default palette
    crimson: {
      darkBlue: '#1A0A0A', lightBlue: '#3D1010', orange: '#E74C3C', lightOrange: '#F1948A',
      inputFill: '#2C0B0B', inputBorder: '#4A1A1A', cardBg: '#220D0D',
      error: '#FF6B81', success: '#2ECC71', purple: '#9B59B6',
    },
    emerald: {
      darkBlue: '#021A0F', lightBlue: '#0B3D24', orange: '#10B981', lightOrange: '#6EE7B7',
      inputFill: '#031F12', inputBorder: '#0F4A2D', cardBg: '#021710',
      error: '#FF6B81', success: '#34D399', purple: '#818CF8',
    },
    royal: {
      darkBlue: '#0A0020', lightBlue: '#1E0A4D', orange: '#A855F7', lightOrange: '#C084FC',
      inputFill: '#0F0330', inputBorder: '#2D1264', cardBg: '#0D0228',
      error: '#FB7185', success: '#4ADE80', purple: '#A855F7',
    },
    sunset: {
      darkBlue: '#1A0A00', lightBlue: '#4D2600', orange: '#FF6B35', lightOrange: '#FF9F1C',
      inputFill: '#2C1200', inputBorder: '#5A3000', cardBg: '#221000',
      error: '#FF4D6A', success: '#4CAF50', purple: '#FF6B99',
    },
    arctic: {
      darkBlue: '#020E1A', lightBlue: '#0B2A4D', orange: '#38BDF8', lightOrange: '#7DD3FC',
      inputFill: '#031425', inputBorder: '#0F3A5F', cardBg: '#021220',
      error: '#FB7185', success: '#34D399', purple: '#818CF8',
    },
  };

  /* ── Mapping: JS key → CSS variable ────────────────────────────────────── */

  var KEY_TO_VAR = {
    darkBlue:    '--av-dark-blue',
    lightBlue:   '--av-light-blue',
    orange:      '--av-orange',
    lightOrange: '--av-light-orange',
    white:       '--av-white',
    inputFill:   '--av-input-fill',
    inputBorder: '--av-input-border',
    cardBg:      '--av-card-bg',
    hint:        '--av-hint',
    gold:        '--av-gold',
    error:       '--av-error',
    success:     '--av-success',
    info:        '--av-info',
    warning:     '--av-warning',
    purple:      '--av-purple',
    purpleDark:  '--av-purple-dark',
    emerald:     '--av-emerald',
    amber:       '--av-amber',
    sky:         '--av-sky',
  };

  /* ── Internal state ────────────────────────────────────────────────────── */

  var current = {};
  for (var k in DEFAULTS) current[k] = DEFAULTS[k];

  /* ── Core functions ────────────────────────────────────────────────────── */

  function inject(overrides) {
    var root = document.documentElement;
    for (var key in overrides) {
      if (KEY_TO_VAR[key]) {
        current[key] = overrides[key];
        root.style.setProperty(KEY_TO_VAR[key], overrides[key]);
      }
    }
    // Regenerate derived gradients
    root.style.setProperty('--av-gradient-screen', 'linear-gradient(180deg, ' + current.lightBlue + ', ' + current.darkBlue + ')');
    root.style.setProperty('--av-gradient-cta', 'linear-gradient(135deg, ' + current.orange + ', ' + current.lightOrange + ')');
    root.style.setProperty('--av-gradient-shimmer', 'linear-gradient(90deg, ' + current.cardBg + ' 25%, ' + current.inputBorder + ' 50%, ' + current.cardBg + ' 75%)');
    // Propagate body background
    document.body.style.background = 'linear-gradient(180deg, ' + current.lightBlue + ', ' + current.darkBlue + ')';
  }

  /* ── Public API ────────────────────────────────────────────────────────── */

  root.PremiumTheme = {
    DEFAULTS: DEFAULTS,
    PRESETS: PRESETS,

    /** Apply partial overrides */
    apply: function (overrides) {
      inject(overrides || {});
    },

    /** Apply a named preset */
    applyPreset: function (name) {
      if (!PRESETS[name]) { console.warn('[PremiumTheme] Unknown preset: ' + name); return; }
      this.reset();
      inject(PRESETS[name]);
    },

    /** Reset to defaults */
    reset: function () {
      var root = document.documentElement;
      // Clear inline overrides
      for (var key in KEY_TO_VAR) {
        root.style.removeProperty(KEY_TO_VAR[key]);
        current[key] = DEFAULTS[key];
      }
      root.style.removeProperty('--av-gradient-screen');
      root.style.removeProperty('--av-gradient-cta');
      root.style.removeProperty('--av-gradient-shimmer');
      document.body.style.background = '';
    },

    /** Get current palette snapshot */
    getCurrent: function () {
      var snap = {};
      for (var k in current) snap[k] = current[k];
      return snap;
    },

    /** List all preset names */
    listPresets: function () {
      return Object.keys(PRESETS);
    },
  };

})(window);
