// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Profile & Avatar Components
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';

/**
 * PremiumAvatar — Circular avatar with gradient glow border.
 *
 * Props:
 *   - src (string)
 *   - alt (string)
 *   - size ('sm'|'md'|'lg') defaults to 'md'
 *   - fallback (string) — single letter fallback
 */
export function PremiumAvatar({ src, alt = '', size = 'md', fallback = '?' }) {
  const sizes = { sm: 32, md: 48, lg: 80 };
  const px = sizes[size] || sizes.md;

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`av-avatar av-avatar--${size}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        background: 'var(--av-gradient-cta)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        color: 'var(--av-dark-blue)',
        fontSize: px * 0.4,
        border: '2px solid rgba(245, 193, 108, 0.3)',
      }}
    >
      {fallback}
    </div>
  );
}

/**
 * PremiumProfileHeader — Avatar + name + subtitle + badge + actions row.
 */
export function PremiumProfileHeader({
  avatarSrc,
  name,
  subtitle,
  badge,
  actions,
  className = '',
}) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <PremiumAvatar src={avatarSrc} size="lg" fallback={name?.[0] || '?'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--av-white)', margin: 0 }}>{name}</h2>
          {badge}
        </div>
        {subtitle && <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--av-light-orange)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '0.5rem' }}>{actions}</div>}
    </div>
  );
}

/**
 * PremiumMenuItem — Profile/settings menu row with icon + label + chevron.
 */
export function PremiumMenuItem({ icon, label, value, onClick, href, danger = false }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '0.875rem 1rem',
        borderRadius: 'var(--av-radius-md)',
        border: '1px solid rgba(30, 42, 90, 0.2)',
        background: 'rgba(13, 20, 66, 0.3)',
        color: danger ? 'var(--av-error)' : 'var(--av-white)',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.3s',
        textDecoration: 'none',
        textAlign: 'left',
      }}
    >
      {icon && <span style={{ opacity: 0.7, fontSize: '1.125rem' }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {value && <span style={{ fontSize: '0.75rem', color: 'var(--av-light-orange)' }}>{value}</span>}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.4 }}>
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
      </svg>
    </Tag>
  );
}

/**
 * PremiumPremiumBadge — Gold gradient "PRO" / "PREMIUM" badge.
 */
export function PremiumBadge({ label = 'PRO', size = 'sm' }) {
  const sizes = {
    sm:  { fontSize: '0.5rem', padding: '0.125rem 0.375rem' },
    md:  { fontSize: '0.6rem', padding: '0.25rem 0.5rem' },
    lg:  { fontSize: '0.75rem', padding: '0.25rem 0.75rem' },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: s.padding,
      borderRadius: 'var(--av-radius-full)',
      background: 'var(--av-gradient-cta)',
      color: 'var(--av-dark-blue)',
      fontSize: s.fontSize,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
    }}>
      {label}
    </span>
  );
}

/**
 * PremiumUserDropdown — Avatar + name dropdown menu.
 */
export function PremiumUserDropdown({ avatarSrc, name, items = [], open, onToggle }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--av-white)',
        }}
      >
        <PremiumAvatar src={avatarSrc} size="sm" fallback={name?.[0] || '?'} />
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>

      {open && (
        <div
          className="av-animate-slide-down"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            minWidth: '200px',
            background: 'var(--av-surface-strong)',
            border: '1px solid var(--av-admin-border)',
            borderRadius: 'var(--av-radius-md)',
            boxShadow: 'var(--av-shadow-card)',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
            zIndex: 60,
          }}
        >
          {items.map((item, i) => (
            <a
              key={i}
              href={item.href}
              onClick={item.onClick}
              style={{
                display: 'block',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                color: item.danger ? 'var(--av-error)' : 'var(--av-light-orange)',
                textDecoration: 'none',
                transition: 'background 0.15s',
                borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
