const crypto = require('crypto');
const SettingsService = require('../admin/settings.service');
const ReputationService = require('../reputation/reputation.service');
const User = require('../users/user.model');
const Wave = require('./wave.model');
const LedgerService = require('../vpt/ledger.service');
const PoolService = require('../vpt/pool.service');
const ReferralModel = require('../referrals/referral.model');
const NotificationService = require('../notifications/notification.service');
const { getFirestore } = require('../utils/firestore');

const CLASSIFICATION_REPORTS_COLLECTION = 'wave_classification_reports';
const MODERATION_CASES_COLLECTION = 'wave_moderation_cases';
const REPORTER_STATE_COLLECTION = 'cers_reporter_state';
const ADULT_CONSENT_COLLECTION = 'wave_adult_consents';
const CREATOR_LOCK_COLLECTION = 'creator_violation_locks';
const AUDIT_COLLECTION = 'cers_audit_log';

const REPORT_REASON_VALUES = [
  'adult_labeled_minor_safe',
  'adult_labeled_teen',
  'graphic_violence_mislabeled',
  'sexual_content_mislabeled',
  'dangerous_for_minors',
  'other',
];

const CLASSIFICATION_VALUES = ['minor_safe', 'teen', 'adult'];

const DEFAULT_POLICY = {
  teenMinAccountAgeDays: 365 * 13,
  adultMinAccountAgeDays: 365 * 18,
  reportMinReputation: 0,
  reportMinAccountAgeDays: 14,
  reportMinCompletedSessions: 0,
  reportDailyLimit: 10,
  reportCooldownMinutes: 2,
  reportMaxAbuseScore: 25,
  lockThresholdNgn: 1000,
};

const FINE_RULES = {
  adult_labeled_minor_safe: { levelKey: 'CERS_FINE_LEVEL_3_NGN', fallback: 25000, severity: 3 },
  adult_labeled_teen: { levelKey: 'CERS_FINE_LEVEL_2_NGN', fallback: 5000, severity: 2 },
  graphic_violence_mislabeled: { levelKey: 'CERS_FINE_LEVEL_2_NGN', fallback: 5000, severity: 2 },
  sexual_content_mislabeled: { levelKey: 'CERS_FINE_LEVEL_3_NGN', fallback: 25000, severity: 3 },
  dangerous_for_minors: { levelKey: 'CERS_FINE_LEVEL_1_NGN', fallback: 1000, severity: 1 },
  other: { levelKey: 'CERS_FINE_LEVEL_1_NGN', fallback: 1000, severity: 1 },
};

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function parseDate(value) {
  if (!value) return null;
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate;
}

function computeAccountAgeDays(user) {
  const createdAt = parseDate(user?.created_at);
  if (!createdAt) return 0;
  const ageMs = Date.now() - createdAt.getTime();
  return Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
}

async function getNumberSetting(key, fallback) {
  const value = await SettingsService.getNumber(key);
  if (value == null || !Number.isFinite(value)) return fallback;
  return value;
}

async function getPolicy() {
  return {
    teenMinAccountAgeDays: await getNumberSetting('CERS_TEEN_MIN_ACCOUNT_AGE_DAYS', DEFAULT_POLICY.teenMinAccountAgeDays),
    adultMinAccountAgeDays: await getNumberSetting('CERS_ADULT_MIN_ACCOUNT_AGE_DAYS', DEFAULT_POLICY.adultMinAccountAgeDays),
    reportMinReputation: await getNumberSetting('CERS_REPORT_MIN_REPUTATION', DEFAULT_POLICY.reportMinReputation),
    reportMinAccountAgeDays: await getNumberSetting('CERS_REPORT_MIN_ACCOUNT_AGE_DAYS', DEFAULT_POLICY.reportMinAccountAgeDays),
    reportMinCompletedSessions: await getNumberSetting('CERS_REPORT_MIN_COMPLETED_SESSIONS', DEFAULT_POLICY.reportMinCompletedSessions),
    reportDailyLimit: await getNumberSetting('CERS_REPORT_DAILY_LIMIT', DEFAULT_POLICY.reportDailyLimit),
    reportCooldownMinutes: await getNumberSetting('CERS_REPORT_COOLDOWN_MINUTES', DEFAULT_POLICY.reportCooldownMinutes),
    reportMaxAbuseScore: await getNumberSetting('CERS_REPORT_MAX_ABUSE_SCORE', DEFAULT_POLICY.reportMaxAbuseScore),
    lockThresholdNgn: await getNumberSetting('CERS_LOCK_THRESHOLD_NGN', DEFAULT_POLICY.lockThresholdNgn),
    fineLevel1Ngn: await getNumberSetting('CERS_FINE_LEVEL_1_NGN', 1000),
    fineLevel2Ngn: await getNumberSetting('CERS_FINE_LEVEL_2_NGN', 5000),
    fineLevel3Ngn: await getNumberSetting('CERS_FINE_LEVEL_3_NGN', 25000),
    fineLevel4Ngn: await getNumberSetting('CERS_FINE_LEVEL_4_NGN', 100000),
    distReporterCashPercent: await getNumberSetting('CERS_DIST_REPORTER_CASH_PERCENT', 40),
    distReporterVptPercent: await getNumberSetting('CERS_DIST_REPORTER_VPT_PERCENT', 10),
    distOpsCashPercent: await getNumberSetting('CERS_DIST_OPS_CASH_PERCENT', 20),
    distCommunityVptPercent: await getNumberSetting('CERS_DIST_COMMUNITY_VPT_PERCENT', 20),
    distReferralVptPercent: await getNumberSetting('CERS_DIST_REFERRAL_VPT_PERCENT', 10),
  };
}

async function appendAuditLog(action, payload) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  await db.collection(AUDIT_COLLECTION).doc(id).set({
    id,
    action,
    payload,
    created_at: Date.now(),
  });
}

async function getReporterState(userId) {
  const db = getFirestore();
  const ref = db.collection(REPORTER_STATE_COLLECTION).doc(userId);
  const doc = await ref.get();
  if (!doc.exists) {
    return {
      user_id: userId,
      valid_reports_count: 0,
      invalid_reports_count: 0,
      abuse_score: 0,
      reports_today_count: 0,
      reports_today_window_start: Date.now(),
      last_reported_at: null,
      suspended_until: null,
      updated_at: Date.now(),
    };
  }
  return { ...doc.data(), user_id: userId };
}

async function upsertReporterState(userId, patch) {
  const db = getFirestore();
  const state = await getReporterState(userId);
  const next = {
    ...state,
    ...patch,
    user_id: userId,
    updated_at: Date.now(),
  };
  await db.collection(REPORTER_STATE_COLLECTION).doc(userId).set(next, { merge: true });
  return next;
}

async function getCreatorLockStatus(userId) {
  const db = getFirestore();
  const snapshot = await db
    .collection(CREATOR_LOCK_COLLECTION)
    .where('creator_uid', '==', userId)
    .where('status', '==', 'locked')
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const lock = snapshot.docs[0].data();
  return lock;
}

function getFineRule(reason) {
  return FINE_RULES[reason] || FINE_RULES.other;
}

async function getFineAmount(reason, policy) {
  const rule = getFineRule(reason);
  const mapped = {
    CERS_FINE_LEVEL_1_NGN: policy.fineLevel1Ngn,
    CERS_FINE_LEVEL_2_NGN: policy.fineLevel2Ngn,
    CERS_FINE_LEVEL_3_NGN: policy.fineLevel3Ngn,
    CERS_FINE_LEVEL_4_NGN: policy.fineLevel4Ngn,
  }[rule.levelKey];
  return Number.isFinite(mapped) && mapped > 0 ? mapped : rule.fallback;
}

function getFineAmountForLevel(level, policy) {
  const normalized = Number(level);
  if (normalized === 1) return Number.isFinite(policy.fineLevel1Ngn) ? policy.fineLevel1Ngn : 1000;
  if (normalized === 2) return Number.isFinite(policy.fineLevel2Ngn) ? policy.fineLevel2Ngn : 5000;
  if (normalized === 3) return Number.isFinite(policy.fineLevel3Ngn) ? policy.fineLevel3Ngn : 25000;
  if (normalized === 4) return Number.isFinite(policy.fineLevel4Ngn) ? policy.fineLevel4Ngn : 100000;
  return null;
}

async function createCreatorLock({ creatorId, waveId, channelId, caseId, reason, fineAmountNgn }) {
  const db = getFirestore();
  const id = `${creatorId}_${caseId}`;
  const lock = {
    id,
    creator_uid: creatorId,
    wave_id: waveId,
    channel_id: channelId || null,
    case_id: caseId,
    reason,
    fine_amount_ngn: fineAmountNgn,
    status: 'locked',
    payment_status: 'pending',
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  await db.collection(CREATOR_LOCK_COLLECTION).doc(id).set(lock, { merge: true });
  return lock;
}

function buildDistributionBreakdown(finalFine, policy, hasReporter) {
  const reporterCash = hasReporter ? Math.round(finalFine * (policy.distReporterCashPercent / 100)) : 0;
  const reporterVpt = hasReporter
    ? parseFloat(((finalFine * (policy.distReporterVptPercent / 100)) / 750).toFixed(4))
    : 0;
  const opsCash = Math.round(finalFine * (policy.distOpsCashPercent / 100));
  const communityVpt = parseFloat(((finalFine * (policy.distCommunityVptPercent / 100)) / 750).toFixed(4));
  const referralVpt = parseFloat(((finalFine * (policy.distReferralVptPercent / 100)) / 750).toFixed(4));
  return {
    reporter_cash: reporterCash,
    reporter_vpt: reporterVpt,
    ops_cash: opsCash,
    community_vpt: communityVpt,
    referral_vpt: referralVpt,
  };
}

async function applyFineDistributions({
  caseId,
  wave,
  creator,
  reporter,
  policy,
  finalFine,
}) {
  const distribution = buildDistributionBreakdown(finalFine, policy, Boolean(reporter));

  if (reporter) {
    if (distribution.reporter_cash > 0) await User.adjustCash(reporter.id, distribution.reporter_cash);
    if (distribution.reporter_vpt > 0) await User.adjustVpt(reporter.id, distribution.reporter_vpt);
    await LedgerService.recordAsync({
      uid: reporter.id,
      type: 'CERS_REPORTER_REWARD',
      direction: 'credit',
      currency: distribution.reporter_cash > distribution.reporter_vpt ? 'ngn' : 'vpt',
      amount_ngn: distribution.reporter_cash,
      amount_vpt_units: distribution.reporter_vpt,
      status: 'success',
      reference_id: caseId,
      channel_id: wave?.channel_id || null,
      meta: { wave_id: wave?.id || null, case_id: caseId },
      description: 'Community Service Reward',
    });
    await NotificationService.notifyUser(reporter.id, {
      title: 'Community Service Reward',
      body: 'Your community service contribution has been processed.',
      type: 'cers_reward',
      source: 'cers',
      data: { case_id: caseId },
    }).catch(() => {});
  }

  if (distribution.ops_cash > 0) {
    await PoolService.creditOperationsPool(distribution.ops_cash, 'cers_violation', {
      case_id: caseId,
      wave_id: wave?.id || null,
      creator_uid: creator.id,
    });
  }

  if (distribution.community_vpt > 0) {
    await PoolService.creditPool(distribution.community_vpt, 'cers_violation', {
      currency: 'vpt',
      case_id: caseId,
      wave_id: wave?.id || null,
      creator_uid: creator.id,
    });
  }

  if (distribution.referral_vpt > 0) {
    const tree = await ReferralModel.resolveTree(creator.id);
    const eligibleReferrers = tree.filter(Boolean);
    const totalLevels = eligibleReferrers.length || 1;
    const perRecipient = parseFloat((distribution.referral_vpt / totalLevels).toFixed(4));
    for (const recipientUid of eligibleReferrers) {
      const recipient = await User.findById(recipientUid);
      if (!recipient) continue;
      await User.adjustVpt(recipientUid, perRecipient);
      await ReferralModel.recordEarning({
        recipientUid,
        sourceUid: creator.id,
        level: 1,
        amountNgn: 0,
        amountVptUnits: perRecipient,
        subscriptionId: caseId,
        creatorUid: creator.id,
      });
      await LedgerService.recordAsync({
        uid: recipientUid,
        type: 'CERS_REFERRAL_BONUS',
        direction: 'credit',
        currency: 'vpt',
        amount_vpt_units: perRecipient,
        status: 'success',
        reference_id: caseId,
        channel_id: wave?.channel_id || null,
        meta: { wave_id: wave?.id || null, case_id: caseId, source_uid: creator.id },
        description: 'Community Service Bonus',
      });
      await NotificationService.notifyUser(recipientUid, {
        title: 'Community Service Bonus',
        body: 'You received a community service bonus.',
        type: 'cers_bonus',
        source: 'cers',
        data: { case_id: caseId },
      }).catch(() => {});
    }
  }

  return distribution;
}

async function getModerationCase(caseId) {
  const db = getFirestore();
  const doc = await db.collection(MODERATION_CASES_COLLECTION).doc(caseId).get();
  return doc.exists ? { ...doc.data(), id: doc.id } : null;
}

async function checkWaveAudienceAccess({ wave, user, sessionId }) {
  const policy = await getPolicy();
  const classification = String(wave.age_classification || 'teen');

  // Creator and admins must always be able to access a wave they own/manage.
  if (user && (user.role === 'admin' || user.id === wave.creator_uid)) {
    return { allowed: true, requires_consent: false, reason: null, policy };
  }

  if (classification === 'minor_safe') {
    return { allowed: true, requires_consent: false, reason: null, policy };
  }

  if (!user) {
    return {
      allowed: false,
      requires_consent: false,
      reason: 'Authentication required for age-restricted content',
      code: 'AUTH_REQUIRED',
      policy,
    };
  }

  const accountAgeDays = computeAccountAgeDays(user);

  const kycVerified = user.kyc_status === 'verified';

  if (classification === 'teen') {
    if (kycVerified) {
      return { allowed: true, requires_consent: false, reason: null, policy };
    }

    if (accountAgeDays < policy.teenMinAccountAgeDays) {
      return {
        allowed: false,
        requires_consent: false,
        reason: 'This content is restricted to KYC-approved teenage and older viewers',
        code: 'TEEN_RESTRICTED',
        policy,
      };
    }

    return {
      allowed: false,
      requires_consent: false,
      reason: 'KYC approval is required to view this teen-rated content',
      code: 'KYC_REQUIRED',
      policy,
    };
  }

  const hasAdultAccountAge = accountAgeDays >= policy.adultMinAccountAgeDays;
  if (!hasAdultAccountAge) {
    return {
      allowed: false,
      requires_consent: false,
      reason: 'This content is restricted to adult viewers',
      code: 'ADULT_RESTRICTED',
      policy,
    };
  }

  if (kycVerified) {
    return { allowed: true, requires_consent: false, reason: null, policy };
  }

  if (!sessionId) {
    return {
      allowed: false,
      requires_consent: true,
      reason: 'Adult consent acknowledgement required',
      code: 'ADULT_CONSENT_REQUIRED',
      policy,
    };
  }

  const db = getFirestore();
  const consentId = `${user.id}_${sessionId}`;
  const consentDoc = await db.collection(ADULT_CONSENT_COLLECTION).doc(consentId).get();
  if (!consentDoc.exists) {
    return {
      allowed: false,
      requires_consent: true,
      reason: 'Adult consent acknowledgement required',
      code: 'ADULT_CONSENT_REQUIRED',
      policy,
    };
  }

  return { allowed: true, requires_consent: false, reason: null, policy };
}

async function acknowledgeAdultConsent({ userId, waveId, sessionId }) {
  const db = getFirestore();
  const id = `${userId}_${sessionId}`;
  await db.collection(ADULT_CONSENT_COLLECTION).doc(id).set({
    id,
    user_id: userId,
    session_id: sessionId,
    acknowledged: true,
    wave_id: waveId,
    created_at: Date.now(),
  }, { merge: true });

  await appendAuditLog('adult_consent_acknowledged', {
    user_id: userId,
    wave_id: waveId,
    session_id: sessionId,
  });

  return { success: true, consent_id: id };
}

async function evaluateReporterEligibility({ user, userId }) {
  const policy = await getPolicy();
  const state = await getReporterState(userId);
  const reputation = await ReputationService.getReputation(userId);

  const totalReps = reputation?.total_reps || 0;
  const accountAgeDays = computeAccountAgeDays(user);
  const completedSessions = Number(user?.completed_sessions || 0);

  const now = Date.now();
  const suspendedUntil = state.suspended_until || null;
  if (suspendedUntil && suspendedUntil > now) {
    return { ok: false, reason: 'Reporting temporarily suspended due to abuse patterns', policy, state };
  }

  if (totalReps < policy.reportMinReputation) {
    return { ok: false, reason: 'Minimum reputation requirement not met', policy, state };
  }

  if (accountAgeDays < policy.reportMinAccountAgeDays) {
    return { ok: false, reason: 'Account age requirement not met for reporting', policy, state };
  }

  if (completedSessions < policy.reportMinCompletedSessions) {
    return { ok: false, reason: 'Minimum completed sessions requirement not met', policy, state };
  }

  if ((state.abuse_score || 0) > policy.reportMaxAbuseScore) {
    return { ok: false, reason: 'Reporting access restricted due to abuse score', policy, state };
  }

  let reportsTodayCount = Number(state.reports_today_count || 0);
  const windowStart = Number(state.reports_today_window_start || 0);
  const sameDay = new Date(windowStart).toDateString() === new Date(now).toDateString();
  if (!sameDay) reportsTodayCount = 0;

  if (reportsTodayCount >= policy.reportDailyLimit) {
    return { ok: false, reason: 'Daily report limit reached', policy, state };
  }

  const cooldownMs = policy.reportCooldownMinutes * 60 * 1000;
  const lastReportedAt = Number(state.last_reported_at || 0);
  if (lastReportedAt && now - lastReportedAt < cooldownMs) {
    return { ok: false, reason: 'Please wait before sending another report', policy, state };
  }

  return {
    ok: true,
    policy,
    state,
    metrics: {
      accountAgeDays,
      totalReps,
      completedSessions,
      reportsTodayCount,
    },
  };
}

function normalizeSuggestedClassification(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!CLASSIFICATION_VALUES.includes(normalized)) return null;
  return normalized;
}

async function createClassificationReportAndCase({ wave, reporter, reason, suggestedClassification }) {
  const db = getFirestore();
  const eligibility = await evaluateReporterEligibility({ user: reporter, userId: reporter.id });
  if (!eligibility.ok) {
    return { error: { status: 403, message: eligibility.reason, code: 'REPORT_NOT_ELIGIBLE' } };
  }

  const normalizedReason = REPORT_REASON_VALUES.includes(reason) ? reason : 'other';
  const normalizedSuggested = normalizeSuggestedClassification(suggestedClassification);

  const now = Date.now();
  const reportId = crypto.randomUUID();
  const caseId = crypto.randomUUID();

  const reportDoc = {
    id: reportId,
    case_id: caseId,
    wave_id: wave.id,
    creator_uid: wave.creator_uid,
    reporter_uid_private: reporter.id,
    report_reason: normalizedReason,
    original_classification: wave.age_classification || 'teen',
    suggested_classification: normalizedSuggested,
    status: 'submitted',
    created_at: now,
  };

  const caseDoc = {
    id: caseId,
    wave_id: wave.id,
    creator_id: wave.creator_uid,
    reporter_id_private: reporter.id,
    report_id: reportId,
    report_reason: normalizedReason,
    original_classification: wave.age_classification || 'teen',
    suggested_classification: normalizedSuggested,
    status: 'open',
    review_notes: '',
    fine_level: null,
    fine_amount_ngn: 0,
    created_at: now,
    reviewed_at: null,
  };

  await db.collection(CLASSIFICATION_REPORTS_COLLECTION).doc(reportId).set(reportDoc);
  await db.collection(MODERATION_CASES_COLLECTION).doc(caseId).set(caseDoc);

  const state = eligibility.state;
  const nextReportsTodayCount =
    new Date(Number(state.reports_today_window_start || 0)).toDateString() === new Date(now).toDateString()
      ? Number(state.reports_today_count || 0) + 1
      : 1;

  await upsertReporterState(reporter.id, {
    reports_today_count: nextReportsTodayCount,
    reports_today_window_start: now,
    last_reported_at: now,
  });

  await appendAuditLog('classification_report_submitted', {
    report_id: reportId,
    case_id: caseId,
    wave_id: wave.id,
    creator_uid: wave.creator_uid,
  });

  return {
    report: {
      id: reportId,
      case_id: caseId,
      wave_id: wave.id,
      report_reason: normalizedReason,
      status: 'submitted',
      created_at: now,
    },
    moderation_case: {
      id: caseId,
      wave_id: wave.id,
      status: 'open',
      created_at: now,
    },
  };
}

async function executeModerationCaseOutcome({ caseId, reviewerId, status, reviewNotes = '', fineLevel = null }) {
  const db = getFirestore();
  const moderationCase = await getModerationCase(caseId);
  if (!moderationCase) {
    return { error: { status: 404, message: 'Moderation case not found', code: 'CASE_NOT_FOUND' } };
  }

  const wave = await Wave.findById(moderationCase.wave_id);
  if (!wave) {
    return { error: { status: 404, message: 'Wave not found', code: 'WAVE_NOT_FOUND' } };
  }

  const creator = await User.findById(wave.creator_uid);
  if (!creator) {
    return { error: { status: 404, message: 'Creator not found', code: 'CREATOR_NOT_FOUND' } };
  }

  const reporter = await User.findById(moderationCase.reporter_id_private);
  const policy = await getPolicy();

  if (status === 'resolved_invalid') {
    const state = await getReporterState(reporter?.id || moderationCase.reporter_id_private);
    const updated = await upsertReporterState(reporter?.id || moderationCase.reporter_id_private, {
      invalid_reports_count: Number(state.invalid_reports_count || 0) + 1,
      abuse_score: Number(state.abuse_score || 0) + 5,
      suspended_until: Number(state.abuse_score || 0) + 5 > policy.reportMaxAbuseScore
        ? Date.now() + 24 * 60 * 60 * 1000
        : state.suspended_until || null,
    });

    await db.collection(MODERATION_CASES_COLLECTION).doc(caseId).set({
      status,
      review_notes: reviewNotes,
      fine_level: fineLevel,
      reviewed_at: Date.now(),
      reviewed_by: reviewerId,
    }, { merge: true });

    await appendAuditLog('classification_case_resolved_invalid', {
      case_id: caseId,
      wave_id: wave.id,
      reviewer_id: reviewerId,
      reporter_id: reporter?.id || moderationCase.reporter_id_private,
      updated_reporter_state: updated,
    });

    if (reporter) {
      await NotificationService.notifyUser(reporter.id, {
        title: 'Community Service Review Update',
        body: 'Your moderation report was reviewed.',
        type: 'cers_report_update',
        source: 'cers',
        data: { case_id: caseId, status: 'invalid' },
      }).catch(() => {});
    }

    return {
      case: { ...moderationCase, status },
      action: 'invalid',
      reporter_state: updated,
    };
  }

  if (status !== 'resolved_valid') {
    await db.collection(MODERATION_CASES_COLLECTION).doc(caseId).set({
      status,
      review_notes: reviewNotes,
      fine_level: fineLevel,
      reviewed_at: Date.now(),
      reviewed_by: reviewerId,
    }, { merge: true });
    await appendAuditLog('classification_case_reviewed', {
      case_id: caseId,
      wave_id: wave.id,
      reviewer_id: reviewerId,
      status,
    });
    return { case: { ...moderationCase, status }, action: 'review_only' };
  }

  const reasonFine = await getFineAmount(moderationCase.report_reason, policy);
  const levelFine = getFineAmountForLevel(fineLevel, policy);
  const finalFine = Number.isFinite(levelFine) && levelFine > 0 ? levelFine : reasonFine;

  await Wave.remove(wave.id);

  const creatorCash = Number(creator.cash || 0);
  const hasEnoughCash = creatorCash >= finalFine;
  let lock = null;

  if (hasEnoughCash) {
    await User.adjustCash(creator.id, -finalFine);
    await LedgerService.recordAsync({
      uid: creator.id,
      type: 'CERS_FINE',
      direction: 'debit',
      currency: 'ngn',
      amount_ngn: finalFine,
      status: 'success',
      reference_id: caseId,
      channel_id: wave.channel_id,
      meta: {
        wave_id: wave.id,
        case_id: caseId,
        report_reason: moderationCase.report_reason,
        review_notes: reviewNotes,
      },
      description: 'Community Standards Fine',
    });
    const distribution = await applyFineDistributions({
      caseId,
      wave,
      creator,
      reporter,
      policy,
      finalFine,
    });

    if (reporter) {
      const reporterState = await getReporterState(reporter.id);
      await upsertReporterState(reporter.id, {
        valid_reports_count: Number(reporterState.valid_reports_count || 0) + 1,
      });
    }

    await NotificationService.notifyUser(creator.id, {
      title: 'Community Standards Fine',
      body: `A Wave violated AfroVision classification standards and has been removed.`,
      type: 'cers_violation',
      source: 'cers',
      data: { case_id: caseId, wave_id: wave.id },
    }).catch(() => {});

    await db.collection(MODERATION_CASES_COLLECTION).doc(caseId).set({
      status,
      review_notes: reviewNotes,
      fine_level: fineLevel,
      fine_amount_ngn: finalFine,
      reviewed_at: Date.now(),
      reviewed_by: reviewerId,
    }, { merge: true });

    await appendAuditLog('classification_case_resolved_valid', {
      case_id: caseId,
      wave_id: wave.id,
      reviewer_id: reviewerId,
      creator_id: creator.id,
      fine_amount_ngn: finalFine,
      distributed: distribution,
    });

    return {
      case: { ...moderationCase, status, fine_amount_ngn: finalFine },
      action: 'resolved_valid',
      fine_amount_ngn: finalFine,
      lock: null,
    };
  }

  if (!hasEnoughCash) {
    lock = await createCreatorLock({
      creatorId: creator.id,
      waveId: wave.id,
      channelId: wave.channel_id,
      caseId,
      reason: moderationCase.report_reason,
      fineAmountNgn: finalFine,
    });

    if (reporter) {
      const reporterState = await getReporterState(reporter.id);
      await upsertReporterState(reporter.id, {
        valid_reports_count: Number(reporterState.valid_reports_count || 0) + 1,
      });
    }

    await NotificationService.notifyUser(creator.id, {
      title: 'Creator Access Locked',
      body: 'Your creator actions are temporarily locked until Community Standards fine payment is completed.',
      type: 'cers_lock',
      source: 'cers',
      data: { case_id: caseId, lock_id: lock.id },
    }).catch(() => {});
  }

  await db.collection(MODERATION_CASES_COLLECTION).doc(caseId).set({
    status,
    review_notes: reviewNotes,
    fine_level: fineLevel,
    fine_amount_ngn: finalFine,
    reviewed_at: Date.now(),
    reviewed_by: reviewerId,
  }, { merge: true });

  return {
    case: { ...moderationCase, status, fine_amount_ngn: finalFine },
    action: 'locked_for_payment',
    fine_amount_ngn: finalFine,
    lock,
  };
}

async function payCreatorLockAndUnlock({ creatorId }) {
  const db = getFirestore();
  const lock = await getCreatorLockStatus(creatorId);
  if (!lock) {
    return { error: { status: 404, message: 'No active creator lock found', code: 'LOCK_NOT_FOUND' } };
  }

  const creator = await User.findById(creatorId);
  if (!creator) {
    return { error: { status: 404, message: 'Creator not found', code: 'CREATOR_NOT_FOUND' } };
  }

  const fineAmountNgn = Math.max(0, Number(lock.fine_amount_ngn || 0));
  const creatorCash = Number(creator.cash || 0);
  if (creatorCash < fineAmountNgn) {
    return {
      error: {
        status: 402,
        message: 'Insufficient wallet balance for Community Standards fine payment',
        code: 'INSUFFICIENT_BALANCE',
      },
      lock,
      required_amount_ngn: fineAmountNgn,
      available_cash_ngn: creatorCash,
    };
  }

  const moderationCase = lock.case_id ? await getModerationCase(lock.case_id) : null;
  const reporterId = moderationCase?.reporter_id_private || null;
  const reporter = reporterId ? await User.findById(reporterId) : null;
  const policy = await getPolicy();

  await User.adjustCash(creator.id, -fineAmountNgn);
  await LedgerService.recordAsync({
    uid: creator.id,
    type: 'CERS_FINE',
    direction: 'debit',
    currency: 'ngn',
    amount_ngn: fineAmountNgn,
    status: 'success',
    reference_id: lock.case_id || lock.id,
    channel_id: lock.channel_id || null,
    meta: {
      wave_id: lock.wave_id || null,
      case_id: lock.case_id || null,
      lock_id: lock.id,
      payment_mode: 'unlock_payment',
    },
    description: 'Community Standards Fine',
  });

  const distribution = await applyFineDistributions({
    caseId: lock.case_id || lock.id,
    wave: {
      id: lock.wave_id || null,
      channel_id: lock.channel_id || null,
    },
    creator,
    reporter,
    policy,
    finalFine: fineAmountNgn,
  });

  const lockPatch = {
    status: 'unlocked',
    payment_status: 'paid',
    amount_paid_ngn: fineAmountNgn,
    paid_at: Date.now(),
    unlocked_at: Date.now(),
    updated_at: Date.now(),
  };

  await db.collection(CREATOR_LOCK_COLLECTION).doc(lock.id).set(lockPatch, { merge: true });

  await NotificationService.notifyUser(creator.id, {
    title: 'Creator Access Restored',
    body: 'Community Standards fine payment received. Creator actions are now restored.',
    type: 'cers_unlock',
    source: 'cers',
    data: { lock_id: lock.id, case_id: lock.case_id || null },
  }).catch(() => {});

  await appendAuditLog('creator_lock_paid_and_unlocked', {
    lock_id: lock.id,
    creator_id: creator.id,
    fine_amount_ngn: fineAmountNgn,
    case_id: lock.case_id || null,
    distributed: distribution,
  });

  return {
    success: true,
    lock: {
      ...lock,
      ...lockPatch,
    },
    fine_amount_ngn: fineAmountNgn,
  };
}

module.exports = {
  CLASSIFICATION_REPORTS_COLLECTION,
  MODERATION_CASES_COLLECTION,
  REPORTER_STATE_COLLECTION,
  ADULT_CONSENT_COLLECTION,
  CREATOR_LOCK_COLLECTION,
  REPORT_REASON_VALUES,
  CLASSIFICATION_VALUES,
  getPolicy,
  getCreatorLockStatus,
  checkWaveAudienceAccess,
  acknowledgeAdultConsent,
  evaluateReporterEligibility,
  createClassificationReportAndCase,
  executeModerationCaseOutcome,
  payCreatorLockAndUnlock,
  getReporterState,
  upsertReporterState,
};
