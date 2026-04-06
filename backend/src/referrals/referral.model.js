const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'referrals';
const EARNINGS_COLLECTION = 'referral_earnings';

// 5-level referral distribution percentages
const LEVEL_DISTRIBUTION = [0.40, 0.20, 0.15, 0.15, 0.10];
// 1/3 of the 30% community pool goes to referral tree
const REFERRAL_POOL_FRACTION = 1 / 3;
// Base account email — fills any missing levels in the tree
const BASE_ACCOUNT_EMAIL = 'richardobroh@gmail.com';

// In-memory cache: Map<uid, referralObject>
const byUid = new Map();
// Map<code, uid> for fast lookup by code
const byCode = new Map();
// Map<uid, earningsArray> for referral earnings history
const earningsByUid = new Map();
let initialized = false;
let _baseAccountUid = null;

async function init() {
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    byUid.set(data.uid, data);
    byCode.set(data.referral_code, data.uid);
  });

  // Load earnings
  const earningsSnap = await db.collection(EARNINGS_COLLECTION).get();
  earningsSnap.forEach((doc) => {
    const data = doc.data();
    const uid = data.recipient_uid;
    if (!earningsByUid.has(uid)) earningsByUid.set(uid, []);
    earningsByUid.get(uid).push(data);
  });

  initialized = true;
}

function _generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function _persist(uid, data) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(uid).set(data, { merge: true });
}

/**
 * Resolve the base account UID (richardobroh@gmail.com).
 * Caches after first resolution.
 */
function getBaseAccountUid() {
  if (_baseAccountUid) return _baseAccountUid;
  // Lazy-require to avoid circular dependency at load time
  const User = require('../users/user.model');
  const baseUser = User.findByEmail(BASE_ACCOUNT_EMAIL);
  if (baseUser) {
    _baseAccountUid = baseUser.id;
  }
  return _baseAccountUid;
}

/**
 * Ensure a referral record exists for the given user.
 * @param {string} uid
 * @param {string|null} referredByUid - UID of the user who referred this user
 */
async function ensureReferral(uid, referredByUid = null) {
  if (byUid.has(uid)) return byUid.get(uid);

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (doc.exists) {
    const data = doc.data();
    byUid.set(data.uid, data);
    byCode.set(data.referral_code, data.uid);
    return data;
  }

  let code;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    code = _generateCode();
    if (!byCode.has(code)) break;
  }

  const referral = {
    uid,
    referral_code: code,
    referred_by: referredByUid || null, // Direct referrer's UID
    invited_count: 0,
    referrers: [],
    total_earnings_ngn: 0,
    total_earnings_vpt_units: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await _persist(uid, referral);
  byUid.set(uid, referral);
  byCode.set(code, uid);
  return referral;
}

function findByCode(code) {
  if (!code) return null;
  const uid = byCode.get(code.toUpperCase());
  return uid ? byUid.get(uid) : null;
}

function findByUid(uid) {
  return byUid.get(uid) || null;
}

/**
 * Record that newUserUid signed up using referrerUid's code.
 * Sets the referred_by relationship.
 */
async function recordInvite(referrerUid, newUserUid) {
  const referral = byUid.get(referrerUid);
  if (!referral) return false;

  if (referrerUid === newUserUid) return false;
  if (referral.referrers.includes(newUserUid)) return false;

  referral.referrers.push(newUserUid);
  referral.invited_count += 1;
  referral.updated_at = Date.now();
  byUid.set(referrerUid, referral);
  await _persist(referrerUid, {
    invited_count: referral.invited_count,
    referrers: referral.referrers,
    updated_at: referral.updated_at,
  });

  // Set referred_by on the new user's referral record
  const newUserReferral = byUid.get(newUserUid);
  if (newUserReferral && !newUserReferral.referred_by) {
    newUserReferral.referred_by = referrerUid;
    newUserReferral.updated_at = Date.now();
    byUid.set(newUserUid, newUserReferral);
    await _persist(newUserUid, {
      referred_by: referrerUid,
      updated_at: newUserReferral.updated_at,
    });
  }

  return true;
}

/**
 * Resolve the 5-level referral tree for a given user.
 * Returns an array of 5 UIDs — missing levels filled with the base account.
 * @param {string} subscriberUid - The user who made the subscription
 * @returns {string[]} Array of 5 UIDs [L1, L2, L3, L4, L5]
 */
function resolveTree(subscriberUid) {
  const baseUid = getBaseAccountUid();
  const tree = [];

  let currentUid = subscriberUid;
  for (let level = 0; level < 5; level++) {
    const record = byUid.get(currentUid);
    const referrerUid = record?.referred_by || null;

    if (referrerUid) {
      tree.push(referrerUid);
      currentUid = referrerUid;
    } else {
      // Fill remaining levels with base account
      while (tree.length < 5) {
        tree.push(baseUid || null);
      }
      break;
    }
  }

  // If tree still has fewer than 5 (shouldn't happen but safety), pad with base
  while (tree.length < 5) {
    tree.push(baseUid || null);
  }

  return tree;
}

/**
 * Record a referral earning.
 */
async function recordEarning({
  recipientUid,
  sourceUid,
  level,
  amountNgn,
  amountVptUnits,
  subscriptionId,
  creatorUid,
}) {
  const db = getFirestore();
  const earning = {
    id: crypto.randomUUID(),
    recipient_uid: recipientUid,
    source_uid: sourceUid,
    level,
    amount_ngn: amountNgn,
    amount_vpt_units: amountVptUnits,
    subscription_id: subscriptionId,
    creator_uid: creatorUid,
    created_at: Date.now(),
  };
  await db.collection(EARNINGS_COLLECTION).doc(earning.id).set(earning);

  if (!earningsByUid.has(recipientUid)) earningsByUid.set(recipientUid, []);
  earningsByUid.get(recipientUid).push(earning);

  // Update totals on referral record
  const referral = byUid.get(recipientUid);
  if (referral) {
    referral.total_earnings_ngn = (referral.total_earnings_ngn || 0) + amountNgn;
    referral.total_earnings_vpt_units = (referral.total_earnings_vpt_units || 0) + amountVptUnits;
    referral.updated_at = Date.now();
    byUid.set(recipientUid, referral);
    await _persist(recipientUid, {
      total_earnings_ngn: referral.total_earnings_ngn,
      total_earnings_vpt_units: referral.total_earnings_vpt_units,
      updated_at: referral.updated_at,
    });
  }

  return earning;
}

/**
 * Get earnings history for a user.
 */
function getEarnings(uid) {
  return (earningsByUid.get(uid) || []).sort((a, b) => b.created_at - a.created_at);
}

/**
 * Get the direct referrals (invited users) for a given user.
 */
function getDirectReferrals(uid) {
  const referral = byUid.get(uid);
  if (!referral) return [];
  return referral.referrers || [];
}

module.exports = {
  init,
  ensureReferral,
  findByCode,
  findByUid,
  recordInvite,
  resolveTree,
  recordEarning,
  getEarnings,
  getDirectReferrals,
  getBaseAccountUid,
  LEVEL_DISTRIBUTION,
  REFERRAL_POOL_FRACTION,
  BASE_ACCOUNT_EMAIL,
  EARNINGS_COLLECTION,
};
