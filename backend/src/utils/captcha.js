/**
 * Google reCAPTCHA v2 server-side verification.
 */
const SettingsService = require('../admin/settings.service');

/**
 * Verify a reCAPTCHA response token with Google's API.
 * Returns { success: true } or { success: false, error: string }.
 *
 * If no secret key is configured, verification is skipped (returns success).
 * This allows dev/staging environments to work without CAPTCHA keys.
 */
async function verifyCaptcha(token) {
  let secretKey;
  try {
    // Use a timeout to avoid hanging if Firestore is unavailable
    secretKey = await Promise.race([
      SettingsService.get('RECAPTCHA_SECRET_KEY'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
  } catch {
    // Settings not available or timed out — skip verification
    return { success: true };
  }

  // If no secret key configured, skip verification (allows dev/staging to work)
  if (!secretKey) return { success: true };

  // Secret key is configured — token is now required
  if (!token) return { success: false, error: 'CAPTCHA verification is required' };

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    const res = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (data.success) return { success: true };
    return { success: false, error: 'CAPTCHA verification failed' };
  } catch (err) {
    console.error('[CAPTCHA] Verification error:', err.message);
    // Fail open if Google is unreachable (to avoid locking out users)
    return { success: true };
  }
}

module.exports = { verifyCaptcha };
