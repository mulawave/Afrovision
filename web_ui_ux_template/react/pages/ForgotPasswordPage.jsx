// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Forgot Password Page (fully implemented)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import PremiumScaffold from '../components/PremiumScaffold.jsx';
import PremiumTextField from '../components/PremiumTextField.jsx';
import { PremiumButton } from '../components/PremiumButton.jsx';
import { PremiumLogo } from '../components/PremiumNavigation.jsx';
import { PremiumBanner } from '../components/PremiumFeedback.jsx';

/**
 * ForgotPasswordPage — Email-only form, shows success state after submission.
 *
 * Props:
 *   - onSubmit(email)  → Promise<{ ok, error? }>
 *   - onBackToLogin()
 *   - brandName, brandLetter
 */
export default function ForgotPasswordPage({
  onSubmit,
  onBackToLogin,
  brandName = 'AfroVision',
  brandLetter = 'A',
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(email.trim());
      if (result?.ok) {
        setSuccess(true);
      } else {
        setError(result?.error || 'Something went wrong');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    }
    setIsSubmitting(false);
  };

  return (
    <PremiumScaffold>
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem 1.5rem' }}>
        <div style={{ width: '100%', maxWidth: '28rem' }} className="av-animate-fade-in-up">
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <PremiumLogo brandName={brandName} brandLetter={brandLetter} href="/" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--av-white)', marginTop: '1.5rem' }}>Reset your password</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--av-light-orange)', marginTop: '0.25rem' }}>
              Enter your email and we'll send you a reset link
            </p>
          </div>

          {/* Card */}
          <div className="av-card" style={{ padding: '1.5rem 2rem' }}>
            {success ? (
              /* ── Success State ── */
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: 'rgba(76, 175, 80, 0.15)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#34D399">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--av-white)', marginBottom: '0.5rem' }}>
                  Check your email
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--av-light-orange)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                  If an account exists for <strong style={{ color: 'var(--av-white)' }}>{email}</strong>, you'll receive a password reset link.
                </p>
                {onBackToLogin && (
                  <button
                    onClick={onBackToLogin}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      borderRadius: 'var(--av-radius-full)',
                      background: 'var(--av-gradient-cta)',
                      color: 'var(--av-dark-blue)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                  >
                    Back to Sign In
                  </button>
                )}
              </div>
            ) : (
              /* ── Form ── */
              <>
                {error && (
                  <PremiumBanner type="error" className="av-mb-5">
                    {error}
                  </PremiumBanner>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <PremiumTextField
                    label="Email address"
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumButton type="submit" fullWidth loading={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </PremiumButton>
                </form>

                {onBackToLogin && (
                  <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--av-light-orange)', marginTop: '1.5rem' }}>
                    Remember your password?{' '}
                    <button
                      type="button"
                      onClick={onBackToLogin}
                      style={{ background: 'none', border: 'none', color: 'var(--av-orange)', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </PremiumScaffold>
  );
}
