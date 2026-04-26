/**
 * Google Play Integrity API verification.
 *
 * Validates that a login/register request originated from the genuine, unmodified
 * AfroVision Android app on a real device. Used in place of reCAPTCHA for mobile
 * app requests. The website continues to use reCAPTCHA Enterprise.
 *
 * How it works:
 *   1. Flutter app derives a nonce: base64url(sha256(email + minuteFloor))
 *   2. Flutter calls PlayIntegrity SDK with that nonce → gets a signed token from Google
 *   3. Backend calls this module → decodes token via Play Integrity API
 *   4. Verifies app recognition verdict and nonce match (±1 min window for clock skew)
 */

const crypto = require('crypto');
const https = require('https');

const PACKAGE_NAME = 'com.afrovision.afrovision';

/**
 * Derives the expected nonce for a given email and minute offset.
 * Must match the client derivation in integrity_service.dart exactly.
 *
 * Client: base64Url.encode(sha256(lowercaseTrimmedEmail + minuteFloor))
 * Server: same formula using Node crypto
 */
function deriveNonce(email, minuteOffset = 0) {
  const minute = Math.floor(Date.now() / 60000) + minuteOffset;
  const input = email.trim().toLowerCase() + minute.toString();
  return crypto.createHash('sha256').update(input).digest('base64url');
}

/**
 * Obtain a GCP OAuth2 access token using Firebase Admin's application credentials.
 * Reuses the same ADC (Application Default Credentials) as Firestore — no extra config needed.
 */
async function getAccessToken() {
  const admin = require('firebase-admin');
  // Firebase Admin is already initialized via Firestore; this call is a no-op if so.
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const tokenResult = await admin.app().options.credential.getAccessToken();
  return tokenResult.access_token;
}

/**
 * POST to the Play Integrity decodeIntegrityToken endpoint.
 */
function decodeIntegrityToken(integrityToken, accessToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ integrity_token: integrityToken });

    const options = {
      method: 'POST',
      hostname: 'playintegrity.googleapis.com',
      path: `/v1/${PACKAGE_NAME}:decodeIntegrityToken`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Play Integrity API ${res.statusCode}: ${data}`));
          } else {
            resolve(parsed);
          }
        } catch (err) {
          reject(new Error(`Play Integrity response parse error: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Verify a Play Integrity token submitted by the Android app.
 *
 * Accepted appRecognitionVerdicts:
 *   - PLAY_RECOGNIZED        → genuine Play Store production install
 *   - UNRECOGNIZED_VERSION   → known app but unreviewed version (test track / pre-release APK)
 *
 * Rejected verdicts (UNEVALUATED, UNRECOGNIZED) indicate a sideloaded or tampered APK.
 *
 * @param {string} integrityToken  Token from the Android Play Integrity SDK
 * @param {string} email           Email used in the login/register request
 * @returns {{ success: boolean, error?: string }}
 */
async function verifyPlayIntegrity(integrityToken, email) {
  if (!integrityToken) {
    return { success: false, error: 'Integrity token is required' };
  }
  if (!email) {
    return { success: false, error: 'Email is required for integrity verification' };
  }

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('[PlayIntegrity] Access token error:', err.message);
    return { success: false, error: 'Integrity service unavailable' };
  }

  let payload;
  try {
    const response = await decodeIntegrityToken(integrityToken, accessToken);
    payload = response.tokenPayloadExternal;
  } catch (err) {
    console.error('[PlayIntegrity] Decode error:', err.message);
    return { success: false, error: 'Integrity verification failed' };
  }

  if (!payload) {
    return { success: false, error: 'Integrity response malformed' };
  }

  // 1. Verify app recognition verdict
  const appVerdict = payload?.appIntegrity?.appRecognitionVerdict;
  const allowedVerdicts = ['PLAY_RECOGNIZED', 'UNRECOGNIZED_VERSION'];
  if (!allowedVerdicts.includes(appVerdict)) {
    console.warn(`[PlayIntegrity] Rejected app verdict: ${appVerdict}`);
    return { success: false, error: 'App integrity check failed' };
  }

  // 2. Verify nonce — accept current minute, previous minute, next minute (±1 for clock skew)
  const receivedNonce = payload?.requestDetails?.nonce;
  const nonceValid = [0, -1, 1].some((offset) => deriveNonce(email, offset) === receivedNonce);
  if (!nonceValid) {
    console.warn('[PlayIntegrity] Nonce mismatch — possible replay or tampered request');
    return { success: false, error: 'Integrity token invalid' };
  }

  return { success: true };
}

module.exports = { verifyPlayIntegrity };
