const User = require('../users/user.model');
const SettingsService = require('./settings.service');
const { getFirestore } = require('../utils/firestore');
const CersService = require('../wave/wave.cers.service');

const POLICY_KEYS = [
  'CERS_TEEN_MIN_ACCOUNT_AGE_DAYS',
  'CERS_ADULT_MIN_ACCOUNT_AGE_DAYS',
  'CERS_REPORT_MIN_REPUTATION',
  'CERS_REPORT_MIN_ACCOUNT_AGE_DAYS',
  'CERS_REPORT_MIN_COMPLETED_SESSIONS',
  'CERS_REPORT_DAILY_LIMIT',
  'CERS_REPORT_COOLDOWN_MINUTES',
  'CERS_REPORT_MAX_ABUSE_SCORE',
  'CERS_LOCK_THRESHOLD_NGN',
  'CERS_FINE_LEVEL_1_NGN',
  'CERS_FINE_LEVEL_2_NGN',
  'CERS_FINE_LEVEL_3_NGN',
  'CERS_FINE_LEVEL_4_NGN',
  'CERS_DIST_REPORTER_CASH_PERCENT',
  'CERS_DIST_REPORTER_VPT_PERCENT',
  'CERS_DIST_OPS_CASH_PERCENT',
  'CERS_DIST_COMMUNITY_VPT_PERCENT',
  'CERS_DIST_REFERRAL_VPT_PERCENT',
];

const MODERATION_CASES_COLLECTION = 'wave_moderation_cases';
const REPORTER_STATE_COLLECTION = 'cers_reporter_state';

async function requireAdmin(req, res) {
  const caller = await User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

async function getPolicy(req, res) {
  if (!(await requireAdmin(req, res))) return;
  try {
    const settings = await Promise.all(POLICY_KEYS.map((key) => SettingsService.getOne(key)));
    return res.json({ settings: settings.filter(Boolean) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load CERS policy settings' });
  }
}

async function updatePolicy(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const updates = req.body?.settings;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'settings array is required' });
  }

  for (const update of updates) {
    if (!update || !update.key || update.value === undefined) {
      return res.status(400).json({ error: 'Each settings entry must include key and value' });
    }
    if (!POLICY_KEYS.includes(update.key)) {
      return res.status(400).json({ error: `Unsupported CERS policy key: ${update.key}` });
    }
  }

  try {
    const saved = await SettingsService.bulkSet(
      updates.map((u) => ({ key: u.key, value: String(u.value) })),
      caller.id,
    );
    return res.json({ updated: saved });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update CERS policy settings' });
  }
}

async function listModerationCases(req, res) {
  if (!(await requireAdmin(req, res))) return;

  try {
    const db = getFirestore();
    const status = typeof req.query?.status === 'string' ? req.query.status.trim() : '';
    const limitRaw = Number(req.query?.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    let query = db.collection(MODERATION_CASES_COLLECTION).orderBy('created_at', 'desc').limit(limit);
    if (status) {
      query = db.collection(MODERATION_CASES_COLLECTION)
        .where('status', '==', status)
        .orderBy('created_at', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();
    const cases = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    return res.json({ cases });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list moderation cases' });
  }
}

async function reviewModerationCase(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const caseId = req.params.caseId;
  const nextStatus = String(req.body?.status || '').trim();
  const reviewNotes = String(req.body?.review_notes || '').trim();
  const fineLevel = req.body?.fine_level ?? null;

  const allowed = ['under_review', 'resolved_valid', 'resolved_invalid', 'appealed'];
  if (!allowed.includes(nextStatus)) {
    return res.status(400).json({ error: 'status must be one of: under_review, resolved_valid, resolved_invalid, appealed' });
  }

  try {
    const result = await CersService.executeModerationCaseOutcome({
      caseId,
      reviewerId: caller.id,
      status: nextStatus,
      reviewNotes,
      fineLevel,
    });

    if (result.error) {
      return res.status(result.error.status || 500).json({ error: result.error.message, code: result.error.code });
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to review moderation case' });
  }
}

async function getReporterState(req, res) {
  if (!(await requireAdmin(req, res))) return;

  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const db = getFirestore();
    const doc = await db.collection(REPORTER_STATE_COLLECTION).doc(userId).get();
    return res.json({
      reporter_state: doc.exists ? { ...doc.data(), user_id: userId } : null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load reporter state' });
  }
}

module.exports = {
  getPolicy,
  updatePolicy,
  listModerationCases,
  reviewModerationCase,
  getReporterState,
};
