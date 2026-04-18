// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Button Components
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';

/**
 * PremiumButton — Primary gradient CTA button with loading state.
 *
 * Props:
 *   - children, onClick, disabled, loading, type, className, fullWidth, style
 */
export function PremiumButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  fullWidth = false,
  style = {},
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`av-btn ${fullWidth ? 'av-btn--full' : ''} ${className}`}
      style={{ width: fullWidth ? '100%' : undefined, ...style }}
    >
      {loading ? (
        <>
          <span className="av-spinner av-spinner--sm" style={{ borderColor: 'var(--av-dark-blue)', borderTopColor: 'transparent' }} />
          <span>{typeof children === 'string' ? children : 'Loading...'}</span>
        </>
      ) : children}
    </button>
  );
}

/**
 * PremiumOutlineButton — Accent-bordered outline button.
 */
export function PremiumOutlineButton({
  children,
  onClick,
  disabled = false,
  className = '',
  fullWidth = false,
  style = {},
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`av-btn-outline ${className}`}
      style={{ width: fullWidth ? '100%' : undefined, ...style }}
    >
      {children}
    </button>
  );
}

/**
 * PremiumTextButton — Minimal text-link button.
 */
export function PremiumTextButton({
  children,
  onClick,
  className = '',
  style = {},
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`av-btn-text ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}

/**
 * PremiumPillButton — Small rounded pill with accent tint (for wallet quick actions).
 */
export function PremiumPillButton({
  children,
  onClick,
  variant = 'orange',
  className = '',
}) {
  const variants = {
    orange:  { border: 'rgba(244,150,23,0.3)', bg: 'rgba(244,150,23,0.1)', color: 'var(--av-orange)' },
    purple:  { border: 'rgba(124,77,255,0.3)', bg: 'rgba(124,77,255,0.1)', color: 'var(--av-purple)' },
    success: { border: 'rgba(76,175,80,0.3)', bg: 'rgba(76,175,80,0.1)', color: 'var(--av-success)' },
  };
  const v = variants[variant] || variants.orange;

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        borderRadius: 'var(--av-radius-full)',
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.color,
        fontSize: '0.875rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.3s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
