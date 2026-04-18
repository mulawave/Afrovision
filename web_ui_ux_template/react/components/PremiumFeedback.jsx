// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Feedback Components
//  Banners, Status Badges, Modals, Drawers, Toasts
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';

/**
 * PremiumBanner — Inline alert banner (error/success/warning/info).
 */
export function PremiumBanner({ type = 'error', children, className = '' }) {
  return (
    <div className={`av-banner av-banner--${type} ${className}`}>
      {children}
    </div>
  );
}

/**
 * PremiumStatusBadge — Color-coded status pill (admin style).
 *
 * Props:
 *   - status (string) — e.g. 'active', 'pending', 'suspended', 'rejected'
 */
export function PremiumStatusBadge({ status }) {
  const map = {
    active:      'success',
    enabled:     'success',
    success:     'success',
    approved:    'success',
    distributed: 'success',
    suspended:   'error',
    disabled:    'error',
    rejected:    'error',
    failed:      'error',
    pending:     'warning',
    processing:  'warning',
    swapped:     'warning',
    inactive:    'neutral',
    deleted:     'neutral',
    cancelled:   'neutral',
  };

  const variant = map[status?.toLowerCase()] || 'neutral';

  return (
    <span className={`av-badge av-badge--${variant}`}>
      {status}
    </span>
  );
}

/**
 * PremiumModal — Centered dialog with backdrop.
 *
 * Props:
 *   - open, onClose, title, children, actions (ReactNode), width
 */
export function PremiumModal({
  open = false,
  onClose,
  title,
  children,
  actions,
  width = 480,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="av-overlay" onClick={onClose} />
      <div
        ref={dialogRef}
        className="av-modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--av-white)' }}>{title}</h2>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--av-light-orange)', cursor: 'pointer', fontSize: '1.25rem' }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        <div>{children}</div>
        {actions && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            {actions}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * PremiumConfirmDialog — Confirmation modal with destructive/default variants.
 *
 * Props:
 *   - open, onClose, onConfirm, title, message
 *   - confirmLabel, cancelLabel, destructive
 */
export function PremiumConfirmDialog({
  open = false,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}) {
  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--av-radius-md)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--av-light-orange)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--av-radius-md)',
              border: 'none',
              background: destructive ? 'var(--av-error)' : 'var(--av-gradient-cta)',
              color: destructive ? 'var(--av-white)' : 'var(--av-dark-blue)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '0.875rem', color: 'var(--av-muted)', lineHeight: 1.6 }}>{message}</p>
    </PremiumModal>
  );
}

/**
 * PremiumDrawer — Slide-out right panel.
 *
 * Props:
 *   - open, onClose, title, children, width
 */
export function PremiumDrawer({
  open = false,
  onClose,
  title,
  children,
  width = 480,
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="av-overlay" onClick={onClose} />
      <div className="av-drawer" style={{ width }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', borderBottom: '1px solid var(--av-admin-border)' }}>
          {title && <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--av-white)' }}>{title}</h2>}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--av-light-orange)', cursor: 'pointer', fontSize: '1.25rem' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * PremiumSpinner — Loading spinner.
 */
export function PremiumSpinner({ size = 'md', className = '' }) {
  const sizeClass = size === 'sm' ? 'av-spinner--sm' : size === 'lg' ? 'av-spinner--lg' : '';
  return <div className={`av-spinner ${sizeClass} ${className}`} />;
}

/**
 * PremiumEmptyState — Centered empty-list placeholder.
 */
export function PremiumEmptyState({ title = 'No data', subtitle, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
      {icon && <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>{icon}</div>}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--av-white)' }}>{title}</h3>
      {subtitle && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--av-light-orange)' }}>{subtitle}</p>}
    </div>
  );
}
