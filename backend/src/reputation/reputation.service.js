const ReputationModel = require('./reputation.model');
const UserModel = require('../users/user.model');
const SettingsService = require('../admin/settings.service');

const LEVEL_THRESHOLDS = {
  1: 5100,
  2: 9000,
  3: 30000,
};

const PLAN_LEVEL_GATE = {
  plan_viewer_free: 0,
  plan_viewer_basic: 1,
  plan_viewer_pro: 2,
  plan_viewer_premium: 3,
};

function normalizePositiveNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

function calculateLevel(totalReps) {
  const safeTotalReps = normalizePositiveNumber(totalReps);

  if (safeTotalReps >= LEVEL_THRESHOLDS[3]) return 3;
  if (safeTotalReps >= LEVEL_THRESHOLDS[2]) return 2;
  if (safeTotalReps >= LEVEL_THRESHOLDS[1]) return 1;
  return 0;
}

function isKycVerified(user) {
  return user?.kyc_status === 'verified';
}

function computeCommunityPoolEligibility(user, totalReps, level) {
  if (!user || !isKycVerified(user) || level < 1) {
    return false;
  }

  return totalReps >= LEVEL_THRESHOLDS[level];
}

function buildDefaultRecord(userId, user) {
  const now = new Date().toISOString();
  const level = 0;
  return {
    user_id: userId,
    total_reps: 0,
    level,
    total_gifting_ngn: 0,
    total_gifting_vpt: 0,
    community_pool_eligible: computeCommunityPoolEligibility(user, 0, level),
    leaderboard_rank: null,
    created_at: now,
    last_updated: now,
  };
}

let initPromise = null;

async function ensureReady() {
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = ReputationModel.init();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

async function init() {
  await ensureReady();
}

async function recalculateAllRanks() {
  await ensureReady();
  const all = ReputationModel.getAll();
  if (!all.length) return [];

  const sorted = [...all].sort((a, b) => {
    if (b.total_reps !== a.total_reps) {
      return b.total_reps - a.total_reps;
    }
    return a.user_id.localeCompare(b.user_id);
  });

  const now = new Date().toISOString();
  const writes = sorted.map((record, index) => ReputationModel.upsert({
    ...record,
    leaderboard_rank: index + 1,
    last_updated: now,
  }));

  return Promise.all(writes);
}

async function awardReps(userId, ngnValue, vptValue) {
  await ensureReady();
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const current = ReputationModel.getByUserId(userId) || buildDefaultRecord(userId, user);
  const ngnDelta = normalizePositiveNumber(ngnValue);
  const vptDelta = normalizePositiveNumber(vptValue);

  // Convert vPT amount to NGN equivalent for reputation scoring
  const vptPriceNgn = await SettingsService.getNumber('VPT_PRICE_NGN') || 750;
  const vptReps = vptDelta * vptPriceNgn;
  const totalReps = current.total_reps + ngnDelta + vptReps;
  const level = calculateLevel(totalReps);

  const updated = await ReputationModel.upsert({
    ...current,
    total_reps: totalReps,
    level,
    total_gifting_ngn: current.total_gifting_ngn + ngnDelta,
    total_gifting_vpt: current.total_gifting_vpt + vptDelta,
    community_pool_eligible: computeCommunityPoolEligibility(user, totalReps, level),
  });

  await recalculateAllRanks();
  return ReputationModel.getByUserId(updated.user_id);
}

async function getReputation(userId) {
  await ensureReady();
  const user = await UserModel.findById(userId);
  if (!user) return null;

  const record = ReputationModel.getByUserId(userId);
  if (record) {
    return {
      ...record,
      community_pool_eligible: computeCommunityPoolEligibility(user, record.total_reps, record.level),
    };
  }

  return buildDefaultRecord(userId, user);
}

async function checkCommunityPoolEligibility(userId) {
  const record = await getReputation(userId);
  return Boolean(record?.community_pool_eligible);
}

async function canSubscribeToPlan(userId, planId) {
  const requiredLevel = PLAN_LEVEL_GATE[planId];
  if (requiredLevel == null) {
    return false;
  }

  const record = await getReputation(userId);
  if (!record) {
    return false;
  }

  return record.level >= requiredLevel;
}

async function getLeaderboard(limit = 50, offset = 0) {
  await ensureReady();
  const leaderboard = ReputationModel.getLeaderboard(limit, offset);
  return Promise.all(leaderboard.map(async (record, index) => {
    const user = await UserModel.findById(record.user_id);
    return {
      rank: record.leaderboard_rank || (Number(offset) || 0) + index + 1,
      user_id: record.user_id,
      name: user?.name || user?.email || 'Unknown User',
      total_reps: record.total_reps,
      level: record.level,
    };
  }));
}

/**
 * Recomputes and persists community_pool_eligible for a single user without
 * altering their rep counts or leaderboard rank.  Call this whenever the user's
 * KYC status changes so the stored value stays current between gifts.
 */
async function refreshEligibility(userId) {
  await ensureReady();
  const user = await UserModel.findById(userId);
  if (!user) return;

  const existing = ReputationModel.getByUserId(userId);
  if (!existing) return; // no rep record yet — awardReps will set eligibility on first gift

  const fresh = computeCommunityPoolEligibility(user, existing.total_reps, existing.level);
  if (fresh === existing.community_pool_eligible) return; // nothing changed

  await ReputationModel.upsert({
    ...existing,
    community_pool_eligible: fresh,
    last_updated: new Date().toISOString(),
  });
}

module.exports = {
  LEVEL_THRESHOLDS,
  PLAN_LEVEL_GATE,
  init,
  calculateLevel,
  awardReps,
  checkCommunityPoolEligibility,
  canSubscribeToPlan,
  getLeaderboard,
  getReputation,
  recalculateAllRanks,
  refreshEligibility,
};