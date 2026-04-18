// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Card Components
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';

/**
 * PremiumCard — Standard dark card with subtle border.
 */
export function PremiumCard({ children, className = '', style = {}, onClick }) {
  return (
    <div className={`av-card ${className}`} style={style} onClick={onClick} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  );
}

/**
 * PremiumHeroCard — Gradient glow card for featured content.
 */
export function PremiumHeroCard({ children, className = '', style = {} }) {
  return (
    <div className={`av-card-hero ${className}`} style={style}>
      {children}
    </div>
  );
}

/**
 * PremiumStatCard — Icon + label + large value (admin dashboard style).
 *
 * Props:
 *   - title (string)
 *   - value (string|number)
 *   - accent ('blue'|'green'|'purple'|'amber'|'orange')
 *   - hint (string) optional subtext
 *   - href (string) optional link
 *   - onClick (func) optional click
 */
export function PremiumStatCard({
  title,
  value,
  accent = 'blue',
  hint = null,
  href = null,
  onClick,
  className = '',
}) {
  const formatted = typeof value === 'number' ? value.toLocaleString() : (value ?? '—');

  const content = (
    <>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--av-light-orange)' }}>{title}</h3>
      <p style={{ marginTop: '0.5rem', fontSize: '1.875rem', fontWeight: 600, color: 'var(--av-white)' }}>{formatted}</p>
      {hint && <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--av-light-orange)' }}>{hint}</p>}
    </>
  );

  const cardClass = `av-stat-card av-stat-card--${accent} ${className}`;

  if (href) {
    return <a href={href} className={cardClass} style={{ display: 'block', textDecoration: 'none', transition: 'all 0.3s' }}>{content}</a>;
  }

  return <div className={cardClass} onClick={onClick} role={onClick ? 'button' : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>{content}</div>;
}

/**
 * PremiumWalletStatCard — Colored stat card for wallet page (website style).
 *
 * Props:
 *   - label, value, variant ('orange'|'blue'|'green'|'amber')
 */
export function PremiumWalletStatCard({ label, value, variant = 'orange' }) {
  const variants = {
    orange:  { bg: 'linear-gradient(to bottom right, rgba(244,150,23,0.18), rgba(244,150,23,0.04))', border: 'rgba(244,150,23,0.25)', labelColor: '#FB923C' },
    blue:    { bg: 'linear-gradient(to bottom right, rgba(96,165,250,0.12), rgba(96,165,250,0.02))', border: 'rgba(96,165,250,0.25)', labelColor: '#60A5FA' },
    green:   { bg: 'linear-gradient(to bottom right, rgba(34,197,94,0.12), rgba(34,197,94,0.02))', border: 'rgba(34,197,94,0.25)', labelColor: '#4ADE80' },
    amber:   { bg: 'linear-gradient(to bottom right, rgba(251,191,36,0.12), rgba(251,191,36,0.02))', border: 'rgba(251,191,36,0.25)', labelColor: '#FBBF24' },
  };
  const v = variants[variant] || variants.orange;

  return (
    <div style={{ borderRadius: 'var(--av-radius-lg)', border: `1px solid ${v.border}`, background: v.bg, padding: '1.25rem', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      <p style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: v.labelColor }}>{label}</p>
      <p style={{ marginTop: '0.5rem', fontSize: '1.25rem', fontWeight: 600, color: 'var(--av-white)' }}>{value}</p>
    </div>
  );
}

/**
 * PremiumPlanCard — Subscription pricing card with optional "POPULAR" tag.
 *
 * Props:
 *   - name, price, period, features[], isPopular, ctaLabel, onSelect
 *   - accentColor (hex string)
 */
export function PremiumPlanCard({
  name,
  price,
  period = '/month',
  features = [],
  isPopular = false,
  ctaLabel = 'Subscribe',
  onSelect,
  accentColor,
}) {
  const accent = accentColor || 'var(--av-orange)';

  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--av-radius-xl)',
      background: 'var(--av-card-bg)',
      border: isPopular ? `2px solid ${accent}` : '1px solid rgba(30, 42, 90, 0.3)',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s',
    }}>
      {isPopular && (
        <div style={{
          position: 'absolute',
          top: '-0.75rem',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.25rem 1rem',
          borderRadius: 'var(--av-radius-full)',
          background: 'var(--av-gradient-cta)',
          fontSize: '0.625rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'var(--av-dark-blue)',
        }}>
          POPULAR
        </div>
      )}
      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--av-white)' }}>{name}</h3>
      <div style={{ marginTop: '1rem' }}>
        <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--av-white)' }}>{price}</span>
        <span style={{ fontSize: '0.875rem', color: 'var(--av-hint)' }}>{period}</span>
      </div>
      <ul style={{ marginTop: '1.5rem', flex: 1, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--av-light-orange)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={accent}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        style={{
          marginTop: '1.5rem',
          width: '100%',
          height: '48px',
          borderRadius: 'var(--av-radius-md)',
          background: isPopular ? 'var(--av-gradient-cta)' : 'transparent',
          border: isPopular ? 'none' : `1px solid rgba(245,193,108,0.3)`,
          color: isPopular ? 'var(--av-dark-blue)' : 'var(--av-light-orange)',
          fontWeight: 700,
          fontSize: '0.875rem',
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
