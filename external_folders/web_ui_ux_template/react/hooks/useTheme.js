// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — useTheme Hook
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import PremiumTheme from '../theme/color-engine.js';

/**
 * React hook that re-renders when PremiumTheme.configure() is called.
 * Returns the full theme object.
 *
 * Usage:
 *   const theme = useTheme();
 *   <div style={{ background: theme.gradients.screenBg }}>
 */
export function useTheme() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = PremiumTheme.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  return {
    colors:     PremiumTheme.colors,
    gradients:  PremiumTheme.gradients,
    shadows:    PremiumTheme.shadows,
    borders:    PremiumTheme.borders,
    radii:      PremiumTheme.radii,
    typography: PremiumTheme.typography,
    animations: PremiumTheme.animations,
  };
}

export default useTheme;
