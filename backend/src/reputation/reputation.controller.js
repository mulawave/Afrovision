const ReputationService = require('./reputation.service');

function toPrivateResponse(record) {
  if (!record) return null;
  return {
    user_id: record.user_id,
    total_reps: record.total_reps,
    level: record.level,
    total_gifting_ngn: record.total_gifting_ngn,
    total_gifting_vpt: record.total_gifting_vpt,
    community_pool_eligible: record.community_pool_eligible,
    leaderboard_rank: record.leaderboard_rank,
    created_at: record.created_at,
    last_updated: record.last_updated,
  };
}

function toPublicResponse(record) {
  if (!record) return null;
  return {
    user_id: record.user_id,
    total_reps: record.total_reps,
    level: record.level,
    leaderboard_rank: record.leaderboard_rank,
  };
}

function parsePagingValue(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function getMyReputation(req, res) {
  try {
    const reputation = await ReputationService.getReputation(req.userId);
    if (!reputation) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ reputation: toPrivateResponse(reputation) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load reputation' });
  }
}

async function getLeaderboard(req, res) {
  try {
    const limit = parsePagingValue(req.query.limit, 50);
    const offset = parsePagingValue(req.query.offset, 0);
    const leaderboard = await ReputationService.getLeaderboard(limit, offset);
    return res.json({ leaderboard, limit, offset });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load leaderboard' });
  }
}

async function getUserReputation(req, res) {
  try {
    const reputation = await ReputationService.getReputation(req.params.userId);
    if (!reputation) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ reputation: toPublicResponse(reputation) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load user reputation' });
  }
}

module.exports = {
  getMyReputation,
  getLeaderboard,
  getUserReputation,
};