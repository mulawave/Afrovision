// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Navigation Components
//  Navbar, Sidebar, Breadcrumb
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';

/**
 * PremiumNavbar — Fixed top navigation bar.
 *
 * Props:
 *   - brand (ReactNode) — logo / brand area
 *   - links (Array<{ label, href, active? }>)
 *   - actions (ReactNode) — right-side actions (avatar, bell, etc.)
 *   - className
 */
export function PremiumNavbar({ brand, links = [], actions, className = '' }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={`av-navbar ${className}`}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}>
        {brand || <PremiumLogo />}
      </div>

      {/* Desktop Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }} className="av-nav-desktop">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.href}
            style={{
              fontSize: '0.875rem',
              fontWeight: link.active ? 700 : 500,
              color: link.active ? 'var(--av-white)' : 'var(--av-light-orange)',
              transition: 'color 0.3s',
              textDecoration: 'none',
            }}
          >
            {link.label}
          </a>
        ))}
      </div>

      {/* Actions */}
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1.5rem' }}>
          {actions}
        </div>
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="av-nav-mobile-toggle"
        style={{
          display: 'none',
          marginLeft: '0.75rem',
          background: 'none',
          border: 'none',
          color: 'var(--av-white)',
          cursor: 'pointer',
          fontSize: '1.5rem',
        }}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          top: '64px',
          background: 'var(--av-dark-blue)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          zIndex: 49,
        }}>
          {links.map((link, i) => (
            <a
              key={i}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: link.active ? 'var(--av-white)' : 'var(--av-light-orange)',
                padding: '0.75rem 0',
                borderBottom: '1px solid rgba(30, 42, 90, 0.3)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

/**
 * PremiumSidebar — Admin fixed sidebar navigation.
 *
 * Props:
 *   - title (string)  e.g. "Admin Console"
 *   - subtitle (string) e.g. "Command Center"
 *   - links (Array<{ name, path, tone, active? }>)
 *   - brandLabel (string) e.g. "AfroVision"
 */
export function PremiumSidebar({
  title = 'Admin Console',
  subtitle = 'Command Center',
  brandLabel = 'AfroVision',
  links = [],
  currentPath = '',
}) {
  return (
    <aside className="av-sidebar">
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.34em', color: 'var(--av-light-orange)', opacity: 0.85 }}>
          {brandLabel}
        </p>
        <h1 style={{ marginTop: '0.25rem', fontSize: '1.25rem', fontWeight: 600, color: 'var(--av-white)' }}>
          {title}
        </h1>
        <div style={{
          marginTop: '1rem',
          display: 'inline-flex',
          padding: '0.25rem 0.75rem',
          borderRadius: 'var(--av-radius-full)',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)',
          fontSize: '0.625rem',
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          color: 'var(--av-light-orange)',
        }}>
          {subtitle}
        </div>
      </div>

      <nav style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
        {links.map((link) => {
          const active = link.active ?? (currentPath === link.path);
          return (
            <a
              key={link.path}
              href={link.path}
              className={`av-sidebar-link ${active ? 'av-sidebar-link--active' : ''}`}
            >
              <span>{link.name}</span>
              {link.tone && <small>{link.tone}</small>}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * PremiumLogo — Brand logo (configurable).
 */
export function PremiumLogo({ brandName = 'AfroVision', brandLetter = 'A', href = '/' }) {
  return (
    <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
      <div style={{
        width: '2.75rem',
        height: '2.75rem',
        borderRadius: 'var(--av-radius-md)',
        background: 'var(--av-gradient-cta)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        color: 'var(--av-dark-blue)',
        fontSize: '1.25rem',
        transition: 'transform 0.3s',
      }}>
        {brandLetter}
      </div>
      <span style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em' }}>
        <span style={{ color: 'var(--av-white)' }}>{brandName.slice(0, 4)}</span>
        <span style={{ color: 'var(--av-orange)' }}>{brandName.slice(4)}</span>
      </span>
    </a>
  );
}

/**
 * PremiumBadgeCounter — Notification count pill.
 */
export function PremiumBadgeCounter({ count = 0 }) {
  if (count <= 0) return null;
  return (
    <span style={{
      position: 'absolute',
      top: '-4px',
      right: '-4px',
      minWidth: '18px',
      height: '18px',
      borderRadius: 'var(--av-radius-full)',
      background: 'var(--av-error)',
      color: 'var(--av-white)',
      fontSize: '0.625rem',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 4px',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
