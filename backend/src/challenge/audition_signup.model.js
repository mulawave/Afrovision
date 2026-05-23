/**
 * Audition Signup model — AV-CHL-002
 *
 * Dedicated storage contract for paid audition signups.
 * Kept strictly separate from challenge_registrations (contestant
 * progression) so paid participants can be managed, filtered, and
 * exported independently.
 *
 * Collection: audition_signups
 *
 * Lifecycle:
 *   signup_status: pending_payment → enrolled  (on payment confirmed)
 *                  pending_payment → cancelled  (on payment failed / abandoned)
 *
 *   payment_status: pending → paid | failed
 */
'use strict';
const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'audition_signups';

// ── Allowed payment statuses ──────────────────────────────────────────────
const PAYMENT_STATUSES = ['pending', 'paid', 'failed'];

// ── Allowed signup statuses ───────────────────────────────────────────────
const SIGNUP_STATUSES = ['pending_payment', 'enrolled', 'cancelled'];

// ── In-memory read-through cache ──────────────────────────────────────────
const cache = new Map();

function _isIndexError(error) {
  const message = error?.message || '';
  return message.includes('requires an index') || message.includes('FAILED_PRECONDITION');
}

function _createdAtMs(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function _sync(doc) {
  if (doc && doc.id) cache.set(doc.id, doc);
  return doc;
}

async function _persist(doc) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(doc.id).set(doc);
}

// ── Create ────────────────────────────────────────────────────────────────

/**
 * Create a new audition signup record in pending_payment state.
 * Called when a user initiates audition signup (before payment completes).
 *
 * @param {object} data
 * @param {string} data.challenge_id
 * @param {string} data.user_id
 * @param {string} data.email
 * @param {string} [data.name]
 * @param {string} [data.payment_reference]     - provider payment ref / order ID
 * @param {number} [data.vpt_price_at_signup]   - live vPT price in NGN at signup time
 * @param {number} [data.vpt_allocated]         - computed participant vPT units
 * @param {number} [data.community_pool_allocated] - computed community pool vPT units
 * @param {number} [data.ops_pool_allocated]    - computed ops pool vPT units
 * @param {string[]} [data.campaign_tags]
 */
async function createSignup(data) {
  const now = new Date().toISOString();
  const signup = {
    id: `as_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,

    // ── Identity ─────────────────────────────────────────────────────────
    challenge_id: data.challenge_id,
    user_id: data.user_id,
    email: data.email,
    name: data.name || null,

    // ── Payment ──────────────────────────────────────────────────────────
    payment_reference: data.payment_reference || null,
    payment_status: 'pending',          // pending | paid | failed
    payment_amount_ngn: 2500,           // fixed audition fee

    // ── vPT Allocation ───────────────────────────────────────────────────
    // Populated at payment-confirmation time (AV-CHL-005 / AV-CHL-006).
    // Stored here as part of the signup record for auditability.
    vpt_price_at_signup: data.vpt_price_at_signup || null,
    vpt_allocated: data.vpt_allocated || null,           // participant reward
    community_pool_allocated: data.community_pool_allocated || null,
    ops_pool_allocated: data.ops_pool_allocated || null,
    vpt_credited: false,
    allocation_tx_id: null,

    // ── Signup lifecycle ─────────────────────────────────────────────────
    signup_status: 'pending_payment',   // pending_payment | enrolled | cancelled
    enrolled_at: null,
    cancelled_at: null,
    cancel_reason: null,

    // ── Communication ────────────────────────────────────────────────────
    email_sent: false,
    email_sent_at: null,
    email_error: null,
    email_retry_count: 0,
    email_last_attempt_at: null,

    // ── Segmentation / marketing ─────────────────────────────────────────
    consent_marketing: false,
    campaign_tags: Array.isArray(data.campaign_tags) ? data.campaign_tags : [],

    // ── Timestamps ───────────────────────────────────────────────────────
    created_at: now,
    updated_at: now,
  };

  await _persist(signup);
  return _sync(signup);
}

// ── Read ──────────────────────────────────────────────────────────────────

async function getSignupById(id) {
  if (cache.has(id)) return cache.get(id) || null;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return _sync({ ...doc.data(), id: doc.id });
}

/**
 * Fetch the most-recent signup for a user + challenge combination.
 * Used to prevent duplicate enrollments.
 */
async function getSignupByUserId(challengeId, userId) {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION)
    .where('challenge_id', '==', challengeId)
    .where('user_id', '==', userId)
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return _sync({ ...doc.data(), id: doc.id });
}

/**
 * List signups with optional filters.
 * Supports admin list views (AV-CHL-008) and segmentation queries.
 *
 * @param {object} opts
 * @param {string}  [opts.challenge_id]
 * @param {string}  [opts.payment_status]    - pending | paid | failed
 * @param {string}  [opts.signup_status]     - pending_payment | enrolled | cancelled
 * @param {boolean} [opts.email_sent]
 * @param {string}  [opts.search]            - matches email or name substring (client-side)
 * @param {number}  [opts.limit]
 * @param {number}  [opts.offset]
 */
async function listSignups({
  challenge_id,
  payment_status,
  signup_status,
  email_sent,
  search,
  limit = 50,
  offset = 0,
} = {}) {
  const db = getFirestore();
  let query = db.collection(COLLECTION);

  if (challenge_id) query = query.where('challenge_id', '==', challenge_id);
  if (payment_status) query = query.where('payment_status', '==', payment_status);
  if (signup_status) query = query.where('signup_status', '==', signup_status);
  if (email_sent !== undefined) query = query.where('email_sent', '==', email_sent);

  query = query.orderBy('created_at', 'desc');

  let items;
  try {
    const snap = await query.get();
    items = snap.docs.map((d) => _sync({ ...d.data(), id: d.id }));
  } catch (error) {
    if (!_isIndexError(error)) throw error;

    // Fallback for environments where composite indexes are not yet created.
    const snap = await db.collection(COLLECTION).get();
    items = snap.docs.map((d) => _sync({ ...d.data(), id: d.id }));

    if (challenge_id) items = items.filter((s) => s.challenge_id === challenge_id);
    if (payment_status) items = items.filter((s) => s.payment_status === payment_status);
    if (signup_status) items = items.filter((s) => s.signup_status === signup_status);
    if (email_sent !== undefined) items = items.filter((s) => s.email_sent === email_sent);

    items.sort((a, b) => _createdAtMs(b.created_at) - _createdAtMs(a.created_at));
  }

  // Client-side text search against email / name
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (s) =>
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.payment_reference && s.payment_reference.toLowerCase().includes(q)),
    );
  }

  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
  };
}

async function countSignups(challengeId, { payment_status, signup_status } = {}) {
  const db = getFirestore();
  let query = db.collection(COLLECTION).where('challenge_id', '==', challengeId);
  if (payment_status) query = query.where('payment_status', '==', payment_status);
  if (signup_status) query = query.where('signup_status', '==', signup_status);
  const snap = await query.count().get();
  return snap.data().count;
}

// ── Update ────────────────────────────────────────────────────────────────

/**
 * Partial update — only explicitly listed fields may be mutated.
 * All writes go through here so updated_at is always refreshed.
 */
async function updateSignup(id, fields) {
  const signup = await getSignupById(id);
  if (!signup) return null;

  const allowed = [
    'payment_reference',
    'payment_status',
    'vpt_price_at_signup',
    'vpt_allocated',
    'community_pool_allocated',
    'ops_pool_allocated',
    'vpt_credited',
    'allocation_tx_id',
    'signup_status',
    'enrolled_at',
    'cancelled_at',
    'cancel_reason',
    'email_sent',
    'email_sent_at',
    'email_error',
    'email_retry_count',
    'email_last_attempt_at',
    'campaign_tags',
    'name',
  ];

  for (const key of allowed) {
    if (fields[key] !== undefined) signup[key] = fields[key];
  }
  signup.updated_at = new Date().toISOString();

  await _persist(signup);
  return _sync(signup);
}

/**
 * Confirm payment and enrol participant atomically.
 * Idempotent: calling with the same payment_reference on an already-enrolled
 * signup returns the existing record unchanged.
 *
 * @param {string} signupId
 * @param {object} paymentData
 * @param {string} paymentData.payment_reference
 * @param {number} paymentData.vpt_price_at_signup
 * @param {number} paymentData.vpt_allocated
 * @param {number} paymentData.community_pool_allocated
 * @param {number} paymentData.ops_pool_allocated
 */
async function enrollSignup(signupId, paymentData) {
  const signup = await getSignupById(signupId);
  if (!signup) return null;

  // Idempotency guard
  if (signup.signup_status === 'enrolled') return signup;

  const now = new Date().toISOString();
  Object.assign(signup, {
    payment_status: 'paid',
    payment_reference: paymentData.payment_reference || signup.payment_reference,
    signup_status: 'enrolled',
    enrolled_at: now,
    vpt_price_at_signup: paymentData.vpt_price_at_signup,
    vpt_allocated: paymentData.vpt_allocated,
    community_pool_allocated: paymentData.community_pool_allocated,
    ops_pool_allocated: paymentData.ops_pool_allocated,
    updated_at: now,
  });

  await _persist(signup);
  return _sync(signup);
}

/**
 * Mark a signup as cancelled / failed payment.
 */
async function cancelSignup(signupId, reason = null) {
  const signup = await getSignupById(signupId);
  if (!signup) return null;
  if (signup.signup_status === 'enrolled') return signup; // cannot cancel enrolled

  const now = new Date().toISOString();
  Object.assign(signup, {
    payment_status: 'failed',
    signup_status: 'cancelled',
    cancelled_at: now,
    cancel_reason: reason,
    updated_at: now,
  });

  await _persist(signup);
  return _sync(signup);
}

// ── Delete ────────────────────────────────────────────────────────────────

async function deleteSignup(id) {
  const existing = await getSignupById(id);
  if (!existing) return null;
  cache.delete(id);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return existing;
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  PAYMENT_STATUSES,
  SIGNUP_STATUSES,
  COLLECTION,
  createSignup,
  getSignupById,
  getSignupByUserId,
  listSignups,
  countSignups,
  updateSignup,
  enrollSignup,
  cancelSignup,
  deleteSignup,
};
