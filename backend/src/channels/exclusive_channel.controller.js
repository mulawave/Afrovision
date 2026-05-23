const crypto = require('crypto');
const Channel = require('./channel.model');
const User = require('../users/user.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const PoolService = require('../vpt/pool.service');
const ReferralModel = require('../referrals/referral.model');
const ExclusiveAccess = require('./exclusive_access.model');
const NotificationService = require('../notifications/notification.service');
const { isAdultKycVerified } = require('./exclusive_policy.service');

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
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'exclusive') {
      return res.status(400).json({ error: 'Channel is not exclusive' });
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
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'exclusive') {
      return res.status(400).json({ error: 'Channel is not exclusive' });
    }

    const eligibleByKyc = await isAdultKycVerified(req.userId);
    if (!eligibleByKyc) {
      return res.status(403).json({ error: 'KYC adult verification is required' });
    }

    const existing = await ExclusiveAccess.findActiveByUserAndChannel(req.userId, channel.id);
    if (existing) {
      return res.json({
        has_access: true,
        expires_at: existing.expires_at,
        access_id: existing.id,
        already_active: true,
      });
    }

    const amount = Number(channel.exclusive_monthly_fee_ngn || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Exclusive fee is not configured for this channel' });
    }

    const wallet = await GiftWallet.ensureWallet(req.userId);
    if ((wallet.ngn_balance || 0) < amount) {
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
    const paymentReference = `exc_${channel.id}_${req.userId}_${Date.now()}`;

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
      title: 'Exclusive Access Activated',
      body: `Your access for ${channel.name} is active for 30 days.`,
      type: 'exclusive_access_activated',
      link: `/channels/${channel.id}`,
      data: {
        channel_id: channel.id,
        access_id: access.id,
        expires_at: String(access.expires_at),
      },
    });

    await NotificationService.notifyUser(channel.owner_id, {
      title: 'New Exclusive Subscriber',
      body: `A user purchased access to ${channel.name}.`,
      type: 'exclusive_access_purchase',
      link: '/dashboard',
      data: {
        channel_id: channel.id,
        payer_uid: req.userId,
        amount_ngn: String(amount),
      },
    });

    return res.json({
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
    });
  } catch (err) {
    console.error('[Exclusive] purchase:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function verifyExclusivePic(req, res) {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'exclusive') {
      return res.status(400).json({ error: 'Channel is not exclusive' });
    }

    const { pic } = req.body;
    if (!pic || typeof pic !== 'string') {
      return res.status(400).json({ error: 'pic is required' });
    }

    const active = await ExclusiveAccess.findActiveByUserAndChannel(req.userId, channel.id);
    if (!active) {
      return res.status(403).json({ error: 'No active exclusive access entitlement' });
    }

    const isValid = hashPic(pic.trim()) === active.pic_hash;
    if (!isValid) {
      return res.status(403).json({ error: 'Invalid personal identifier code' });
    }

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
