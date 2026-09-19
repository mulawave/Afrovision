// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Input / TextField Component
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';

// Eye icons
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
  </svg>
);

/**
 * PremiumTextField — Styled input with focus glow, error state, password toggle.
 *
 * Props:
 *   - label, id, type, value, onChange, placeholder, error, disabled
 *   - autoComplete, required, minLength, className
 *   - isPassword (bool) — show/hide toggle
 *   - rightAction (React.ReactNode) — e.g. "Forgot password?" link
 */
export default function PremiumTextField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  error = '',
  disabled = false,
  autoComplete,
  required = false,
  minLength,
  className = '',
  isPassword = false,
  rightAction = null,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={className}>
      {(label || rightAction) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
          {label && (
            <label
              htmlFor={id}
              style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--av-light-orange)' }}
            >
              {label}
            </label>
          )}
          {rightAction}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={effectiveType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={`av-input ${error ? 'av-input--error' : ''}`}
          style={isPassword ? { paddingRight: '2.75rem' } : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--av-light-orange)',
              cursor: 'pointer',
              transition: 'color 0.3s',
              padding: 0,
              display: 'flex',
            }}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && (
        <p style={{ fontSize: '0.625rem', color: 'var(--av-error)', marginTop: '0.25rem' }}>{error}</p>
      )}
    </div>
  );
}

/**
 * PremiumPasswordStrength — Animated 3-bar strength indicator.
 *
 * Props:
 *   - password (string)
 */
export function PremiumPasswordStrength({ password = '' }) {
  const hasLower    = /[a-z]/.test(password);
  const hasUpper    = /[A-Z]/.test(password);
  const hasDigit    = /\d/.test(password);
  const hasMinLen   = password.length >= 8;
  const checks      = [hasMinLen, hasLower, hasUpper, hasDigit].filter(Boolean).length;
  const strength    = password.length === 0 ? 0 : checks <= 2 ? 1 : checks === 3 ? 2 : 3;
  const labels      = ['', 'Weak', 'Good', 'Strong'];
  const barClasses  = ['', 'av-strength-bar--weak', 'av-strength-bar--good', 'av-strength-bar--strong'];
  const labelColors = ['', 'var(--av-error)', 'var(--av-orange)', 'var(--av-success)'];

  if (password.length === 0) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`av-strength-bar ${strength >= level ? barClasses[strength] : ''}`}
          />
        ))}
      </div>
      <p style={{ fontSize: '0.625rem', marginTop: '0.25rem', color: labelColors[strength] }}>
        {labels[strength]}
      </p>
    </div>
  );
}
