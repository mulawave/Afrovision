const bcrypt = require('bcrypt');
const crypto = require('crypto');
const https = require('https');
const User = require('../users/user.model');
const { generateToken } = require('../utils/jwt');
const { getFirestore } = require('../utils/firestore');
const ReferralModel = require('../referrals/referral.model');
const { verifyCaptcha } = require('../utils/captcha');
const { verifyPlayIntegrity } = require('../utils/play_integrity');
const SmtpService = require('../admin/smtp.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

async function register(req, res, next) {
  try {
    const { email, password, captchaToken, integrityToken, client } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!STRONG_PASSWORD.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, and a digit' });
    }

    // Mobile app (client === 'mobile') bypasses both Play Integrity and reCAPTCHA.
    // Mobile app sends integrityToken (Play Integrity); website sends captchaToken (reCAPTCHA).
    if (client !== 'mobile') {
      if (integrityToken) {
        const integrityResult = await verifyPlayIntegrity(integrityToken, email);
        if (!integrityResult.success) {
          return res.status(400).json({ error: integrityResult.error || 'Integrity verification failed' });
        }
      } else {
        const captchaResult = await verifyCaptcha(captchaToken, 'REGISTER');
        if (!captchaResult.success) {
          return res.status(400).json({ error: captchaResult.error || 'CAPTCHA verification failed' });
        }
      }
    }

    if (User.findByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email, passwordHash });
    const token = await generateToken(user.id);

    // Initialise referral record for this new user
    // If a referral code was provided, resolve the referrer first
    const { referral_code } = req.body;
    let referrerUid = null;
    if (referral_code) {
      const referrerRecord = ReferralModel.findByCode(referral_code);
      if (referrerRecord && referrerRecord.uid !== user.id) {
        referrerUid = referrerRecord.uid;
      }
    }

    await ReferralModel.ensureReferral(user.id, referrerUid);

    // Record the invite on the referrer's side (async, non-blocking)
    if (referrerUid) {
      ReferralModel.recordInvite(referrerUid, user.id).catch((err) => {
        console.error('[Auth] referral recordInvite error:', err.message);
      });
    }

    res.status(201).json({ token, user: User.toSafeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  const { email, password, captchaToken, integrityToken, client } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = User.findByEmail(normalizedEmail);

    // Admin logins and mobile app logins (client === 'mobile') bypass all verification.
    // Mobile app sends integrityToken (Play Integrity); website sends captchaToken (reCAPTCHA).
    if ((!user || user.role !== 'admin') && client !== 'mobile') {
      if (integrityToken) {
        const integrityResult = await verifyPlayIntegrity(integrityToken, normalizedEmail);
        if (!integrityResult.success) {
          return res.status(400).json({ error: integrityResult.error || 'Integrity verification failed' });
        }
      } else {
        const captchaResult = await verifyCaptcha(captchaToken, 'LOGIN');
        if (!captchaResult.success) {
          return res.status(400).json({ error: captchaResult.error || 'CAPTCHA verification failed' });
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await generateToken(user.id);
    res.json({ token, user: User.toSafeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  const user = await User.reloadFromFirestore(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: User.toSafeUser(user) });
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = User.findByEmail(normalizedEmail);
    if (user) {
      const websiteUrl = process.env.WEBSITE_URL;
      if (!websiteUrl) {
        return res.status(503).json({ error: 'WEBSITE_URL is not configured' });
      }

      const token = await User.storeResetToken(user.id);

      try {
        const resetUrl = new URL('/reset-password', websiteUrl);
        resetUrl.searchParams.set('token', token);
        await SmtpService.sendPasswordResetEmail({
          toEmail: user.email,
          resetUrl: resetUrl.toString(),
        });
      } catch (emailError) {
        console.error('[Auth] forgotPassword email error:', emailError.message);
      }
    }

    // Always return the same response to prevent user enumeration
    res.json({ message: 'If that email is registered, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (!STRONG_PASSWORD.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, and a digit' });
  }

  const entry = User.validateResetToken(token);
  if (!entry) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await User.updatePassword(entry.userId, passwordHash);
  await User.deleteResetToken(token);

  res.json({ message: 'Password reset successful' });
}

function logout(req, res) {
  // Frontend handles token deletion — backend is a no-op
  res.json({ message: 'Logged out' });
}

// ─── PAK Login (exact raven_lib handleLogin flow) ──────────────────────────

/**
 * Call CI3 legacy API: POST https://vee-pin.com/app/api/v2/wallet_login
 * Returns parsed JSON body or null on failure.
 */
function ci3WalletLogin(walletAddress) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ wallet_address: walletAddress });
    const req = https.request(
      'https://vee-pin.com/app/api/v2/wallet_login',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

/**
 * Derive deterministic UID: sha1("raven:{vpinId}:{emailLower}")
 * Matches raven_lib/services/app_identity.dart exactly.
 */
function deriveUid(vpinId, emailLower) {
  return crypto.createHash('sha1').update(`raven:${vpinId}:${emailLower}`).digest('hex');
}

/**
 * Convert CI3 API response into the same field shape as Firestore user doc.
 * Mirrors UserProfile field names from raven_lib/models/user_profile.dart.
 */
function ci3ToProfile(data) {
  const s = (v) => (v == null ? '' : String(v));
  return {
    email: s(data.email),
    firstname: s(data.firstname),
    middlename: s(data.middlename),
    lastname: s(data.lastname),
    wallet: s(data.wallet),
    slots: s(data.slots),
    tokens: s(data.tokens),
    phone: s(data.phone),
    address: s(data.address),
    city: s(data.city),
    state: s(data.state),
    country: s(data.country),
    ppic: s(data.ppic),
    currency: s(data.currency),
    refCode: s(data.refCode),
    rank: s(data.rank),
    k_type: s(data.k_type),
    kyc_4: s(data.kyc_4),
    kyc_5: s(data.kyc_5),
    mobile: s(data.mobile),
    earnings: s(data.earnings),
    stake_wallet: s(data.stake_wallet),
    blockchain_tokens: s(data.blockchain_tokens),
    equity_percentage: s(data.equity_percentage),
  };
}

/**
 * Convert Firestore user doc into the same flat profile shape.
 * Mirrors UserProfile.fromFirestoreMap from raven_lib.
 */
function firestoreToProfile(data, docId) {
  const s = (v) => (v == null ? '' : String(v));
  return {
    id: docId,
    email: s(data.email),
    firstname: s(data.firstName),
    middlename: s(data.middleName || data.middlename),
    lastname: s(data.lastName),
    wallet: s(data.cash),
    slots: s(data.slots),
    tokens: s(data.vpt),
    phone: s(data.phone || data.mobile),
    address: s(data.address),
    city: s(data.city),
    state: s(data.state),
    country: s(data.country),
    ppic: s(data.profilePicture),
    currency: s(data.currency || 'NGN'),
    refCode: s(data.refCode),
    rank: s(data.level),
    k_type: s(data.kyc_type),
    kyc_4: s(data.kyc_id),
    kyc_5: s(data.kyc_5),
    mobile: s(data.mobile),
    earnings: s(data.profit),
    stake_wallet: s(data.stake_wallet),
    blockchain_tokens: s(data.blockchain_tokens),
    equity_percentage: s(data.equity_percentage),
  };
}

async function pakLogin(req, res) {
  const { pak } = req.body;

  if (!pak || typeof pak !== 'string' || pak.trim().length < 5) {
    return res.status(400).json({ error: 'Please enter a valid PAK' });
  }

  const trimmedPak = pak.trim();

  try {
    const db = getFirestore();

    // Step 1: Try CI3 legacy API
    let profile = null;
    let fromFirestore = false;
    let firestoreDocId = null;

    const ci3Data = await ci3WalletLogin(trimmedPak);
    if (ci3Data && ci3Data.email) {
      profile = ci3ToProfile(ci3Data);
    }

    // Step 2: Firestore fallback chain (paks → invites → users)
    if (!profile) {
      const pakSnap = await db.collection('paks').doc(trimmedPak).get();
      if (pakSnap.exists) {
        const pakData = pakSnap.data() || {};
        const inviteId = (pakData.reservedByInvite || '').trim();
        if (inviteId) {
          const inviteSnap = await db.collection('invites').doc(inviteId).get();
          if (inviteSnap.exists) {
            const inviteData = inviteSnap.data() || {};
            const uid = (inviteData.consumedByUid || '').trim();
            if (uid) {
              const userSnap = await db.collection('users').doc(uid).get();
              if (userSnap.exists) {
                profile = firestoreToProfile(userSnap.data(), userSnap.id);
                fromFirestore = true;
                firestoreDocId = userSnap.id;
              }
            }
          }
        }
      }
    }

    if (!profile) {
      return res.status(401).json({ error: 'ACCESS DENIED! Account not found' });
    }
    if (!profile.email) {
      return res.status(401).json({ error: 'Invalid user data: email is missing' });
    }

    const emailLower = profile.email.trim().toLowerCase();
    const derivedUid = deriveUid(trimmedPak, emailLower);

    // Step 3: Resolve canonical UID (exact same logic as raven_lib user_manager.dart)
    let canonicalUid;
    if (fromFirestore && firestoreDocId) {
      canonicalUid = firestoreDocId;
    } else {
      // Query by emailLower first
      const byEmail = await db.collection('users').where('emailLower', '==', emailLower).limit(1).get();
      if (!byEmail.empty) {
        canonicalUid = byEmail.docs[0].id;
      } else {
        // Query by vpinId
        const byPak = await db.collection('users').where('vpinId', '==', trimmedPak).limit(1).get();
        canonicalUid = !byPak.empty ? byPak.docs[0].id : derivedUid;
      }
    }

    // Step 4: Read existing doc to preserve fields
    const userRef = db.collection('users').doc(canonicalUid);
    const existingSnap = await userRef.get();
    const existing = existingSnap.exists ? existingSnap.data() : null;

    // Determine existing coins (same logic as raven_lib)
    let existingCoinsNum = null;
    const coinsVal = existing ? (existing.coins ?? existing.ravens) : null;
    if (typeof coinsVal === 'number') existingCoinsNum = coinsVal;
    else if (typeof coinsVal === 'string') {
      const parsed = parseInt(coinsVal, 10);
      if (!isNaN(parsed)) existingCoinsNum = parsed;
    }

    // Step 5: Build merge data (exact same fields as raven_lib user_manager.dart)
    const baseData = {
      firstName: profile.firstname,
      middleName: profile.middlename,
      lastName: profile.lastname,
      email: profile.email,
      emailLower,
      profilePicture: profile.ppic,
      isVerified: existing?.isVerified ?? false,

      cash: Number(existing?.cash ?? profile.wallet) || 0,
      vpt: Number(existing?.vpt ?? profile.tokens) || 0,
      currency: existing?.currency ?? (profile.currency || 'NGN'),
      slots: existing?.slots ?? profile.slots,
      level: existing?.level ?? (profile.rank || 5),

      tagsCount: existing?.tagsCount ?? 0,
      badges: existing?.badges ?? [],
      lastTagDate: existing?.lastTagDate ?? null,
      streakCount: existing?.streakCount ?? 0,
      deviceToken: existing?.deviceToken ?? '',

      vpinId: trimmedPak,
      isAdmin: existing?.isAdmin ?? false,

      blockchain_tokens: existing?.blockchain_tokens ?? profile.blockchain_tokens,
      equity_percentage: existing?.equity_percentage ?? profile.equity_percentage,
      profit: existing?.profit ?? profile.earnings,

      kyc_type: existing?.kyc_type ?? profile.k_type,
      kyc_id: existing?.kyc_id ?? profile.kyc_4,
      kyc_5: existing?.kyc_5 ?? profile.kyc_5,

      mobile: existing?.mobile ?? profile.mobile,
      refCode: existing?.refCode ?? profile.refCode,

      // ── AfroVision-required fields (must exist for toSafeUser) ──
      role: existing?.role ?? 'viewer',
      is_premium_creator: existing?.is_premium_creator ?? false,
      kyc_status: existing?.kyc_status ?? 'none',
      subscription_plan: existing?.subscription_plan ?? null,
      subscription_status: existing?.subscription_status ?? 'inactive',
      subscription_expiry: existing?.subscription_expiry ?? null,
      preferred_currency: existing?.preferred_currency ?? (profile.currency || 'NGN'),
      vpt: existing?.vpt ?? 0,
      first_subscription_at: existing?.first_subscription_at ?? null,
      following_creator_ids: existing?.following_creator_ids ?? [],
      fcm_tokens: existing?.fcm_tokens ?? [],
      created_at: existing?.created_at ?? new Date().toISOString(),
    };

    if (existingCoinsNum == null) {
      baseData.coins = 0;
    }

    // Step 6: Merge write to Firestore
    await userRef.set(baseData, { merge: true });

    // Step 7: Reload in-memory user store so the user appears in the backend
    await User.reinit();

    // Step 8: Find the user in-memory and generate a JWT
    const inMemUser = User.findById(canonicalUid);
    if (!inMemUser) {
      return res.status(500).json({ error: 'User sync failed after PAK login' });
    }

    const token = await generateToken(canonicalUid);

    res.json({
      token,
      user: User.toSafeUser(inMemUser),
      pak_login: true,
      canonical_uid: canonicalUid,
    });
  } catch (err) {
    console.error('[PAK Login] error:', err);
    res.status(500).json({ error: 'PAK login failed. Please try again.' });
  }
}

// ─── Wallet Login ──────────────────────────────────────────────

/**
 * POST /auth/wallet-login
 * Authenticate via a connected BSC wallet address.
 * Only works if an existing user has linked this wallet to their account.
 * Does NOT create new accounts.
 */
const WalletModel = require('../wallet/wallet.model');

async function walletLogin(req, res, next) {
  try {
    const { address } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'A wallet address is required' });
    }

    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return res.status(400).json({ error: 'Invalid BSC wallet address format' });
    }

    // Look up wallet record by connected_wallet_address
    const walletRecord = WalletModel.findByConnectedWalletAddress(trimmed);
    if (!walletRecord) {
      return res.status(404).json({
        error: 'No account is linked to this wallet address. Please create an account first, then link your wallet under Wallet → Connect Wallet to enable wallet login. Alternatively, import your account via Login with PAK and link your wallet.',
      });
    }

    // Resolve user from wallet's user_id
    const user = User.findById(walletRecord.user_id);
    if (!user) {
      return res.status(404).json({
        error: 'The linked account could not be found. Please contact support.',
      });
    }

    const token = await generateToken(user.id);
    res.json({ token, user: User.toSafeUser(user), wallet_login: true });
  } catch (err) {
    console.error('[Wallet Login] error:', err);
    next(err);
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword, logout, pakLogin, walletLogin };
