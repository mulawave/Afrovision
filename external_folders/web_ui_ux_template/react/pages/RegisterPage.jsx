// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Register Page (fully implemented)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import PremiumScaffold from '../components/PremiumScaffold.jsx';
import PremiumTextField, { PremiumPasswordStrength } from '../components/PremiumTextField.jsx';
import { PremiumButton } from '../components/PremiumButton.jsx';
import { PremiumLogo } from '../components/PremiumNavigation.jsx';
import { PremiumBanner } from '../components/PremiumFeedback.jsx';

/**
 * RegisterPage — Full registration page with email, password + confirm,
 * password strength indicator, referral code, terms, loading/error states.
 *
 * Props:
 *   - onSubmit(email, password, referralCode?)  → Promise<{ ok, error? }>
 *   - onLogin()
 *   - brandName, brandLetter
 *   - subtitle
 */
export default function RegisterPage({
  onSubmit,
  onLogin,
  brandName = 'AfroVision',
  brandLetter = 'A',
  subtitle = 'Join the community',
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Password validation
  const hasLower    = /[a-z]/.test(password);
  const hasUpper    = /[A-Z]/.test(password);
  const hasDigit    = /\d/.test(password);
  const hasMinLen   = password.length >= 8;
  const passesAll   = hasLower && hasUpper && hasDigit && hasMinLen;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (!passesAll) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and a number');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(email.trim(), password, referralCode.trim() || undefined);
      if (!result?.ok) {
        setError(result?.error || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    }
    setIsSubmitting(false);
  };

  const passwordMismatch = confirmPassword && confirmPassword !== password;

  return (
    <PremiumScaffold>
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem 1.5rem' }}>
        <div style={{ width: '100%', maxWidth: '28rem' }} className="av-animate-fade-in-up">
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <PremiumLogo brandName={brandName} brandLetter={brandLetter} href="/" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--av-white)', marginTop: '1.5rem' }}>Create your account</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--av-light-orange)', marginTop: '0.25rem' }}>{subtitle}</p>
          </div>

          {/* Card */}
          <div className="av-card" style={{ padding: '1.5rem 2rem' }}>
            {error && (
              <PremiumBanner type="error" className="av-mb-5">
                {error}
              </PremiumBanner>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <PremiumTextField
                label="Email address"
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting}
              />

              <div>
                <PremiumTextField
                  label="Password"
                  id="reg-password"
                  isPassword
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, upper + lower + number"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
                <PremiumPasswordStrength password={password} />
              </div>

              <PremiumTextField
                label="Confirm password"
                id="reg-confirm"
                isPassword
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                error={passwordMismatch ? 'Passwords do not match' : ''}
              />

              <PremiumTextField
                label={<>Referral code <span style={{ fontWeight: 400, color: 'var(--av-light-orange)' }}>(optional)</span></>}
                id="reg-referral"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Enter referral code"
                autoComplete="off"
                disabled={isSubmitting}
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

              <PremiumButton
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={!agreedToTerms}
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </PremiumButton>
            </form>

            {/* Divider */}
            <div className="av-divider"><span>or</span></div>

            {/* Login link */}
            {onLogin && (
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--av-light-orange)' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onLogin}
                  style={{ background: 'none', border: 'none', color: 'var(--av-orange)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

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
