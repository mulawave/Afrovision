/**
 * Google reCAPTCHA verification.
 *
 * Uses reCAPTCHA Enterprise assessments through the official Google client.
 * Falls back to v2 siteverify only when Enterprise is not configured.
 */
const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');
const SettingsService = require('../admin/settings.service');

const DEFAULT_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'raven-ai-6ff76';
const DEFAULT_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || '6LeuIsEsAAAAAO6xD7D08pQAraweXcxw9pHBg94k';
const MIN_ENTERPRISE_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || 0.3);

let enterpriseClient = null;

function getEnterpriseClient() {
  if (!enterpriseClient) {
    enterpriseClient = new RecaptchaEnterpriseServiceClient();
  }
  return enterpriseClient;
}

async function getSettingWithTimeout(key, timeoutMs = 3000) {
  return Promise.race([
    SettingsService.get(key),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ]);
}

async function verifyCaptchaEnterprise(token, expectedAction, siteKey, projectId) {
  const client = getEnterpriseClient();
  const parent = client.projectPath(projectId);

  const [response] = await client.createAssessment({
    parent,
    assessment: {
      event: {
        token,
        siteKey,
      },
    },
  });

  const tokenProps = response?.tokenProperties || {};
  if (!tokenProps.valid) {
    const invalidReason = tokenProps.invalidReason || 'UNKNOWN';
    return { success: false, error: `CAPTCHA token invalid (${invalidReason})` };
  }

  if (expectedAction && tokenProps.action !== expectedAction) {
    return { success: false, error: 'CAPTCHA action mismatch' };
  }

  const score = Number(response?.riskAnalysis?.score || 0);
  if (score < MIN_ENTERPRISE_SCORE) {
    return { success: false, error: 'CAPTCHA risk check failed' };
  }

  return { success: true, score };
}

/**
 * Verify a reCAPTCHA response token with Google's APIs.
 * Returns { success: true } or { success: false, error: string }.
 *
 * If no secret key is configured, verification is skipped (returns success).
 * This allows dev/staging environments to work without CAPTCHA keys.
 */
async function verifyCaptcha(token, expectedAction = 'LOGIN') {
  let secretKey;
  let siteKey;
  let environment;
  try {
    [secretKey, siteKey, environment] = await Promise.all([
      getSettingWithTimeout('RECAPTCHA_SECRET_KEY'),
      getSettingWithTimeout('RECAPTCHA_SITE_KEY'),
      getSettingWithTimeout('ENVIRONMENT').catch(() => 'production'),
    ]);
  } catch {
    // If settings are unreachable in production, do not bypass checks.
    return { success: false, error: 'CAPTCHA service unavailable' };
  }

  const effectiveSiteKey = siteKey || DEFAULT_SITE_KEY;
  const effectiveProjectId = DEFAULT_PROJECT_ID;

  if (effectiveSiteKey) {
    if (!token) return { success: false, error: 'CAPTCHA verification is required' };
    try {
      return await verifyCaptchaEnterprise(token, expectedAction, effectiveSiteKey, effectiveProjectId);
    } catch (err) {
      console.error('[CAPTCHA] Enterprise verification error:', err.message);
      if (String(environment || '').toLowerCase() !== 'staging') {
        return { success: false, error: 'CAPTCHA verification unavailable' };
      }
      // In staging only, continue to v2 fallback path below where configured.
    }
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
