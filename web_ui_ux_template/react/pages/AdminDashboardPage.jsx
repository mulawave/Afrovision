// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Admin Dashboard Page Template
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import PremiumScaffold from '../components/PremiumScaffold.jsx';
import { PremiumSidebar } from '../components/PremiumNavigation.jsx';
import { PremiumStatCard } from '../components/PremiumCards.jsx';

/**
 * AdminDashboardPage — Dashboard layout with sidebar + stat cards grid.
 *
 * Props:
 *   - sidebarLinks (Array<{ name, path, tone }>)
 *   - currentPath (string)
 *   - stats (Array<{ title, value, accent, hint?, href? }>)
 *   - children (ReactNode) — additional content below stats
 */
export default function AdminDashboardPage({
  sidebarLinks = [],
  currentPath = '/dashboard',
  stats = [],
  children,
}) {
  return (
    <PremiumScaffold adminStyle bgOrbs={false}>
      <PremiumSidebar links={sidebarLinks} currentPath={currentPath} />

      <div style={{ marginLeft: '304px', padding: '1.5rem 2rem', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--av-light-orange)' }}>Overview</p>
          <h1 style={{ marginTop: '0.5rem', fontSize: '2rem', fontWeight: 600, color: 'var(--av-white)' }}>Dashboard</h1>
        </div>

        {/* Stat cards grid */}
        {stats.length > 0 && (
          <div className="av-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {stats.map((stat, i) => (
              <PremiumStatCard
                key={i}
                title={stat.title}
                value={stat.value}
                accent={stat.accent || 'blue'}
                hint={stat.hint}
                href={stat.href}
              />
            ))}
          </div>
        )}

        {children}
      </div>
    </PremiumScaffold>
  );
}
