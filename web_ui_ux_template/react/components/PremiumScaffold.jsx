// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — PremiumScaffold
//  Full-screen gradient background with fade-in entry animation.
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';

/**
 * PremiumScaffold — wraps children in a full-screen gradient bg.
 *
 * Props:
 *   - children       (React.ReactNode)
 *   - className      (string)   extra classes
 *   - animate        (bool)     default true — fade-in-up entry
 *   - adminStyle     (bool)     use admin radial gradient overlay + grid
 *   - bgOrbs         (bool)     default true — decorative blurred orbs
 */
export default function PremiumScaffold({
  children,
  className = '',
  animate = true,
  adminStyle = false,
  bgOrbs = true,
}) {
  return (
    <div
      className={`av-screen ${adminStyle ? 'av-grid-overlay' : ''} ${className}`}
      style={adminStyle ? { background: 'var(--av-gradient-admin, var(--av-gradient-screen))' } : undefined}
    >
      {bgOrbs && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div className="av-bg-orb av-bg-orb--orange" style={{ top: '-10rem', right: '-10rem' }} />
          <div className="av-bg-orb av-bg-orb--blue" style={{ bottom: '-15rem', left: '-10rem' }} />
        </div>
      )}
      <div className={animate ? 'av-animate-fade-in-up' : ''} style={{ position: 'relative', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
