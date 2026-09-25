/**
 * TV Device Controller
 * Endpoints the Android TV app calls: one-time activation, periodic heartbeat
 * (kill switch + config + update checks), and the two-way message center.
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const model = require('./distribution.model');
const auth = require('./distribution.auth');
const User = require('../users/user.model');
const { getFirestore } = require('../utils/firestore');
const { generateToken } = require('../utils/jwt');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

async function getOwnerSafely(ownerId) {
  try {
    return await User.findById(ownerId);
  } catch (error) {
    console.error('[Distribution] Owner lookup failed:', error.message);
    return null;
  }
}

async function safeEnrichChannel(channel, owner) {
  const ChannelSub = require('../subscriptions/channel_subscription.model');
  const ownerDisplayMode = channel.owner_display_mode || 'show_owner';
  const ownerBrandName = typeof channel.owner_brand_name === 'string'
    ? channel.owner_brand_name.trim()
    : null;
  const trueOwnerName = owner?.name || owner?.email || 'Unknown';

  let publicOwnerName = trueOwnerName;
  if (ownerDisplayMode === 'hide_owner') {
    publicOwnerName = '';
  } else if (ownerDisplayMode === 'brand_only') {
    publicOwnerName = ownerBrandName || 'Brand';
  }

  let subscriberCount = 0;
  try {
    subscriberCount = await ChannelSub.countActiveByChannel(channel.id);
  } catch (_) {}

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    category: channel.category,
    type: channel.type,
    channel_number: Number(channel.channel_number) || channel.channel_number,
    logo_url: channel.logo_url,
    banner_url: channel.banner_url,
    is_active: channel.is_active,
    created_at: channel.created_at,
    owner_id: channel.owner_id,
    owner_name: publicOwnerName,
    subscriber_count: subscriberCount,
    followers_count: subscriberCount,
    stream_source_mode: channel.stream_source_mode || 'native',
    external_provider: channel.external_provider || null,
    external_url: channel.external_url || null,
    resolved_playback_url: channel.resolved_playback_url || null,
    stream_status: channel.stream_status || 'unknown',
    is_exclusive: channel.type === 'exclusive'
      || Number(channel.exclusive_monthly_fee_ngn || 0) > 0,
    exclusive_monthly_fee_ngn: Number(channel.exclusive_monthly_fee_ngn || 0),
    exclusive_fee_currency: channel.exclusive_fee_currency || 'NGN',
  };
}

/**
 * Create (or reuse) the AfroVision user record for a TV owner.
 * TV users live in the same `users` collection with account_type: 'tv'
 * so they are explicitly distinguishable from app users.
 */
async function linkTvDevice(user, { deviceId, activationCode, fullName, phone }) {
  const db = getFirestore();
  const existingDeviceIds = Array.isArray(user.tv_device_ids) ? user.tv_device_ids : [];
  const tvFields = {
    // Explicit TV-user flag. Existing app users keep their account_type
    // untouched but gain the tv_device linkage.
    account_type: user.account_type || 'tv',
    is_tv_user: true,
    tv_device_ids: existingDeviceIds.includes(deviceId)
      ? existingDeviceIds
      : [...existingDeviceIds, deviceId],
    tv_activation_code: activationCode,
    ...(fullName ? { name: user.name || fullName } : {}),
    ...(phone ? { phoneNumber: user.phoneNumber || phone } : {}),
  };
  await db.collection('users').doc(user.id).set(tvFields, { merge: true });
  await User.reloadFromFirestore(user.id);
  return User.findById(user.id);
}

/**
 * "Register" path: brand new account. Errors out instead of silently
 * merging into an existing account of the same email - that silent-merge
 * behavior was how a mistyped-but-coincidentally-valid email, or someone
 * who forgot they already had an account, could accidentally end up
 * merged into a stranger's account (or, just as bad, fail to notice they
 * already had one and think "Register" made them a fresh one). If the
 * email is already taken, the TV should send the user to "Sign in" instead.
 */
async function resolveOwnerForRegister({ email, fullName, phone, deviceId, activationCode }) {
  const existing = await User.findByEmail(email);
  if (existing) {
    return { error: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists. Choose "Sign in" instead.', status: 409 };
  }
  const randomPassword = crypto.randomBytes(24).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 10);
  const user = await User.create({ email, passwordHash });
  const linked = await linkTvDevice(user, { deviceId, activationCode, fullName, phone });
  return { user: linked };
}

/**
 * "Sign in" path: links the TV to an existing account, the same real
 * password check /auth/login uses (bcrypt against password_hash) - not a
 * fuzzy email match. This is what actually prevents duplicate/misattributed
 * accounts: the owner proves who they are instead of just typing an email.
 */
async function resolveOwnerForSignIn({ email, password, deviceId, activationCode }) {
  const user = await User.findByEmail(email);
  if (!user || !user.password_hash) {
    return { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', status: 401 };
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', status: 401 };
  }
  if (user.is_banned && user.role !== 'admin') {
    return { error: 'ACCOUNT_BANNED', message: 'Your account has been banned. Contact support.', status: 403 };
  }
  const linked = await linkTvDevice(user, { deviceId, activationCode });
  return { user: linked };
}

/**
 * POST /distribution/tv/activate
 * Body: { code, owner_email, owner_name, owner_phone, device_id, device_name, app_version }
 *
 * One code = one TV, forever. A code that was already used can only
 * re-activate the exact device it is bound to (e.g. after a factory reset).
 */
/**
 * POST /distribution/tv/crash-report  (public, no auth)
 * Body: { report: string } - a plain-text stack trace + device info,
 * persisted locally by the TV app when it crashes and uploaded on the next
 * launch (see TvApplication.persistCrashReport / CrashReportUploader.kt).
 * There is no way to attach a debugger or pull logcat off a real viewer's
 * TV, so this is the only way a crash ever becomes visible at all - logged
 * to stdout (captured by Cloud Run/gcloud logging) and stored in Firestore
 * so it can be queried later without having to search raw logs.
 */
exports.reportCrash = async (req, res) => {
  try {
    const report = typeof req.body?.report === 'string' ? req.body.report.slice(0, 8000) : '';
    if (!report.trim()) {
      return res.status(400).json({ error: 'report is required' });
    }
    console.error('[TV Crash Report]\n' + report);
    try {
      const db = getFirestore();
      await db.collection('tv_crash_reports').add({
        report,
        ip: clientIp(req),
        created_at: new Date(),
      });
    } catch (firestoreErr) {
      console.error('[TV Crash Report] failed to persist to Firestore:', firestoreErr.message);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[TV Crash Report] handler error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.activate = async (req, res) => {
  try {
    const {
      code,
      mode,
      owner_email,
      owner_name,
      owner_phone,
      owner_password,
      device_id,
      device_name,
      app_version,
    } = req.body || {};

    const isSignIn = mode === 'signin';
    const email = String(owner_email || '').trim().toLowerCase();
    const fullName = String(owner_name || '').trim();
    const phone = String(owner_phone || '').trim();
    const password = String(owner_password || '');
    const deviceId = String(device_id || '').trim();

    if (!code) return res.status(400).json({ error: 'Activation code is required' });
    if (!deviceId) return res.status(400).json({ error: 'Device ID is required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'A valid owner email is required' });
    if (isSignIn) {
      if (!password) return res.status(400).json({ error: 'Password is required' });
    } else {
      if (fullName.length < 2) return res.status(400).json({ error: 'Owner full name is required' });
      if (phone.length < 6) return res.status(400).json({ error: 'Owner phone number is required' });
    }

    const entry = await model.findActivationCode(code);
    if (!entry) {
      return res.status(404).json({ error: 'INVALID_CODE', message: 'This activation code does not exist.' });
    }
    if (entry.status === 'revoked') {
      return res.status(410).json({ error: 'CODE_REVOKED', message: 'This activation code has been revoked. Contact your distributor.' });
    }

    // ── Re-activation path: code already bound to this exact device ──
    if (entry.status === 'activated') {
      if (entry.device_id !== deviceId) {
        return res.status(409).json({
          error: 'CODE_ALREADY_USED',
          message: 'This code has already been used on another TV. One code activates exactly one TV.',
        });
      }
      const device = await model.findDeviceById(deviceId);
      if (device?.status === 'disabled') {
        return res.status(403).json({
          error: 'DEVICE_DISABLED',
          message: device.disabled_reason || 'This TV has been disabled. Contact your distributor.',
        });
      }
      const deviceToken = await auth.generateDeviceToken(deviceId);
      await model.updateDevice(deviceId, {
        last_seen_at: new Date().toISOString(),
        app_version: app_version || device?.app_version || null,
      });
      const settings = await model.getSettings();
      const userToken = device?.owner_user_id ? await generateToken(device.owner_user_id) : null;
      return res.status(200).json({
        success: true,
        reactivated: true,
        device_token: deviceToken,
        user_token: userToken,
        device_id: deviceId,
        owner: { email: device?.owner_email || email, name: device?.owner_name || fullName },
        config_version: settings.config_version,
      });
    }

    // ── Fresh activation ──
    const distributor = await model.findDistributorById(entry.distributor_id);
    if (!distributor || distributor.status === 'banned') {
      return res.status(403).json({ error: 'DISTRIBUTOR_INVALID', message: 'The issuing distributor is no longer active.' });
    }

    const settings = await model.getSettings();
    const resolved = isSignIn
      ? await resolveOwnerForSignIn({ email, password, deviceId, activationCode: entry.code })
      : await resolveOwnerForRegister({ email, fullName, phone, deviceId, activationCode: entry.code });
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error, message: resolved.message });
    }
    const owner = resolved.user;
    const ownerName = owner.name || fullName;
    const ownerPhone = owner.phoneNumber || phone;

    await model.updateActivationCode(entry.code, {
      status: 'activated',
      activated_at: new Date().toISOString(),
      device_id: deviceId,
      owner_user_id: owner.id,
    });

    await model.upsertDevice(deviceId, {
      activation_code: entry.code,
      owner_user_id: owner.id,
      owner_email: email,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      distributor_id: entry.distributor_id,
      marketer_id: entry.marketer_id,
      device_name: device_name || 'AfroVision TV',
      app_version: app_version || null,
      location: { ip: clientIp(req) },
      status: 'active',
      disabled_reason: null,
      disabled_by: null,
      activated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      last_read_message_at: new Date().toISOString(),
    });

    // Record revenue + split in the remittance ledger.
    const price = Number(settings.activation_price_ngn) || 0;
    const splitPercent = model.distributorSplitPercent(distributor, settings);
    const afrovisionShare = Math.round((price * splitPercent) / 100);
    await model.addLedgerEntry({
      type: 'activation_revenue',
      distributor_id: entry.distributor_id,
      marketer_id: entry.marketer_id,
      code: entry.code,
      device_id: deviceId,
      amount_ngn: price,
      split_percent_afrovision: splitPercent,
      afrovision_share_ngn: afrovisionShare,
      distributor_share_ngn: price - afrovisionShare,
    });

    // Attribution counters.
    const marketer = await model.findMarketerById(entry.marketer_id);
    if (marketer) {
      await model.updateMarketer(marketer.id, {
        activation_count: (Number(marketer.activation_count) || 0) + 1,
      });
    }

    const deviceToken = await auth.generateDeviceToken(deviceId);
    const userToken = await generateToken(owner.id);
    return res.status(200).json({
      success: true,
      reactivated: false,
      device_token: deviceToken,
      user_token: userToken,
      device_id: deviceId,
      owner: { email, name: ownerName },
      config_version: settings.config_version,
    });
  } catch (error) {
    console.error('[Distribution] TV activation error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/tv/heartbeat  (device token)
 * The TV calls this on launch and periodically. This is the enforcement
 * point for the kill switch, config refresh, and self-update.
 */
exports.heartbeat = async (req, res) => {
  try {
    const device = req.device;
    const { app_version } = req.body || {};

    const settings = await model.getSettings();

    await model.updateDevice(device.id, {
      last_seen_at: new Date().toISOString(),
      app_version: app_version || device.app_version || null,
      location: { ...(device.location || {}), ip: clientIp(req) },
    });

    if (device.status === 'disabled') {
      return res.status(200).json({
        enabled: false,
        disabled_reason: device.disabled_reason || 'This TV has been disabled. Contact your distributor.',
        config_version: settings.config_version,
      });
    }

    const messages = await model.listMessagesForDevice(device, 50);
    const lastRead = device.last_read_message_at || device.activated_at || '';
    const unreadCount = messages.filter((m) => (m.created_at || '') > lastRead).length;

    let chatSummary = { unread_messages: 0, pending_requests: 0, total: 0 };
    if (device.owner_user_id) {
      const chatModel = require('../chat/chat.model');
      chatSummary = await chatModel.getUnreadSummary(device.owner_user_id);
    }

    return res.status(200).json({
      enabled: true,
      config_version: settings.config_version,
      unread_messages: unreadCount + chatSummary.total,
      unread_admin_messages: unreadCount,
      unread_chat: chatSummary,
      app_update: {
        latest_version_code: settings.tv_app?.latest_version_code || 1,
        latest_version_name: settings.tv_app?.latest_version_name || '1.0.0',
        apk_url: settings.tv_app?.apk_url || null,
      },
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Distribution] TV heartbeat error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/tv/channel/:channelNumber  (device token)
 * Looks up a channel by its channel number, regardless of type (public/private/exclusive).
 * The TV app uses this as a fallback when a typed channel number is not in the loaded list.
 */
exports.getChannelByNumber = async (req, res) => {
  try {
    const Channel = require('../channels/channel.model');
    const channel = await Channel.findByNumber(req.params.channelNumber);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    if (channel.is_banned) {
      return res.status(403).json({ error: 'CHANNEL_BANNED', message: 'This channel has been banned.' });
    }

    const owner = await getOwnerSafely(channel.owner_id);
    const enriched = await safeEnrichChannel(channel, owner);
    return res.status(200).json({ channel: enriched });
  } catch (error) {
    console.error('[Distribution] TV getChannelByNumber error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/tv/channels  (device token)
 * Returns all channels the TV device owner can access: public channels,
 * private channels they've subscribed to, and exclusive channels they have
 * active access to. This replaces the standard /channels endpoint for TV devices.
 */
exports.getChannels = async (req, res) => {
  try {
    const Channel = require('../channels/channel.model');
    const ChannelSub = require('../subscriptions/channel_subscription.model');
    const channels = await Channel.getAll();
    const device = req.device;
    const ownerUid = device.owner_user_id;

    // Fetch exclusive channel accesses for the owner
    let exclusiveChannelIds = new Set();
    // Fetch private channel subscriptions for the owner
    let subscribedChannelIds = new Set();

    if (ownerUid) {
      try {
        const db = getFirestore();
        const exclSnapshot = await db.collection('exclusive_channel_access')
          .where('user_uid', '==', ownerUid)
          .where('status', '==', 'active')
          .get();
        exclSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.channel_id) exclusiveChannelIds.add(data.channel_id);
        });
      } catch (err) {
        console.error('[Distribution] TV getChannels: exclusive access lookup failed:', err.message);
      }

      try {
        subscribedChannelIds = new Set(await ChannelSub.getActiveSubscribedChannelIds(ownerUid));
      } catch (err) {
        console.error('[Distribution] TV getChannels: subscription lookup failed:', err.message);
      }
    }

    const visibleChannels = channels.filter((channel) => {
      if (channel.is_banned) return false;
      // A channel's own creator always sees it - the same owner rule the
      // content routes apply (utils/exclusive-access-helper.js). Owners hold
      // no exclusive_channel_access record for their own channel, so without
      // this their exclusive channel and its movies/series/library vanished
      // from their TV.
      if (ownerUid && channel.owner_id === ownerUid) return true;
      // Public channels: always visible (exclusive-fee public channels need active access)
      if (channel.type === 'public') {
        if (Number(channel.exclusive_monthly_fee_ngn || 0) > 0) {
          return exclusiveChannelIds.has(channel.id);
        }
        return true;
      }
      // Private channels: visible if owner has an active subscription
      if (channel.type === 'private') {
        if (Number(channel.exclusive_monthly_fee_ngn || 0) > 0) {
          return exclusiveChannelIds.has(channel.id);
        }
        return subscribedChannelIds.has(channel.id);
      }
      // Exclusive type channels: visible if owner has active exclusive access
      if (channel.type === 'exclusive') {
        return exclusiveChannelIds.has(channel.id);
      }
      return false;
    });

    const enriched = await Promise.all(visibleChannels.map(async (ch) => {
      const owner = await getOwnerSafely(ch.owner_id);
      return safeEnrichChannel(ch, owner);
    }));

    return res.status(200).json({ channels: enriched });
  } catch (error) {
    console.error('[Distribution] TV getChannels error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/tv/exclusive/access  (device token)
 * Real status of the device owner's exclusive-channel access, so the TV's
 * Exclusive screen can show something truthful instead of a fake "join"
 * button - the platform has no single membership tier, access is granted
 * per exclusive channel (request/approve or paid unlock on mobile/web).
 */
exports.getExclusiveAccessSummary = async (req, res) => {
  try {
    const Channel = require('../channels/channel.model');
    const ownerUid = req.device?.owner_user_id;
    if (!ownerUid) {
      return res.status(200).json({ accesses: [], total: 0 });
    }

    const db = getFirestore();
    const snapshot = await db.collection('exclusive_channel_access')
      .where('user_uid', '==', ownerUid)
      .where('status', '==', 'active')
      .get();

    const accesses = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    const channelIds = [...new Set(accesses.map((a) => a.channel_id))];
    const channelDocs = await Promise.all(channelIds.map((id) => Channel.findById(id)));
    const channelsById = {};
    channelDocs.forEach((channel) => { if (channel) channelsById[channel.id] = channel; });

    const enriched = accesses.map((access) => ({
      channel_id: access.channel_id,
      channel_name: channelsById[access.channel_id]?.name || 'Unknown channel',
      expires_at: access.expires_at || null,
      monthly_fee_ngn: access.monthly_fee_ngn || null,
    }));

    return res.status(200).json({ accesses: enriched, total: enriched.length });
  } catch (error) {
    console.error('[Distribution] TV getExclusiveAccessSummary error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/tv/messages  (device token)
 */
exports.listMessages = async (req, res) => {
  try {
    const device = req.device;
    const messages = await model.listMessagesForDevice(device, 50);
    const lastRead = device.last_read_message_at || device.activated_at || '';
    return res.status(200).json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        body: m.body,
        allow_reply: m.allow_reply !== false,
        created_at: m.created_at,
        unread: (m.created_at || '') > lastRead,
      })),
    });
  } catch (error) {
    console.error('[Distribution] TV messages error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/tv/messages/mark-read  (device token)
 * Marks everything up to now as read for this device.
 */
exports.markMessagesRead = async (req, res) => {
  try {
    await model.updateDevice(req.device.id, {
      last_read_message_at: new Date().toISOString(),
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Distribution] TV mark-read error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/tv/messages/:id/reply  (device token)
 * Body: { body }
 */
exports.replyToMessage = async (req, res) => {
  try {
    const message = await model.findMessageById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.allow_reply === false) {
      return res.status(403).json({ error: 'This message does not accept replies' });
    }
    if (!model.messageTargetsDevice(message, req.device)) {
      return res.status(403).json({ error: 'This message was not sent to this TV' });
    }
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Reply body is required' });
    if (body.length > 500) return res.status(400).json({ error: 'Reply is too long (max 500 characters)' });

    const reply = await model.addMessageReply({
      messageId: message.id,
      deviceId: req.device.id,
      body,
    });
    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('[Distribution] TV reply error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
