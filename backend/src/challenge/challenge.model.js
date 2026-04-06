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
const PHASES = ['registration', 'audition', 'running', 'completed'];

/* ── In-memory cache ──────────────────────────────────────────── */
let challenges = [];
let registrations = [];
let initialized = false;

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
  const db = getFirestore();
  const [cSnap, rSnap] = await Promise.all([
    db.collection(CHALLENGES_COLLECTION).get(),
    db.collection(REGISTRATIONS_COLLECTION).get(),
  ]);
  challenges = cSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
  registrations = rSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
  initialized = true;
}

/* ── Challenge CRUD ───────────────────────────────────────────── */
async function createChallenge(data) {
  const challenge = {
    id: `ch_${crypto.randomUUID().split('-')[0]}`,
    title: data.title || 'AfroVision Challenge',
    subtitle: data.subtitle || 'Amazons',
    season: data.season || 1,
    phase: 'registration',
    description: data.description || '',
    prize_pool: data.prize_pool || '₦10,000,000',
    max_contestants: data.max_contestants || 15,
    video_min_seconds: data.video_min_seconds || 30,
    video_max_seconds: data.video_max_seconds || 60,
    phases: {
      registration: { start: data.registration_start || null, end: data.registration_end || null },
      audition: { start: data.audition_start || null, end: data.audition_end || null },
      running: { start: data.running_start || null, end: data.running_end || null },
      completed: { start: data.completed_start || null, end: null },
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
  challenges.push(challenge);
  await persistChallenge(challenge);
  return challenge;
}

async function updateChallenge(id, fields) {
  const ch = challenges.find((c) => c.id === id);
  if (!ch) return null;
  const allowed = [
    'title', 'subtitle', 'season', 'phase', 'description', 'prize_pool',
    'max_contestants', 'video_min_seconds', 'video_max_seconds',
    'phases', 'prizes', 'rules', 'judges', 'sponsors',
    'banner_url', 'trailer_url', 'is_active',
  ];
  for (const key of allowed) {
    if (fields[key] !== undefined) ch[key] = fields[key];
  }
  ch.updated_at = new Date().toISOString();
  await persistChallenge(ch);
  return ch;
}

function getActiveChallenge() {
  return challenges.find((c) => c.is_active) || null;
}

function getChallengeById(id) {
  return challenges.find((c) => c.id === id) || null;
}

function listChallenges() {
  return [...challenges].sort((a, b) => b.season - a.season);
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
  registrations.push(reg);
  await persistRegistration(reg);
  return reg;
}

async function updateRegistration(id, fields) {
  const reg = registrations.find((r) => r.id === id);
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
  return reg;
}

function getRegistrationByUserId(challengeId, userId) {
  return registrations.find((r) => r.challenge_id === challengeId && r.user_id === userId) || null;
}

function getRegistrationById(id) {
  return registrations.find((r) => r.id === id) || null;
}

function listRegistrations({ challenge_id, status, limit = 50, offset = 0 }) {
  let filtered = [...registrations];
  if (challenge_id) filtered = filtered.filter((r) => r.challenge_id === challenge_id);
  if (status) filtered = filtered.filter((r) => r.status === status);
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

function countRegistrations(challengeId) {
  return registrations.filter((r) => r.challenge_id === challengeId).length;
}

function getApprovedRegistrations(challengeId) {
  return registrations.filter(
    (r) => r.challenge_id === challengeId && ['approved', 'shortlisted', 'finalist', 'winner'].includes(r.status)
  );
}

async function deleteRegistration(id) {
  const idx = registrations.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const removed = registrations.splice(idx, 1)[0];
  const db = getFirestore();
  await db.collection(REGISTRATIONS_COLLECTION).doc(id).delete();
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
};
