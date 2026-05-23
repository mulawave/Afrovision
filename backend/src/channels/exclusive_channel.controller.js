const crypto = require('crypto');
const Channel = require('./channel.model');
const User = require('../users/user.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const PoolService = require('../vpt/pool.service');
const ReferralModel = require('../referrals/referral.model');
const ExclusiveAccess = require('./exclusive_access.model');
const NotificationService = require('../notifications/notification.service');
const AuditService = require('../admin/audit.service');
const { getFirestore } = require('../utils/firestore');
const { sendExclusiveLifecycleEmail } = require('../utils/email');
const { buildExclusiveLifecycleMessage } = require('./exclusive_lifecycle.messages');
const { isAdultKycVerified } = require('./exclusive_policy.service');
const { isExclusiveRolloutEnabledForUser } = require('./exclusive_rollout.service');
const { queueExclusiveSplitException } = require('./exclusive_reconciliation.service');

const PIC_ATTEMPTS_COLLECTION = 'exclusive_pic_attempts';
const PURCHASE_IDEMPOTENCY_COLLECTION = 'exclusive_purchase_idempotency';
const PIC_MAX_FAILED_ATTEMPTS = Math.max(3, Number(process.env.EXCLUSIVE_PIC_MAX_FAILED_ATTEMPTS || 5));
const PIC_LOCKOUT_MS = Math.max(60 * 1000, Number(process.env.EXCLUSIVE_PIC_LOCKOUT_MS || (15 * 60 * 1000)));
const IDEMPOTENCY_PENDING_TTL_MS = Math.max(10 * 1000, Number(process.env.EXCLUSIVE_IDEMPOTENCY_PENDING_TTL_MS || (5 * 60 * 1000)));

function safeAuditLog(adminUid, action, targetId, meta = {}) {
  return AuditService.logAction(adminUid, action, targetId, meta)
    .catch((error) => console.error('[Exclusive] audit log failed:', error.message));
}

function normalizeIdempotencyKey(req) {
  const headerValue = req && req.headers ? req.headers['x-idempotency-key'] : null;
  const bodyValue = req && req.body ? req.body.idempotency_key : null;
  const raw = headerValue || bodyValue || null;

  if (raw === null || raw === undefined) return { key: null };
  if (typeof raw !== 'string') {
    return { error: 'idempotency key must be a string' };
  }

  const key = raw.trim();
  if (key.length < 8 || key.length > 128) {
    return { error: 'idempotency key must be between 8 and 128 characters' };
  }
  if (!/^[A-Za-z0-9:_\-.]+$/.test(key)) {
    return { error: 'idempotency key contains unsupported characters' };
  }

  return { key };
}

function idempotencyDocId({ userId, channelId, key }) {
  return crypto.createHash('sha256')
    .update(`${userId}:${channelId}:${key}`)
    .digest('hex');
}

async function acquirePurchaseIdempotency({ userId, channelId, key }) {
  if (!key) return { mode: 'disabled', docId: null, result: null };

  const db = getFirestore();
  const docId = idempotencyDocId({ userId, channelId, key });
  const ref = db.collection(PURCHASE_IDEMPOTENCY_COLLECTION).doc(docId);
  const now = Date.now();

  const runAcquire = async (readDoc, writeDoc) => {
    const snapshot = await readDoc();
    const existing = snapshot && snapshot.exists ? (snapshot.data() || {}) : null;

    if (existing && existing.status === 'completed' && existing.result) {
      return { mode: 'replay', docId, result: existing.result };
    }

    if (existing && existing.status === 'pending') {
      const updatedAt = Number(existing.updated_at || 0);
      if (updatedAt > 0 && (now - updatedAt) < IDEMPOTENCY_PENDING_TTL_MS) {
        return { mode: 'pending', docId, result: null };
      }
    }

    await writeDoc({
      status: 'pending',
      user_uid: userId,
      channel_id: channelId,
      key,
      updated_at: now,
      created_at: existing ? Number(existing.created_at || now) : now,
    }, { merge: true });

    return { mode: 'acquired', docId, result: null };
  };

  if (typeof db.runTransaction === 'function') {
    return db.runTransaction(async (tx) => runAcquire(
      () => tx.get(ref),
      (payload, options) => tx.set(ref, payload, options),
    ));
  }

  return runAcquire(
    () => ref.get(),
    (payload, options) => ref.set(payload, options),
  );
}

async function finalizePurchaseIdempotency(docId, { status, result = null, error = null }) {
  if (!docId) return;
  const db = getFirestore();
  await db.collection(PURCHASE_IDEMPOTENCY_COLLECTION).doc(docId).set({
    status,
    result,
    error,
    updated_at: Date.now(),
  }, { merge: true });
}

function picAttemptsDocId(userId, channelId) {
  return `${channelId}__${userId}`;
}

async function getPicAttemptState(userId, channelId) {
  const db = getFirestore();
  const ref = db.collection(PIC_ATTEMPTS_COLLECTION).doc(picAttemptsDocId(userId, channelId));
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return {
      failed_attempts: 0,
      locked_until: null,
    };
  }

  const data = snapshot.data() || {};
  return {
    failed_attempts: Number(data.failed_attempts || 0),
    locked_until: Number(data.locked_until || 0) || null,
  };
}

async function registerPicFailure({ userId, channelId }) {
  const db = getFirestore();
  const ref = db.collection(PIC_ATTEMPTS_COLLECTION).doc(picAttemptsDocId(userId, channelId));
  const now = Date.now();
  const current = await getPicAttemptState(userId, channelId);
  const failedAttempts = current.failed_attempts + 1;
  const shouldLock = failedAttempts >= PIC_MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? (now + PIC_LOCKOUT_MS) : null;

  await ref.set({
    user_uid: userId,
    channel_id: channelId,
    failed_attempts: shouldLock ? 0 : failedAttempts,
    locked_until: lockedUntil,
    last_failed_at: now,
    updated_at: now,
  }, { merge: true });

  return {
    failed_attempts: failedAttempts,
    locked_until: lockedUntil,
    locked: Boolean(lockedUntil && lockedUntil > now),
  };
}

async function clearPicFailureState({ userId, channelId }) {
  const db = getFirestore();
  await db.collection(PIC_ATTEMPTS_COLLECTION).doc(picAttemptsDocId(userId, channelId)).set({
    failed_attempts: 0,
    locked_until: null,
    last_success_at: Date.now(),
    updated_at: Date.now(),
  }, { merge: true });
}

async function enforceRolloutAccess(req, res) {
  const allowed = await isExclusiveRolloutEnabledForUser(req.userId);
  if (!allowed) {
    res.status(403).json({
      error: 'Exclusive channels are not available for your account yet',
      rollout_blocked: true,
    });
    return false;
  }
  return true;
}

function hashPic(pic) {
  return crypto.createHash('sha256').update(String(pic)).digest('hex');
}

function generatePic() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 10; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function distributeReferralVpt({ subscriberUid, referralPoolNgn, referenceId, channel }) {
  if (referralPoolNgn <= 0) return;

  const tree = await ReferralModel.resolveTree(subscriberUid);
  const vptPrice = ReferralModel.VPT_PRICE_NGN;

  for (let level = 0; level < 5; level += 1) {
    const recipientUid = tree[level];
    const levelAmountNgn = Math.floor(referralPoolNgn * ReferralModel.LEVEL_DISTRIBUTION[level]);
    if (levelAmountNgn <= 0) continue;

    const levelVptUnits = parseFloat((levelAmountNgn / vptPrice).toFixed(4));
    if (levelVptUnits <= 0) continue;

    if (!recipientUid) {
      await PoolService.creditRbdPool(0, levelVptUnits, {
        reason: `exclusive_empty_L${level + 1}`,
        channel_id: channel.id,
        payment_reference: referenceId,
      });
      continue;
    }

    await GiftWallet.adjustVptUnits(recipientUid, levelVptUnits);
    await ReferralModel.recordEarning({
      recipientUid,
      sourceUid: subscriberUid,
      level: level + 1,
      amountNgn: 0,
      amountVptUnits: levelVptUnits,
      subscriptionId: referenceId,
      creatorUid: channel.owner_id,
    });

    await Ledger.create({
      uid: recipientUid,
      type: 'EXCLUSIVE_REFERRAL_VPT',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: levelVptUnits,
      status: 'success',
      channel_id: channel.id,
      reference_id: referenceId,
      meta: {
        level: level + 1,
        source_uid: subscriberUid,
        referral_pool_ngn: referralPoolNgn,
        level_amount_ngn: levelAmountNgn,
      },
      description: `Exclusive channel referral reward L${level + 1}`,
    });
  }
}

async function checkExclusiveAccessStatus(req, res) {
  try {
    if (!(await enforceRolloutAccess(req, res))) return;

    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'exclusive') {
      return res.status(400).json({ error: 'Channel is not exclusive' });
    }

    if (channel.owner_id === req.userId) {
      return res.json({
        eligibleByKyc: true,
        hasActiveEntitlement: true,
        renewalRequired: false,
        expiresAt: null,
        monthlyFeeNgn: Number(channel.exclusive_monthly_fee_ngn || 0),
      });
    }

    const eligibleByKyc = await isAdultKycVerified(req.userId);
    if (!eligibleByKyc) {
      return res.json({
        eligibleByKyc: false,
        hasActiveEntitlement: false,
        renewalRequired: false,
        expiresAt: null,
      });
    }

    const active = await ExclusiveAccess.findActiveByUserAndChannel(req.userId, channel.id);
    return res.json({
      eligibleByKyc: true,
      hasActiveEntitlement: Boolean(active),
      renewalRequired: !active,
      expiresAt: active ? active.expires_at : null,
      monthlyFeeNgn: Number(channel.exclusive_monthly_fee_ngn || 0),
    });
  } catch (err) {
    console.error('[Exclusive] access-status:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function purchaseExclusiveAccess(req, res) {
  let idempotencyDoc = null;
  let channel = null;
  let paymentReference = null;
  let splitSnapshot = null;
  try {
    if (!(await enforceRolloutAccess(req, res))) return;

    channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'exclusive') {
      return res.status(400).json({ error: 'Channel is not exclusive' });
    }

    const eligibleByKyc = await isAdultKycVerified(req.userId);
    if (!eligibleByKyc) {
      return res.status(403).json({ error: 'KYC adult verification is required' });
    }

    const idempotency = normalizeIdempotencyKey(req);
    if (idempotency.error) {
      return res.status(400).json({ error: idempotency.error });
    }

    if (idempotency.key) {
      const acquired = await acquirePurchaseIdempotency({
        userId: req.userId,
        channelId: channel.id,
        key: idempotency.key,
      });

      if (acquired.mode === 'pending') {
        return res.status(409).json({ error: 'Duplicate request in progress. Retry shortly.' });
      }

      if (acquired.mode === 'replay') {
        return res.json({
          ...acquired.result,
          idempotent_replay: true,
        });
      }

      if (acquired.mode === 'acquired') {
        idempotencyDoc = acquired.docId;
      }
    }

    const latestAccess = await ExclusiveAccess.findLatestByUserAndChannel(req.userId, channel.id);

    const existing = await ExclusiveAccess.findActiveByUserAndChannel(req.userId, channel.id);
    if (existing) {
      const existingPayload = {
        has_access: true,
        expires_at: existing.expires_at,
        access_id: existing.id,
        already_active: true,
      };

      await finalizePurchaseIdempotency(idempotencyDoc, {
        status: 'completed',
        result: existingPayload,
      });

      return res.json(existingPayload);
    }

    const amount = Number(channel.exclusive_monthly_fee_ngn || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Exclusive fee is not configured for this channel' });
    }

    const wallet = await GiftWallet.ensureWallet(req.userId);
    if ((wallet.ngn_balance || 0) < amount) {
      await safeAuditLog(req.userId, 'exclusive_purchase_failed', channel.id, {
        reason: 'INSUFFICIENT_NGN',
        required: amount,
        available: wallet.ngn_balance || 0,
      });

      await finalizePurchaseIdempotency(idempotencyDoc, {
        status: 'failed',
        error: 'INSUFFICIENT_NGN',
      });

      return res.status(402).json({
        error: 'INSUFFICIENT_NGN',
        required: amount,
        available: wallet.ngn_balance || 0,
      });
    }

    const creatorCash = Math.floor(amount * 0.50);
    const communityPoolNgn = Math.floor(amount * 0.10);
    const operationsPoolNgn = Math.floor(amount * 0.20);
    const referralPoolNgn = Math.floor(amount * 0.10);
    const creatorVptNgn = amount - creatorCash - communityPoolNgn - operationsPoolNgn - referralPoolNgn;
    const creatorVptUnits = parseFloat((creatorVptNgn / ReferralModel.VPT_PRICE_NGN).toFixed(4));
    paymentReference = `exc_${channel.id}_${req.userId}_${Date.now()}`;
    splitSnapshot = {
      creator_cash: creatorCash,
      community_pool_ngn: communityPoolNgn,
      operations_pool_ngn: operationsPoolNgn,
      referral_pool_ngn: referralPoolNgn,
      creator_vpt_ngn: creatorVptNgn,
      creator_vpt_units: creatorVptUnits,
    };

    await GiftWallet.adjustNgnBalance(req.userId, -amount);
    await GiftWallet.adjustNgnBalance(channel.owner_id, creatorCash);
    if (creatorVptUnits > 0) {
      await GiftWallet.adjustVptUnits(channel.owner_id, creatorVptUnits);
    }

    if (communityPoolNgn > 0) {
      await PoolService.creditPool(communityPoolNgn, 'exclusive_channel_access', {
        channel_id: channel.id,
        payer_uid: req.userId,
        owner_uid: channel.owner_id,
        reference_id: paymentReference,
      });
    }

    if (operationsPoolNgn > 0) {
      await PoolService.creditOperationsPool(operationsPoolNgn, 'exclusive_channel_access', {
        channel_id: channel.id,
        payer_uid: req.userId,
        owner_uid: channel.owner_id,
        reference_id: paymentReference,
      });
    }

    await distributeReferralVpt({
      subscriberUid: req.userId,
      referralPoolNgn,
      referenceId: paymentReference,
      channel,
    });

    const pic = generatePic();
    const access = await ExclusiveAccess.grantOrRenew({
      userUid: req.userId,
      channelId: channel.id,
      picHash: hashPic(pic),
      sourcePaymentId: paymentReference,
      monthlyFeeNgn: amount,
    });

    const isRenewal = Boolean(latestAccess && latestAccess.status !== 'active');
    const viewer = await User.findById(req.userId);
    const owner = await User.findById(channel.owner_id);

    const viewerMessage = buildExclusiveLifecycleMessage('user.purchase', {
      user: viewer,
      channelName: channel.name,
      isRenewal,
    });
    const creatorMessage = buildExclusiveLifecycleMessage('creator.purchase', {
      user: owner,
      channelName: channel.name,
      isRenewal,
    });

    await Ledger.create({
      uid: req.userId,
      type: 'EXCLUSIVE_CHANNEL_ACCESS_PAYMENT',
      direction: 'debit',
      currency: 'ngn',
      amount_ngn: amount,
      status: 'success',
      channel_id: channel.id,
      reference_id: paymentReference,
      meta: {
        creator_cash: creatorCash,
        community_pool_ngn: communityPoolNgn,
        operations_pool_ngn: operationsPoolNgn,
        referral_pool_ngn: referralPoolNgn,
        creator_vpt_ngn: creatorVptNgn,
        creator_vpt_units: creatorVptUnits,
        access_id: access.id,
      },
      description: `Exclusive channel access payment - ${channel.name}`,
    });

    await NotificationService.notifyUser(req.userId, {
      title: viewerMessage.title,
      body: viewerMessage.body,
      type: viewerMessage.type,
      link: `/channels/${channel.id}`,
      data: {
        channel_id: channel.id,
        access_id: access.id,
        expires_at: String(access.expires_at),
      },
    });

    await NotificationService.notifyUser(channel.owner_id, {
      title: creatorMessage.title,
      body: creatorMessage.body,
      type: creatorMessage.type,
      link: '/dashboard',
      data: {
        channel_id: channel.id,
        payer_uid: req.userId,
        amount_ngn: String(amount),
      },
    });

    if (viewer && viewer.email && !viewer.email.endsWith('@afrovision.invalid')) {
      sendExclusiveLifecycleEmail({
        to: viewer.email,
        subject: viewerMessage.emailSubject,
        title: viewerMessage.title,
        body: viewerMessage.body,
        ctaUrl: `https://afrovision-website-134538542038.us-central1.run.app/channel/${channel.id}/exclusive-access`,
        ctaLabel: viewerMessage.ctaLabel,
      }).catch((err) => console.error('[Exclusive] viewer lifecycle email failed:', err.message));
    }

    if (owner && owner.email && !owner.email.endsWith('@afrovision.invalid')) {
      sendExclusiveLifecycleEmail({
        to: owner.email,
        subject: creatorMessage.emailSubject,
        title: creatorMessage.title,
        body: creatorMessage.body,
        ctaUrl: 'https://afrovision-website-134538542038.us-central1.run.app/dashboard',
        ctaLabel: creatorMessage.ctaLabel,
      }).catch((err) => console.error('[Exclusive] creator lifecycle email failed:', err.message));
    }

    const responsePayload = {
      has_access: true,
      access_id: access.id,
      expires_at: access.expires_at,
      personal_identifier_code: pic,
      split: {
        creator_cash: creatorCash,
        community_pool_ngn: communityPoolNgn,
        operations_pool_ngn: operationsPoolNgn,
        referral_pool_ngn: referralPoolNgn,
        creator_vpt_ngn: creatorVptNgn,
        creator_vpt_units: creatorVptUnits,
      },
    };

    await safeAuditLog(req.userId, isRenewal ? 'exclusive_entitlement_renewed' : 'exclusive_entitlement_issued', access.id, {
      channel_id: channel.id,
      amount_ngn: amount,
      payment_reference: paymentReference,
      expires_at: access.expires_at,
    });

    await finalizePurchaseIdempotency(idempotencyDoc, {
      status: 'completed',
      result: responsePayload,
    });

    return res.json(responsePayload);
  } catch (err) {
    if (paymentReference && channel) {
      try {
        await queueExclusiveSplitException({
          referenceId: paymentReference,
          channelId: channel.id,
          userUid: req.userId,
          ownerUid: channel.owner_id,
          amountNgn: Number(channel.exclusive_monthly_fee_ngn || 0),
          split: splitSnapshot || {},
          reason: 'SPLIT_PARTIAL_FAILURE',
          failedStep: 'purchaseExclusiveAccess',
          errorMessage: err.message,
          context: {
            route: 'POST /channels/:id/exclusive/purchase',
          },
        });
      } catch (queueError) {
        console.error('[Exclusive] failed to queue split exception:', queueError.message);
      }
    }

    await finalizePurchaseIdempotency(idempotencyDoc, {
      status: 'failed',
      error: err.message,
    });

    await safeAuditLog(req.userId, 'exclusive_purchase_failed', req.params.id, {
      reason: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });

    console.error('[Exclusive] purchase:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function verifyExclusivePic(req, res) {
  try {
    if (!(await enforceRolloutAccess(req, res))) return;

    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'exclusive') {
      return res.status(400).json({ error: 'Channel is not exclusive' });
    }

    const { pic } = req.body;
    if (!pic || typeof pic !== 'string') {
      return res.status(400).json({ error: 'pic is required' });
    }

    const attemptState = await getPicAttemptState(req.userId, channel.id);
    if (attemptState.locked_until && attemptState.locked_until > Date.now()) {
      const retryAfterSeconds = Math.max(1, Math.ceil((attemptState.locked_until - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Too many invalid PIC attempts. Try again later.',
        retry_after_seconds: retryAfterSeconds,
        locked_until: attemptState.locked_until,
      });
    }

    const active = await ExclusiveAccess.findActiveByUserAndChannel(req.userId, channel.id);
    if (!active) {
      return res.status(403).json({ error: 'No active exclusive access entitlement' });
    }

    const isValid = hashPic(pic.trim()) === active.pic_hash;
    if (!isValid) {
      const nextState = await registerPicFailure({
        userId: req.userId,
        channelId: channel.id,
      });

      await safeAuditLog(req.userId, 'exclusive_pic_verify_failed', active.id, {
        channel_id: channel.id,
        failed_attempts: nextState.failed_attempts,
        locked: nextState.locked,
        locked_until: nextState.locked_until,
      });

      if (nextState.locked) {
        const retryAfterSeconds = Math.max(1, Math.ceil((nextState.locked_until - Date.now()) / 1000));
        return res.status(429).json({
          error: 'Too many invalid PIC attempts. Try again later.',
          retry_after_seconds: retryAfterSeconds,
          locked_until: nextState.locked_until,
        });
      }

      return res.status(403).json({ error: 'Invalid personal identifier code' });
    }

    await clearPicFailureState({
      userId: req.userId,
      channelId: channel.id,
    });

    await safeAuditLog(req.userId, 'exclusive_pic_verified', active.id, {
      channel_id: channel.id,
      expires_at: active.expires_at,
    });

    return res.json({ valid: true, expires_at: active.expires_at, access_id: active.id });
  } catch (err) {
    console.error('[Exclusive] verify-pic:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function renewExclusiveAccess(req, res) {
  return purchaseExclusiveAccess(req, res);
}

async function updateExclusiveSettings(req, res) {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const caller = await User.findById(req.userId);
    const isOwner = channel.owner_id === req.userId;
    const isAdmin = caller && caller.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    if (channel.type !== 'exclusive') {
      return res.status(400).json({ error: 'Channel is not exclusive' });
    }

    const monthlyFee = Number(req.body.monthly_fee_ngn);
    if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
      return res.status(400).json({ error: 'monthly_fee_ngn must be greater than 0' });
    }

    const updated = await Channel.updateExclusiveSettings(req.params.id, {
      exclusive_monthly_fee_ngn: monthlyFee,
      exclusive_fee_currency: 'NGN',
      exclusive_fee_last_updated_at: new Date().toISOString(),
      exclusive_fee_last_updated_by: req.userId,
    });

    await safeAuditLog(req.userId, 'exclusive_fee_updated', req.params.id, {
      monthly_fee_ngn: monthlyFee,
      currency: 'NGN',
    });

    return res.json({ channel: updated });
  } catch (err) {
    console.error('[Exclusive] update-settings:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  isAdultKycVerified,
  checkExclusiveAccessStatus,
  purchaseExclusiveAccess,
  verifyExclusivePic,
  renewExclusiveAccess,
  updateExclusiveSettings,
};
