/**
 * Challenge model — Firestore-backed.
 *
 * Manages challenge seasons ("pitches"), their lifecycle phases,
 * and contestant registrations.
 */
const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const CHALLENGES_COLLECTION = 'challenges';
const REGISTRATIONS_COLLECTION = 'challenge_registrations';

/* ── Lifecycle phases ─────────────────────────────────────────── */
const PHASES = ['pre-register', 'registration-and-audition', 'kickoff', 'running', 'incubation'];

/* ── In-memory cache ──────────────────────────────────────────── */
const challengesById = new Map();
const registrationsById = new Map();

function syncChallenge(challenge) {
  if (challenge && challenge.id) {
    challengesById.set(challenge.id, challenge);
  }
  return challenge;
}

function syncRegistration(registration) {
  if (registration && registration.id) {
    registrationsById.set(registration.id, registration);
  }
  return registration;
}

/* ── Persistence helpers ──────────────────────────────────────── */
async function persistChallenge(c) {
  const db = getFirestore();
  await db.collection(CHALLENGES_COLLECTION).doc(c.id).set(c);
}

async function persistRegistration(r) {
  const db = getFirestore();
  await db.collection(REGISTRATIONS_COLLECTION).doc(r.id).set(r);
}

/* ── Init ─────────────────────────────────────────────────────── */
async function init() {
  return [];
}

/* ── Challenge CRUD ───────────────────────────────────────────── */
async function createChallenge(data) {
  const challenge = {
    id: `ch_${crypto.randomUUID().split('-')[0]}`,
    title: data.title || 'AfroVision Challenge',
    subtitle: data.subtitle || 'Amazons',
    season: data.season || 1,
    phase: data.phase || 'registration-and-audition',
    status: data.status || 'active',
    description: data.description || '',
    prize_pool: data.prize_pool || '₦10,000,000',
    max_contestants: data.max_contestants || 15,
    video_min_seconds: data.video_min_seconds || 30,
    video_max_seconds: data.video_max_seconds || 60,
    // ── Audition Pricing (configurable per challenge) ─────────────────
    audition_price_ngn: data.audition_price_ngn || 2500,
    user_reward_vpt_ngn: data.user_reward_vpt_ngn || 1000,
    community_pool_vpt_ngn: data.community_pool_vpt_ngn || 500,
    ops_pool_ngn: data.ops_pool_ngn || 1000,
    // ──────────────────────────────────────────────────────────────────
    phases: {
      'pre-register': { start: data.pre_register_start || null, end: data.pre_register_end || null },
      'registration-and-audition': {
        start: data.registration_audition_start || data.registration_start || null,
        end: data.registration_audition_end || data.audition_end || null,
      },
      kickoff: { start: data.kickoff_start || null, end: data.kickoff_end || null },
      running: { start: data.running_start || null, end: data.running_end || null },
      incubation: { start: data.incubation_start || null, end: data.incubation_end || null },
    },
    prizes: data.prizes || [],
    rules: data.rules || [],
    judges: data.judges || [],
    sponsors: data.sponsors || [],
    banner_url: data.banner_url || null,
    trailer_url: data.trailer_url || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await persistChallenge(challenge);
  return syncChallenge(challenge);
}

async function updateChallenge(id, fields) {
  const ch = await getChallengeById(id);
  if (!ch) return null;
  const allowed = [
    'title', 'subtitle', 'season', 'phase', 'status', 'description', 'prize_pool',
    'max_contestants', 'video_min_seconds', 'video_max_seconds',
    'phases', 'prizes', 'rules', 'judges', 'sponsors',
    'banner_url', 'trailer_url', 'is_active',
    'audition_price_ngn', 'user_reward_vpt_ngn', 'community_pool_vpt_ngn', 'ops_pool_ngn',
  ];
  for (const key of allowed) {
    if (fields[key] !== undefined) ch[key] = fields[key];
  }
  ch.updated_at = new Date().toISOString();
  await persistChallenge(ch);
  return syncChallenge(ch);
}

async function getActiveChallenge() {
  const db = getFirestore();
  const snap = await db.collection(CHALLENGES_COLLECTION)
    .where('is_active', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return syncChallenge({ ...doc.data(), id: doc.id });
}

async function getChallengeById(id) {
  if (challengesById.has(id)) {
    return challengesById.get(id) || null;
  }

  const db = getFirestore();
  const doc = await db.collection(CHALLENGES_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return syncChallenge({ ...doc.data(), id: doc.id });
}

async function listChallenges() {
  const db = getFirestore();
  const snap = await db.collection(CHALLENGES_COLLECTION).get();
  return snap.docs
    .map((doc) => syncChallenge({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.season - a.season);
}

/* ── Registration (contestant sign-up) ────────────────────────── */
async function registerContestant(data) {
  const reg = {
    id: `cr_${crypto.randomUUID().split('-')[0]}`,
    challenge_id: data.challenge_id,
    user_id: data.user_id,
    name: data.name,
    email: data.email,
    gender: data.gender || null,
    video_url: data.video_url || null,
    video_thumbnail: data.video_thumbnail || null,
    video_duration_seconds: data.video_duration_seconds || 0,
    pitch_description: data.pitch_description || '',
    status: 'pending',         // pending | approved | shortlisted | finalist | eliminated | winner
    review_notes: null,
    reviewer_id: null,
    reviewed_at: null,
    referral_count: 0,
    engagement_score: 0,
    judge_score: 0,
    total_score: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await persistRegistration(reg);
  return syncRegistration(reg);
}

async function updateRegistration(id, fields) {
  const reg = await getRegistrationById(id);
  if (!reg) return null;
  const allowed = [
    'status', 'review_notes', 'reviewer_id', 'reviewed_at',
    'video_url', 'video_thumbnail', 'video_duration_seconds',
    'pitch_description', 'referral_count', 'engagement_score',
    'judge_score', 'total_score', 'name', 'gender',
  ];
  for (const key of allowed) {
    if (fields[key] !== undefined) reg[key] = fields[key];
  }
  reg.updated_at = new Date().toISOString();
  await persistRegistration(reg);
  return syncRegistration(reg);
}

async function getRegistrationByUserId(challengeId, userId) {
  const db = getFirestore();
  const snap = await db.collection(REGISTRATIONS_COLLECTION)
    .where('challenge_id', '==', challengeId)
    .where('user_id', '==', userId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return syncRegistration({ ...doc.data(), id: doc.id });
}

async function getRegistrationById(id) {
  if (registrationsById.has(id)) {
    return registrationsById.get(id) || null;
  }

  const db = getFirestore();
  const doc = await db.collection(REGISTRATIONS_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return syncRegistration({ ...doc.data(), id: doc.id });
}

async function listRegistrations({ challenge_id, status, limit = 50, offset = 0 }) {
  const db = getFirestore();
  let query = db.collection(REGISTRATIONS_COLLECTION);
  if (challenge_id) query = query.where('challenge_id', '==', challenge_id);
  if (status) query = query.where('status', '==', status);

  const snap = await query.get();
  const filtered = snap.docs
    .map((doc) => syncRegistration({ ...doc.data(), id: doc.id }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

async function countRegistrations(challengeId) {
  const db = getFirestore();
  const snap = await db.collection(REGISTRATIONS_COLLECTION)
    .where('challenge_id', '==', challengeId)
    .get();
  return snap.size;
}

async function getApprovedRegistrations(challengeId) {
  const db = getFirestore();
  const snap = await db.collection(REGISTRATIONS_COLLECTION)
    .where('challenge_id', '==', challengeId)
    .where('status', 'in', ['approved', 'shortlisted', 'finalist', 'winner'])
    .get();
  return snap.docs
    .map((doc) => syncRegistration({ ...doc.data(), id: doc.id }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function deleteRegistration(id) {
  const removed = await getRegistrationById(id);
  if (!removed) return null;
  registrationsById.delete(id);
  const db = getFirestore();
  await db.collection(REGISTRATIONS_COLLECTION).doc(id).delete();
  return removed;
}

async function deleteChallenge(id) {
  const removed = await getChallengeById(id);
  if (!removed) return null;
  challengesById.delete(id);
  const db = getFirestore();
  // Delete the challenge document
  await db.collection(CHALLENGES_COLLECTION).doc(id).delete();
  // Delete associated registrations
  const relatedRegs = await db.collection(REGISTRATIONS_COLLECTION)
    .where('challenge_id', '==', id)
    .get();
  for (const reg of relatedRegs.docs) {
    registrationsById.delete(reg.id);
    await reg.ref.delete();
  }
  return removed;
}

module.exports = {
  PHASES,
  init,
  createChallenge,
  updateChallenge,
  getActiveChallenge,
  getChallengeById,
  listChallenges,
  registerContestant,
  updateRegistration,
  getRegistrationByUserId,
  getRegistrationById,
  listRegistrations,
  countRegistrations,
  getApprovedRegistrations,
  deleteRegistration,
  deleteChallenge,
};
