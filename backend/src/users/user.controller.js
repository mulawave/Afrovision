const User = require('./user.model');
const { uploadSingleToGCS, upload } = require('../utils/upload');
const PaystackService = require('../wallet/paystack.service');
const Channel = require('../channels/channel.model');
const AuditService = require('../admin/audit.service');
const { getFirestore } = require('../utils/firestore');
const {
  maskAccountNumber,
  serializeBankDetails,
} = require('./bank-details.presenter');

function normalizeAccountNumber(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

async function getProfile(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

async function getBankDetails(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    bank_details: serializeBankDetails(user.bank_details),
    can_add: !user.bank_details,
  });
}

async function listSupportedBanks(req, res) {
  try {
    const banks = await PaystackService.listBanks();
    res.json({ banks });
  } catch (err) {
    console.error('[Users] listSupportedBanks error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to load banks' });
  }
}

async function resolveBankAccount(req, res) {
  try {
    const { bank_code, account_number } = req.body;
    const normalizedAccountNumber = normalizeAccountNumber(account_number);
    if (!bank_code || !normalizedAccountNumber) {
      return res.status(400).json({ error: 'bank_code and account_number are required' });
    }
    if (normalizedAccountNumber.length != 10) {
      return res.status(400).json({ error: 'Account number must be 10 digits' });
    }

    const resolved = await PaystackService.resolveAccountNumber(
      normalizedAccountNumber,
      bank_code,
    );
    res.json({
      account_name: resolved.account_name,
      account_number: resolved.account_number,
      bank_code: resolved.bank_code,
    });
  } catch (err) {
    console.error('[Users] resolveBankAccount error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to resolve bank account' });
  }
}

async function createBankDetails(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.bank_details) {
      return res.status(409).json({ error: 'Bank details already saved and cannot be edited in-app' });
    }

    const { bank_code, bank_name, account_number, account_name } = req.body;
    const normalizedAccountNumber = normalizeAccountNumber(account_number);
    if (!bank_code || !bank_name || !normalizedAccountNumber || !account_name) {
      return res.status(400).json({ error: 'bank_code, bank_name, account_number and account_name are required' });
    }
    if (normalizedAccountNumber.length != 10) {
      return res.status(400).json({ error: 'Account number must be 10 digits' });
    }

    const resolved = await PaystackService.resolveAccountNumber(
      normalizedAccountNumber,
      bank_code,
    );

    if (resolved.account_name.trim().toLowerCase() != String(account_name).trim().toLowerCase()) {
      return res.status(400).json({ error: 'Account name does not match verified Paystack result' });
    }

    const bankDetails = {
      bank_name: bank_name,
      bank_code: bank_code,
      account_name: resolved.account_name,
      account_number: resolved.account_number,
      account_number_masked: maskAccountNumber(resolved.account_number),
      provider: 'paystack',
      created_at: Date.now(),
    };

    await User.setBankDetails(req.userId, bankDetails);
    res.status(201).json({ bank_details: serializeBankDetails(bankDetails) });
  } catch (err) {
    console.error('[Users] createBankDetails error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to save bank details' });
  }
}

async function resolveCreator(creatorId) {
  const creator = await User.findById(creatorId);
  if (!creator) return { error: 'Creator not found', status: 404 };
  if (!['creator', 'admin'].includes(creator.role)) {
    return { error: 'Target user is not a creator', status: 400 };
  }
  return { creator };
}

async function updateProfile(req, res) {
  const { name, email } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (email !== undefined) {
    const emailStr = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const existing = await User.findByEmail(emailStr);
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    fields.email = emailStr;
  }
  const user = await User.updateProfile(req.userId, fields);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

async function uploadAvatar(req, res) {
  if (!req.file || !req.file.gcsUrl) {
    return res.status(400).json({ error: 'Avatar image is required' });
  }
  const user = await User.updateProfile(req.userId, { avatar_url: req.file.gcsUrl });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

async function updateCurrency(req, res) {
  const { currency } = req.body;
  if (!currency) return res.status(400).json({ error: 'Currency code is required' });
  const Currency = require('../currencies/currency.model');
  if (!Currency.findByCode(currency.toUpperCase())) {
    return res.status(400).json({ error: 'Unsupported currency' });
  }
  const user = await User.updateProfile(req.userId, { preferred_currency: currency.toUpperCase() });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

async function requestCreator(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'creator' || user.role === 'admin') {
    return res.json({
      eligible: false,
      message: 'Your account already has creator access.',
      redirect_path: '/creator-studio',
    });
  }
  return res.status(409).json({
    eligible: true,
    creator_plan_required: true,
    message:
      'Upgrade through a creator plan to unlock creator access. Moving to a creator plan replaces viewer-plan perks, but you can still access public and private channels without buying a viewer plan again.',
    redirect_path: '/plans',
    recommended_plan_type: 'creator',
  });
}

async function registerFcmToken(req, res) {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'FCM token is required' });
  }
  const user = await User.addFcmToken(req.userId, token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Return the AfroVision-exclusive token so the app can confirm which token is in use
  res.json({ success: true, afroDeviceToken: user.afroDeviceToken || token });
}

async function getDeviceToken(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ afroDeviceToken: user.afroDeviceToken || null });
}

async function unregisterFcmToken(req, res) {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'FCM token is required' });
  }
  const user = await User.removeFcmToken(req.userId, token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
}

async function getFollowStatus(req, res) {
  const { creatorId } = req.params;
  const resolved = await resolveCreator(creatorId);
  if (resolved.error) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  res.json({
    followed: await User.isFollowing(req.userId, creatorId),
    followers_count: await User.countFollowers(creatorId),
  });
}

async function followCreator(req, res) {
  const { creatorId } = req.params;
  if (creatorId === req.userId) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  const resolved = await resolveCreator(creatorId);
  if (resolved.error) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  const user = await User.followCreator(req.userId, creatorId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    followed: true,
    followers_count: await User.countFollowers(creatorId),
  });
}

async function unfollowCreator(req, res) {
  const { creatorId } = req.params;
  const resolved = await resolveCreator(creatorId);
  if (resolved.error) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  const user = await User.unfollowCreator(req.userId, creatorId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    followed: false,
    followers_count: await User.countFollowers(creatorId),
  });
}

async function getFollowingCreators(req, res) {
  const creatorIds = await User.getFollowingCreatorIds(req.userId);
  const creators = (await Promise.all(creatorIds
    .map((creatorId) => User.findById(creatorId))))
    .filter(Boolean)
    .map((creator) => User.toSafeUser(creator));

  res.json({ creators });
}

async function getChannelFollowStatus(req, res) {
  const { channelId } = req.params;
  const channel = await Channel.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  res.json({
    followed: await User.isFollowingChannel(req.userId, channelId),
    followers_count: await User.countChannelFollowers(channelId),
    is_owner: channel.owner_id === req.userId,
  });
}

async function followChannel(req, res) {
  const { channelId } = req.params;
  const channel = await Channel.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id === req.userId) {
    return res.status(400).json({ error: 'You cannot follow your own channel' });
  }

  const user = await User.followChannel(req.userId, channelId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    followed: true,
    followers_count: await User.countChannelFollowers(channelId),
  });
}

async function unfollowChannel(req, res) {
  const { channelId } = req.params;
  const channel = await Channel.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const user = await User.unfollowChannel(req.userId, channelId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    followed: false,
    followers_count: await User.countChannelFollowers(channelId),
  });
}

// ── Delete Account Request ──────────────────────────────

const DELETE_REQUESTS_COLLECTION = 'account_deletion_requests';
const DELETION_GRACE_DAYS = 30;

/**
 * POST /users/delete-account
 * Creates an account deletion request with a 30-day grace period.
 */
async function requestAccountDeletion(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { reason, feedback } = req.body;

    const db = getFirestore();

    // Check for existing pending request
    const existingSnap = await db.collection(DELETE_REQUESTS_COLLECTION)
      .where('user_id', '==', req.userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data();
      return res.status(409).json({
        error: 'A deletion request is already pending',
        request: {
          id: existingSnap.docs[0].id,
          scheduled_deletion_at: existing.scheduled_deletion_at,
          created_at: existing.created_at,
        },
      });
    }

    const now = Date.now();
    const scheduledAt = now + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const crypto = require('crypto');
    const requestId = crypto.randomUUID();

    const request = {
      id: requestId,
      user_id: req.userId,
      email: user.email,
      reason: reason || 'No reason provided',
      feedback: feedback || '',
      status: 'pending',
      created_at: now,
      scheduled_deletion_at: scheduledAt,
      grace_period_days: DELETION_GRACE_DAYS,
    };

    await db.collection(DELETE_REQUESTS_COLLECTION).doc(requestId).set(request);

    await AuditService.logAction(req.userId, 'request_account_deletion', req.userId, {
      reason: reason || 'No reason provided',
      scheduled_deletion_at: scheduledAt,
    });

    res.json({
      message: `Account deletion scheduled. Your account will be permanently deleted on ${new Date(scheduledAt).toISOString().split('T')[0]}. You can cancel this request before that date.`,
      request: {
        id: requestId,
        scheduled_deletion_at: scheduledAt,
        grace_period_days: DELETION_GRACE_DAYS,
        created_at: now,
      },
    });
  } catch (err) {
    console.error('[Users] requestAccountDeletion error:', err.message);
    res.status(500).json({ error: 'Failed to process deletion request' });
  }
}

/**
 * GET /users/delete-account
 * Check if there's a pending deletion request.
 */
async function getDeletionStatus(req, res) {
  try {
    const db = getFirestore();
    const snap = await db.collection(DELETE_REQUESTS_COLLECTION)
      .where('user_id', '==', req.userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ has_pending_request: false });
    }

    const request = snap.docs[0].data();
    res.json({
      has_pending_request: true,
      request: {
        id: snap.docs[0].id,
        scheduled_deletion_at: request.scheduled_deletion_at,
        grace_period_days: request.grace_period_days,
        created_at: request.created_at,
        reason: request.reason,
      },
    });
  } catch (err) {
    console.error('[Users] getDeletionStatus error:', err.message);
    res.status(500).json({ error: 'Failed to check deletion status' });
  }
}

/**
 * DELETE /users/delete-account
 * Cancel a pending deletion request.
 */
async function cancelAccountDeletion(req, res) {
  try {
    const db = getFirestore();
    const snap = await db.collection(DELETE_REQUESTS_COLLECTION)
      .where('user_id', '==', req.userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: 'No pending deletion request found' });
    }

    const docRef = snap.docs[0].ref;
    await docRef.update({
      status: 'cancelled',
      cancelled_at: Date.now(),
    });

    await AuditService.logAction(req.userId, 'cancel_account_deletion', req.userId, {});

    res.json({ message: 'Account deletion request cancelled. Your account is safe.' });
  } catch (err) {
    console.error('[Users] cancelAccountDeletion error:', err.message);
    res.status(500).json({ error: 'Failed to cancel deletion request' });
  }
}

/**
 * POST /users/delete-account/confirm
 * Immediately delete the account (skip grace period). Requires password confirmation.
 */
async function confirmImmediateDeletion(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required to confirm deletion' });

    // Verify password
    const bcrypt = require('bcryptjs');
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    // Disable all owned channels
    const activeOwnedChannels = (await Channel.getAllByOwner(req.userId)).filter((ch) => ch.is_active);
    for (const channel of activeOwnedChannels) {
      await Channel.disable(channel.id);
    }

    // Cancel any pending deletion request
    const db = getFirestore();
    const snap = await db.collection(DELETE_REQUESTS_COLLECTION)
      .where('user_id', '==', req.userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ status: 'executed', executed_at: Date.now() });
    }

    // Soft-delete the user
    await User.softDelete(req.userId, req.userId);

    await AuditService.logAction(req.userId, 'immediate_account_deletion', req.userId, {
      disabled_channels: activeOwnedChannels.length,
    });

    res.json({ message: 'Account deleted successfully. We are sorry to see you go.' });
  } catch (err) {
    console.error('[Users] confirmImmediateDeletion error:', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  updateCurrency,
  requestCreator,
  getDeviceToken,
  registerFcmToken,
  unregisterFcmToken,
  getFollowStatus,
  followCreator,
  unfollowCreator,
  getChannelFollowStatus,
  followChannel,
  unfollowChannel,
  getFollowingCreators,
  getBankDetails,
  listSupportedBanks,
  resolveBankAccount,
  createBankDetails,
  requestAccountDeletion,
  getDeletionStatus,
  cancelAccountDeletion,
  confirmImmediateDeletion,
};
