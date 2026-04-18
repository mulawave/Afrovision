// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Login Page (fully implemented)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import PremiumScaffold from '../components/PremiumScaffold.jsx';
import PremiumTextField from '../components/PremiumTextField.jsx';
import { PremiumButton, PremiumOutlineButton } from '../components/PremiumButton.jsx';
import { PremiumLogo } from '../components/PremiumNavigation.jsx';
import { PremiumBanner } from '../components/PremiumFeedback.jsx';

/**
 * LoginPage — Full login page with email/password, terms checkbox,
 * error/success banners, loading state, and alternative login option.
 *
 * Props:
 *   - onSubmit(email, password)  → Promise<{ ok, error? }>
 *   - onForgotPassword()
 *   - onRegister()
 *   - onAlternativeLogin()       → optional second login method
 *   - alternativeLoginLabel      → e.g. "Login with PAK"
 *   - brandName, brandLetter     → logo customisation
 *   - subtitle                   → e.g. "Sign in to continue watching"
 *   - sessionExpired, justRegistered (bool) → info banners
 */
export default function LoginPage({
  onSubmit,
  onForgotPassword,
  onRegister,
  onAlternativeLogin,
  alternativeLoginLabel = 'Alternative Login',
  brandName = 'AfroVision',
  brandLetter = 'A',
  subtitle = 'Sign in to continue',
  sessionExpired = false,
  justRegistered = false,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(email.trim(), password);
      if (!result?.ok) {
        setError(result?.error || 'Invalid credentials');
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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--av-white)', marginTop: '1.5rem' }}>Welcome back</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--av-light-orange)', marginTop: '0.25rem' }}>{subtitle}</p>
          </div>

          {/* Card */}
          <div className="av-card" style={{ padding: '1.5rem 2rem' }}>
            {/* Session expired banner */}
            {sessionExpired && (
              <PremiumBanner type="warning" className="av-mb-5">
                ⏱ Your session expired. Please sign in again.
              </PremiumBanner>
            )}

            {/* Just registered banner */}
            {justRegistered && (
              <PremiumBanner type="success" className="av-mb-5">
                ✓ Account created! Sign in to get started.
              </PremiumBanner>
            )}

            {/* Error */}
            {error && (
              <PremiumBanner type="error" className="av-mb-5">
                {error}
              </PremiumBanner>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <PremiumTextField
                label="Email address"
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting}
              />

              <PremiumTextField
                label="Password"
                id="login-password"
                isPassword
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                rightAction={
                  onForgotPassword && (
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      style={{ background: 'none', border: 'none', color: 'var(--av-orange)', fontSize: '0.6875rem', cursor: 'pointer', transition: 'color 0.3s' }}
                    >
                      Forgot password?
                    </button>
                  )
                }
              />

              {/* Terms checkbox */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={isSubmitting}
                  style={{ marginTop: '0.125rem', accentColor: 'var(--av-orange)' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--av-light-orange)', lineHeight: 1.5 }}>
                  I agree to the <a href="/terms" style={{ color: 'var(--av-orange)' }}>Terms of Service</a>,{' '}
                  <a href="/privacy" style={{ color: 'var(--av-orange)' }}>Privacy Policy</a>, and{' '}
                  <a href="/cookies" style={{ color: 'var(--av-orange)' }}>Cookie Policy</a>.
                </span>
              </label>

              {/* Submit */}
              <PremiumButton
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={!agreedToTerms}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </PremiumButton>
            </form>

            {/* Divider */}
            {onAlternativeLogin && (
              <>
                <div className="av-divider"><span>or</span></div>
                <PremiumOutlineButton fullWidth onClick={onAlternativeLogin}>
                  {alternativeLoginLabel}
                </PremiumOutlineButton>
              </>
            )}

            {/* Register link */}
            {onRegister && (
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--av-light-orange)', marginTop: '1.25rem' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={onRegister}
                  style={{ background: 'none', border: 'none', color: 'var(--av-orange)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create one
                </button>
              </p>
            )}
          </div>

          {/* Back link */}
          <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a href="/" style={{ fontSize: '0.75rem', color: 'var(--av-light-orange)', textDecoration: 'none' }}>
              ← Back to home
            </a>
          </p>
        </div>
      </main>
    </PremiumScaffold>
  );
}
